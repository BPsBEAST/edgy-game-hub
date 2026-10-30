-- EDGY Tic integrated into the existing universal invitation and room listing APIs.
alter table public.edgy_game_invites drop constraint edgy_game_invites_game_check;
alter table public.edgy_game_invites add constraint edgy_game_invites_game_check check (game in ('chess','checkers','tic'));
CREATE OR REPLACE FUNCTION public.edgy_invite_send(p_game text, p_code text, p_recipient uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_sender uuid:=(select auth.uid()); v_id uuid; v_waiting boolean; v_is_account boolean;
begin
 if v_sender is null then raise exception 'Inicia sessão'; end if;
 if p_game not in ('chess','checkers','tic') or p_code !~ '^[A-Fa-f0-9]{8}$' then raise exception 'Sala inválida';end if;
 if p_recipient is null or p_recipient=v_sender then raise exception 'Escolhe outro jogador';end if;
 select not u.is_anonymous into v_is_account from auth.users u where u.id=v_sender;
 if not coalesce(v_is_account,false) then raise exception 'Para convidar pela app precisas de uma conta';end if;
 if not exists(
   select 1 from auth.users u join public.profiles p on p.id=u.id
   where u.id=p_recipient and not u.is_anonymous and p.public_visible=true
 ) then raise exception 'Jogador indisponível para convites';end if;
 if p_game='chess' then
  select exists(select 1 from public.chess_rooms r where r.code=upper(p_code)
   and r.white_id=v_sender and r.black_id is null and r.status='waiting') into v_waiting;
 elsif p_game='checkers' then
  select exists(select 1 from public.checkers_rooms r where r.code=upper(p_code)
   and r.white_id=v_sender and r.black_id is null and r.status='waiting') into v_waiting;
 else
  select exists(select 1 from public.tic_rooms r where r.code=upper(p_code)
   and r.white_id=v_sender and r.black_id is null and r.status='waiting') into v_waiting;
 end if;
 if not v_waiting then raise exception 'Só podes convidar para uma sala tua que esteja à espera';end if;
 if (select count(*) from public.edgy_game_invites i where i.sender_id=v_sender
    and i.status='pending' and i.expires_at>now())>=30 then raise exception 'Limite de convites pendentes atingido';end if;
 insert into public.edgy_game_invites(game,room_code,sender_id,recipient_id)
 values(p_game,upper(p_code),v_sender,p_recipient)
 on conflict(game,room_code,recipient_id) where status='pending'
 do update set created_at=now(),expires_at=now()+interval '7 days'
 returning id into v_id;
 return v_id;
end;$function$;

CREATE OR REPLACE FUNCTION public.edgy_invite_respond(p_invite_id uuid, p_accept boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_inv public.edgy_game_invites%rowtype; v_account uuid:=(select auth.uid());v_ok boolean;
begin
 if v_account is null then raise exception 'Inicia sessão';end if;
 select * into v_inv from public.edgy_game_invites where id=p_invite_id for update;
 if not found or v_inv.recipient_id<>v_account then raise exception 'Convite indisponível';end if;
 if v_inv.status<>'pending' then raise exception 'O convite já foi respondido';end if;
 if v_inv.expires_at<=now() then
  update public.edgy_game_invites set status='cancelled',responded_at=now() where id=v_inv.id;
  raise exception 'O convite expirou';
 end if;
 if not p_accept then
  update public.edgy_game_invites set status='declined',responded_at=now() where id=v_inv.id;
  return jsonb_build_object('accepted',false);
 end if;
 if v_inv.game='chess' then
  select exists(select 1 from public.chess_rooms r where r.code=v_inv.room_code
  and r.white_id=v_inv.sender_id and r.black_id is null and r.status='waiting') into v_ok;
  if not v_ok then raise exception 'Esta sala já não está disponível';end if;
  perform public.edgy_join_chess_room(v_inv.room_code);
 elsif v_inv.game='checkers' then
  select exists(select 1 from public.checkers_rooms r where r.code=v_inv.room_code
  and r.white_id=v_inv.sender_id and r.black_id is null and r.status='waiting') into v_ok;
  if not v_ok then raise exception 'Esta sala já não está disponível';end if;
  perform public.edgy_checkers_join(v_inv.room_code);
 else
  select exists(select 1 from public.tic_rooms r where r.code=v_inv.room_code
  and r.white_id=v_inv.sender_id and r.black_id is null and r.status='waiting') into v_ok;
  if not v_ok then raise exception 'Esta sala já não está disponível';end if;
  perform public.edgy_tic_join(v_inv.room_code);
 end if;
 update public.edgy_game_invites set status='accepted',responded_at=now() where id=v_inv.id;
 update public.edgy_game_invites set status='cancelled',responded_at=now()
 where game=v_inv.game and room_code=v_inv.room_code and id<>v_inv.id and status='pending';
 return jsonb_build_object('accepted',true,'game',v_inv.game,'code',v_inv.room_code);
end;$function$;

CREATE OR REPLACE FUNCTION public.edgy_my_invites()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select coalesce(jsonb_agg(jsonb_build_object(
 'id',i.id,'game',i.game,'code',i.room_code,'sender_id',i.sender_id,
 'sender_name',coalesce(p.display_name,'Jogador'),
 'sender_username',coalesce(p.username,'jogador'),'created_at',i.created_at,
 'expires_at',i.expires_at
 ) order by i.created_at desc),'[]'::jsonb)
from (select * from public.edgy_game_invites v where v.recipient_id=(select auth.uid())
 and v.status='pending' and v.expires_at>now()
 and (case when v.game='chess' then exists(
  select 1 from public.chess_rooms r where r.code=v.room_code
  and r.white_id=v.sender_id and r.black_id is null and r.status='waiting')
 when v.game='checkers' then exists(
  select 1 from public.checkers_rooms r where r.code=v.room_code
  and r.white_id=v.sender_id and r.black_id is null and r.status='waiting')
 else exists(select 1 from public.tic_rooms r where r.code=v.room_code
  and r.white_id=v.sender_id and r.black_id is null and r.status='waiting') end)
 order by v.created_at desc limit 30) i
left join public.profiles p on p.id=i.sender_id;
$function$;

CREATE OR REPLACE FUNCTION public.edgy_my_rooms(p_limit integer DEFAULT 60)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
with rooms as (
 select 'chess'::text game,r.code,r.status,r.white_id,r.black_id,r.created_at,
   r.updated_at,r.base_ms,r.increment_ms from public.chess_rooms r
 where (select auth.uid()) in(r.white_id,r.black_id) and r.status in('waiting','active')
 union all
 select 'checkers'::text game,r.code,r.status,r.white_id,r.black_id,r.created_at,
   r.updated_at,null::bigint base_ms,null::integer increment_ms from public.checkers_rooms r
 where (select auth.uid()) in(r.white_id,r.black_id) and r.status in('waiting','active')
 union all
 select 'tic'::text game,r.code,r.status,r.white_id,r.black_id,r.created_at,
   r.updated_at,null::bigint base_ms,null::integer increment_ms from public.tic_rooms r
 where (select auth.uid()) in(r.white_id,r.black_id) and r.status in('waiting','active')
), chosen as (
 select * from rooms order by
 case when status='active' then 0 when status='waiting' then 1 else 2 end,
 updated_at desc limit least(100,greatest(1,coalesce(p_limit,60)))
)
select coalesce(jsonb_agg(jsonb_build_object(
 'game',r.game,'code',r.code,'status',r.status,'white_id',r.white_id,'black_id',r.black_id,
 'white_name',coalesce(w.display_name,'Jogador'),
 'black_name',case when r.black_id is null then null else coalesce(b.display_name,'Jogador') end,
 'white_username',w.username,'black_username',b.username,'created_at',r.created_at,'updated_at',r.updated_at,
 'base_ms',r.base_ms,'increment_ms',r.increment_ms
 ) order by case when r.status='active' then 0 when r.status='waiting' then 1 else 2 end,r.updated_at desc),'[]'::jsonb)
from chosen r
left join public.profiles w on w.id=r.white_id
left join public.profiles b on b.id=r.black_id;
$function$;
