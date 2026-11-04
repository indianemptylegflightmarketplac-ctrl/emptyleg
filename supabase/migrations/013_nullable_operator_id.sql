-- =====================================================================
-- Indian Empty-Leg Flight Marketplace -- Make operator_id nullable
-- Migration 013: Allow operator_id to be null on empty_leg_offers
-- =====================================================================

alter table public.empty_leg_offers
  alter column operator_id drop not null;

-- =====================================================================
-- END OF MIGRATION 013
-- =====================================================================
