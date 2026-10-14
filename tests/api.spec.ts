import { test, expect } from '@playwright/test';

const IS_WSL = process.platform === 'linux' && process.env.WSL_DISTRO_NAME;
const SUPABASE_URL = IS_WSL ? 'http://localhost:3000' : 'http://172.23.176.1:3000';
const ANON_KEY = process.env.ANON_KEY;
const KONG_URL = IS_WSL ? 'http://localhost:54321' : 'http://172.23.176.1:54321';
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
  let testOfferId;

  test.beforeAll(async ({ request }) => {
    const response = await request.get(`${SUPABASE_URL}/available_offers_view?select=*`, {
      headers: { apikey: ANON_KEY }
    });
    const offers = await response.json();
    testOfferId = offers[0].id;
  });

  test('POST /booking_enquiries creates enquiry (anon, no return=representation)', async ({ request }) => {
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
    
    // Should succeed with 201, no body (anon cannot SELECT back the inserted row)
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(201);
  });

  test('POST /booking_enquiries with return=representation FAILS (RLS blocks SELECT back)', async ({ request }) => {
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
    
    // Should fail because return=representation tries to SELECT the inserted row
    // which is blocked by RLS for anon (401 = JWT not accepted for this operation, 403 = RLS violation)
    expect([401, 403]).toContain(response.status());
  });

  test('POST /booking_enquiries validates required fields', async ({ request }) => {
    test.skip(!ANON_JWT, 'ANON_JWT not provided - skipping authenticated anon test');
    const response = await request.post(`${SUPABASE_URL}/booking_enquiries`, {
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_JWT}`,
      },
      data: {
        offer_id: testOfferId,
        // missing required fields
      }
    });
    
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('POST /booking_enquiries passenger count - DB constraint enforces 1-19', async ({ request }) => {
    test.skip(!ANON_JWT, 'ANON_JWT not provided - skipping authenticated anon test');
    const response = await request.post(`${SUPABASE_URL}/booking_enquiries`, {
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_JWT}`,
      },
      data: {
        offer_id: testOfferId,
        customer_name: 'Test',
        customer_email: 'test@example.com',
        customer_phone: '+91-9876543210',
        passenger_count: 999
      }
    });
    
    // DB enforces passenger_count between 1 and 19 (migration 003)
    expect(response.status()).toBe(400);
  });

  test('GET /booking_enquiries returns empty for anon (privacy)', async ({ request }) => {
    const response = await request.get(`${SUPABASE_URL}/booking_enquiries?select=*`, {
      headers: { apikey: ANON_KEY }
    });
    expect(response.ok()).toBeTruthy();
    const enquiries = await response.json();
    expect(Array.isArray(enquiries)).toBeTruthy();
    expect(enquiries.length).toBe(0); // anon cannot read any enquiries
  });

  test('GET /booking_enquiries with anon JWT returns empty', async ({ request }) => {
    test.skip(!ANON_JWT, 'ANON_JWT not provided - skipping authenticated anon test');
    const response = await request.get(`${SUPABASE_URL}/booking_enquiries?select=*`, {
      headers: { 'Authorization': `Bearer ${ANON_JWT}` }
    });
    expect(response.ok()).toBeTruthy();
    const enquiries = await response.json();
    expect(enquiries.length).toBe(0);
  });

  test('POST /booking_enquiries with apikey header (anon) creates enquiry', async ({ request }) => {
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
    
    expect(response.status()).toBe(201);
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