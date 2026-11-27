import {readFile} from 'node:fs/promises'
import {mejorasDatabase} from './mejoras-test-db.mjs'
export async function negociosDatabase(active=true){
 const extra=await mejorasDatabase(false),db=extra.db
 try{
  for(const n of ['34_huecos','35_negocios','36_negocios_datos'])await db.exec(await readFile('supabase/suizamente_v'+n+'.sql','utf8'))
  await db.query("UPDATE suizamente_private.negocios_configuracion SET config=jsonb_set(config,'{activo}',$1::jsonb),condiciones_url='https://suizamente.test/condiciones-negocios'",[JSON.stringify(active)])
  return extra
 }catch(e){await db.close();throw e}
}
export async function negocioCall(db,actor,action,args={}){
 return db.transaction(async tx=>{await tx.query("SELECT set_config('test.uid',$1,true)",[actor||'']);await tx.exec('SET LOCAL ROLE '+(actor?'authenticated':'anon'));return(await tx.query('SELECT public.suizamente_negocios($1,$2::jsonb) result',[action,JSON.stringify(args)])).rows[0].result})
}
// Only in disposable QA. Design fixtures are never part of production seed data.
export const fixtureBusiness={nombre:'Café Cumbia',tipo:'cafe',color:'#24E2C9',descripcion:'Café de origen y arepas para desayunar, en el centro de Zúrich.',direccion:'Ejemplostrasse 12',postal:'8004',ciudad:'Zürich',email:'facturas@suizamente.test',web:'https://www.ejemplo.ch',instagram:'',whatsapp:'',horario:Array.from({length:7},(_,i)=>i<5?{desde:'07:30',hasta:'19:00'}:i===5?{desde:'09:00',hasta:'17:00'}:null),oferta:{texto:'−10 % en tu primer café',codigo:'SUIZA10',condiciones:'Enséñalo al pagar'}}
export const fixtureQuestion={pregunta:'¿Qué se lanzó en Suiza en 1938 porque a Brasil le sobraba café?',opciones:['El café descafeinado','El filtro de papel','El café soluble','La cafetera italiana'],correcta:2,categoria:'comida',dato:'Brasil tenía tanto café sin vender que pidió ayuda a una empresa suiza. Tras años de pruebas, en 1938 salió el café soluble: solo había que añadir agua caliente.',fuente:'https://suizamente.test/fuente-del-ejemplo'}
