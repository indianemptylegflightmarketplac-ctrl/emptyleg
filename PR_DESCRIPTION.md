Title: fix(ci): correct invalid env expression syntax + safe smoke test

## Summary
- Removed invalid job-level `if: secrets.*` expressions that caused "Unrecognized named-value: 'secrets'"
- Secrets are now only referenced inside step-level `env:` blocks (valid GitHub Actions syntax)
- Smoke test made read-only / safer (GET instead of POST to agent endpoint)
- No application code or production Supabase data changed

## Test plan
- [ ] All CI jobs pass
- [ ] No secrets committed
