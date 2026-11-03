
-- Progressive EDGY levels, without resetting earned XP or reducing existing levels.
-- Existing players retain their level and progress as of migration.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS level_anchor integer NOT NULL DEFAULT 1;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS level_anchor_xp integer NOT NULL DEFAULT 0;
-- Freeze each existing player's level and start-of-level XP from the old 100 XP scale.
UPDATE public.profiles
 SET level_anchor=greatest(1,xp/100+1),
     level_anchor_xp=(xp/100)*100
 WHERE level_anchor=1 AND level_anchor_xp=0 AND xp>0;

CREATE OR REPLACE FUNCTION edgy_internal.edgy_level_requirement(p_level integer)
 RETURNS integer LANGUAGE sql IMMUTABLE SET search_path TO '' AS $f$
 SELECT CASE
 WHEN greatest(1,coalesce(p_level,1))<5 THEN 100
 WHEN p_level<10 THEN 150
 WHEN p_level<20 THEN 250
 WHEN p_level<30 THEN 400
 WHEN p_level<50 THEN 600
 WHEN p_level<75 THEN 900
 WHEN p_level<100 THEN 1200
 ELSE 1500 + 250*((p_level-100)/25)
 END;
$f$;

CREATE OR REPLACE FUNCTION edgy_internal.edgy_level_info(p_xp integer,p_anchor_level integer,p_anchor_xp integer)
 RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path TO '' AS $f$
DECLARE
 v_level integer:=greatest(1,coalesce(p_anchor_level,1));
 v_balance bigint:=greatest(0,coalesce(p_xp,0)::bigint-greatest(0,coalesce(p_anchor_xp,0)));
 v_need integer;
BEGIN
 LOOP
  v_need:=edgy_internal.edgy_level_requirement(v_level);
  EXIT WHEN v_balance<v_need;
  v_balance:=v_balance-v_need;
  v_level:=v_level+1;
 END LOOP;
 RETURN jsonb_build_object('level',v_level,'progress',v_balance::integer,
   'required',v_need,'remaining',(v_need-v_balance)::integer);
END;
$f$;
REVOKE ALL ON FUNCTION edgy_internal.edgy_level_requirement(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION edgy_internal.edgy_level_info(integer,integer,integer) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.edgy_list_players(p_search text DEFAULT ''::text, p_limit integer DEFAULT 24)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select case when (select auth.uid()) is null then '[]'::jsonb else coalesce(jsonb_agg(
 jsonb_build_object('id',p.id,'name',p.display_name,'username',p.username,
 'avatar_path',p.avatar_path,'bio',p.bio,'xp',p.xp,
 'level',(edgy_internal.edgy_level_info(p.xp,p.level_anchor,p.level_anchor_xp)->>'level')::integer,
 'matches',(select count(*) from public.match_history h where h.user_id=p.id),
 'chess_wins',(select count(*) from public.match_history h where h.user_id=p.id and h.game='Xadrez' and h.result='Vitória'))
 order by (edgy_internal.edgy_level_info(p.xp,p.level_anchor,p.level_anchor_xp)->>'level')::integer desc,p.xp desc,p.username
 ),'[]'::jsonb) end
 from (
  select p0.* from public.profiles p0
  join auth.users u on u.id=p0.id
  where u.is_anonymous is false and p0.public_visible
   and (nullif(trim(left(coalesce(p_search,''),40)),'') is null
   or position(lower(trim(left(p_search,40))) in lower(p0.username))>0
   or position(lower(trim(left(p_search,40))) in lower(p0.display_name))>0)
  order by (edgy_internal.edgy_level_info(p0.xp,p0.level_anchor,p0.level_anchor_xp)->>'level')::integer desc,p0.xp desc,p0.username
  limit least(40,greatest(1,coalesce(p_limit,24)))
 ) p;
$function$;

CREATE OR REPLACE FUNCTION public.edgy_player_profile(p_player_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select case when (select auth.uid()) is null then null else (
  select jsonb_build_object(
   'id',p.id,'name',p.display_name,'username',p.username,'avatar_path',p.avatar_path,'bio',p.bio,
   'xp',p.xp,'level',(edgy_internal.edgy_level_info(p.xp,p.level_anchor,p.level_anchor_xp)->>'level')::integer,
   'matches',(select count(*) from public.match_history h where h.user_id=p.id),
   'chess_wins',(select count(*) from public.match_history h where h.user_id=p.id and h.game='Xadrez' and h.result='Vitória'),
   'chess_draws',(select count(*) from public.match_history h where h.user_id=p.id and h.game='Xadrez' and h.result='Empate'),
   'chess_losses',(select count(*) from public.match_history h where h.user_id=p.id and h.game='Xadrez' and h.result='Derrota'),
   'recent',coalesce((select jsonb_agg(jsonb_build_object('game',t.game,'result',t.result,'date',t.played_at) order by t.played_at desc)
      from (select h.game,h.result,h.played_at from public.match_history h where h.user_id=p.id order by h.played_at desc limit 5)t),'[]'::jsonb)
  )
  from public.profiles p join auth.users u on u.id=p.id
  where p.id=p_player_id and p.public_visible and u.is_anonymous is false
 ) end;
$function$;

CREATE OR REPLACE FUNCTION public.edgy_wallet_status()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare uid uuid:=(select auth.uid());v_total integer;v_balance integer;v_anchor_level integer;v_anchor_xp integer;v_recent jsonb;v_level jsonb;
begin
 if uid is null then raise exception 'Inicia sessão para utilizar a carteira EDGY';end if;
 select xp,wallet_xp,level_anchor,level_anchor_xp into v_total,v_balance,v_anchor_level,v_anchor_xp from public.profiles where id=uid;
 if not found then raise exception 'Perfil indisponível';end if;
 v_level:=edgy_internal.edgy_level_info(v_total,v_anchor_level,v_anchor_xp);
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',t.id,'kind',t.kind,'delta',t.delta,'balance',t.balance_after,
  'stake',t.stake,'payout',t.payout,'choice',t.choice,
  'outcome',t.outcome,'at',t.created_at) order by t.created_at desc,t.id desc),'[]'::jsonb)
 into v_recent from (
  select * from public.edgy_xp_transactions where user_id=uid
  order by created_at desc,id desc limit 30
 ) t;
 return jsonb_build_object('total_xp',v_total,'wallet_xp',v_balance,
   'level',v_level->'level','level_progress',v_level->'progress','level_required',v_level->'required','level_remaining',v_level->'remaining',
   'level_anchor',v_anchor_level,'level_anchor_xp',v_anchor_xp,'transactions',v_recent);
end$function$;

CREATE OR REPLACE FUNCTION public.gym_public_athlete_summary(p_athlete_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 with athlete as (
  select sp.user_id, p.xp, p.level_anchor,p.level_anchor_xp,p.created_at
  from public.gym_social_profiles sp
  join public.profiles p on p.id=sp.user_id
  join auth.users a on a.id=sp.user_id
  where sp.user_id=p_athlete_id
    and sp.is_public is true
    and a.is_anonymous is false
    and (select auth.uid()) is not null
 ),
 week as (
  select (date_trunc('week',now() at time zone 'Europe/Lisbon')::date + n) as d,
         n as day_index
  from generate_series(0,6) n
 ),
 daily as (
  select w.day_index,
         count(t.id)::integer as sessions
  from week w left join public.gym_workouts t
    on t.user_id=p_athlete_id
   and t.finished_at is not null
   and (t.started_at at time zone 'Europe/Lisbon')::date=w.d
  group by w.day_index
 )
 select jsonb_build_object(
  'xp',a.xp,
  'level',(edgy_internal.edgy_level_info(a.xp,a.level_anchor,a.level_anchor_xp)->>'level')::integer,
  'joined_at',a.created_at,
  'followers',(select count(*) from public.gym_follows f where f.followed_id=a.user_id),
  'following',(select count(*) from public.gym_follows f where f.follower_id=a.user_id),
  'likes_received',(select count(*) from public.gym_post_likes l join public.gym_feed_posts p on p.id=l.post_id where p.user_id=a.user_id),
  'posts',(select count(*) from public.gym_feed_posts p where p.user_id=a.user_id),
  'replies',(select count(*) from public.gym_post_comments c where c.user_id=a.user_id),
  'days',(select coalesce(jsonb_agg(d.sessions order by d.day_index),'[]'::jsonb) from daily d)
 ) from athlete a;
$function$;
