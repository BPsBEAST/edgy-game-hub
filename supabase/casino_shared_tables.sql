-- EDGY Casino tables: server-authoritative blackjack dealer and shared bets.
-- Previously applied to the EDGY Supabase project; kept for reproducible setup.
create table if not exists public.edgy_casino_rooms(
 id uuid primary key default gen_random_uuid(),
 code text unique not null check(code ~ '^[0-9A-F]{8}$'),
 host_id uuid not null references auth.users(id) on delete cascade,
 game text not null check(game in('blackjack','coinflip','roulette')),
 bot boolean not null default false,
 status text not null default 'waiting' check(status in('waiting','playing','finished','closed')),
 round integer not null default 0,
 state jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.edgy_casino_seats(
 room_id uuid not null references public.edgy_casino_rooms(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 seat integer not null check(seat between 1 and 6),
 stake integer check(stake in (10,25,50,100)),
 choice text,
 hand jsonb not null default '[]'::jsonb,
 done boolean not null default false,
 result text,
 payout integer not null default 0,
 primary key(room_id,user_id),unique(room_id,seat)
);
create index if not exists edgy_casino_user_rooms on public.edgy_casino_seats(user_id,room_id);
alter table public.edgy_casino_rooms enable row level security;
alter table public.edgy_casino_seats enable row level security;
revoke all on public.edgy_casino_rooms from anon,authenticated;
revoke all on public.edgy_casino_seats from anon,authenticated;

CREATE OR REPLACE FUNCTION edgy_internal.edgy_casino_hand_value(p_cards jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare v_card jsonb;v_rank integer;v_total integer:=0;v_aces integer:=0;
begin
 for v_card in select value from jsonb_array_elements(coalesce(p_cards,'[]'::jsonb)) loop
   v_rank:=(v_card::text)::integer % 13 + 1;
   if v_rank=1 then v_total:=v_total+1;v_aces:=v_aces+1;
   else v_total:=v_total+least(v_rank,10);end if;
 end loop;
 while v_aces>0 and v_total+10<=21 loop v_total:=v_total+10;v_aces:=v_aces-1;end loop;
 return v_total;
end$function$;

CREATE OR REPLACE FUNCTION edgy_internal.edgy_casino_blackjack_finish(p_code text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_room public.edgy_casino_rooms%rowtype;v_deck jsonb;v_dealer jsonb;v_pos integer;
 v_total integer;v_dealer_bj boolean;v_player_total integer;v_payout integer;v_gain integer;v_outcome text;rec record;v_balance integer;
begin
 select * into v_room from public.edgy_casino_rooms where code=p_code for update;
 if not found or v_room.status<>'playing' or v_room.game<>'blackjack' then raise exception 'Mesa de Blackjack indisponível';end if;
 v_deck:=v_room.state->'deck';v_dealer:=v_room.state->'dealer';v_pos:=(v_room.state->>'pos')::integer;
 v_total:=edgy_internal.edgy_casino_hand_value(v_dealer);
 v_dealer_bj:=jsonb_array_length(v_dealer)=2 and v_total=21;
 if exists(select 1 from public.edgy_casino_seats where room_id=v_room.id
     and edgy_internal.edgy_casino_hand_value(hand)<=21 and edgy_internal.edgy_casino_hand_value(hand)<>21)
 then
   while v_total<17 loop
     v_dealer:=v_dealer||jsonb_build_array((v_deck->>v_pos)::integer);
     v_pos:=v_pos+1;v_total:=edgy_internal.edgy_casino_hand_value(v_dealer);
   end loop;
 end if;
 for rec in select * from public.edgy_casino_seats where room_id=v_room.id order by seat loop
   v_player_total:=edgy_internal.edgy_casino_hand_value(rec.hand);
   if v_player_total>21 then v_payout:=0;v_outcome:='Perdeste · ultrapassaste 21';
   elsif jsonb_array_length(rec.hand)=2 and v_player_total=21 and not v_dealer_bj then
     v_payout:=(rec.stake*5)/2;v_outcome:='Blackjack!';
   elsif (v_player_total=v_total and v_total<=21) or (v_dealer_bj and jsonb_array_length(rec.hand)=2 and v_player_total=21) then
     v_payout:=rec.stake;v_outcome:='Empate';
   elsif v_total>21 or v_player_total>v_total then
     v_payout:=rec.stake*2;v_outcome:='Ganhaste!';
   else v_payout:=0;v_outcome:='Perdeste';
   end if;
   v_gain:=greatest(v_payout-rec.stake,0);
   update public.edgy_casino_seats set result=v_outcome,payout=v_payout,done=true
    where room_id=v_room.id and user_id=rec.user_id;
   if v_payout>0 then
     perform set_config('edgy.arcade_award','1',true);
     update public.profiles set wallet_xp=wallet_xp+v_payout,xp=xp+v_gain,updated_at=now()
      where id=rec.user_id returning wallet_xp into v_balance;
     perform set_config('edgy.arcade_award','0',true);
     insert into public.edgy_xp_transactions(user_id,kind,delta,balance_after,stake,payout,choice,outcome,request_id)
      values(rec.user_id,'blackjack_payout',v_payout,v_balance,0,v_payout,'settle',
      jsonb_build_object('room',v_room.code,'round',v_room.round,'career_award',v_gain,'result',v_outcome),gen_random_uuid());
   end if;
 end loop;
 update public.edgy_casino_rooms set status='finished',
    state=state||jsonb_build_object('dealer',v_dealer,'pos',v_pos,'dealer_total',v_total),
    updated_at=now() where id=v_room.id;
end$function$;

CREATE OR REPLACE FUNCTION public.edgy_casino_room_action(p_code text, p_action text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid:=(select auth.uid());v_room public.edgy_casino_rooms%rowtype;v_seat public.edgy_casino_seats%rowtype;
 v_num integer;v_color text;v_face text;v_deck jsonb;v_dealer jsonb;v_hand jsonb;v_pos integer;
 v_total integer;v_payout integer;v_delta integer;v_gain integer;v_balance integer;
 v_result jsonb:='{}'::jsonb;rec record;v_count integer;v_ready integer;
 v_red integer[]:=array[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
begin
 select * into v_room from public.edgy_casino_rooms where code=upper(trim(p_code)) for update;
 if not found or v_room.status='closed' then raise exception 'Mesa indisponível';end if;
 select * into v_seat from public.edgy_casino_seats where room_id=v_room.id and user_id=v_uid;
 if not found then raise exception 'Não pertences à mesa';end if;
 if p_action='leave' then
   if v_room.status='playing' then raise exception 'Termina primeiro a tua mão';end if;
   if v_room.host_id=v_uid then
     if (select count(*) from public.edgy_casino_seats where room_id=v_room.id)>1 then
       raise exception 'Fecha a mesa para todos antes de saíres';end if;
     update public.edgy_casino_rooms set status='closed',updated_at=now() where id=v_room.id;
   else
     delete from public.edgy_casino_seats where room_id=v_room.id and user_id=v_uid;
     update public.edgy_casino_rooms set updated_at=now() where id=v_room.id;
   end if;
   return jsonb_build_object('ok',true);
 end if;
 if p_action='next' then
   if v_room.host_id<>v_uid or v_room.status<>'finished' then raise exception 'Não podes preparar a próxima ronda';end if;
   update public.edgy_casino_rooms set status='waiting',state='{}'::jsonb,updated_at=now() where id=v_room.id;
   update public.edgy_casino_seats set stake=null,choice=null,hand='[]'::jsonb,done=false,result=null,payout=0 where room_id=v_room.id;
   return jsonb_build_object('ok',true);
 end if;
 if p_action='start' then
   if v_room.host_id<>v_uid or v_room.status<>'waiting' then raise exception 'A ronda não pode começar';end if;
   select count(*),count(stake) into v_count,v_ready from public.edgy_casino_seats where room_id=v_room.id;
   if (not v_room.bot and v_count<2) or v_ready<>v_count then
     raise exception 'São precisos jogadores e todos devem escolher uma aposta';end if;
   -- Lock every wallet in a stable order and verify stakes before any debit.
   for rec in select p.id,p.wallet_xp,s.stake from public.profiles p
      join public.edgy_casino_seats s on s.user_id=p.id
      where s.room_id=v_room.id order by p.id for update of p loop
     if rec.wallet_xp<rec.stake then raise exception 'Um jogador não tem XP suficiente para a aposta';end if;
   end loop;
   v_num:=('x'||substr(replace(gen_random_uuid()::text,'-',''),1,8))::bit(32)::bigint%37;
   v_color:=case when v_num=0 then 'green' when v_num=any(v_red) then 'red' else 'black' end;
   v_face:=case when ('x'||substr(replace(gen_random_uuid()::text,'-',''),1,8))::bit(32)::bigint%2=0 then 'cara' else 'coroa' end;
   if v_room.game='blackjack' then
     select jsonb_agg(n order by gen_random_uuid()) into v_deck from generate_series(0,51) n;
     v_pos:=0;
     for rec in select * from public.edgy_casino_seats where room_id=v_room.id order by seat loop
       v_hand:=jsonb_build_array((v_deck->>v_pos)::integer,(v_deck->>(v_pos+1))::integer);
       v_pos:=v_pos+2;
       update public.profiles set wallet_xp=wallet_xp-rec.stake
         where id=rec.user_id returning wallet_xp into v_balance;
       insert into public.edgy_xp_transactions(user_id,kind,delta,balance_after,stake,payout,choice,outcome,request_id)
       values(rec.user_id,'blackjack',-rec.stake,v_balance,rec.stake,0,'deal',
        jsonb_build_object('room',v_room.code,'round',v_room.round+1),gen_random_uuid());
       update public.edgy_casino_seats set hand=v_hand,done=(edgy_internal.edgy_casino_hand_value(v_hand)=21),
        result=null,payout=0 where room_id=v_room.id and user_id=rec.user_id;
     end loop;
     v_dealer:=jsonb_build_array((v_deck->>v_pos)::integer,(v_deck->>(v_pos+1))::integer);
     v_pos:=v_pos+2;
     update public.edgy_casino_rooms set status='playing',round=round+1,
       state=jsonb_build_object('deck',v_deck,'pos',v_pos,'dealer',v_dealer),
       updated_at=now() where id=v_room.id;
     if edgy_internal.edgy_casino_hand_value(v_dealer)=21 or
       not exists(select 1 from public.edgy_casino_seats where room_id=v_room.id and done=false) then
       perform edgy_internal.edgy_casino_blackjack_finish(v_room.code);
     end if;
   else
     for rec in select * from public.edgy_casino_seats where room_id=v_room.id order by seat loop
       v_payout:=0;
       if v_room.game='coinflip' then
         if rec.choice=v_face then v_payout:=rec.stake*2;end if;
       elsif rec.choice=v_color and rec.choice in('red','black') then v_payout:=rec.stake*2;
       elsif (rec.choice='green' and v_num=0) or
          (left(rec.choice,2)='n:' and substring(rec.choice from 3)::integer=v_num)
       then v_payout:=rec.stake*36;end if;
       v_delta:=v_payout-rec.stake;v_gain:=greatest(v_delta,0);
       perform set_config('edgy.arcade_award','1',true);
       update public.profiles set wallet_xp=wallet_xp+v_delta,xp=xp+v_gain,updated_at=now()
         where id=rec.user_id returning wallet_xp into v_balance;
       perform set_config('edgy.arcade_award','0',true);
       v_result:=case when v_room.game='coinflip' then jsonb_build_object('face',v_face)
         else jsonb_build_object('number',v_num,'color',v_color) end;
       insert into public.edgy_xp_transactions(user_id,kind,delta,balance_after,stake,payout,choice,outcome,request_id)
       values(rec.user_id,v_room.game,v_delta,v_balance,rec.stake,v_payout,rec.choice,
        v_result||jsonb_build_object('room',v_room.code,'round',v_room.round+1,'career_award',v_gain),gen_random_uuid());
       update public.edgy_casino_seats set payout=v_payout,done=true,
        result=case when v_delta>0 then 'Ganhaste!' else 'Sem prémio' end where room_id=v_room.id and user_id=rec.user_id;
     end loop;
     update public.edgy_casino_rooms set status='finished',round=round+1,
      state=jsonb_build_object('outcome',v_result),updated_at=now() where id=v_room.id;
   end if;
   return jsonb_build_object('ok',true);
 end if;
 if v_room.game<>'blackjack' or v_room.status<>'playing' or p_action not in('hit','stand') then
   raise exception 'Ação indisponível';end if;
 if v_seat.done then raise exception 'A tua mão já terminou';end if;
 if p_action='hit' then
   v_deck:=v_room.state->'deck';v_pos:=(v_room.state->>'pos')::integer;
   if v_pos>=52 then raise exception 'Baralho esgotado';end if;
   v_hand:=v_seat.hand||jsonb_build_array((v_deck->>v_pos)::integer);
   update public.edgy_casino_seats set hand=v_hand,
      done=(edgy_internal.edgy_casino_hand_value(v_hand)>=21)
     where room_id=v_room.id and user_id=v_uid;
   update public.edgy_casino_rooms set state=jsonb_set(state,'{pos}',to_jsonb(v_pos+1)),updated_at=now() where id=v_room.id;
 else
   update public.edgy_casino_seats set done=true where room_id=v_room.id and user_id=v_uid;
 end if;
 if not exists(select 1 from public.edgy_casino_seats where room_id=v_room.id and done=false) then
   perform edgy_internal.edgy_casino_blackjack_finish(v_room.code);
 end if;
 return jsonb_build_object('ok',true);
end$function$;

CREATE OR REPLACE FUNCTION public.edgy_casino_room_bet(p_code text, p_stake integer, p_choice text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid:=(select auth.uid());v_room public.edgy_casino_rooms%rowtype;v_balance integer;
begin
 if p_stake not in (10,25,50,100) then raise exception 'Valor inválido';end if;
 select * into v_room from public.edgy_casino_rooms where code=upper(trim(p_code)) for update;
 if not found or v_room.status<>'waiting' then raise exception 'A mesa não está a receber apostas';end if;
 if not exists(select 1 from public.edgy_casino_seats where room_id=v_room.id and user_id=v_uid) then raise exception 'Não pertences à mesa';end if;
 if p_choice is null or
    (v_room.game='blackjack' and p_choice<>'deal') or
    (v_room.game='coinflip' and p_choice not in ('cara','coroa')) or
    (v_room.game='roulette' and p_choice not in('red','black','green')
      and not(p_choice ~ '^n:([0-9]|[12][0-9]|3[0-6])$'))
 then raise exception 'Aposta inválida';end if;
 select wallet_xp into v_balance from public.profiles where id=v_uid;
 if v_balance<p_stake then raise exception 'XP insuficiente';end if;
 update public.edgy_casino_seats set stake=p_stake,choice=p_choice where room_id=v_room.id and user_id=v_uid;
 update public.edgy_casino_rooms set updated_at=now() where id=v_room.id;
 return true;
end$function$;

CREATE OR REPLACE FUNCTION public.edgy_casino_room_cancel(p_code text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_room public.edgy_casino_rooms%rowtype;
begin
 select * into v_room from public.edgy_casino_rooms where code=upper(trim(p_code)) for update;
 if not found or v_room.host_id is distinct from (select auth.uid()) then raise exception 'Só o anfitrião pode fechar a mesa';end if;
 if v_room.status='playing' then raise exception 'Termina a ronda primeiro';end if;
 update public.edgy_casino_rooms set status='closed',updated_at=now() where id=v_room.id;
 update public.edgy_game_invites set status='cancelled',responded_at=now()
 where room_code=v_room.code and game='casino_'||v_room.game and status='pending';
 return true;
end$function$;

CREATE OR REPLACE FUNCTION public.edgy_casino_room_create(p_game text, p_bot boolean DEFAULT false)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid:=(select auth.uid());v_room uuid;v_code text;v_attempt integer;
begin
 if v_uid is null or not exists(select 1 from auth.users u where u.id=v_uid and not u.is_anonymous)
 then raise exception 'Precisas de uma conta registada';end if;
 if p_game not in ('blackjack','roulette','coinflip') or (p_bot and p_game<>'blackjack') then raise exception 'Jogo inválido';end if;
 if p_bot then
   select r.code into v_code from public.edgy_casino_rooms r
   where r.host_id=v_uid and r.bot and r.game=p_game and r.status<>'closed' order by r.created_at desc limit 1;
   if v_code is not null then return v_code;end if;
 end if;
 for v_attempt in 1..12 loop
   v_code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
   begin insert into public.edgy_casino_rooms(code,host_id,game,bot)
     values(v_code,v_uid,p_game,p_bot) returning id into v_room;exit;
   exception when unique_violation then null;end;
 end loop;
 if v_room is null then raise exception 'Não foi possível criar a mesa';end if;
 insert into public.edgy_casino_seats(room_id,user_id,seat) values(v_room,v_uid,1);
 return v_code;
end$function$;

CREATE OR REPLACE FUNCTION public.edgy_casino_room_join(p_code text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid:=(select auth.uid());v_room public.edgy_casino_rooms%rowtype;v_seat integer;v_max integer;
begin
 if v_uid is null or not exists(select 1 from auth.users where id=v_uid and not is_anonymous)
 then raise exception 'Precisas de uma conta registada';end if;
 select * into v_room from public.edgy_casino_rooms where code=upper(trim(p_code)) for update;
 if not found or v_room.status='closed' then raise exception 'Mesa não encontrada';end if;
 if exists(select 1 from public.edgy_casino_seats where room_id=v_room.id and user_id=v_uid) then return true;end if;
 if v_room.bot or v_room.status<>'waiting' then raise exception 'Esta mesa já não permite entradas';end if;
 v_max:=case when v_room.game='coinflip' then 2 else 6 end;
 select s into v_seat from generate_series(1,v_max) s
 where not exists(select 1 from public.edgy_casino_seats where room_id=v_room.id and seat=s) order by s limit 1;
 if v_seat is null then raise exception 'Mesa cheia';end if;
 insert into public.edgy_casino_seats(room_id,user_id,seat) values(v_room.id,v_uid,v_seat);
 update public.edgy_casino_rooms set updated_at=now() where id=v_room.id;
 return true;
end$function$;

CREATE OR REPLACE FUNCTION public.edgy_casino_room_state(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid:=(select auth.uid());v_room public.edgy_casino_rooms%rowtype;v_players jsonb;v_dealer jsonb;
begin
 select * into v_room from public.edgy_casino_rooms where code=upper(trim(p_code));
 if not found or v_room.status='closed' or not exists
 (select 1 from public.edgy_casino_seats where room_id=v_room.id and user_id=v_uid)
 then raise exception 'Mesa indisponível';end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',s.user_id,'name',coalesce(p.display_name,'Jogador'),
  'seat',s.seat,'stake',s.stake,'choice',s.choice,
  'hand',s.hand,'total',edgy_internal.edgy_casino_hand_value(s.hand),
  'done',s.done,'result',s.result,'payout',s.payout
 ) order by s.seat),'[]'::jsonb) into v_players
 from public.edgy_casino_seats s left join public.profiles p on p.id=s.user_id where s.room_id=v_room.id;
 v_dealer:=coalesce(v_room.state->'dealer','[]'::jsonb);
 if v_room.game='blackjack' and v_room.status='playing' and jsonb_array_length(v_dealer)>1 then
   v_dealer:=jsonb_build_array(v_dealer->0,-1);
 end if;
 return jsonb_build_object(
  'code',v_room.code,'game',v_room.game,'bot',v_room.bot,'status',v_room.status,
  'host',v_room.host_id,'my_id',v_uid,'round',v_room.round,'players',v_players,
  'dealer',v_dealer,'dealer_total',case when v_room.status='playing' then null else v_room.state->'dealer_total' end,
  'outcome',coalesce(v_room.state->'outcome','{}'::jsonb)
 );
end$function$;


revoke all on function edgy_internal.edgy_casino_hand_value(jsonb) from public;
revoke all on function edgy_internal.edgy_casino_blackjack_finish(text) from public;
revoke all on function public.edgy_casino_room_create(text,boolean) from public;
revoke all on function public.edgy_casino_room_join(text) from public;
revoke all on function public.edgy_casino_room_cancel(text) from public;
revoke all on function public.edgy_casino_room_state(text) from public;
revoke all on function public.edgy_casino_room_bet(text,integer,text) from public;
revoke all on function public.edgy_casino_room_action(text,text) from public;
grant execute on function public.edgy_casino_room_create(text,boolean) to authenticated;
grant execute on function public.edgy_casino_room_join(text) to authenticated;
grant execute on function public.edgy_casino_room_cancel(text) to authenticated;
grant execute on function public.edgy_casino_room_state(text) to authenticated;
grant execute on function public.edgy_casino_room_bet(text,integer,text) to authenticated;
grant execute on function public.edgy_casino_room_action(text,text) to authenticated;
