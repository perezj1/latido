// Manual preview or an explicitly queued delivery. Requests cannot supply recipients.
import nodemailer from 'npm:nodemailer@6.9.10'
import {createClient} from 'npm:@supabase/supabase-js@2'
import {listingReminderEmail} from './email.ts'
const recipient='latidoch@gmail.com'
Deno.serve(async(req)=>{
  const key=Deno.env.get('LATIDO_CARD_INVITATION_SECRET')||''
  if(!key||req.headers.get('x-latido-cron-secret')!==key)
    return Response.json({ok:false,error:'UNAUTHORIZED'},{status:401})
  if(req.method!=='POST')return Response.json({ok:false,error:'METHOD_NOT_ALLOWED'},{status:405})
  const body=await req.json().catch(()=>({}))
  const service=createClient(Deno.env.get('SUPABASE_URL')||'',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'')
  let delivery:{id:string;email:string}|null=null
  if(body.delivery_id){
    if(typeof body.delivery_id!=='string'||!/^[a-f0-9-]{36}$/i.test(body.delivery_id))
      return Response.json({ok:false,error:'INVALID_DELIVERY'},{status:400})
    const {data,error}=await service.from('listing_reminder_deliveries')
      .update({status:'processing',processing_at:new Date().toISOString()})
      .eq('id',body.delivery_id).eq('status','pending').select('id,email').maybeSingle()
    if(error)return Response.json({ok:false,error:'CLAIM_FAILED'},{status:500})
    if(!data)return Response.json({ok:false,error:'ALREADY_CLAIMED_OR_UNKNOWN'},{status:409})
    delivery=data
  }
  const to=delivery?.email||recipient
  const transport=nodemailer.createTransport({
    host:Deno.env.get('SMTP_HOSTNAME')||'authsmtp.securemail.pro',
    port:Number(Deno.env.get('SMTP_PORT')||'465'),
    secure:(Deno.env.get('SMTP_SECURE')||'true').toLowerCase()==='true',
    connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000,
    auth:{user:Deno.env.get('SMTP_USERNAME')||'',pass:Deno.env.get('SMTP_PASSWORD')||''}
  })
  try{
    const info=await transport.sendMail({from:Deno.env.get('SMTP_FROM')||Deno.env.get('SMTP_USERNAME'),to,...listingReminderEmail(!delivery)})
    const accepted=info.accepted?.some((email:string)=>email.toLowerCase()===to)
    if(!accepted)throw new Error('SMTP_RECIPIENT_NOT_ACCEPTED')
    if(delivery){
      const {error}=await service.from('listing_reminder_deliveries')
        .update({status:'sent',sent_at:new Date().toISOString(),message_id:info.messageId})
        .eq('id',delivery.id).eq('status','processing')
      if(error)throw new Error('DELIVERY_LOG_FAILED')
    }
    return Response.json({ok:true,test:!delivery,to,messageId:info.messageId})
  }catch(error){
    const smtp=error as {code?:string;responseCode?:number}
    if(delivery)await service.from('listing_reminder_deliveries')
      .update({status:'failed',last_error:JSON.stringify({error:'delivery_requires_manual_review',code:smtp.code,responseCode:smtp.responseCode})})
      .eq('id',delivery.id).eq('status','processing')
    return Response.json({ok:false,error:'SMTP_DELIVERY_FAILED',code:smtp.code,responseCode:smtp.responseCode},{status:502})
  }finally{transport.close()}
})
