import {startSuizamentePreview} from './lib/suizamente-v2-preview.mjs'
import {A,B,C} from './lib/suizamente-v2-test-db.mjs'
const port=Number(process.env.SUIZAMENTE_QA_PORT||5678),preview=await startSuizamentePreview(port,{demo:true,hmr:false,mejoras:true})
for(const friend of [B,C])await preview.db.query("INSERT INTO suizamente_private.suizamente_amigos(seguidor,seguido,estado) VALUES($1,$2,'aceptado'),($2,$1,'aceptado') ON CONFLICT DO NOTHING",[A,friend])
await preview.db.query("INSERT INTO suizamente_private.suizamente_mapa(jugador_id,vuelta,canton,nivel) VALUES($1,1,'LU',3) ON CONFLICT DO NOTHING",[A])
console.log('Mejoras · cuentas y PostgreSQL temporales: '+preview.origin+'/__suizamente_qa?cuenta=alex')
console.log('Usa Lu en otra ventana privada para jugar un reto. Los datos desaparecen al cerrar este servidor.')
console.log('Misterio permanece oculto: aún no hay contenido aprobado. Las pruebas automatizadas usan el ejemplo comentado solo como fixture.')
let closing=false
async function close(){if(closing)return;closing=true;await preview.close();process.exit(0)}
process.on('SIGINT',close);process.on('SIGTERM',close)
