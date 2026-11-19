import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'

const questions = new Map(JSON.parse(readFileSync(new URL('../public/suizamente/data/preguntas.json', import.meta.url), 'utf8')).preguntas.map(q => [q.id, q]))
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i

async function readBody(req) {
  if (req.body !== undefined) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 4096) throw Object.assign(new Error('Solicitud demasiado grande.'), { status:413 })
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}

// Dependency injection is limited to the server client, for HTTP + real SQL tests.
export function createSuizamenteHandler(getClient = () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw Object.assign(new Error('Votos de la comunidad no disponibles.'), { status:503 })
  return createClient(url, key, { auth:{ persistSession:false, autoRefreshToken:false } })
}) {
  return async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    const send = (status, value) => { res.statusCode = status; res.end(JSON.stringify(value)) }
    try {
      const url = new URL(req.url || '/', 'http://localhost')
      const route = (url.searchParams.get('ruta') || url.pathname.replace(/^\/api\/suizamente\/?/, '')).replace(/^\/+|\/+$/g, '')
      const action = req.method === 'GET' && route === 'votos/resumen' ? 'resumen'
        : req.method === 'GET' && route === 'votos/mios' ? 'mios'
          : req.method === 'POST' && route === 'votos' ? 'votar' : null
      if (!['votos', 'votos/resumen', 'votos/mios'].includes(route)) return send(404, { error:'ruta_inexistente' })
      if (!action) { res.setHeader('Allow', route === 'votos' ? 'POST' : 'GET'); return send(405, { error:'metodo_no_permitido' }) }
      if (req.headers.origin && req.headers.origin !== `https://${req.headers.host}`
        && req.headers.origin !== `http://${req.headers.host}`) return send(403, { error:'origen_no_permitido' })

      let body = {}
      if (action === 'votar') {
        try { body = await readBody(req) } catch (error) { return send(error.status || 400, { error:'json_no_valido' }) }
        const question = questions.get(body?.preguntaId)
        if (!question) return send(400, { error:'pregunta_inexistente' })
        if (!Number.isInteger(body.opcion) || body.opcion < 0 || body.opcion >= question.opciones.length) return send(400, { error:'opcion_fuera_de_rango' })
      }

      const client = getClient()
      let player = null
      if (req.headers.authorization) {
        const match = /^Bearer (\S+)$/.exec(req.headers.authorization)
        if (!match) return send(401, { error:'sesion_no_valida' })
        const { data, error } = await client.auth.getUser(match[1])
        if (error || !data?.user) return send(401, { error:'sesion_no_valida' })
        player = `user:${data.user.id}`
      } else if (uuid.test(req.headers['x-jugador-id'] || '')) player = `anon:${req.headers['x-jugador-id'].toLowerCase()}`
      if (!player && action !== 'resumen') return send(401, { error:'jugador_no_valido' })

      // The platform's trusted address is hashed; raw IP addresses are not stored.
      const address = process.env.VERCEL ? req.headers['x-vercel-forwarded-for'] : req.socket?.remoteAddress
      const ip = createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY || 'local-tests').update(String(address || 'unknown')).digest('hex')
      const { data, error } = await client.rpc('suizamente_votos_api', {
        accion:action, jugador:player, pregunta:body.preguntaId || null,
        eleccion:body.opcion ?? null, direccion:ip,
      })
      if (error) {
        if (error.code === 'PT429') { res.setHeader('Retry-After', '60'); return send(429, { error:'demasiadas_peticiones' }) }
        if (error.code === 'PT400') return send(400, { error:'voto_no_valido' })
        return send(503, { error:'votos_no_disponibles' })
      }
      if (action === 'resumen' && !url.searchParams.has('actual')) res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=30')
      return send(200, data)
    } catch (error) { return send(error.status || 503, { error:'votos_no_disponibles' }) }
  }
}

export default createSuizamenteHandler()
