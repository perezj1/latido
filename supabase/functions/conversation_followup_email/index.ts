import { createClient } from 'npm:@supabase/supabase-js@2.101.1'
import nodemailer from 'npm:nodemailer@6.9.10'
import { buildFollowupEmail } from './email.ts'
const URL = Deno.env.get('SUPABASE_URL') || ''
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const SECRET = Deno.env.get('CONVERSATION_FOLLOWUP_CRON_SECRET') || ''
const APP_URL = (Deno.env.get('LATIDO_APP_URL') || 'https://www.latido.ch').replace(/\/+$/, '')
const PUSH_SECRET = Deno.env.get('PUSH_WEBHOOK_SECRET') || ''
const service = createClient(URL,KEY,{auth:{persistSession:false,autoRefreshToken:false}})
const transport = nodemailer.createTransport({host:Deno.env.get('SMTP_HOSTNAME')||'authsmtp.securemail.pro',port:Number(Deno.env.get('SMTP_PORT')||465),secure:Deno.env.get('SMTP_SECURE')!=='false',auth:{user:Deno.env.get('SMTP_USERNAME'),pass:Deno.env.get('SMTP_PASSWORD')},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000})
type Claim = {id:string;user_id:string;conversation_id:string;title:string;round:number;token:string;attempts:number;email_enabled:boolean;email_sent_at:string|null;push_sent_at:string|null;email_only?:boolean}
async function update(row:Claim,values:Record<string,unknown>) {
  const {error} = await service.from('conversation_followups').update(values).eq('id',row.id).eq('round',row.round).eq('delivery_status','processing')
  if(error) throw error
}
Deno.serve(async req=>{
  if(req.method!=='POST') return Response.json({ok:false,error:'METHOD_NOT_ALLOWED'},{status:405})
  if(!SECRET || req.headers.get('x-latido-cron-secret')!==SECRET) return Response.json({ok:false,error:'UNAUTHORIZED'},{status:401})
  const request = await req.json().catch(() => ({}))
  // An explicit operator test never claims the queue or contacts a real customer.
  if (request?.test_email !== undefined) {
    if (request.test_email !== 'latidoch@gmail.com' || !/^[a-f0-9-]{36}$/.test(request.conversation_id || '')) return Response.json({ok:false,error:'INVALID_TEST_REQUEST'},{status:400})
    try {
      const {data:row,error}=await service.from('conversation_followups').select('id,user_id,conversation_id,title,round,email_token,is_test').eq('conversation_id',request.conversation_id).maybeSingle()
      if(error || !row) return Response.json({ok:false,error:'TEST_NOT_FOUND'},{status:404})
      if(!row.is_test) return Response.json({ok:false,error:'TEST_ACCOUNT_REQUIRED'},{status:403})
      const {data:account,error:accountError}=await service.auth.admin.getUserById(row.user_id)
      if(accountError || account.user?.user_metadata?.latido_followup_test!==true) return Response.json({ok:false,error:'TEST_ACCOUNT_REQUIRED'},{status:403})
      const {data:context,error:contextError}=await service.rpc('cf_email_context',{p_token:row.email_token})
      if(contextError) return Response.json({ok:false,error:'TEST_NOT_DUE'},{status:400})
      const testUrl=request.test_app_url==='http://127.0.0.1:5244' ? request.test_app_url : APP_URL
      const content=buildFollowupEmail({...row,token:row.email_token,contact_name:context.contact_name},testUrl)
      // Gmail's image proxy cannot load localhost; use Latido's public logo.
      content.html=content.html.replace(`${testUrl}/icon-192.png`,`${APP_URL}/icon-192.png`)
      const mail=await transport.sendMail({from:Deno.env.get('SMTP_FROM')||Deno.env.get('SMTP_USERNAME'),to:'latidoch@gmail.com',...content,subject:`[PRUEBA] ${content.subject}`})
      if(!mail.accepted?.some((address:string)=>address.toLowerCase()==='latidoch@gmail.com')) throw new Error('TEST_RECIPIENT_REJECTED')
      return Response.json({ok:true,test:true,recipient:'latidoch@gmail.com',message_id:mail.messageId})
    } catch { return Response.json({ok:false,error:'TEST_EMAIL_FAILED'},{status:500}) }
  }
  // Review/test build is inert until explicitly enabled on the server.
  if(Deno.env.get('CONVERSATION_FOLLOWUP_ENABLED')!=='true') return Response.json({ok:true,disabled:true})
  try {
    const {data,error}=await service.rpc('cf_claim_due',{p_limit:25})
    if(error) throw error
    const result={claimed:data?.length||0,sent:0,skipped:0,retried:0}
    for(const row of (data||[]) as Claim[]) {
      try {
        const {data:current,error:stateError}=await service.rpc('cf_email_context',{p_token:row.token})
        if(stateError) {
          if(stateError.message?.includes('LINK_UNAVAILABLE')) {await update(row,{delivery_status:'skipped',processing_at:null,last_error:'FOLLOWUP_UNAVAILABLE'});result.skipped++;continue}
          throw stateError
        }
        if(current.round!==row.round || ['yes','no'].includes(current.outcome)) continue
        const failures:string[]=[]
        if(!row.email_only && !row.push_sent_at) {
          try {
            if(!PUSH_SECRET) throw new Error('PUSH_NOT_CONFIGURED')
            const response=await fetch(`${URL}/functions/v1/latido_push_notification`,{method:'POST',headers:{'Content-Type':'application/json','x-latido-webhook-secret':PUSH_SECRET},body:JSON.stringify({type:'INSERT',table:'conversation_followups',record:{id:row.id,round:row.round}}),signal:AbortSignal.timeout(12000)})
            const body=await response.json()
            if(!response.ok || body.failed>0) throw new Error('PUSH_DELIVERY_FAILED')
            await update(row,{push_sent_at:new Date().toISOString()})
          } catch {failures.push('PUSH_DELIVERY_FAILED')}
        }
        let skipped=false
        if(!row.email_sent_at) {
          if(!row.email_enabled) skipped=true
          else {
            const {data:account,error:accountError}=await service.auth.admin.getUserById(row.user_id)
            if(accountError) throw accountError
            const recipient=account.user
            if(!recipient?.email || !recipient.email_confirmed_at) skipped=true
            else {
              try {
                const content=buildFollowupEmail({...row,contact_name:current.contact_name},APP_URL)
                await transport.sendMail({from:Deno.env.get('SMTP_FROM')||Deno.env.get('SMTP_USERNAME'),to:recipient.email,...content,messageId:`<followup-${row.id}-${row.round}@latido.ch>`})
                await update(row,{email_sent_at:new Date().toISOString()})
              } catch {failures.push('EMAIL_DELIVERY_FAILED')}
            }
          }
        }
        if(failures.length) throw new Error(failures.join(' | '))
        await update(row,{delivery_status:skipped?'skipped':'sent',processing_at:null,retry_at:null,last_error:null})
        if(skipped) result.skipped++; else result.sent++
      } catch(error) {
        await update(row,{delivery_status:'pending',processing_at:null,retry_at:new Date(Date.now()+Math.min(360,5*2**Math.min(row.attempts-1,7))*60000).toISOString(),last_error:error instanceof Error?error.message.slice(0,500):'DELIVERY_FAILED'})
        result.retried++
      }
    }
    return Response.json({ok:true,...result})
  } catch {return Response.json({ok:false,error:'FOLLOWUP_BATCH_FAILED'},{status:500})}
})
