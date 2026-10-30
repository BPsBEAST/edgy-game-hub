-- Realtime notifications complement the existing polling fallback.
alter publication supabase_realtime add table public.tic_rooms;
alter publication supabase_realtime add table public.checkers_rooms;