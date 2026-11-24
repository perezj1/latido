// Disposable local game with real SQL in memory. Never uses remote credentials.
import {createServer,request} from 'node:http'
import {networkInterfaces} from 'node:os'
import {startSuizamentePreview} from './lib/suizamente-v2-preview.mjs'
import {A,B,call} from './lib/suizamente-v2-test-db.mjs'
const port=Number(process.env.SUIZAMENTE_PREVIEW_PORT||8080),host=process.env.SUIZAMENTE_PREVIEW_HOST||'127.0.0.2'
const preview=await startSuizamentePreview(port,{demo:true,host,hmr:false}),proxies=[]
// Make the two changed flows immediately reviewable without playing six seals.
const config=await call(preview.db,A,'config'),victory=await call(preview.db,A,'crear_partida',{rival:B})
await preview.db.query('UPDATE suizamente_private.suizamente_partidas SET sellos_a=$2 WHERE id=$1',[victory.id,config.categorias.map(category=>category.id)])
await preview.db.query("SELECT suizamente_private.v2_cerrar($1,$2,'sellos')",[victory.id,A])
await call(preview.db,A,'crear_partida',{rival:B})
console.log('Suizamente temporal: '+preview.origin)
console.log('Alex: '+preview.origin+'/__suizamente_qa?cuenta=alex')
console.log('Lu: '+preview.origin+'/__suizamente_qa?cuenta=lu')
if(process.argv.includes('--lan'))for(const [name,addresses] of Object.entries(networkInterfaces())){
 if(/WSL|Hyper-V|Virtual|VPN/i.test(name))continue
 for(const address of addresses||[])if(address.family==='IPv4'&&!address.internal&&/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address.address)){
  const proxy=createServer((req,res)=>{const upstream=request(new URL(req.url,preview.origin),{method:req.method,headers:req.headers},response=>{res.writeHead(response.statusCode,response.headers);response.pipe(res)});upstream.on('error',()=>{res.statusCode=502;res.end('Vista previa no disponible')});req.pipe(upstream)})
  await new Promise((resolve,reject)=>{proxy.once('error',reject);proxy.listen(port,address.address,resolve)});proxies.push(proxy)
  console.log('Misma Wi-Fi: http://'+address.address+':'+port+'/__suizamente_qa?cuenta=alex')
 }
}
const close=async()=>{for(const proxy of proxies)proxy.close();await preview.close();process.exit(0)}
process.on('SIGINT',close);process.on('SIGTERM',close)
