# EmptyLeg India — AI Development Team

This document is the operating contract for the six-agent AI development
team that continuously develops, tests, secures, maintains and improves the
Indian Empty-Leg Flight Marketplace.

- **Repository:** `indianemptylegflightmarketplac-ctrl/emptyleg`
- **Live site:** `https://master.emptyleg-india.pages.dev`
- **Provider:** Supabase (project ref `mfijofonuggcxqlftgtl`) + Cloudflare Pages
- **Command center:** GitHub Project **“EmptyLeg India — AI Development
  Command Center”**
- **CI:** GitHub Actions (`.github/workflows/ci.yml`) + smoke tests
  (`.github/workflows/smoke.yml`)

Agent definitions live in `.opencode/agents/` (OpenCode subagent format) and
are available to every agent. This file is referenced by each agent as its
first read.

---

## Agent roster

| # | Agent | Config | Scope |
|---|-------|--------|-------|
| 1 | Project Manager | `.opencode/agents/project-manager.md` | Docs, roadmap, issues, PROJECT_STATUS.md, progress summaries |
| 2 | Full-Stack Developer | `.opencode/agents/fullstack-developer.md` | Flight search/filtering, offers, booking enquiries, APIs, mobile, bug fixes |
| 3 | Database & Security Engineer | `.opencode/agents/data-security-engineer.md` | RLS audit, migrations review, enquiry privacy, permissions, secret exposure |
| 4 | QA & Test Engineer | `.opencode/agents/qa-test-engineer.md` | API/browser tests, regression + CI failure diagnosis, booking verification |
| 5 | Independent Code Reviewer | `.opencode/agents/independent-code-reviewer.md` | Reviews every dev PR; read-only by construction |
| 6 | Release & DevOps Engineer | `.opencode/agents/release-devops-engineer.md` | Workflows, CI/CD, Cloudflare verification, release prep, health checks |

Legacy specialist agents (`architecture-challenger.md`,
`coding-specialist.md`, `security-qa.md`) remain available as auxiliary
reviewers.

## Task assignment rules

1. The Project Manager turns needs into labeled GitHub issues
   (`agent:<role>` + `priority:critical|high`) and orders them.
2. Work is pulled into `<type>/<short-slug>` feature branches
   (`feat/…`, `fix/…`, `chore/…`, `ci/…`, `db/…`) based off the target
   branch.
3. One issue maps to one PR. The PR body links the issue (`Closes #N`).
4. The reviewer agent reviews before any merge request is escalated.

## GitHub conventions

**Labels** (labels already exist in the repository):

| Label | Meaning |
|---|---|
| `agent:manager` | Project management task |
| `agent:developer` | Development task |
| `agent:security` | Security audit task |
| `agent:tester` | QA/testing task |
| `agent:reviewer` | Code review task |
| `priority:high` | High priority |
| `priority:critical` | Critical priority |

**Project Status** (single-select, in order):
`Backlog → Ready → In Progress → Testing → Review → Done → Blocked`.

Rules: items move to `Testing` only when tests actually ran; `Review` only
when a PR exists; `Done` only after merge. Unfinished items stay in Backlog,
Ready, In Progress, Testing or Blocked — never fake `Done`.

## Pull request requirements

- Diffs are minimal and scoped to the assigned issue.
- Behavioral changes include tests; no coverage reductions to force green.
- `npx tsc --noEmit` and the relevant Playwright suites pass locally (local
  Supabase stack) and in CI.
- No secrets in the diff (including anon keys).
- CI approval gates (deploy environments) must not be weakened.

## Independent review rules

- The reviewer never reviews a PR whose changes the reviewer authored.
- Review verdicts: `approve` / `request-changes` / `reject`, with findings
  ordered by severity and file/line citations.
- Incomplete work is rejected, not conditionally approved.

## Testing requirements

- CI applies migrations + seed to a **disposable local Supabase stack**
  (see `ci.yml` `migration-check` + `local-stack-tests` jobs). Tests may not
  write to the production database.
- Suites: `tests/api.spec.ts`, `tests/frontend.spec.ts`,
  `tests/security.spec.ts` (Playwright). Desktop and mobile via Chromium
  device emulation.
- A CI fix must name the failing job/step and its root cause.

## Security requirements

- Enquiry privacy: anonymous users can create enquiries but never read
  other customers’ enquiries; enforcement is by RLS, verified by
  `tests/security.spec.ts`.
- Production data: never destructive SQL outside approved change windows
  with explicit human sign-off.
- Secrets: only ever injected at deploy time (`window.__ENV__` /
  Cloudflare Pages), never committed, never embedded in frontend fallbacks
  (`public/config.js` fails closed on missing config by design).

## Deployment approval requirements

- `deploy-preview` (PR previews) runs automatically when Cloudflare
  credentials exist.
- `deploy-production` requires **both** (a) Cloudflare credentials and (b)
  manual approval on the `production` GitHub environment — one human gate
  that no agent may bypass.
- No agent merges into `main`/`master`.

## Failure escalation

1. CI failure → QA agent diagnoses root cause → fix PR → re-run.
2. Repeated/infra failure (runner, images) → DevOps agent, status `Blocked`,
   labeled `agent:developer` for repro.
3. Security finding → label `agent:security`, `priority:critical`,
   assist-suppression is forbidden; finding is documented with evidence.
4. Anything requiring human action (merge, deploy, secrets, destructive DB
   changes, purchases) → status `Blocked` + explicit note in the issue; the
   agent must stop at the exact step and request only that action.

## Model & cost policy (₹0 target)

- Agents use free OpenRouter models (`…:free`) or local models.
- No model output token limits above ~8192 for routine tasks; split large
  tasks into smaller independent ones to conserve context.
- No purchases of credits/subscriptions at any point.
- OpenCode GitHub automation (if enabled) runs on the free tier only.
