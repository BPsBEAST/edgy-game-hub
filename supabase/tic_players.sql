-- Only participants can resolve public-friendly names for an online Tic match.
create or replace function private.edgy_tic_players(p_code text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r public.tic_rooms%rowtype; v_uid uuid:=(select auth.uid()); v_json jsonb;
begin
 if v_uid is null then raise exception 'Inicia sessão';end if;
 select * into r from public.tic_rooms where code=upper(trim(p_code));
 if not found or v_uid not in(r.white_id,r.black_id) then raise exception 'Sem acesso à sala';end if;
 select jsonb_build_object(
  'X',jsonb_build_object('name',coalesce(x.display_name,'Jogador X'),'username',x.username,
    'avatar',case when x.public_visible then x.avatar_path else null end),
  'O',case when r.black_id is null then null else jsonb_build_object(
    'name',coalesce(o.display_name,'Jogador O'),'username',o.username,
    'avatar',case when o.public_visible then o.avatar_path else null end)end
 ) into v_json
 from public.profiles x
 left join public.profiles o on o.id=r.black_id
 where x.id=r.white_id;
 return v_json;
end $$;
revoke all on function private.edgy_tic_players(text) from public,anon;
grant execute on function private.edgy_tic_players(text) to authenticated;
create or replace function public.edgy_tic_players(p_code text)
returns jsonb language sql stable security invoker set search_path='' as $$
 select private.edgy_tic_players(p_code)
$$;
revoke all on function public.edgy_tic_players(text) from public,anon;
grant execute on function public.edgy_tic_players(text) to authenticated;