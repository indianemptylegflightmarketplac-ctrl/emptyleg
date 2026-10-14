# Indian Empty-Leg Flight Marketplace — Project Status

**Last Updated:** 2026-10-14  
**Phase:** Phase 3 Implementation Complete — Ready for Cloud Deployment

---

## ✅ PRODUCTION-READY COMPONENTS

### 1. Database Schema (PostgreSQL)
- **8 tables**: operators, empty_leg_offers, booking_enquiries, booking_workflow_history, customer_profiles, staff_profiles, audit_log, notification_log
- **1 squashed migration**: `001_initial_schema_v2.sql` (idempotent, replaces 001-004)
- **Seed data**: 5 synthetic operators (4 authorized), 8 available offers, 2 test offers (expired/withdrawn)
- **Views**: available_offers_view, enquiry_summary_view
- **RLS policies**: Enquiry privacy enforced (anon can INSERT but not SELECT; authenticated users must use verified email)
- **Atomic RPC**: `create_enquiry_atomic` — prevents race conditions, validates offer atomically

### 2. Edge Functions (Supabase Functions / Deno)
- **offers/index.ts**: GET `/offers`, GET `/offers/:id` — public read with service-role key
- **enquiries/index.ts**: POST `/enquiries` (atomic via RPC), GET `/enquiries/:id`, GET `/enquiries` — server-side validation, rate-limited
- **Security**: Service-role key for internal calls, sanitized error responses, CORS configured

### 3. Frontend (Vanilla JS/HTML/CSS)
- Vanilla JS/HTML/CSS single-page application
- Offers grid with filters (departure, destination, category, passengers, price)
- Enquiry modal with validation (passenger count max 19, capped at offer capacity)
- Success confirmation modal with enquiry reference
- Responsive design
- **Calls Edge Functions** (not PostgREST directly) for offers and enquiries
- Runtime config via `config.js` — injected env wins over local

### 4. Kong Gateway Configuration
- Rate limiting: 30 req/min per IP on `/functions/v1/enquiries`
- CORS, key-auth, ACL on all services
- Edge Functions exposed at `/functions/v1`

### 5. CI/CD (GitHub Actions)
- Lint & TypeCheck
- Migration check (dry-run against PostgreSQL)
- API tests (14 tests, Playwright)
- Frontend E2E tests (16 tests, Playwright)
- Security tests
- Deploy check on main branch

### 6. Configuration & Security
- `config.js`: Production-safe merge order (injected > local), fails closed
- `config.local.js.example`: Template for local/cloud development
- `.gitignore`: Protects secrets, local config, Docker files
- No hardcoded secrets in frontend

---

## ⚠️ KNOWN ISSUES / PENDING

### Cloud Deployment Prerequisites
- [ ] **Supabase Cloud project created** and project_ref confirmed
- [ ] `supabase/config.toml` `project_id` matches cloud project ref
- [ ] Supabase CLI authenticated: `supabase login`
- [ ] Project linked: `supabase link --project-ref <ref>`

### Post-Deployment
- [ ] Run migration: `supabase db push` (applies squashed migration)
- [ ] Deploy Edge Functions: `supabase functions deploy offers` and `supabase functions deploy enquiries`
- [ ] Set Edge Function secrets: `SUPABASE_SERVICE_ROLE_KEY` in Supabase Dashboard
- [ ] Configure SMTP for Auth (Supabase Dashboard → Auth → SMTP)
- [ ] Create staff user in Supabase Auth + `staff_profiles` insert for testing
- [ ] Deploy frontend to Vercel/Netlify/Cloudflare Pages with `window.__ENV__` injection
- [ ] Configure CORS in Supabase for production domain

### Development Environment (WSL2 Docker)
- Docker Desktop instability remains — use Cloud workflow or GitHub Actions for testing
- Playwright browser networking in WSL2 — CI/CD handles this

---

## 🚀 CLOUD DEPLOYMENT CHECKLIST

### Infrastructure
- [ ] Provision Supabase Cloud project (free tier)
- [ ] Verify `supabase/config.toml` project_id matches
- [ ] Run migrations: `supabase db push --linked`
- [ ] Configure environment variables in production

### Frontend Deployment
- [ ] Deploy `public/` to Vercel/Netlify/Cloudflare Pages
- [ ] Inject `window.__ENV__` at deploy time:
  ```html
  <script>window.__ENV__ = { SUPABASE_URL: "https://<ref>.supabase.co/rest/v1", SUPABASE_ANON_KEY: "<anon-key>" };</script>
  ```
- [ ] Configure CORS in Supabase for production domain

### Edge Functions Deployment
- [ ] Set `SUPABASE_SERVICE_ROLE_KEY` secret in Supabase Dashboard (Settings → Edge Functions)
- [ ] Deploy: `supabase functions deploy offers`
- [ ] Deploy: `supabase functions deploy enquiries`
- [ ] Verify functions respond at `https://<ref>.supabase.co/functions/v1/offers`

### Security
- [ ] Rotate JWT secret in Supabase Cloud (Dashboard → Settings → API)
- [ ] Enable email confirmations in Supabase Auth
- [ ] Create staff user for admin access
- [ ] Verify RLS policies in cloud database

---

## 📁 PROJECT STRUCTURE

```
Indian Empty-Leg Flight Marketplace/
├── .github/workflows/ci.yml       # CI/CD pipeline
├── docker-compose.supabase.yml    # Local Supabase stack (gitignored)
├── kong.yml                       # Kong gateway config
├── supabase/
│   ├── config.toml                # Supabase CLI config (gitignored)
│   ├── seed.sql                   # Synthetic seed data
│   ├── migrations/
│   │   └── 001_initial_schema_v2.sql  # Squashed migration (idempotent)
│   └── functions/
│       ├── offers/index.ts        # Edge function (offers)
│       └── enquiries/index.ts     # Edge function (enquiries)
├── public/
│   ├── index.html                 # Frontend SPA
│   ├── config.js                  # Runtime config loader
│   └── config.local.js.example    # Local config template
├── tests/
│   ├── api.spec.ts                # API tests (PostgREST + Edge Functions)
│   ├── frontend.spec.ts           # E2E tests
│   └── security.spec.ts           # Security tests
├── package.json
├── README.md
└── PROJECT_STATUS.md
```

---

## 🎯 QUICK START (Cloud Workflow — No Docker Required)

```bash
# 1. Authenticate Supabase CLI
supabase login

# 2. Link to your cloud project
supabase link --project-ref <your-project-ref>

# 3. Push migrations to cloud
supabase db push

# 4. Deploy Edge Functions
supabase functions deploy offers
supabase functions deploy enquiries

# 5. Set service-role key for Edge Functions (in Supabase Dashboard → Settings → Edge Functions)
# SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# 6. Create local config for frontend development
cat > public/config.local.js << 'EOF'
window.__ENV_LOCAL__ = {
  SUPABASE_URL: 'https://<your-project-ref>.supabase.co/rest/v1',
  SUPABASE_ANON_KEY: '<your-anon-key>',
  ALLOW_DEV_DEFAULTS: 'true'
};
EOF

# 7. Start frontend
python3 -m http.server 5173 -d public

# 8. Open frontend
# http://localhost:5173
```

---

## 📊 VERIFIED FUNCTIONALITY
- ✅ 8 synthetic empty-leg offers from 4 authorized operators
- ✅ Mumbai↔Delhi, Bengaluru↔Hyderabad, Delhi↔Dubai, Mumbai↔Singapore, Dehradun↔Delhi routes
- ✅ Aircraft: Cessna Citation XLS+, Hawker 850XP, Pilatus PC-24, Embraer Phenom 300, Gulfstream G280, Bombardier Challenger 350, Beechcraft King Air B200
- ✅ Whole-aircraft charter pricing (₹1.2L - ₹15L)
- ✅ Anonymous enquiry submission with privacy (RLS + Edge Function validation)
- ✅ Passenger count validation (1-19, capped at offer capacity)
- ✅ Offer expiry and availability status management
- ✅ Atomic enquiry creation (no race conditions)
- ✅ Rate limiting on enquiry submission (30 req/min/IP)
- ✅ Sanitized error responses (no internal leakage)
- ✅ CI/CD pipeline passing in GitHub Actions

---

## 🔐 SECURITY POSTURE
- **No secrets in frontend**: `config.js` loads from injected env only
- **No pre-signed JWTs**: Frontend uses `apikey` header
- **Edge Functions use service-role key**: Server-only, bypasses RLS safely
- **Atomic RPC for enquiries**: Prevents overbooking, validates offer state
- **Rate limiting**: Kong plugin on `/functions/v1/enquiries`
- **RLS policies**: Anon INSERT only, authenticated email enforcement, staff role-based access
- **Error sanitization**: No SQL errors exposed to clients

---

**Status**: All Phase 3 implementation complete. Ready for Supabase Cloud deployment. No code changes needed — only cloud configuration and deployment steps remain.