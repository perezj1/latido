// Public configuration only. Keep latency and region; never cookies, tokens or user data.
import {mkdir,writeFile} from 'node:fs/promises'
import {performance} from 'node:perf_hooks'
const origin='https://suizamente.latido.ch',samples=[]
for(let i=0;i<5;i++){
 const start=performance.now(),response=await fetch(origin+'/api/suizamente/config');await response.arrayBuffer()
 if(!response.ok)throw Error('Configuration HTTP '+response.status)
 samples.push({ms:Math.round(performance.now()-start),regions:response.headers.get('x-vercel-id')?.split('::').slice(0,-1)})
}
const result={origin,samples,medianMs:[...samples].sort((a,b)=>a.ms-b.ms)[2].ms}
await mkdir('output/velocidad',{recursive:true});await writeFile('output/velocidad/api-'+(process.argv[2]||'actual')+'.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2))
