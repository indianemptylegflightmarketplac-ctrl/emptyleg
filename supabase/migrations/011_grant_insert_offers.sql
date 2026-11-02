-- =====================================================================
-- Indian Empty-Leg Flight Marketplace -- Grant perms on offers to anon
-- Migration 011: Grant INSERT on empty_leg_offers to anon
-- =====================================================================

grant insert on public.empty_leg_offers to anon;

-- =====================================================================
-- END OF MIGRATION 011
-- =====================================================================
