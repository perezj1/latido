import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {negociosDatabase,negocioCall,fixtureBusiness,cobroCall} from './lib/negocios-test-db.mjs'
import {call,profile,A,B,C} from './lib/suizamente-v2-test-db.mjs'
const {db}=await negociosDatabase(true,false,{payments:true,gratis:true})
try{
 for(const [id,name]of [[A,'Alex'],[B,'Lu'],[C,'Caro']])await call(db,id,'guardar_jugador',profile(name))
 await db.exec('UPDATE suizamente_private.negocios_configuracion SET condiciones_url=NULL')
 const balance=(await db.query('SELECT jugador_id,monedas,xp,inventario FROM suizamente_private.suizamente_jugadores ORDER BY jugador_id')).rows
 const data={...fixtureBusiness,telefono:'079 123 45 67',email:'',oferta:null},args={datos:data,canton:'ZH',plaza:'ZH-p1',condiciones:true,plan:'plus',periodo:'mes',metodo:'tarjeta'}
 assert.equal((await db.query("SELECT suizamente_private.neg_config()->>'cobroAutomatico' a")).rows[0].a,'false','Free publication overrides automatic charging')
 await assert.rejects(negocioCall(db,null,'alta',args),/permission denied|401/)
 await assert.rejects(negocioCall(db,A,'alta',{...args,condiciones:false}),/400/)
 await assert.rejects(negocioCall(db,A,'alta',{...args,canton:'LU'}),/400/)
 await assert.rejects(negocioCall(db,A,'alta',{...args,datos:{...data,telefono:'',web:'',whatsapp:'',instagram:''}}),/400/)
 const {id}=await negocioCall(db,A,'alta',args),panel=await negocioCall(db,A,'panel',{id})
 assert.equal(panel.negocio.alta_gratuita,true);assert.equal(panel.negocio.plan,'mapa');assert.equal(panel.negocio.datos.email,'');assert.equal(panel.negocio.datos.telefono,'+41791234567');assert.equal(panel.negocio.condiciones_version,'alta-gratuita-v1');assert.equal(panel.hueco.id,'ZH-p1')
 assert.equal((await negocioCall(db,B,'inicio')).negocios.length,0,'Unreviewed business is private')
 await assert.rejects(negocioCall(db,B,'alta',args),/409/);await assert.rejects(negocioCall(db,B,'panel',{id}),/403/);await assert.rejects(negocioCall(db,A,'aprobar',{id}),/403/)
 await negocioCall(db,C,'cambio',{id,mensaje:'Revisa el contacto'});await negocioCall(db,A,'editar',{id,datos:{...data,email:'contacto@negocio.test'}});await negocioCall(db,C,'aprobar',{id})
 let published=await negocioCall(db,B,'ficha',{id});assert.equal(published.telefono,'+41791234567');assert.ok(!JSON.stringify(published).includes('contacto@'))
 await db.query("UPDATE suizamente_private.negocios SET aprobado=clock_timestamp()-interval '2 years',impago_desde=clock_timestamp()-interval '2 years' WHERE id=$1",[id]);assert.equal((await negocioCall(db,B,'inicio')).negocios.length,1,'Free business never disappears for nonpayment')
 for(const action of ['pagada','plan'])await assert.rejects(negocioCall(db,C,action,{id,referencia:'NO-CHARGE',plan:'plus',periodo:'ano'}),/409/)
 await assert.rejects(cobroCall(db,A,'preparar',{id}),/404/)
 for(const table of ['negocio_pagos','negocio_cobros','negocio_cobro_trabajos'])assert.equal((await db.query('SELECT count(*) n FROM suizamente_private.'+table)).rows[0].n,0,table+': no invoice, setup or charge created')
 assert.deepEqual((await db.query('SELECT jugador_id,monedas,xp,inventario FROM suizamente_private.suizamente_jugadores ORDER BY jugador_id')).rows,balance,'No game advantage or wallet change')
 await negocioCall(db,C,'plazas',{canton:'ZH',cantidad:1});await assert.rejects(negocioCall(db,B,'alta',{...args,plaza:'ZH-p2'}),/409/);await negocioCall(db,B,'espera',{canton:'ZH'});await negocioCall(db,B,'espera',{canton:'ZH'});assert.equal((await db.query('SELECT count(*) n FROM suizamente_private.negocio_espera')).rows[0].n,1)
 await db.exec("UPDATE suizamente_private.negocios_configuracion SET config=jsonb_set(jsonb_set(config,'{gratis}','false'),'{cobroAutomatico}','false')")
 assert.equal((await negocioCall(db,B,'inicio')).negocios.length,1,'Disabling new free signups does not enroll existing businesses into billing')
 await assert.rejects(negocioCall(db,B,'alta',{...args,datos:fixtureBusiness,plaza:'ZH-p2',metodo:'factura'}),/condiciones/)
 await db.exec("UPDATE suizamente_private.negocios_configuracion SET condiciones_url='https://negocio.test/condiciones'")
 await negocioCall(db,C,'plazas',{canton:'ZH',cantidad:2})
 const paid=await negocioCall(db,B,'alta',{...args,datos:fixtureBusiness,plaza:'ZH-p2',metodo:'factura'});await negocioCall(db,C,'aprobar',{id:paid.id});await negocioCall(db,C,'pagada',{id:paid.id,referencia:'LEGACY-INVOICE'})
 assert.equal((await negocioCall(db,B,'panel',{id:paid.id})).pagos.length,1,'Original paid workflow is restored by the flag')
 await negocioCall(db,A,'editar',{id,datos:data});await negocioCall(db,A,'baja',{id});assert.ok(!(await negocioCall(db,B,'inicio')).ocupadas.includes('ZH-p1'),'Free withdrawal immediately releases its slot')
 await db.exec(await readFile('supabase/suizamente_v44_negocios_gratis.sql','utf8'))
 assert.equal((await negocioCall(db,B,'panel',{id:paid.id})).pagos.length,1,'Reinstall preserves historical payments')
 console.log('PASS: free two-step data, postal and slot validation, moderation, private email/public phone, no expiry or charges, capacity/waitlist, immediate withdrawal, paid rollback and idempotent migration')
}catch(e){console.error(e.message,e.where||'');process.exitCode=1}finally{await db.close()}
