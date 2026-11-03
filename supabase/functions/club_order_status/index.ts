import { createClient } from 'npm:@supabase/supabase-js@2.101.1'
const service = createClient(Deno.env.get('SUPABASE_URL') || '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '', { auth:{ persistSession:false, autoRefreshToken:false } })
Deno.serve(async req => {
  const origin = req.headers.get('origin') || ''
  const allowed = ['https://latido.ch', 'https://www.latido.ch', 'https://latidoch.vercel.app'].includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  const headers = { 'Access-Control-Allow-Origin':allowed ? origin : 'https://www.latido.ch', 'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods':'POST, OPTIONS', 'Content-Type':'application/json', 'Cache-Control':'no-store', Vary:'Origin' }
  const json = (data:unknown, status = 200) => new Response(JSON.stringify(data), { status, headers })
  if (req.method === 'OPTIONS') return new Response(null, { status:204, headers })
  if (req.method !== 'POST') return json({ error:'METHOD_NOT_ALLOWED' }, 405)
  if (origin && !allowed) return json({ error:'ORIGIN_NOT_ALLOWED' }, 403)
  const body = await req.json().catch(() => ({}))
  // Session IDs are unguessable bearer tokens. Never return customer data.
  if (!/^cs_(test_|live_)?[A-Za-z0-9]{20,200}$/.test(body.sessionId || '') || !/^LC-\d{6,}$/.test(body.reference || '')) return json({ error:'INVALID_REQUEST' }, 400)
  const { data, error } = await service.from('club_orders').select('reference,payment_status').eq('stripe_checkout_session_id', body.sessionId).eq('reference', body.reference).maybeSingle()
  if (error) return json({ error:'ORDER_STATUS_UNAVAILABLE' }, 503)
  if (!data) return json({ error:'ORDER_NOT_FOUND' }, 404)
  return json(data)
})
