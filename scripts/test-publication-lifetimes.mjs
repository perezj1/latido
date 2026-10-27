import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const limited='10000000-0000-4000-8000-000000000001'
const other='10000000-0000-4000-8000-000000000002'
const admin='10000000-0000-4000-8000-000000000003'
const db=new PGlite()
const scalar=async(sql,params=[])=>Object.values((await db.query(sql,params)).rows[0])[0]
const asRole=async(role,id='')=>{
  await db.exec('RESET ROLE')
  await db.query("SELECT set_config('test.user',$1,false)",[id])
  await db.exec(`SET ROLE ${role}`)
}
try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.user',true),'')::uuid $$;
    CREATE FUNCTION public.latido_account_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT auth.uid() $$;
    CREATE FUNCTION public.is_business_promotion_admin() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT coalesce(auth.uid()='${admin}',false) $$;
    CREATE FUNCTION public.is_latido_admin() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT public.is_business_promotion_admin() $$;
    INSERT INTO auth.users VALUES('${limited}'),('${other}'),('${admin}');
    CREATE TABLE listings(id text PRIMARY KEY,user_id uuid,created_at timestamptz DEFAULT now(),expires_at timestamptz,active boolean DEFAULT true,lifecycle_status text DEFAULT 'active',title text,type text DEFAULT 'ofrece',job_intent text DEFAULT 'ofrece');
    CREATE TABLE jobs(LIKE listings INCLUDING ALL);
    GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
    GRANT SELECT ON listings,jobs TO anon;
    GRANT SELECT,INSERT,UPDATE ON listings,jobs TO authenticated;
    CREATE FUNCTION existing_lifecycle_default() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.job_intent='busca' AND NEW.expires_at IS NULL THEN NEW.expires_at:=now()+interval '45 days'; END IF; RETURN NEW; END $$;
  `)
  for(const table of ['listings','jobs']) {
    await db.exec(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;
      CREATE POLICY public_read ON ${table} FOR SELECT USING(active);
      CREATE POLICY admin_read ON ${table} FOR SELECT USING(public.is_business_promotion_admin());
      CREATE POLICY insert_own ON ${table} FOR INSERT WITH CHECK(user_id=auth.uid());
      CREATE POLICY update_own ON ${table} FOR UPDATE USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
      CREATE TRIGGER existing_lifecycle BEFORE INSERT OR UPDATE ON ${table} FOR EACH ROW EXECUTE FUNCTION existing_lifecycle_default();
      INSERT INTO ${table}(id,user_id,created_at,title) VALUES
        ('fresh','${limited}',now()-interval '1 hour','Fresh'),
        ('boundary','${limited}',now()-interval '48 hours','At boundary'),
        ('old','${limited}',now()-interval '49 hours','Old'),
        ('unlimited','${other}',now()-interval '500 hours','Other account');
      INSERT INTO ${table}(id,user_id,created_at,active,lifecycle_status,title)
        VALUES('resolved','${limited}',now()-interval '60 hours',false,'resolved','Already resolved');`)
  }
  const migration=await readFile(new URL('../supabase/user_publication_lifetimes.sql',import.meta.url),'utf8')
  await db.exec(migration)
  await db.exec(migration)
  await db.query('INSERT INTO user_publication_lifetimes(user_id,lifetime_hours) VALUES($1,48)',[limited])

  // An active flag or a missing expires_at cannot bypass the server-side deadline.
  await asRole('anon')
  for(const table of ['listings','jobs']) {
    assert.deepEqual((await db.query(`SELECT id FROM ${table} ORDER BY id`)).rows.map(r=>r.id),['fresh','unlimited'])
  }
  await assert.rejects(db.query(`SELECT public.expire_limited_user_publications()`),/permission denied/)
  await asRole('authenticated',limited)
  for(const table of ['listings','jobs']) assert.equal(await scalar(`SELECT count(*)::int FROM ${table}`),5)
  await assert.rejects(db.query('UPDATE user_publication_lifetimes SET lifetime_hours=8760'),/permission denied/)
  await assert.rejects(db.query('SELECT public.set_user_publication_lifetime($1,8760)',[limited]),/permission denied/)

  await asRole('service_role')
  assert.equal(await scalar('SELECT public.expire_limited_user_publications()'),4)
  assert.equal(await scalar('SELECT public.expire_limited_user_publications()'),0)
  await db.query('SELECT public.set_user_publication_lifetime($1,48)',[limited])
  assert.equal(await scalar('SELECT public.set_user_publication_lifetime($1,48)',[limited]),0)

  await asRole('authenticated',limited)
  for(const table of ['listings','jobs']) {
    const row=(await db.query(`SELECT * FROM ${table} WHERE id='old'`)).rows[0]
    assert.equal(row.active,false)
    assert.equal(row.lifecycle_status,'expired')
    assert.equal(new Date(row.expires_at)-new Date(row.created_at),48*60*60*1000)
    assert.equal(await scalar(`SELECT lifecycle_status FROM ${table} WHERE id='resolved'`),'resolved')
    await db.query(`UPDATE ${table} SET created_at=now(),expires_at=now()+interval '100 days',active=true,lifecycle_status='active' WHERE id='old'`)
    const renewed=(await db.query(`SELECT * FROM ${table} WHERE id='old'`)).rows[0]
    assert.equal(new Date(renewed.created_at).getTime(),new Date(row.created_at).getTime())
    assert.equal(renewed.active,false)
    assert.equal(renewed.lifecycle_status,'expired')
    await db.query(`INSERT INTO ${table}(id,user_id,created_at,expires_at,job_intent,title)
      VALUES('new',$1,now()+interval '2 years',now()+interval '100 days','busca','New publication')`,[limited])
    const posted=(await db.query(`SELECT * FROM ${table} WHERE id='new'`)).rows[0]
    assert.ok(Math.abs(Date.now()-new Date(posted.created_at).getTime())<60000)
    assert.equal(new Date(posted.expires_at)-new Date(posted.created_at),48*60*60*1000)
    await db.query(`UPDATE ${table} SET expires_at=NULL,created_at=now()+interval '1 year' WHERE id='new'`)
    assert.equal(new Date(await scalar(`SELECT expires_at FROM ${table} WHERE id='new'`)).getTime(),new Date(posted.expires_at).getTime())
    await assert.rejects(db.query(`UPDATE ${table} SET user_id=$1 WHERE id='new'`,[other]),/row-level security/)
  }

  await asRole('authenticated',other)
  for(const table of ['listings','jobs']) {
    assert.equal((await db.query(`SELECT * FROM ${table} WHERE id='old'`)).rows.length,0)
    assert.equal(await scalar(`SELECT expires_at FROM ${table} WHERE id='unlimited'`),null)
    await db.query(`INSERT INTO ${table}(id,user_id,job_intent,title) VALUES('ordinary',$1,'busca','Ordinary lifetime')`,[other])
    const ordinary=(await db.query(`SELECT * FROM ${table} WHERE id='ordinary'`)).rows[0]
    assert.equal(new Date(ordinary.expires_at)-new Date(ordinary.created_at),45*24*60*60*1000)
  }
  await asRole('authenticated',admin)
  for(const table of ['listings','jobs']) assert.equal(await scalar(`SELECT count(*)::int FROM ${table}`),7)
  console.log('Publication lifetimes passed: both publication types, exact 48-hour boundary, public RLS, owner/admin access, expiry job, existing/future posts, immutable publication time, renewal protection and unaffected other accounts.')
} finally { await db.close() }
