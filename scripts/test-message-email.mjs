import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { build } from 'esbuild'

const source = (await readFile(new URL('../supabase/functions/latido_message_email/index.ts', import.meta.url), 'utf8'))
  .replace(/^import \{ createClient \} .*$/m, 'const createClient = globalThis.mockCreateClient;')
  .replace(/^import nodemailer .*$/m, 'const nodemailer = globalThis.mockNodemailer;')
const bundle = await build({ stdin:{contents:source,loader:'ts'},bundle:true,write:false,platform:'node',format:'iife',target:'es2022' })

async function run({ delegated=true, ownerActive=false, delegateActive=false, confirmed=true, enabled=true, unread=2, routingFailure=false, smtpFailure=false, authorized=true } = {}) {
  let handler
  const mails = [], updates = [], lookups = []
  const service = {
    rpc(name) {
      if (name === 'claim_pending_message_email_notifications') return Promise.resolve({ data:[{user_id:'owner',attempts:1,first_unread_at:'2026-10-27T08:00:00Z'}],error:null })
      assert.equal(name,'message_email_delivery_context')
      return { async maybeSingle() { return { data:{profile_email:'profile@example.org',display_name:'Punto Hispano',unread_count:unread,latest_conversation_id:'shared-conversation',app_opened_since_first_unread:ownerActive,email_enabled:enabled},error:null } } }
    },
    auth:{admin:{async getUserById(id) {
      lookups.push(id)
      return {data:{user:{email:id === 'delegate' ? 'gestoria@example.org' : 'owner@example.org',email_confirmed_at:confirmed ? '2026-10-27' : null}},error:null}
    }}},
    from(table) {
      const filters = {}
      return {
        select() { return this },
        eq(key,value) { filters[key]=value;return this },
        gt() { return this }, lt() { return this }, limit() { return this },
        update(values) { updates.push({table,values,filters});return this },
        delete() { return this },
        then(resolve,reject) { return Promise.resolve({data:null,error:null}).then(resolve,reject) },
        async maybeSingle() {
          if (table === 'account_cooperators') {
            assert.deepEqual(filters,{account_id:'owner',active:true,receives_message_emails:true})
            return {data:delegated ? {user_id:'delegate'} : null,error:routingFailure ? new Error('Routing unavailable') : null}
          }
          assert.equal(table,'app_presence_sessions')
          assert.equal(filters.user_id,'delegate')
          return {data:delegateActive ? {user_id:'delegate'} : null,error:null}
        },
      }
    },
  }
  const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fake',SMTP_USERNAME:'sender@example.org',SMTP_PASSWORD:'fake',EMAIL_CRON_SECRET:'test-secret'}
  vm.runInNewContext(bundle.outputFiles[0].text, {
    Request,Response,URL,
    console:{log(){},error(){}},
    Deno:{env:{get:key=>env[key]},serve:callback=>{handler=callback}},
    mockCreateClient:()=>service,
    mockNodemailer:{createTransport:()=>({sendMail(mail,callback){mails.push(mail);callback(smtpFailure ? new Error('SMTP unavailable') : null)}})},
  })
  const response=await handler(new Request('https://example.org',{method:'POST',headers:{'Content-Type':'application/json','x-latido-cron-secret':authorized ? 'test-secret' : 'incorrect'},body:'{}'}))
  return {status:response.status,result:await response.json(),mails,updates,lookups}
}

const routed=await run({ownerActive:true})
assert.equal(routed.result.sent,1, 'An active owner must not suppress email for an offline delegated recipient')
assert.equal(routed.mails.length,1)
assert.equal(routed.mails[0].to,'gestoria@example.org')
assert.match(routed.mails[0].text,/mensajes\?conv=shared-conversation/)
assert.deepEqual(routed.lookups,['delegate'])
assert.equal(routed.updates[0].filters.user_id,'owner', 'The unread queue must stay attached to the shared inbox')

const ordinary=await run({delegated:false})
assert.equal(ordinary.mails[0].to,'owner@example.org')
const activeOwner=await run({delegated:false,ownerActive:true})
assert.equal(activeOwner.mails.length,0)
assert.equal(activeOwner.result.deferred,1)
const activeDelegate=await run({delegateActive:true})
assert.equal(activeDelegate.mails.length,0)
assert.equal(activeDelegate.result.deferred,1)
assert.equal(activeDelegate.updates[0].values.status,'pending')

for (const options of [{confirmed:false},{enabled:false},{unread:0}]) {
  const result=await run(options)
  assert.equal(result.mails.length,0)
  assert.equal(result.result.suppressed,1)
}
const unavailable=await run({routingFailure:true})
assert.equal(unavailable.mails.length,0)
assert.equal(unavailable.result.retried,1, 'A failed route lookup must not send to the wrong account')
assert.equal((await run({smtpFailure:true})).result.retried,1)
assert.equal((await run({authorized:false})).status,401)
console.log('Message email routing passed: delegate-only delivery, verified address, active recipient deferral, owner fallback, opt-out, no unread messages, routing errors, retries and cron authentication.')
