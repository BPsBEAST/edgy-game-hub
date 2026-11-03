-- EDGY Casino: server-authoritative play logic (applied 2026-11-03).
-- Run only on a project where the EDGY wallet tables and trigger already exist.
-- Winnings increase career XP only by net profit. Losses never decrease career XP.
-- The XP credit trigger skips casino gains to avoid double-minting wallet XP.
-- 30 rounds per 24 hours remain; there is no five-second cooldown.

begin;
CREATE OR REPLACE FUNCTION edgy_internal.edgy_wallet_on_xp_gain()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_balance integer;v_delta integer;
begin
 v_delta:=new.xp-old.xp;
 if v_delta<=0 or current_setting('edgy.arcade_award',true)='1' then return new;end if;
 update public.profiles set wallet_xp=wallet_xp+v_delta where id=new.id
 returning wallet_xp into v_balance;
 insert into public.edgy_xp_transactions(user_id,kind,delta,balance_after,outcome)
 values(new.id,'earned',v_delta,v_balance,jsonb_build_object('source','jogos_ou_treino'));
 return new;
end$function$
;

CREATE OR REPLACE FUNCTION public.edgy_arcade_play(p_game text, p_choice text, p_stake integer, p_request uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 uid uuid:=(select auth.uid());v_balance integer;v_total integer;
 v_prev public.edgy_xp_transactions%rowtype;
 v_rounds integer;v_roll integer;v_color text;
 v_payout integer:=0;v_delta integer;v_career_gain integer:=0;v_result jsonb:='{}'::jsonb;
 v_n integer;v_a integer;v_b integer;v_c integer;v_symbols text[]:=array['🍒','🍋','🍇','🍀','⭐','💎'];
 v_red integer[]:=array[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
begin
 if uid is null then raise exception 'Inicia sessão';end if;
 if not exists(select 1 from auth.users u where u.id=uid and not u.is_anonymous) then
  raise exception 'Os jogos de XP requerem uma conta EDGY registada';end if;
 if p_game not in ('coinflip','roulette','slots') then raise exception 'Jogo inválido';end if;
 if p_stake is null or p_stake not in (10,25,50,100) then raise exception 'Escolhe um valor entre 10, 25, 50 ou 100 XP';end if;
 if p_request is null then raise exception 'É necessário identificar a jogada';end if;
 if p_choice is null or (p_game='coinflip' and p_choice not in('cara','coroa'))
 or (p_game='roulette' and p_choice not in('red','black','green')
   and not(p_choice ~ '^n:([0-9]|[12][0-9]|3[0-6])$'))
 or (p_game='slots' and p_choice<>'spin') then
  raise exception 'Escolha inválida';end if;
 -- Serialize wallet operations against awards and other game actions.
 select wallet_xp,xp into v_balance,v_total from public.profiles where id=uid for update;
 if not found then raise exception 'Perfil indisponível';end if;
 select * into v_prev from public.edgy_xp_transactions t
 where t.user_id=uid and t.request_id=p_request;
 if found then
  if v_prev.kind<>p_game or v_prev.stake<>p_stake or v_prev.choice is distinct from p_choice then
    raise exception 'Identificador de jogada reutilizado';end if;
  return jsonb_build_object('game',v_prev.kind,'stake',v_prev.stake,'payout',v_prev.payout,
    'delta',v_prev.delta,'balance',v_prev.balance_after,'total_xp',v_total,
    'choice',v_prev.choice,'result',v_prev.outcome,
    'xp_awarded',coalesce((v_prev.outcome->>'career_award')::integer,0),'duplicate',true);
 end if;
 if v_balance<p_stake then raise exception 'Saldo de XP insuficiente. Joga ou treina para ganhares mais XP.';end if;
 select count(*) into v_rounds
 from public.edgy_xp_transactions
 where user_id=uid and kind in('roulette','coinflip','slots')
 and created_at>=now()-interval '24 hours';
 if v_rounds>=30 then raise exception 'Atingiste o limite de 30 rondas virtuais em 24 horas';end if;
 -- Use PostgreSQL CSPRNG-backed UUIDs, never Math.random from the browser.
 v_roll:=('x'||substr(replace(gen_random_uuid()::text,'-',''),1,8))::bit(32)::bigint%37;
 if p_game='coinflip' then
  v_n:=(('x'||substr(replace(gen_random_uuid()::text,'-',''),1,8))::bit(32)::bigint%2)::integer;
  v_color:=case when v_n=0 then 'cara' else 'coroa' end;
  v_payout:=case when p_choice=v_color then p_stake*2 else 0 end;
  v_result:=jsonb_build_object('face',v_color,'won',v_payout>0);
 elsif p_game='roulette' then
  v_color:=case when v_roll=0 then 'green'
    when v_roll=any(v_red) then 'red' else 'black' end;
  if p_choice in ('red','black') and p_choice=v_color then v_payout:=p_stake*2;
  elsif p_choice='green' and v_roll=0 then v_payout:=p_stake*36;
  elsif left(p_choice,2)='n:' and substring(p_choice from 3)::integer=v_roll then v_payout:=p_stake*36;
  end if;
  v_result:=jsonb_build_object('number',v_roll,'color',v_color,'won',v_payout>0);
 else
  v_a:=(('x'||substr(replace(gen_random_uuid()::text,'-',''),1,8))::bit(32)::bigint%6)::integer;
  v_b:=(('x'||substr(replace(gen_random_uuid()::text,'-',''),1,8))::bit(32)::bigint%6)::integer;
  v_c:=(('x'||substr(replace(gen_random_uuid()::text,'-',''),1,8))::bit(32)::bigint%6)::integer;
  if v_a=v_b and v_b=v_c then v_payout:=p_stake*8;
  elsif v_a=v_b or v_a=v_c or v_b=v_c then v_payout:=(p_stake*3)/2;
  end if;
  v_result:=jsonb_build_object('symbols',jsonb_build_array(v_symbols[v_a+1],v_symbols[v_b+1],v_symbols[v_c+1]),
    'match',case when v_a=v_b and v_b=v_c then 3 when v_a=v_b or v_a=v_c or v_b=v_c then 2 else 0 end,
    'won',v_payout>0);
 end if;
 v_delta:=v_payout-p_stake;
 v_career_gain:=greatest(v_delta,0);
 v_result:=v_result||jsonb_build_object('career_award',v_career_gain);
 -- Casino profit increases career XP without minting extra wallet XP via the normal XP-award trigger.
 perform set_config('edgy.arcade_award','1',true);
 update public.profiles set wallet_xp=wallet_xp+v_delta,xp=xp+v_career_gain,updated_at=now()
 where id=uid returning wallet_xp,xp into v_balance,v_total;
 perform set_config('edgy.arcade_award','0',true);
 insert into public.edgy_xp_transactions(user_id,kind,delta,balance_after,stake,payout,choice,outcome,request_id)
 values(uid,p_game,v_delta,v_balance,p_stake,v_payout,p_choice,v_result,p_request);
 return jsonb_build_object('game',p_game,'stake',p_stake,'payout',v_payout,
  'delta',v_delta,'balance',v_balance,'total_xp',v_total,'xp_awarded',v_career_gain,'choice',p_choice,
  'result',v_result,'duplicate',false);
end$function$
;
commit;
