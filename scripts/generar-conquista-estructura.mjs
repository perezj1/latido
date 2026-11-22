import {readFile,writeFile} from 'node:fs/promises'
const names=['01-estructura','02-funciones','03-api','04-cantones','05-integridad']
const parts=await Promise.all(names.map(n=>readFile('supabase/suizamente-conquista/'+n+'.sql','utf8')))
const sql='-- Public schema only. The live question bank and answer keys are private.\nBEGIN;\n'+parts.join('\n')+"\nNOTIFY pgrst,'reload schema';\nCOMMIT;\n"
await writeFile('supabase/suizamente_conquista_estructura.sql',sql)
console.log('Conquista schema generated without production questions or answers.')
