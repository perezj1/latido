import assert from 'node:assert/strict'
import {readFile,writeFile,copyFile,mkdir} from 'node:fs/promises'
import {resolve} from 'node:path'
const reference=resolve(process.argv[2]||'../../../latido/suizamente'),root=new URL('../../../',import.meta.url)
const read=async path=>JSON.parse(await readFile(path,'utf8')),bank=await read(reference+'/data/preguntas.json')
const old=await read('server/suizamente/data/preguntas.json'),byId=new Map(bank.preguntas.map(q=>[q.id,q]))
for(const q of old.preguntas){const next=byId.get(q.id);assert.ok(next,q.id);const omit=q=>Object.fromEntries(Object.entries(q).filter(([k])=>!['emoji','opciones'].includes(k)));assert.deepEqual(omit(q),omit(next));assert.deepEqual(q.opciones,next.opciones.slice(0,q.opciones.length));assert.ok(next.opciones.length===q.opciones.length||q.opciones.length===3&&next.opciones.length===4)}
for(const folder of [new URL('public/suizamente/data/',root),new URL('../server/suizamente/data/',import.meta.url)]){
 await mkdir(folder,{recursive:true});for(const name of ['preguntas.json','preguntas.schema.json'])await copyFile(reference+'/data/'+name,new URL(name,folder))
}
// Copy the supplied config, retaining the explicitly deployed raid/achievement rules.
const active=await read('server/suizamente/data/juego.json'),config=await read(reference+'/data/juego.json')
config.asaltos=active.asaltos;config.logros=active.logros
for(const path of ['server/suizamente/data/juego.json',new URL('public/suizamente/data/juego.json',root)])await writeFile(path,JSON.stringify(config,null,1)+'\n')
const sqlText=value=>"'"+JSON.stringify(value).replaceAll("'","''")+"'::jsonb"
const template=await readFile('supabase/suizamente_v21_cuatro_opciones.sql.in','utf8')
const dataSql=`
CREATE TEMP TABLE v21_bank(payload jsonb) ON COMMIT DROP;
INSERT INTO v21_bank SELECT value FROM jsonb_array_elements(${sqlText(bank.preguntas)});
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM v21_bank n LEFT JOIN suizamente_private.suizamente_preguntas p ON p.id=n.payload->>'id'
  WHERE p.id IS NULL OR p.payload-'emoji'-'opciones'<>n.payload-'emoji'-'opciones'
   OR jsonb_array_length(p.payload->'opciones')>jsonb_array_length(n.payload->'opciones')
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(p.payload->'opciones') WITH ORDINALITY o(v,i) WHERE v<>n.payload->'opciones'->(i::integer-1)))
 THEN RAISE EXCEPTION 'Bank differs beyond an appended option/question emoji. Update aborted to preserve vote indexes.';END IF;
END $$;
UPDATE suizamente_private.suizamente_preguntas p SET payload=jsonb_set(jsonb_set(p.payload,'{opciones}',n.payload->'opciones'),'{emoji}',n.payload->'emoji') FROM v21_bank n WHERE p.id=n.payload->>'id' AND p.payload IS DISTINCT FROM n.payload;
UPDATE suizamente_private.suizamente_configuracion SET juego=jsonb_set(juego,'{primeraVez}',${sqlText(config.primeraVez)}||jsonb_build_object('ejemplos',coalesce(juego#>'{primeraVez,ejemplos}','["voc_1s99qa8","v_j88frh","r_5vsvsx"]'::jsonb)));
DO $$ BEGIN IF to_regclass('public.suizamente_catalogo_votos') IS NOT NULL THEN
 INSERT INTO public.suizamente_catalogo_votos(pregunta_id,opciones) SELECT payload->>'id',jsonb_array_length(payload->'opciones') FROM v21_bank
 ON CONFLICT(pregunta_id) DO UPDATE SET opciones=excluded.opciones WHERE suizamente_catalogo_votos.opciones<=excluded.opciones;
END IF;END $$;
DO $$ BEGIN IF to_regclass('suizamente_social.preguntas') IS NOT NULL THEN
 IF EXISTS(SELECT 1 FROM suizamente_social.preguntas p JOIN v21_bank n ON p.id=n.payload->>'id' WHERE p.correcta IS DISTINCT FROM (n.payload->>'correcta')::smallint) THEN RAISE EXCEPTION 'Legacy answer indexes differ. Update aborted.';END IF;
 UPDATE suizamente_social.preguntas p SET opciones=jsonb_array_length(n.payload->'opciones') FROM v21_bank n WHERE p.id=n.payload->>'id' AND p.correcta IS NOT DISTINCT FROM (n.payload->>'correcta')::smallint;
END IF;END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
`
await writeFile('supabase/suizamente_v21_cuatro_opciones.sql',template+dataSql)
await writeFile(new URL('supabase/functions/_shared/suizamenteCatalogo.json',root),JSON.stringify(Object.fromEntries(bank.preguntas.map(q=>[q.id,q.opciones.length])),null,2)+'\n')
console.log('Copied reviewed bank/schema/config; generated append-only v21; retained deployed raid and achievement rules.')
