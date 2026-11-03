import { readFile } from 'node:fs/promises'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { createFollowupTestDb, seedFollowup, TEST_CUSTOMER, TEST_CONVERSATION } from './lib/followup-test-db.mjs'
const port = Number(process.env.FOLLOWUP_PREVIEW_PORT || 5242)
const origin = `http://127.0.0.1:${port}`
// The preview never connects to the project's real Supabase environment.
process.env.VITE_SUPABASE_URL = `${origin}/__followup`
process.env.VITE_SUPABASE_ANON_KEY = 'local-followup-preview'
const { createServer } = await import('vite')
const bundle = await build({ entryPoints:[fileURLToPath(new URL('../supabase/functions/conversation_followup_email/email.ts', import.meta.url))],bundle:true,write:false,format:'esm',platform:'node' })
const { buildFollowupEmail } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
let db = await createFollowupTestDb(), lastEmail = null
await seedFollowup(db)
const html = await readFile(new URL('./fixtures/followup-preview.html', import.meta.url), 'utf8')
const scalar = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0]
async function asCustomer(callback) {
  return db.transaction(async tx => {
    await tx.exec('SET LOCAL ROLE authenticated')
    await tx.query("SELECT set_config('test.uid',$1,true),set_config('test.admin','true',true)", [TEST_CUSTOMER])
    return callback(tx)
  })
}
const plugin = {
  name: 'local-conversation-followup-preview',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const path = (req.url || '').split('?')[0]
      if (!path.startsWith('/__followup') && !['/seguimiento','/perfil'].includes(path)) return next()
      res.setHeader('Cache-Control', 'no-store')
      if (path === '/__followup/email-preview') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end(lastEmail?.html || '<p>Primero genera el correo de prueba.</p>') }
      if (['/seguimiento','/perfil'].includes(path)) { res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end(await server.transformIndexHtml('/scripts/fixtures/followup-preview.html', html)) }
      res.setHeader('Content-Type', 'application/json')
      try {
        if (req.method !== 'POST') throw new Error('POST_REQUIRED')
        let raw = ''; for await (const chunk of req) raw += chunk
        const body = JSON.parse(raw || '{}')
        let data
        if (path.endsWith('/rpc/cf_admin_report')) {
          data = await asCustomer(async tx => (await tx.query('SELECT cf_admin_report($1,$2) AS result', [body.p_outcome, body.p_page])).rows[0].result)
        } else {
          switch (body.action) {
            case 'get': data = await asCustomer(async tx => (await tx.query('SELECT cf_get($1) AS result', [TEST_CONVERSATION])).rows[0].result); break
            case 'answer': data = await asCustomer(async tx => (await tx.query('SELECT cf_answer($1,$2,$3) AS result', [TEST_CONVERSATION, body.round, body.answer])).rows[0].result); break
            case 'feedback': data = await asCustomer(async tx => (await tx.query('SELECT cf_feedback($1,$2,$3,$4) AS result', [TEST_CONVERSATION, body.round, body.change, body.value ?? null])).rows[0].result); break
            case 'email': data = body.answer ? await scalar('SELECT cf_answer_email($1,$2)', [body.token, body.answer]) : await scalar('SELECT cf_email_context($1)', [body.token]); break
            case 'email_change': data = await scalar('SELECT cf_email_change($1,$2,$3,$4)', [body.token, body.round, body.change, body.value ?? null]); break
            case 'state': data = { notifications: await scalar('SELECT count(*)::int FROM app_notifications'), email: Boolean(lastEmail) }; break
            case 'email_preferences': {
              if (typeof body.enabled === 'boolean') await db.query('INSERT INTO email_notification_preferences(user_id,message_emails_enabled) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET message_emails_enabled=excluded.message_emails_enabled', [TEST_CUSTOMER, body.enabled])
              data = await scalar('SELECT coalesce((SELECT message_emails_enabled FROM email_notification_preferences WHERE user_id=$1),true)', [TEST_CUSTOMER]); break
            }
            case 'reset': await db.close(); db = await createFollowupTestDb(); await seedFollowup(db); lastEmail = null; data = { ok: true }; break
            case 'day_one': await db.exec("UPDATE conversation_followups SET due_at=now()+interval '7 days' WHERE outcome='pending'"); data = { ok: true }; break
            case 'advance': await db.exec("UPDATE conversation_followups SET due_at=due_at-interval '7 days'"); data = { ok: true }; break
            case 'notify': {
              const rows = (await db.query('SELECT cf_claim_due(25) AS row')).rows
              for (const { row } of rows) {
                const context = await scalar('SELECT cf_email_context($1)', [row.token])
                lastEmail = buildFollowupEmail({ ...row, contact_name: context.contact_name }, origin)
                await db.query("UPDATE conversation_followups SET delivery_status='sent',email_sent_at=now(),push_sent_at=now(),processing_at=NULL WHERE id=$1", [row.id])
              }
              data = { claimed: rows.length }; break
            }
            default: throw new Error('UNKNOWN_PREVIEW_ACTION')
          }
        }
        res.end(JSON.stringify(data))
      } catch (error) { res.statusCode = 400; res.end(JSON.stringify({ error: error.message })) }
    })
  },
}
const server = await createServer({ server: { host: '127.0.0.1', port, strictPort: true }, plugins: [plugin] })
await server.listen()
console.log(`Followup preview ready: ${origin}/scripts/fixtures/followup-preview.html`)
console.log('Local fictitious data only; SMTP and push delivery are disabled in this preview.')
process.on('SIGINT', async () => { await server.close(); await db.close(); process.exit(0) })
