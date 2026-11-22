import {createClient} from 'npm:@supabase/supabase-js@2.103.2'
import {createSuizamenteConquistaGateway,conquistaAllowedOrigin} from '../_shared/suizamenteConquistaGateway.js'
import catalog from '../_shared/suizamenteCatalogo.json' with {type:'json'}
const client=createClient(Deno.env.get('SUPABASE_URL')||'',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(20000)})}})
const previews=new Set((Deno.env.get('SUIZAMENTE_ALLOWED_ORIGINS')||'').split(',').map(s=>s.trim()).filter(s=>/^https:\/\/[^/]+$/.test(s)))
const allowedOrigin=(origin:string)=>conquistaAllowedOrigin(origin)||previews.has(origin)
const handle=createSuizamenteConquistaGateway({getClient:()=>client,getSecret:()=>Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',questions:new Map(Object.entries(catalog)),allowedOrigin})
Deno.serve(async request=>{
 let body={}
 if(['POST','PUT','DELETE'].includes(request.method))try{
  const reader=request.body?.getReader(),chunks:Uint8Array[]=[];let size=0
  const limit=new URL(request.url).pathname.endsWith('/social/photo')?250000:8192
  if(reader)for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new Error('size')}chunks.push(value)}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}body=JSON.parse(new TextDecoder().decode(bytes)||'{}')
 }catch{return new Response(JSON.stringify({error:'Solicitud no válida.'}),{status:400,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...(allowedOrigin(request.headers.get('origin')||'')?{'Access-Control-Allow-Origin':request.headers.get('origin')||''}:{})}})}
 const result=await handle({method:request.method,url:request.url,headers:Object.fromEntries(request.headers),body,address:request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim()||request.headers.get('cf-connecting-ip')||'unknown'})
 return new Response(result.status===204?null:JSON.stringify(result.body),{status:result.status,headers:result.headers})
})
