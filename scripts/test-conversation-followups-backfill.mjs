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
  assert.equal(await scalar('SELECT delivery_status FROM conversation_followups WHERE conversation_id=$1', [TEST_CONVERSATION]), 'pending')
  assert.equal(await scalar('SELECT email_only FROM conversation_followups WHERE conversation_id=$1', [TEST_CONVERSATION]), true)
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
  const firstDelivery = (await db.query('SELECT cf_claim_due(100) AS job')).rows
  assert.equal(firstDelivery.length, 1)
  assert.equal(firstDelivery[0].job.conversation_id, ancient)
  assert.equal(firstDelivery[0].job.email_only, true)
  assert.equal((await db.query('SELECT cf_claim_due(100)')).rows.length, 0, 'An active delivery cannot be claimed twice')
  assert.equal(await scalar('SELECT count(*)::int FROM app_notifications'), 0, 'Historical enrollment sends email without extra app alerts')
  await db.query("UPDATE conversation_followups SET delivery_status='sent',email_sent_at=now(),processing_at=NULL WHERE conversation_id=$1", [ancient])
  await db.exec(backfill)
  assert.equal((await db.query('SELECT cf_claim_due(100)')).rows.length, 0, 'Re-enrollment never repeats a sent email')

  await db.query("UPDATE messages SET created_at=now()-interval '8 days' WHERE conversation_id=$1", [recent])
  assert.equal(await readAs(TEST_OWNER, recent), null)
  assert.equal(await scalar('SELECT count(*)::int FROM conversation_followups WHERE conversation_id=$1', [recent]), 0)
  const maturedJob = (await db.query('SELECT cf_claim_due(100) AS job')).rows[0].job
  assert.equal(maturedJob.conversation_id, recent, 'Old chats enter delivery without being opened')
  assert.equal(maturedJob.email_only, true)
  const matured = await readAs(TEST_CUSTOMER, recent)
  assert.equal(matured.due, true, 'A pre-existing recent chat becomes eligible when seven days elapse')
  await db.exec('SET ROLE authenticated')
  const progress = await scalar("SELECT cf_answer($1,$2,'not_yet')", [recent, matured.round])
  await db.exec('RESET ROLE')
  assert.ok(Math.abs(new Date(progress.due_at).getTime() - Date.now() - 7 * 86400000) < 5000)
  assert.equal((await db.query('SELECT cf_claim_due(100)')).rows.length, 0)
  await db.query("UPDATE conversation_followups SET due_at=now()-interval '1 second' WHERE conversation_id=$1", [recent])
  assert.equal((await db.query('SELECT cf_claim_due(100)')).rows.length, 1, 'An explicit in-progress answer schedules the next normal reminder')
  assert.equal(await scalar('SELECT email_only FROM conversation_followups WHERE conversation_id=$1', [recent]), false)
  assert.equal(await scalar('SELECT count(*)::int FROM app_notifications'), 1, 'Later reminders retain normal delivery')

  const legacy = await oldThread(), sent = await oldThread(), attempted = await oldThread(), test = await oldThread()
  await db.query("UPDATE conversation_followups SET delivery_status='skipped',token_expires_at=now()-interval '1 day' WHERE conversation_id=$1", [legacy])
  await db.query("UPDATE conversation_followups SET delivery_status='sent',email_sent_at=now(),attempts=1 WHERE conversation_id=$1", [sent])
  await db.query("UPDATE conversation_followups SET delivery_status='skipped',attempts=1 WHERE conversation_id=$1", [attempted])
  await db.query("UPDATE conversation_followups SET delivery_status='skipped',is_test=true WHERE conversation_id=$1", [test])
  const enrolled = await scalar('SELECT cf_enroll_history()')
  assert.equal(enrolled.historical_emails_queued, 1, 'Only untouched chat-only rows are upgraded')
  const refreshedExpiry = await scalar('SELECT token_expires_at FROM conversation_followups WHERE conversation_id=$1', [legacy])
  assert.ok(new Date(refreshedExpiry).getTime() > Date.now())
  assert.equal((await scalar('SELECT cf_enroll_history()')).historical_emails_queued, 0)
  assert.equal(new Date(await scalar('SELECT token_expires_at FROM conversation_followups WHERE conversation_id=$1', [legacy])).getTime(), new Date(refreshedExpiry).getTime())
  const legacyJob = (await db.query('SELECT cf_claim_due(100) AS job')).rows
  assert.equal(legacyJob.length, 1)
  assert.equal(legacyJob[0].job.conversation_id, legacy)
  assert.equal(legacyJob[0].job.email_only, true)
  for (const id of [attempted, test]) assert.equal(await scalar('SELECT delivery_status FROM conversation_followups WHERE conversation_id=$1', [id]), 'skipped')
  await db.exec('SET ROLE authenticated')
  await assert.rejects(() => scalar('SELECT cf_enroll_history()'), /permission denied/)
  console.log('Historical followups: automatic and on-open enrollment, age/ownership exclusions, email-only first delivery, existing answers and sent emails, legacy rows, fresh expiry, idempotency and normal later reminders passed.')
} finally { await db.close() }
