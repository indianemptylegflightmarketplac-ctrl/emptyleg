# Deployment Checklist — Indian Empty-Leg Flight Marketplace

Production stack: Supabase (project ref `mfijofonuggcxqlftgtl`) + Cloudflare Pages
project **`emptyleg-india`** (`https://master.emptyleg-india.pages.dev`,
Cloudflare account `fa66418f4bdc966c2add08ec3e2766ab`).
Every step requiring human action is marked **[HUMAN]**. Agents must stop at those steps.

> **2026-11-04 verified state:** CI fully green on the branch tip `584840f`
> (run `41792608362`: lint+typecheck, migration-check, cloudflare-gate,
> local-stack-tests). Repo secrets/variables configured autonomously (values
> sourced from the owner's local files, never exposed in logs):
> `SUPABASE_PROJECT_URL`, `SUPABASE_ANON_KEY` (secrets) +
> `CLOUDFLARE_ACCOUNT_ID` (variable — account IDs are not sensitive).
> The deploy-production job now targets the REAL Pages project
> `emptyleg-india` (was `emptyleg`, which would have created a new empty
> project). The built-site config chain + offers + enquiry flow were
> verified end-to-end locally (16/16 assertions, see AUTONOMOUS_EXECUTION_LOG.md).

---

## 0. Pre-flight (must be true before any deploy)

- [x] Squashed migration `supabase/migrations/001_initial_schema_v2.sql` is
      idempotent and includes explicit anon deny RLS policies (privacy fix).
- [x] CI `migration-check` + `local-stack-tests` green on the release branch.
- [x] `npx tsc --noEmit` clean.
- [x] No secrets in the diff; `public/config.js` fails closed on missing config.
- [x] CI green on the final commit of the release branch — run `41792608362`
      @ `584840f`, all 4 jobs SUCCESS (2026-11-04).

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

> **2026-11-04 Cloudflare findings (API-verified with the authorized wrangler
> OAuth session):** the live site is Pages project `emptyleg-india` in account
> `fa66418f4bdc966c2add08ec3e2766ab` (aarvexfinance@gmail.com),
> `production_branch=main`, **direct-upload** (no git integration, no build
> command, zero env vars). The red `Workers Builds: emptyleg` GitHub check
> belongs to a DIFFERENT, unreachable Cloudflare account
> (`ff7900574a2d1aa6f74464e142f64dcf`) — a stray integration, NOT this
> project's deploy path. `main` is not branch-protected, so that check does
> not block merge. This repo's deploy path is the `deploy-production` GitHub
> Actions job (`ci.yml`), which is gated on `CLOUDFLARE_API_TOKEN`.

- [x] **Deploy target corrected** — `deploy-production` uses
      `projectName: emptyleg-india` (commit `584840f`).
- [x] `wrangler.jsonc` validated in a clean local build: `wrangler deploy
      --dry-run` executes the generator build command and reads 16 assets
      (15 + generated `config.env.js`), no bindings.
- [x] `generate-config-env.mjs` validated: fail-closed on missing env
      (exit 1, writes nothing — observed live when a dev session lacked the
      env vars), correct project-root URL + anon key on success (verified
      in-memory; nothing secret committed; `public/config.env.js` is
      gitignored — `.gitignore:6`).
- [x] **Built-site runtime test 16/16 (2026-11-04, `wrangler dev` + mock Edge
      Functions):** `/config.env.js` served as real JS
      (`text/javascript`, starts `window.__ENV__`, NOT SPA-fallback HTML);
      unknown route → HTML fallback; marketplace renders 2 offers; enquiry
      modal submits with Bearer auth; mock captured
      `POST /functions/v1/enquiries` with `offer_id` intact.
- [ ] **[HUMAN — the ONLY missing credential]** Create a Cloudflare API token
      (dash → My Profile → API Tokens → Create Token; permission **Pages:
      Edit** (+ Account Settings: Read), scoped to account
      `fa66418f...`), and add it as the GitHub repo secret
      `CLOUDFLARE_API_TOKEN`. The authorized environment CANNOT mint this
      token: the wrangler OAuth session receives **403** on
      `POST /user/tokens` and on permission-group listing (verified
      2026-11-04). Everything else in the deploy path is configured.
- [ ] **[HUMAN]** The stray `Workers Builds: emptyleg` integration lives in
      Cloudflare account `ff7900...` (inaccessible from here): either remove
      that integration in THAT account's dashboard, or ignore it — it is not
      a required check (`main` is unprotected) and is unrelated to the
      `deploy-production` job.
- [ ] After the token exists: push to the branch → `deploy-preview` runs;
      merging to `main` → `deploy-production` targets `emptyleg-india`.
- [ ] Verify `config.js` merge order on live site (injected env wins; no
      fallback to dev defaults without `ALLOW_DEV_DEFAULTS`).
- [ ] Configure Supabase CORS/auth redirect allow-list for the Pages domain. **[HUMAN]**

## 3. Edge verification (post-deploy smoke)

> **2026-11-03 live state (verified autonomously):** the currently deployed
> site FAILS closed — homepage is the old Oct-27 restyle (Tailwind CDN, loads
> only `config.js`/`config.local.js`, no `config.env.js`); `/config.env.js`
> there is the SPA fallback serving **HTML** (content-type `text/html`),
> not a config file. `POST /functions/v1/offers` returns 401. The deployed
> artifacts predate every fix in PR #1 — only a fresh deploy of this branch
> (via `deploy-production` once `CLOUDFLARE_API_TOKEN` exists and the PR is
> approved) remediates it. Re-run the smoke checks below afterwards.

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
