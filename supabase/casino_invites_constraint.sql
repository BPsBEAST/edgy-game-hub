-- Extend EDGY invitation compatibility to multiplayer casino tables.
alter table public.edgy_game_invites drop constraint if exists edgy_game_invites_game_check;
alter table public.edgy_game_invites add constraint edgy_game_invites_game_check
 check(game in ('chess','checkers','tic','barricade','party','poker','casino_blackjack','casino_roulette','casino_coinflip'));
