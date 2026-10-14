import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { chromium, webkit, devices } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import QRCode from 'qrcode'

const useWebkit = process.argv.includes('--webkit')
const port = useWebkit ? 5195 : 5194,
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
      VITE_SUPABASE_URL: `${origin}/card-test-api`,
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
const output = path.resolve(useWebkit ? 'output/latido-card/webkit' : 'output/latido-card')
const errors = []
const failedRequests = []
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
  browser = await (useWebkit ? webkit : chromium).launch({ headless: true })
  const context = await browser.newContext({
    ...devices[useWebkit ? 'iPhone 13' : 'Pixel 7'],
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1
  })
  const cameraQrs = {
    card: await QRCode.toDataURL(`${origin}/c/${token}`, {
      width: 480,
      margin: 4
    }),
    business: await QRCode.toDataURL(`${origin}/scanner/link/${scannerToken}`, {
      width: 480,
      margin: 4
    }),
    invalid: await QRCode.toDataURL(`https://evil.test/scanner/link/${scannerToken}`, {
      width: 480,
      margin: 4
    })
  }
  await context.addInitScript(async (qrs) => {
    // Exercise the real decoder with a video stream containing a generated QR.
    // Hardware camera permission remains a separate real-device acceptance test.
    // Windows WebKit has no native media capture. Supply a synthetic preview
    // there while still exercising the real ZXing decoder and camera lifecycle.
    const syntheticPreview =
      !navigator.mediaDevices || !document.createElement('canvas').captureStream
    if (!navigator.mediaDevices) Object.defineProperty(navigator, 'mediaDevices', { value: {} })
    if (syntheticPreview) {
      Object.defineProperty(HTMLVideoElement.prototype, 'srcObject', {
        configurable: true,
        get() {
          return this.testStream || null
        },
        set(stream) {
          this.testStream = stream
        }
      })
      for (const [name, value] of Object.entries({
        videoWidth: 640,
        videoHeight: 640,
        paused: false,
        ended: false,
        currentTime: 1,
        readyState: 4
      })) {
        Object.defineProperty(HTMLVideoElement.prototype, name, {
          configurable: true,
          get() {
            return value
          }
        })
      }
      HTMLVideoElement.prototype.play = async function () {}
      const drawImage = CanvasRenderingContext2D.prototype.drawImage
      CanvasRenderingContext2D.prototype.drawImage = function (source, ...args) {
        if (source instanceof HTMLVideoElement && source.testStream?.testCanvas)
          source = source.testStream.testCanvas
        return drawImage.call(this, source, ...args)
      }
    }
    window.testCameraQrKind = 'blank'
    window.testCameraActive = 0
    window.testCameraRequests = 0
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: async () => {
        window.testCameraRequests++
        if (window.testCameraDenied)
          throw Object.assign(new Error('Denied'), { name: 'NotAllowedError' })
        const images = {}
        await Promise.all(
          Object.entries(qrs).map(async ([kind, qr]) => {
            const img = new Image()
            img.src = qr
            await img.decode()
            images[kind] = img
          })
        )
        const canvas = document.createElement('canvas')
        canvas.width = 640
        canvas.height = 640
        const draw = () => {
          const ctx = canvas.getContext('2d')
          ctx.fillStyle = 'white'
          ctx.fillRect(0, 0, 640, 640)
          const img = images[window.testCameraQrKind]
          if (img) ctx.drawImage(img, 80, 80, 480, 480)
        }
        draw()
        const timer = setInterval(draw, 80)
        const simulatedTrack = {
          kind: 'video',
          readyState: 'live',
          getCapabilities: () => ({}),
          getSettings: () => ({}),
          stop() {
            this.readyState = 'ended'
          }
        }
        const stream = syntheticPreview
          ? {
              testCanvas: canvas,
              getTracks: () => [simulatedTrack],
              getVideoTracks: () => [simulatedTrack]
            }
          : canvas.captureStream(12)
        stream.getTracks().forEach((track) => {
          window.testCameraActive++
          const stop = track.stop.bind(track)
          track.stop = () => {
            if (track.readyState !== 'ended') window.testCameraActive--
            clearInterval(timer)
            stop()
          }
        })
        return stream
      }
    })
  }, cameraQrs)
  let redeemCalls = [],
    receipt = null,
    claimed = false,
    savedOffers = [],
    digitalCalls = 0,
    customerCodeCalls = 0,
    customerCodeClockOffset = 0,
    businessSetupCalls = [],
    membershipMode = 'active',
    businessMode = 'multiple',
    offerPublishCalls = [],
    failNextOffer = false,
    newBusinessActive = false,
    newBusinessOffers = []
  const scannerOpenCalls = [],
    cardScanCalls = [],
    scannerConnections = [],
    scannerManageCalls = []
  let scannerBusinessName = '[TEST] Restaurante Sabor Latino'
  let physicalRequest = null,
    physicalCalls = []
  const offer = {
    id: '00000000-0000-4000-8000-000000000001',
    title: '[TEST] 15 % desde CHF 50',
    business_name: '[TEST] Restaurante Sabor Latino',
    city: 'Zürich',
    minimum_spend: 50,
    benefit_type: 'percent',
    benefit_value: 15,
    usage_period: 'month',
    usage_limit: 1,
    ends_at: new Date(Date.now() + 86400000).toISOString(),
    requires_claim: false,
    active: true,
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
  const additionalExamples = [
    {
      ...offer,
      id: '00000000-0000-4000-8000-000000000003',
      business_name: 'Peluquería Brisa Latina',
      city: 'Luzern',
      title: '10 % en tu corte',
      benefit_value: 10,
      minimum_spend: 0,
      usage_period: 'unlimited'
    },
    {
      ...offer,
      id: '00000000-0000-4000-8000-000000000004',
      business_name: 'Tienda Raíces',
      city: 'Bern',
      title: 'CHF 10 desde CHF 80',
      benefit_type: 'fixed',
      benefit_value: 10,
      minimum_spend: 80
    },
    {
      ...special,
      id: '00000000-0000-4000-8000-000000000005',
      business_name: 'Peluquería Brisa Latina',
      city: 'Luzern',
      title: 'Asesoría capilar',
      benefit_type: 'service',
      remaining: 0,
      description: 'Asesoría de 15 minutos con cita previa.'
    },
    {
      ...special,
      id: '00000000-0000-4000-8000-000000000006',
      business_name: 'Tienda Raíces',
      city: 'Bern',
      title: '2×1 en productos seleccionados',
      benefit_type: 'two_for_one',
      remaining: 9,
      claim: { status: 'used', expires_at: offer.ends_at }
    }
  ]
  const respond = (route, body, status = 200) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
      headers: {
        'access-control-allow-origin': origin,
        'access-control-allow-credentials': 'true',
        'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
        'access-control-allow-headers':
          'authorization,apikey,x-client-info,content-type,accept,prefer,accept-profile,content-profile,x-supabase-api-version'
      }
    })
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (
      (url.origin === origin && !url.pathname.startsWith('/card-test-api/')) ||
      url.protocol === 'blob:'
    )
      return route.continue()
    assert.equal(url.origin, origin, 'No third-party request should leave the test')
    if (route.request().method() === 'OPTIONS') return respond(route, null)
    const name = url.pathname.split('/').at(-1),
      args = route.request().method() === 'POST' ? route.request().postDataJSON() : {}
    if (name === 'lc_my_scanner_businesses') {
      const active = scannerConnections.filter((s) => s.linked_user_id === user.id && !s.revoked_at)
      return respond(
        route,
        [...new Set(active.map((s) => s.provider_id))].map((id) => ({
          id,
          name: active.find((s) => s.provider_id === id).business_name,
          session_ids: active.filter((s) => s.provider_id === id).map((s) => s.id)
        }))
      )
    }
    if (name === 'lc_resume_scanner') {
      assert.equal(route.request().headers().authorization, 'Bearer test-token')
      const source = scannerConnections.find(
        (s) => s.provider_id === args.p_provider && s.linked_user_id === user.id && !s.revoked_at
      )
      if (!source) return respond(route, { message: 'FORBIDDEN' }, 400)
      const connection = {
        ...source,
        id: `resumed-${scannerConnections.length}`,
        token: 'd'.repeat(60) + String(scannerConnections.length).padStart(4, '0')
      }
      scannerConnections.push(connection)
      return respond(route, { ...connection, session_id: connection.id })
    }
    if (name === 'lc_open_scanner') {
      assert.equal(
        route.request().headers().authorization,
        'Bearer test-token',
        'Only authenticated app binding can create Scanner access'
      )
      scannerOpenCalls.push(args)
      scannerBusinessName =
        args.p_link_token === 'e'.repeat(64) ? 'Punto Hispano Asesoría' : offer.business_name
      const connection = {
        token: sessionToken.slice(0, 60) + String(scannerOpenCalls.length).padStart(4, '0'),
        id: `session-${scannerOpenCalls.length}`,
        business_name: scannerBusinessName,
        provider_id: args.p_link_token === 'e'.repeat(64) ? 'new' : 'restaurant',
        linked_user_id: user.id,
        user_id: user.id,
        user_name: 'Ana',
        label: args.p_label,
        persistent: true,
        expires_at: null
      }
      scannerConnections.push(connection)
      return respond(route, { ...connection, session_id: connection.id })
    }
    if (name === 'lc_scanner_status') {
      const connection = scannerConnections.find((s) => s.token === args.p_session_token)
      if (!connection || connection.revoked_at)
        return respond(route, { message: 'SCANNER_EXPIRED' }, 400)
      return respond(route, { ...connection, session_id: connection.id })
    }
    if (name === 'lc_scan_card') {
      cardScanCalls.push(args)
      return respond(route, {
        member_name: 'Ana',
        member_number: 12847,
        offers: [offer]
      })
    }
    if (name === 'lc_scan_card_code') {
      const connected = scannerConnections.find(
        (s) => s.token === args.p_session_token && !s.revoked_at
      )
      if (!connected) return respond(route, { message: 'SCANNER_EXPIRED' }, 400)
      if (args.p_code !== '482736') return respond(route, { error: 'CARD_CODE_INVALID' })
      return respond(route, {
        card_token: 'f'.repeat(64),
        card: {
          member_name: 'Ana',
          member_number: 12847,
          business_name: connected.business_name,
          offers: [offer]
        }
      })
    }
    if (name === 'lc_redeem') {
      redeemCalls.push(args)
      if (!receipt) {
        receipt = {
          id: 'redemption-1',
          redeemed_at: new Date().toISOString(),
          reversed: false
        }
        return respond(route, { message: 'Transport failed after commit' }, 503)
      }
      return respond(route, receipt)
    }
    if (name === 'lc_close_scanner') {
      const connection = scannerConnections.find((s) => s.token === args.p_session_token)
      assert.ok(connection)
      connection.revoked_at = connection.disconnected_at = new Date().toISOString()
      return respond(route, null)
    }
    if (name === 'lc_manage_scanner') {
      scannerManageCalls.push(args)
      const connection = scannerConnections.find((s) => s.id === args.p_session)
      assert.ok(connection)
      connection.revoked_at = new Date().toISOString()
      if (args.p_action === 'delete') connection.hidden_at = connection.revoked_at
      return respond(route, null)
    }
    if (name === 'lc_business_dashboard')
      return respond(route, {
        businesses: [
          {
            id: 'restaurant',
            name: offer.business_name,
            active: true,
            participating: true
          },
          {
            id: 'salon',
            name: 'Peluquería Brisa Latina',
            active: true,
            participating: true
          },
          {
            id: 'shop',
            name: 'Tienda Raíces',
            active: true,
            participating: true
          },
          {
            id: 'new',
            name: 'Punto Hispano Asesoría',
            active: newBusinessActive,
            participating: newBusinessActive
          }
        ].filter((business) =>
          businessMode === 'none' ? false : businessMode === 'single' ? business.id === 'new' : true
        ),
        offers:
          args.p_provider === 'restaurant'
            ? [offer, special]
            : args.p_provider === 'new'
              ? newBusinessOffers
              : [],
        sessions: scannerConnections
          .filter((s) => s.provider_id === args.p_provider && !s.hidden_at)
          .map(({ token: _token, ...row }) => row),
        history: []
      })
    if (name === 'lc_business_setup') {
      businessSetupCalls.push(args)
      if (args.p_provider === 'new') newBusinessActive = true
      return respond(route, {
        token: args.p_link_token || (args.p_provider === 'new' ? 'e'.repeat(64) : scannerToken)
      })
    }
    if (name === 'lc_save_offer') {
      assert.equal(args.p_provider, 'new')
      offerPublishCalls.push(args)
      if (failNextOffer) {
        failNextOffer = false
        return respond(route, { message: 'Unavailable before commit' }, 503)
      }
      newBusinessOffers.push({
        ...args.p_offer,
        id: `new-offer-${newBusinessOffers.length}`,
        active: true,
        requires_claim: args.p_offer.requires_claim
      })
      return respond(route, 'new-offer')
    }
    if (name === 'lc_save_favorite') {
      savedOffers = args.p_saved
        ? [...new Set([...savedOffers, args.p_offer])]
        : savedOffers.filter((id) => id !== args.p_offer)
      return respond(route, null)
    }
    if (name === 'lc_catalog')
      return respond(
        route,
        [offer, special, ...additionalExamples].map((o) => ({
          ...o,
          claim: undefined
        }))
      )
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
      return respond(route, {
        issued_before: false,
        requests: visible ? [visible] : []
      })
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
      return respond(route, {
        token,
        member_number: 12847,
        reference: physicalRequest.reference
      })
    }
    if (name === 'lc_member_home')
      return respond(route, {
        membership:
          membershipMode === 'none'
            ? null
            : {
                member_number: 12847,
                active: membershipMode === 'active',
                valid_until: offer.ends_at
              },
        saved_offers: savedOffers,
        offers: [
          offer,
          {
            ...special,
            remaining: claimed ? 19 : 20,
            claim: claimed ? { status: 'claimed', expires_at: offer.ends_at } : null
          },
          ...additionalExamples
        ],
        history: []
      })
    if (name === 'lc_issue_card_code') {
      customerCodeCalls++
      return respond(route, {
        code: String(482735 + customerCodeCalls).padStart(6, '0'),
        expires_at: new Date(Date.now() + customerCodeClockOffset + 300000).toISOString()
      })
    }
    if (name === 'lc_issue_digital_card') {
      digitalCalls++
      return respond(route, {
        token,
        expires_at: new Date(Date.now() + customerCodeClockOffset + 300000).toISOString()
      })
    }
    if (name === 'lc_claim_offer') {
      claimed = true
      return respond(route, { status: 'claimed' })
    }
    if (name === 'lc_release_claim') {
      claimed = false
      return respond(route, null)
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
  const user = {
    id: '00000000-0000-4000-8000-000000000099',
    email: 'ana@test.example',
    app_metadata: { provider: 'email' },
    user_metadata: { name: 'Ana', latido_onboarding_completed: true }
  }
  const page = await context.newPage()
  page.on('pageerror', (err) => {
    errors.push(err.message)
    console.error('Browser error on', page.url(), err.message)
  })
  page.on('requestfailed', (request) =>
    failedRequests.push({ url: request.url(), reason: request.failure()?.errorText })
  )
  await mkdir(output, { recursive: true })
  await page.goto(
    `${origin}/card/scanner/vincular#${new URLSearchParams({ token: scannerToken, fingerprint: scannerToken, label: 'Scanner' })}`
  )
  await page.waitForURL('**/auth?**')
  assert.ok(!page.url().includes(scannerToken))
  assert.equal(
    await page.evaluate(
      () => JSON.parse(sessionStorage.getItem('latido_card_scanner_connection_v1')).token
    ),
    scannerToken,
    'Recover the invite when iOS opens a different browser context'
  )
  await page.goto(`${origin}/scanner/?camera=1`)
  await page.getByRole('dialog', { name: 'Scanner', exact: true }).waitFor()
  assert.equal(new URL(page.url()).search, '', 'Camera launch is not repeated on reload')
  await page.screenshot({
    animations: 'disabled',
    path: path.join(output, 'scanner-camera-mobile.png')
  })
  await page.evaluate(() => {
    window.testCameraQrKind = 'card'
  })
  await page.getByRole('alert').filter({ hasText: 'Primero escanea el QR interno' }).waitFor()
  assert.equal(cardScanCalls.length, 0, 'No customer access before linking a business')
  await page.evaluate(() => {
    window.testCameraQrKind = 'invalid'
  })
  await page.getByRole('button', { name: 'Scanner', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: 'Escanea el QR interno de un negocio' }).waitFor()
  assert.equal(scannerOpenCalls.length, 0, 'External QRs cannot grant access')
  await page.evaluate(() => {
    window.testCameraQrKind = 'business'
  })
  await page.getByRole('button', { name: 'Scanner', exact: true }).click()
  await page.waitForURL('**/auth?**')
  assert.equal(new URL(page.url()).searchParams.get('next'), '/card/scanner/vincular')
  assert.ok(!page.url().includes(scannerToken), 'No private token in the login URL')
  await page
    .getByText('Conecta con el negocio usando tu cuenta de Latido.', { exact: false })
    .waitFor()
  await page.getByRole('button', { name: 'Créala gratis', exact: true }).click()
  await page.getByRole('heading', { name: 'Crea tu cuenta', exact: true }).waitFor()
  assert.equal(new URL(page.url()).searchParams.get('next'), '/card/scanner/vincular')
  await page
    .getByText('Esta cuenta gratuita identifica tu acceso como trabajador.', { exact: false })
    .waitFor()
  assert.equal(scannerOpenCalls.length, 0, 'Business binding requires a real account')
  await page.evaluate(
    (user) =>
      localStorage.setItem(
        'sb-127-auth-token',
        JSON.stringify({
          access_token: 'test-token',
          refresh_token: 'test-refresh',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user
        })
      ),
    user
  )
  await page.goto(`${origin}/card/scanner/vincular`)
  await page.getByRole('dialog', { name: 'Scanner', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Cerrar cámara', exact: true }).click()
  await page.getByText(offer.business_name, { exact: true }).waitFor()
  assert.equal(scannerOpenCalls.length, 1)
  assert.equal(scannerOpenCalls[0].p_link_token, scannerToken)
  await page.waitForFunction(() => window.testCameraActive === 0)
  await page.getByRole('button', { name: 'Desconectar este dispositivo' }).click()
  await page.getByRole('heading', { name: 'Escanea y conecta.' }).waitFor()
  await page.goto(`${origin}/scanner/link/${scannerToken}`)
  assert.equal(
    await page
      .locator('details')
      .first()
      .evaluate((el) => el.open),
    false
  )
  await page.getByRole('button', { name: 'Scanner', exact: true }).click()
  await page.getByRole('dialog', { name: 'Scanner', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Cerrar cámara', exact: true }).click()
  await page.getByRole('button', { name: 'Desconectar este dispositivo' }).click()
  await page.getByRole('heading', { name: 'Escanea y conecta.' }).waitFor()
  await page.goto(`${origin}/scanner/link/${scannerToken}`)
  await page
    .getByText('Vincular con un enlace o poner nombre al dispositivo', {
      exact: true
    })
    .click()
  await page.getByLabel('Nombre de este Scanner').fill('Caja 1')
  await page.getByRole('button', { name: 'Continuar en navegador' }).click()
  await page.getByRole('dialog', { name: 'Scanner', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Cerrar cámara', exact: true }).click()
  await page.getByRole('button', { name: 'Scanner', exact: true }).waitFor()
  assert.equal(scannerOpenCalls.at(-1).p_label, 'Caja 1')
  await page.getByText('Ana · Conexión permanente', { exact: true }).waitFor()
  const persistentAccess = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('latido_card_scanner_v1'))
  )
  assert.equal(persistentAccess.persistent, true)
  assert.equal(persistentAccess.expires_at, null)
  assert.equal(persistentAccess.user_name, 'Ana')
  assert.equal(await page.evaluate(() => sessionStorage.getItem('latido_card_scanner_v1')), null)
  const reopenedScanner = await context.newPage()
  await reopenedScanner.goto(`${origin}/scanner/`)
  await reopenedScanner.getByText('Ana · Conexión permanente', { exact: true }).waitFor()
  assert.equal(scannerOpenCalls.length, 3, 'A new tab reuses permanent local access')
  await reopenedScanner.close()
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
    await page.evaluate(() => JSON.parse(localStorage.getItem('sb-127-auth-token')).user.id),
    user.id,
    'Scanner must preserve the personal account used for binding'
  )
  await page.evaluate(() => {
    window.testCameraQrKind = 'blank'
  })
  await page.getByRole('button', { name: 'Scanner', exact: true }).click()
  await page.getByRole('dialog', { name: 'Scanner', exact: true }).waitFor()
  await page.waitForFunction(() => window.testCameraActive > 0)
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => window.testCameraActive === 0)
  await page.evaluate(() => {
    window.testCameraDenied = true
  })
  await page.getByRole('button', { name: 'Scanner', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: 'Activa los permisos de la cámara' }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Volver a pedir permiso' }).count(), 0)
  await page.getByText('Cómo activar los permisos de la cámara', { exact: true }).click()
  const browserGuide = page.getByRole('group', { name: 'Elige tu navegador' })
  assert.equal(await browserGuide.getByRole('button').count(), 3)
  await page
    .getByText(
      useWebkit ? 'iPhone / iPad · ¿Cuál es tu navegador?' : 'Android · ¿Cuál es tu navegador?',
      { exact: true }
    )
    .waitFor()
  await browserGuide.getByRole('button', { name: 'Firefox', exact: true }).click()
  assert.equal(
    await browserGuide
      .getByRole('button', { name: 'Firefox', exact: true })
      .getAttribute('aria-pressed'),
    'true'
  )
  assert.ok((await page.locator('.lc-camera-help ol').innerText()).includes('Firefox'))
  await page.screenshot({
    animations: 'disabled',
    path: path.join(output, 'scanner-camera-help.png'),
    fullPage: true
  })
  const cameraRequestsBeforeManual = await page.evaluate(() => window.testCameraRequests)
  await page.getByRole('button', { name: 'Introducir manualmente', exact: true }).click()
  await page.getByRole('dialog', { name: 'Introducir manualmente', exact: true }).waitFor()
  await page.getByLabel('Código del cliente', { exact: true }).fill('123')
  await page.getByRole('button', { name: 'Consultar tarjeta', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: 'Introduce las 6 cifras' }).waitFor()
  await page.getByLabel('Código del cliente', { exact: true }).fill('111 111')
  await page.getByRole('button', { name: 'Consultar tarjeta', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: 'El código no es válido' }).waitFor()
  assert.equal(await page.evaluate(() => window.testCameraRequests), cameraRequestsBeforeManual)
  await page.screenshot({
    animations: 'disabled',
    path: path.join(output, 'scanner-manual-entry.png'),
    fullPage: true
  })
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await page.getByRole('button', { name: 'Scanner', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: 'Activa los permisos de la cámara' }).waitFor()
  const deniedCalls = await page.evaluate(() => window.testCameraRequests)
  await page.getByRole('button', { name: 'Cerrar cámara', exact: true }).click()
  await page.getByRole('button', { name: 'Scanner', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: 'Activa los permisos de la cámara' }).waitFor()
  assert.equal(await page.evaluate(() => window.testCameraRequests), deniedCalls + 1)
  await page.evaluate(() => {
    window.testCameraDenied = false
    window.testCameraQrKind = 'blank'
  })
  await page.getByRole('button', { name: 'Cerrar cámara', exact: true }).click()
  await page.getByRole('button', { name: 'Scanner', exact: true }).click()
  await page.waitForFunction(() => window.testCameraActive > 0)
  await page.getByRole('alert').waitFor({ state: 'detached' })
  await page.getByRole('button', { name: 'Cerrar cámara', exact: true }).click()
  assert.equal(await page.getByText('Usar enlace de tarjeta', { exact: true }).count(), 0)
  assert.equal(
    await page.getByText('Solicitar acceso habitual al propietario', { exact: true }).count(),
    0
  )
  await page.evaluate(() => {
    window.testCameraQrKind = 'card'
  })
  await page.getByRole('button', { name: 'Scanner', exact: true }).click()
  await page.getByRole('heading', { name: 'Ana · Socio #12847' }).waitFor()
  // Same result and redemption pipeline, now entered manually with no camera.
  await page.getByRole('button', { name: 'Introducir manualmente', exact: true }).click()
  await page.getByLabel('Código del cliente', { exact: true }).fill('482 736')
  const requestsBeforeLookup = await page.evaluate(() => window.testCameraRequests)
  await page.getByRole('button', { name: 'Consultar tarjeta', exact: true }).click()
  await page.getByRole('dialog').waitFor({ state: 'detached' })
  assert.equal(await page.evaluate(() => window.testCameraRequests), requestsBeforeLookup)
  assert.equal(await page.getByRole('button', { name: 'Canjear', exact: true }).isDisabled(), true)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Canjear', exact: true }).click()
  await page.getByRole('button', { name: 'Reintentar el mismo canje' }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Scanner', exact: true }).isDisabled(), true)
  const opensBeforePendingReload = scannerOpenCalls.length
  await page.goto(`${origin}/scanner/link/${'e'.repeat(64)}?camera=1`)
  await page.getByRole('button', { name: 'Reintentar el mismo canje' }).waitFor()
  assert.equal(
    await page.getByRole('dialog').count(),
    0,
    'Pending redemption blocks automatic camera launch'
  )
  assert.equal(
    scannerOpenCalls.length,
    opensBeforePendingReload,
    'Do not replace access during a pending redemption'
  )
  await page.evaluate((token) => {
    sessionStorage.setItem(
      'latido_card_scanner_connection_v1',
      JSON.stringify({
        token,
        label: 'Scanner',
        created_at: Date.now(),
        fingerprint: JSON.parse(localStorage.getItem('latido_card_scanner_v1')).link_fingerprint
      })
    )
  }, scannerToken)
  await page.goto(`${origin}/card/scanner/vincular`)
  await page.getByRole('alert').filter({ hasText: 'Hay un canje pendiente de confirmar' }).waitFor()
  assert.equal(
    scannerOpenCalls.length,
    opensBeforePendingReload,
    'The authenticated bridge also protects a pending redemption'
  )
  await page.goto(`${origin}/scanner/`)
  await page.getByRole('button', { name: 'Reintentar el mismo canje' }).click()
  await page.getByRole('heading', { name: '✓ Ventaja utilizada' }).waitFor()
  assert.equal(redeemCalls.length, 2)
  assert.equal(redeemCalls[0].p_request_id, redeemCalls[1].p_request_id)
  await mkdir(output, { recursive: true })
  await page.screenshot({
    animations: 'disabled',
    path: path.join(output, 'scanner-mobile.png'),
    fullPage: true
  })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await page.getByRole('button', { name: 'Desconectar este dispositivo' }).click()
  await page.getByRole('heading', { name: 'Escanea y conecta.' }).waitFor()
  await page.evaluate(() => localStorage.removeItem('sb-127-auth-token'))
  await page.goto(`${origin}/card`)
  await page.getByRole('heading', { name: 'Ahorra en los negocios de tu comunidad' }).waitFor()
  await page
    .locator('.lc-card-intro')
    .screenshot({ animations: 'disabled', path: path.join(output, 'card-new-user-mobile.png') })
  await page.getByRole('heading', { name: 'Café gratis' }).waitFor()
  assert.equal(await page.locator('.lc-offer').count(), 6)
  for (const title of [
    '10 % en tu corte',
    'CHF 10 desde CHF 80',
    'Asesoría capilar',
    '2×1 en productos seleccionados'
  ])
    await page.getByRole('heading', { name: title, exact: true }).waitFor()
  assert.ok(
    (await page.locator('.lc-page').evaluate((el) => getComputedStyle(el).fontFamily)).includes(
      'Poppins'
    )
  )
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await page.screenshot({
    animations: 'disabled',
    path: path.join(output, 'card-public-mobile.png'),
    fullPage: true
  })
  await page.evaluate(
    (user) =>
      localStorage.setItem(
        'sb-127-auth-token',
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
  // Allow the existing profile's creator-data preload to settle before leaving
  // that route; WebKit reports requests attempted by a discarded document.
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: /Mi Tarjeta Latido/ }).click()
  assert.equal(new URL(page.url()).pathname, '/card')
  await page.getByAltText('QR de Tarjeta Latido').waitFor()
  assert.equal(digitalCalls, 1, 'The card is ready without a manual QR button')
  await page.getByLabel('Código del cliente', { exact: true }).waitFor()
  assert.equal(
    customerCodeCalls,
    1,
    'Opening the card issues one code automatically, including in StrictMode'
  )
  assert.equal(await page.getByLabel('Código del cliente', { exact: true }).innerText(), '482 736')
  await page.screenshot({
    animations: 'disabled',
    path: path.join(output, 'card-ready-mobile.png'),
    fullPage: true
  })
  assert.equal(await page.locator('.lc-card-intro').count(), 0)
  assert.equal(
    await page.getByRole('navigation', { name: 'Navegación de Tarjeta Latido' }).count(),
    1
  )
  assert.equal(
    await page.getByRole('button', { name: 'Publicar', exact: true }).count(),
    0,
    'Bottom navigation must be hidden'
  )
  assert.equal(await page.getByRole('tab').count(), 2)
  assert.equal(await page.getByRole('tab', { name: 'Guardadas', exact: true }).count(), 0)
  assert.equal(
    await page
      .getByText('Listo para escanear · Se renueva automáticamente', {
        exact: true
      })
      .count(),
    0
  )
  const headingBox = await page
    .getByRole('heading', { name: 'Ventajas para ti', exact: true })
    .boundingBox()
  const tabsBox = await page
    .getByRole('tablist', { name: 'Tus ventajas', exact: true })
    .boundingBox()
  assert.ok(headingBox.y < tabsBox.y)
  assert.ok(
    (await page.locator('.lc-offer-row').first().boundingBox()).height < 220,
    'Coupons should stay compact'
  )
  assert.equal(
    await page.locator('.lc-member-card h1').evaluate((el) => getComputedStyle(el).fontStyle),
    'normal'
  )
  await page.evaluate(() =>
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data) => {
        window.testSharedOffer = data
      }
    })
  )
  await page
    .getByRole('button', {
      name: 'Compartir [TEST] 15 % desde CHF 50',
      exact: true
    })
    .click()
  const nativeShared = await page.evaluate(() => window.testSharedOffer)
  assert.equal(new URL(nativeShared.url).searchParams.get('oferta'), offer.id)
  assert.ok(!JSON.stringify(nativeShared).includes(token))
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: undefined
    })
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (value) => {
          window.testCopiedOffer = value
        }
      }
    })
  })
  await page.getByRole('button', { name: 'Compartir Café gratis', exact: true }).click()
  await page
    .getByText('Oferta copiada. Ya puedes enviarla por WhatsApp, mensaje o email.', { exact: true })
    .waitFor()
  const copiedOfferLink = (await page.evaluate(() => window.testCopiedOffer)).split('\n').at(-1)
  assert.equal(new URL(copiedOfferLink).searchParams.get('oferta'), special.id)
  await page.evaluate(() =>
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error('Permission denied')
        }
      }
    })
  )
  await page.getByRole('button', { name: 'Compartir Café gratis', exact: true }).click()
  const manualSharePanel = page.getByRole('region', {
    name: 'Compartir oferta',
    exact: true
  })
  await manualSharePanel.waitFor()
  assert.equal(
    await manualSharePanel.getByLabel('Enlace de la oferta').inputValue(),
    copiedOfferLink
  )
  await manualSharePanel.getByRole('button', { name: 'Cerrar', exact: true }).click()
  const compactOffer = page.locator('.lc-offer-row').filter({ hasText: '[TEST] 15 % desde CHF 50' })
  await compactOffer.getByRole('button', { name: 'Ver detalles', exact: true }).click()
  assert.equal(
    await compactOffer.getByText(/No acumulable con otras ventajas Latido/).isVisible(),
    true
  )
  await compactOffer.getByRole('button', { name: 'Ver detalles', exact: true }).click()
  assert.equal(
    await page
      .locator('.lc-offer')
      .filter({ hasText: 'Asesoría capilar' })
      .getByRole('button', { name: 'Agotada', exact: true })
      .isDisabled(),
    true
  )
  await page
    .locator('.lc-offer')
    .filter({ hasText: 'Café gratis' })
    .getByRole('button', { name: 'Activar', exact: true })
    .click()
  await page.getByRole('tab', { name: 'Activas', exact: true }).click()
  await page.getByRole('button', { name: 'Desactivar', exact: true }).waitFor()
  await page.screenshot({
    animations: 'disabled',
    path: path.join(output, 'card-activated-mobile.png'),
    fullPage: true
  })
  await page.getByRole('tab', { name: 'Disponibles', exact: true }).click()
  assert.equal(await page.getByRole('heading', { name: 'Café gratis', exact: true }).count(), 0)
  await page.getByText('⚙️ Gestionar mi tarjeta e historial', { exact: true }).click()
  await page.getByRole('button', { name: 'Solicitar tarjeta física', exact: true }).click()
  await page.getByLabel('Nombre para la entrega').fill('Ana Prueba')
  await page.getByLabel('Calle y número').fill('Calle Prueba 10')
  await page.getByLabel('Código postal').fill('6004')
  await page.getByLabel('Localidad').fill('Luzern')
  await page.getByRole('button', { name: 'Enviar solicitud a Latido', exact: true }).click()
  await page.getByText('LCP-000044 · Solicitada', { exact: true }).waitFor()
  assert.equal(physicalCalls.length, 1)
  assert.equal(physicalCalls[0].p_details.postal_code, '6004')
  await page.screenshot({
    animations: 'disabled',
    path: path.join(output, 'card-member-mobile.png'),
    fullPage: true
  })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.screenshot({
    animations: 'disabled',
    path: path.join(output, 'card-member-desktop.png'),
    fullPage: true
  })
  membershipMode = 'none'
  await page.reload()
  await page.getByRole('link', { name: 'Solicitar mi tarjeta', exact: true }).waitFor()
  assert.ok(
    (
      await page
        .getByRole('link', { name: 'Solicitar mi tarjeta', exact: true })
        .getAttribute('href')
    ).startsWith('mailto:info@latido.ch')
  )
  assert.equal(await page.locator('.lc-member-card').count(), 0)
  membershipMode = 'paused'
  const callsBeforePause = digitalCalls
  await page.reload()
  await page.getByRole('link', { name: 'Solicitar reactivación', exact: true }).waitFor()
  assert.equal(await page.getByAltText('QR de Tarjeta Latido').count(), 0)
  assert.equal(digitalCalls, callsBeforePause)
  membershipMode = 'active'
  await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem('sb-127-auth-token'))
    stored.user = {
      ...stored.user,
      email: 'admin@test.example',
      user_metadata: {
        name: 'Admin Latido',
        latido_onboarding_completed: true
      }
    }
    localStorage.setItem('sb-127-auth-token', JSON.stringify(stored))
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
  await queue.screenshot({
    animations: 'disabled',
    path: path.join(output, 'physical-admin-desktop.png')
  })
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
  await queue.screenshot({
    animations: 'disabled',
    path: path.join(output, 'physical-admin-mobile.png')
  })
  await page.goto(`${origin}/card/negocios`)
  await page.getByAltText('QR interno del negocio').waitFor()
  assert.equal(
    await page.getByLabel('Selecciona tu negocio').inputValue(),
    'restaurant',
    'An existing business is selected automatically'
  )
  await page.getByLabel('Selecciona tu negocio').selectOption('new')
  await page.getByRole('heading', { name: 'Punto Hispano Asesoría', exact: true }).waitFor()
  await page.getByText('Participación gratuita', { exact: true }).waitFor()
  await page.getByAltText('QR interno del negocio').waitFor()
  assert.equal(newBusinessActive, true, 'No administrator admission is required')
  const creator = page.locator('details.lc-business-fold').filter({ hasText: 'Crear oferta' })
  const scanners = page
    .locator('details.lc-business-fold')
    .filter({ hasText: 'Scanners vinculados' })
  assert.equal(await creator.evaluate((el) => el.open), false)
  assert.equal(await scanners.evaluate((el) => el.open), false)
  const qrBox = await page.getByAltText('QR interno del negocio').boundingBox()
  const qrPanelBox = await page.locator('.lc-business-qr').boundingBox()
  assert.ok(Math.abs(qrBox.x + qrBox.width / 2 - qrPanelBox.x - qrPanelBox.width / 2) < 2)
  await scanners.locator('summary').click()
  await scanners
    .getByText(
      'Todavía no hay personal conectado. Comparte el QR del negocio para vincular sus dispositivos.',
      { exact: true }
    )
    .waitFor()
  await scanners.locator('summary').click()
  await creator.locator('summary').click()
  await creator.getByRole('button', { name: 'Continuar', exact: true }).click()
  await creator.getByRole('heading', { name: 'Paso 1 de 3 · Tu oferta', exact: true }).waitFor()
  await page.getByLabel('Título', { exact: true }).fill('10 % de bienvenida')
  await creator.screenshot({
    animations: 'disabled',
    path: path.join(output, 'card-business-wizard-step-1.png')
  })
  await creator.getByRole('button', { name: 'Continuar', exact: true }).click()
  await creator.getByRole('heading', { name: 'Paso 2 de 3 · Cómo se usa', exact: true }).waitFor()
  await page.getByLabel('Válido hasta (hora local)').fill('2027-12-31T18:00')
  await creator.screenshot({
    animations: 'disabled',
    path: path.join(output, 'card-business-wizard-step-2.png')
  })
  await creator.getByRole('button', { name: 'Continuar', exact: true }).click()
  await creator.getByRole('heading', { name: 'Paso 3 de 3 · Revisar', exact: true }).waitFor()
  await creator.screenshot({
    animations: 'disabled',
    path: path.join(output, 'card-business-wizard-review.png')
  })
  await creator.getByRole('button', { name: 'Anterior', exact: true }).click()
  assert.equal(await page.getByLabel('Válido hasta (hora local)').inputValue(), '2027-12-31T18:00')
  await creator.getByRole('button', { name: 'Continuar', exact: true }).click()
  await creator.getByRole('button', { name: 'Publicar oferta', exact: true }).click()
  await page
    .locator('.lc-offer')
    .getByRole('heading', { name: '10 % de bienvenida', exact: true })
    .waitFor()
  await page.waitForFunction(
    () => !document.querySelector('.lc-offer-wizard')?.closest('details')?.open
  )
  assert.equal(await creator.evaluate((el) => el.open), false)
  await page.getByAltText('QR interno del negocio').waitFor()
  assert.ok(
    businessSetupCalls.some(
      (args) => args.p_provider === 'new' && args.p_link_token === 'e'.repeat(64)
    ),
    'Refresh reuses the cached QR'
  )
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await page.screenshot({
    animations: 'disabled',
    path: path.join(output, 'card-business-mobile.png'),
    fullPage: true
  })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.screenshot({
    animations: 'disabled',
    path: path.join(output, 'card-business-desktop.png'),
    fullPage: true
  })
  await creator.locator('summary').click()
  await creator.getByLabel('Tipo de ventaja').selectOption('gift')
  await creator.getByLabel('Título', { exact: true }).fill('Regalo de bienvenida')
  await creator.getByRole('button', { name: 'Continuar', exact: true }).click()
  await creator.getByRole('radio', { name: /Promoción especial/ }).check()
  await creator.getByLabel('Unidades disponibles').fill('5')
  await creator.getByLabel('Válido hasta (hora local)').fill('2027-12-31T18:00')
  await creator.getByRole('button', { name: 'Continuar', exact: true }).click()
  failNextOffer = true
  await creator.getByRole('button', { name: 'Publicar oferta', exact: true }).click()
  await creator.getByRole('alert').waitFor()
  assert.equal(await creator.evaluate((el) => el.open), true)
  await creator.getByRole('heading', { name: 'Regalo de bienvenida', exact: true }).waitFor()
  await creator.getByRole('button', { name: 'Publicar oferta', exact: true }).click()
  await page
    .locator('.lc-offer')
    .getByRole('heading', { name: 'Regalo de bienvenida', exact: true })
    .waitFor()
  await page.waitForFunction(
    () => !document.querySelector('.lc-offer-wizard')?.closest('details')?.open
  )
  const specialPayload = offerPublishCalls.at(-1).p_offer
  assert.equal(specialPayload.benefit_value, null)
  assert.equal(specialPayload.stock_total, 5)
  assert.equal(specialPayload.usage_period, 'lifetime')
  assert.equal(specialPayload.usage_limit, 1)
  businessMode = 'single'
  await page.reload()
  await page.getByAltText('QR interno del negocio').waitFor()
  await page.getByRole('heading', { name: 'Punto Hispano Asesoría', exact: true }).waitFor()
  assert.equal(
    await page.getByLabel('Selecciona tu negocio').count(),
    0,
    'One business does not need a selector'
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({
    animations: 'disabled',
    path: path.join(output, 'card-business-single-mobile.png'),
    fullPage: true
  })
  const personalAuth = await page.evaluate(() => localStorage.getItem('sb-127-auth-token'))
  await page.evaluate(() =>
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data) => {
        window.testStaffShare = data
      }
    })
  )
  await page.getByRole('button', { name: 'Compartir enlace con el personal', exact: true }).click()
  const staffInvite = await page.evaluate(() => window.testStaffShare)
  const sharedStaffLink = staffInvite.url
  assert.equal(new URL(sharedStaffLink).pathname, `/scanner/link/${'e'.repeat(64)}`)
  assert.equal(new URL(sharedStaffLink).searchParams.get('camera'), '1')
  assert.ok(staffInvite.text.includes('cuenta gratis'))
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined })
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.testStaffCopy = text
        }
      }
    })
  })
  await page.getByRole('button', { name: 'Compartir enlace con el personal', exact: true }).click()
  await page.getByRole('status').filter({ hasText: 'Enlace copiado' }).waitFor()
  assert.ok((await page.evaluate(() => window.testStaffCopy)).endsWith(sharedStaffLink))
  await page.evaluate(() =>
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
  )
  await page.getByRole('button', { name: 'Compartir enlace con el personal', exact: true }).click()
  assert.equal(await page.getByLabel('Enlace para el personal').inputValue(), sharedStaffLink)
  const ownerScanner = page.getByRole('link', { name: 'Scanner', exact: true })
  assert.equal(
    new URL(await ownerScanner.getAttribute('href')).pathname,
    `/scanner/link/${'e'.repeat(64)}`
  )
  const opensBeforeOwnerLaunch = scannerOpenCalls.length
  await ownerScanner.click()
  await page.getByRole('dialog', { name: 'Scanner', exact: true }).waitFor()
  assert.equal(scannerOpenCalls.length, opensBeforeOwnerLaunch + 1)
  assert.equal(scannerOpenCalls.at(-1).p_link_token, 'e'.repeat(64))
  assert.equal(new URL(page.url()).pathname, '/scanner/')
  assert.equal(new URL(page.url()).search, '')
  assert.equal(await page.evaluate(() => localStorage.getItem('sb-127-auth-token')), personalAuth)
  await page.getByRole('button', { name: 'Cerrar cámara', exact: true }).click()
  await page.getByRole('link', { name: 'Mi negocio', exact: true }).click()
  await page.getByAltText('QR interno del negocio').waitFor()
  await page.getByRole('link', { name: 'Scanner', exact: true }).click()
  await page.getByRole('dialog', { name: 'Scanner', exact: true }).waitFor()
  assert.equal(
    scannerOpenCalls.length,
    opensBeforeOwnerLaunch + 1,
    'Reuse the existing access for the same business'
  )
  await page.getByRole('button', { name: 'Cerrar cámara', exact: true }).click()
  await page.getByRole('link', { name: 'Mi negocio', exact: true }).click()
  await page.getByAltText('QR interno del negocio').waitFor()
  const accountScanners = page
    .locator('details.lc-business-fold')
    .filter({ hasText: 'Scanners vinculados' })
  await accountScanners.locator('summary').click()
  const activeConnection = accountScanners
    .getByRole('listitem')
    .filter({ hasText: 'Conexión permanente' })
  await activeConnection.getByText('Ana', { exact: true }).waitFor()
  assert.equal(await accountScanners.getByText(/Turno hasta/).count(), 0)
  assert.equal(
    await accountScanners.getByRole('button', { name: 'Autorizar acceso habitual' }).count(),
    0
  )
  await accountScanners.screenshot({
    animations: 'disabled',
    path: path.join(output, 'scanner-accounts-mobile.png')
  })
  const revokedId = scannerConnections.at(-1).id
  await activeConnection.getByRole('button', { name: 'Revocar', exact: true }).click()
  await accountScanners.getByText('Revocado', { exact: true }).waitFor()
  assert.deepEqual(scannerManageCalls.at(-1), { p_session: revokedId, p_action: 'revoke' })
  await accountScanners.locator('summary').click()
  await page.getByRole('link', { name: 'Scanner', exact: true }).click()
  await page.getByRole('dialog', { name: 'Scanner', exact: true }).waitFor()
  assert.equal(
    scannerOpenCalls.length,
    opensBeforeOwnerLaunch + 2,
    'A revoked connection cannot be reused'
  )
  await page.getByRole('button', { name: 'Cerrar cámara', exact: true }).click()
  await page.getByRole('link', { name: 'Mi negocio', exact: true }).click()
  await page.getByAltText('QR interno del negocio').waitFor()
  await accountScanners.locator('summary').click()
  const removedId = scannerConnections.at(-1).id
  await activeConnection.getByRole('button', { name: 'Eliminar', exact: true }).click()
  await activeConnection.waitFor({ state: 'detached' })
  assert.deepEqual(scannerManageCalls.at(-1), { p_session: removedId, p_action: 'delete' })
  assert.equal(await accountScanners.getByText('Conexión permanente', { exact: true }).count(), 0)
  const disconnectedScanner = await context.newPage()
  await disconnectedScanner.goto(`${origin}/scanner/`)
  await disconnectedScanner.getByRole('heading', { name: 'Escanea y conecta.' }).waitFor()
  await disconnectedScanner.getByRole('alert').filter({ hasText: 'revocado' }).waitFor()
  await disconnectedScanner.close()
  await accountScanners.locator('summary').click()
  await page.getByRole('link', { name: 'Scanner', exact: true }).click()
  await page.getByRole('dialog', { name: 'Scanner', exact: true }).waitFor()
  await page.evaluate(() => {
    window.testCameraQrKind = 'business'
  })
  await page.getByText(offer.business_name, { exact: true }).waitFor()
  assert.equal(
    scannerOpenCalls.at(-1).p_link_token,
    scannerToken,
    'A linked Scanner also recognizes business QRs'
  )
  businessMode = 'none'
  await page.goto(`${origin}/card/negocios`)
  await page.getByRole('heading', { name: 'Conectado a', exact: true }).waitFor()
  const staffList = page.locator('.lc-staff-businesses')
  await page.waitForLoadState('networkidle')
  assert.equal(await staffList.getByRole('button').count(), 2)
  const beforeCachedSelection = scannerConnections.length
  await staffList
    .getByRole('button', { name: 'Punto Hispano Asesoría Abrir Scanner', exact: true })
    .click()
  await page.getByRole('dialog', { name: 'Scanner', exact: true }).waitFor()
  assert.equal(
    scannerConnections.length,
    beforeCachedSelection,
    'Switching business reuses the saved valid connection'
  )
  await page.getByRole('button', { name: 'Cerrar cámara', exact: true }).click()
  await page.getByText('Punto Hispano Asesoría', { exact: true }).waitFor()
  await page.goto(`${origin}/card/negocios`)
  await page.getByRole('heading', { name: 'Conectado a', exact: true }).waitFor()
  await page.waitForLoadState('networkidle')
  await page.screenshot({
    path: path.join(output, 'scanner-worker-businesses.png'),
    fullPage: true
  })
  // A new device has no local operational credential but the authenticated
  // account still has server-authorized connections to both businesses.
  await page.evaluate(() => {
    localStorage.removeItem('latido_card_scanner_v1')
    localStorage.removeItem('latido_card_scanner_sessions_v1')
  })
  await staffList
    .getByRole('button', { name: `${offer.business_name} Abrir Scanner`, exact: true })
    .click()
  await page.getByRole('dialog', { name: 'Scanner', exact: true }).waitFor()
  assert.equal(scannerConnections.length, beforeCachedSelection + 1)
  await page.getByRole('button', { name: 'Cerrar cámara', exact: true }).click()
  await page.goto(`${origin}/card/negocios`)
  await page.getByRole('link', { name: 'Registrar mi negocio', exact: true }).waitFor()
  await page.waitForLoadState('networkidle')
  assert.equal(await page.getByLabel('Selecciona tu negocio').count(), 0)
  assert.equal(await page.getByAltText('QR interno del negocio').count(), 0)
  const workerScanner = page.getByRole('link', { name: 'Scanner', exact: true })
  assert.equal(await workerScanner.getAttribute('href'), '/scanner/?camera=1')
  await workerScanner.click()
  await page.getByRole('dialog', { name: 'Scanner', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Cerrar cámara', exact: true }).click()
  await page.getByRole('button', { name: 'Conectar con código', exact: true }).click()
  await page.getByLabel('Código de conexión', { exact: true }).fill('e'.repeat(64))
  const beforeCodeConnection = scannerOpenCalls.length
  await page.getByRole('button', { name: 'Conectar', exact: true }).click()
  await page.getByRole('dialog', { name: 'Scanner', exact: true }).waitFor()
  assert.equal(scannerOpenCalls.length, beforeCodeConnection + 1)
  assert.equal(scannerOpenCalls.at(-1).p_link_token, 'e'.repeat(64))
  await page.getByRole('button', { name: 'Cerrar cámara', exact: true }).click()
  businessMode = 'multiple'
  await page.evaluate(() => localStorage.removeItem('sb-127-auth-token'))
  const opensBeforeSharedInvite = scannerOpenCalls.length
  await page.goto(sharedStaffLink)
  await page.waitForURL('**/auth?**')
  await page.getByRole('button', { name: 'Créala gratis', exact: true }).click()
  await page.getByRole('heading', { name: 'Crea tu cuenta', exact: true }).waitFor()
  assert.equal(new URL(page.url()).searchParams.get('next'), '/card/scanner/vincular')
  assert.equal(
    scannerOpenCalls.length,
    opensBeforeSharedInvite,
    'A shared link connects without scanning but still requires the worker account'
  )
  await page.goto(copiedOfferLink)
  const accountCta = page.getByRole('link', {
    name: 'Crear cuenta y conseguir mi tarjeta',
    exact: true
  })
  await accountCta.waitFor()
  assert.equal(await page.locator('.lc-offer-row--shared h3').innerText(), 'Café gratis')
  assert.equal(await page.locator('.lc-offer-row').first().locator('h3').innerText(), 'Café gratis')
  const nextOfferPath = new URL(await accountCta.getAttribute('href'), origin).searchParams.get(
    'next'
  )
  assert.equal(nextOfferPath, `/card?oferta=${special.id}`)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({
    animations: 'disabled',
    path: path.join(output, 'card-shared-offer-mobile.png'),
    fullPage: true
  })
  await accountCta.click()
  assert.equal(new URL(page.url()).pathname, '/auth')
  assert.equal(new URL(page.url()).searchParams.get('mode'), 'register')
  assert.equal(new URL(page.url()).searchParams.get('next'), nextOfferPath)
  // Expiry must not regenerate while the card stays open. Reopening it does.
  await page.waitForLoadState('networkidle')
  membershipMode = 'active'
  await page.evaluate((auth) => localStorage.setItem('sb-127-auth-token', auth), personalAuth)
  await page.clock.install({ time: Date.now() })
  await page.goto(`${origin}/card`)
  const codeOutput = page.getByLabel('Código del cliente', { exact: true })
  await codeOutput.waitFor()
  const initialOpenCode = await codeOutput.innerText()
  const openedCodeCalls = customerCodeCalls
  customerCodeClockOffset = 300001
  await page.clock.fastForward(300001)
  await page.getByText('Código caducado. Vuelve a abrir Mi tarjeta.', { exact: true }).waitFor()
  await page.waitForLoadState('networkidle')
  assert.equal(customerCodeCalls, openedCodeCalls, 'Five minutes open does not issue another code')
  assert.equal(await codeOutput.innerText(), initialOpenCode)
  await page.reload()
  await codeOutput.waitFor()
  assert.equal(customerCodeCalls, openedCodeCalls + 1, 'Reopening the card generates a fresh code')
  assert.notEqual(await codeOutput.innerText(), initialOpenCode)
  const beforeForegroundCode = await codeOutput.innerText()
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.waitForFunction((previous) => {
    const output = document.querySelector('[aria-label="Código del cliente"]')
    return output && output.textContent.trim() !== previous
  }, beforeForegroundCode)
  assert.equal(
    customerCodeCalls,
    openedCodeCalls + 2,
    'Returning to the card from the background also creates a fresh code'
  )
  if (errors.length) console.error('Failed requests:', failedRequests.slice(0, 8))
  assert.deepEqual(errors, [])
  console.log(
    'Latido Card browser: account-bound permanent Scanner, revoke/delete/disconnect, unified QR camera, pending redemption protection, Scanner isolation, claims, physical request and admin fulfillment passed.'
  )
  console.log(`Screenshots: ${output}`)
} catch (err) {
  for (const page of browser?.contexts().flatMap((context) => context.pages()) || []) {
    console.error(
      (
        await page
          .locator('body')
          .innerText()
          .catch(() => '')
      ).slice(0, 1200)
    )
    console.error(
      await page
        .evaluate(() => ({
          streams: window.testCameraActive,
          requests: window.testCameraRequests,
          capture: typeof document.createElement('canvas').captureStream,
          video: Array.from(document.querySelectorAll('video')).map((v) => ({
            width: v.videoWidth,
            height: v.videoHeight,
            paused: v.paused,
            ready: v.readyState,
            error: v.error?.message
          }))
        }))
        .catch(() => ({}))
    )
    await mkdir(output, { recursive: true })
    await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {})
  }
  throw err
} finally {
  await browser?.close()
  server.kill()
}
