import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { createSuizamenteHttp } from '../supabase/functions/_shared/suizamenteHttp.js'

const questions = new Map(JSON.parse(readFileSync(new URL('../public/suizamente/data/preguntas.json', import.meta.url), 'utf8')).preguntas.map(q => [q.id, q.opciones.length]))

async function readBody(req) {
  if (req.body !== undefined) {
    if (Buffer.byteLength(typeof req.body === 'string' ? req.body : JSON.stringify(req.body)) > 4096) throw Object.assign(new Error(), { status:413 })
    return typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  }
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 4096) throw Object.assign(new Error(), { status:413 })
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}

export function createSuizamenteHandler(getClient = () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Server configuration missing')
  return createClient(url, key, {
    auth:{ persistSession:false, autoRefreshToken:false },
    global:{ fetch:(input, init) => fetch(input, { ...init, signal:AbortSignal.timeout(10000) }) },
  })
}) {
  const handle = createSuizamenteHttp({
    getClient, questions,
    getSecret:() => process.env.SUPABASE_SERVICE_ROLE_KEY || 'local-tests',
    allowedOrigin:(origin, headers) => origin === `https://${headers.host}` || origin === `http://${headers.host}`,
  })
  return async function handler(req, res) {
    let body = {}
    try { if (req.method === 'POST') body = await readBody(req) }
    catch (error) {
      res.statusCode = error.status || 400
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')
      res.end(JSON.stringify({ error:error.status === 413 ? 'solicitud_demasiado_grande' : 'json_no_valido' }))
      return
    }
    const result = await handle({
      method:req.method, url:req.url, headers:req.headers, body,
      address:process.env.VERCEL ? req.headers['x-vercel-forwarded-for'] : req.socket?.remoteAddress,
    })
    res.statusCode = result.status
    for (const [key, value] of Object.entries(result.headers)) res.setHeader(key, value)
    res.end(result.status === 204 ? undefined : JSON.stringify(result.body))
  }
}

export default createSuizamenteHandler()
