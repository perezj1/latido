import {createClient} from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
const db=createClient(Deno.env.get('SUPABASE_URL')||'',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',{auth:{persistSession:false}})
const secret=Deno.env.get('PUSH_WEBHOOK_SECRET')||''
const publicKey=Deno.env.get('VAPID_PUBLIC_KEY')||'',privateKey=Deno.env.get('VAPID_PRIVATE_KEY')||''
function validEndpoint(endpoint:string){try{const u=new URL(endpoint);return u.protocol==='https:'&&!u.username&&!u.password&&(u.hostname==='fcm.googleapis.com'||u.hostname==='web.push.apple.com'||u.hostname.endsWith('.push.apple.com')||u.hostname.endsWith('.push.services.mozilla.com')||u.hostname.endsWith('.notify.windows.com'))}catch{return false}}
Deno.serve(async req=>{
 if(req.method!=='POST')return Response.json({error:'Método no disponible'},{status:405})
 if(!secret||req.headers.get('x-latido-webhook-secret')!==secret)return Response.json({error:'No autorizado'},{status:403})
 if(!publicKey||!privateKey)return Response.json({error:'Falta la configuración de avisos'},{status:503})
 try{
  const body=await req.json(),id=body.record?.id
  if(!/^[0-9a-f-]{36}$/i.test(id||''))return Response.json({error:'Aviso no válido'},{status:400})
  const {data:row,error}=await db.rpc('suizamente_push_reclamar',{p_id:id})
  if(error)throw error
  if(!row)return Response.json({ok:true,omitido:true})
  const href=String(row.data?.href||'/suizamente')
  if(!/^\/suizamente(?:\/|$)/.test(href))return Response.json({ok:true,omitido:true})
  const {data:subscriptions,error:subscriptionError}=await db.from('suizamente_push_subscriptions').select('endpoint,p256dh,auth').eq('user_id',row.recipient_id).eq('enabled',true).eq('origin','https://suizamente.latido.ch')
  if(subscriptionError)throw subscriptionError
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')||'mailto:hola@latido.ch',publicKey,privateKey)
  const payload=JSON.stringify({title:row.data?.title||'Suizamente',body:'Tienes novedades en tu juego.',url:'https://suizamente.latido.ch'+href,tag:'suizamente:'+id,icon:'/suizamente-assets/icon-192.png'})
  const result=await Promise.allSettled((subscriptions||[]).filter(s=>validEndpoint(s.endpoint)).map(async s=>{
   try{await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},payload,{TTL:86400})}
   catch(e){if([404,410].includes(e.statusCode))await db.from('suizamente_push_subscriptions').update({enabled:false}).eq('endpoint',s.endpoint);else throw e}
  }))
  if(result.some(r=>r.status==='rejected')){await db.from('suizamente_notificaciones').update({enviada_en:null}).eq('id',id);return Response.json({error:'Entrega pendiente'},{status:503})}
  return Response.json({ok:true,enviados:result.filter(r=>r.status==='fulfilled').length})
 }catch{return Response.json({error:'No se pudo procesar el aviso'},{status:503})}
})
