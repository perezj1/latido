import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

export const SZ_ALICE='11111111-1111-4111-8111-111111111111'
export const SZ_BOB='22222222-2222-4222-8222-222222222222'
export const SZ_ADMIN='33333333-3333-4333-8333-333333333333'
export async function createSuizamenteDb({game=false}={}){
  const db=new PGlite()
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,raw_user_meta_data jsonb DEFAULT '{}');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
    CREATE TABLE public.profiles(id uuid PRIMARY KEY,banned boolean DEFAULT false,canton text);
    CREATE FUNCTION public.is_business_promotion_admin() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT auth.uid()='${SZ_ADMIN}'::uuid $$;
    GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated,service_role;
    INSERT INTO auth.users(id) VALUES('${SZ_ALICE}'),('${SZ_BOB}'),('${SZ_ADMIN}');
    UPDATE auth.users SET raw_user_meta_data='{"canton":"ZH"}' WHERE id='${SZ_ALICE}';
    UPDATE auth.users SET raw_user_meta_data='{"canton":"BE"}' WHERE id='${SZ_BOB}';
    INSERT INTO profiles(id,canton) SELECT id,raw_user_meta_data->>'canton' FROM auth.users;`)
  await db.exec(await readFile(new URL('../../supabase/suizamente.sql',import.meta.url),'utf8'))
  if(game)await db.exec(await readFile(new URL('../../supabase/suizamente_game.sql',import.meta.url),'utf8'))
  await db.exec(await readFile(new URL('../../supabase/suizamente_seed.sql',import.meta.url),'utf8'))
  return db
}
export async function szRpc(db,actor,action,args={}){
  return db.transaction(async tx=>{
    await tx.query("SELECT set_config('test.uid',$1,true)",[actor||''])
    await tx.exec(`SET LOCAL ROLE ${actor?'authenticated':'anon'}`)
    return (await tx.query('SELECT public.suizamente($1,$2::jsonb) result',[action,JSON.stringify(args)])).rows[0].result
  })
}
export async function szCorrectChoice(db,session){
  const row=(await db.query('SELECT option_orders FROM suizamente_private.sessions WHERE id=$1',[session.id])).rows[0]
  const q=(await db.query('SELECT payload FROM suizamente_private.versions WHERE id=$1',[session.question.version_id])).rows[0].payload
  return row.option_orders[session.question.version_id].indexOf(q.correct_index)
}
export async function finishSzSession(db,actor,session,{wrongAt=[]}={}){
  let s=session
  while(s.status==='active'){
    if(!s.answer){let choice=await szCorrectChoice(db,s);if(wrongAt.includes(s.position))choice=(choice+1)%4;s=await szRpc(db,actor,'answer',{session_id:s.id,position:s.position,choice})}
    if(s.status==='active')s=await szRpc(db,actor,'session',{id:s.id,advance:true})
  }
  return s
}
