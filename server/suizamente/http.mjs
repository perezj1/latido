import { randomBytes, randomUUID } from 'node:crypto'
import { publicSuizamenteConfig } from './config.mjs'

const COOKIE = 'szm_invitado'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const methods = {
  'GET jugador':'jugador', 'PUT jugador':'guardar_jugador', 'DELETE jugador':'borrar_jugador',
  'POST jugador/vincular':'vincular', 'POST jugador/bienvenida':'bienvenida',
  'GET inicio':'inicio', 'GET partidas':'partidas', 'POST partidas':'crear_partida',
  'GET jugadores':'jugadores', 'GET emparejamiento':'emparejamiento', 'POST invitaciones':'invitaciones',
  'POST votos':'votos', 'GET votos/mios':'votos_mios', 'GET votos/resumen':'votos_resumen',
  'GET perfil':'perfil', 'GET logros':'logros', 'POST novedades/leer':'novedades_leer',
  'GET tienda':'tienda', 'POST tienda/comprar':'comprar', 'POST tienda/regalo':'regalo',
  'GET mapa':'mapa', 'POST mapa/construir':'construir',
  'GET album':'album', 'POST sobres':'abrir_sobre',
  'GET config':'config','GET capacidades':'capacidades','GET portada':'portada',
  'GET dia':'dia','POST dia/voto':'votar_dia','GET amigos':'amigos','GET amigos/buscar':'buscar','POST amigos':'amistad',
  'GET ranking':'ranking','GET libreta':'libreta','PUT libreta':'guardar_dato',
  'GET propuestas':'propuestas','POST propuestas':'proponer','GET valoraciones':'valorar_siguiente','POST valoraciones':'valorar',
  'POST denuncias':'denunciar','POST reportes':'reportar',
  'GET misiones':'misiones','POST misiones/cambiar':'cambiar_mision','GET liga':'liga','GET mapa/vuelta':'vuelta',
}
export function createSuizamenteHandler({ fetchImpl = fetch } = {}) {
  return async function handler(req, res) {
    const send = (status, data) => {
      res.statusCode = status
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.end(JSON.stringify(data))
    }
    try {
      const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'))
      const route = url.pathname.replace(/^\/api\/suizamente\/?/, '').replace(/\/$/, '')
      if (req.method === 'POST' && route === 'sesion/salir') {
        if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return send(403, {error:'Origen no permitido'})
        res.setHeader('Set-Cookie', COOKIE + '=; HttpOnly; SameSite=Lax; Path=/api/suizamente; Max-Age=0')
        return send(200, {cerrada:true})
      }
      if (!['GET','POST','PUT','DELETE'].includes(req.method)) return send(405, { error:'Método no disponible' })
      if (req.method !== 'GET' && req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return send(403, { error:'Origen no permitido' })
      let action = methods[req.method + ' ' + route]
      const adminRoute=route==='admin'||route.startsWith('admin/')
      if(adminRoute)action='admin'
      const communityRoute=route.match(/^(perfiles|resultados|preguntas)\/([^/]+)$/)
      if(communityRoute&&req.method==='GET')action={perfiles:'perfil_publico',resultados:'resultado',preguntas:'pregunta_publica'}[communityRoute[1]]
      const match = route.match(/^partidas\/([0-9a-f-]{36})(?:\/(girar|pregunta|respuesta|rendirse|comodin|duelo))?$/)
      if (match && UUID.test(match[1])) {
        if (!match[2] && req.method === 'GET') action = 'partida'
        else if (match[2] && req.method === 'POST') action = match[2]
      }
      const rewardRoute=route.match(/^(cofres|asaltos|sobres)\/([0-9a-f-]{36})(?:\/(abrir|empezar|respuesta|comodin|descartar|girar))?$/)
      if(rewardRoute&&UUID.test(rewardRoute[2])){
        const [,kind,,operation]=rewardRoute
        if(req.method==='GET'&&!operation)action={cofres:'cofre',asaltos:'asalto',sobres:'sobre'}[kind]
        if(req.method==='POST')action={cofres:{abrir:'abrir_cofre'},asaltos:{empezar:'asalto_empezar',respuesta:'asalto_respuesta',comodin:'asalto_comodin',descartar:'asalto_descartar'},sobres:{girar:'girar_carta'}}[kind]?.[operation]
      }
      if (!action) return send(404, { error:'Ruta no disponible' })
      let body = req.body
      if (req.method !== 'GET' && !body) {
        const chunks = []
        let size = 0
        for await (const chunk of req) {
          size += chunk.length
          if (size > (adminRoute?150000:20000)) return send(413, { error:'Solicitud demasiado grande' })
          chunks.push(chunk)
        }
        try { body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {} }
        catch { return send(400, { error:'JSON no válido' }) }
      }
      if (typeof body === 'string') {
        try { body = JSON.parse(body) } catch { return send(400, { error:'JSON no válido' }) }
      }
      if (body && (Array.isArray(body) || typeof body !== 'object')) return send(400, { error:'Solicitud no válida' })
      if(body&&Buffer.byteLength(JSON.stringify(body),'utf8')>(adminRoute?150000:20000))return send(413,{error:'Solicitud demasiado grande'})
      const args = { ...Object.fromEntries(url.searchParams), ...body }
      if (match) args.id = match[1]
      if (rewardRoute) args.id = rewardRoute[2]
      if(communityRoute)args.id=decodeURIComponent(communityRoute[2])
      if(adminRoute){args.ruta=route.slice(6)||'resumen';args.metodo=req.method}
      let session
      const value = String(req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1)
      if (value) {
        const parts = value.split('.')
        if (UUID.test(parts[0]) && /^[a-f0-9]{64}$/.test(parts[1])) session = { id:parts[0], token:parts[1] }
      }
      if (!session) {
        const hint = String(req.headers['x-jugador-id'] || '')
        session = { id:UUID.test(hint) ? hint : randomUUID(), token:randomBytes(32).toString('hex') }
        const secure = req.headers['x-forwarded-proto'] === 'https' || process.env.VERCEL === '1'
        res.setHeader('Set-Cookie', COOKIE + '=' + session.id + '.' + session.token + '; HttpOnly; SameSite=Lax; Path=/api/suizamente; Max-Age=31536000' + (secure ? '; Secure' : ''))
      }
      const endpoint = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
      const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
      if (!endpoint || !anon) return action==='config'?send(200,publicSuizamenteConfig()):send(503, { error:'Falta configurar la conexión de Supabase' })
      const auth = req.headers.authorization
      if (auth && !/^Bearer [A-Za-z0-9._-]+$/.test(auth)) return send(401, { error:'Sesión de Latido no válida' })
      const response = await fetchImpl(endpoint + '/rest/v1/rpc/suizamente_v2', {
        method:'POST',
        headers:{ apikey:anon, Authorization:auth || 'Bearer ' + anon, 'Content-Type':'application/json' },
        body:JSON.stringify({ p_action:action, p_args:args, p_guest_id:session.id, p_guest_token:session.token }),
        signal:AbortSignal.timeout(15000),
      })
      const data = await response.json()
      if (!response.ok) {
        if(action==='config')return send(200,publicSuizamenteConfig())
        const message = String(data.message || '')
        const known = message.match(/SZV2:(400|401|402|403|404|409|429|503):(.+)/)
        if (known) return send(Number(known[1]), { error:known[2] })
        if (response.status === 401) return send(401, { error:'Tu sesión ha caducado. Vuelve a entrar.' })
        if (data.code === '22P02' || data.code === '23514') return send(400, { error:'Revisa los datos enviados' })
        if (data.code === 'PGRST202' || data.code === '42883') return send(503, { error:'Falta instalar la migración de Suizamente' })
        console.error('suizamente_api', data.code || response.status)
        return send(503, { error:'No se pudo completar la acción. Inténtalo otra vez.' })
      }
      if (data?.conflicto) return send(409, { error:'El turno ha caducado', partida:data.partida })
      return send(200, data)
    } catch (error) {
      console.error('suizamente_api', error.name)
      return send(503, { error:'No se pudo conectar. Inténtalo otra vez.' })
    }
  }
}
export default createSuizamenteHandler()
