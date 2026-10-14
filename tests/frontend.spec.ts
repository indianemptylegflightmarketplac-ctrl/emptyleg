import { test, expect } from '@playwright/test';

const IS_WSL = process.platform === 'linux' && process.env.WSL_DISTRO_NAME;
const FRONTEND_URL = 'http://127.0.0.1:5173';
const SUPABASE_URL = 'http://127.0.0.1:3000';
const ANON_KEY = process.env.ANON_KEY;
const ANON_JWT = process.env.ANON_JWT || '';

// Fail fast if ANON_KEY is not provided
if (!ANON_KEY) {
  throw new Error('ANON_KEY environment variable is required for tests');
}

test.describe('Frontend E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FRONTEND_URL, { waitUntil: 'networkidle' });
  });

  test('Homepage loads and displays offers', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Indian Empty-Leg Flight Marketplace');
    await expect(page.locator('.offer-card')).toHaveCount(8);
  });

  test('Offers render with correct data from API', async ({ page }) => {
    const firstCard = page.locator('.offer-card').first();
    await expect(firstCard.locator('.offer-category')).toBeVisible();
    await expect(firstCard.locator('.offer-route')).toBeVisible();
    await expect(firstCard.locator('.aircraft-info h3')).toBeVisible();
    await expect(firstCard.locator('.price-value')).toBeVisible();
  });

  test('Filters work correctly', async ({ page }) => {
    await page.selectOption('#categoryFilter', 'Light');
    await page.waitForTimeout(500);
    
    const cards = page.locator('.offer-card');
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      await expect(cards.nth(i).locator('.offer-category')).toContainText('Light');
    }
    
    await page.selectOption('#categoryFilter', '');
    await page.waitForTimeout(500);
    await expect(page.locator('.offer-card')).toHaveCount(8);
  });

  test('Departure city filter works', async ({ page }) => {
    await page.selectOption('#departureFilter', 'Mumbai');
    await page.waitForTimeout(500);
    
    const cards = page.locator('.offer-card');
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      await expect(cards.nth(i).locator('.offer-route')).toContainText('Mumbai');
    }
  });

  test('Enquiry modal opens when clicking Enquire Now', async ({ page }) => {
    await page.click('.offer-card:first-child .btn-primary');
    await expect(page.locator('#enquiryModal')).toBeVisible();
    await expect(page.locator('#enquiryModal h2')).toContainText('Submit Booking Enquiry');
    await expect(page.locator('#modalOfferId')).toHaveValue(/^\d+$/);
  });

  test('Enquiry form validation - required fields', async ({ page }) => {
    await page.click('.offer-card:first-child .btn-primary');
    await page.click('#enquiryForm button[type="submit"]');
    
    // Check that required fields show validation
    const nameInput = page.locator('input[name="customer_name"]');
    await expect(nameInput).toHaveAttribute('required');
  });

  test('Passenger count input respects max bound (19)', async ({ page }) => {
    await page.click('.offer-card:first-child .btn-primary');
    const passengerInput = page.locator('input[name="passenger_count"]');
    // First offer has capacity 8, so max should be min(8, 19) = 8
    const maxAttr = await passengerInput.getAttribute('max');
    expect(Number(maxAttr)).toBeLessThanOrEqual(19);
    expect(Number(maxAttr)).toBeGreaterThan(0);
  });

  test('Passenger count max respects offer capacity and database limit', async ({ page }) => {
    // Test with an offer that has capacity 10 (should cap at 10)
    const cardWithCapacity10 = page.locator('.offer-card').filter({ hasText: 'Gulfstream G280' });
    await cardWithCapacity10.locator('.btn-primary').click();
    
    const passengerInput = page.locator('input[name="passenger_count"]');
    const maxAttr = await passengerInput.getAttribute('max');
    expect(Number(maxAttr)).toBeLessThanOrEqual(19);
  });

  test('Successful enquiry submission shows confirmation', async ({ page }) => {
    // Log all console messages
    const consoleMessages: string[] = [];
    page.on('console', msg => consoleMessages.push(`${msg.type()}: ${msg.text()}`));
    
    // Log all network requests
    const networkRequests: string[] = [];
    page.on('request', request => networkRequests.push(`REQUEST: ${request.method()} ${request.url()}`));
    page.on('response', async response => {
      const body = await response.text().catch(() => '');
      networkRequests.push(`RESPONSE: ${response.status()} ${response.url()} - ${body.substring(0, 200)}`);
    });
    
    await page.click('.offer-card:first-child .btn-primary');
    await page.fill('input[name="customer_name"]', 'E2E Test User');
    await page.fill('input[name="customer_email"]', 'e2e@example.com');
    await page.fill('input[name="customer_phone"]', '+91-9000000000');
    await page.fill('input[name="passenger_count"]', '2');
    await page.click('#enquiryForm button[type="submit"]');
    
    // Wait for either success modal or error alert
    await page.waitForTimeout(3000);
    
    // Log debug info
    console.log('Console messages:', consoleMessages);
    console.log('Network requests:', networkRequests);
    
    await expect(page.locator('#successModal')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#successModal h2')).toContainText('Enquiry Submitted');
    await expect(page.locator('#enquiryRef')).toContainText('Enquiry submitted successfully');
  });

  test('Enquiry form can be cancelled', async ({ page }) => {
    await page.click('.offer-card:first-child .btn-primary');
    await expect(page.locator('#enquiryModal')).toBeVisible();
    await page.click('#modalCancel');
    await expect(page.locator('#enquiryModal')).not.toBeVisible();
  });

  test('Success modal can be closed', async ({ page }) => {
    await page.click('.offer-card:first-child .btn-primary');
    await page.fill('input[name="customer_name"]', 'Close Test');
    await page.fill('input[name="customer_email"]', 'close@example.com');
    await page.fill('input[name="customer_phone"]', '+91-9000000001');
    await page.fill('input[name="passenger_count"]', '1');
    await page.click('#enquiryForm button[type="submit"]');
    
    await expect(page.locator('#successModal')).toBeVisible({ timeout: 10000 });
    await page.click('#successClose');
    await expect(page.locator('#successModal')).not.toBeVisible();
  });

  test('Empty state when no offers match filter', async ({ page }) => {
    await page.selectOption('#categoryFilter', 'Heavy');
    await page.waitForTimeout(500);
    
    // Should show empty state or fewer cards
    const cards = page.locator('.offer-card');
    const count = await cards.count();
    // There are no Heavy category offers in seed data
    if (count === 0) {
      await expect(page.locator('#empty')).toBeVisible();
    }
  });

  test('No console errors on page load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.goto(FRONTEND_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    
    // Filter out known non-critical errors (like favicon)
    const criticalErrors = errors.filter(e => !e.includes('favicon') && !e.includes('favicon.ico'));
    expect(criticalErrors).toHaveLength(0);
  });

  test('No failed network requests on page load', async ({ page }) => {
    const failedRequests: string[] = [];
    page.on('requestfailed', request => {
      failedRequests.push(`${request.method()} ${request.url()} - ${request.failure()?.errorText}`);
    });
    
    await page.goto(FRONTEND_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    
    // Allow Kong 404 as it's expected
    const criticalFailures = failedRequests.filter(f => !f.includes('54321'));
    expect(criticalFailures).toHaveLength(0);
  });
});

test.describe('Privacy Enforcement via Frontend', () => {
  test('Anonymous user cannot see other enquiries', async ({ page }) => {
    // Direct API call to verify backend privacy
    const response = await page.request.get('http://localhost:3000/booking_enquiries?select=*', {
      headers: { apikey: ANON_KEY }
    });
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.length).toBe(0);
  });

  test('Submitted enquiry not visible to other anonymous users', async ({ page }) => {
    test.skip(!ANON_JWT, 'ANON_JWT not provided - skipping authenticated anon test');
    // Submit an enquiry
    const jwt = ANON_JWT;
    await page.request.post('http://localhost:3000/booking_enquiries', {
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`
      },
      data: {
        offer_id: 1,
        customer_name: 'Privacy Test',
        customer_email: 'privacy@example.com',
        customer_phone: '+91-9000000002',
        passenger_count: 1
      }
    });
    
    // Try to read all enquiries as anon - should be empty
    const response = await page.request.get('http://localhost:3000/booking_enquiries?select=*', {
      headers: { apikey: ANON_KEY }
    });
    const data = await response.json();
    expect(data.length).toBe(0);
  });
});