import { suizamenteAllowedOrigin } from './suizamenteHttp.js'
import { enrichSuizamenteAvatars } from './suizamenteAvatars.js'
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
async function addressHash(value,secret) {
  const encoder=new TextEncoder()
  const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign'])
  return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(value))),b=>b.toString(16).padStart(2,'0')).join('')
}
function endpoint(path,method,url,body) {
  const table={
    'GET /bootstrap':['bootstrap',{}], 'GET /profile':['perfil',{}], 'PUT /profile':['perfil_guardar',body],
    'DELETE /profile':['borrar',body], 'POST /link':['vincular',body], 'POST /answer':['respuesta',body],
    'GET /daily':['reto',{}], 'GET /duels':['duelos',{}], 'POST /duels':['duelo_crear',body],
    'GET /ranking':['ranking',{tipo:url.searchParams.get('tipo')||'cantones'}],
    'GET /friends':['amigos',{}], 'POST /friends':['amigo_solicitar',body],
    'POST /friends/respond':['amigo_responder',body], 'DELETE /friends':['amigo_quitar',body],
    'GET /people':['buscar',{texto:url.searchParams.get('texto')||''}], 'GET /notebook':['libreta',{}],
    'GET /proposals':['propuestas',{}], 'POST /proposals':['propuesta_crear',body],
    'GET /moderation':['moderacion',{}], 'GET /authors':['autores',{}],
    'GET /breakdown':['desglose',{preguntaId:url.searchParams.get('pregunta'),por:url.searchParams.get('por')||'pais'}],
    'GET /community':['comunidad',{}], 'GET /notifications':['avisos',{}], 'POST /notifications':['avisos_leer',{}],
  }
  let match
  if ((match=/^\/duels\/([A-Fa-f0-9]{8})(\/(?:join|rematch))?$/.exec(path))) {
    if (match[2]&&method==='POST')return [match[2]==='/join'?'duelo_unirse':'duelo_revancha',{codigo:match[1]}]
    if (!match[2]&&method==='GET')return ['duelo',{codigo:match[1]}]
    if (!match[2]&&method==='DELETE')return ['duelo_eliminar',{codigo:match[1]}]
  }
  if ((match=/^\/notebook\/([a-zA-Z0-9_-]+)$/.exec(path))&&['PUT','DELETE'].includes(method))return [method==='PUT'?'libreta_guardar':'libreta_quitar',{preguntaId:match[1]}]
  if ((match=/^\/moderation\/(\d+)$/.exec(path))&&method==='POST')return ['moderar',{...body,id:match[1]}]
  return table[method+' '+path]||null
}
export function createSuizamenteSocialHttp({getClient,getSecret,allowedOrigin=suizamenteAllowedOrigin}) {
  return async function handle({method,url:requestUrl,headers:incoming={},body={},address='unknown'}) {
    const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',Vary:'Origin'}
    const send=(status,value)=>({status,headers,body:value})
    try {
      const origin=incoming.origin
      if(origin&&!allowedOrigin(origin))return send(403,{error:'origen_no_permitido'})
      if(origin)Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-jugador-id,x-client-info','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS','Access-Control-Max-Age':'600'})
      if(method==='OPTIONS')return send(204,null)
      if(!['GET','POST','PUT','DELETE'].includes(method))return send(405,{error:'metodo_no_permitido'})
      if(!body||Array.isArray(body)||typeof body!=='object'||new TextEncoder().encode(JSON.stringify(body)).length>8192)return send(400,{error:'solicitud_no_valida'})
      const url=new URL(requestUrl,'http://localhost'), path=url.pathname.replace(/^.*\/(?:suizamente-social|api\/suizamente\/social)/,'').replace(/\/$/,'')||'/'
      const route=endpoint(path,method,url,body)
      if(!route&&!(method==='POST'&&path==='/sso'))return send(404,{error:'ruta_inexistente'})
      if(path==='/answer'&&(!Number.isInteger(body.opcion)||typeof body.preguntaId!=='string'))return send(400,{error:'respuesta_no_valida'})
      const client=getClient()
      let player,user
      if(incoming.authorization) {
        const token=/^Bearer (\S+)$/.exec(incoming.authorization)?.[1]
        if(!token)return send(401,{error:'sesion_no_valida'})
        const result=await client.auth.getUser(token)
        if(result.error||!result.data?.user)return send(401,{error:'sesion_no_valida'})
        user=result.data.user;player='user:'+user.id
      }else if(uuid.test(incoming['x-jugador-id']||''))player='anon:'+incoming['x-jugador-id'].toLowerCase()
      if(!player)return send(401,{error:'jugador_no_valido'})
      if(path==='/sso'&&(!user?.email||!user.email_confirmed_at))return send(401,{error:'cuenta_no_confirmada'})
      const ip=await addressHash(String(address),getSecret())
      const {data,error}=await client.rpc('suizamente_social_api',{p_accion:path==='/sso'?'perfil':route[0],p_jugador:player,p_datos:route?.[1]||{},p_direccion:ip})
      if(error) {
        const status=/^PT(400|401|403|404|409|429)$/.exec(error.code||'')
        if(status) {if(status[1]==='429')headers['Retry-After']='60';return send(Number(status[1]),{error:error.message||'solicitud_no_valida'})}
        return send(503,{error:'social_no_disponible'})
      }
      if(path==='/sso') {
        // Generates an OTP without sending email. Verification creates a new,
        // independent session; the Latido refresh token is never copied.
        const generated=await client.auth.admin.generateLink({type:'magiclink',email:user.email})
        if(generated.error||generated.data?.user?.id!==user.id||!generated.data?.properties?.hashed_token)return send(503,{error:'acceso_latido_no_disponible'})
        return send(200,{tokenHash:generated.data.properties.hashed_token,userId:user.id})
      }
      return send(200,await enrichSuizamenteAvatars(data,client))
    }catch{return send(503,{error:'social_no_disponible'})}
  }
}
