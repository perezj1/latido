import { readFile, writeFile } from 'node:fs/promises'
const data=JSON.parse(await readFile('public/suizamente/data/preguntas.json','utf8')).preguntas
const quote=value=>value===null?'NULL':"'"+String(value).replaceAll("'","''")+"'"
const rows=data.map(q=>`(${[q.id,q.tipo,q.tema].map(quote).join(',')},${q.correcta??'NULL'},${q.opciones.length})`)
const sql='-- Generado desde el banco publicado; no modifica IDs ni opciones.\nBEGIN;\nINSERT INTO suizamente_social.preguntas(id,tipo,tema,correcta,opciones) VALUES\n'+rows.join(',\n')+'\nON CONFLICT (id) DO NOTHING;\nCOMMIT;\n'
await writeFile('supabase/suizamente-social/02-catalogo.sql',sql)
const parts=await Promise.all(['01-estructura','02-catalogo','03-funciones','04-api'].map(async name=>'-- '+name+'\n'+(await readFile('supabase/suizamente-social/'+name+'.sql','utf8')).replace(/^BEGIN;\s*$/gm,'').replace(/^COMMIT;\s*$/gm,'')))
await writeFile('supabase/suizamente_social_instalar.sql','-- Suizamente social: ejecutar completo en Supabase SQL Editor.\n-- Instalación aditiva e idempotente. Conserva votos y datos existentes.\nBEGIN;\n'+parts.join('\n')+'\nCOMMIT;\n')
console.log(`Catálogo social: ${data.length} preguntas; respuestas calculadas en servidor.`)
