import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {database,call,profile,A,B,C,G} from './lib/suizamente-v2-test-db.mjs'
let db
try{
  db=await database({album:true})
  for(const [actor,name]of[[A,'Alex'],[B,'Lu'],[C,'Caro']])await call(db,actor,'guardar_jugador',profile(name))
  await call(db,A,'bienvenida')
  const album=await call(db,A,'album')
  assert.equal(album.colecciones.length,5)
  assert.ok(album.colecciones.every(c=>c.cartas.length===9&&c.cartas.every(k=>!k.conseguida&&!k.dato)))
  const distribution=(await db.query("SELECT rarity,count(*) n FROM(SELECT (suizamente_private.v6_carta()->>'r')::integer rarity FROM generate_series(1,6000)) samples GROUP BY rarity")).rows
  for(const {rarity,n}of distribution)assert.ok(Math.abs(Number(n)/6000-({1:.6,2:.3,3:.1}[rarity]))<.04)
  assert.equal(distribution.length,3)
  console.log('Album: five initial collections, private missing-card facts, server-only rarity sampling ≈60/30/10 passed.')
  const key=crypto.randomUUID()
  let pack=await call(db,A,'abrir_sobre',{clave:key,cartas:[{id:'inventada'}]})
  assert.equal(pack.total,3);assert.deepEqual(pack.cartas,[])
  assert.equal(pack.jugador.inventario.sobres,0)
  await assert.rejects(call(db,A,'abrir_sobre',{clave:key}),/409/)
  await assert.rejects(call(db,B,'sobre',{id:pack.id}),/404/)
  for(let i=0;i<3;i++){
    pack=await call(db,A,'girar_carta',{id:pack.id,indice:i})
    assert.equal(pack.cartas.length,i+1)
    await assert.rejects(call(db,A,'girar_carta',{id:pack.id,indice:i}),/409/)
  }
  await assert.rejects(call(db,A,'abrir_sobre',{clave:crypto.randomUUID()}),/409/)
  // Force an existing card on the server: the client never supplies the draw.
  const card=album.colecciones[0].cartas[0]
  const raw=JSON.parse(await readFile('server/suizamente/data/album.json','utf8')).colecciones[0]
  const sqlCard=JSON.stringify({...raw.cartas[0],coleccionId:0,coleccion:raw.nombre}).replaceAll("'","''")
  await db.exec("CREATE OR REPLACE FUNCTION suizamente_private.v6_carta() RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $$ SELECT '"+sqlCard+"'::jsonb $$")
  await db.query('INSERT INTO suizamente_private.suizamente_cartas(jugador_id,carta_id) SELECT $1,value->>\'id\' FROM jsonb_array_elements($2::jsonb) ON CONFLICT DO NOTHING',[A,JSON.stringify(raw.cartas.slice(1))])
  await db.query('DELETE FROM suizamente_private.suizamente_cartas WHERE jugador_id=$1 AND carta_id=$2',[A,card.id])
  await db.query("SELECT suizamente_private.v3_anotar($1,'fixture','sobres',0,0,'{\"sobres\":3,\"escudos\":3}')",[A])
  const before=(await call(db,A,'jugador')).jugador
  pack=await call(db,A,'abrir_sobre',{clave:crypto.randomUUID()})
  assert.equal(pack.jugador.monedas,before.monedas+200+10)
  assert.equal(pack.jugador.inventario.quita,before.inventario.quita+2)
  assert.equal(pack.jugador.inventario.escudos,3)
  assert.equal(pack.jugador.inventario.sobres,2)
  assert.ok((await call(db,A,'album')).colecciones[0].completa)
  await assert.rejects(call(db,A,'abrir_sobre',{clave:crypto.randomUUID()}),/409/)
  for(let i=0;i<3;i++)pack=await call(db,A,'girar_carta',{id:pack.id,indice:i})
  assert.deepEqual(pack.cartas.map(c=>c.nueva),[true,false,false])
  assert.deepEqual(pack.cartas.map(c=>c.monedas),[0,5,5])
  const coins=pack.jugador.monedas
  pack=await call(db,A,'abrir_sobre',{clave:crypto.randomUUID()})
  assert.equal(pack.jugador.monedas,coins+15)
  assert.equal(Number((await db.query("SELECT count(*) n FROM suizamente_private.suizamente_movimientos WHERE jugador_id=$1 AND motivo='coleccion' AND ref='0'",[A])).rows[0].n),1)
  for(let i=0;i<3;i++)pack=await call(db,A,'girar_carta',{id:pack.id,indice:i})
  let m=await call(db,A,'crear_partida',{rival:B})
  m=await call(db,B,'rendirse',{id:m.id,turnoN:m.turnoN})
  m=await call(db,A,'partida',{id:m.id})
  assert.ok(m.cofre?.id);assert.equal(m.cofre.abierto,false)
  const cash=m.jugador.monedas
  let chest=await call(db,A,'abrir_cofre',{id:m.cofre.id})
  assert.equal(chest.jugador.monedas,cash+80)
  assert.equal(chest.contenido.inventario.sobres,1)
  assert.equal(Object.entries(chest.contenido.inventario).filter(([k])=>!['sobres','escudos'].includes(k)).reduce((n,[,v])=>n+v,0),1)
  await assert.rejects(call(db,A,'abrir_cofre',{id:m.cofre.id}),/409/)
  await call(db,null,'guardar_jugador',profile('Invitado'))
  await call(db,null,'bienvenida')
  const guestPack=await call(db,null,'abrir_sobre',{clave:crypto.randomUUID()})
  await db.exec('DELETE FROM suizamente_private.suizamente_limites')
  await call(db,C,'vincular')
  assert.equal((await call(db,C,'sobre',{id:guestPack.id})).giradas,0)
  assert.ok((await call(db,C,'album')).colecciones[0].cartas.some(c=>c.conseguida))
  await db.query('INSERT INTO suizamente_private.suizamente_cartas(jugador_id,carta_id) SELECT $1,k->>\'id\' FROM jsonb_array_elements(suizamente_private.v6_colecciones()) c CROSS JOIN LATERAL jsonb_array_elements(c->\'cartas\') k ON CONFLICT DO NOTHING',[A])
  const allCoins=(await call(db,A,'jugador')).jugador.monedas
  await db.query('SELECT suizamente_private.v6_completar($1)',[A])
  assert.equal((await call(db,A,'jugador')).jugador.monedas,allCoins+300+400+500+600)
  assert.equal((await call(db,A,'logros')).logros.find(l=>l.id==='coleccionista').conseguido,true)
  await db.query('SELECT suizamente_private.v6_completar($1)',[A])
  assert.equal((await call(db,A,'jugador')).jugador.monedas,allCoins+300+400+500+600)
  await db.exec(await readFile('supabase/suizamente_v6_album.sql','utf8'))
  assert.equal((await call(db,A,'cofre',{id:m.cofre.id})).abierto,true)
  for(const role of ['anon','authenticated'])for(const table of ['suizamente_cartas','suizamente_sobres']){
    await assert.rejects(db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE '+role);return tx.query('SELECT * FROM suizamente_private.'+table)}),/permission denied/)
  }
  console.log('Packs/chests: one server draw/consumption, ordered persistent flips, duplicate cards +5, unique collection prize, capped shields, victory chest +80/random power-up, guest linking, repeatable SQL and RLS passed.')
}catch(e){console.error('Album:',e.message,e.where||'',e.internalQuery||'');process.exitCode=1}
finally{await db?.close()}
