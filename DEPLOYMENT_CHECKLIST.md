# Deployment Checklist — Indian Empty-Leg Flight Marketplace

Production stack: Supabase (project ref `mfijofonuggcxqlftgtl`) + Cloudflare Pages
(`https://master.emptyleg-india.pages.dev`).
Every step requiring human action is marked **[HUMAN]**. Agents must stop at those steps.

---

## 0. Pre-flight (must be true before any deploy)

- [x] Squashed migration `supabase/migrations/001_initial_schema_v2.sql` is
      idempotent and includes explicit anon deny RLS policies (privacy fix).
- [x] CI `migration-check` + `local-stack-tests` green on the release branch.
- [x] `npx tsc --noEmit` clean.
- [x] No secrets in the diff; `public/config.js` fails closed on missing config.
- [ ] CI green on the final commit of the release branch (currently being watched).

## 1. Supabase Cloud

- [ ] **[HUMAN]** Create/confirm Supabase project; verify ref
      `mfijofonuggcxqlftgtl` matches `supabase/config.toml` `project_id`.
- [ ] **[HUMAN]** `supabase login` (interactive — requires browser).
- [ ] `supabase link --project-ref mfijofonuggcxqlftgtl`
- [ ] `supabase db push` (applies the squashed migration; **not destructive**,
      no production data exists yet).
- [ ] Seed data: **NONE in production** — `supabase/seed.sql` is synthetic and
      local-only. Do not run it against the cloud project.
- [ ] Deploy Edge Functions:
      `supabase functions deploy offers`, `supabase functions deploy enquiries`
- [ ] Set function secret `SUPABASE_SERVICE_ROLE_KEY` in Supabase Dashboard
      (Settings → Edge Functions → secrets). **[HUMAN — secret handling]**
- [ ] Verify RLS policies applied in cloud DB (Studio → table policies).
- [ ] Rotate JWT secret in Supabase Cloud. **[HUMAN]**
- [ ] Enable email confirmations in Auth. **[HUMAN]**

## 2. Frontend — Cloudflare Pages

- [ ] Production build/deploy of `public/` (SPA, static). Existing deployment:
      `master.emptyleg-india.pages.dev`.
- [ ] Inject `window.__ENV__` at deploy time (Pages env/`_script`):
      `SUPABASE_URL` = Supabase **project root** (`https://mfijofonuggcxqlftgtl.supabase.co`)
      and `SUPABASE_ANON_KEY` (publishable key). Must NOT contain `/rest/v1`.
- [ ] Verify `config.js` merge order on live site (injected env wins; no
      fallback to dev defaults without `ALLOW_DEV_DEFAULTS`).
- [ ] Configure Supabase CORS/auth redirect allow-list for the Pages domain. **[HUMAN]**

## 3. Edge verification (post-deploy smoke)

> **2026-11-03 live state (verified autonomously):** the currently deployed
> site FAILS closed — homepage loads `config.js` before
> `config.local.js` (predates the repo fix) and no deploy-time
> `window.__ENV__` injection script is present in the served HTML; the
> marketplace SPA loads only `../config.js`; `POST /functions/v1/offers`
> returns 401. Symptom: waitlist/marketplace offers cannot load
> (`Missing required configuration` + `Unexpected token '<' ... not valid
> JSON` on console). Completing items 1–2 above (fresh deploy of the fixed
> branch WITH env injection) is the required remediation; re-run the smoke
> checks below afterwards.

- [ ] `GET https://<ref>.supabase.co/functions/v1/offers` → 200 with offers JSON.
- [ ] `POST .../functions/v1/enquiries` with a test enquiry → 200/201 with reference.
- [ ] `GET .../rest/v1/booking_enquiries` with anon key → **401/403 (privacy)**.
- [ ] Live site renders offers, filters work, enquiry modal completes, no console errors.
- [ ] `tests/live.spec.ts` (Playwright smoke against live URLs) passes.

## 4. Staff / admin

- [ ] Create staff user in Supabase Auth + insert `staff_profiles` row. **[HUMAN]**
- [ ] Verify admin dashboard (`admin.html`, `agent-dashboard.html`) access
      control against real users.

## 5. Rollback plan

- Supabase: keep previous migration state; migrations are additive and
  idempotent — do **not** run destructive SQL without human sign-off.
- Cloudflare Pages: roll back to the previous deployment from the Pages UI. **[HUMAN]**
- Secrets: never rotate or delete credentials autonomously.
