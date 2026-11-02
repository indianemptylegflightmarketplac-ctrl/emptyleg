-- =====================================================================
-- Indian Empty-Leg Flight Marketplace -- Operator Submission Permissions
-- Migration 005: Grant permissions for operator submissions table
-- =====================================================================

-- Grant INSERT on operator_listing_submissions to anon (for public submissions)
grant insert on public.operator_listing_submissions to anon;

-- Grant SELECT on operator_listing_submissions to authenticated (for staff dashboard)
grant select on public.operator_listing_submissions to authenticated;

-- Grant UPDATE on operator_listing_submissions to authenticated (for staff approval)
grant update on public.operator_listing_submissions to authenticated;

-- =====================================================================
-- END OF MIGRATION 005
-- =====================================================================
