#!/usr/bin/env node
// Generates public/config.env.js at deploy time.
//
// Used by Cloudflare Workers Builds (build.command in wrangler.jsonc) and by
// CI deploy jobs. It reads the two required runtime variables from its
// environment:
//
//   SUPABASE_PROJECT_URL  - Supabase PROJECT ROOT (no /rest/v1 suffix)
//   SUPABASE_ANON_KEY     - the publishable anon key
//
// Never fails closed silently: if either variable is missing, it writes
// nothing (the frontend's config.js fails closed by design), prints a clear
// remediation message, and exits non-zero. The generated file is never
// committed (see .gitignore).
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'config.env.js')

function fail(msg) {
  console.error(`[generate-config-env] ${msg}`)
  console.error('[generate-config-env] wrote NOTHING - the deployed frontend will fail closed (by design).')
  process.exitCode = 1
}

function main() {
  const projectUrl = process.env.SUPABASE_PROJECT_URL
  const anonKey = process.env.SUPABASE_ANON_KEY

  if (!projectUrl) {
    fail('SUPABASE_PROJECT_URL not set during build. Set it in the Cloudflare build environment (Workers Builds > Settings > Variables and Secrets).')
    return false
  }
  if (!anonKey) {
    fail('SUPABASE_ANON_KEY not set during build. Set it in the Cloudflare build environment (Workers Builds > Settings > Variables and Secrets).')
    return false
  }
  for (const bad of ['/rest/v1', '/functions/v1']) {
    if (projectUrl.includes(bad)) {
      fail(`SUPABASE_PROJECT_URL must be the project ROOT; it contains "${bad}".`)
      return false
    }
  }

  writeFileSync(
    out,
    `window.__ENV__ = { SUPABASE_URL: ${JSON.stringify(projectUrl)}, SUPABASE_ANON_KEY: ${JSON.stringify(anonKey)} };\n`,
  )
  console.log(`[generate-config-env] wrote ${out} (never committed)`)
  return true
}

process.exit(main() ? 0 : 1)
