
create or replace function public.edgy_head_to_head_all(p_opponent uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
with viewer as (select auth.uid() uid),
matches as (
 select 'chess'::text game,r.code,r.updated_at played_at,r.finish_reason,
 r.ply as moves,r.white_id,r.black_id,r.status from public.chess_rooms r,viewer v
 where r.status in('white_win','black_win','draw') and ((r.white_id=v.uid and r.black_id=p_opponent) or (r.black_id=v.uid and r.white_id=p_opponent))
 union all
 select 'checkers'::text game,r.code,r.updated_at,r.finish_reason,r.ply,r.white_id,r.black_id,r.status from public.checkers_rooms r,viewer v
 where r.status in('white_win','black_win','draw') and ((r.white_id=v.uid and r.black_id=p_opponent) or (r.black_id=v.uid and r.white_id=p_opponent))
 union all
 select 'tic'::text game,r.code,r.updated_at,r.finish_reason,r.ply,r.white_id,r.black_id,r.status from public.tic_rooms r,viewer v
 where r.status in('white_win','black_win','draw') and ((r.white_id=v.uid and r.black_id=p_opponent) or (r.black_id=v.uid and r.white_id=p_opponent))
), results as (
 select game,code,played_at,finish_reason,moves,
  case when status='draw' then 'draw'
   when (status='white_win' and white_id=(select uid from viewer))
     or (status='black_win' and black_id=(select uid from viewer)) then 'win'
   else 'loss' end outcome
 from matches
)
select jsonb_build_object(
 'wins',count(*) filter(where outcome='win'),
 'draws',count(*) filter(where outcome='draw'),
 'losses',count(*) filter(where outcome='loss'),
 'total',count(*),
 'games',coalesce(
 (select jsonb_agg(jsonb_build_object(
 'game',sub.game,'code',sub.code,'date',sub.played_at,'outcome',sub.outcome,'reason',sub.finish_reason,'moves',sub.moves
 ) order by sub.played_at desc)
 from (select * from results order by played_at desc limit 30) sub),'[]'::jsonb)
)
from results;
$$;
revoke all on function public.edgy_head_to_head_all(uuid) from public,anon;
grant execute on function public.edgy_head_to_head_all(uuid) to authenticated;
