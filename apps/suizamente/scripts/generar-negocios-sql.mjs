import {readFile,writeFile} from 'node:fs/promises'
import {resolverHuecos} from '../server/suizamente/huecos.mjs'
const read=async n=>JSON.parse(await readFile('server/suizamente/data/'+n+'.json','utf8')),quote=v=>"'"+JSON.stringify(v).replaceAll("'","''")+"'::jsonb",juego=await read('juego'),huecos=await read('huecos'),ajustes=await read('huecos-ajustes'),catalog=await read('decoraciones')
if(catalog.huecos.some(h=>typeof h!=='string')){catalog.huecos=Object.values(huecos).flat().filter(h=>h.tipo!=='plaza').map(h=>h.id);await writeFile('server/suizamente/data/decoraciones.json',JSON.stringify(catalog,null,2)+'\n')}
const resolved=resolverHuecos(catalog)
let sql='-- Generated slots: allocator input tuning approved by Latido. No geometry changes.\nBEGIN;\nCREATE TABLE IF NOT EXISTS suizamente_private.mapa_huecos(id text PRIMARY KEY,canton text NOT NULL,tipo text NOT NULL,datos jsonb NOT NULL);\n'
for(const [canton,slots]of Object.entries(huecos))for(const h of slots)sql+="INSERT INTO suizamente_private.mapa_huecos VALUES('"+h.id+"','"+canton+"','"+h.tipo+"',"+quote({...h,canton,ancla:'pueblo',dy:h.tipo==='aire'?3.4:0,escala:(h.tipo==='plaza'?.32:.23)*ajustes[canton].factor})+") ON CONFLICT(id) DO NOTHING;\n"
sql+=`-- Migrate placed objects to their nearest free slot of the same canton and type.
DO $$ DECLARE p record;slot text;BEGIN
 FOR p IN SELECT placed.*,h.value old FROM suizamente_private.persona_decoraciones placed JOIN suizamente_private.mejoras_configuracion c ON c.id LEFT JOIN LATERAL jsonb_array_elements(c.decoraciones->'huecos') h(value) ON h.value->>'id'=placed.hueco WHERE placed.hueco IS NOT NULL AND NOT EXISTS(SELECT 1 FROM suizamente_private.mapa_huecos WHERE id=placed.hueco) ORDER BY placed.persona,placed.desbloqueada LOOP
  SELECT h.id INTO slot FROM suizamente_private.mapa_huecos h WHERE h.canton=p.canton AND h.tipo=p.old->>'tipo' AND NOT EXISTS(SELECT 1 FROM suizamente_private.persona_decoraciones occupied WHERE occupied.persona=p.persona AND occupied.vuelta=p.vuelta AND occupied.hueco=h.id) ORDER BY power((h.datos->>'dx')::numeric-coalesce((p.old->>'dx')::numeric,0),2)+power((h.datos->>'dz')::numeric-coalesce((p.old->>'dz')::numeric,0),2),h.id LIMIT 1;
  IF slot IS NULL THEN RAISE EXCEPTION 'No free replacement slot for % / %',p.persona,p.decoracion;END IF;
  UPDATE suizamente_private.persona_decoraciones SET hueco=slot WHERE persona=p.persona AND decoracion=p.decoracion;
 END LOOP;
END $$;
`
sql+='UPDATE suizamente_private.mejoras_configuracion SET decoraciones=jsonb_set(decoraciones,\'{huecos}\','+quote(resolved.huecos)+');\nALTER TABLE suizamente_private.mapa_huecos ENABLE ROW LEVEL SECURITY;\nREVOKE ALL ON suizamente_private.mapa_huecos FROM PUBLIC,anon,authenticated;\nCOMMIT;\n'
await writeFile('supabase/suizamente_v34_huecos.sql',sql)
let seed='-- Prices approved by Latido; business examples are never seeded.\nBEGIN;\nINSERT INTO suizamente_private.negocios_configuracion(id,config,huecos) VALUES(true,'+quote(juego.negocios)+','+quote(huecos)+') ON CONFLICT(id) DO NOTHING;\n'
for(const p of (await read('postales')).localidades)seed+="INSERT INTO suizamente_private.negocio_postales VALUES("+[p.postal,p.ciudad,p.canton].map(s=>"'"+s.replaceAll("'","''")+"'").join(',')+") ON CONFLICT DO NOTHING;\n"
seed+=`CREATE OR REPLACE FUNCTION public.suizamente_negocios_mantenimiento() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT suizamente_private.neg_mantenimiento() $$;
REVOKE ALL ON FUNCTION public.suizamente_negocios_mantenimiento() FROM PUBLIC,anon,authenticated;
DO $$ BEGIN IF to_regprocedure('cron.schedule(text,text,text)') IS NOT NULL THEN IF NOT EXISTS(SELECT 1 FROM cron.job WHERE jobname='suizamente-negocios-mantenimiento') THEN PERFORM cron.schedule('suizamente-negocios-mantenimiento','* * * * *','SELECT public.suizamente_negocios_mantenimiento()');END IF;END IF;END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
`
await writeFile('supabase/suizamente_v36_negocios_datos.sql',seed)
console.log('Generated v34/v36: '+Object.keys(huecos).length+' cantons; '+resolved.huecos.length+' decoration references; no business content')
