import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "http://localhost:3000"
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "http://localhost:5173"

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY not set - Edge Function cannot call Supabase with elevated privileges")
}

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

function getAuthHeaders() {
  const headers = new Headers()
  if (SUPABASE_SERVICE_ROLE_KEY) {
    headers.set('apikey', SUPABASE_SERVICE_ROLE_KEY)
    headers.set('Authorization', `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`)
  }
  headers.set('Content-Type', 'application/json')
  return headers
}

function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message
    if (msg.includes('P0001')) return 'Offer not found'
    if (msg.includes('P0002')) return 'Offer is no longer available'
    if (msg.includes('P0003')) return 'Offer has expired'
    if (msg.includes('P0004')) return 'Passenger count exceeds capacity'
    if (msg.includes('duplicate key value violates unique constraint')) return 'Enquiry already exists'
    if (msg.includes('foreign key constraint')) return 'Invalid offer reference'
    if (msg.includes('check constraint')) return 'Invalid input data'
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
    const enquiryId = path.split('/').pop()

    const baseUrl = SUPABASE_URL.replace(/\/+$/, '') // strip trailing slashes
    const restUrl = baseUrl.endsWith('/rest/v1') ? baseUrl : `${baseUrl}/rest/v1`

    if (req.method === 'POST') {
      // POST /enquiries - submit a new booking enquiry via atomic RPC
      const body = await req.json()
      const {
        offer_id,
        customer_name,
        customer_email,
        customer_phone,
        customer_company,
        passenger_count,
        special_requests,
        budget_max_amount,
        budget_currency
      } = body

      // Basic input validation
      if (!offer_id || !customer_name || !customer_email || !customer_phone || !passenger_count) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      if (typeof offer_id !== 'number' || offer_id <= 0) {
        return new Response(JSON.stringify({ error: 'Invalid offer_id' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      if (typeof passenger_count !== 'number' || passenger_count < 1 || passenger_count > 19) {
        return new Response(JSON.stringify({ error: 'Passenger count must be between 1 and 19' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Call atomic RPC function - handles validation, locking, and insertion atomically
      const rpcUrl = `${restUrl}/rpc/create_enquiry_atomic`
      const rpcRes = await fetch(rpcUrl, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          p_offer_id: offer_id,
          p_customer_name: customer_name,
          p_customer_email: customer_email,
          p_customer_phone: customer_phone,
          p_customer_company: customer_company || null,
          p_passenger_count: passenger_count,
          p_special_requests: special_requests || null,
          p_budget_max_amount: budget_max_amount || null,
          p_budget_currency: budget_currency || 'INR',
        })
      })

      if (!rpcRes.ok) {
        const err = await rpcRes.json().catch(() => ({}))
        const message = err?.message || `Server error: ${rpcRes.status}`
        return new Response(JSON.stringify({ error: sanitizeError(new Error(message)) }), {
          status: rpcRes.status >= 400 && rpcRes.status < 500 ? rpcRes.status : 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const result = await rpcRes.json()
      const enquiryId = result // RPC returns the new enquiry_id

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Enquiry submitted successfully',
        enquiry_id: enquiryId
      }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (req.method === 'GET') {
      if (enquiryId && enquiryId !== 'enquiries') {
        // GET /enquiries/:id - requires authentication (RLS handles authorization)
        const res = await fetch(`${restUrl}/booking_enquiries?id=eq.${enquiryId}&select=*`, {
          headers: getAuthHeaders(),
        })
        if (!res.ok) {
          throw new Error(`Upstream error: ${res.status}`)
        }
        const data = await res.json()
        if (!data || data.length === 0) {
          return new Response(JSON.stringify({ error: 'Enquiry not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        return new Response(JSON.stringify(data[0]), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // GET /enquiries - list (RLS restricts to staff)
      const res = await fetch(`${restUrl}/booking_enquiries?select=*`, {
        headers: getAuthHeaders(),
      })
      if (!res.ok) {
        throw new Error(`Upstream error: ${res.status}`)
      }
      const data = await res.json()
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error("Error:", error)
    return new Response(JSON.stringify({ error: sanitizeError(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}, { port: 8001 })

console.log("Enquiries server started on port 8001")