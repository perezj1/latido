import {database} from './lib/suizamente-v2-test-db.mjs'
import {weeklyFixture} from './lib/suizamente-week-fixture.mjs'
let db
try{
 db=await database({progreso:true})
 const week=(await db.query('SELECT suizamente_private.v7_semana()::text w')).rows[0].w
 const {rows}=await weeklyFixture(db,week)
 await db.query("SELECT suizamente_private.v12_tick(($1::date+7)::timestamp AT TIME ZONE 'Europe/Zurich')",[week])
 const awards=(await db.query("SELECT jugador_id,monedas,inventario FROM suizamente_private.suizamente_movimientos WHERE motivo='liga' AND ref=$1",[week])).rows
 console.log('Simulación local aislada. Sin cuentas ni datos remotos. Semana: '+week)
 console.table(rows.filter(r=>[1,5,26,30].includes(r.puesto)).map(r=>({division:r.division,grupo:r.grupo,apodo:r.apodo,puesto:r.puesto,puntos:r.puntos,destino:r.destino,monedas:awards.find(a=>a.jugador_id===r.id)?.monedas||0,sobres:awards.find(a=>a.jugador_id===r.id)?.inventario.sobres||0})))
 await db.query("SELECT suizamente_private.v12_tick(($1::date+7)::timestamp AT TIME ZONE 'Europe/Zurich')",[week])
 const after=Number((await db.query("SELECT count(*) n FROM suizamente_private.suizamente_movimientos WHERE motivo='liga' AND ref=$1",[week])).rows[0].n)
 if(after!==awards.length)throw Error('La repetición cambió los premios')
 console.log('Cierre repetido: '+after+' recibos, sin pagos duplicados. La base temporal se elimina al salir.')
}finally{await db?.close()}
