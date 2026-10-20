import assert from 'node:assert/strict'
import handler from '../api/card-share.js'

const previousFetch = globalThis.fetch
const previousEnv = { url: process.env.VITE_SUPABASE_URL, key: process.env.VITE_SUPABASE_ANON_KEY, members: process.env.VITE_LATIDO_CARD_MEMBERS_ENABLED }
process.env.VITE_SUPABASE_URL = 'https://card-test.invalid'
process.env.VITE_SUPABASE_ANON_KEY = 'public-anon-test-key'
process.env.VITE_LATIDO_CARD_MEMBERS_ENABLED = 'true'
const provider = '00000000-0000-4000-8000-000000000010'
const offerId = '00000000-0000-4000-8000-000000000001'
const offer = {
  id: offerId,
  provider_id: provider,
  business_name: 'Café <Latido>',
  city: 'Zürich',
  title: '15 % de descuento',
  benefit_type: 'percent',
  benefit_value: 15,
  business_photo_url: '/cafe.jpg'
}
let requests = 0
globalThis.fetch = async (url, options) => {
  assert.equal(new URL(url).origin, 'https://card-test.invalid')
  assert.equal(options.headers.apikey, 'public-anon-test-key')
  requests++
  return {
    ok: true,
    json: async () =>
      url.endsWith('lc_catalog')
        ? [offer]
        : {
            business: {
              id: provider,
              name: offer.business_name,
              city: offer.city,
              photo_url: offer.business_photo_url
            },
            offers: [offer]
          }
  }
}
const request = async (query, method = 'GET') => {
  const response = {
    headers: {},
    statusCode: 200,
    body: '',
    setHeader(key, value) {
      this.headers[key] = value
    },
    status(value) {
      this.statusCode = value
      return this
    },
    end(value = '') {
      this.body = value
      return this
    }
  }
  await handler({ method, query }, response)
  return response
}
try {
  const business = await request({ provider })
  assert.equal(business.statusCode, 200)
  assert.match(business.body, /<title>Café &lt;Latido&gt; · Ofertas Tarjeta Latido<\/title>/)
  assert.match(
    business.body,
    /property="og:description" content="Hasta −15 % para socios en Zürich/
  )
  assert.match(business.body, /property="og:image" content="https:\/\/latido.ch\/cafe.jpg/)
  assert.match(business.body, /<div id="root"><\/div>/, 'The response retains the working SPA')
  const shared = await request({ oferta: offerId })
  assert.match(shared.body, /15 % de descuento · Café &lt;Latido&gt; · Tarjeta Latido/)
  const localOffer = await request({ provider, oferta: offerId })
  assert.match(localOffer.body, new RegExp(`oferta=${offerId}`))
  assert.equal((await request({ provider }, 'HEAD')).body, '')
  const count = requests
  await request({ provider: 'invalid/../path', oferta: '<script>' })
  assert.equal(requests, count, 'Invalid identifiers never reach the backend')
  for (const enabled of [undefined, 'false']) {
    if (enabled === undefined) delete process.env.VITE_LATIDO_CARD_MEMBERS_ENABLED
    else process.env.VITE_LATIDO_CARD_MEMBERS_ENABLED = enabled
    const preview = await request({ provider, oferta: offerId })
    assert.equal(preview.statusCode, 200)
    assert.equal(preview.headers['Cache-Control'], 'no-store')
    assert.equal(requests, count, 'Business launch must not fetch or expose public offer previews')
    assert.ok(!preview.body.includes('Café &lt;Latido&gt;'))
    assert.ok(!preview.body.includes('Hasta −15 % para socios'))
  }
  process.env.VITE_LATIDO_CARD_MEMBERS_ENABLED = 'true'
  globalThis.fetch = async () => {
    throw new Error('Offline')
  }
  const offline = await request({ provider })
  assert.equal(offline.statusCode, 200)
  assert.equal(offline.headers['Cache-Control'], 'no-store')
  assert.equal((await request({ provider }, 'POST')).statusCode, 405)
  console.log(
    'Card share: HTML metadata without JavaScript, public-only RPC, escaped content, HEAD and offline fallback passed'
  )
} finally {
  globalThis.fetch = previousFetch
  for (const [key, value] of [
    ['VITE_SUPABASE_URL', previousEnv.url],
    ['VITE_SUPABASE_ANON_KEY', previousEnv.key],
    ['VITE_LATIDO_CARD_MEMBERS_ENABLED', previousEnv.members]
  ]) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}
