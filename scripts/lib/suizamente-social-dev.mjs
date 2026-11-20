import { createClient } from '@supabase/supabase-js'
import { createSuizamenteSocialHttp } from '../../supabase/functions/_shared/suizamenteSocialHttp.js'

// Vite-only adapter. Service credentials remain in the local server process.
export function createSocialDevHandler({getClient,getSecret}={}) {
  let client
  const secret=getSecret||(()=>process.env.SUPABASE_SERVICE_ROLE_KEY||'')
  const serverClient=getClient||(()=>{
    if(client)return client
    const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,key=secret()
    if(!url||!key)throw new Error('Local server configuration missing')
    client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})}})
    return client
  })
  return async (req,res)=>{
    let body={}
    if(['POST','PUT','DELETE'].includes(req.method))try {
      const chunks=[];let size=0
      for await(const chunk of req){size+=chunk.length;if(size>8192)throw new Error('size');chunks.push(chunk)}
      body=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}')
    }catch{
      res.statusCode=400;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store')
      res.end(JSON.stringify({error:'solicitud_no_valida'}));return
    }
    const handle=createSuizamenteSocialHttp({getClient:serverClient,getSecret:secret,
      allowedOrigin:origin=>origin===`http://${req.headers.host}`||origin===`https://${req.headers.host}`})
    const result=await handle({method:req.method,url:req.url,headers:req.headers,body,address:req.socket.remoteAddress||'local'})
    res.statusCode=result.status
    for(const [key,value]of Object.entries(result.headers))res.setHeader(key,value)
    res.end(result.status===204?undefined:JSON.stringify(result.body))
  }
}
