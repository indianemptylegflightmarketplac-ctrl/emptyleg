-- =====================================================================
-- Indian Empty-Leg Flight Marketplace — Synthetic Seed Data
-- FOR DEVELOPMENT ONLY — NEVER USE IN PRODUCTION
-- =====================================================================
-- All data below is SYNTHETIC. No real operators, flights, or customers.
-- Run after migration 001 in local development only.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Synthetic Operators
-- ---------------------------------------------------------------------
insert into public.operators (name, contact_email, contact_phone, authorization_status, authorized_at, metadata) values
  ('SkyWings Aviation', 'ops@skyWings.example', '+91-22-4000-1111', 'authorized', now() - interval '30 days', '{"base": "Mumbai", "fleet_size": 8}'),
  ('Deccan Charters', 'charters@deccan.example', '+91-80-4000-2222', 'authorized', now() - interval '60 days', '{"base": "Bengaluru", "fleet_size": 12}'),
  ('Royal Jet India', 'info@royaljet.example', '+91-11-4000-3333', 'authorized', now() - interval '15 days', '{"base": "Delhi", "fleet_size": 5}'),
  ('Coastal Air Services', 'fly@coastal.example', '+91-44-4000-4444', 'pending', null, '{"base": "Chennai", "fleet_size": 3}'),
  ('Himalayan Aviation', 'contact@himalayan.example', '+91-135-4000-5555', 'authorized', now() - interval '90 days', '{"base": "Dehradun", "fleet_size": 4}')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Synthetic Empty-Leg Offers
-- All dates are relative to NOW() so they stay "future" regardless of when seed runs.
-- Prices in INR, whole-aircraft charter.
-- ---------------------------------------------------------------------
with op as (
  select id, name from public.operators where authorization_status = 'authorized'
)
insert into public.empty_leg_offers (
  operator_id, offer_reference,
  departure_city, departure_airport, destination_city, destination_airport,
  departure_datetime, arrival_datetime,
  aircraft_type, aircraft_category, passenger_capacity,
  price_amount, price_currency, price_basis,
  booking_conditions, baggage_allowance_kg, pets_allowed, wifi_available,
  inventory_source, source_retrieved_at, permission_status, last_verified_at, verified_by,
  offer_expires_at, availability_status, created_by, metadata
)
select
  op.id,
  'SW-' || to_char(now() + interval '1 day', 'YYYYMMDD') || '-001',
  'Mumbai', 'BOM', 'Delhi', 'DEL',
  now() + interval '2 days 06:00', now() + interval '2 days 08:30',
  'Cessna Citation XLS+', 'Midsize', 8,
  450000, 'INR', 'whole_aircraft',
  'Cancellation free until 24h before departure. Lead time 4h. GST extra.',
  150, false, true,
  'operator_submitted', now(), 'verified', now(), null::uuid,
  now() + interval '5 days', 'available', null::uuid,
  '{"synthetic": true, "route_type": "major_metro"}'::jsonb
from op where name = 'SkyWings Aviation'
union all
select
  op.id,
  'SW-' || to_char(now() + interval '3 days', 'YYYYMMDD') || '-002',
  'Delhi', 'DEL', 'Mumbai', 'BOM',
  now() + interval '4 days 18:00', now() + interval '4 days 20:30',
  'Hawker 850XP', 'Midsize', 8,
  480000, 'INR', 'whole_aircraft',
  'Non-refundable within 12h. Positioning fee may apply.',
  200, true, true,
  'operator_submitted', now(), 'verified', now(), null::uuid,
  now() + interval '7 days', 'available', null::uuid,
  '{"synthetic": true, "route_type": "major_metro"}'::jsonb
from op where name = 'SkyWings Aviation'
union all
select
  op.id,
  'DC-' || to_char(now() + interval '1 day', 'YYYYMMDD') || '-010',
  'Bengaluru', 'BLR', 'Hyderabad', 'HYD',
  now() + interval '1 day 10:00', now() + interval '1 day 11:15',
  'Pilatus PC-24', 'Light', 6,
  180000, 'INR', 'whole_aircraft',
  'Standard terms. 2h lead time.',
  100, false, true,
  'operator_submitted', now(), 'verified', now(), null::uuid,
  now() + interval '3 days', 'available', null::uuid,
  '{"synthetic": true, "route_type": "regional"}'
from op where name = 'Deccan Charters'
union all
select
  op.id,
  'DC-' || to_char(now() + interval '5 days', 'YYYYMMDD') || '-011',
  'Chennai', 'MAA', 'Bengaluru', 'BLR',
  now() + interval '6 days 07:00', now() + interval '6 days 08:15',
  'Embraer Phenom 300', 'Light', 7,
  220000, 'INR', 'whole_aircraft',
  'Cancellation 50% within 48h. No pets.',
  120, false, false,
  'operator_submitted', now(), 'verified', now(), null::uuid,
  now() + interval '8 days', 'available', null::uuid,
  '{"synthetic": true, "route_type": "regional"}'
from op where name = 'Deccan Charters'
union all
select
  op.id,
  'RJ-' || to_char(now() + interval '2 days', 'YYYYMMDD') || '-020',
  'Delhi', 'DEL', 'Dubai', 'DXB',
  now() + interval '3 days 02:00', now() + interval '3 days 06:30',
  'Gulfstream G280', 'Midsize', 10,
  1200000, 'INR', 'whole_aircraft',
  'International: passport/visa required. Overflight permits confirmed. 24h cancellation.',
  300, true, true,
  'operator_submitted', now(), 'verified', now(), null::uuid,
  now() + interval '6 days', 'available', null::uuid,
  '{"synthetic": true, "route_type": "international", "note": "Requires valid passport and UAE visa"}'
from op where name = 'Royal Jet India'
union all
select
  op.id,
  'RJ-' || to_char(now() + interval '7 days', 'YYYYMMDD') || '-021',
  'Mumbai', 'BOM', 'Singapore', 'SIN',
  now() + interval '8 days 23:00', now() + interval '9 days 07:30',
  'Bombardier Challenger 350', 'Midsize', 9,
  1500000, 'INR', 'whole_aircraft',
  'International: visa on arrival for Indian nationals. 48h cancellation.',
  250, true, true,
  'operator_submitted', now(), 'verified', now(), null::uuid,
  now() + interval '10 days', 'available', null::uuid,
  '{"synthetic": true, "route_type": "international", "note": "Singapore visa requirements apply"}'
from op where name = 'Royal Jet India'
union all
select
  op.id,
  'HA-' || to_char(now() + interval '10 days', 'YYYYMMDD') || '-030',
  'Dehradun', 'DED', 'Delhi', 'DEL',
  now() + interval '11 days 08:00', now() + interval '11 days 09:00',
  'Beechcraft King Air B200', 'Turboprop', 7,
  120000, 'INR', 'whole_aircraft',
  'Weather dependent. Himalayan operations. 4h lead time.',
  80, false, false,
  'operator_submitted', now(), 'verified', now(), null::uuid,
  now() + interval '14 days', 'available', null::uuid,
  '{"synthetic": true, "route_type": "himalayan", "note": "Subject to weather clearance"}'
from op where name = 'Himalayan Aviation'
union all
select
  op.id,
  'HA-' || to_char(now() + interval '12 days', 'YYYYMMDD') || '-031',
  'Delhi', 'DEL', 'Dehradun', 'DED',
  now() + interval '13 days 16:00', now() + interval '13 days 17:00',
  'Beechcraft King Air B200', 'Turboprop', 7,
  120000, 'INR', 'whole_aircraft',
  'Weather dependent. Return leg. 4h lead time.',
  80, false, false,
  'operator_submitted', now(), 'verified', now(), null::uuid,
  now() + interval '16 days', 'available', null::uuid,
  '{"synthetic": true, "route_type": "himalayan", "note": "Subject to weather clearance"}'
from op where name = 'Himalayan Aviation'
on conflict (offer_reference) do nothing;

-- ---------------------------------------------------------------------
-- Synthetic Expired Offer (for testing expiry handling)
-- ---------------------------------------------------------------------
with op as (
  select id from public.operators where name = 'SkyWings Aviation'
)
insert into public.empty_leg_offers (
  operator_id, offer_reference,
  departure_city, departure_airport, destination_city, destination_airport,
  departure_datetime, arrival_datetime,
  aircraft_type, aircraft_category, passenger_capacity,
  price_amount, price_currency, price_basis,
  booking_conditions, baggage_allowance_kg, pets_allowed, wifi_available,
  inventory_source, source_retrieved_at, permission_status, last_verified_at,
  offer_expires_at, availability_status, metadata
)
select
  op.id,
  'SW-EXPIRED-' || to_char(now() - interval '5 days', 'YYYYMMDD') || '-999',
  'Mumbai', 'BOM', 'Goa', 'GOI',
  now() - interval '3 days 10:00', now() - interval '3 days 11:15',
  'Cessna Citation CJ3', 'Light', 6,
  200000, 'INR', 'whole_aircraft',
  'Expired offer for testing.',
  100, false, true,
  'operator_submitted', now() - interval '10 days', 'verified', now() - interval '10 days',
  now() - interval '2 days', 'expired',
  '{"synthetic": true, "test_case": "expired"}'
from op
on conflict (offer_reference) do nothing;

-- ---------------------------------------------------------------------
-- Synthetic Withdrawn Offer (operator pulled it)
-- ---------------------------------------------------------------------
with op as (
  select id from public.operators where name = 'Deccan Charters'
)
insert into public.empty_leg_offers (
  operator_id, offer_reference,
  departure_city, departure_airport, destination_city, destination_airport,
  departure_datetime, arrival_datetime,
  aircraft_type, aircraft_category, passenger_capacity,
  price_amount, price_currency, price_basis,
  booking_conditions, baggage_allowance_kg, pets_allowed, wifi_available,
  inventory_source, source_retrieved_at, permission_status, last_verified_at,
  offer_expires_at, availability_status, metadata
)
select
  op.id,
  'DC-WITHDRAWN-' || to_char(now() + interval '1 day', 'YYYYMMDD') || '-888',
  'Bengaluru', 'BLR', 'Kochi', 'COK',
  now() + interval '2 days 09:00', now() + interval '2 days 10:15',
  'HondaJet HA-420', 'Light', 5,
  160000, 'INR', 'whole_aircraft',
  'Withdrawn by operator.',
  80, false, true,
  'operator_submitted', now(), 'verified', now(),
  now() + interval '4 days', 'withdrawn',
  '{"synthetic": true, "test_case": "withdrawn"}'
from op
on conflict (offer_reference) do nothing;

-- =====================================================================
-- END OF SEED DATA
-- =====================================================================