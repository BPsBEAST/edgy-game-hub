-- Non-destructive indexes for existing multiplayer foreign keys.
create index if not exists checkers_rooms_black_fk_idx on public.checkers_rooms(black_id) where black_id is not null;
create index if not exists checkers_rooms_white_fk_idx on public.checkers_rooms(white_id);
create index if not exists chess_rooms_draw_offer_fk_idx on public.chess_rooms(draw_offered_by) where draw_offered_by is not null;
create index if not exists edgy_game_invites_sender_fk_idx on public.edgy_game_invites(sender_id);
