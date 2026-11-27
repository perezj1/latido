import {readFile,writeFile} from 'node:fs/promises'
import {resolverHuecos} from '../server/suizamente/huecos.mjs'
const read=async name=>JSON.parse(await readFile('server/suizamente/data/'+name+'.json','utf8')),quote=value=>"'"+JSON.stringify(value).replaceAll("'","''")+"'::jsonb"
const config=(await read('juego')).mejoras,catalog=await read('decoraciones'),references=typeof catalog.huecos[0]==='string',decorations=references?resolverHuecos(catalog):catalog,mysteries=await read('misterios')
let sql='-- Generated from the new, private data files. Existing configuration/banks are untouched.\nBEGIN;\n'
sql+='INSERT INTO suizamente_private.mejoras_configuracion(id,mejoras,decoraciones) VALUES(true,'+quote(config)+','+quote(decorations)+') ON CONFLICT(id) DO UPDATE SET mejoras=excluded.mejoras,decoraciones=excluded.decoraciones;\n'
for(const m of mysteries.misterios)sql+="INSERT INTO suizamente_private.misterios(fecha,payload) VALUES('"+m.fecha+"',"+quote(m)+') ON CONFLICT(fecha) DO NOTHING;\n'
sql+="-- New independent job only when pg_cron is already available. No existing job is modified.\nDO $$ BEGIN\n IF to_regprocedure('cron.schedule(text,text,text)') IS NOT NULL THEN\n  IF NOT EXISTS(SELECT 1 FROM cron.job WHERE jobname='suizamente-mejoras-avisos') THEN\n   PERFORM cron.schedule('suizamente-mejoras-avisos','* * * * *','SELECT public.suizamente_mejoras_avisos()');\n  END IF;\n END IF;\nEND $$;\nNOTIFY pgrst,'reload schema';\nCOMMIT;\n"
// Published migrations stay immutable after switching to the new shared slot ids.
const output=references?'supabase/suizamente_mejoras_datos_actualizar.sql':'supabase/suizamente_v33_mejoras_datos.sql'
await writeFile(output,sql);console.log('Generated '+output+': '+mysteries.misterios.length+' approved mysteries; '+decorations.huecos.length+' authored slots; feature flags preserved from data/juego.json')
