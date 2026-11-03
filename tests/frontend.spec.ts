import { test, expect } from '@playwright/test';

const IS_WSL = process.platform === 'linux' && process.env.WSL_DISTRO_NAME;
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://127.0.0.1:5173';
// Environment-driven target: defaults to the WSL Docker bridge for dev runs;
// CI injects its own URL.
const SUPABASE_URL = process.env.SUPABASE_URL ?? (IS_WSL ? 'http://localhost:3000' : 'http://172.23.176.1:3000');
const ANON_KEY = process.env.ANON_KEY;
const ANON_JWT = process.env.ANON_JWT || '';
const SUPABASE_GATEWAY_URL = process.env.SUPABASE_GATEWAY_URL || '';

// Fail fast if ANON_KEY is not provided
if (!ANON_KEY) {
  throw new Error('ANON_KEY environment variable is required for tests');
}

// UI contract for the tracked landing page (public/index.html, restyled SPA):
// hero, route chips (rendered by JS), FAQ, waitlist form, runtime config.
test.describe('Frontend E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FRONTEND_URL, { waitUntil: 'networkidle' });
  });

  test('Homepage loads and renders hero', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Fly private for the price of business class.');
    await expect(page.locator('a:has-text("Search Empty Legs")').first()).toBeVisible();
  });

  test('Runtime config is injected at page load', async ({ page }) => {
    // config.local.js (local dev) or injected window.__ENV__ (production) must
    // provide SUPABASE_URL pointing at the Supabase project root/gateway —
    // config.js merges injected > local and fails closed otherwise.
    const env = await page.evaluate(() => ({
      supabaseUrl: (window as { __ENV__?: Record<string, string> }).__ENV__?.SUPABASE_URL,
      anonKey: (window as { __ENV__?: Record<string, string> }).__ENV__?.SUPABASE_ANON_KEY,
    }));
    expect(env.supabaseUrl).toBeTruthy();
    expect(env.anonKey).toBeTruthy();
    if (SUPABASE_GATEWAY_URL) {
      expect(env.supabaseUrl).toBe(SUPABASE_GATEWAY_URL);
    }
  });

  test('Popular route chips render with correct destinations', async ({ page }) => {
    const chips = page.locator('#routesList a.route-chip');
    await expect(chips).toHaveCount(6);
    await expect(chips.first()).toContainText('Mumbai → Delhi');
    // Chips deep-link into the marketplace SPA with from/to filters
    const href = await chips.first().getAttribute('href');
    expect(href).toContain('/marketplace?from=Mumbai');
    expect(href).toContain('to=Delhi');
  });

  test('FAQ items expand and collapse on click', async ({ page }) => {
    const firstFaqButton = page.locator('#faq button').first();
    const firstAnswer = page.locator('#faq .faq-answer').first();
    await expect(firstAnswer).toHaveClass(/hidden/);
    await firstFaqButton.click();
    await expect(firstAnswer).not.toHaveClass(/hidden/);
    await firstFaqButton.click();
    await expect(firstAnswer).toHaveClass(/hidden/);
  });

  test('Waitlist form requires a valid email', async ({ page }) => {
    await expect(page.locator('#waitlistForm')).toBeVisible();
    const emailInput = page.locator('#waitlistEmail');
    await expect(emailInput).toHaveAttribute('required');
    await expect(emailInput).toHaveAttribute('type', 'email');
    await expect(page.locator('#waitlistBtn')).toBeVisible();
  });

  test('Operator listing CTA links to the operator form', async ({ page }) => {
    await expect(page.locator('a[href="/operator-list.html"]').first()).toBeVisible();
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
  test('Booking enquiries are not readable by anonymous users (zero rows)', async ({ request }) => {
    // Empirical contract (CI run 41581931856): with an anon JWT, the explicit
    // deny SELECT policy yields 200 with an EMPTY array (or an outright
    // 401/403 rejection on some gateways). Either way zero rows are exposed.
    test.skip(!ANON_JWT, 'ANON_JWT not provided - skipping anon-authenticated privacy test');
    const response = await request.get(`${SUPABASE_URL}/booking_enquiries?select=*`, {
      headers: { 'Authorization': `Bearer ${ANON_JWT}` }
    });
    if (response.ok()) {
      expect(await response.json()).toHaveLength(0);
    } else {
      expect([401, 403, 404]).toContain(response.status());
    }
  });

  test('Booking enquiries are not readable with apikey header (no rows exposed)', async ({ request }) => {
    // Real local-stack behavior (verified in CI run 41581245387): with only
    // the apikey header, anon role applies the explicit deny SELECT policy,
    // so PostgREST answers 200 with an EMPTY array; identity-bearing Bearer
    // requests are rejected outright (401/403). The privacy contract is
    // "no enquiry rows are ever returned", not a specific status code.
    const response = await request.get(`${SUPABASE_URL}/booking_enquiries?select=*`, {
      headers: { apikey: ANON_KEY! }
    });
    if (response.ok()) {
      const rows = await response.json();
      expect(Array.isArray(rows)).toBe(true);
      expect(rows).toHaveLength(0); // deny policy must leak zero rows
    } else {
      expect([401, 403, 404]).toContain(response.status());
    }
  });
});
