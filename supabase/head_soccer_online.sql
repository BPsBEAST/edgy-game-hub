-- EDGY Head Soccer: private 1v1 real-time rooms, restricted RPC and authenticated Realtime channels.
create table if not exists public.edgy_head_soccer_rooms(
 id uuid primary key default gen_random_uuid(),
 code text not null unique check(code ~ '^[0-9A-F]{8}$'),
 host_id uuid not null references auth.users(id) on delete cascade,
 guest_id uuid references auth.users(id) on delete set null,
 status text not null default 'waiting' check(status in('waiting','active','finished','closed')),
 match_token uuid not null default gen_random_uuid(),
 started_at timestamptz,
 finished_at timestamptz,
 left_score integer not null default 0,
 right_score integer not null default 0,
 winner_side integer check(winner_side in(0,1)),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint edgy_hs_distinct_users check(guest_id is distinct from host_id),
 constraint edgy_hs_score_range check(left_score between 0 and 99 and right_score between 0 and 99)
);
create index if not exists edgy_hs_host_idx on public.edgy_head_soccer_rooms(host_id,status);
create index if not exists edgy_hs_guest_idx on public.edgy_head_soccer_rooms(guest_id,status);
alter table public.edgy_head_soccer_rooms enable row level security;
revoke all on public.edgy_head_soccer_rooms from anon,authenticated;

create or replace function public.edgy_head_soccer_create()
 returns text language plpgsql security definer set search_path='' as $fn$
declare uid uuid:=(select auth.uid());v_id uuid;v_code text;n integer;
begin
 if uid is null or not exists(select 1 from auth.users where id=uid and not is_anonymous) then
  raise exception 'Entra numa conta EDGY para criar uma sala';end if;
 for n in 1..15 loop
  v_code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  begin
   insert into public.edgy_head_soccer_rooms(code,host_id) values(v_code,uid)
   returning id into v_id;
   exit;
  exception when unique_violation then null;
  end;
 end loop;
 if v_id is null then raise exception 'Não foi possível gerar código de sala';end if;
 return v_code;
end$fn$;

create or replace function public.edgy_head_soccer_join(p_code text)
 returns boolean language plpgsql security definer set search_path='' as $fn$
declare uid uuid:=(select auth.uid());r public.edgy_head_soccer_rooms%rowtype;
begin
 if uid is null or not exists(select 1 from auth.users where id=uid and not is_anonymous) then
  raise exception 'É necessária uma conta EDGY';end if;
 if p_code is null or upper(trim(p_code)) !~ '^[0-9A-F]{8}$' then raise exception 'Código inválido';end if;
 select * into r from public.edgy_head_soccer_rooms where code=upper(trim(p_code)) for update;
 if not found or r.status='closed' then raise exception 'Sala indisponível';end if;
 if uid in(r.host_id,r.guest_id) then return true;end if;
 if r.status<>'waiting' or r.guest_id is not null then raise exception 'Sala cheia ou já iniciada';end if;
 update public.edgy_head_soccer_rooms set guest_id=uid,updated_at=now() where id=r.id;
 return true;
end$fn$;

create or replace function public.edgy_head_soccer_state(p_code text)
 returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare uid uuid:=(select auth.uid());r public.edgy_head_soccer_rooms%rowtype;
begin
 select * into r from public.edgy_head_soccer_rooms where code=upper(trim(coalesce(p_code,'')));
 if not found or uid is null or (uid is distinct from r.host_id and uid is distinct from r.guest_id) then
  raise exception 'Não pertences à sala';end if;
 return jsonb_build_object('code',r.code,'status',r.status,'host',r.host_id,
  'guest',r.guest_id,'my_id',uid,'match_token',r.match_token,
  'started_at',r.started_at,'finished_at',r.finished_at,
  'left_score',r.left_score,'right_score',r.right_score,'winner_side',r.winner_side,
  'host_name',(select coalesce(p.display_name,'Jogador 1') from public.profiles p where p.id=r.host_id),
  'guest_name',(select coalesce(p.display_name,'Jogador 2') from public.profiles p where p.id=r.guest_id));
end$fn$;

create or replace function public.edgy_head_soccer_start(p_code text)
 returns uuid language plpgsql security definer set search_path='' as $fn$
declare uid uuid:=(select auth.uid());r public.edgy_head_soccer_rooms%rowtype;v_token uuid;
begin
 select * into r from public.edgy_head_soccer_rooms where code=upper(trim(p_code)) for update;
 if not found or uid is distinct from r.host_id or r.status<>'waiting' or r.guest_id is null
 then raise exception 'Aguarda que o convidado entre antes de iniciar';end if;
 v_token:=gen_random_uuid();
 update public.edgy_head_soccer_rooms set status='active',started_at=now(),finished_at=null,
  match_token=v_token,left_score=0,right_score=0,winner_side=null,updated_at=now()
 where id=r.id;
 return v_token;
end$fn$;

create or replace function public.edgy_head_soccer_finish(p_code text,p_left integer,p_right integer)
 returns jsonb language plpgsql security definer set search_path='' as $fn$
declare uid uuid:=(select auth.uid());r public.edgy_head_soccer_rooms%rowtype;
 v_winner integer;v_award_host integer;v_award_guest integer;
begin
 select * into r from public.edgy_head_soccer_rooms where code=upper(trim(p_code)) for update;
 if not found or uid is distinct from r.host_id then raise exception 'Só o anfitrião pode terminar a partida';end if;
 if r.status='finished' then return jsonb_build_object('ok',true,'already_finished',true);end if;
 if r.status<>'active' or r.guest_id is null then raise exception 'Partida não está em curso';end if;
 if r.started_at>now()-interval '45 seconds' then raise exception 'A partida ainda não chegou ao fim';end if;
 if p_left is null or p_right is null or p_left=p_right or p_left not between 0 and 99 or p_right not between 0 and 99 then
  raise exception 'Resultado inválido: a partida precisa de um vencedor';end if;
 v_winner:=case when p_left>p_right then 0 else 1 end;
 v_award_host:=case when v_winner=0 then 40 else 10 end;
 v_award_guest:=case when v_winner=1 then 40 else 10 end;
 update public.edgy_head_soccer_rooms set status='finished',finished_at=now(),updated_at=now(),
  left_score=p_left,right_score=p_right,winner_side=v_winner where id=r.id;
 -- Rewards are issued exactly once by the server; a losing player never loses XP.
 update public.profiles set xp=xp+v_award_host,updated_at=now() where id=r.host_id;
 update public.profiles set xp=xp+v_award_guest,updated_at=now() where id=r.guest_id;
 return jsonb_build_object('ok',true,'winner_side',v_winner,'host_xp',v_award_host,'guest_xp',v_award_guest);
end$fn$;

create or replace function public.edgy_head_soccer_cancel(p_code text)
 returns boolean language plpgsql security definer set search_path='' as $fn$
declare uid uuid:=(select auth.uid());r public.edgy_head_soccer_rooms%rowtype;
begin
 select * into r from public.edgy_head_soccer_rooms where code=upper(trim(p_code)) for update;
 if not found or uid is distinct from r.host_id then raise exception 'Só o anfitrião pode fechar a sala';end if;
 if r.status='active' then raise exception 'Uma partida ativa não pode ser cancelada';end if;
 update public.edgy_head_soccer_rooms set status='closed',updated_at=now() where id=r.id;
 update public.edgy_game_invites set status='cancelled',responded_at=now()
 where game='headSoccer' and room_code=r.code and status='pending';
 return true;
end$fn$;

create or replace function public.edgy_head_soccer_leave(p_code text)
 returns boolean language plpgsql security definer set search_path='' as $fn$
declare uid uuid:=(select auth.uid());r public.edgy_head_soccer_rooms%rowtype;
begin
 select * into r from public.edgy_head_soccer_rooms where code=upper(trim(p_code)) for update;
 if not found or uid is null or (uid is distinct from r.host_id and uid is distinct from r.guest_id)
 then raise exception 'Não pertences a esta sala';end if;
 if r.status='active' then raise exception 'A partida está ativa; não podes abandonar sem terminar';end if;
 if uid=r.host_id then update public.edgy_head_soccer_rooms set status='closed',updated_at=now() where id=r.id;
 else update public.edgy_head_soccer_rooms set guest_id=null,updated_at=now() where id=r.id;end if;
 return true;
end$fn$;

create or replace function public.edgy_head_soccer_rematch(p_code text)
 returns boolean language plpgsql security definer set search_path='' as $fn$
declare uid uuid:=(select auth.uid());r public.edgy_head_soccer_rooms%rowtype;
begin
 select * into r from public.edgy_head_soccer_rooms where code=upper(trim(p_code)) for update;
 if not found or uid is distinct from r.host_id or r.status<>'finished' or r.guest_id is null
 then raise exception 'Não é possível repetir esta partida';end if;
 update public.edgy_head_soccer_rooms set status='waiting',started_at=null,finished_at=null,
 left_score=0,right_score=0,winner_side=null,match_token=gen_random_uuid(),updated_at=now()
 where id=r.id;
 return true;
end$fn$;

create or replace function edgy_internal.edgy_hs_member(p_code text)
 returns boolean language sql stable security definer set search_path='' as $fn$
 select exists(select 1 from public.edgy_head_soccer_rooms r
  where r.code=p_code and r.status in ('waiting','active','finished')
  and (select auth.uid()) in(r.host_id,r.guest_id));
$fn$;
revoke all on function edgy_internal.edgy_hs_member(text) from public;
grant execute on function edgy_internal.edgy_hs_member(text) to authenticated;

-- Realtime private Broadcast: only current room members may read/write game messages.
create policy edgy_hs_read on realtime.messages for select to authenticated
 using (realtime.topic() ~ '^hs:[0-9A-F]{8}$'
   and edgy_internal.edgy_hs_member(substr(realtime.topic(),4)));
create policy edgy_hs_write on realtime.messages for insert to authenticated
 with check (realtime.topic() ~ '^hs:[0-9A-F]{8}$'
   and edgy_internal.edgy_hs_member(substr(realtime.topic(),4)));

revoke all on function public.edgy_head_soccer_create() from public;
revoke all on function public.edgy_head_soccer_join(text) from public;
revoke all on function public.edgy_head_soccer_state(text) from public;
revoke all on function public.edgy_head_soccer_start(text) from public;
revoke all on function public.edgy_head_soccer_finish(text,integer,integer) from public;
revoke all on function public.edgy_head_soccer_cancel(text) from public;
revoke all on function public.edgy_head_soccer_leave(text) from public;
revoke all on function public.edgy_head_soccer_rematch(text) from public;
grant execute on function public.edgy_head_soccer_create() to authenticated;
grant execute on function public.edgy_head_soccer_join(text) to authenticated;
grant execute on function public.edgy_head_soccer_state(text) to authenticated;
grant execute on function public.edgy_head_soccer_start(text) to authenticated;
grant execute on function public.edgy_head_soccer_finish(text,integer,integer) to authenticated;
grant execute on function public.edgy_head_soccer_cancel(text) to authenticated;
grant execute on function public.edgy_head_soccer_leave(text) to authenticated;
grant execute on function public.edgy_head_soccer_rematch(text) to authenticated;


-- A participant may abandon an active match; the opponent wins.
-- Early abandons (<45 s) cannot mint XP.
create or replace function public.edgy_head_soccer_forfeit(p_code text)
 returns jsonb language plpgsql security definer set search_path='' as $fn$
declare uid uuid:=(select auth.uid());r public.edgy_head_soccer_rooms%rowtype;v_left integer;v_right integer;v_winner integer;v_award boolean;
begin
 select * into r from public.edgy_head_soccer_rooms where code=upper(trim(p_code)) for update;
 if not found or uid is null or (uid is distinct from r.host_id and uid is distinct from r.guest_id) then raise exception 'Sala indisponível';end if;
 if r.status<>'active' then raise exception 'Não há partida ativa para abandonar';end if;
 v_winner:=case when uid=r.host_id then 1 else 0 end;
 v_left:=case when v_winner=0 then greatest(r.left_score,r.right_score+1) else r.left_score end;
 v_right:=case when v_winner=1 then greatest(r.right_score,r.left_score+1) else r.right_score end;
 v_award:=r.started_at<=now()-interval '45 seconds';
 update public.edgy_head_soccer_rooms set status='finished',finished_at=now(),
  updated_at=now(),left_score=v_left,right_score=v_right,winner_side=v_winner where id=r.id;
 if v_award then
  update public.profiles set xp=xp+(case when v_winner=0 then 40 else 10 end),updated_at=now() where id=r.host_id;
  update public.profiles set xp=xp+(case when v_winner=1 then 40 else 10 end),updated_at=now() where id=r.guest_id;
 end if;
 return jsonb_build_object('ok',true,'forfeit',true,'xp_awarded',v_award);
end$fn$;
revoke all on function public.edgy_head_soccer_forfeit(text) from public;
grant execute on function public.edgy_head_soccer_forfeit(text) to authenticated;
