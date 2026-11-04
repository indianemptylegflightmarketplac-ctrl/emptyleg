-- =====================================================================
-- Indian Empty-Leg Flight Marketplace -- RLS Hardening (Final)
-- Migration 016: Tighten RLS on operator_listing_submissions and empty_leg_offers
-- Requires staff role (from staff_profiles) for authenticated reads/writes.
-- Edge Functions use the service-role key (bypasses RLS) and validate input.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. operator_listing_submissions - re-enable RLS with secure policies
-- ---------------------------------------------------------------------
alter table public.operator_listing_submissions enable row level security;

drop policy if exists anon_insert_operator_submission on public.operator_listing_submissions;
drop policy if exists staff_read_operator_submissions on public.operator_listing_submissions;
drop policy if exists staff_update_operator_submissions on public.operator_listing_submissions;

-- Anonymous users can INSERT (submit a listing) but not SELECT/UPDATE/DELETE
create policy anon_insert_operator_submission on public.operator_listing_submissions
  for insert to anon
  with check (true);

-- Authenticated staff can read all submissions (admin dashboard)
create policy staff_read_operator_submissions on public.operator_listing_submissions
  for select to authenticated
  using (
    exists (
      select 1 from public.staff_profiles sp
      where sp.id = auth.uid()
        and sp.is_active
        and sp.role in ('admin', 'operator', 'support')
    )
  );

-- Authenticated staff can update (approve/reject) submissions
create policy staff_update_operator_submissions on public.operator_listing_submissions
  for update to authenticated
  using (
    exists (
      select 1 from public.staff_profiles sp
      where sp.id = auth.uid()
        and sp.is_active
        and sp.role in ('admin', 'operator', 'support')
    )
  )
  with check (
    exists (
      select 1 from public.staff_profiles sp
      where sp.id = auth.uid()
        and sp.is_active
        and sp.role in ('admin', 'operator', 'support')
    )
  );

-- Grant permissions
grant usage on sequence public.operator_listing_submissions_id_seq to anon;
grant insert on public.operator_listing_submissions to anon;
grant select on public.operator_listing_submissions to authenticated;
grant update on public.operator_listing_submissions to authenticated;

-- ---------------------------------------------------------------------
-- 2. empty_leg_offers - re-enable RLS with secure policies
-- ---------------------------------------------------------------------
alter table public.empty_leg_offers enable row level security;

drop policy if exists anon_insert_offers on public.empty_leg_offers;
drop policy if exists anon_select_offers on public.empty_leg_offers;
drop policy if exists staff_write_offers on public.empty_leg_offers;

-- Anonymous users can SELECT only available, verified offers (public marketplace)
create policy anon_select_offers on public.empty_leg_offers
  for select to anon
  using (
    availability_status = 'available'
    and offer_expires_at > now()
    and permission_status = 'verified'
  );

-- Authenticated staff can manage offers (approve, edit, withdraw)
create policy staff_write_offers on public.empty_leg_offers
  for all to authenticated
  using (
    exists (
      select 1 from public.staff_profiles sp
      where sp.id = auth.uid()
        and sp.is_active
        and sp.role in ('admin', 'operator', 'support')
    )
  )
  with check (
    exists (
      select 1 from public.staff_profiles sp
      where sp.id = auth.uid()
        and sp.is_active
        and sp.role in ('admin', 'operator', 'support')
    )
  );

-- Grant permissions
grant select on public.empty_leg_offers to anon;
grant insert on public.empty_leg_offers to authenticated;
grant update on public.empty_leg_offers to authenticated;
grant delete on public.empty_leg_offers to authenticated;

-- ---------------------------------------------------------------------
-- 3. available_offers_view - security_invoker = true (respects RLS)
-- ---------------------------------------------------------------------
-- The view already has security_invoker = true. It respects RLS on the
-- underlying empty_leg_offers and operators tables.

-- =====================================================================
-- END OF MIGRATION 016
-- =====================================================================
