
-- EDGY online Tic Tac Toe. Existing game tables are untouched.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table if not exists public.tic_rooms(
 id uuid primary key default gen_random_uuid(),
 code text not null unique check(code ~ '^[0-9A-F]{8}$'),
 white_id uuid not null references auth.users(id) on delete cascade,
 black_id uuid references auth.users(id) on delete set null,
 board text not null default '---------' check(board ~ '^[XO-]{9}$'),
 turn text not null default 'X' check(turn in ('X','O')),
 ply integer not null default 0 check(ply between 0 and 9),
 moves jsonb not null default '[]'::jsonb check(jsonb_typeof(moves)='array'),
 status text not null default 'waiting' check(status in ('waiting','active','white_win','black_win','draw','cancelled')),
 finish_reason text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (black_id is null or black_id<>white_id)
);
create index if not exists tic_rooms_white_recent on public.tic_rooms(white_id,updated_at desc);
create index if not exists tic_rooms_black_recent on public.tic_rooms(black_id,updated_at desc);
alter table public.tic_rooms enable row level security;
revoke all on public.tic_rooms from public,anon,authenticated;
grant select on public.tic_rooms to authenticated;
drop policy if exists tic_members_read on public.tic_rooms;
create policy tic_members_read on public.tic_rooms for select to authenticated
 using ((select auth.uid()) in (white_id,black_id));

create or replace function private.edgy_tic_create()
returns text language plpgsql security definer set search_path='' as $$
declare v_user uuid:=(select auth.uid()); v_code text; v_attempt int;
begin
 if v_user is null then raise exception 'Inicia sessão'; end if;
 if (select count(*) from public.tic_rooms r where r.white_id=v_user and r.status='waiting') >= 12
 then raise exception 'Tens demasiadas salas à espera';end if;
 for v_attempt in 1..8 loop
   v_code:=upper(substr(replace(pg_catalog.gen_random_uuid()::text,'-',''),1,8));
   begin
     insert into public.tic_rooms(code,white_id) values (v_code,v_user);
     return v_code;
   exception when unique_violation then continue;
   end;
 end loop;
 raise exception 'Não foi possível gerar o código da sala';
end $$;

create or replace function private.edgy_tic_join(p_code text)
returns text language plpgsql security definer set search_path='' as $$
declare v_user uuid:=(select auth.uid()); v_room public.tic_rooms%rowtype; v_code text:=upper(trim(p_code));
begin
 if v_user is null then raise exception 'Inicia sessão';end if;
 if v_code !~ '^[0-9A-F]{8}$' then raise exception 'Código inválido';end if;
 select * into v_room from public.tic_rooms where code=v_code for update;
 if not found then raise exception 'Sala não encontrada';end if;
 if v_user=v_room.white_id or v_user=v_room.black_id then return v_code;end if;
 if v_room.status<>'waiting' or v_room.black_id is not null then raise exception 'A sala já começou';end if;
 update public.tic_rooms set black_id=v_user,status='active',updated_at=now() where id=v_room.id;
 return v_code;
end $$;

create or replace function private.edgy_tic_cancel(p_code text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_user uuid:=(select auth.uid()); v_changed integer;
begin
 if v_user is null then raise exception 'Inicia sessão';end if;
 update public.tic_rooms set status='cancelled',updated_at=now()
 where code=upper(trim(p_code)) and white_id=v_user and black_id is null and status='waiting';
 get diagnostics v_changed=row_count;
 return v_changed>0;
end $$;

create or replace function private.edgy_tic_move(p_code text,p_cell integer,p_expected_ply integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=(select auth.uid()); r public.tic_rooms%rowtype;
 v_mark text; v_board text; v_win boolean; v_status text;
begin
 if v_user is null then raise exception 'Inicia sessão';end if;
 if p_cell is null or p_cell<0 or p_cell>8 then raise exception 'Casa inválida';end if;
 select * into r from public.tic_rooms where code=upper(trim(p_code)) for update;
 if not found or v_user not in (r.white_id,r.black_id) then raise exception 'Sem acesso à sala';end if;
 if r.status<>'active' then raise exception 'A partida não está ativa';end if;
 if r.ply<>p_expected_ply then raise exception 'A partida foi atualizada. Tenta novamente';end if;
 v_mark:=case when v_user=r.white_id then 'X' else 'O' end;
 if r.turn<>v_mark then raise exception 'Não é a tua vez';end if;
 if substring(r.board from p_cell+1 for 1)<>'-' then raise exception 'A casa já está ocupada';end if;
 v_board:=substring(r.board from 1 for p_cell)||v_mark||substring(r.board from p_cell+2);
 v_win:=
 (substring(v_board from 1 for 1)=v_mark and substring(v_board from 2 for 1)=v_mark and substring(v_board from 3 for 1)=v_mark) or
 (substring(v_board from 4 for 1)=v_mark and substring(v_board from 5 for 1)=v_mark and substring(v_board from 6 for 1)=v_mark) or
 (substring(v_board from 7 for 1)=v_mark and substring(v_board from 8 for 1)=v_mark and substring(v_board from 9 for 1)=v_mark) or
 (substring(v_board from 1 for 1)=v_mark and substring(v_board from 4 for 1)=v_mark and substring(v_board from 7 for 1)=v_mark) or
 (substring(v_board from 2 for 1)=v_mark and substring(v_board from 5 for 1)=v_mark and substring(v_board from 8 for 1)=v_mark) or
 (substring(v_board from 3 for 1)=v_mark and substring(v_board from 6 for 1)=v_mark and substring(v_board from 9 for 1)=v_mark) or
 (substring(v_board from 1 for 1)=v_mark and substring(v_board from 5 for 1)=v_mark and substring(v_board from 9 for 1)=v_mark) or
 (substring(v_board from 3 for 1)=v_mark and substring(v_board from 5 for 1)=v_mark and substring(v_board from 7 for 1)=v_mark);
 v_status:=case when v_win then (case when v_mark='X' then 'white_win' else 'black_win' end)
  when r.ply=8 then 'draw' else 'active' end;
 update public.tic_rooms set board=v_board,ply=r.ply+1,
  moves=r.moves||jsonb_build_array(jsonb_build_object('cell',p_cell,'mark',v_mark,'ply',r.ply+1)),
  turn=case when v_mark='X' then 'O' else 'X' end,
  status=v_status,finish_reason=case when v_win then 'line' when v_status='draw' then 'full_board' else null end,
  updated_at=now() where id=r.id;
 return jsonb_build_object('board',v_board,'ply',r.ply+1,'status',v_status);
end $$;

create or replace function private.edgy_tic_resign(p_code text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_user uuid:=(select auth.uid()); r public.tic_rooms%rowtype;
begin
 if v_user is null then raise exception 'Inicia sessão';end if;
 select * into r from public.tic_rooms where code=upper(trim(p_code)) for update;
 if not found or v_user not in (r.white_id,r.black_id) then raise exception 'Sem acesso à sala';end if;
 if r.status<>'active' then return false;end if;
 update public.tic_rooms set status=case when v_user=r.white_id then 'black_win' else 'white_win' end,
 finish_reason='resignation',updated_at=now() where id=r.id;
 return true;
end $$;

-- Exposed RPC entrypoints are invoker-only; privileged logic lives in non-exposed private schema.
create or replace function public.edgy_tic_create() returns text language sql security invoker set search_path='' as $$select private.edgy_tic_create()$$;
create or replace function public.edgy_tic_join(p_code text) returns text language sql security invoker set search_path='' as $$select private.edgy_tic_join(p_code)$$;
create or replace function public.edgy_tic_cancel(p_code text) returns boolean language sql security invoker set search_path='' as $$select private.edgy_tic_cancel(p_code)$$;
create or replace function public.edgy_tic_move(p_code text,p_cell integer,p_expected_ply integer) returns jsonb language sql security invoker set search_path='' as $$select private.edgy_tic_move(p_code,p_cell,p_expected_ply)$$;
create or replace function public.edgy_tic_resign(p_code text) returns boolean language sql security invoker set search_path='' as $$select private.edgy_tic_resign(p_code)$$;

revoke all on function private.edgy_tic_create() from public,anon;
revoke all on function private.edgy_tic_join(text) from public,anon;
revoke all on function private.edgy_tic_cancel(text) from public,anon;
revoke all on function private.edgy_tic_move(text,integer,integer) from public,anon;
revoke all on function private.edgy_tic_resign(text) from public,anon;
grant execute on function private.edgy_tic_create(),private.edgy_tic_join(text),private.edgy_tic_cancel(text),private.edgy_tic_move(text,integer,integer),private.edgy_tic_resign(text) to authenticated;
revoke all on function public.edgy_tic_create(),public.edgy_tic_join(text),public.edgy_tic_cancel(text),public.edgy_tic_move(text,integer,integer),public.edgy_tic_resign(text) from public,anon;
grant execute on function public.edgy_tic_create(),public.edgy_tic_join(text),public.edgy_tic_cancel(text),public.edgy_tic_move(text,integer,integer),public.edgy_tic_resign(text) to authenticated;
