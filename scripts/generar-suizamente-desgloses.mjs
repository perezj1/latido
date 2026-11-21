import {readFile,writeFile} from 'node:fs/promises'
import {perfilesDemo,repartoDemo} from '../public/suizamente/demostracion.js'

const quote=value=>"'"+String(value).replaceAll("'","''")+"'"
const strip=sql=>sql.replace(/^BEGIN;\s*$/gm,'').replace(/^COMMIT;\s*$/gm,'')
const {preguntas}=JSON.parse(await readFile('public/suizamente/data/preguntas.json','utf8'))
const profiles=perfilesDemo().sort((a,b)=>Number(a.id.slice(5))-Number(b.id.slice(5)))
const values=profiles.map(p=>'('+[p.id,p.apodo,p.canton,p.pais,p.anosSuiza].map(quote).join(',')+','+p.puntos+')').join(',\n')
const counts=preguntas.map(q=>{
  const {n}=repartoDemo(q,[])
  return '('+quote(q.id)+',ARRAY['+[n[0],n[1],n[2]||0].join(',')+'])'
}).join(',\n')
const base=strip(await readFile('supabase/suizamente-social/05-demostracion-base.sql','utf8'))
const seed=base+`\nINSERT INTO suizamente_social.demo_perfiles(id,apodo,canton,pais,anos_suiza,puntos) VALUES\n${values}\nON CONFLICT(id) DO UPDATE SET apodo=excluded.apodo,canton=excluded.canton,pais=excluded.pais,anos_suiza=excluded.anos_suiza,puntos=excluded.puntos;\n\nINSERT INTO suizamente_social.demo_repartos(pregunta,conteos) VALUES\n${counts}\nON CONFLICT(pregunta) DO UPDATE SET conteos=excluded.conteos;\n`
await writeFile('supabase/suizamente-social/05-demostracion.sql','-- Generado por scripts/generar-suizamente-desgloses.mjs.\nBEGIN;\n'+seed+'\nCOMMIT;\n')
const api=strip(await readFile('supabase/suizamente-social/04-api.sql','utf8'))
const guard=`DO $preflight$ BEGIN
  IF to_regclass('suizamente_social.jugadores') IS NULL OR to_regclass('public.suizamente_votos') IS NULL
    OR to_regprocedure('public.suizamente_social_api(text,text,jsonb,text)') IS NULL THEN
    RAISE EXCEPTION 'Falta la instalación social de Suizamente. Ejecuta suizamente_social_instalar.sql antes de este añadido.';
  END IF;
END $preflight$;`
await writeFile('supabase/suizamente_desgloses_ejemplo.sql',`-- Ejecutar COMPLETO en Supabase SQL Editor del proyecto de Latido.
-- Añade país y años a los mismos 320 perfiles de ejemplo del juego.
-- Repetible. No crea cuentas de Auth ni añade votos, puntos o rankings reales.
-- Los repartos de ejemplo conservan sus totales actuales y su procedencia.
BEGIN;\n${guard}\n${seed}\n${api}\nCOMMIT;\n`)
console.log(`Desgloses: ${profiles.length} perfiles, ${preguntas.length} repartos; SQL de actualización e instalación generados.`)
