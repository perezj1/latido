import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {database,call,profile,A,B} from './lib/suizamente-v2-test-db.mjs'
const db=await database({compartir:true})
try{
 for(const [id,name] of [[A,'Alex'],[B,'Lu']]){await call(db,id,'guardar_jugador',profile(name));await call(db,id,'bienvenida')}
 const col=(await db.query('SELECT suizamente_private.v6_colecciones() cols')).rows[0].cols[0],rare=col.cartas.find(c=>c.r===3),payload={...rare,coleccion:col.nombre,coleccionId:col.id}
 await db.query('INSERT INTO suizamente_private.suizamente_cartas(jugador_id,carta_id) SELECT $1,k->>\'id\' FROM jsonb_array_elements($2::jsonb) k WHERE k->>\'id\'<>$3',[A,JSON.stringify(col.cartas),rare.id])
 await db.query("SELECT suizamente_private.v3_anotar($1,'fixture','sharing',0,0,'{\"sobres\":2,\"escudos\":3}')",[A])
 await db.exec("CREATE OR REPLACE FUNCTION suizamente_private.v6_carta() RETURNS jsonb LANGUAGE sql AS $$ SELECT '"+JSON.stringify(payload).replaceAll("'","''")+"'::jsonb $$")
 const pack=await call(db,A,'abrir_sobre',{clave:crypto.randomUUID()})
 assert.equal(pack.coleccionesCompletadas.length,1);const completed=pack.coleccionesCompletadas[0]
 assert.equal(completed.nombre,col.nombre);assert.equal(completed.cartas.length,col.cartas.length);assert.equal(completed.premioEntregado.monedas,col.premio.monedas);assert.equal(completed.premioEntregado.inventario.escudos,0,'Only delivered shields are presented')
 const balance=(await call(db,A,'jugador')).jugador.monedas
 for(let i=0;i<pack.total;i++)await call(db,A,'girar_carta',{id:pack.id,indice:i})
 const saved=await call(db,A,'sobre',{id:pack.id});assert.deepEqual(saved.coleccionesCompletadas,pack.coleccionesCompletadas);assert.equal((await call(db,A,'jugador')).jugador.monedas,balance)
 await assert.rejects(call(db,B,'sobre',{id:pack.id}),/404/)
 const next=await call(db,A,'abrir_sobre',{clave:crypto.randomUUID()});assert.deepEqual(next.coleccionesCompletadas,[],'A later pack cannot celebrate an already paid collection')
 await db.exec(await readFile('supabase/suizamente_v19_compartir.sql','utf8'));assert.deepEqual((await call(db,A,'sobre',{id:pack.id})).coleccionesCompletadas,pack.coleccionesCompletadas)
 await assert.rejects(db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE anon');await tx.query('SELECT suizamente_private.v19_album_base($1,$2,$3)',['album',A,{}])}),e=>e.code==='42501')
 console.log('Sharing SQL: exact collection and delivered reward, immutable pack snapshot, no duplicate award, owner-only reads, private helpers and repeat migration passed.')
}finally{await db.close()}
