-- =====================================================================
-- Indian Empty-Leg Flight Marketplace -- Re-enable RLS with proper policies
-- Migration 015: Security hardening - re-enable RLS with secure policies
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. operator_listing_submissions RLS
-- ---------------------------------------------------------------------
alter table public.operator_listing_submissions enable row level security;

drop policy if exists anon_insert_operator_submission on public.operator_listing_submissions;
drop policy if exists staff_read_operator_submissions on public.operator_listing_submissions;
drop policy if exists staff_update_operator_submissions on public.operator_listing_submissions;

-- Anonymous users can INSERT (submit a listing)
create policy anon_insert_operator_submission on public.operator_listing_submissions
  for insert to anon
  with check (true);

-- Authenticated users can read all submissions (staff dashboard)
create policy staff_read_operator_submissions on public.operator_listing_submissions
  for select to authenticated
  using (true);

-- Authenticated users can update submissions (staff approve/reject)
create policy staff_update_operator_submissions on public.operator_listing_submissions
  for update to authenticated
  using (true)
  with check (true);

-- Grant permissions
grant usage on sequence public.operator_listing_submissions_id_seq to anon;
grant insert on public.operator_listing_submissions to anon;
grant select on public.operator_listing_submissions to authenticated;
grant update on public.operator_listing_submissions to authenticated;

-- ---------------------------------------------------------------------
-- 2. empty_leg_offers RLS
-- ---------------------------------------------------------------------
alter table public.empty_leg_offers enable row level security;

drop policy if exists anon_insert_offers on public.empty_leg_offers;
drop policy if exists anon_select_offers on public.empty_leg_offers;
drop policy if exists staff_write_offers on public.empty_leg_offers;

-- Anonymous users can SELECT (public can view available offers)
create policy anon_select_offers on public.empty_leg_offers
  for select to anon
  using (
    availability_status = 'available'
    and offer_expires_at > now()
    and permission_status = 'verified'
  );

-- Authenticated users can INSERT/UPDATE/DELETE (staff manage offers)
create policy staff_write_offers on public.empty_leg_offers
  for all to authenticated
  using (true)
  with check (true);

-- Grant permissions
grant select on public.empty_leg_offers to anon;
grant insert on public.empty_leg_offers to authenticated;
grant update on public.empty_leg_offers to authenticated;
grant delete on public.empty_leg_offers to authenticated;

-- ---------------------------------------------------------------------
-- 3. Views - security_invoker remains true (already set)
-- ---------------------------------------------------------------------
-- available_offers_view already has security_invoker = true
-- It will respect RLS of underlying tables

-- =====================================================================
-- END OF MIGRATION 015
-- =====================================================================
