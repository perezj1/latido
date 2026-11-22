import {suizamenteAllowedOrigin} from './suizamenteHttp.js'
const id='([a-f0-9-]{36})'
function route(path,method,body){
 const fixed={'GET /state':['estado',{}],'POST /notices/read':['avisos_leer',body],'POST /shop':['comprar',body],'PUT /settings':['preferencias',body],'POST /rounds':['iniciar',body],'POST /battles':['desafiar',body]}
 if(fixed[method+' '+path])return fixed[method+' '+path]
 let match=path.match(new RegExp('^/rounds/'+id+'(?:/(answer|advantage|abandon))?$','i'))
 if(match&&((method==='GET'&&!match[2])||(method==='POST'&&match[2])))return [{answer:'responder',advantage:'ventaja',abandon:'abandonar'}[match[2]]||'partida',{...body,id:match[1]}]
 match=path.match(new RegExp('^/battles/'+id+'(?:/(accept|reject))?$','i'))
 if(match&&((method==='GET'&&!match[2])||(method==='POST'&&match[2])))return [{accept:'aceptar',reject:'rechazar'}[match[2]]||'batalla',{...body,id:match[1]}]
 return null
}
export function createSuizamenteConquistaHttp({getClient,allowedOrigin=suizamenteAllowedOrigin}){
 return async({method,url:requestUrl,headers:incoming={},body={}})=>{
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',Vary:'Origin'}
  const send=(status,body)=>({status,headers,body})
  try{
   if(incoming.origin&&!allowedOrigin(incoming.origin))return send(403,{error:'Origen no permitido.'})
   if(incoming.origin)Object.assign(headers,{'Access-Control-Allow-Origin':incoming.origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'GET,POST,PUT,OPTIONS'})
   if(method==='OPTIONS')return send(204,null)
   if(!['GET','POST','PUT'].includes(method))return send(405,{error:'Método no permitido.'})
   if(!body||typeof body!=='object'||Array.isArray(body)||JSON.stringify(body).length>8192)return send(400,{error:'Solicitud no válida.'})
   const path=new URL(requestUrl,'https://localhost').pathname.replace(/^.*\/suizamente-conquista/,'').replace(/\/$/,'')||'/'
   const action=route(path,method,body)
   if(!action)return send(404,{error:'Ruta no encontrada.'})
   const token=/^Bearer (\S+)$/.exec(incoming.authorization||'')?.[1]
   if(!token)return send(401,{error:'Entra con tu cuenta para jugar a Conquista.'})
   const client=getClient(),verified=await client.auth.getUser(token)
   if(verified.error||!verified.data?.user)return send(401,{error:'Tu sesión ha caducado. Vuelve a entrar.'})
   const result=await client.rpc('suizamente_conquista_api',{p_usuario:verified.data.user.id,p_accion:action[0],p_datos:action[1]})
   if(result.error){const status=/^PT(400|401|403|404|409|429)$/.exec(result.error.code||'');if(status){if(status[1]==='429')headers['Retry-After']='60';return send(Number(status[1]),{error:result.error.message})}return send(503,{error:'Conquista no está disponible ahora. Vuelve a intentarlo.'})}
   return send(200,result.data)
  }catch{return send(503,{error:'No se ha podido conectar con Conquista.'})}
 }
}
