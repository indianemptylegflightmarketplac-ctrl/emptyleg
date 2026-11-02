-- =====================================================================
-- Indian Empty-Leg Flight Marketplace -- Debug RLS
-- Migration 006: Temporarily disable RLS for debugging
-- =====================================================================

alter table public.operator_listing_submissions disable row level security;

-- =====================================================================
-- END OF MIGRATION 006
-- =====================================================================
