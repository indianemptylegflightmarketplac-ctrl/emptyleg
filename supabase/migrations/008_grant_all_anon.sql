-- =====================================================================
-- Indian Empty-Leg Flight Marketplace -- Grant all perms to anon
-- Migration 008: Grant all table permissions to anon for debugging
-- =====================================================================

grant all on public.operator_listing_submissions to anon;
grant usage, select on sequence public.operator_listing_submissions_id_seq to anon;

-- =====================================================================
-- END OF MIGRATION 008
-- =====================================================================
