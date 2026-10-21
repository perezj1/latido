import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { chromium, webkit, expect } from '@playwright/test'

const useWebkit = process.argv.includes('--webkit')
const port = useWebkit ? 5223 : 5222
const origin = `http://127.0.0.1:${port}`
const output = `output/latido-card/admin-${useWebkit ? 'webkit' : 'chromium'}`
await mkdir(output, { recursive: true })
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  env: { ...process.env, VITE_SUPABASE_URL: `${origin}/club-admin-test`, VITE_SUPABASE_ANON_KEY: 'mock', VITE_ADMIN_EMAILS: 'admin@latido.test', VITE_LATIDO_CARD_MEMBERS_ENABLED: 'false' },
  stdio: 'pipe', windowsHide: true,
})
let logs = '', browser
server.stdout.on('data', value => { logs += value })
server.stderr.on('data', value => { logs += value })
const calls = [], errors = []
let missing = false
const now = new Date().toISOString()
const user = { id: '11111111-1111-4111-8111-111111111111', email: 'admin@latido.test', role: 'authenticated', aud: 'authenticated', app_metadata: { provider: 'email' }, user_metadata: { name: 'Admin', latido_onboarding_completed: true }, created_at: now }
const fixtures = {
  businesses: Array.from({ length: 30 }, (_, i) => ({ id: `business-${i}`, name: `Negocio ${i + 1}`, city: 'Zürich', status: 'active', offers: 3, published_offers: 2, uses: 5 })),
  members: [{ id: 'member-1', name: 'Ana', email: 'ana@example.com', member_number: 17, status: 'active', valid_until: now, created_at: now }],
  offers: [{ id: 'offer-1', title: 'Curso de baile', business_name: 'Negocio 1', status: 'published', benefit_type: 'percent', uses: 5, ends_at: 'infinity' }],
  uses: [{ id: 'use-1', title: 'Curso de baile', business_name: 'Negocio 1', member_name: 'Ana', status: 'used', redeemed_at: now }],
}
function response(args) {
  const rows = fixtures[args.p_kind].filter(row => (args.p_status === 'all' || row.status === args.p_status)
    && JSON.stringify(row).toLowerCase().includes(args.p_search.toLowerCase()))
  return {
    generated_at: now, period: { days: args.p_days, from: now, until: now },
    stats: { members_active: 12, members_total: 18, offers_published: args.p_exclude_tests ? 8 : 9, businesses_with_offers: 4, businesses_participating: 7, uses_period: 15, uses_total: 31, using_members_period: 6, claims_active: 2 },
    daily: Array.from({ length: args.p_days }, (_, i) => ({ day: new Date(Date.now() - (args.p_days - 1 - i) * 86400000).toISOString().slice(0, 10), members: i % 3, offers: i % 4, uses: i % 5 })),
    records: { kind: args.p_kind, page: args.p_page, page_size: args.p_page_size, total: rows.length, rows: rows.slice((args.p_page - 1) * args.p_page_size, args.p_page * args.p_page_size) },
  }
}
async function contextFor(email) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.addInitScript(({ user, email }) => {
    if (email) localStorage.setItem('sb-127-auth-token', JSON.stringify({ access_token: 'mock', refresh_token: 'mock', expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user: { ...user, email } }))
    localStorage.setItem('latido_cookie_consent', JSON.stringify({ policyVersion: '2026-08-08', expiresAt: new Date(Date.now() + 86400000).toISOString(), categories: { necessary: true, analytics: false, externalMedia: false } }))
  }, { user, email })
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    const send = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'content-range': '*/0' }, body: JSON.stringify(body) })
    if (url.origin !== origin) return send([])
    if (url.pathname.startsWith('/club-admin-test')) {
      if (url.pathname.endsWith('/rpc/lc_admin_metrics')) {
        const args = request.postDataJSON()
        calls.push(args)
        if (missing) return send({ code: 'PGRST202', message: 'Missing function' }, 404)
        return send(response(args))
      }
      if (url.pathname.endsWith('/auth/v1/user')) return send({ ...user, email })
      if (url.pathname.endsWith('/profiles') && (request.headers().accept || '').includes('vnd.pgrst.object')) return send({ ...user, email, name: 'Admin', banned: false })
      if (url.pathname.endsWith('/rpc/admin_dashboard_summary_v1')) return send({ users: {}, businesses: {}, content: {}, reports: {}, moderation: {}, creators: {}, period: { days: 7 } })
      return send([])
    }
    if (url.pathname.startsWith('/api/')) return send([])
    return route.continue()
  })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  return { context, page }
}
try {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(origin)).ok) break } catch {}
    if (i === 99) throw new Error(logs)
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  browser = await (useWebkit ? webkit : chromium).launch({ headless: true })
  const { page, context } = await contextFor(user.email)
  await page.goto(`${origin}/admin-latido`)
  await page.getByRole('button', { name: /Latido Club/ }).click()
  const section = page.getByRole('region', { name: 'Métricas de Latido Club', exact: true })
  await expect(section.locator('.club-admin-kpi').first().locator('strong')).toHaveText('12')
  assert.equal(calls[0].p_kind, 'businesses')
  assert.equal(calls[0].p_exclude_tests, true)
  await section.getByRole('button', { name: 'Siguiente', exact: true }).click()
  await expect(section.getByText('Negocio 26', { exact: true })).toBeVisible()
  await expect(section.getByText('Página 2 de 2', { exact: true })).toBeVisible()
  assert.equal(calls.at(-1).p_page, 2)
  await section.getByRole('button', { name: 'Miembros', exact: true }).click()
  await expect(section.getByRole('cell', { name: '#17', exact: true })).toBeVisible()
  await section.getByRole('button', { name: 'Ofertas', exact: true }).click()
  await expect(section.getByRole('cell', { name: 'Sin fecha', exact: true })).toBeVisible()
  await section.getByLabel('Buscar en ofertas', { exact: true }).fill('No existe')
  await expect(section.getByText('No hay registros con estos filtros.', { exact: true })).toBeVisible()
  await expect(section.locator('.club-admin-kpi').first().locator('strong')).toHaveText('12')
  await section.getByLabel('Buscar en ofertas', { exact: true }).fill('')
  await expect(section.getByRole('cell', { name: 'Sin fecha', exact: true })).toBeVisible()
  await section.getByLabel('Estado', { exact: true }).selectOption('archived')
  await expect(section.getByText('No hay registros con estos filtros.', { exact: true })).toBeVisible()
  assert.equal(calls.at(-1).p_status, 'archived')
  await section.getByRole('button', { name: 'Historial de usos', exact: true }).click()
  await expect(section.getByRole('cell', { name: 'Ana', exact: true })).toBeVisible()
  await section.getByLabel('Actividad del periodo').selectOption('7')
  await expect(section.getByRole('heading', { name: 'Usos en 7 días', exact: true })).toBeVisible()
  assert.equal(calls.at(-1).p_days, 7)
  await section.getByLabel('Excluir datos [TEST]', { exact: true }).uncheck()
  await expect(section.locator('.club-admin-kpi').nth(1).locator('strong')).toHaveText('9')
  assert.equal(calls.at(-1).p_exclude_tests, false)
  await page.screenshot({ path: `${output}/desktop.png`, fullPage: true })
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No page overflow at ${width}px`)
    await page.screenshot({ path: `${output}/mobile-${width}.png`, fullPage: true })
  }
  await page.getByRole('button', { name: 'Más', exact: true }).click()
  await page.getByRole('button', { name: /Latido Club/ }).click()
  await expect(section.getByRole('heading', { name: 'Resumen de Latido Club', exact: true })).toBeVisible()
  missing = true
  await page.getByRole('button', { name: 'Actualizar', exact: true }).click()
  await expect(section.getByRole('alert')).toContainText('latido_club_admin_metrics.sql')
  assert.equal(await section.locator('.club-admin-kpi').count(), 0, 'Unavailable data must not appear as zero')
  missing = false
  await section.getByRole('button', { name: 'Reintentar', exact: true }).click()
  await expect(section.locator('.club-admin-kpi').first().locator('strong')).toHaveText('12')
  await context.close()
  const before = calls.length
  const other = await contextFor('member@latido.test')
  await other.page.goto(`${origin}/admin-latido`)
  await expect(other.page).not.toHaveURL(/admin-latido/)
  assert.equal(calls.length, before, 'Non-admin account cannot load Club metrics')
  await other.context.close()
  assert.deepEqual(errors, [])
  console.log(`${useWebkit ? 'WebKit' : 'Chromium'}: actual admin navigation, metrics, lists, filters, pagination, period, test toggle, mobile layout, missing SQL/retry and non-admin route guard passed`)
} finally {
  await browser?.close()
  server.kill()
}
