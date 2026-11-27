import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {negociosDatabase,negocioCall} from './lib/negocios-test-db.mjs'
import {call,profile,A} from './lib/suizamente-v2-test-db.mjs'
const read=async n=>JSON.parse(await readFile('server/suizamente/data/'+n+'.json','utf8')),game=await read('juego'),slots=await read('huecos'),catalog=await read('decoraciones'),geometry=JSON.parse(await readFile('public/suizamente-assets/mapa3d.json','utf8')),ids=new Set()
assert.equal(game.mapa.barraCanton,false);assert.equal(game.negocios.activo,false);assert.equal(game.negocios.cobroAutomatico,false)
for(const [canton,list]of Object.entries(slots)){
 for(const h of list){assert.ok(!ids.has(h.id));ids.add(h.id);assert.equal(h.id.split('-')[0],canton);assert.ok(Number.isFinite(h.dx)&&Number.isFinite(h.dz));assert.ok(['plaza','tierra','agua','aire'].includes(h.tipo))}
 assert.equal(list.filter(h=>h.tipo==='plaza').length,game.negocios.plazasPorCanton[canton]??game.negocios.plazasPorCanton.porDefecto);assert.equal(list.filter(h=>h.tipo==='tierra').length,6);assert.equal(list.filter(h=>h.tipo==='aire').length,1);assert.equal(list.filter(h=>h.tipo==='agua').length,geometry.cantones[canton].agua.length?1:0)
}
assert.equal(Object.keys(slots).length,26);assert.ok(catalog.huecos.every(h=>typeof h==='string'&&ids.has(h)));assert.equal(new Set(catalog.huecos).size,catalog.huecos.length)
for(const name of ['huecos3d.js','negocios3d.js'])assert.deepEqual(await readFile('public/suizamente-assets/'+name),await readFile('../../../latido/suizamente/disenos/'+name),'Supplied source is copied unchanged')
for(const type of ['restaurante','cafe','tienda','panaderia','peluqueria','escuela','oficina','foodtruck'])for(let color=0;color<6;color++){const name='neg-'+type+'-'+color+'.webp';assert.deepEqual(await readFile('public/suizamente-assets/negocios/'+name),await readFile('../../../latido/suizamente/disenos/negocios/'+name))}
const {db}=await negociosDatabase(false)
try{
 await call(db,A,'guardar_jugador',profile())
 await assert.rejects(negocioCall(db,A,'inicio'),/404/)
 // Re-create the old stored references and verify the additive remapping.
 await db.exec(await readFile('supabase/suizamente_v33_mejoras_datos.sql','utf8'))
 const old=(await db.query('SELECT decoraciones FROM suizamente_private.mejoras_configuracion')).rows[0].decoraciones
 const land=old.huecos.filter(h=>h.canton==='LU'&&h.tipo==='tierra').slice(0,2)
 await db.query('INSERT INTO suizamente_private.persona_decoraciones(persona,decoracion,vuelta,canton,hueco) VALUES($1,$2,1,$3,$4),($1,$5,1,$3,$6)',[A,'vacas','LU',land[0].id,'tren',land[1].id])
 await db.exec(await readFile('supabase/suizamente_v34_huecos.sql','utf8'))
 const moved=(await db.query('SELECT hueco FROM suizamente_private.persona_decoraciones WHERE persona=$1 ORDER BY decoracion',[A])).rows
 assert.equal(new Set(moved.map(r=>r.hueco)).size,2);assert.ok(moved.every(r=>slots.LU.some(h=>h.id===r.hueco&&h.tipo==='tierra')))
 await db.exec(await readFile('supabase/suizamente_v34_huecos.sql','utf8'));assert.deepEqual((await db.query('SELECT hueco FROM suizamente_private.persona_decoraciones WHERE persona=$1 ORDER BY decoracion',[A])).rows,moved,'Reapplying never moves a migrated decoration')
 const exposed=(await db.query("SELECT count(*)::int n FROM information_schema.role_table_grants WHERE grantee IN('authenticated','anon') AND table_schema='suizamente_private' AND (table_name LIKE 'negocio%' OR table_name='mapa_huecos')")).rows[0].n;assert.equal(exposed,0)
 console.log('26 cantons, stable typed references, original models and 48 thumbnails, safe legacy remapping/idempotency, OFF gate and private grants passed')
}finally{await db.close()}
