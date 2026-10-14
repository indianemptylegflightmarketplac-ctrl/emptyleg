/**
 * Runtime Configuration Loader
 * 
 * This file MUST be loaded before the main application script.
 * It provides a unified way to inject configuration at runtime.
 * 
 * Loading Priority:
 * 1. window.__ENV__ (injected by hosting platform at deploy time)
 * 2. window.__ENV_LOCAL__ (local development override, loaded from config.local.js)
 * 3. Built-in development defaults (only used if explicitly allowed via ALLOW_DEV_DEFAULTS)
 * 
 * Required Configuration:
 * - SUPABASE_URL: Supabase PROJECT ROOT (e.g., https://<ref>.supabase.co) — MUST NOT contain /rest/v1
 *   The frontend appends /functions/v1/... for Edge Functions and /rest/v1/... for direct PostgREST.
 * - SUPABASE_ANON_KEY: Public Supabase anon/publishable key (NOT the JWT signing secret)
 * 
 * Optional:
 * - ALLOW_DEV_DEFAULTS: Set to 'true' to allow built-in development defaults (local only)
 */

(function () {
  'use strict';

  // Check if config was already injected by hosting platform (Vercel, Netlify, Cloudflare, etc.)
  var injectedEnv = window.__ENV__ || {};

  // Try to load local development override (config.local.js)
  // This file should be gitignored and only exist in local development
  var localEnv = window.__ENV_LOCAL__ || {};

  // Merge: injected > local > empty (PRODUCTION INJECTED WINS)
  // Object.assign copies left-to-right; later sources overwrite earlier.
  // So injectedEnv (last) overrides localEnv. This prevents a local config.local.js
  // from accidentally redirecting production traffic.
  // For production: window.__ENV__ is injected by hosting platform (Vercel/Netlify/CF).
  // For local dev: window.__ENV_LOCAL__ from config.local.js provides values ONLY if no injected.
  var mergedEnv = Object.assign({}, localEnv, injectedEnv);

  // Validate required configuration
  var missing = [];
  if (!mergedEnv.SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!mergedEnv.SUPABASE_ANON_KEY) missing.push('SUPABASE_ANON_KEY');

  // Validate SUPABASE_URL format — must be project root, not /rest/v1
  if (mergedEnv.SUPABASE_URL && mergedEnv.SUPABASE_URL.includes('/rest/v1')) {
    var msg = '[config] SUPABASE_URL must be the project root (e.g., https://<ref>.supabase.co), NOT include /rest/v1. The frontend constructs endpoints automatically.';
    console.error(msg);
    document.addEventListener('DOMContentLoaded', function () {
      var el = document.getElementById('error');
      if (el) { el.textContent = 'Configuration error: ' + msg; el.style.display = 'block'; }
      var loading = document.getElementById('loading');
      if (loading) loading.style.display = 'none';
    });
    throw new Error(msg);
  }

  // Development defaults are NOT provided in browser code.
  // Local development MUST use config.local.js with ALLOW_DEV_DEFAULTS=true.
  // Production MUST inject window.__ENV__ at deploy time.
  var allowDevDefaults = mergedEnv.ALLOW_DEV_DEFAULTS === 'true';

  if (missing.length > 0) {
    if (allowDevDefaults) {
      console.warn(
        '[config] Missing required configuration: ' + missing.join(', ') +
        '. Falling back to development defaults because ALLOW_DEV_DEFAULTS=true. ' +
        'This should NEVER happen in production.'
      );
      // Development-only defaults (local Supabase stack) - URL only, NO anon key fallback
      if (!mergedEnv.SUPABASE_URL) mergedEnv.SUPABASE_URL = 'http://localhost:3000';
      // SUPABASE_ANON_KEY MUST be provided via config.local.js or window.__ENV__
    } else {
      var msg = '[config] Missing required configuration: ' + missing.join(', ') +
        '. Set window.__ENV__ at deploy time (production) or create config.local.js with ALLOW_DEV_DEFAULTS=true (local development).';
      console.error(msg);
      // Render user-visible error
      document.addEventListener('DOMContentLoaded', function () {
        var el = document.getElementById('error');
        if (el) {
          el.textContent = 'Configuration error: ' + msg;
          el.style.display = 'block';
        }
        var loading = document.getElementById('loading');
        if (loading) loading.style.display = 'none';
      });
      throw new Error(msg);
    }
  }

  // Expose validated config
  window.__ENV__ = Object.freeze({
    SUPABASE_URL: mergedEnv.SUPABASE_URL,
    SUPABASE_ANON_KEY: mergedEnv.SUPABASE_ANON_KEY,
    // Explicitly do NOT expose ANON_JWT - never embed pre-signed JWTs
    // The frontend should use the anon key via 'apikey' header for anon requests
  });

  console.log('[config] Loaded successfully. SUPABASE_URL:', window.__ENV__.SUPABASE_URL);
})();