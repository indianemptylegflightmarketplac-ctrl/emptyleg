-- =====================================================================
-- Indian Empty-Leg Flight Marketplace -- Re-enable RLS with correct policies
-- Migration 007: Re-enable RLS and fix operator submission policies
-- =====================================================================

-- Re-enable RLS
alter table public.operator_listing_submissions enable row level security;

-- Drop and recreate policies cleanly
drop policy if exists anon_insert_operator_submission on public.operator_listing_submissions;
drop policy if exists staff_read_operator_submissions on public.operator_listing_submissions;
drop policy if exists staff_update_operator_submissions on public.operator_listing_submissions;

-- Anonymous users can INSERT (submit a listing)
create policy anon_insert_operator_submission on public.operator_listing_submissions
  for insert to anon
  with check (true);

-- Authenticated staff can read all submissions
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

-- Staff can update (approve/reject) submissions
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

-- Grant USAGE on the identity sequence to anon (needed for id generation)
grant usage, select on sequence public.operator_listing_submissions_id_seq to anon;

-- =====================================================================
-- END OF MIGRATION 007
-- =====================================================================
