const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i

async function hashAddress(address, secret) {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name:'HMAC', hash:'SHA-256' }, false, ['sign'])
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(address))
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
}

// Portable HTTP contract, shared by Vercel/Vite and the Supabase Edge Function.
// Adapters supply a trusted address and a server-only client; neither is taken
// from application headers such as X-Jugador-Id.
export function createSuizamenteHttp({ getClient, questions, getSecret, allowedOrigin }) {
  return async function handle({ method, url:requestUrl, headers:requestHeaders, body, address }) {
    const headers = { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', Vary:'Origin' }
    const send = (status, value) => ({ status, headers, body:value })
    try {
      const url = new URL(requestUrl, 'http://localhost')
      const origin = requestHeaders.origin
      if (origin && !allowedOrigin(origin, requestHeaders)) return send(403, { error:'origen_no_permitido' })
      if (origin) {
        headers['Access-Control-Allow-Origin'] = origin
        headers['Access-Control-Allow-Headers'] = 'authorization, apikey, content-type, x-jugador-id, x-client-info'
        headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
        headers['Access-Control-Max-Age'] = '600'
      }
      if (method === 'OPTIONS') return send(204, null)
      const route = (url.searchParams.get('ruta') || url.pathname.replace(/^.*\/(?:api\/suizamente|suizamente-votos)\/?/, '')).replace(/^\/+|\/+$/g, '')
      const action = method === 'GET' && route === 'votos/resumen' ? 'resumen'
        : method === 'GET' && route === 'votos/mios' ? 'mios'
          : method === 'POST' && route === 'votos' ? 'votar' : null
      if (!['votos', 'votos/resumen', 'votos/mios'].includes(route)) return send(404, { error:'ruta_inexistente' })
      if (!action) { headers.Allow = route === 'votos' ? 'POST' : 'GET'; return send(405, { error:'metodo_no_permitido' }) }
      if (action === 'votar') {
        const options = questions.get(body?.preguntaId)
        if (!options) return send(400, { error:'pregunta_inexistente' })
        if (!Number.isInteger(body.opcion) || body.opcion < 0 || body.opcion >= options) return send(400, { error:'opcion_fuera_de_rango' })
      }
      const client = getClient()
      let player = null
      if (requestHeaders.authorization) {
        const match = /^Bearer (\S+)$/.exec(requestHeaders.authorization)
        if (!match) return send(401, { error:'sesion_no_valida' })
        const { data, error } = await client.auth.getUser(match[1])
        if (error || !data?.user) return send(401, { error:'sesion_no_valida' })
        player = `user:${data.user.id}`
      } else if (uuid.test(requestHeaders['x-jugador-id'] || '')) player = `anon:${requestHeaders['x-jugador-id'].toLowerCase()}`
      if (!player && action !== 'resumen') return send(401, { error:'jugador_no_valido' })
      const ip = await hashAddress(String(address || 'unknown'), getSecret())
      const { data, error } = await client.rpc('suizamente_votos_api', {
        accion:action, jugador:player, pregunta:body?.preguntaId || null,
        eleccion:body?.opcion ?? null, direccion:ip,
      })
      if (error) {
        if (error.code === 'PT429') { headers['Retry-After'] = '60'; return send(429, { error:'demasiadas_peticiones' }) }
        if (error.code === 'PT400') return send(400, { error:'voto_no_valido' })
        return send(503, { error:'votos_no_disponibles' })
      }
      if (action === 'resumen' && !url.searchParams.has('actual')) headers['Cache-Control'] = 'public, max-age=30, s-maxage=30'
      return send(200, data)
    } catch (_) { return send(503, { error:'votos_no_disponibles' }) }
  }
}

export function suizamenteAllowedOrigin(origin) {
  return ['https://latido.ch', 'https://www.latido.ch'].includes(origin)
    || /^https:\/\/latidoch(?:-[a-z0-9-]+)?\.vercel\.app$/.test(origin)
    || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
}
