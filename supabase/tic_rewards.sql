-- Grant online Tic results using the same match-history XP trigger as existing local games.
-- One (user_id, room_id) record ensures no double rewards after retries.
create or replace function private.edgy_tic_finished_history()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_w text;v_b text;v_wxp integer;v_bxp integer;
begin
 if old.status<>'active' or new.status not in ('white_win','black_win','draw') or new.black_id is null then return new;end if;
 if new.status='draw' then
   v_w:='Empate';v_b:='Empate';v_wxp:=20;v_bxp:=20;
 elsif new.status='white_win' then
   v_w:='Vitória';v_b:='Derrota';v_wxp:=50;v_bxp:=10;
 else
   v_w:='Derrota';v_b:='Vitória';v_wxp:=10;v_bxp:=50;
 end if;
 insert into public.match_history(user_id,client_id,game,result,xp,played_at)
 values (new.white_id,new.id,'Jogo do Galo',v_w,v_wxp,new.updated_at),
        (new.black_id,new.id,'Jogo do Galo',v_b,v_bxp,new.updated_at)
 on conflict(user_id,client_id) do nothing;
 return new;
end $$;
revoke all on function private.edgy_tic_finished_history() from public,anon,authenticated;
drop trigger if exists edgy_tic_result_history on public.tic_rooms;
create trigger edgy_tic_result_history after update of status on public.tic_rooms
for each row when (old.status is distinct from new.status)
execute function private.edgy_tic_finished_history();
