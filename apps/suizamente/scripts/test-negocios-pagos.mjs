import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {Readable} from 'node:stream'
import Stripe from 'stripe'
import {negociosDatabase,negocioCall,fixtureBusiness} from './lib/negocios-test-db.mjs'
import {call,profile,A,B,C} from './lib/suizamente-v2-test-db.mjs'
import {createBusinessPayments,stripeTestSettings,hostedStripeUrl} from '../server/suizamente/negocios-pagos.mjs'
import {getSuizamenteConfig} from '../server/suizamente/config.mjs'
import {createSuizamenteHandler} from '../server/suizamente/http.mjs'

const {db}=await negociosDatabase(),config={...getSuizamenteConfig().juego.negocios,activo:true,cobroAutomatico:true,gratis:false}
const env={SUPABASE_URL:'https://suizamente.test',SUPABASE_ANON_KEY:'test-anon',SUIZAMENTE_SUPABASE_SERVICE_ROLE_KEY:'local-service',SUIZAMENTE_STRIPE_TEST_SECRET_KEY:'sk_test_local_fixture',SUIZAMENTE_STRIPE_WEBHOOK_SECRET:'whsec_local_fixture',SUIZAMENTE_STRIPE_RETURN_ORIGIN:'https://suizamente.test',SUIZAMENTE_STRIPE_CARD_CONFIGURATION:'pmc_card',SUIZAMENTE_STRIPE_TWINT_CONFIGURATION:'pmc_twint',SUIZAMENTE_STRIPE_PORTAL_CONFIGURATION:'bpc_test',SUIZAMENTE_STRIPE_CRON_SECRET:'local-cron-fixture',SUIZAMENTE_STRIPE_TWINT_ELIGIBLE:'true'}
const prices={}
for(const plan of ['mapa','plus'])for(const period of ['mes','ano']){const id='price_'+plan+'_'+period;env['SUIZAMENTE_STRIPE_PRICE_'+plan.toUpperCase()+'_'+period.toUpperCase()]=id;prices[id]={id,active:true,livemode:false,currency:'chf',unit_amount:config.planes[plan][period]*100,recurring:{interval:period==='ano'?'year':'month',interval_count:1},product:'prod_'+plan}}
const accounts={},sessions={},subscriptions={},invoices={},calls=[],cache=new Map(),now=Math.floor(Date.now()/1000)
const unique=(name,params,options,fn)=>{calls.push([name,params,options]);const key=options?.idempotencyKey;if(key&&cache.has(key))return cache.get(key);const r=fn();if(key)cache.set(key,r);return r}
const stripe={
 webhooks:new Stripe('sk_test_local_fixture').webhooks,
 prices:{retrieve:async id=>prices[id]},
 customers:{create:async(p,o)=>unique('customer',p,o,()=>{const id='cus_'+calls.length;return accounts[id]={id,livemode:false,invoice_settings:{}}}),retrieve:async id=>accounts[id],update:async(id,p)=>Object.assign(accounts[id],p)},
 checkout:{sessions:{create:async(p,o)=>unique('checkout',p,o,()=>{const id='cs_'+calls.length;return sessions[id]={id,url:'https://checkout.stripe.com/c/pay/'+id,status:'open',...p}}),retrieve:async id=>sessions[id]}},
 subscriptions:{list:async({customer})=>({has_more:false,data:Object.values(subscriptions).filter(s=>s.customer===customer)}),create:async(p,o)=>unique('subscription',p,o,()=>{const id='sub_'+calls.length;return subscriptions[id]={...p,id,livemode:false,items:{data:[{price:p.items[0].price,current_period_start:now,current_period_end:now+2592000}]}}}),retrieve:async id=>subscriptions[id],update:async(id,p,o)=>unique('subscription_update',p,o,()=>Object.assign(subscriptions[id],p))},
 subscriptionSchedules:{create:async(p,o)=>unique('schedule',p,o,()=>({id:'sub_sched_test'})),update:async(id,p,o)=>unique('schedule_update',p,o,()=>({id,...p})),release:async()=>({})},
 setupIntents:{retrieve:async id=>({id,status:'succeeded',customer:Object.values(sessions).find(s=>s.setup_intent===id)?.customer,payment_method:'pm_card'})},
 paymentMethods:{retrieve:async id=>({id,type:id==='pm_twint'?'twint':'card',customer:Object.values(sessions).find(s=>s.mode==='setup')?.customer})},
 paymentIntents:{retrieve:async()=>({status:'succeeded',payment_method:'pm_twint'})},
 invoices:{retrieve:async id=>invoices[id]},
 billingPortal:{configurations:{retrieve:async()=>({features:{payment_method_update:{enabled:true},invoice_history:{enabled:true},subscription_update:{enabled:false},subscription_cancel:{enabled:true,mode:'at_period_end'}}})},sessions:{create:async p=>{calls.push(['portal',p]);return {url:'https://billing.stripe.com/p/session/test'}}}}
}
const invoke=async(name,actor,action,args)=>db.transaction(async tx=>{
 await tx.query("SELECT set_config('test.uid',$1,true),set_config('request.jwt.claim.role',$2,true)",[actor||'',actor==='service'?'service_role':'authenticated'])
 await tx.exec('SET LOCAL ROLE '+(actor==='service'?'service_role':'authenticated'))
 return (await tx.query('SELECT public.'+name+'($1,$2::jsonb) result',[action,JSON.stringify(args)])).rows[0].result
})
const fetchImpl=async(url,options)=>{const body=JSON.parse(options.body),actor=options.headers.Authorization==='Bearer local-service'?'service':options.headers.Authorization.slice(7);try{return Response.json(await invoke(url.split('/').at(-1),actor,body.p_action,body.p_args))}catch(e){return Response.json({message:e.message,code:e.code},{status:400})}}
const payments=createBusinessPayments({fetchImpl,env,stripeClient:stripe})
const request=(actor,route,body={},method='POST')=>payments.handle({req:{method,headers:{authorization:'Bearer '+actor}},route,body,config})
let eventNumber=0
async function event(type,object,id='evt_'+(++eventNumber)){
 const payload=JSON.stringify({id,type,livemode:false,data:{object}}),signature=stripe.webhooks.generateTestHeaderString({payload,secret:env.SUIZAMENTE_STRIPE_WEBHOOK_SECRET})
 return payments.webhook(Buffer.from(payload),signature,config)
}
const snapshot=async id=>(await db.query('SELECT * FROM suizamente_private.negocio_cobros WHERE negocio=$1',[id])).rows[0]
try{
 const migration=await readFile('supabase/suizamente_v37_negocios_cobros.sql','utf8');await db.exec(migration);await db.exec(migration)
 for(const [id,name]of [[A,'Alex'],[B,'Lu'],[C,'Caro']])await call(db,id,'guardar_jugador',profile(name))
 await assert.rejects(request(A,'negocios/alta'),/disponible/)
 await db.exec("UPDATE suizamente_private.negocios_configuracion SET config=jsonb_set(config,'{cobroAutomatico}','true')")
 const signup={datos:fixtureBusiness,canton:'ZH',plaza:'ZH-p1',plan:'plus',periodo:'mes',metodo:'tarjeta',condiciones:true}
 const {id}=await request(A,'negocios/alta',signup)
 await assert.rejects(negocioCall(db,C,'aprobar',{id}),/guardar su tarjeta/)
 await assert.rejects(request(B,'negocios/'+id+'/pagos/tarjeta'),/solo para su negocio/)
 const saved=await request(A,'negocios/'+id+'/pagos/tarjeta');assert.match(saved.url,/checkout.stripe.com/)
 const checkout=calls.find(([n])=>n==='checkout')[1];assert.equal(checkout.mode,'setup');assert.equal(checkout.payment_method_configuration,'pmc_card');assert.ok(!JSON.stringify(checkout).includes('payment_method_types'))
 await request(A,'negocios/'+id+'/pagos/tarjeta');assert.equal(calls.filter(([n])=>n==='checkout').length,1)
 assert.equal(calls.filter(([n])=>n==='subscription').length,0,'No charge before approval')
 let c=await snapshot(id);sessions[c.sesion_setup].setup_intent='seti_test';sessions[c.sesion_setup].status='complete'
 await event('checkout.session.completed',sessions[c.sesion_setup]);assert.equal((await snapshot(id)).preparada,true)
 accounts[c.cliente].invoice_settings.default_payment_method='pm_changed_in_portal';await request(C,'negocios/'+id+'/aprobar');c=await snapshot(id);assert.ok(c.suscripcion);assert.equal(accounts[c.cliente].invoice_settings.default_payment_method,'pm_changed_in_portal');assert.equal(calls.find(([name])=>name==='subscription')[1].default_payment_method,undefined,'Portal changes remain effective through the customer default')
 await payments.drain(config,id);assert.equal(calls.filter(([n])=>n==='subscription').length,1)
 await db.query('UPDATE suizamente_private.negocio_cobros SET suscripcion=NULL WHERE negocio=$1',[id]);await db.query("INSERT INTO suizamente_private.negocio_cobro_trabajos(negocio,accion) VALUES($1,'iniciar')",[id]);await payments.drain(config,id)
 assert.equal(calls.filter(([n])=>n==='subscription').length,1,'Reconcile a Stripe success lost before DB persistence without creating another subscription')
 await assert.rejects(negocioCall(db,C,'pagada',{id,referencia:'forged-manual'}),/Stripe confirma/)
 const invoice={id:'in_first',livemode:false,customer:c.cliente,parent:{subscription_details:{subscription:c.suscripcion}},currency:'chf',status:'paid',amount_paid:3900,hosted_invoice_url:'https://invoice.stripe.com/i/test',lines:{has_more:false,data:[{period:{start:now,end:now+2592000},pricing:{price_details:{price:'price_plus_mes'}}}]}}
 invoices[invoice.id]=invoice
 await event('invoice.paid',invoice,'evt_paid');await event('invoice.paid',invoice,'evt_paid');await event('invoice.paid',invoice,'evt_same_invoice')
 assert.equal((await db.query('SELECT count(*)::int n FROM suizamente_private.negocio_pagos')).rows[0].n,1)
 await event('invoice.payment_failed',invoice);assert.equal((await negocioCall(db,A,'panel',{id})).negocio.impago_desde,null)
 const next={...invoice,id:'in_next',status:'open',amount_paid:0,lines:{has_more:false,data:[{...invoice.lines.data[0],period:{start:now+2592000,end:now+5184000}}]}}
 invoices[next.id]=next;await event('invoice.payment_failed',next);const firstFailure=(await negocioCall(db,A,'panel',{id})).negocio.impago_desde
 await event('invoice.payment_failed',next);assert.equal((await negocioCall(db,A,'panel',{id})).negocio.impago_desde,firstFailure)
 await db.transaction(async tx=>{await tx.exec("SELECT set_config('request.jwt.claim.role','service_role',true)");await tx.query("UPDATE suizamente_private.negocios SET activo_hasta=clock_timestamp()-interval '10 days',impago_desde=clock_timestamp()-interval '10 days' WHERE id=$1",[id])})
 assert.equal((await negocioCall(db,A,'panel',{id})).visible,false,'Unpaid figure disappears after configured grace')
 Object.assign(next,{status:'paid',amount_paid:3900});await event('invoice.paid',next)
 const paidUntil=(await negocioCall(db,A,'panel',{id})).negocio.activo_hasta
 assert.equal((await negocioCall(db,A,'panel',{id})).visible,true)
 await event('invoice.paid',invoice);await event('invoice.payment_failed',invoice)
 assert.equal((await negocioCall(db,A,'panel',{id})).negocio.activo_hasta,paidUntil,'Old events never shrink the paid period')
 await request(A,'negocios/'+id+'/plan',{plan:'mapa',periodo:'ano'})
 const phases=calls.find(([n])=>n==='schedule_update')[1].phases;assert.equal(phases[0].end_date,now+2592000);assert.equal(phases[1].items[0].price,'price_mapa_ano');assert.equal(phases[1].proration_behavior,'none')
 const portal=await request(A,'negocios/'+id+'/pagos/portal');assert.match(portal.url,/billing.stripe.com/)
 await request(A,'negocios/'+id+'/baja');assert.equal(subscriptions[c.suscripcion].cancel_at_period_end,true)
 await event('customer.subscription.deleted',{id:c.suscripcion,customer:c.cliente});assert.equal((await negocioCall(db,A,'panel',{id})).negocio.baja_solicitada,true)
 assert.throws(()=>stripeTestSettings({...env,SUIZAMENTE_STRIPE_TEST_SECRET_KEY:'sk_live_rejected'}),/prueba/)
 assert.throws(()=>hostedStripeUrl('https://checkout.stripe.com.evil.test/pay'),/enlace/)
 await assert.rejects(payments.webhook(Buffer.from('{}'),'invalid',config),/Firma/)
 const raw=JSON.stringify({id:'evt_live',type:'invoice.paid',livemode:true,data:{object:invoice}})
 await assert.rejects(payments.webhook(Buffer.from(raw),stripe.webhooks.generateTestHeaderString({payload:raw,secret:env.SUIZAMENTE_STRIPE_WEBHOOK_SECRET}),config),/prueba/)
 const liveHandler=createSuizamenteHandler({payments,negociosConfig:()=>config}),invalid=Readable.from([Buffer.from('{}')]);Object.assign(invalid,{url:'/api/suizamente/negocios/pagos/webhook',method:'POST',headers:{host:'suizamente.test','stripe-signature':'bad'}})
 const response={setHeader(){},end(value){this.body=JSON.parse(value)}};await liveHandler(invalid,response);assert.equal(response.statusCode,400)
 const untouchedPayload=JSON.stringify({id:'evt_unrelated',type:'customer.created',livemode:false,data:{object:{id:'cus_unrelated'}}}),untouched=Readable.from([Buffer.from(untouchedPayload)])
 Object.assign(untouched,{url:'/api/suizamente/negocios/pagos/webhook',method:'POST',headers:{host:'suizamente.test','stripe-signature':stripe.webhooks.generateTestHeaderString({payload:untouchedPayload,secret:env.SUIZAMENTE_STRIPE_WEBHOOK_SECRET})}})
 Object.defineProperty(untouched,'body',{get(){throw new Error('Never access the Vercel JSON getter before verifying raw bytes')}})
 const verified={setHeader(){},end(value){this.body=JSON.parse(value)}};await liveHandler(untouched,verified);assert.equal(verified.statusCode,200)
 await assert.rejects(request(A,'negocios/alta',{...signup,plaza:'ZH-p2',metodo:'twint'}),/anual/)
 const annual=await request(B,'negocios/alta',{...signup,plaza:'ZH-p2',periodo:'ano',metodo:'tarjeta'})
 await request(B,'negocios/'+annual.id+'/pagos/tarjeta');let ac=await snapshot(annual.id);sessions[ac.sesion_setup].setup_intent='seti_annual';sessions[ac.sesion_setup].status='complete'
 stripe.paymentMethods.retrieve=async id=>({id,type:id==='pm_twint'?'twint':'card',customer:ac.cliente})
 await event('checkout.session.completed',sessions[ac.sesion_setup]);await request(C,'negocios/'+annual.id+'/aprobar');assert.equal(calls.filter(([n])=>n==='subscription').at(-1)[1].items[0].price,'price_plus_ano')
 const twint=await request(B,'negocios/alta',{...signup,plaza:'ZH-p3',periodo:'ano',metodo:'twint'})
 await request(C,'negocios/'+twint.id+'/aprobar');const tc=await snapshot(twint.id),ts=sessions[tc.sesion_pago]
 assert.equal(ts.mode,'payment');assert.equal(ts.payment_method_configuration,'pmc_twint');assert.equal(ts.invoice_creation.enabled,true)
 Object.assign(ts,{currency:'chf',amount_total:39000,invoice:'in_twint',payment_intent:'pi_twint',payment_status:'paid',status:'complete'})
 await event('checkout.session.completed',ts);await event('checkout.session.async_payment_succeeded',ts)
 assert.equal((await db.query('SELECT count(*)::int n FROM suizamente_private.negocio_pagos WHERE negocio=$1',[twint.id])).rows[0].n,1)
 await assert.rejects(invoke('suizamente_negocios_stripe',A,'guardar',{id,preparada:true}),/permission denied/)
 await db.exec("UPDATE suizamente_private.negocios_configuracion SET config=jsonb_set(config,'{cobroAutomatico}','false')")
 const before=calls.length;assert.equal((await payments.drain({...config,cobroAutomatico:false})).procesados,0);assert.equal(calls.length,before)
 console.log('PASS pagos: setup sin cobro, autorización, mensual/anual/TWINT, firma real SDK, duplicados, fallo/gracia, plan diferido, portal, baja, claves de prueba y apagado')
}finally{await db.close()}
