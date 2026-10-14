import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "http://localhost:3000"
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? ""
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "http://localhost:5173"

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY not set - Edge Function cannot call Supabase with elevated privileges")
}
if (!SUPABASE_ANON_KEY) {
  console.warn("SUPABASE_ANON_KEY not set - public reads will fail")
}

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

function getPublicHeaders(req: Request) {
  // Use anon key from request header (forwarded from frontend) or fall back to env
  const anonKey = req.headers.get('apikey') || SUPABASE_ANON_KEY
  const headers = new Headers()
  if (anonKey) {
    headers.set('apikey', anonKey)
    headers.set('Authorization', `Bearer ${anonKey}`)
  }
  headers.set('Content-Type', 'application/json')
  return headers
}

function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    // Don't expose internal error details
    const msg = error.message
    if (msg.includes('P0001')) return 'Offer not found'
    if (msg.includes('P0002')) return 'Offer is no longer available'
    if (msg.includes('P0003')) return 'Offer has expired'
    if (msg.includes('P0004')) return 'Passenger count exceeds capacity'
    return 'Internal server error'
  }
  return 'Internal server error'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const path = url.pathname
    const offerId = path.split('/').pop()

    const baseUrl = SUPABASE_URL.replace(/\/+$/, '') // strip trailing slashes
    const restUrl = baseUrl.endsWith('/rest/v1') ? baseUrl : `${baseUrl}/rest/v1`

    if (offerId && offerId !== 'offers') {
      // GET /offers/:id
      const res = await fetch(`${restUrl}/available_offers_view?id=eq.${offerId}&select=*`, {
        headers: getPublicHeaders(req),
      })
      if (!res.ok) {
        throw new Error(`Upstream error: ${res.status}`)
      }
      const data = await res.json()
      if (!data || data.length === 0) {
        return new Response(JSON.stringify({ error: 'Offer not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      return new Response(JSON.stringify(data[0]), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // GET /offers - list all available
    const res = await fetch(`${restUrl}/available_offers_view?select=*&order=departure_datetime.asc`, {
      headers: getPublicHeaders(req),
    })
    if (!res.ok) {
      throw new Error(`Upstream error: ${res.status}`)
    }
    const data = await res.json()

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error("Error:", error)
    return new Response(JSON.stringify({ error: sanitizeError(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}, { port: 8000 })

console.log("Offers server started on port 8000")