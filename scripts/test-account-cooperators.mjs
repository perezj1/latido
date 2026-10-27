import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { getAccountUser, requiresCooperatorAccess } from '../src/lib/accountAccess.js'

const owner = '10000000-0000-4000-8000-000000000001'
const operator = '10000000-0000-4000-8000-000000000002'
const client = '10000000-0000-4000-8000-000000000003'
const stranger = '10000000-0000-4000-8000-000000000004'
const conversation = '20000000-0000-4000-8000-000000000001'
const message = '30000000-0000-4000-8000-000000000001'
const provider = '40000000-0000-4000-8000-000000000001'
const db = new PGlite()
const asUser = async id => {
  await db.exec('RESET ROLE')
  await db.query("SELECT set_config('test.user',$1,false)", [id])
  await db.exec('SET ROLE authenticated')
}
const scalar = async sql => Object.values((await db.query(sql)).rows[0])[0]
try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE SCHEMA storage;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.user',true),'')::uuid $$;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE TABLE profiles(id uuid PRIMARY KEY,name text,email text,canton text,avatar_url text,banned boolean DEFAULT false);
    CREATE TABLE conversations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),sender_id uuid,owner_id uuid,title text,deleted_by_sender boolean DEFAULT false,deleted_by_owner boolean DEFAULT false);
    CREATE TABLE messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),conversation_id uuid REFERENCES conversations(id),sender_id uuid,body text,read boolean DEFAULT false,read_at timestamptz);
    CREATE TABLE providers(id uuid PRIMARY KEY,user_id uuid,name text,active boolean DEFAULT true,deleted_at timestamptz,photo_url text,photo_urls jsonb);
    CREATE TABLE listings(LIKE providers INCLUDING ALL);
    CREATE TABLE creator_metrics(creator_id text,metric text,count int);
    CREATE TABLE message_email_notification_state(user_id uuid PRIMARY KEY);
    CREATE FUNCTION message_read_cleanup() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
      BEGIN IF NEW.read THEN DELETE FROM public.message_email_notification_state WHERE user_id='${owner}'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER message_read_cleanup AFTER UPDATE OF read ON messages FOR EACH ROW EXECUTE FUNCTION message_read_cleanup();
    CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text);
    CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT string_to_array($1,'/') $$;
    GRANT USAGE ON SCHEMA public,auth,storage TO anon,authenticated,service_role;
    GRANT ALL ON ALL TABLES IN SCHEMA public,storage TO authenticated;
    GRANT DELETE ON auth.users TO authenticated;
    ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
    ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
    ALTER TABLE providers ENABLE ROW LEVEL SECURITY;
    ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
    ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    CREATE POLICY owner_all ON conversations USING(auth.uid() IN(sender_id,owner_id)) WITH CHECK(auth.uid() IN(sender_id,owner_id));
    CREATE POLICY owner_all ON messages USING(EXISTS(SELECT 1 FROM conversations WHERE id=conversation_id)) WITH CHECK(sender_id=auth.uid() AND EXISTS(SELECT 1 FROM conversations WHERE id=conversation_id));
    CREATE POLICY owner_all ON providers USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
    CREATE POLICY owner_all ON listings USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
    CREATE POLICY owner_all ON profiles USING(id=auth.uid()) WITH CHECK(id=auth.uid());
    CREATE POLICY storage_own ON storage.objects USING(name LIKE auth.uid()::text || '/%') WITH CHECK(name LIKE auth.uid()::text || '/%');
    CREATE FUNCTION unsafe_delete_message(uuid) RETURNS void LANGUAGE sql SECURITY DEFINER AS $$ DELETE FROM messages WHERE id=$1 $$;
    CREATE FUNCTION unsafe_delete_account(uuid) RETURNS void LANGUAGE sql SECURITY DEFINER AS $$ DELETE FROM auth.users WHERE id=$1 $$;
    CREATE FUNCTION unsafe_change_profile(uuid) RETURNS void LANGUAGE sql SECURITY DEFINER AS $$ UPDATE profiles SET name='Changed' WHERE id=$1 $$;
    INSERT INTO auth.users VALUES('${owner}'),('${operator}'),('${client}'),('${stranger}');
    INSERT INTO profiles(id,name,email,canton) SELECT id,CASE WHEN id='${owner}' THEN 'Punto Hispano' ELSE 'Other' END,'test@example.org','ZH' FROM auth.users;
    INSERT INTO conversations(id,sender_id,owner_id,title) VALUES('${conversation}','${client}','${owner}','Consulta');
    INSERT INTO messages(id,conversation_id,sender_id,body) VALUES('${message}','${conversation}','${client}','Original');
    INSERT INTO providers(id,user_id,name,photo_url,photo_urls) VALUES('${provider}','${owner}','Punto Hispano','https://example.com/a.jpg','["a.jpg"]');
    INSERT INTO providers(id,user_id,name) VALUES(gen_random_uuid(),'${stranger}','Other business');
    INSERT INTO storage.objects(bucket_id,name) VALUES('publication-images','${operator}/old.jpg');
    INSERT INTO message_email_notification_state VALUES('${owner}');
  `)
  const migration = await readFile(new URL('../supabase/account_cooperators.sql', import.meta.url), 'utf8')
  await db.exec(migration)
  await db.exec(migration)
  await db.query('INSERT INTO account_cooperators(user_id,account_id) VALUES($1,$2)', [operator,owner])

  await asUser(operator)
  assert.equal(await scalar('SELECT latido_account_id()'), owner)
  assert.equal((await scalar('SELECT get_my_account_access()')).role, 'cooperator')
  assert.equal(await scalar('SELECT count(*)::int FROM conversations'), 1)
  assert.equal(await scalar('SELECT count(*)::int FROM messages'), 1)
  assert.equal(await scalar('SELECT count(*)::int FROM providers'), 1)
  await db.query('INSERT INTO messages(conversation_id,sender_id,body) VALUES($1,$2,$3)', [conversation,owner,'Respuesta del cooperador'])
  assert.equal(await scalar(`SELECT mark_conversation_messages_read('${conversation}')`), 1)
  assert.equal(await scalar('SELECT count(*)::int FROM message_email_notification_state'), 0, 'Read receipts must retain their internal notification cleanup')
  assert.equal(await scalar(`SELECT body FROM messages WHERE id='${message}'`), 'Original')
  await db.query('UPDATE providers SET name=$1 WHERE id=$2', ['Punto Hispano editado',provider])
  assert.equal(await scalar(`SELECT name FROM providers WHERE id='${provider}'`), 'Punto Hispano editado')
  await db.query('INSERT INTO storage.objects(bucket_id,name) VALUES($1,$2)', ['publication-images',`${owner}/new.jpg`])

  for (const sql of [
    `DELETE FROM messages WHERE id='${message}' RETURNING id`,
    `DELETE FROM conversations WHERE id='${conversation}' RETURNING id`,
    `DELETE FROM providers WHERE id='${provider}' RETURNING id`,
  ]) assert.equal((await db.query(sql)).rows.length, 0, 'Direct deletion must affect no rows')

  for (const sql of [
    'DELETE FROM account_cooperators RETURNING user_id',
    `SELECT unsafe_delete_message('${message}')`,
    `SELECT unsafe_delete_account('${owner}')`,
    `SELECT unsafe_delete_account('${operator}')`,
    `SELECT unsafe_change_profile('${owner}')`,
    `UPDATE conversations SET deleted_by_owner=true WHERE id='${conversation}'`,
    `UPDATE conversations SET owner_id='${operator}' WHERE id='${conversation}'`,
    `UPDATE messages SET body='' WHERE id='${message}'`,
    `UPDATE providers SET active=false WHERE id='${provider}'`,
    `UPDATE providers SET deleted_at=now() WHERE id='${provider}'`,
    `UPDATE providers SET user_id='${operator}' WHERE id='${provider}'`,
    `UPDATE providers SET photo_url='' WHERE id='${provider}'`,
    `UPDATE providers SET photo_urls='[]' WHERE id='${provider}'`,
    `UPDATE storage.objects SET name='${operator}/renamed.jpg' WHERE name='${operator}/old.jpg'`,
    `INSERT INTO account_cooperators(user_id,account_id) VALUES('${stranger}','${owner}')`,
    `INSERT INTO messages(conversation_id,sender_id,body) VALUES('${conversation}','${stranger}','Spoofed')`,
  ]) await assert.rejects(db.query(sql), /COOPERATOR_|permission denied|row-level security/)

  await asUser(stranger)
  assert.equal(await scalar('SELECT latido_account_id()'), stranger)
  assert.equal(await scalar('SELECT count(*)::int FROM conversations'), 0)
  await assert.rejects(db.query(`SELECT mark_conversation_messages_read('${conversation}')`), /access denied/)
  await assert.rejects(db.query(`INSERT INTO messages(conversation_id,sender_id,body) VALUES('${conversation}','${stranger}','Intrusion')`), /row-level security/)

  await asUser(owner)
  assert.equal(await scalar('SELECT latido_is_cooperator()'), false)
  await db.query(`UPDATE conversations SET deleted_by_owner=true WHERE id='${conversation}'`)
  await db.query(`UPDATE conversations SET deleted_by_owner=false WHERE id='${conversation}'`)
  assert.equal((await db.query(`DELETE FROM messages WHERE body='Respuesta del cooperador' RETURNING id`)).rows.length, 1)
  assert.equal(await scalar(`SELECT name FROM profiles WHERE id='${owner}'`), 'Punto Hispano')

  await db.exec('RESET ROLE')
  await db.query('UPDATE profiles SET banned=true WHERE id=$1', [owner])
  await asUser(operator)
  assert.equal(await scalar('SELECT latido_account_id()'), operator, 'Delegation must not bypass an account ban')
  assert.equal(await scalar('SELECT count(*)::int FROM conversations'), 0)
  await assert.rejects(db.query('SELECT get_my_account_access()'), /ACCOUNT_UNAVAILABLE/)
  await db.exec('RESET ROLE')
  await db.query("SELECT set_config('test.user','',false)")
  await db.query('UPDATE profiles SET banned=false WHERE id=$1', [owner])
  await db.query('UPDATE account_cooperators SET active=false WHERE user_id=$1', [operator])
  await asUser(operator)
  assert.equal(await scalar('SELECT latido_account_id()'), operator)
  assert.equal(await scalar('SELECT count(*)::int FROM conversations'), 0)

  const actual = { id:operator,email:'gestoria@example.org',app_metadata:{latido_account_role:'cooperator'},user_metadata:{name:'Gestoría'} }
  const effective = getAccountUser(actual,{role:'cooperator',account_id:owner,name:'Punto Hispano',canton:'ZH'})
  assert.equal(effective.id,owner)
  assert.equal(effective.email,actual.email)
  assert.equal(actual.id,operator, 'The authenticated identity must remain intact')
  assert.equal(getAccountUser(actual,{role:'owner'}),actual)
  assert.equal(requiresCooperatorAccess(actual),true)
  assert.equal(requiresCooperatorAccess({user_metadata:{latido_account_role:'cooperator'}}),false)
  console.log('Cooperator permissions passed: read/reply/edit/upload, no hard or soft deletion, no message rewrites, no impersonation or membership escalation, owner unchanged and revocation.')
} finally { await db.close() }
