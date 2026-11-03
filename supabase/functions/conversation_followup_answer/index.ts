import { createClient } from 'npm:@supabase/supabase-js@2.101.1'
const service=createClient(Deno.env.get('SUPABASE_URL')||'',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',{auth:{persistSession:false,autoRefreshToken:false}})
Deno.serve(async req=>{
  const origin=req.headers.get('origin')||''
  const allowed=['https://latido.ch','https://www.latido.ch'].includes(origin)||/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  const headers={'Access-Control-Allow-Origin':allowed?origin:'https://www.latido.ch','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}
  const json=(data:unknown,status=200)=>Response.json(data,{status,headers})
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers})
  if(req.method!=='POST')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405)
  if(origin&&!allowed)return json({ok:false,error:'ORIGIN_NOT_ALLOWED'},403)
  try {
    const body=await req.json()
    if(!/^[a-f0-9]{64}$/.test(body.token||'') || (body.answer!==undefined&&!['yes','not_yet','no'].includes(body.answer)))return json({ok:false,error:'INVALID_REQUEST'},400)
    if(body.action!==undefined && (!['answer','reason','dismiss'].includes(body.action)||!Number.isInteger(body.round)||body.round<1))return json({ok:false,error:'INVALID_REQUEST'},400)
    if(body.action==='answer'&&!['yes','not_yet','no'].includes(body.value))return json({ok:false,error:'INVALID_REQUEST'},400)
    if(body.action==='reason'&&body.value!==null&&!['not_replied','not_match','no_agreement','other'].includes(body.value))return json({ok:false,error:'INVALID_REQUEST'},400)
    const {data,error}=await service.rpc(body.action?'cf_email_change':body.answer===undefined?'cf_email_context':'cf_answer_email',body.action?{p_token:body.token,p_round:body.round,p_action:body.action,p_value:body.value??null}:body.answer===undefined?{p_token:body.token}:{p_token:body.token,p_answer:body.answer})
    if(error)return json({ok:false,error:'LINK_UNAVAILABLE'},400)
    return json({ok:true,followup:data})
  }catch{return json({ok:false,error:'INVALID_REQUEST'},400)}
})
