import assert from 'node:assert/strict'
import {negociosDatabase,negocioCall,fixtureBusiness} from './lib/negocios-test-db.mjs'
import {call,profile,A,B,C} from './lib/suizamente-v2-test-db.mjs'
const {db}=await negociosDatabase()
try{
 for(const [id,name]of [[A,'Alex'],[B,'Lu'],[C,'Caro']])await call(db,id,'guardar_jugador',profile(name))
 const initial=await negocioCall(db,A,'inicio');assert.equal(initial.negocios.length,0)
 const signup={datos:fixtureBusiness,canton:'ZH',plaza:'ZH-p1',plan:'plus',periodo:'mes',condiciones:true}
 const {id}=await negocioCall(db,A,'alta',signup)
 await assert.rejects(negocioCall(db,B,'alta',signup),/409/)
 await assert.rejects(negocioCall(db,B,'panel',{id}),/403/)
 await assert.rejects(negocioCall(db,A,'aprobar',{id}),/403/)
 await negocioCall(db,C,'cambio',{id,mensaje:'Revisa la dirección'})
 await negocioCall(db,A,'editar',{id,datos:fixtureBusiness})
 await negocioCall(db,C,'aprobar',{id})
 assert.equal((await negocioCall(db,B,'inicio')).negocios.length,1)
 const published=await negocioCall(db,B,'ficha',{id});assert.ok(!JSON.stringify(published).includes('@suizamente.test'))
 await negocioCall(db,C,'pagada',{id,referencia:'QA-FACTURA-1'});await negocioCall(db,C,'pagada',{id,referencia:'QA-FACTURA-1'})
 assert.equal((await db.query('SELECT count(*)::int n FROM suizamente_private.negocio_pagos')).rows[0].n,1)
 await negocioCall(db,A,'editar',{id,datos:{...fixtureBusiness,nombre:'Café Cumbia nuevo'}})
 assert.equal((await negocioCall(db,B,'ficha',{id})).nombre,fixtureBusiness.nombre)
 const change=(await negocioCall(db,A,'panel',{id})).cambios[0]
 await negocioCall(db,C,'cambio_revisar',{id,cambio:change.id,decision:'aprobar'})
 assert.equal((await negocioCall(db,B,'ficha',{id})).nombre,'Café Cumbia nuevo')
 await negocioCall(db,B,'estadistica',{id,tipo:'vistas'});await negocioCall(db,B,'estadistica',{id,tipo:'vistas'})
 assert.equal((await negocioCall(db,A,'panel',{id})).stats.vistas,1)
 assert.equal((await negocioCall(db,A,'panel',{id})).stats.aciertos,null)
 // The design's question is a local fixture only, never a production seed.
 const mes=(await db.query("SELECT date_trunc('month',suizamente_private.neg_dia())::date::text m")).rows[0].m
 const question={pregunta:'¿Qué se lanzó en Suiza en 1938 porque a Brasil le sobraba café?',opciones:['El café descafeinado','El filtro de papel','El café soluble','La cafetera italiana'],correcta:2,categoria:'comida',dato:'Brasil tenía tanto café sin vender que pidió ayuda a una empresa suiza. Tras años de pruebas, en 1938 salió el café soluble: solo había que añadir agua caliente.',fuente:'https://suizamente.test/fuente-del-ejemplo'}
 await negocioCall(db,A,'pregunta_guardar',{id,mes,pregunta:question})
 const qid=(await negocioCall(db,A,'panel',{id})).preguntas[0].id
 await negocioCall(db,C,'pregunta_revisar',{id,pregunta:qid,decision:'aprobar'})
 const match=await call(db,A,'crear_partida',{rival:B})
 const matchBefore=(await db.query('SELECT to_jsonb(m) value FROM suizamente_private.suizamente_partidas m WHERE id=$1',[match.id])).rows[0].value
 const issued=await negocioCall(db,A,'pregunta',{partida:match.id});assert.ok(issued.pregunta);assert.ok(!JSON.stringify(issued).includes('correcta'));assert.ok(!JSON.stringify(issued).includes(question.dato));assert.ok(!JSON.stringify(issued).includes(question.fuente))
 assert.equal((await negocioCall(db,B,'pregunta',{partida:match.id})).pregunta,null)
 await assert.rejects(negocioCall(db,B,'pregunta_responder',{partida:match.id,opcion:2}),/409/)
 assert.equal((await negocioCall(db,A,'pregunta_responder',{partida:match.id,opcion:2})).ok,true)
 await negocioCall(db,A,'pregunta_responder',{partida:match.id,opcion:0})
 assert.equal((await negocioCall(db,A,'panel',{id})).stats.respuestas,1)
 assert.deepEqual((await db.query('SELECT to_jsonb(m) value FROM suizamente_private.suizamente_partidas m WHERE id=$1',[match.id])).rows[0].value,matchBefore,'Sponsored question never changes a turn, score, stamps or wheel')
 const late=await call(db,B,'crear_partida',{rival:A});await negocioCall(db,B,'pregunta',{partida:late.id})
 await db.query("UPDATE suizamente_private.negocio_preguntas_temporales SET limite=clock_timestamp()-interval '1 minute' WHERE partida=$1",[late.id]);assert.equal((await negocioCall(db,B,'pregunta_responder',{partida:late.id,opcion:2})).ok,false)
 await db.query('UPDATE suizamente_private.negocio_stats SET respuestas=19,aciertos=10 WHERE negocio=$1',[id]);assert.equal((await negocioCall(db,A,'panel',{id})).stats.aciertos,null)
 await db.query('UPDATE suizamente_private.negocio_stats SET respuestas=20,aciertos=10 WHERE negocio=$1',[id]);assert.equal((await negocioCall(db,A,'panel',{id})).stats.aciertos,50)
 await db.exec("UPDATE suizamente_private.negocio_temporales SET fecha=fecha-1;UPDATE suizamente_private.negocio_dias SET fecha=fecha-1;UPDATE suizamente_private.negocio_preguntas_temporales SET fecha=fecha-1")
 await negocioCall(db,A,'inicio');assert.equal((await db.query('SELECT count(*)::int n FROM suizamente_private.negocio_temporales')).rows[0].n,0)
 assert.equal((await negocioCall(db,A,'pregunta',{partida:match.id})).pregunta,null,'Daily lease deletion cannot bypass the per-match limit')
 await assert.rejects(negocioCall(db,A,'alta',{...signup,plaza:'ZH-p2',metodo:'tarjeta'}),/503/,'Automatic payment stays unavailable while postponed')
 const second=(await negocioCall(db,B,'alta',{...signup,plaza:'ZH-p2',plan:'mapa'})).id
 await negocioCall(db,C,'aprobar',{id:second})
 await db.query("UPDATE suizamente_private.negocios SET aprobado=clock_timestamp()-make_interval(days=>(SELECT (config->>'graciaImpagoDias')::integer+1 FROM suizamente_private.negocios_configuracion)),impago_desde=clock_timestamp()-make_interval(days=>(SELECT (config->>'graciaImpagoDias')::integer+1 FROM suizamente_private.negocios_configuracion)) WHERE id=$1",[second])
 assert.equal((await negocioCall(db,B,'panel',{id:second})).visible,false)
 await assert.rejects(negocioCall(db,C,'pagada',{id:second,referencia:'QA-FACTURA-1'}),/409/)
 await negocioCall(db,C,'pagada',{id:second,referencia:'QA-FACTURA-2'})
 assert.equal((await negocioCall(db,B,'panel',{id:second})).visible,true)
 await negocioCall(db,C,'plazas',{canton:'ZH',cantidad:2})
 await assert.rejects(negocioCall(db,B,'alta',{...signup,plaza:'ZH-p3'}),/409/)
 await negocioCall(db,B,'espera',{canton:'ZH'});await negocioCall(db,B,'espera',{canton:'ZH'})
 assert.equal((await db.query('SELECT count(*)::int n FROM suizamente_private.negocio_espera')).rows[0].n,1)
 await negocioCall(db,B,'baja',{id:second});await db.query("UPDATE suizamente_private.negocios SET activo_hasta=clock_timestamp()-interval '1 second' WHERE id=$1",[second]);await negocioCall(db,B,'inicio')
 const before=(await db.query('SELECT sum(monedas) total FROM suizamente_private.suizamente_movimientos')).rows
 await negocioCall(db,A,'baja',{id})
 assert.equal((await negocioCall(db,B,'inicio')).negocios.length,1)
 await db.query("UPDATE suizamente_private.negocios SET activo_hasta=clock_timestamp()-interval '1 second' WHERE id=$1",[id])
 assert.equal((await negocioCall(db,B,'inicio')).negocios.length,0)
 assert.ok(!(await negocioCall(db,B,'inicio')).ocupadas.includes('ZH-p1'))
 assert.deepEqual((await db.query('SELECT sum(monedas) total FROM suizamente_private.suizamente_movimientos')).rows,before)
 await db.exec("UPDATE suizamente_private.negocios_configuracion SET config=jsonb_set(config,'{activo}','false')")
 await assert.rejects(negocioCall(db,A,'inicio'),/404/)
 console.log('Negocios: approval/change, plaza uniqueness, owner/admin privacy, manual payment idempotency, anonymous daily stats, cancellation, economy unchanged and flag OFF passed')
}finally{await db.close()}
