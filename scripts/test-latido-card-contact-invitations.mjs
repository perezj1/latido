import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {PGlite} from '@electric-sql/pglite'
const db=new PGlite()
try {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
    CREATE TABLE auth.users(id uuid PRIMARY KEY,email text);
    CREATE TABLE profiles(id uuid PRIMARY KEY,name text,banned boolean DEFAULT false);
    CREATE TABLE providers(id uuid PRIMARY KEY,user_id uuid,name text,email text,active boolean DEFAULT true,deleted_at timestamptz);
    CREATE TABLE latido_card_businesses(provider_id uuid,suspended boolean DEFAULT false);
    CREATE TABLE latido_card_offers(provider_id uuid);
    CREATE TABLE email_notification_preferences(user_id uuid,weekly_digest_enabled boolean);
    GRANT USAGE ON SCHEMA public TO service_role,anon,authenticated;`)
  for(const file of ['latido_card_business_invitation.sql','latido_card_contact_invitation.sql','latido_card_contact_invitation.sql'])
    await db.exec(await readFile(new URL(`../supabase/${file}`,import.meta.url),'utf8'))
  const add=async(email,extra={})=>{const id=randomUUID();await db.query('INSERT INTO providers(id,name,email,user_id,active,deleted_at) VALUES($1,$2,$3,$4,$5,$6)',[id,email,email,extra.user||null,extra.active!==false,extra.deleted?new Date():null]);return id}
  await add(' shared@example.com ')
  await add('SHARED@example.com')
  await add('missing-at');await add('');await add(null);await add('inactive@example.com',{active:false});await add('deleted@example.com',{deleted:true})
  const offered=await add('offered@example.com');await db.query('INSERT INTO latido_card_offers VALUES($1)',[offered])
  const suspended=await add('suspended@example.com');await db.query('INSERT INTO latido_card_businesses VALUES($1,true)',[suspended])
  const owner=randomUUID();await db.query('INSERT INTO profiles(id) VALUES($1)',[owner]);await db.query('INSERT INTO auth.users VALUES($1,$2)',[owner,'old@example.com'])
  await db.query("INSERT INTO latido_card_business_invitations(user_id,status,sent_at) VALUES($1,'sent',now())",[owner])
  await add('old@example.com');await add('owned@example.com',{user:owner})
  const opted=randomUUID();await db.query('INSERT INTO profiles(id) VALUES($1)',[opted]);await db.query('INSERT INTO auth.users VALUES($1,$2)',[opted,'opted@example.com']);await db.query('INSERT INTO email_notification_preferences VALUES($1,false)',[opted]);await add('opted@example.com')
  assert.equal((await db.query('SELECT count(*)::int n FROM lc_contact_invitation_targets')).rows[0].n,1)
  assert.equal((await db.query('SELECT lc_queue_contact_invitations() n')).rows[0].n,1)
  assert.equal((await db.query('SELECT lc_queue_contact_invitations() n')).rows[0].n,0)
  const claims=await Promise.all([db.query('SELECT * FROM lc_claim_contact_invitations(1)'),db.query('SELECT * FROM lc_claim_contact_invitations(1)')])
  assert.equal(claims.reduce((n,r)=>n+r.rows.length,0),1,'A shared address is claimed once')
  await db.exec("UPDATE latido_card_contact_invitations SET status='failed'")
  assert.equal((await db.query('SELECT * FROM lc_claim_contact_invitations(1)')).rows.length,0,'Uncertain delivery is never retried')
  await db.exec("UPDATE latido_card_contact_invitations SET status='sent',sent_at=now()")
  assert.equal((await db.query('SELECT lc_queue_contact_invitations() n')).rows[0].n,0,'Explicit repeated runs do not resend')
  await db.exec("UPDATE latido_card_contact_invitations SET opted_out_at=now(),status='suppressed'")
  assert.equal((await db.query('SELECT count(*)::int n FROM lc_contact_invitation_targets')).rows[0].n,0,'Unsubscribe suppresses every business sharing the address')
  const changed=await add('changed@example.com');await db.query('SELECT lc_queue_contact_invitations()');await db.query('UPDATE providers SET user_id=$1 WHERE id=$2',[owner,changed])
  assert.equal((await db.query('SELECT * FROM lc_claim_contact_invitations(1)')).rows.length,0,'Eligibility is rechecked before claiming')
  for(const role of ['anon','authenticated']){await db.exec(`SET ROLE ${role}`);await assert.rejects(()=>db.query('SELECT * FROM latido_card_contact_invitations'),/permission denied/);await assert.rejects(()=>db.query('SELECT lc_queue_contact_invitations()'),/permission denied/);await db.exec('RESET ROLE')}
  console.log('Contact invitations: deduplication, preferences, prior invitations, exclusions, opt-out, claims and no automatic retries passed; no real email sent')
}finally{await db.close()}
