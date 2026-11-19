import { createClient } from 'npm:@supabase/supabase-js@2.103.2'
import { createSuizamenteHttp, suizamenteAllowedOrigin } from '../_shared/suizamenteHttp.js'
import catalog from '../_shared/suizamenteCatalogo.json' with { type:'json' }

const service = createClient(Deno.env.get('SUPABASE_URL') || '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '', {
  auth:{ persistSession:false, autoRefreshToken:false },
  global:{ fetch:(input, init) => fetch(input, { ...init, signal:AbortSignal.timeout(10000) }) },
})
const handle = createSuizamenteHttp({
  getClient:() => service,
  questions:new Map(Object.entries(catalog)),
  getSecret:() => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
  allowedOrigin:suizamenteAllowedOrigin,
})

Deno.serve(async req => {
  let body = {}
  if (req.method === 'POST') {
    const reader = req.body?.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    if (reader) for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > 4096) { await reader.cancel(); return jsonError(req, 413, 'solicitud_demasiado_grande') }
      chunks.push(value)
    }
    try {
      const bytes = new Uint8Array(size)
      let offset = 0
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
      body = JSON.parse(new TextDecoder().decode(bytes) || '{}')
    } catch (_) { return jsonError(req, 400, 'json_no_valido') }
  }
  const result = await handle({
    method:req.method, url:req.url, headers:Object.fromEntries(req.headers), body,
    // Read the gateway's final hop, never a caller-prepended forwarded address.
    address:req.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim()
      || req.headers.get('cf-connecting-ip') || 'unknown',
  })
  return new Response(result.status === 204 ? null : JSON.stringify(result.body), { status:result.status, headers:result.headers })
})

function jsonError(req: Request, status: number, error: string) {
  const origin = req.headers.get('origin') || ''
  return new Response(JSON.stringify({ error }), { status, headers:{
    'Content-Type':'application/json', 'Cache-Control':'no-store', Vary:'Origin',
    ...(suizamenteAllowedOrigin(origin) ? { 'Access-Control-Allow-Origin':origin } : {}),
  } })
}
