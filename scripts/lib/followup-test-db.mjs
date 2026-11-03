import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
export async function createFollowupTestDb({ install = true } = {}) {
  const db = new PGlite()
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE SCHEMA extensions;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
    CREATE FUNCTION public.latido_account_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('test.account',true),'')::uuid,auth.uid()) $$;
    CREATE FUNCTION public.is_business_promotion_admin() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT coalesce(current_setting('test.admin',true),'false')='true' $$;
    CREATE TABLE profiles(id uuid PRIMARY KEY,name text,email text,banned boolean DEFAULT false);
    CREATE TABLE conversations(id uuid PRIMARY KEY,sender_id uuid REFERENCES profiles(id),owner_id uuid REFERENCES profiles(id),title text,owner_name text,deleted_by_sender boolean DEFAULT false,deleted_by_owner boolean DEFAULT false);
    CREATE TABLE messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),conversation_id uuid REFERENCES conversations(id),sender_id uuid REFERENCES profiles(id),body text,created_at timestamptz DEFAULT now());
    CREATE TABLE app_notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),recipient_id uuid,kind text,source_id text,data jsonb,read_at timestamptz,seen_at timestamptz,created_at timestamptz DEFAULT now(),CONSTRAINT app_notifications_kind_check CHECK(kind IN ('message','store_order')),UNIQUE(recipient_id,kind,source_id));
    CREATE TABLE email_notification_preferences(user_id uuid PRIMARY KEY,message_emails_enabled boolean DEFAULT true);
  `)
  if (install) await installFollowupSql(db)
  return db
}
export async function installFollowupSql(db) { await db.exec(await readFile(new URL('../../supabase/conversation_followups.sql', import.meta.url), 'utf8')) }
export const TEST_CUSTOMER = '11111111-1111-4111-8111-111111111111'
export const TEST_OWNER = '22222222-2222-4222-8222-222222222222'
export const TEST_CONVERSATION = '33333333-3333-4333-8333-333333333333'
export async function seedFollowup(db) {
  await db.query('INSERT INTO profiles(id,name,email) VALUES($1,$2,$3),($4,$5,$6)', [TEST_CUSTOMER, 'Persona de prueba', 'cliente@example.test', TEST_OWNER, 'Negocio de prueba', 'negocio@example.test'])
  await db.query("INSERT INTO conversations(id,sender_id,owner_id,title,owner_name) VALUES($1,$2,$3,'Curso de alemán · consulta de prueba','Negocio de prueba')", [TEST_CONVERSATION, TEST_CUSTOMER, TEST_OWNER])
  await db.query("INSERT INTO messages(conversation_id,sender_id,body,created_at) VALUES($1,$2,'¿Sigue disponible el curso?',now()-interval '8 days')", [TEST_CONVERSATION, TEST_CUSTOMER])
}
