import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { createSuizamenteSocialHttp } from '../../../supabase/functions/_shared/suizamenteSocialHttp.js'
import { createSuizamenteHttp,suizamenteAllowedOrigin } from '../../../supabase/functions/_shared/suizamenteHttp.js'
export const alice='11111111-1111-4111-8111-111111111111',bob='22222222-2222-4222-8222-222222222222'
export const users={
 [alice]:{id:alice,email:'alice@example.test',email_confirmed_at:'2026-01-01T00:00:00Z',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{suizamente_onboarding_completed:true,name:'Nombre Latido'}},
 [bob]:{id:bob,email:'bob@example.test',email_confirmed_at:'2026-01-01T00:00:00Z',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{suizamente_onboarding_completed:true,name:'Otra persona',avatar_url:'https://avatars.example.test/suizamente-bob.svg'}},
}
const issued=Math.floor(Date.now()/1000)
export const token=id=>Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:id,aud:'authenticated',role:'authenticated',email:users[id].email,exp:issued+3600,iat:issued})).toString('base64url')+'.fixture-signature'
export const session=id=>({access_token:token(id),refresh_token:'fixture-refresh-'+id,token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:users[id]})
export async function fixture(){
 const db=new PGlite()
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
 CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY,raw_user_meta_data jsonb DEFAULT '{}');
 CREATE TABLE public.profiles(id uuid PRIMARY KEY REFERENCES auth.users,name text,canton text,banned boolean DEFAULT false);
 CREATE TABLE public.admin_users(user_id uuid PRIMARY KEY);
 CREATE TABLE public.app_notifications(id uuid DEFAULT gen_random_uuid(),recipient_id uuid REFERENCES public.profiles,kind text CHECK(kind IN('message','creator_follow')),source_id text,data jsonb CHECK(jsonb_typeof(data)='object'),seen_at timestamptz,read_at timestamptz,created_at timestamptz DEFAULT now(),UNIQUE(recipient_id,kind,source_id));
 INSERT INTO auth.users(id) VALUES('${alice}'),('${bob}');INSERT INTO public.profiles VALUES('${alice}','Nombre Latido','Zürich',false),('${bob}','Otra persona','Uri',false);INSERT INTO public.admin_users VALUES('${alice}');`)
 const file=relative=>readFile(new URL('../../../'+relative,import.meta.url),'utf8')
 await db.exec(await file('supabase/suizamente_votos.sql'))
 await db.exec(await file('supabase/suizamente_social_instalar.sql'))
 const questions=JSON.parse(await file('public/suizamente/data/preguntas.json')).preguntas
 await db.exec(`ALTER TABLE public.profiles ADD COLUMN avatar_url text;UPDATE public.profiles SET avatar_url='https://avatars.example.test/latido-alice.svg' WHERE id='${alice}';UPDATE public.profiles SET avatar_url='https://avatars.example.test/suizamente-bob.svg' WHERE id='${bob}';`)
 const client={from:table=>({select:columns=>({in:async(_column,ids)=>{if(table!=='profiles'||columns!=='id,avatar_url')throw new Error('Unexpected public fields');return {data:(await db.query('SELECT id,avatar_url FROM public.profiles WHERE id=ANY($1::uuid[])',[ids])).rows}}})}),auth:{getUser:async access=>{const id=Object.keys(users).find(id=>token(id)===access);return id?{data:{user:users[id]}}:{error:{code:'invalid_token'}}},admin:{getUserById:async id=>({data:{user:users[id]}}),generateLink:async({email})=>{const user=Object.values(users).find(u=>u.email===email);return {data:{user,properties:{hashed_token:'fixture-one-use-otp'}}}}}},
  rpc:async(name,args)=>{try{
   const query=name==='suizamente_social_api'?'SELECT public.suizamente_social_api($1,$2,$3::jsonb,$4) r':'SELECT public.suizamente_votos_api($1,$2,$3,$4,$5) r'
   const params=name==='suizamente_social_api'?[args.p_accion,args.p_jugador,JSON.stringify(args.p_datos),args.p_direccion]:[args.accion,args.jugador,args.pregunta,args.eleccion,args.direccion]
   return {data:(await db.query(query,params)).rows[0].r,error:null}
  }catch(error){return {data:null,error}}}}
 return {db,questions,client,social:createSuizamenteSocialHttp({getClient:()=>client,getSecret:()=> 'fixture-secret'}),votes:createSuizamenteHttp({getClient:()=>client,getSecret:()=> 'fixture-secret',questions:new Map(questions.map(q=>[q.id,q.opciones.length])),allowedOrigin:suizamenteAllowedOrigin}),reset:()=>db.exec('DELETE FROM suizamente_social.limites;DELETE FROM public.suizamente_votos_limites')}
}
