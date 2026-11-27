import {startSuizamentePreview} from './lib/suizamente-v2-preview.mjs'
const preview=await startSuizamentePreview(Number(process.env.SUIZAMENTE_QA_PORT||5686),{demo:true,hmr:false,negocios:true})
console.log('Negocios · base temporal, sin datos de producción: '+preview.origin+'/__suizamente_qa?cuenta=alex')
console.log('Alex: alta y panel. Caro: administración. Lu, en otra ventana privada: ficha pública y mapa.')
console.log('Factura manual. Pago automático: próximamente disponible. Las condiciones de este entorno son solo de prueba.')
let closing=false;async function close(){if(closing)return;closing=true;await preview.close();process.exit(0)}
process.on('SIGINT',close);process.on('SIGTERM',close)
