import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {dirname} from 'node:path'
const records=JSON.parse(await readFile('server/suizamente/data/misterios.json','utf8')).misterios
let sql='-- Generated from the approved editorial calendar; no game configuration changes.\nBEGIN;\n'
for(const m of records){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(m.fecha)||m.pistas.length!==3||m.pistas.some(p=>!p||p.includes('pendiente de Latido'))||m.opciones.length!==4||!Number.isInteger(m.correcta)||m.correcta<0||m.correcta>3)throw Error('Validate the editorial source before publishing')
 sql+="INSERT INTO suizamente_private.misterios(fecha,payload) VALUES('"+m.fecha+"','"+JSON.stringify(m).replaceAll("'","''")+"'::jsonb) ON CONFLICT(fecha) DO NOTHING;\n"
}
sql+='COMMIT;\n'
const target=process.argv.includes('--salida')?process.argv[process.argv.indexOf('--salida')+1]:'output/misterios/publicar.sql'
const previous=await readFile(target,'utf8').catch(e=>{if(e.code!=='ENOENT')throw e;return null})
if(previous!==null&&previous!==sql)throw Error('Refusing to overwrite a different publication; choose a new --salida')
await mkdir(dirname(target),{recursive:true});await writeFile(target,sql);console.log(records.length+' editorial mysteries: '+target)
