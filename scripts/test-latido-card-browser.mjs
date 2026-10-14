import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import QRCode from 'qrcode'

const port = 5194,
  origin = `http://127.0.0.1:${port}`,
  token = 'a'.repeat(64),
  scannerToken = 'b'.repeat(64),
  sessionToken = 'c'.repeat(64)
const server = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  {
    env: {
      ...process.env,
      VITE_SUPABASE_URL: 'https://card-test.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'card-test-public-key',
      VITE_ADMIN_EMAILS: 'admin@test.example'
    },
    stdio: 'pipe',
    windowsHide: true
  }
)
let serverOutput = ''
server.stdout.on('data', (data) => {
  serverOutput += data
})
server.stderr.on('data', (data) => {
  serverOutput += data
})
let browser
const output = path.resolve('output/latido-card')
const errors = []
try {
  let ready = false
  for (let n = 0; n < 100; n++) {
    try {
      if ((await fetch(`${origin}/scanner/`)).ok) {
        ready = true
        break
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 100))
  }
  if (!ready) throw new Error(`Vite failed to start: ${serverOutput.slice(-1000)}`)
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const cameraQr = await QRCode.toDataURL(`${origin}/c/${token}`, { width: 480, margin: 4 })
  await context.addInitScript(async (qr) => {
    // Exercise the real decoder with a video stream containing a generated QR.
    // Hardware camera permission remains a separate real-device acceptance test.
    if (!navigator.mediaDevices) return
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: async () => {
        const img = new Image()
        img.src = qr
        await img.decode()
        const canvas = document.createElement('canvas')
        canvas.width = 640
        canvas.height = 640
        const draw = () => {
          const ctx = canvas.getContext('2d')
          ctx.fillStyle = 'white'
          ctx.fillRect(0, 0, 640, 640)
          ctx.drawImage(img, 80, 80, 480, 480)
        }
        draw()
        const timer = setInterval(draw, 80),
          stream = canvas.captureStream(12)
        stream.getTracks().forEach((track) => {
          const stop = track.stop.bind(track)
          track.stop = () => {
            clearInterval(timer)
            stop()
          }
        })
        return stream
      }
    })
  }, cameraQr)
  let redeemCalls = [],
    receipt = null,
    claimed = false
  let physicalRequest = null,
    physicalCalls = []
  const offer = {
    id: '00000000-0000-4000-8000-000000000001',
    title: '15 % desde CHF 50',
    business_name: 'Restaurante Prueba',
    minimum_spend: 50,
    benefit_type: 'percent',
    benefit_value: 15,
    usage_period: 'month',
    usage_limit: 1,
    ends_at: new Date(Date.now() + 86400000).toISOString(),
    requires_claim: false,
    available: true,
    remaining: null
  }
  const special = {
    ...offer,
    id: '00000000-0000-4000-8000-000000000002',
    title: 'Café gratis',
    requires_claim: true,
    remaining: 20,
    benefit_type: 'gift',
    benefit_value: null,
    minimum_spend: 0,
    usage_period: 'lifetime'
  }
  const respond = (route, body, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.origin === origin || url.protocol === 'blob:') return route.continue()
    assert.equal(
      url.hostname,
      'card-test.supabase.co',
      'No third-party request should leave the test'
    )
    const name = url.pathname.split('/').at(-1),
      args = route.request().method() === 'POST' ? route.request().postDataJSON() : {}
    if (name === 'lc_open_scanner')
      return respond(route, {
        token: sessionToken,
        session_id: 'session-1',
        business_name: 'Restaurante Prueba',
        persistent: false,
        expires_at: new Date(Date.now() + 8 * 3600000).toISOString()
      })
    if (name === 'lc_scanner_status')
      return respond(route, {
        session_id: 'session-1',
        business_name: 'Restaurante Prueba',
        persistent: false,
        expires_at: new Date(Date.now() + 8 * 3600000).toISOString()
      })
    if (name === 'lc_scan_card')
      return respond(route, { member_name: 'Ana', member_number: 12847, offers: [offer] })
    if (name === 'lc_redeem') {
      redeemCalls.push(args)
      if (!receipt) {
        receipt = { id: 'redemption-1', redeemed_at: new Date().toISOString(), reversed: false }
        return respond(route, { message: 'Transport failed after commit' }, 503)
      }
      return respond(route, receipt)
    }
    if (name === 'lc_close_scanner') return respond(route, null)
    if (name === 'lc_catalog') return respond(route, [offer, special])
    if (name === 'lc_member_physical_requests') {
      const visible = physicalRequest ? { ...physicalRequest } : null
      if (visible)
        for (const key of [
          'internal_note',
          'version',
          'emails',
          'events',
          'credential_id',
          'contact_email'
        ])
          delete visible[key]
      return respond(route, { issued_before: false, requests: visible ? [visible] : [] })
    }
    if (name === 'lc_request_physical_card') {
      physicalCalls.push(args)
      physicalRequest = {
        ...args.p_details,
        id: '00000000-0000-4000-8000-000000000044',
        reference: 'LCP-000044',
        kind: args.p_kind,
        status: 'requested',
        country: 'CH',
        public_note: '',
        internal_note: '',
        tracking_url: '',
        version: 1,
        member_number: 12847,
        contact_email: 'ana@test.example',
        created_at: new Date().toISOString(),
        events: [],
        emails: []
      }
      return respond(route, physicalRequest)
    }
    if (name === 'lc_admin_overview')
      return respond(route, {
        stats: {
          active_members: 1,
          pending_requests: physicalRequest?.status === 'requested' ? 1 : 0,
          in_progress: 1,
          email_pending: 2,
          email_failed: 0
        },
        members: [],
        businesses: [],
        audit: []
      })
    if (name === 'lc_admin_physical_queue')
      return respond(
        route,
        physicalRequest &&
          (args.p_status === 'all' ||
            args.p_status === physicalRequest.status ||
            (args.p_status === 'open' &&
              !['delivered', 'rejected', 'cancelled'].includes(physicalRequest.status)))
          ? [physicalRequest]
          : []
      )
    if (name === 'lc_admin_update_physical_request') {
      assert.equal(args.p_expected_version, physicalRequest.version)
      physicalRequest = {
        ...physicalRequest,
        status: args.p_status,
        public_note: args.p_public_note,
        internal_note: args.p_internal_note,
        tracking_url: args.p_tracking_url,
        version: physicalRequest.version + 1
      }
      return respond(route, null)
    }
    if (name === 'lc_admin_issue_request_card') {
      assert.equal(args.p_expected_version, physicalRequest.version)
      physicalRequest = {
        ...physicalRequest,
        status: 'printing',
        version: physicalRequest.version + 1,
        credential_id: 'credential-1'
      }
      return respond(route, { token, member_number: 12847, reference: physicalRequest.reference })
    }
    if (name === 'lc_member_home')
      return respond(route, {
        membership: { member_number: 12847, active: true, valid_until: offer.ends_at },
        offers: [
          offer,
          { ...special, claim: claimed ? { status: 'claimed', expires_at: offer.ends_at } : null }
        ],
        history: []
      })
    if (name === 'lc_issue_digital_card')
      return respond(route, { token, expires_at: new Date(Date.now() + 300000).toISOString() })
    if (name === 'lc_claim_offer') {
      claimed = true
      return respond(route, { status: 'claimed' })
    }
    if (name === 'user')
      return respond(route, {
        id: '00000000-0000-4000-8000-000000000099',
        email: 'ana@test.example',
        app_metadata: { provider: 'email' },
        user_metadata: { name: 'Ana', latido_onboarding_completed: true }
      })
    if (name === 'profiles' && route.request().headers().accept?.includes('vnd.pgrst.object'))
      return respond(route, { name: 'Ana', interests: [], banned: false })
    return respond(route, [])
  })
  const page = await context.newPage()
  page.on('pageerror', (err) => errors.push(err.message))
  await page.goto(`${origin}/scanner/link/${scannerToken}`)
  await page.getByLabel('Nombre de este Scanner').fill('Caja 1')
  await page.getByRole('button', { name: 'Continuar en navegador' }).click()
  await page.getByRole('button', { name: 'Escanear Latido Card', exact: true }).waitFor()
  assert.equal(
    new URL(page.url()).pathname,
    '/scanner/',
    'Remove the bootstrap secret from the visible address'
  )
  assert.equal(
    await page.locator('link[rel=manifest]').getAttribute('href'),
    '/scanner/manifest.json'
  )
  assert.equal(
    await page.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith('sb-'))),
    false,
    'Scanner must not create a personal auth session'
  )
  await page.getByRole('button', { name: 'Escanear Latido Card', exact: true }).click()
  await page.getByRole('heading', { name: 'Ana · Socio #12847' }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Canjear', exact: true }).isDisabled(), true)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Canjear', exact: true }).click()
  await page.getByRole('button', { name: 'Reintentar el mismo canje' }).waitFor()
  await page.reload()
  await page.getByRole('button', { name: 'Reintentar el mismo canje' }).click()
  await page.getByRole('heading', { name: '✓ Ventaja utilizada' }).waitFor()
  assert.equal(redeemCalls.length, 2)
  assert.equal(redeemCalls[0].p_request_id, redeemCalls[1].p_request_id)
  await mkdir(output, { recursive: true })
  await page.screenshot({ path: path.join(output, 'scanner-mobile.png'), fullPage: true })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await page.getByRole('button', { name: 'Cerrar acceso en este dispositivo' }).click()
  await page.getByRole('heading', { name: 'Vincular Scanner' }).waitFor()
  await page.goto(`${origin}/card`)
  await page.getByRole('heading', { name: 'Tu comunidad también tiene ventajas.' }).waitFor()
  await page.getByRole('heading', { name: 'Café gratis' }).waitFor()
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await page.screenshot({ path: path.join(output, 'card-public-mobile.png'), fullPage: true })
  const user = {
    id: '00000000-0000-4000-8000-000000000099',
    email: 'ana@test.example',
    app_metadata: { provider: 'email' },
    user_metadata: { name: 'Ana', latido_onboarding_completed: true }
  }
  await page.evaluate(
    (user) =>
      localStorage.setItem(
        'sb-card-test-auth-token',
        JSON.stringify({
          access_token: 'test-token',
          refresh_token: 'test-refresh',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user
        })
      ),
    user
  )
  await page.goto(`${origin}/perfil`)
  await page.getByRole('button',{name:/Mi Latido Card/}).click()
  assert.equal(new URL(page.url()).pathname,'/card')
  await page.getByRole('button', { name: 'Mostrar mi QR digital' }).click()
  await page.getByAltText('QR de Latido Card').waitFor()
  await page.getByRole('button', { name: 'Reclamar', exact: true }).click()
  await page.getByRole('button', { name: 'Reclamado', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Solicitar tarjeta física', exact: true }).click()
  await page.getByLabel('Nombre para la entrega').fill('Ana Prueba')
  await page.getByLabel('Calle y número').fill('Calle Prueba 10')
  await page.getByLabel('Código postal').fill('6004')
  await page.getByLabel('Localidad').fill('Luzern')
  await page.getByRole('button', { name: 'Enviar solicitud a Latido', exact: true }).click()
  await page.getByText('LCP-000044 · Solicitada', { exact: true }).waitFor()
  assert.equal(physicalCalls.length, 1)
  assert.equal(physicalCalls[0].p_details.postal_code, '6004')
  await page.screenshot({ path: path.join(output, 'card-member-mobile.png'), fullPage: true })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.screenshot({ path: path.join(output, 'card-member-desktop.png'), fullPage: true })
  await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem('sb-card-test-auth-token'))
    stored.user = {
      ...stored.user,
      email: 'admin@test.example',
      user_metadata: { name: 'Admin Latido', latido_onboarding_completed: true }
    }
    localStorage.setItem('sb-card-test-auth-token', JSON.stringify(stored))
  })
  await page.goto(`${origin}/card/admin`)
  page.on('dialog', (dialog) => dialog.accept())
  await page.getByRole('heading', { name: 'Latido administra cada tarjeta.' }).waitFor()
  const queue = page.locator('#solicitudes')
  await queue.getByRole('button', { name: 'Aprobada', exact: true }).click()
  await queue.getByRole('button', { name: 'Emitir QR y pasar a impresión', exact: true }).click()
  await queue.getByAltText('QR de impresión de la solicitud').waitFor()
  await queue.getByRole('link', { name: 'Descargar QR para impresión' }).waitFor()
  await queue.getByRole('button', { name: 'Preparada', exact: true }).click()
  await queue.getByText('Entrega, notas e historial', { exact: true }).click()
  await queue.getByLabel('Nota interna de Latido').fill('Nota privada para preparación')
  await queue.getByLabel('Mensaje visible para el socio').fill('Tu tarjeta está en camino.')
  await queue.getByLabel('Enlace de seguimiento (HTTPS)').fill('https://post.example/track/test')
  await queue.getByRole('button', { name: 'Enviada', exact: true }).click()
  await queue.screenshot({ path: path.join(output, 'physical-admin-desktop.png') })
  await queue.getByRole('button', { name: 'Entregada', exact: true }).click()
  await queue.getByLabel('Estado de solicitudes').selectOption('all')
  await queue
    .locator('.lc-badge')
    .filter({ hasText: /^Entregada$/ })
    .waitFor()
  assert.equal(physicalRequest.status, 'delivered')
  assert.equal(physicalRequest.internal_note, 'Nota privada para preparación')
  await page.setViewportSize({ width: 390, height: 844 })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await queue.screenshot({ path: path.join(output, 'physical-admin-mobile.png') })
  assert.deepEqual(errors, [])
  console.log(
    'Latido Card browser: QR decoding, Scanner isolation, idempotent retry, claims, digital QR, physical request and admin fulfillment passed.'
  )
  console.log(`Screenshots: ${output}`)
} finally {
  await browser?.close()
  server.kill()
}
