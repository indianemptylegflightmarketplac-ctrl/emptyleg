-- =====================================================================
-- Indian Empty-Leg Flight Marketplace -- Seed idempotency for operators
-- Migration 018
-- =====================================================================
-- Legacy seeding duplicated the same five operators because
-- supabase/seed.sql AND supabase/migrations/003_seed_data.sql both ran
-- (the CLI applies migrations, then runs seed.sql) and the operators
-- table had no unique key. This migration removes exact duplicates
-- (keeping the lowest id so offers keep referencing the original row)
-- and adds a unique key so future seeds are no-ops ('on conflict do
-- nothing').
-- =====================================================================

-- 1. Deduplicate operators: keep the row with the lowest id per
--    (name, contact_email). Referencing duplicate rows in other tables
--    are first remapped to the surviving row so nothing is orphaned.

-- Remap offers pointing at a duplicate row to the surviving row.
update public.empty_leg_offers o
set operator_id = origsurv.final_id
from (
  with minids as (
    select
      min(op.id) as survivor_id,
      op.name,
      op.contact_email
    from public.operators op
    group by op.name, op.contact_email
    having count(*) > 1
  )
  select
    dupop.id as dup_id,
    minids.survivor_id as final_id
  from minids
  join public.operators dupop
    on dupop.name = minids.name
   and dupop.contact_email = minids.contact_email
  where dupop.id <> minids.survivor_id
) as origsurv
where o.operator_id = origsurv.dup_id;

-- If the platform adds more operators referencing tables later, remap
-- them here before deleting; for now only empty_leg_offers references
-- operators in this schema.

-- Delete the duplicates (exact (name, contact_email) matches only).
delete from public.operators op
using (
  select
    min(dup.id) as survivor_id,
    dup.name,
    dup.contact_email
  from public.operators dup
  group by dup.name, dup.contact_email
  having count(*) > 1
) as ranked
where op.name = ranked.name
  and op.contact_email = ranked.contact_email
  and op.id <> ranked.survivor_id;

-- 2. Prevent recurrence: unique key for seed idempotency.
create unique index if not exists operators_name_email_uniq
  on public.operators (name, contact_email);

-- =====================================================================
-- END OF MIGRATION 018
-- =====================================================================
