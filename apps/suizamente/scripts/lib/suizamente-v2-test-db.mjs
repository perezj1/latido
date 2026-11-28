import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
export const A='11111111-1111-4111-8111-111111111111'
export const B='22222222-2222-4222-8222-222222222222'
export const C='33333333-3333-4333-8333-333333333333'
export const G='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
export const TOKEN='a'.repeat(64)
export async function database({economia=false,tienda=false,mapa=false,album=false,comunidad=false,admin=false,operaciones=false,duracion=false,progreso=false,produccion=false,cuentas=false,independiente=false,ataques=false,avatares=false,compartir=false,onboarding=false,cuatro=false,tres=false,carga=false,concurrencia=false,invitaciones=false,emparejamiento=false,engine}={}) {
  if(emparejamiento)invitaciones=true
  if(invitaciones)concurrencia=true
  if(concurrencia)carga=true
  if(carga)tres=true
  if(tres)cuatro=true
  if(cuatro)onboarding=true
  if(onboarding)compartir=true
  if(compartir)avatares=true
  if(avatares)ataques=true
  if(ataques)independiente=true
  if(independiente)cuentas=true
  if(cuentas)produccion=true
  if(produccion)progreso=true
  if(progreso)duracion=true
  if(duracion)operaciones=true
  if(operaciones)admin=true
  const db=engine||new PGlite({extensions:admin?{pg_trgm}:{}})
  try{
  await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$; GRANT USAGE ON SCHEMA public,auth TO anon,authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;")
  await db.query('INSERT INTO auth.users VALUES($1),($2),($3)',[A,B,C])
  await db.exec("CREATE TABLE public.profiles(id uuid PRIMARY KEY,banned boolean DEFAULT false); INSERT INTO public.profiles SELECT id,false FROM auth.users; CREATE TABLE public.app_notifications(id uuid DEFAULT gen_random_uuid(),recipient_id uuid,kind text CONSTRAINT app_notifications_kind_check CHECK(kind IN ('message')),source_id text,data jsonb,read_at timestamptz,created_at timestamptz DEFAULT now(),UNIQUE(recipient_id,kind,source_id));")
  await db.exec(await readFile('supabase/suizamente_v2.sql','utf8'))
  await db.exec(await readFile('supabase/suizamente_v2_datos.sql','utf8'))
  if(economia||tienda||mapa||album||comunidad||admin)await db.exec(await readFile('supabase/suizamente_v3_economia.sql','utf8'))
  if(tienda||mapa||album||comunidad||admin)await db.exec(await readFile('supabase/suizamente_v4_tienda_duelo.sql','utf8'))
  if(mapa||album||comunidad||admin)await db.exec(await readFile('supabase/suizamente_v5_mapa_asaltos.sql','utf8'))
  if(album||comunidad||admin)await db.exec(await readFile('supabase/suizamente_v6_album.sql','utf8'))
  if(comunidad||admin){await db.exec(await readFile('supabase/suizamente_v7_comunidad.sql','utf8'));await db.query('INSERT INTO suizamente_private.admins VALUES($1) ON CONFLICT DO NOTHING',[C])}
  if(admin)await db.exec(await readFile('supabase/suizamente_v9_admin.sql','utf8'))
  if(operaciones)await db.exec(await readFile('supabase/suizamente_v10_admin_operaciones.sql','utf8'))
  if(duracion)await db.exec(await readFile('supabase/suizamente_v11_duracion.sql','utf8'))
  if(progreso)await db.exec(await readFile('supabase/suizamente_v12_progreso.sql','utf8'))
  if(produccion)await db.exec(await readFile('supabase/suizamente_v13_produccion.sql','utf8'))
  if(cuentas)await db.exec(await readFile('supabase/suizamente_v14_cuentas.sql','utf8'))
  if(independiente){await db.exec('CREATE ROLE service_role BYPASSRLS');await db.exec(await readFile('supabase/suizamente_v15_independiente.sql','utf8'))}
  if(ataques)await db.exec(await readFile('supabase/suizamente_v17_ataques.sql','utf8'))
  if(avatares){await db.exec("ALTER TABLE public.profiles ADD COLUMN avatar_url text; ALTER TABLE auth.users ADD COLUMN raw_user_meta_data jsonb DEFAULT '{}';");await db.exec(await readFile('supabase/suizamente_v18_avatares.sql','utf8'))}
  if(compartir)await db.exec(await readFile('supabase/suizamente_v19_compartir.sql','utf8'))
  if(onboarding)await db.exec(await readFile('supabase/suizamente_v20_primera_vez.sql','utf8'))
  if(cuatro)await db.exec(await readFile('supabase/suizamente_v21_cuatro_opciones.sql','utf8'))
  if(tres)await db.exec(await readFile('supabase/suizamente_v22_onboarding_tres.sql','utf8'))
  if(carga)await db.exec(await readFile('supabase/suizamente_v23_carga.sql','utf8'))
  if(concurrencia)await db.exec(await readFile('supabase/suizamente_v24_concurrencia.sql','utf8'))
  if(invitaciones)await db.exec(await readFile('supabase/suizamente_v25_invitaciones_amigos.sql','utf8'))
  if(emparejamiento)await db.exec(await readFile('supabase/suizamente_v26_emparejamiento_asincrono.sql','utf8'))
  if(emparejamiento)await db.exec(await readFile('supabase/suizamente_v41_lecturas_rapidas.sql','utf8'))
  return db
  }catch(error){await db.close();throw error}
}
export async function call(db,actor,action,args={},guest=G,token=TOKEN) {
  return db.transaction(async tx=>{
    await tx.query("SELECT set_config('test.uid',$1,true)",[actor||''])
    await tx.exec('SET LOCAL ROLE '+(actor?'authenticated':'anon'))
    return (await tx.query('SELECT public.suizamente_v2($1,$2::jsonb,$3::uuid,$4) result',[action,JSON.stringify(args),guest,token])).rows[0].result
  })
}
export async function lecturaCall(db,actor,action,args={}){
 return db.transaction(async tx=>{
  await tx.query("SELECT set_config('test.uid',$1,true)",[actor||'']);await tx.exec('SET LOCAL ROLE '+(actor?'authenticated':'anon'))
  return(await tx.query('SELECT public.suizamente_lectura($1,$2::jsonb) result',[action,JSON.stringify(args)])).rows[0].result
 })
}
export function profile(name='Alex') {
  return {apodo:name,color:'menta',pais:'ES',canton:'ZH',anos_suiza:'1a3',ajustes:{}}
}
// Fixtures know the private bank's original answer. HTTP clients only see visual
// positions on new questions; legacy migration tests retain the old contract.
export async function callOriginal(db,actor,action,args={},guest=G,token=TOKEN){
  if(Number.isInteger(args.opcion)&&['respuesta','asalto_respuesta'].includes(action)){
    const raid=action==='asalto_respuesta',pid=actor||'invitado-'+guest
    const row=(await db.query(raid?
      "SELECT CASE WHEN coalesce((to_jsonb(q)->>'indices_visuales')::boolean,false) AND $3::smallint=ANY(q.orden) THEN array_position(q.orden,$3::smallint)-1 ELSE $3 END choice FROM suizamente_private.suizamente_asaltos q WHERE id=$1 AND jugador_id=$2":
      "SELECT CASE WHEN coalesce((to_jsonb(q)->>'indices_visuales')::boolean,false) AND $3::smallint=ANY(q.orden) THEN array_position(q.orden,$3::smallint)-1 ELSE $3 END choice FROM suizamente_private.suizamente_partida_preguntas q WHERE partida_id=$1 AND jugador_id=$2 AND n=$4",raid?[args.id,pid,args.opcion]:[args.id,pid,args.opcion,args.n])).rows[0]
    if(row)args={...args,opcion:row.choice}
  }
  return call(db,actor,action,args,guest,token)
}
export async function step(db,actor,m,correct=true,category) {
  if(m.fase==='girar')m=await call(db,actor,'girar',{id:m.id,turnoN:m.turnoN})
  m=await call(db,actor,'pregunta',{id:m.id,turnoN:m.turnoN,categoria:category||'idioma'})
  const q=(await db.query('SELECT payload FROM suizamente_private.suizamente_partida_preguntas WHERE partida_id=$1 AND n=$2',[m.id,m.pregunta.n])).rows[0].payload
  return callOriginal(db,actor,'respuesta',{id:m.id,turnoN:m.turnoN,n:m.pregunta.n,opcion:correct?q.correcta:(q.correcta+1)%q.opciones.length})
}
