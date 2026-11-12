import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { build } from 'esbuild'
import { csvCell } from '../src/lib/csv.js'
import { getAnalyticsRoute, isPrivateAnalyticsRoute, sanitizeAnalyticsMetadata } from '../src/lib/analyticsPrivacy.js'

for (const value of ['=1+1', '+SUM(A1:A2)', '-1+1', '@SUM(A1:A2)', '  =1+1', '\uFEFF=1', '\t=1', '\r=1', '\n=1', '\0=1', '＝1+1']) {
  const cell = csvCell(value)
  assert.ok(cell.startsWith("'") || cell.startsWith('"\''), `Formula escaped: ${JSON.stringify(value)}`)
}
assert.equal(csvCell('Ana García'), 'Ana García')
assert.equal(csvCell('Ana; "Hola"\nZürich'), '"Ana; ""Hola""\nZürich"')
assert.equal(csvCell(42), '42')
assert.equal(csvCell(-12), '-12')
assert.equal(csvCell(null), '')

for (const [route, expected] of [
  ['/mensajes?conv=private-conversation#private-token', '/mensajes'],
  ['/negocios/private-id/destacar?session_id=secret', '/negocios/[businessSlug]/destacar'],
  ['/creadores/private-name', '/creadores/[creatorSlug]'],
  ['/creadores/mi-perfil/', '/creadores/mi-perfil'],
  ['/publicar/punto-hispano/secret', '/publicar/punto-hispano/[token]'],
  ['/unknown/private-email%40example.com', '/[other]'],
]) assert.equal(getAnalyticsRoute(route), expected)

for (const route of ['/c/secret', '/scanner', '/scanner/link/secret', '/card/scanner/secret', '/card/validacion/secret', '/seguimiento', '/publicar/punto-hispano/secret']) {
  assert.equal(isPrivateAnalyticsRoute(route), true, route)
}
assert.equal(isPrivateAnalyticsRoute('/card/negocio/public-business'), false)

const metadata = {
  query:'Tengo problemas de salud, mi email es private@example.com',
  search_attempt_id:'00000000-0000-4000-8000-000000000001',
  results_count:3, scope:'global', result_type:'ad', answer:'yes',
  conversation_id:'private-conversation', result_id:'private-id',
  result_label:'Nombre privado', href:'/mensajes?conv=secret',
  assistant:{ query:'private' }, search_filters:{ city:'private' },
  service:'private@example.com', destination:'https://example.com/?token=secret',
}
assert.deepEqual(sanitizeAnalyticsMetadata(metadata), {
  search_attempt_id:metadata.search_attempt_id, results_count:3, scope:'global',
  result_type:'ad', answer:'yes', has_query:true,
})
assert.equal(metadata.query.includes('private@example.com'), true, 'Sanitization does not modify search state')

// Exercise the real transport boundary with consent and backend mocks.
globalThis.__securityAnalytics = { consent:true, rows:[], events:[] }
const memory = new Map()
globalThis.window = {
  location:{ hostname:'latido.test', pathname:'/mensajes', search:'?conv=secret', origin:'https://latido.test' },
  localStorage:{ removeItem() {} },
  sessionStorage:{ getItem:key => memory.get(key), setItem:(key, value) => memory.set(key, value) },
}
const bundled = await build({
  entryPoints:['src/lib/analytics.js'], bundle:true, write:false, format:'esm', platform:'node',
  define:{ 'import.meta.env.PROD':'true' },
  plugins:[{ name:'mock-analytics-services', setup(builder) {
    builder.onResolve({ filter:/^(?:@vercel\/analytics|\.\/supabase|\.\/cookieConsent)$/ }, args => ({ path:args.path, namespace:'analytics-mocks' }))
    builder.onLoad({ filter:/.*/, namespace:'analytics-mocks' }, ({ path }) => ({ contents:
      path === './supabase'
        ? 'export const supabase = { from: () => ({ insert: async row => { globalThis.__securityAnalytics.rows.push(row); return {} } }) }'
        : path === './cookieConsent'
          ? 'export const hasAnalyticsConsent = () => globalThis.__securityAnalytics.consent'
          : 'export const track = (...args) => globalThis.__securityAnalytics.events.push(args)',
    }))
  } }],
})
const analytics = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)
const state = globalThis.__securityAnalytics
await analytics.trackAnalyticsEvent('search', { user_id:'account-id', path:'/mensajes?conv=secret', metadata })
assert.equal(state.rows.length, 1)
assert.equal(state.rows[0].path, '/mensajes')
assert.equal(state.rows[0].search, '')
assert.equal(state.rows[0].user_id, 'account-id', 'Preserve ownership required by existing RLS')
assert.equal(JSON.stringify(state.rows).includes('private'), false)
assert.equal(JSON.stringify(state.events).includes('private'), false)
await analytics.trackAnalyticsEvent('search', { metadata:{ ...metadata, search_attempt_id:'00000000-0000-4000-8000-000000000002' } })
assert.equal(state.rows.length, 2, 'Distinct searches retain their conversion counters')
for (const path of ['/publicar/punto-hispano/secret', '/seguimiento', '/card/validacion/secret']) {
  window.location.pathname = path
  await analytics.trackAnalyticsEvent('page_view')
  assert.equal(analytics.sanitizeVercelAnalyticsEvent({ url:`https://latido.test${path}?token=secret` }), null)
}
assert.equal(state.rows.length, 2, 'Private pages are excluded from both analytics destinations')
window.location.pathname = '/mensajes'
assert.equal(analytics.sanitizeVercelAnalyticsEvent({ url:'https://latido.test/mensajes?conv=secret#token' }).url, 'https://latido.test/mensajes')
state.consent = false
await analytics.trackAnalyticsEvent('page_view')
assert.equal(state.rows.length, 2)
assert.equal(analytics.sanitizeVercelAnalyticsEvent({ url:'https://latido.test/' }), null)
delete globalThis.window
delete globalThis.__securityAnalytics

const config = JSON.parse(await readFile('vercel.json', 'utf8'))
assert.ok(config.headers.some(rule => rule.source === '/(.*)' && rule.headers.some(header => header.key === 'X-Content-Type-Options' && header.value === 'nosniff')))
console.log('Security hardening: CSV injection, analytics transport privacy, consent, conversion counters and global nosniff passed.')
