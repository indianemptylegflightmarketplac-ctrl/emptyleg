-- =====================================================================
-- Indian Empty-Leg Flight Marketplace -- Allow anon insert on offers
-- Migration 010: Allow operator submissions to create public offers
-- =====================================================================

-- Allow anon to INSERT into empty_leg_offers (used by operator submission approval)
create policy anon_insert_offers on public.empty_leg_offers
  for insert to anon
  with check (true);

-- =====================================================================
-- END OF MIGRATION 010
-- =====================================================================
