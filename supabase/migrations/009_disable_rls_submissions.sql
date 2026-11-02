-- =====================================================================
-- Indian Empty-Leg Flight Marketplace -- Disable RLS on submissions table
-- Migration 009: Disable RLS on operator_listing_submissions (public write table)
-- =====================================================================

alter table public.operator_listing_submissions disable row level security;

-- =====================================================================
-- END OF MIGRATION 009
-- =====================================================================
