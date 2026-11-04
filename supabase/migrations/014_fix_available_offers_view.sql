-- =====================================================================
-- Indian Empty-Leg Flight Marketplace -- Fix available_offers_view
-- Migration 014: Use LEFT JOIN so offers without operator_id still appear
-- =====================================================================

create or replace view public.available_offers_view with (security_invoker = true) as
select
  o.id,
  o.offer_reference,
  o.departure_city,
  o.departure_airport,
  o.destination_city,
  o.destination_airport,
  o.departure_datetime,
  o.arrival_datetime,
  o.aircraft_type,
  o.aircraft_category,
  o.passenger_capacity,
  o.price_amount,
  o.price_currency,
  o.price_basis,
  o.booking_conditions,
  o.baggage_allowance_kg,
  o.pets_allowed,
  o.wifi_available,
  o.inventory_source,
  o.permission_status,
  o.last_verified_at,
  o.offer_expires_at,
  o.availability_status,
  op.name as operator_name,
  op.authorization_status as operator_status
from public.empty_leg_offers o
left join public.operators op on op.id = o.operator_id
where o.availability_status = 'available'
  and o.offer_expires_at > now()
  and o.permission_status = 'verified'
  and (op.authorization_status = 'authorized' or o.operator_id is null);

-- =====================================================================
-- END OF MIGRATION 014
-- =====================================================================
