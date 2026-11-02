-- =====================================================================
-- Indian Empty-Leg Flight Marketplace -- Disable RLS on offers table
-- Migration 012: Disable RLS on empty_leg_offers (Edge Function validates)
-- =====================================================================

alter table public.empty_leg_offers disable row level security;

-- =====================================================================
-- END OF MIGRATION 012
-- =====================================================================
