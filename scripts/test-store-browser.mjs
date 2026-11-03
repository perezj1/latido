import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { chromium, expect } from '@playwright/test'

const port = 5234, origin = `http://127.0.0.1:${port}`
const output = 'output/latido-card/store'
await mkdir(output, { recursive: true })
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { env: { ...process.env, VITE_SUPABASE_URL: `${origin}/store-test`, VITE_SUPABASE_ANON_KEY: 'mock', VITE_ADMIN_EMAILS: 'admin@latido.test' }, stdio: 'pipe', windowsHide: true })
let browser, logs = '', failList = false, paymentStatus = 'processing'
server.stdout.on('data', d => { logs += d })
server.stderr.on('data', d => { logs += d })
const errors = [], updates = []
const now = new Date().toISOString()
const user = { id: '11111111-1111-4111-8111-111111111111', email: 'admin@latido.test', role: 'authenticated', aud: 'authenticated', app_metadata: { provider: 'email' }, user_metadata: { name: 'Admin', latido_onboarding_completed: true }, created_at: now }
const order = { id: 'order-1', reference: 'LC-001001', status: 'paid', payment_status: 'paid', total_amount: 2490, currency: 'chf', created_at: now, updated_at: now, paid_at: now, admin_email_sent_at: now, customer_email_sent_at: now, customer_name: 'Ana Prueba', customer_email: 'ana@latido.test', shipping_address: { line1: 'Calle Prueba 1', line2: 'Piso 2', postal_code: '8000', city: 'Zürich', country: 'CH' }, items: [{ sku: 'gelato:product:variant', product_name: 'Camiseta Latido', option_label: 'Color / Talla', option: 'Negro / M', size: 'M', color: 'Negro', quantity: 1, gelato_product_id: 'product', gelato_variant_id: 'variant' }] }
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(origin)).ok) break } catch {} if (i === 99) throw new Error(logs); await new Promise(r => setTimeout(r, 100)) }
  browser = await chromium.launch({ headless: true })
  async function contextFor(email) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    await context.addInitScript(({ user, email }) => {
      if (email) localStorage.setItem('sb-127-auth-token', JSON.stringify({ access_token: 'mock', refresh_token: 'mock', expires_at: Date.now() / 1000 + 3600, token_type: 'bearer', user: { ...user, email } }))
      localStorage.setItem('latido_cookie_consent', JSON.stringify({ policyVersion: '2026-08-08', expiresAt: new Date(Date.now() + 86400000).toISOString(), categories: { necessary: true, analytics: false, externalMedia: false } }))
    }, { user, email })
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url())
      const send = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
      if (url.origin !== origin) return send([])
      if (url.pathname.startsWith('/store-test')) {
        if (url.pathname.endsWith('/rpc/club_admin_orders')) return failList ? send({ message: 'offline' }, 503) : send({ rows: [order], total: 1, pending: order.status === 'paid' ? 1 : 0, generated_at: now })
        if (url.pathname.endsWith('/rpc/club_admin_update_order')) {
          const args = request.postDataJSON(); updates.push(args)
          order.status = args.p_status; order.internal_notes = args.p_notes; order.updated_at = new Date().toISOString()
          return send(order)
        }
        if (url.pathname.endsWith('/club_order_status')) return send({ reference: order.reference, payment_status: paymentStatus })
        if (url.pathname.endsWith('/auth/v1/user')) return send({ ...user, email })
        if (url.pathname.endsWith('/profiles') && (request.headers().accept || '').includes('vnd.pgrst.object')) return send({ ...user, email, name: 'Admin', banned: false })
        if (url.pathname.endsWith('/rpc/admin_dashboard_summary_v1')) return send({ users: {}, businesses: {}, content: {}, reports: {}, moderation: {}, creators: {}, period: { days: 7 } })
        return send([])
      }
      if (url.pathname.startsWith('/api/')) return send({ products: [] })
      return route.continue()
    })
    const page = await context.newPage()
    page.on('pageerror', e => errors.push(e.message))
    return { page, context }
  }
  const { page, context } = await contextFor(user.email)
  await page.goto(`${origin}/admin-latido?section=storeOrders`)
  const section = page.getByRole('region', { name: 'Pedidos de Tienda Latido' })
  await expect(section.getByRole('heading', { name: order.reference })).toBeVisible()
  await expect(section.getByText('Calle Prueba 1')).toBeVisible()
  await expect(section.getByText('Talla: M · Color: Negro')).toBeVisible()
  await section.getByLabel('Notas internas').fill('Preparar mañana')
  await section.getByRole('button', { name: 'Marcar en proceso', exact: true }).click()
  await expect(section.locator('.store-order__status')).toHaveText('En proceso')
  assert.equal(updates[0].p_expected_status, 'paid')
  assert.equal(updates[0].p_notes, 'Preparar mañana')
  await section.getByRole('button', { name: 'Marcar enviado', exact: true }).click()
  await expect(section.locator('.store-order__status')).toHaveText('Enviado')
  await section.getByRole('button', { name: 'Marcar entregado', exact: true }).click()
  await expect(section.locator('.store-order__status')).toHaveText('Entregado')
  assert.equal(updates.length, 3)
  assert.equal(await section.getByRole('button', { name: /^Marcar/ }).count(), 0)
  await page.screenshot({ path: `${output}/admin-desktop.png`, fullPage: true })
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No overflow at ${width}px`)
    await page.screenshot({ path: `${output}/admin-${width}.png`, fullPage: true })
  }
  failList = true
  await section.getByRole('button', { name: 'Actualizar pedidos', exact: true }).click()
  await expect(section.getByRole('alert')).toContainText('No se pudieron cargar')
  failList = false
  await section.getByRole('button', { name: 'Actualizar pedidos', exact: true }).click()
  await expect(section.getByRole('alert')).toHaveCount(0)
  await context.close()
  const other = await contextFor('member@latido.test')
  await other.page.goto(`${origin}/admin-latido?section=storeOrders`)
  await expect(other.page).not.toHaveURL(/admin-latido/)
  await other.context.close()
  const buyer = await contextFor(null)
  await buyer.page.goto(`${origin}/`)
  await expect(buyer.page.getByRole('link', { name: 'Descubrir Tienda Latido →' })).toBeVisible()
  await buyer.page.locator('nav').getByRole('link', { name: 'Tienda Latido', exact: true }).click()
  await expect(buyer.page).toHaveURL(`${origin}/tienda`)
  await buyer.page.setViewportSize({ width: 390, height: 844 })
  await buyer.page.goto(`${origin}/`)
  await buyer.page.getByRole('button', { name: 'Menú', exact: true }).click()
  await buyer.page.locator('.latido-nav-menu').getByRole('link', { name: 'Tienda Latido', exact: true }).click()
  await expect(buyer.page).toHaveURL(`${origin}/tienda`)
  await expect(buyer.page.locator('.latido-nav-menu')).toHaveCount(0)
  await buyer.page.goto(`${origin}/tienda?checkout=success&order=LC-001001&session_id=cs_test_abcdefghijklmnopqrstuvwxyz`)
  await expect(buyer.page.getByText('Estamos confirmando tu pago')).toBeVisible()
  paymentStatus = 'paid'
  await expect(buyer.page.getByText('Pago confirmado · Pedido recibido')).toBeVisible({ timeout: 10000 })
  await buyer.context.close()
  assert.deepEqual(errors, [])
  console.log('Store browser: admin deep link, variants/address, order transitions, notes, mobile layouts, network retry, non-admin guard, landing link and verified payment return passed.')
} finally { await browser?.close(); server.kill() }
