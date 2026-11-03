import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createFollowupTestDb, installFollowupSql, seedFollowup, TEST_CUSTOMER, TEST_OWNER, TEST_CONVERSATION } from './lib/followup-test-db.mjs'

const db = await createFollowupTestDb({ install: false })
const scalar = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0]
const backfill = await readFile(new URL('../supabase/conversation_followups_backfill.sql', import.meta.url), 'utf8')
async function readAs(user, conversation) {
  await db.exec('RESET ROLE; SET ROLE authenticated')
  await db.query("SELECT set_config('test.uid',$1,false)", [user])
  try { return await scalar('SELECT cf_get($1)', [conversation]) }
  finally { await db.exec('RESET ROLE') }
}
async function oldThread({ sender = TEST_CUSTOMER, owner = TEST_OWNER, messageSender = sender, days = 8, deleted = false, title = 'Consulta anterior' } = {}) {
  const id = randomUUID()
  await db.query('INSERT INTO conversations(id,sender_id,owner_id,title,deleted_by_sender) VALUES($1,$2,$3,$4,$5)', [id, sender, owner, title, deleted])
  await db.query("INSERT INTO messages(conversation_id,sender_id,body,created_at) VALUES($1,$2,'Consulta',now()-($3::int * interval '1 day'))", [id, messageSender, days])
  return id
}
try {
  await seedFollowup(db)
  const ancient = await oldThread({ days: 400, title: null })
  const recent = await oldThread({ days: 5 })
  const deleted = await oldThread({ deleted: true })
  const ownerOnly = await oldThread({ messageSender: TEST_OWNER })
  const self = await oldThread({ owner: TEST_CUSTOMER })
  const bannedUser = randomUUID()
  await db.query("INSERT INTO profiles(id,name,email,banned) VALUES($1,'Bloqueado','blocked@example.test',true)", [bannedUser])
  const banned = await oldThread({ sender: bannedUser })
  await installFollowupSql(db)
  assert.equal(await scalar('SELECT count(*)::int FROM conversation_followups'), 0)
  assert.equal(await readAs(TEST_OWNER, TEST_CONVERSATION), null)
  assert.equal(await readAs(TEST_CUSTOMER, deleted), null)
  assert.equal(await readAs(bannedUser, banned), null)
  assert.equal(await readAs(TEST_CUSTOMER, recent), null)
  assert.equal(await scalar('SELECT count(*)::int FROM conversation_followups'), 0, 'Reading other or ineligible chats cannot enroll them')

  const question = await readAs(TEST_CUSTOMER, TEST_CONVERSATION)
  assert.equal(question.due, true)
  assert.equal(question.outcome, 'pending')
  assert.equal(await scalar('SELECT delivery_status FROM conversation_followups WHERE conversation_id=$1', [TEST_CONVERSATION]), 'skipped')
  assert.equal((await db.query('SELECT cf_claim_due(100)')).rows.length, 0, 'Opening an old chat must not queue delivery')
  await db.exec('SET ROLE authenticated')
  const closed = await scalar("SELECT cf_answer($1,$2,'no')", [TEST_CONVERSATION, question.round])
  await db.exec('RESET ROLE')
  await db.exec(backfill)
  await db.exec(backfill)
  assert.equal(await scalar('SELECT count(*)::int FROM conversation_followups'), 2, 'Bulk enrollment is idempotent and excludes ineligible threads')
  const preserved = await readAs(TEST_CUSTOMER, TEST_CONVERSATION)
  assert.equal(preserved.outcome, 'no')
  assert.equal(preserved.round, closed.round, 'Existing answers and versions are preserved')
  const oldQuestion = await readAs(TEST_CUSTOMER, ancient)
  assert.equal(oldQuestion.due, true)
  assert.equal(oldQuestion.title, 'Consulta en Latido')
  const ancientExpiry = await scalar('SELECT token_expires_at FROM conversation_followups WHERE conversation_id=$1', [ancient])
  assert.ok(new Date(ancientExpiry).getTime() > Date.now(), 'Very old chats receive a fresh token lifetime')
  for (const id of [recent, deleted, ownerOnly, self, banned]) assert.equal(await scalar('SELECT count(*)::int FROM conversation_followups WHERE conversation_id=$1', [id]), 0)
  assert.equal((await db.query('SELECT cf_claim_due(100)')).rows.length, 0)
  assert.equal(await scalar('SELECT count(*)::int FROM app_notifications'), 0, 'The backfill creates no historical notifications')

  await db.query("UPDATE messages SET created_at=now()-interval '8 days' WHERE conversation_id=$1", [recent])
  assert.equal(await readAs(TEST_OWNER, recent), null)
  assert.equal(await scalar('SELECT count(*)::int FROM conversation_followups WHERE conversation_id=$1', [recent]), 0)
  const matured = await readAs(TEST_CUSTOMER, recent)
  assert.equal(matured.due, true, 'A pre-existing recent chat becomes eligible when seven days elapse')
  await db.exec('SET ROLE authenticated')
  const progress = await scalar("SELECT cf_answer($1,$2,'not_yet')", [recent, matured.round])
  await db.exec('RESET ROLE')
  assert.ok(Math.abs(new Date(progress.due_at).getTime() - Date.now() - 7 * 86400000) < 5000)
  assert.equal((await db.query('SELECT cf_claim_due(100)')).rows.length, 0)
  await db.query("UPDATE conversation_followups SET due_at=now()-interval '1 second' WHERE conversation_id=$1", [recent])
  assert.equal((await db.query('SELECT cf_claim_due(100)')).rows.length, 1, 'An explicit in-progress answer schedules the next normal reminder')
  console.log('Historical followups: bulk and on-open enrollment, age threshold, ownership, deleted/blocked exclusions, existing answers, fresh expiry and no retrospective delivery passed.')
} finally { await db.close() }
