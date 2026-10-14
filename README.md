# Indian Empty-Leg Flight Marketplace — MVP

Synthetic empty-leg flight marketplace with enquiry-only workflow. Built with Supabase (PostgreSQL + PostgREST + Kong + GoTrue + Realtime) and a vanilla JS frontend.

## Quick Start

### Local Development (with Docker)

```bash
# 1. Start Supabase stack (keep terminal open)
wsl -d Ubuntu -- bash -c "cd '/mnt/d/Indian Empty-Leg Flight Marketplace' && docker compose -f docker-compose.supabase.yml up"

# 2. Create local config from template
cp public/config.local.js.example public/config.local.js
# (config.local.js is gitignored - fill in your local values if different from defaults)

# 3. Start frontend (in another terminal)
wsl -d Ubuntu -- bash -c "cd '/mnt/d/Indian Empty-Leg Flight Marketplace/public' && python3 -m http.server 5173"

# 4. Open frontend
# http://localhost:5173
```

### Local Development (Cloud-only workflow, no Docker)

If Docker is unavailable, develop against your Supabase Cloud project:

```bash
# 1. Link to your cloud project (one-time)
supabase link --project-ref <your-project-ref>

# 2. Push migrations to cloud
supabase db push

# 3. Create local config pointing to cloud
cat > public/config.local.js << 'EOF'
window.__ENV_LOCAL__ = {
  SUPABASE_URL: 'https://<your-project-ref>.supabase.co',
  SUPABASE_ANON_KEY: '<your-anon-key>',
  ALLOW_DEV_DEFAULTS: 'true'
};
EOF

# 4. Start frontend
python3 -m http.server 5173 -d public

# 5. Open frontend
# http://localhost:5173
```

> **Note:** Edge Functions run in Supabase Cloud. For local Edge Function development, use `supabase functions serve` (requires Docker).

### Production Deployment

1. **Build/Deploy the `public/` folder** to your static hosting (Vercel, Netlify, Cloudflare Pages, etc.)
2. **Configure runtime environment variables** in your hosting platform:
   - `SUPABASE_URL`: Your Supabase **project root** (e.g., `https://<project-ref>.supabase.co`) — **NOT** `/rest/v1`
   - `SUPABASE_ANON_KEY`: Your production Supabase **publishable anon key** (from Supabase Dashboard → Settings → API)
   
   The hosting platform should inject these as `window.__ENV__` before the page loads. For example:
   
   **Vercel/Netlify/Cloudflare:** Add a "Build Command" or "Headers" script that writes:
   ```html
   <script>window.__ENV__ = { SUPABASE_URL: "...", SUPABASE_ANON_KEY: "..." };</script>
   ```
   before the closing `</head>` tag, or use the platform's HTML rewrite/transform feature.

3. **Verify** the deployed site loads offers and can submit enquiries.

### Configuration Details

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase **project root** (e.g., `https://<ref>.supabase.co`) — **MUST NOT** contain `/rest/v1` |
| `SUPABASE_ANON_KEY` | Yes | **Publishable anon key** from Supabase Dashboard → Settings → API (NOT the JWT signing secret) |
| `ALLOW_DEV_DEFAULTS` | No | Set to `'true'` ONLY for local development to allow built-in defaults |

**Critical Security Notes:**
- **NEVER** use the JWT signing secret (`GOTRUE_JWT_SECRET` / `PGRST_JWT_SECRET`) as `SUPABASE_ANON_KEY`
- **NEVER** embed pre-signed JWTs (`ANON_JWT`) in browser-accessible code
- **NEVER** commit `config.local.js` or real credentials to version control
- The frontend uses the anon key via the `apikey` header for all requests

## Services

| Service | Local URL | Cloud URL | Purpose |
|---------|-----------|-----------|---------|
| Frontend | http://localhost:5173 | Your static host (Vercel/Netlify/CF Pages) | Marketplace UI |
| REST API (PostgREST) | http://localhost:3000 | `https://<ref>.supabase.co/rest/v1` | Direct DB access (offers, enquiries) |
| Kong Gateway | http://localhost:54321 | `https://<ref>.supabase.co` | API Gateway, Auth, Rate Limiting |
| Studio | http://localhost:54323 | Supabase Dashboard | Admin Dashboard |
| Auth | http://localhost:9999 | `https://<ref>.supabase.co/auth/v1` | GoTrue Auth |
| Realtime | http://localhost:4000 | `https://<ref>.supabase.co/realtime/v1` | WebSocket |
| Edge Functions | `supabase functions serve` | `https://<ref>.supabase.co/functions/v1` | Server-side logic (offers, enquiries) |
| PostgreSQL | `postgresql://postgres:postgres@localhost:54322/postgres` | Managed (Supabase Cloud) | Direct DB access |

## API

### List Available Offers (via Edge Function)

```bash
curl "https://<your-project-ref>.supabase.co/functions/v1/offers" \
  -H "apikey: YOUR_SUPABASE_ANON_KEY"
```

### Get Single Offer (via Edge Function)

```bash
curl "https://<your-project-ref>.supabase.co/functions/v1/offers/<offer-id>" \
  -H "apikey: YOUR_SUPABASE_ANON_KEY"
```

### Submit Enquiry (via Edge Function)

```bash
curl -X POST "https://<your-project-ref>.supabase.co/functions/v1/enquiries" \
  -H "Content-Type: application/json" \
  -H "apikey: YOUR_SUPABASE_ANON_KEY" \
  -d '{"offer_id": 1, "customer_name": "John", "customer_email": "john@example.com", "customer_phone": "+91-9876543210", "passenger_count": 4}'
```

### Get Enquiry (authenticated users only, via Edge Function)

```bash
curl "https://<your-project-ref>.supabase.co/functions/v1/enquiries/<enquiry-id>" \
  -H "Authorization: Bearer <user-jwt>"
```

**Note:** The frontend and API now use Edge Functions for server-side validation, atomic operations, and rate limiting. The `apikey` header is used for anonymous access; authenticated requests use `Authorization: Bearer <JWT>`.

### Privacy
- Anonymous users **cannot** read any enquiries (`GET /functions/v1/enquiries` returns `[]` for anon)
- Anonymous users **can** submit enquiries via `POST /functions/v1/enquiries`
- Only authenticated staff (via `staff_profiles`) can read all enquiries
- Authenticated customers can only read their own enquiries (matched by verified email)

## Test

```bash
# API tests
wsl -d Ubuntu -- bash -c "cd '/mnt/d/Indian Empty-Leg Flight Marketplace' && npx playwright test tests/api.spec.ts --reporter=line"

# Frontend E2E tests
wsl -d Ubuntu -- bash -c "cd '/mnt/d/Indian Empty-Leg Flight Marketplace' && npx playwright test tests/frontend.spec.ts --reporter=line"
```

## Database

- **8 available offers** from 5 synthetic operators
- **41 total enquiries** (including QA test records)
- **Passenger count constraint**: 1–19
- **RLS policies**: `allow_all_select` removed, replaced with staff/customer ownership

## Migrations

| File | Description |
|------|-------------|
| `001_initial_schema_v2.sql` | **Squashed migration** — 8 tables, RLS, triggers, views, atomic RPC, final policies (replaces 001-004) |

> **Note:** Migrations 001-004 have been consolidated into a single idempotent migration to avoid policy conflicts and ensure clean deployment to a fresh cloud database.

## Known Gaps

- Edge Functions (`supabase/functions/offers`, `enquiries`) created but not deployed (Deno/esm.sh import hangs)
- OneDrive relocation not executed
- No staff user configured for testing authenticated staff reads
- No CI/CD pipeline configured (add GitHub Actions workflow)

## Safety

- All data is **synthetic** — no real flights, operators, or customers
- Enquiry-only workflow — no payments, no booking confirmation
- Local development only — no production connections