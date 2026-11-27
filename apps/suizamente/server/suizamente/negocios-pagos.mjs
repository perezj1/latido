import {createHash,timingSafeEqual} from 'node:crypto'

const objectId=x=>typeof x==='string'?x:x?.id
const fail=(status,message)=>Object.assign(new Error(message),{status})
const required=(env,name)=>{if(!env[name])throw fail(503,'El pago automático estará disponible próximamente');return env[name]}
const iso=seconds=>new Date(seconds*1000).toISOString()
const label=seed=>'suizamente_'+createHash('sha256').update(seed).digest('hex').slice(0,8).replace(/[0-9]/g,n=>String.fromCharCode(107+Number(n)))
export function stripeTestSettings(env=process.env){
 const key=required(env,'SUIZAMENTE_STRIPE_TEST_SECRET_KEY')
 if(!/^(sk|rk)_test_/.test(key))throw fail(503,'Solo se permiten claves de prueba de Stripe')
 const origin=new URL(required(env,'SUIZAMENTE_STRIPE_RETURN_ORIGIN'))
 if(origin.protocol!=='https:'&&!(origin.protocol==='http:'&&['localhost','127.0.0.1'].includes(origin.hostname)))throw fail(503,'Origen de pagos no válido')
 if(origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw fail(503,'Origen de pagos no válido')
 return {key,origin:origin.origin}
}
export function hostedStripeUrl(value){
 const url=new URL(value)
 if(url.protocol!=='https:'||!['checkout.stripe.com','billing.stripe.com','invoice.stripe.com','pay.stripe.com'].includes(url.hostname)||url.username||url.password)throw fail(503,'Stripe no devolvió un enlace válido')
 return url.href
}
// A separate, lazy SDK instance means billing-off requests need no credentials.
export function createBusinessPayments({fetchImpl=fetch,env=process.env,stripeClient}={}){
 let client
 const sdk=async()=>{const settings=stripeTestSettings(env);return client??=(stripeClient||new (await import('stripe')).default(settings.key,{apiVersion:'2026-11-18.endive',maxNetworkRetries:2,timeout:12000}))}
 const rpc=async(name,action,args={},authorization)=>{
  const url=env.SUPABASE_URL||required(env,'VITE_SUPABASE_URL'),key=authorization?(env.SUPABASE_ANON_KEY||env.VITE_SUPABASE_ANON_KEY):required(env,'SUIZAMENTE_SUPABASE_SERVICE_ROLE_KEY')
  if(!key)throw fail(503,'Falta configurar el servidor de cobros')
  const response=await fetchImpl(url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:key,Authorization:authorization||'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({p_action:action,p_args:args}),signal:AbortSignal.timeout(15000)}),data=await response.json()
  if(!response.ok){const known=String(data.message||'').match(/SZV2:(\d{3}):(.+)/);throw fail(known?Number(known[1]):response.status===401?401:503,known?.[2]||'No se pudo completar el pago. Inténtalo otra vez.')}
  return data
 }
 const service=(action,args)=>rpc('suizamente_negocios_stripe',action,args)
 const user=(action,args,auth)=>rpc('suizamente_negocios_cobros',action,args,auth)
 const legacy=(action,args,auth)=>rpc('suizamente_negocios',action,args,auth)
 const returnUrl=id=>stripeTestSettings(env).origin+'/suizamente/negocios/'+id+'/panel/cuenta'
 const price=async(plan,period,config)=>{
  const id=required(env,'SUIZAMENTE_STRIPE_PRICE_'+plan.toUpperCase()+'_'+period.toUpperCase()),p=await(await sdk()).prices.retrieve(id)
  if(p.livemode||!p.active||p.currency!=='chf'||p.recurring?.interval!==(period==='ano'?'year':'month')||p.recurring?.interval_count!==1||p.unit_amount!==Math.round(config.planes[plan]?.[period]*100))throw fail(503,'Revisa los precios de prueba de Stripe')
  return p
 }
 const identifyPrice=async(id,config)=>{
  for(const plan of ['mapa','plus'])for(const periodo of ['mes','ano'])if(env['SUIZAMENTE_STRIPE_PRICE_'+plan.toUpperCase()+'_'+periodo.toUpperCase()]===id){await price(plan,periodo,config);return {plan,periodo}}
  throw fail(409,'La factura no corresponde a un precio del negocio')
 }
 async function customer(n,c){
  if(c.cliente)return c.cliente
  const s=await sdk(),created=await s.customers.create({email:n.datos.email,name:n.datos.nombre},{idempotencyKey:'sz-customer:'+n.id})
  if(created.livemode)throw fail(503,'Solo se permiten clientes de prueba')
  await service('guardar',{id:n.id,cliente:created.id});c.cliente=created.id;return created.id
 }
 async function runJob(payload,config){
  const {negocio:n,cobro:c,trabajo:j}=payload,s=await sdk(),options={idempotencyKey:'sz-job:'+j.id}
  if(!n||!c)throw fail(409,'Falta el estado de cobro del negocio')
  if(j.accion==='baja'){
   if(c.suscripcion){
    if(c.schedule)await s.subscriptionSchedules.release(c.schedule,{}, {idempotencyKey:options.idempotencyKey+':release'})
    await s.subscriptions.update(c.suscripcion,{cancel_at_period_end:true},options)
   }
   return
  }
  if(n.baja_solicitada||n.estado!=='activo')return
  if(j.accion==='plan'&&n.metodo==='tarjeta'){
   if(!c.suscripcion)throw fail(409,'La suscripción todavía no está preparada')
   const next=await price(j.datos.plan,j.datos.periodo,config),sub=await s.subscriptions.retrieve(c.suscripcion),item=sub.items.data[0]
   const schedule=c.schedule||objectId(sub.schedule)||(await s.subscriptionSchedules.create({from_subscription:sub.id},{idempotencyKey:options.idempotencyKey+':schedule'})).id
   await service('guardar',{id:n.id,schedule})
   await s.subscriptionSchedules.update(schedule,{end_behavior:'release',proration_behavior:'none',phases:[{start_date:item.current_period_start,end_date:item.current_period_end,items:[{price:objectId(item.price),quantity:1}],proration_behavior:'none'},{items:[{price:next.id,quantity:1}],duration:{interval:j.datos.periodo==='ano'?'year':'month',interval_count:1},proration_behavior:'none'}]},options)
   return
  }
  if(j.accion==='plan')return // Annual one-off/QR reads the chosen plan at renewal.
  const cliente=await customer(n,c)
  if(n.metodo==='tarjeta'){
   if(c.suscripcion)return
   if(!c.preparada||!c.payment_method)throw fail(409,'Primero guarda la tarjeta en Stripe')
   const p=await price(n.plan,n.periodo,config)
   const account=await s.customers.retrieve(cliente),defaultMethod=objectId(account.invoice_settings?.default_payment_method)||c.payment_method
   const method=await s.paymentMethods.retrieve(defaultMethod)
   if(method.type!=='card'||objectId(method.customer)!==cliente)throw fail(409,'Revisa la tarjeta del negocio en Stripe')
   if(!account.invoice_settings?.default_payment_method)await s.customers.update(cliente,{invoice_settings:{default_payment_method:defaultMethod}},{idempotencyKey:options.idempotencyKey+':default'})
   // Reconcile a Stripe success followed by a database/network failure, including
   // retries beyond Stripe's idempotency retention window.
   const existing=await s.subscriptions.list({customer:cliente,status:'all',limit:2})
   if(existing.has_more||existing.data.length>1)throw fail(409,'Revisa las suscripciones del negocio en Stripe')
   // Inherit the customer's current default so future Portal card changes apply.
   const sub=existing.data[0]||await s.subscriptions.create({customer:cliente,items:[{price:p.id}],payment_settings:{save_default_payment_method:'off'},payment_behavior:'default_incomplete',collection_method:'charge_automatically'},options)
   if(sub.livemode)throw fail(503,'Solo se permiten suscripciones de prueba')
   await service('guardar',{id:n.id,suscripcion:sub.id})
  }else if(n.metodo==='twint'){
   // Stripe currently excludes B2B from TWINT. Latido must confirm eligibility.
   if(env.SUIZAMENTE_STRIPE_TWINT_ELIGIBLE!=='true')throw fail(503,'TWINT estará disponible próximamente')
   const plan=n.proximo_plan||n.plan,p=await price(plan,'ano',config)
   const from=new Date(Math.max(n.activo_hasta?Date.parse(n.activo_hasta):0,Date.parse(j.creado))),to=new Date(from);to.setUTCFullYear(to.getUTCFullYear()+1)
   const session=await s.checkout.sessions.create({mode:'payment',customer:cliente,payment_method_configuration:required(env,'SUIZAMENTE_STRIPE_TWINT_CONFIGURATION'),line_items:[{price_data:{currency:'chf',unit_amount:p.unit_amount,product:objectId(p.product)},quantity:1}],invoice_creation:{enabled:true},success_url:returnUrl(n.id),cancel_url:returnUrl(n.id),integration_identifier:label(j.id)},options)
   hostedStripeUrl(session.url)
   await service('guardar',{id:n.id,sesion_pago:session.id,pago_desde:from.toISOString(),pago_hasta:to.toISOString(),pago_plan:plan,pago_importe:p.unit_amount/100})
  }
 }
 async function drain(config,id){
  if(!config.cobroAutomatico)return {procesados:0}
  let count=0;const deadline=Date.now()+20000
  for(;count<8&&Date.now()<deadline;count++){
   const payload=await service('trabajo',{id});if(!payload)break
   const lease={trabajo:payload.trabajo.id,lease:payload.trabajo.lease}
   try{await runJob(payload,config);await service('hecho',lease)}catch(e){await service('error',{...lease,error:e.type||e.name||'stripe_error'});return {procesados:count,pendiente:true}}
  }
  return {procesados:count}
 }
 async function webhook(raw,signature,config){
  const s=await sdk();let event
  try{event=s.webhooks.constructEvent(raw,signature,required(env,'SUIZAMENTE_STRIPE_WEBHOOK_SECRET'))}catch{throw fail(400,'Firma de Stripe no válida')}
  if(event.livemode)throw fail(400,'Solo se aceptan eventos de prueba')
  let obj=event.data.object
  const recognized=['checkout.session.completed','checkout.session.async_payment_succeeded','invoice.paid','invoice.payment_failed','invoice.payment_action_required','customer.subscription.deleted','customer.subscription.updated','charge.refunded','charge.dispute.created','radar.early_fraud_warning.created']
  if(!recognized.includes(event.type))return {recibido:true}
  let customerId=objectId(obj.customer)
  if(!customerId&&['charge.dispute.created','radar.early_fraud_warning.created'].includes(event.type)&&obj.charge)customerId=objectId((await s.charges.retrieve(objectId(obj.charge))).customer)
  const c=await service('cliente_buscar',{cliente:customerId||''})
  if(!c?.negocio){
   // Unrelated Stripe applications share the account. Never attribute by metadata.
   return {recibido:true,ajeno:true}
  }
  const base={id:c.negocio,cliente:c.cliente,evento:event.id}
  if(event.type==='checkout.session.completed'&&obj.mode==='setup'){
   if(obj.id!==c.sesion_setup)throw fail(409,'Sesión de tarjeta pendiente de registrar')
   const intent=await s.setupIntents.retrieve(objectId(obj.setup_intent)),pm=await s.paymentMethods.retrieve(objectId(intent.payment_method))
   if(intent.status!=='succeeded'||objectId(intent.customer)!==c.cliente||pm.type!=='card'||objectId(pm.customer)!==c.cliente)throw fail(409,'La tarjeta todavía no está guardada')
   await service('evento',{...base,tipo:'setup',sesion:obj.id,intent_setup:intent.id,payment_method:pm.id})
  }else if(event.type.startsWith('checkout.session.')&&obj.mode==='payment'){
   if(obj.id!==c.sesion_pago||obj.payment_status!=='paid')return {recibido:true}
   const intent=await s.paymentIntents.retrieve(objectId(obj.payment_intent)),pm=await s.paymentMethods.retrieve(objectId(intent.payment_method))
   if(intent.status!=='succeeded'||pm.type!=='twint'||obj.currency!=='chf'||obj.amount_total/100!==Number(c.pago_importe)||!obj.invoice)throw fail(409,'El pago TWINT todavía no está confirmado')
   await service('evento',{...base,tipo:'pagada',referencia:objectId(obj.invoice),desde:c.pago_desde,hasta:c.pago_hasta,importe:obj.amount_total/100,moneda:'chf',plan:c.pago_plan,periodo:'ano'})
  }else if(event.type.startsWith('invoice.')){
   const sub=objectId(obj.parent?.subscription_details?.subscription)
   if(!sub){return {recibido:true}} // TWINT is fulfilled from the registered Checkout.
   if(sub!==c.suscripcion)throw fail(409,'Suscripción pendiente de registrar')
   const invoice=await s.invoices.retrieve(obj.id),lines=invoice.lines.data
   if(lines.length!==1||invoice.lines.has_more)throw fail(409,'Revisa los tramos de la factura')
   const line=lines[0],chosen=await identifyPrice(line.pricing?.price_details?.price,config)
   if(objectId(invoice.customer)!==c.cliente||invoice.livemode||invoice.currency!=='chf')throw fail(409,'La factura no corresponde al negocio')
   if(event.type==='invoice.paid'&&invoice.status!=='paid')throw fail(409,'Stripe aún no confirma la factura')
   await service('evento',{...base,tipo:event.type==='invoice.paid'?'pagada':'fallida',referencia:invoice.id,desde:iso(line.period.start),hasta:iso(line.period.end),importe:(invoice.amount_paid||0)/100,moneda:invoice.currency,url:invoice.hosted_invoice_url?hostedStripeUrl(invoice.hosted_invoice_url):null,...chosen})
  }else if(event.type.startsWith('customer.subscription.')){
   if(obj.id!==c.suscripcion)throw fail(409,'Suscripción pendiente de registrar')
   const current=await s.subscriptions.retrieve(obj.id)
   if(current.cancel_at_period_end||current.status==='canceled')await service('evento',{...base,tipo:'baja'})
  }else await service('evento',{...base,tipo:'aviso',texto:'Stripe ha comunicado una incidencia en un pago. Revisa el panel de Stripe.'})
  return {recibido:true}
 }
 async function handle({req,route,body={},config}){
  const auth=req.headers.authorization,match=route.match(/^negocios\/([0-9a-f-]{36})\/pagos(?:\/(estado|tarjeta|portal|twint))?$/),id=match?.[1],op=match?.[2]||'estado'
  if(route==='negocios/pagos/webhook'){
   if(req.method!=='POST')throw fail(405,'Método no disponible')
   const chunks=[];let size=0
   // Do not even read req.body: on Vercel it is a lazy JSON-parsing getter.
   for await(const chunk of req){size+=chunk.length;if(size>1000000)throw fail(413,'Evento demasiado grande');chunks.push(chunk)}
   return webhook(Buffer.concat(chunks),req.headers['stripe-signature'],config)
  }
  if(route==='negocios/pagos/procesar'){
   const expected=required(env,'SUIZAMENTE_STRIPE_CRON_SECRET'),given=String(auth||'').replace(/^Bearer /,'')
   const supplied=Buffer.from(given),secret=Buffer.from(expected)
   if(supplied.length!==secret.length||!timingSafeEqual(supplied,secret))throw fail(403,'Solo el proceso de cobros')
   if(!['GET','POST'].includes(req.method))throw fail(405,'Método no disponible')
   return drain(config)
  }
  if(!config.activo||!config.cobroAutomatico)throw fail(404,'El cobro automático no está disponible')
  if(!auth||!/^Bearer [A-Za-z0-9._-]+$/.test(auth))throw fail(401,'Entra con tu cuenta de Latido')
  if(match){
   if(op==='estado'&&req.method==='GET')return user('estado',{id},auth)
   if(req.method!=='POST')throw fail(405,'Método no disponible')
   const {negocio:n,cobro:c}=await user('preparar',{id},auth),s=await sdk()
   if(op==='tarjeta'){
    if(n.metodo!=='tarjeta')throw fail(409,'Este negocio no paga con tarjeta')
    if(c.preparada)return {guardada:true}
    if(c.sesion_setup){const previous=await s.checkout.sessions.retrieve(c.sesion_setup);if(previous.status==='open')return {url:hostedStripeUrl(previous.url)};if(previous.status==='complete')return {pendiente:true}}
    const cliente=await customer(n,c),session=await s.checkout.sessions.create({mode:'setup',customer:cliente,currency:'chf',payment_method_configuration:required(env,'SUIZAMENTE_STRIPE_CARD_CONFIGURATION'),success_url:returnUrl(id),cancel_url:returnUrl(id),integration_identifier:label(id)}, {idempotencyKey:'sz-setup:'+id+':'+(c.sesion_setup||'first')})
    await service('guardar',{id,sesion_setup:session.id});return {url:hostedStripeUrl(session.url)}
   }
   if(op==='portal'){
    if(n.metodo!=='tarjeta'||!c.cliente)throw fail(409,'La cuenta de Stripe todavía no está preparada')
    const configuration=required(env,'SUIZAMENTE_STRIPE_PORTAL_CONFIGURATION'),settings=await s.billingPortal.configurations.retrieve(configuration)
    if(!settings.features.payment_method_update?.enabled||!settings.features.invoice_history?.enabled||settings.features.subscription_update?.enabled||!settings.features.subscription_cancel?.enabled||settings.features.subscription_cancel.mode!=='at_period_end')throw fail(503,'Revisa la configuración del portal de prueba')
    const portal=await s.billingPortal.sessions.create({customer:c.cliente,configuration,return_url:returnUrl(id)});return {url:hostedStripeUrl(portal.url)}
   }
   if(op==='twint'){
    await user('renovar',{id},auth);await drain(config,id)
    const updated=await user('preparar',{id},auth)
    if(!updated.cobro.sesion_pago)throw fail(503,'TWINT estará disponible próximamente')
    const session=await s.checkout.sessions.retrieve(updated.cobro.sesion_pago)
    if(session.status!=='open')throw fail(409,'Revisa el estado de tu pago antes de volver a pagar')
    return {url:hostedStripeUrl(session.url)}
   }
   throw fail(404,'Acción de pago no disponible')
  }
  if(route==='negocios/alta'&&req.method==='POST')return user('alta',body,auth)
  const mutation=route.match(/^negocios\/([0-9a-f-]{36})\/(aprobar|plan|baja)$/)
  if(mutation&&req.method==='POST'){const result=await legacy(mutation[2],{...body,id:mutation[1]},auth);return {...result,cobro:await drain(config,mutation[1])}}
  throw fail(404,'Ruta de cobro no disponible')
 }
 return {handle,drain,webhook}
}
export const isBusinessPaymentRoute=(route,auto)=>route==='negocios/pagos/webhook'||route==='negocios/pagos/procesar'||/^negocios\/[0-9a-f-]{36}\/pagos(?:\/[^/]+)?$/.test(route)||(auto&&(route==='negocios/alta'||/^negocios\/[0-9a-f-]{36}\/(aprobar|plan|baja)$/.test(route)))
