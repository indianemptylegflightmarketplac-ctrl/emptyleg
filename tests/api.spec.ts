import { test, expect } from '@playwright/test';

const IS_WSL = process.platform === 'linux' && process.env.WSL_DISTRO_NAME;
// Environment-driven target: defaults to the WSL Docker bridge for dev runs
// (docker-compose / Kong on port 3000); CI injects its own URL.
const SUPABASE_URL = process.env.SUPABASE_URL ?? (IS_WSL ? 'http://localhost:3000' : 'http://172.23.176.1:3000');
const GATEWAY_URL = process.env.GATEWAY_URL ?? SUPABASE_URL.replace(/\/rest\/v1$/, '');
const ANON_KEY = process.env.ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY ?? '';
const KONG_URL = process.env.KONG_URL ?? (IS_WSL ? 'http://localhost:54321' : 'http://172.23.176.1:54321');
const STUDIO_URL = IS_WSL ? 'http://localhost:54323' : 'http://172.23.176.1:54323';

// ANON_JWT must be provided via ANON_JWT env var (generated at runtime)
const ANON_JWT = process.env.ANON_JWT || '';

// Fail fast if ANON_KEY is not provided
if (!ANON_KEY) {
  throw new Error('ANON_KEY environment variable is required for tests');
}

test.describe('REST API - Offers', () => {
  test('GET /available_offers_view returns array of offers', async ({ request }) => {
    const response = await request.get(`${SUPABASE_URL}/available_offers_view?select=*`, {
      headers: { apikey: ANON_KEY }
    });
    expect(response.ok()).toBeTruthy();
    const offers = await response.json();
    expect(Array.isArray(offers)).toBeTruthy();
    expect(offers.length).toBeGreaterThan(0);
  });

  test('Each offer has required fields', async ({ request }) => {
    const response = await request.get(`${SUPABASE_URL}/available_offers_view?select=*`, {
      headers: { apikey: ANON_KEY }
    });
    const offers = await response.json();
    
    for (const offer of offers) {
      expect(offer).toHaveProperty('id');
      expect(offer).toHaveProperty('offer_reference');
      expect(offer).toHaveProperty('departure_city');
      expect(offer).toHaveProperty('destination_city');
      expect(offer).toHaveProperty('departure_datetime');
      expect(offer).toHaveProperty('aircraft_type');
      expect(offer).toHaveProperty('aircraft_category');
      expect(offer).toHaveProperty('passenger_capacity');
      expect(offer).toHaveProperty('price_amount');
      expect(offer).toHaveProperty('price_currency');
      expect(offer).toHaveProperty('availability_status');
      expect(offer.availability_status).toBe('available');
    }
  });

  test('All offers are synthetic (verified, from authorized operators)', async ({ request }) => {
    const response = await request.get(`${SUPABASE_URL}/available_offers_view?select=*`, {
      headers: { apikey: ANON_KEY }
    });
    const offers = await response.json();
    
    for (const offer of offers) {
      expect(offer.operator_status).toBe('authorized');
      expect(offer.permission_status).toBe('verified');
      expect(offer.offer_expires_at).toBeDefined();
      expect(new Date(offer.offer_expires_at) > new Date()).toBeTruthy();
    }
  });

  test('Offers have correct price basis (whole_aircraft)', async ({ request }) => {
    const response = await request.get(`${SUPABASE_URL}/available_offers_view?select=*`, {
      headers: { apikey: ANON_KEY }
    });
    const offers = await response.json();
    
    for (const offer of offers) {
      expect(offer.price_basis).toBe('whole_aircraft');
      expect(offer.price_currency).toBe('INR');
    }
  });
});

test.describe('REST API - Enquiries (Privacy)', () => {
  let testOfferId: number;

  test.beforeAll(async ({ request }) => {
    const response = await request.get(`${SUPABASE_URL}/available_offers_view?select=*`, {
      headers: { apikey: ANON_KEY }
    });
    const offers = await response.json();
    testOfferId = offers[0].id;
  });

  test('POST /booking_enquiries direct anon insert is denied (privacy)', async ({ request }) => {
    // DESIGN: anonymous users CANNOT insert booking_enquiries directly via
    // PostgREST, under either auth vector (Bearer anon JWT or apikey). All
    // public enquiry submissions MUST go through the Edge Function
    // (POST /functions/v1/enquiries) which uses the service-role key to call
    // the atomic create_enquiry_atomic RPC. There is intentionally no anon
    // INSERT policy on booking_enquiries; anon also has an explicit deny
    // SELECT policy. See migrations/001_initial_schema_v2.sql lines 505-570.
    test.skip(!ANON_JWT, 'ANON_JWT not provided - skipping authenticated anon test');
    const response = await request.post(`${SUPABASE_URL}/booking_enquiries`, {
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_JWT}`,
      },
      data: {
        offer_id: testOfferId,
        customer_name: 'Test Customer',
        customer_email: 'test@example.com',
        customer_phone: '+91-9876543210',
        customer_company: 'Test Corp',
        passenger_count: 4,
        special_requests: 'Vegetarian meals',
        budget_max_amount: 500000,
        budget_currency: 'INR'
      }
    });
    
    // No anon INSERT policy exists -> PostgREST must reject this request
    expect([401, 403, 404]).toContain(response.status());
  });

  test('POST /booking_enquiries with return=representation FAILS (no anon insert path)', async ({ request }) => {
    // No anon INSERT policy exists, so there is no backing row to return:
    // requests must be rejected outright under either Prefer mode.
    test.skip(!ANON_JWT, 'ANON_JWT not provided - skipping authenticated anon test');
    const response = await request.post(`${SUPABASE_URL}/booking_enquiries`, {
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_JWT}`,
        'Prefer': 'return=representation'
      },
      data: {
        offer_id: testOfferId,
        customer_name: 'Test Customer',
        customer_email: 'test@example.com',
        customer_phone: '+91-9876543210',
        passenger_count: 4,
      }
    });
    
    expect([401, 403, 404]).toContain(response.status());
  });

  test('POST /functions/v1/enquiries (Edge Function) rejects missing required fields', async ({ request }) => {
    // Public path enforces required-field validation server-side.
    const gateway = GATEWAY_URL || SUPABASE_URL.replace(/\/rest\/v1$/, '');
    const response = await request.post(`${gateway}/functions/v1/enquiries`, {
      headers: { 
        'Content-Type': 'application/json',
      },
      data: {
        offer_id: testOfferId,
        // missing customer_name / customer_email / customer_phone
      }
    });
    
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Missing required fields');
  });

  test('POST /functions/v1/enquiries (Edge Function) rejects out-of-range passenger count', async ({ request }) => {
    // DB constraint is 1..19 (migration 003) and the Edge Function
    // pre-validates the same range before calling the atomic RPC.
    const gateway = GATEWAY_URL || SUPABASE_URL.replace(/\/rest\/v1$/, '');
    const response = await request.post(`${gateway}/functions/v1/enquiries`, {
      headers: { 
        'Content-Type': 'application/json',
      },
      data: {
        offer_id: testOfferId,
        customer_name: 'Test Customer',
        customer_email: 'test@example.com',
        customer_phone: '+91-9876543210',
        passenger_count: 999
      }
    });
    
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Passenger count must be between 1 and 19');
  });

  test('GET /booking_enquiries returns empty for anon (privacy)', async ({ request }) => {
    // anon has no SELECT policy on booking_enquiries -> direct read denied
    // Use Authorization header (not apikey) for proper RLS enforcement
    test.skip(!ANON_JWT, 'ANON_JWT not provided - skipping authenticated anon test');
    const response = await request.get(`${SUPABASE_URL}/booking_enquiries?select=*`, {
      headers: { 'Authorization': `Bearer ${ANON_JWT}` }
    });
    expect([401, 403]).toContain(response.status());
  });

  test('GET /booking_enquiries with anon JWT returns empty', async ({ request }) => {
    test.skip(!ANON_JWT, 'ANON_JWT not provided - skipping authenticated anon test');
    const response = await request.get(`${SUPABASE_URL}/booking_enquiries?select=*`, {
      headers: { 'Authorization': `Bearer ${ANON_JWT}` }
    });
    // Explicit deny policy for anon role should return 401/403
    expect([401, 403]).toContain(response.status());
  });

  test('POST /booking_enquiries direct PostgREST anon insert is denied (privacy)', async ({ request }) => {
    // DESIGN: anonymous users CANNOT insert booking_enquiries directly via
    // PostgREST. All public enquiry submissions go through the Edge Function
    // (POST /functions/v1/enquiries) which calls create_enquiry_atomic with
    // the service-role key (RLS bypass). See supabase/functions/enquiries/index.ts.
    const response = await request.post(`${SUPABASE_URL}/booking_enquiries`, {
      headers: { 
        'Content-Type': 'application/json',
        'apikey': ANON_KEY
      },
      data: {
        offer_id: testOfferId,
        customer_name: 'Test Customer',
        customer_email: 'test@example.com',
        customer_phone: '+91-9876543210',
        passenger_count: 4
      }
    });
    
    expect([401, 403]).toContain(response.status());
  });

  test('POST /functions/v1/enquiries via Edge Function (service role) creates enquiry', async ({ request }) => {
    // Supported public submission path: Edge Function validates + calls the
    // atomic RPC with the service-role key. In CI, the gateway URL is
    // available as GATEWAY_URL; the endpoint is at /functions/v1/enquiries.
    const gateway = GATEWAY_URL || SUPABASE_URL.replace(/\/rest\/v1$/, '');
    const response = await request.post(`${gateway}/functions/v1/enquiries`, {
      headers: { 
        'Content-Type': 'application/json',
      },
      data: {
        offer_id: testOfferId,
        customer_name: 'Test Customer',
        customer_email: 'test@example.com',
        customer_phone: '+91-9876543210',
        passenger_count: 4
      }
    });
    
    // Edge Function validates + calls the atomic RPC with the service role.
    // The offer id is taken from available_offers_view, so a valid request
    // must create the enquiry: machine-verified 201 with an enquiry_id.
    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.enquiry_id).toBeTruthy();

  });
});

test.describe('Kong Gateway', () => {
  test('Kong health endpoint responds', async ({ request }) => {
    const response = await request.get(`${KONG_URL}/`, {
      headers: { apikey: ANON_KEY }
    });
    expect([200, 404, 401]).toContain(response.status());
  });
});

test.describe('Database Integrity', () => {
  test('Seed data count via REST API (available offers)', async ({ request }) => {
    const response = await request.get(`${SUPABASE_URL}/available_offers_view?select=*`, {
      headers: { apikey: ANON_KEY }
    });
    const offers = await response.json();
    expect(offers.length).toBe(8);
  });

  test('Operators count (authorized)', async ({ request }) => {
    const response = await request.get(`${SUPABASE_URL}/operators?select=*&authorization_status=eq.authorized`, {
      headers: { apikey: ANON_KEY }
    });
    const operators = await response.json();
    expect(operators.length).toBe(4);
  });

  test('Empty leg offers total count (all statuses)', async ({ request }) => {
    const response = await request.get(`${SUPABASE_URL}/empty_leg_offers?select=*`, {
      headers: { apikey: ANON_KEY }
    });
    const offers = await response.json();
    expect(offers.length).toBeGreaterThanOrEqual(8);
  });
});

test.describe('Frontend (via Studio)', () => {
  test.skip('Studio is accessible', async ({ page }) => {
    await page.goto(STUDIO_URL, { waitUntil: 'networkidle' });
    await expect(page).toHaveTitle(/Supabase/);
  });
});