import {startSuizamentePreview} from './lib/suizamente-v2-preview.mjs'
const args=process.argv.slice(2),value=(key,fallback)=>args.includes(key)?args[args.indexOf(key)+1]:fallback
const preview=await startSuizamentePreview(Number(value('--port',5265)),{demo:args.includes('--demo'),host:value('--host','127.0.0.1')})
console.log('Suizamente QA local: '+preview.origin+'/suizamente')
console.log('Base temporal en memoria. No usa cuentas ni datos remotos.')
console.log('Alex: '+preview.origin+'/__suizamente_qa?cuenta=alex')
console.log('Lu (otra ventana privada): '+preview.origin+'/__suizamente_qa?cuenta=lu')
console.log('Caro (administración): '+preview.origin+'/__suizamente_qa?cuenta=caro')
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,async()=>{await preview.close();process.exit(0)})
