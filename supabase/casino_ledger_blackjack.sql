
-- Extend existing casino XP ledger constraints for Blackjack debit and settlement.
alter table public.edgy_xp_transactions
 drop constraint if exists edgy_xp_transactions_check,
 drop constraint if exists edgy_xp_transactions_kind_check;
alter table public.edgy_xp_transactions
 add constraint edgy_xp_transactions_kind_check check(kind in (
  'opening','earned','roulette','coinflip','slots','blackjack','blackjack_payout')),
 add constraint edgy_xp_transactions_check check(
  (kind in('opening','earned') and stake=0 and payout=0)
  or (kind in('roulette','coinflip','slots','blackjack') and stake>0)
  or (kind='blackjack_payout' and stake=0 and payout>0)
 );
