// Isolated local QA only. Uses the real SQL engine in memory, never remote Supabase.
import {createServer} from 'vite'
import {realpathSync} from 'node:fs'
import react from '@vitejs/plugin-react'
import {createSuizamenteHandler} from '../../server/suizamente/http.mjs'
import {database,call,lecturaCall,profile,A,B,C} from './suizamente-v2-test-db.mjs'
import {mejorasDatabase,mejoraCall} from './mejoras-test-db.mjs'
import {negociosDatabase,negocioCall,cobroCall} from './negocios-test-db.mjs'
import {createBusinessPayments} from '../../server/suizamente/negocios-pagos.mjs'
import {getSuizamenteConfig} from '../../server/suizamente/config.mjs'
export function testUser(id,name){
  return {id,aud:'authenticated',role:'authenticated',email:name.toLowerCase()+'@suizamente.test',app_metadata:{provider:'email',providers:['email']},user_metadata:{name,canton:'ZH',latido_onboarding_completed:true},created_at:'2026-01-01T00:00:00Z'}
}
export function testToken(id){
  const b64=value=>Buffer.from(JSON.stringify(value)).toString('base64url')
  return b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:id,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+86400})+'.test-signature'
}
export async function startSuizamentePreview(port=5265,{demo=false,host='127.0.0.1',hmr=demo,pushPrompt=demo,mejoras=false,negocios=false,barraCanton=false,cobroAutomatico=false,negociosGratis=false,misterioHoy=false}={}){
  const extras=negocios?await negociosDatabase(negocios===true,mejoras,{payments:cobroAutomatico,gratis:negociosGratis}):mejoras?await mejorasDatabase(mejoras):null,db=extras?.db||await database({emparejamiento:true})
  for(const [id,name] of [[A,'Alex'],[B,'Lu'],[C,'Caro']]){
    await call(db,id,'guardar_jugador',profile(name))
    await call(db,id,'bienvenida')
    await db.query("UPDATE suizamente_private.suizamente_jugadores SET ajustes=ajustes||'{\"onboarding\":\"2026-01-01T00:00:00Z\"}'::jsonb WHERE jugador_id=$1",[id])
  }
  if(demo){
    for(const actor of [A,B])await db.query("SELECT suizamente_private.v3_anotar($1,'fixture','preview',5000,0,'{\"sobres\":5,\"otra\":3,\"salta\":3,\"tiempo\":3}')",[actor])
    await call(db,B,'construir',{canton:'LU',nivel:0,clave:crypto.randomUUID()})
  }
  const actorFrom=auth=>{
    try{const id=JSON.parse(Buffer.from(String(auth||'').split('.')[1],'base64url')).sub;return [A,B,C].includes(id)?id:null}catch{return null}
  }
  const origin='http://'+(host==='0.0.0.0'?'127.0.0.1':host)+':'+port
  process.env.SUPABASE_URL=origin+'/mock-supabase'
  process.env.SUPABASE_ANON_KEY='test-anon'
  const sqlFetch=async(_url,options)=>{
    const b=JSON.parse(options.body),actor=actorFrom(options.headers.Authorization)
    try{return Response.json(await(_url.endsWith('/suizamente_lectura')?lecturaCall(db,actor,b.p_action,b.p_args):_url.endsWith('/suizamente_negocios_cobros')?cobroCall(db,actor,b.p_action,b.p_args):_url.endsWith('/suizamente_negocios')?negocioCall(db,actor,b.p_action,b.p_args):_url.endsWith('/suizamente_mejoras')?mejoraCall(db,actor,b.p_action,b.p_args):call(db,actor,b.p_action,b.p_args,b.p_guest_id,b.p_guest_token)))}
    catch(e){if(!e.message.startsWith('SZV2:'))console.error('QA SQL:',e.message,e.where||'');return Response.json({message:e.message,code:e.code},{status:400})}
  }
  const previewMejoras=structuredClone(getSuizamenteConfig().juego.mejoras)
  for(const key of ['minuto','espejo','misterio','decorar','unToque'])previewMejoras[key].activo=mejoras===true||!!mejoras?.[key]
  const handler=createSuizamenteHandler({mysteryToday:()=>misterioHoy,fetchImpl:sqlFetch,payments:createBusinessPayments({fetchImpl:sqlFetch}),barraCanton:()=>barraCanton,negociosConfig:()=>({...getSuizamenteConfig().juego.negocios,activo:negocios===true,cobroAutomatico,gratis:negociosGratis}),mejorasConfig:()=>extras?.config||previewMejoras})
  const server=await createServer({
    css:{postcss:{plugins:[]}},configFile:false,envDir:'output/no-env-loaded',plugins:[react(),{
      name:'suizamente-isolated-sql-api',
      transformIndexHtml(html){
        // Returning fixture accounts have already postponed the new push prompt.
        // The interactive preview and dedicated prompt tests keep the first visit.
        if(!pushPrompt)html=html.replace('<body>','<body><script>for(const id of '+JSON.stringify([A,B,C])+'){const key="suizamente:push-recordatorio:"+id;if(!localStorage.getItem(key))localStorage.setItem(key,String(Date.now()+30*86400000))}</script>')
        if(!demo)return html
        return html.replace('<body>','<body><aside style="display:flex;flex-wrap:wrap;justify-content:center;gap:8px;padding:8px 12px;background:#4A76EF;color:white;font:600 12px Poppins,sans-serif;text-align:center">Prueba local · Datos temporales · <a style="color:inherit" href="/__suizamente_qa?cuenta=alex">Alex</a> · <a style="color:inherit" href="/__suizamente_qa?cuenta=lu">Lu (usa otra ventana privada)</a> · <a style="color:inherit" href="/__suizamente_qa?cuenta=caro">Caro (administración)</a></aside>')
      },
      configureServer(server){
        server.middlewares.use(async(req,res,next)=>{
          if(req.url?.split('?')[0]==='/suizamente/')req.url='/index.html'
          if(req.url?.startsWith('/__suizamente_qa')){
            const choice=new URL(req.url,origin).searchParams.get('cuenta')
            const account={alex:[A,'Alex'],lu:[B,'Lu'],caro:[C,'Caro']}[choice]
            if(!account){res.statusCode=404;return res.end('Cuenta de prueba no encontrada')}
            const [id,name]=account,session={access_token:testToken(id),refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+86400,token_type:'bearer',user:testUser(id,name)}
            res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store')
            return res.end('<!doctype html><meta charset="utf-8"><title>Suizamente · prueba local</title><script>localStorage.setItem("sb-"+location.hostname.split(".")[0]+"-auth-token",'+JSON.stringify(JSON.stringify(session))+');localStorage.setItem("suizamente:onboarding","2026-01-01");sessionStorage.setItem("suizamente:apertura","1");location.replace("/suizamente")</script>')
          }
          if(/^\/(?:server\/|supabase\/|suizamente\/data\/|data\/misterios\.json|fuentes\/)/.test(req.url||'')){res.statusCode=404;return res.end()}
          if(req.url?.startsWith('/api/suizamente/'))return handler(req,res)
          if(req.url?.startsWith('/mock-supabase/')){
            const actor=actorFrom(req.headers.authorization),name=actor===A?'Alex':actor===B?'Lu':'Caro'
            let result=[]
            if(req.url.includes('get_my_account_access'))result={role:'owner',account_id:actor}
            else if(req.url.includes('/auth/v1/user'))result=testUser(actor,name)
            else if(req.url.includes('/profiles'))result={id:actor,banned:false,avatar_url:null,interests:[]}
            res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(result))
          }
          next()
        })
      },
    }],define:{
      'import.meta.env.VITE_SUPABASE_URL':"(globalThis.location.origin + '/mock-supabase')",
      'import.meta.env.VITE_SUPABASE_ANON_KEY':JSON.stringify('test-anon'),
    },...(extras?{cacheDir:'output/vite-mejoras-'+port}:{}),server:{host,port,hmr,strictPort:true,fs:{allow:[process.cwd(),realpathSync('node_modules')],deny:['.env','.env.*','**/server/suizamente/data/**','**/supabase/**','**/suizamente/data/**','**/data/misterios.json','**/fuentes/**']}},
  })
  server.httpServer.prependListener('connection',socket=>socket.on('error',error=>{
    if(!['ECONNRESET','EPIPE','ECONNABORTED'].includes(error.code))throw error
  }))
  try{await server.listen()}catch(error){await server.close().catch(()=>{});await db.close();throw error}
  return {db,server,origin,mejorasConfig:extras?.config,async close(){await server.close();await db.close()}}
}
