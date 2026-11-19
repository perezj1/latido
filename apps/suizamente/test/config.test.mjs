import assert from 'node:assert/strict'
import test from 'node:test'
import { publicConfig } from '../src/config.js'

const jwt = role => `header.${Buffer.from(JSON.stringify({role})).toString('base64url')}.signature`
const env = { VITE_SUPABASE_URL:'https://project.supabase.co', VITE_SUPABASE_ANON_KEY:jwt('anon') }
test('uses the existing public project and a distinct canonical origin', () => {
  assert.deepEqual(publicConfig(env), {url:env.VITE_SUPABASE_URL,key:env.VITE_SUPABASE_ANON_KEY,api:env.VITE_SUPABASE_URL+'/functions/v1/suizamente-votos',site:'https://suizamente.latido.ch'})
  assert.equal(publicConfig({...env,VITE_SUPABASE_ANON_KEY:'sb_publishable_test'}).key,'sb_publishable_test')
})
test('rejects privileged credentials and unsafe public URLs', () => {
  for (const key of [jwt('service_role'),jwt('authenticated'),'sb_secret_test','', 'invalid']) {
    assert.throws(() => publicConfig({...env,VITE_SUPABASE_ANON_KEY:key}))
  }
  for (const url of ['', 'http://project.supabase.co','https://user:pass@project.supabase.co','https://project.supabase.co/path','https://project.supabase.co?secret=yes']) {
    assert.throws(() => publicConfig({...env,VITE_SUPABASE_URL:url}))
  }
  for (const site of ['javascript:alert(1)','https://example.com/path','https://example.com?token=test','https://user:pass@example.com']) {
    assert.throws(() => publicConfig({...env,VITE_SITE_URL:site}))
  }
})
