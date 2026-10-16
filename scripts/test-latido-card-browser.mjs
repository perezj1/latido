import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { chromium, webkit, devices } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const useWebkit = process.argv.includes('--webkit'),
  port = useWebkit ? 5195 : 5194,
  origin = `http://127.0.0.1:${port}`
const server = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  {
    env: {
      ...process.env,
      VITE_SUPABASE_URL: `${origin}/card-test-api`,
      VITE_SUPABASE_ANON_KEY: 'card-test-public-key',
      VITE_ADMIN_EMAILS: 'admin@test.example',
      VITE_EVENTFROG_PROXY_URL: `${origin}/card-test-api/eventfrog`,
      VITE_EVENTFROG_EMBED_KEY: ''
    },
    stdio: 'pipe',
    windowsHide: true
  }
)
let serverOutput = '',
  browser,
  page
server.stdout.on('data', (data) => {
  serverOutput += data
})
server.stderr.on('data', (data) => {
  serverOutput += data
})
const output = path.resolve(`output/latido-card/${useWebkit ? 'webkit' : 'chromium'}`)
const errors = [],
  rpcCalls = [],
  useCalls = [],
  savedOffers = []
const providerId = '00000000-0000-4000-8000-000000000010',
  provider2 = '00000000-0000-4000-8000-000000000011'
const user = {
  id: '00000000-0000-4000-8000-000000000099',
  email: 'ana@test.example',
  app_metadata: { provider: 'email' },
  user_metadata: { name: 'Ana', canton: 'ZH', latido_onboarding_completed: true }
}
const offer = {
  id: '00000000-0000-4000-8000-000000000001',
  provider_id: providerId,
  title: '15 % desde CHF 50',
  business_name: 'Restaurante Sabor Latino',
  business_photo_url: '/partners/punto-hispano/logo.webp',
  city: 'Zürich',
  minimum_spend: 50,
  benefit_type: 'percent',
  benefit_value: 15,
  usage_period: 'month',
  usage_limit: 1,
  ends_at: new Date(Date.now() + 86400000 * 90).toISOString(),
  requires_claim: false,
  active: true,
  available: true,
  remaining: null,
  used_count: 0
}
const special = {
  ...offer,
  id: '00000000-0000-4000-8000-000000000002',
  title: 'Café gratis',
  benefit_type: 'gift',
  benefit_value: null,
  minimum_spend: 0,
  usage_period: 'lifetime',
  requires_claim: true,
  remaining: 2,
  available: false
}
const discoveryOffers = Array.from({ length: 12 }, (_, index) => ({
  ...offer,
  id: `00000000-0000-4000-8000-${String(300 + index).padStart(12, '0')}`,
  provider_id: `00000000-0000-4000-8000-${String(200 + index).padStart(12, '0')}`,
  title: `Descuento ${index + 1}`,
  business_name: index === 11 ? 'Café Encuentro' : `Negocio ${String(index + 1).padStart(2, '0')}`,
  city: index === 11 ? 'Genève' : 'Berna',
  activation_mode: index === 11 ? 'automatic' : 'manual',
  business_photo_url: null,
  usage_period: 'unlimited',
  available: true
}))
const emptyBusinessId = '00000000-0000-4000-8000-000000000250'
const discoveryBusinesses = [
  {
    id: providerId,
    name: offer.business_name,
    city: offer.city,
    photo_url: offer.business_photo_url
  },
  ...discoveryOffers.map((item) => ({
    id: item.provider_id,
    name: item.business_name,
    city: item.city,
    photo_url: item.business_photo_url
  })),
  { id: emptyBusinessId, name: 'Negocio sin descuentos', city: 'Basilea', photo_url: null }
]
let discoveryMode = false,
  directoryFailure = false
const pausedOffer = {
  ...offer,
  id: '00000000-0000-4000-8000-000000000050',
  title: 'Oferta pausada',
  active: false
}
let pausedDeleted = false,
  invitationEligible = false
let receipt = null,
  failFirstUse = true,
  membershipActive = true,
  hasMembership = true,
  homeFailures = 0,
  ownsBusiness = true,
  membershipValidUntil = null,
  businesses = [
    {
      id: providerId,
      name: offer.business_name,
      city: offer.city,
      photo_url: offer.business_photo_url,
      active: true,
      participating: true
    },
    { id: provider2, name: 'Peluquería Latina', active: true, participating: true }
  ]
const receipts = []
const accessToken = [
  Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
  Buffer.from(
    JSON.stringify({
      sub: user.id,
      email: user.email,
      aud: 'authenticated',
      role: 'authenticated',
      exp: Math.floor(Date.now() / 1000) + 3600
    })
  ).toString('base64url'),
  'test-signature'
].join('.')
const session = () => ({
  access_token: accessToken,
  refresh_token: 'test-refresh',
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  expires_in: 3600,
  token_type: 'bearer',
  user
})
try {
  let ready = false
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(origin)).ok) {
        ready = true
        break
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  assert.ok(ready, serverOutput)
  browser = await (useWebkit ? webkit : chromium).launch({ headless: true })
  const context = await browser.newContext({
    ...devices[useWebkit ? 'iPhone 13' : 'Pixel 7'],
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1
  })
  await context.addInitScript(() => {
    window.wakeRequests = 0
    window.wakeReleases = 0
    window.cardVibrations = []
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: (pattern) => {
        window.cardVibrations.push(pattern)
        return true
      }
    })
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: {
        request: async (type) => {
          if (type !== 'screen') throw Error('Unexpected wake lock')
          if (sessionStorage.getItem('lc-test-wake-denied'))
            throw Error('Wake lock permission denied')
          window.wakeRequests++
          const lock = new EventTarget()
          lock.released = false
          lock.release = async () => {
            if (!lock.released) {
              lock.released = true
              window.wakeReleases++
              lock.dispatchEvent(new Event('release'))
            }
          }
          return lock
        }
      }
    })
    window.cameraRequests = 0
    window.printRequests = 0
    window.print = () => {
      window.printRequests++
    }
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.lastCopiedText = text
        }
      }
    })
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data) => {
        window.lastSharedLink = data
      }
    })
    if (navigator.mediaDevices)
      navigator.mediaDevices.getUserMedia = () => {
        window.cameraRequests++
        throw Error('Camera must not be requested')
      }
  })
  const respond = (route, body, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.origin === origin && !url.pathname.startsWith('/card-test-api/'))
      return route.continue()
    if (url.origin !== origin && route.request().resourceType() === 'image') return route.abort()
    assert.equal(url.origin, origin, 'Tests must never reach the real backend')
    const name = url.pathname.split('/').at(-1),
      args = route.request().method() === 'POST' ? route.request().postDataJSON() : {}
    if (name === 'token') return respond(route, session())
    if (name === 'user') return respond(route, user)
    if (name === 'eventfrog') return respond(route, { events: [] })
    if (name === 'providers' && route.request().method() === 'POST')
      return respond(route, { id: provider2 })
    if (name === 'providers' && url.searchParams.has('user_id')) return respond(route, [])
    if (name === 'providers' && url.searchParams.get('id')?.startsWith('eq.')) {
      const id = url.searchParams.get('id').slice(3)
      const business = [...businesses, ...discoveryBusinesses].find((item) => item.id === id)
      return respond(
        route,
        business ? { ...business, city: business.city || 'Zürich', category: 'belleza' } : null
      )
    }
    if (name === 'providers')
      return respond(
        route,
        [...discoveryBusinesses, ...businesses].map((item) => ({
          id: item.id,
          category: item.id === providerId ? 'restaurante' : 'belleza',
          canton: item.city === 'Genève' ? 'GE' : item.city === 'Berna' ? 'BE' : 'ZH'
        }))
      )
    if (name === 'profiles' && route.request().headers().accept?.includes('vnd.pgrst.object'))
      return respond(route, { id: user.id, name: 'Ana', interests: [], banned: false })
    if (name.startsWith('lc_')) rpcCalls.push(name)
    if (name === 'lc_catalog')
      return respond(route, [offer, special, ...(discoveryMode ? discoveryOffers : [])])
    if (name === 'lc_participating_businesses') {
      if (directoryFailure)
        return respond(route, { code: 'PGRST202', message: 'Function missing' }, 404)
      return respond(
        route,
        discoveryMode
          ? discoveryBusinesses
          : businesses
              .filter((item) => item.active && item.participating)
              .map((item) => ({ id: item.id, name: item.name, city: 'Zürich', photo_url: null }))
      )
    }
    if (name === 'lc_member_home') {
      if (homeFailures > 0) {
        homeFailures--
        return respond(route, { message: 'Temporary connection failure' }, 503)
      }
      return respond(route, {
        membership: hasMembership
          ? {
              active: membershipActive,
              status: membershipActive ? 'active' : 'paused',
              member_number: 2481,
              valid_until: membershipActive
                ? membershipValidUntil || offer.ends_at
                : new Date(Date.now() - 86400000).toISOString()
            }
          : null,
        offers: [
          {
            ...offer,
            available: !receipts.some((r) => r.offer_id === offer.id),
            used_count: receipts.filter((r) => r.offer_id === offer.id).length,
            next_available_at: new Date(Date.now() + 86400000 * 30).toISOString(),
            validation: receipts.find(
              (r) => r.offer_id === offer.id && Date.parse(r.expires_at) > Date.now()
            )
              ? { id: receipts[0].id, expires_at: receipts[0].expires_at }
              : null
          },
          {
            ...special,
            available: false,
            used_count: receipts.filter((r) => r.offer_id === special.id).length,
            remaining: special.remaining - receipts.filter((r) => r.offer_id === special.id).length,
            claim: receipts.some((r) => r.offer_id === special.id) ? { status: 'used' } : null
          },
          ...(discoveryMode ? discoveryOffers : [])
        ],
        history: receipts.map((r) => ({
          id: r.id,
          offer_id: r.offer_id,
          provider_id: r.provider_id,
          offer_snapshot: r.offer,
          title: r.offer.title,
          business_name: r.business_name,
          redeemed_at: r.redeemed_at,
          source: 'member',
          display_valid_until: r.expires_at
        }))
      })
    }
    if (name === 'lc_business_benefits')
      return respond(route, {
        business: (discoveryMode ? discoveryBusinesses : businesses).find(
          (b) => b.id === args.p_provider
        ),
        offers: [offer, special, ...(discoveryMode ? discoveryOffers : [])].filter(
          (o) => o.provider_id === args.p_provider
        )
      })
    if (name === 'lc_use_offer') {
      useCalls.push(args)
      if (!receipt || receipt.offer_id !== args.p_offer) {
        const selected = [offer, special, ...discoveryOffers].find(
          (item) => item.id === args.p_offer
        )
        receipt = {
          id: `00000000-0000-4000-8000-${String(100 + receipts.length).padStart(12, '0')}`,
          offer_id: selected.id,
          provider_id: selected.provider_id,
          business_name: selected.business_name,
          offer: selected,
          valid: true,
          server_now: new Date().toISOString(),
          expires_at: new Date(Date.now() + 300000).toISOString(),
          redeemed_at: new Date().toISOString(),
          member_reference: '•••• 2481'
        }
        receipts.push(receipt)
      }
      if (failFirstUse) {
        failFirstUse = false
        return respond(route, { message: 'Network failure after commit' }, 503)
      }
      return respond(route, receipt)
    }
    if (name === 'lc_validation')
      return receipt && receipt.id === args.p_redemption
        ? respond(route, {
            ...receipt,
            server_now: new Date().toISOString(),
            valid: Date.parse(receipt.expires_at) > Date.now() && !receipt.reversed
          })
        : respond(route, { message: 'VALIDATION_NOT_FOUND' }, 400)
    if (name === 'lc_business_invitation')
      return respond(route, {
        business: invitationEligible ? { id: provider2, name: 'Peluquería Latina' } : null
      })
    if (name === 'lc_business_dashboard')
      return respond(route, {
        businesses: ownsBusiness ? businesses : [],
        offers:
          args.p_provider === providerId
            ? [offer, special, ...(!pausedDeleted ? [pausedOffer] : [])]
            : [],
        history: receipt
          ? [{ id: receipt.id, title: offer.title, redeemed_at: receipt.redeemed_at }]
          : []
      })
    if (name === 'lc_join_card_business') {
      businesses = businesses.map((item) =>
        item.id === args.p_provider ? { ...item, active: true, participating: true } : item
      )
      return respond(route, null)
    }
    if (name === 'lc_delete_offer') {
      assert.equal(args.p_offer, pausedOffer.id)
      pausedDeleted = true
      return respond(route, null)
    }
    if (name === 'lc_admin_overview')
      return respond(route, {
        members: [{ user_id: user.id, name: 'Ana', email: user.email }],
        businesses,
        stats: { active_members: 1, active_businesses: 2, active_offers: 2, uses: 1 },
        audit: []
      })
    if (name === 'lc_admin_enroll') return respond(route, user.id)
    if (name === 'lc_admin_business') return respond(route, null)
    if (name === 'lc_save_offer') {
      businesses = businesses.map((item) =>
        item.id === args.p_provider ? { ...item, active: true, participating: true } : item
      )
      savedOffers.push(args)
      return respond(route, offer.id)
    }
    return respond(route, [])
  })
  page = await context.newPage()
  page.on('pageerror', (error) => errors.push(error.message))
  await mkdir(output, { recursive: true })
  const businessPath = `/card/negocio/${providerId}?oferta=${offer.id}`
  await page.goto(origin + businessPath)
  await page.getByRole('heading', { name: 'Ofertas de este negocio', exact: true }).waitFor()
  await page.getByRole('link', { name: 'Inicia sesión', exact: true }).click()
  await page.waitForURL('**/auth?**')
  assert.equal(new URL(page.url()).searchParams.get('next'), businessPath)
  await page.getByPlaceholder('tu@email.com').fill(user.email)
  await page.getByPlaceholder('Tu contraseña').fill('Test-password-123!')
  await page.getByRole('button', { name: 'Entrar →', exact: true }).click()
  await page.waitForURL(origin + businessPath)
  await page.getByRole('heading', { name: offer.business_name, exact: true }).waitFor()
  await page
    .getByRole('region', { name: 'Negocio', exact: true })
    .getByRole('img', { name: `Imagen de ${offer.business_name}` })
    .waitFor()
  assert.equal(
    await page.getByRole('searchbox').count(),
    1,
    'Business offers always have a scoped search box'
  )
  assert.equal(
    await page.locator('.lc-discount-business').count(),
    0,
    'The business name is not repeated on each local offer'
  )
  assert.equal(
    await page.locator('.lc-membership-summary').count(),
    0,
    'The business page focuses on its offers'
  )
  await page.getByRole('button', { name: 'Compartir negocio', exact: true }).click()
  assert.equal(
    await page.evaluate(() => window.lastSharedLink.url),
    origin + `/card/negocio/${providerId}`
  )
  const scopedSearch = page.getByRole('searchbox', {
    name: 'Buscar en las ofertas de este negocio',
    exact: true
  })
  await scopedSearch.fill('sin-coincidencias-xyz')
  await page.getByText('No hay ofertas que coincidan con tu búsqueda.', { exact: true }).waitFor()
  assert.equal(
    await page.locator('.lc-discount-card').count(),
    0,
    'Search also filters an offer opened from a shared link'
  )
  await scopedSearch.fill('')
  await page.getByRole('tab', { name: 'Disponibles (2)', exact: true }).waitFor()
  await scopedSearch.blur()
  await page.screenshot({ path: path.join(output, 'business-detail-mobile.png'), fullPage: true })
  await page.setViewportSize({ width: 320, height: 568 })
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    'Business offers fit a narrow phone'
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('link', { name: 'Volver a los negocios', exact: true }).click()
  await page.waitForURL(origin + '/card')
  await page.locator('.lc-member-strip-heading').waitFor()
  const firstAccordion = page.locator('.lc-discount-card').filter({ hasText: offer.title })
  const secondAccordion = page.locator('.lc-discount-card').filter({ hasText: special.title })
  await firstAccordion.locator('.lc-discount-business').click()
  assert.equal(page.url(), origin + '/card', 'The business name toggles details without navigating')
  assert.equal(await firstAccordion.locator('.lc-discount-details').isVisible(), true)
  await secondAccordion.locator('.lc-discount-business').click()
  assert.equal(await firstAccordion.locator('.lc-discount-details').isVisible(), false)
  assert.equal(await secondAccordion.locator('.lc-discount-details').isVisible(), true)
  assert.equal(await page.locator('.lc-discount-details:visible').count(), 1)
  await firstAccordion.locator('.lc-discount-open').click()
  assert.equal(await firstAccordion.locator('.lc-discount-details').isVisible(), true)
  assert.equal(await secondAccordion.locator('.lc-discount-details').isVisible(), false)
  await firstAccordion.locator('.lc-discount-open').click()
  assert.equal(await page.locator('.lc-discount-details:visible').count(), 0)
  await page.getByRole('link', { name: 'Mi negocio', exact: true }).waitFor()
  assert.match(
    await page.locator('.lc-links').innerText(),
    /💳[\s\S]*🏪/,
    'Navigation keeps Latido emojis'
  )
  assert.ok(
    (await page.getByRole('navigation', { name: 'Navegación de Tarjeta Latido' }).boundingBox())
      .height < 65,
    'Card navigation stays compact'
  )
  assert.equal(
    await page
      .getByText('No se pudo guardar la sesión. Inténtalo de nuevo.', { exact: true })
      .count(),
    0
  )
  assert.equal(await page.locator('.lc-membership-summary .lc-qr').count(), 0)
  const membershipCard = page.locator('.lc-membership-summary .lc-membership-card')
  await page.evaluate(() => document.fonts.ready)
  assert.equal(await membershipCard.getAttribute('data-appearance'), 'light')
  await membershipCard.screenshot({
    path: path.join(output, 'membership-light-mobile.png'),
    animations: 'disabled'
  })
  assert.equal(await page.getByRole('radio', { name: /Clara|Oscura/ }).count(), 0)
  await page.evaluate((id) => localStorage.setItem(`latido-card-appearance:${id}`, 'dark'), user.id)
  await page.reload()
  await page.locator('.lc-member-strip-heading').waitFor()
  assert.equal(await membershipCard.getAttribute('data-appearance'), 'light')
  assert.equal(
    await page
      .getByRole('button', { name: /Scanner|tarjeta física|Generar nuevo código/i })
      .count(),
    0
  )
  assert.equal(await page.getByRole('button', { name: 'Reclamar', exact: true }).count(), 0)
  const homeCardLink = page.getByRole('link', { name: /^(Ver|Conseguir) Tarjeta Latido$/ })
  await page.goto(origin + '/')
  await homeCardLink
    .locator('.home-latido-card-number')
    .getByText('2481', { exact: true })
    .waitFor()
  await homeCardLink.getByText(/^Válida hasta /).waitFor()
  await page.waitForLoadState('networkidle')
  assert.equal(await homeCardLink.getAttribute('href'), '/card')
  await page.evaluate(() => document.fonts.ready)
  await page
    .locator('.hero-section')
    .screenshot({ path: path.join(output, 'home-membership-mobile.png'), animations: 'disabled' })
  await page.setViewportSize({ width: 320, height: 568 })
  const homeCardBounds = await homeCardLink.boundingBox()
  assert.ok(homeCardBounds.x >= 0 && homeCardBounds.x + homeCardBounds.width <= 320)
  await page.setViewportSize({ width: 390, height: 844 })
  await homeCardLink.click()
  await page.waitForURL(origin + '/card')
  await page.getByRole('heading', { name: 'Descuentos para ti', exact: true }).waitFor()
  membershipActive = false
  await page.goto(origin + '/')
  await homeCardLink.getByText('Membresía inactiva', { exact: true }).waitFor()
  await page.waitForLoadState('networkidle')
  assert.equal(await homeCardLink.getByText(/^Válida hasta /).count(), 0)
  membershipActive = true
  homeFailures = 10
  const failedHomeMembership = page.waitForResponse(
    (response) => response.url().endsWith('/lc_member_home') && response.status() === 503
  )
  await page.reload()
  await failedHomeMembership
  await page.waitForLoadState('networkidle')
  await homeCardLink.getByText('Tarjeta Latido', { exact: true }).waitFor()
  homeFailures = 0
  await homeCardLink.click()
  await page.waitForURL(origin + '/card')
  await page.locator('.lc-member-strip-heading').waitFor()
  await page.goto(origin + businessPath)
  await page.getByRole('heading', { name: offer.business_name, exact: true }).waitFor()
  const refreshFailureText =
    'No se pudieron actualizar tus descuentos. Comprueba tu conexión; volveremos a intentarlo.'
  homeFailures = 1
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await page.getByText(refreshFailureText, { exact: true }).waitFor()
  assert.equal(
    await page.locator('.lc-discount-card').count(),
    2,
    'A background failure keeps the last catalog'
  )
  assert.equal(
    await page.getByText(/No se pudo confirmar la operación/).count(),
    0,
    'Refresh errors describe loading, not consumption'
  )
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await page.getByText(refreshFailureText, { exact: true }).waitFor({ state: 'hidden' })
  homeFailures = 10
  await page.reload()
  await page.getByRole('alert').filter({ hasText: refreshFailureText }).waitFor()
  await page.getByRole('button', { name: 'Reintentar', exact: true }).waitFor()
  homeFailures = 0
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await page.getByRole('heading', { name: offer.business_name, exact: true }).waitFor()
  assert.equal(
    await page.getByRole('alert').filter({ hasText: refreshFailureText }).count(),
    0,
    'A successful refresh clears a previous load error'
  )
  const discountCard = page.locator('.lc-offer-row').filter({ hasText: offer.title })
  await discountCard.locator('.lc-offer-value-number').getByText('15 %', { exact: true }).waitFor()
  await page.evaluate(() => {
    window.originalShare = navigator.share
    window.originalClipboard = navigator.clipboard
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined })
  })
  const offerShareButton = discountCard.getByRole('button', {
    name: `Compartir ${offer.title}`,
    exact: true
  })
  await offerShareButton.click()
  const copiedToast = page.getByText('Enlace de la oferta copiado.', { exact: true })
  await copiedToast.waitFor()
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await page.waitForFunction(() => {
    const message = [...document.querySelectorAll('[role="status"]')].find(
      (el) => el.textContent.trim() === 'Enlace de la oferta copiado.'
    )
    if (!message) return false
    const bounds = message.getBoundingClientRect()
    return bounds.top >= 0 && bounds.bottom <= innerHeight
  })
  const copiedToastBounds = await copiedToast.boundingBox()
  assert.ok(
    copiedToastBounds.y >= 0 && copiedToastBounds.y + copiedToastBounds.height <= 844,
    'Copy feedback stays in view when scrolled'
  )
  await page.evaluate(() =>
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
  )
  await offerShareButton.click()
  const inlineShare = discountCard.getByLabel('Enlace de la oferta', { exact: true })
  await inlineShare.waitFor()
  assert.equal(await inlineShare.inputValue(), origin + `/card?oferta=${offer.id}`)
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: window.originalShare })
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: window.originalClipboard
    })
  })
  await offerShareButton.click()
  await inlineShare.waitFor({ state: 'detached' })
  const detailsButton = discountCard.getByRole('button', { name: offer.title, exact: true })
  const activateButton = discountCard.getByRole('button', { name: 'Usar ahora', exact: true })
  const activateBounds = await activateButton.boundingBox()
  const shareBounds = await offerShareButton.boundingBox()
  assert.ok(shareBounds.y < activateBounds.y, 'Share stays at the top right')
  assert.equal(
    await discountCard.getByRole('button', { name: 'Mostrar detalles', exact: true }).count(),
    0
  )
  assert.equal(
    await activateButton.evaluate((el) => getComputedStyle(el).backgroundColor),
    'rgb(36, 97, 235)'
  )
  await discountCard.screenshot({ path: path.join(output, 'discount-closed-mobile.png') })
  await detailsButton.click()
  assert.equal(
    await discountCard
      .getByRole('button', { name: offer.title, exact: true })
      .getAttribute('aria-expanded'),
    'true'
  )
  await discountCard.getByText('Compra mínima CHF 50', { exact: true }).waitFor()
  await discountCard.screenshot({
    path: path.join(output, 'discount-open-mobile.png'),
    animations: 'disabled'
  })
  await page
    .locator('.lc-offer-row')
    .filter({ hasText: offer.title })
    .getByRole('button', { name: /^(Activar|Usar ahora)$/ })
    .click()
  await page.getByRole('dialog', { name: '¿Usar este descuento ahora?' }).waitFor()
  assert.equal(
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Usar ahora', exact: true })
      .evaluate((el) => getComputedStyle(el).backgroundColor),
    'rgb(36, 97, 235)'
  )
  assert.equal(
    await page
      .getByRole('button', { name: 'Cancelar', exact: true })
      .evaluate((el) => getComputedStyle(el).color),
    'rgb(36, 85, 196)'
  )
  await page
    .getByRole('dialog')
    .getByRole('img', { name: `Imagen de ${offer.business_name}` })
    .waitFor()
  await page.screenshot({
    path: path.join(output, 'discount-confirm-mobile.png'),
    animations: 'disabled'
  })
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
  assert.equal(useCalls.length, 0, 'Cancel does not consume the offer')
  await page
    .locator('.lc-offer-row')
    .filter({ hasText: offer.title })
    .getByRole('button', { name: /^(Activar|Usar ahora)$/ })
    .click()
  await page.getByRole('dialog').getByRole('button', { name: 'Usar ahora', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: 'No se pudo confirmar' }).waitFor()
  await page.getByRole('dialog').getByRole('button', { name: 'Usar ahora', exact: true }).click()
  await page.waitForURL('**/card/validacion/**')
  await page.getByText('Descuento válido', { exact: true }).waitFor()
  await page.waitForFunction(() => window.wakeRequests > 0)
  assert.deepEqual(await page.evaluate(() => window.cardVibrations), [40])
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.waitForFunction(() => window.wakeReleases > 0)
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.getByText('Descuento válido', { exact: true }).waitFor()
  await page.waitForFunction(() => window.wakeRequests >= 2)
  assert.deepEqual(
    await page.evaluate(() => window.cardVibrations),
    [40],
    'Revalidation does not vibrate again'
  )
  await page.locator('.lc-proof-offer-title').getByText(offer.title, { exact: true }).waitFor()
  assert.equal(
    await page.locator('.lc-proof').evaluate((el) => getComputedStyle(el).backgroundColor),
    'rgb(255, 255, 255)'
  )
  await page.getByText('15%', { exact: true }).waitFor()
  assert.match(
    await page.locator('.lc-proof-meta time').innerText(),
    /\d{2}\/\d{2}\/\d{4}.*\d{2}:\d{2}:\d{2}/
  )
  assert.equal(await page.locator('.lc-proof-meta').getByText(/^Hora/).count(), 0)
  assert.ok(await page.locator('.lc-proof-seal').count())
  assert.equal(useCalls.length, 2)
  assert.equal(useCalls[0].p_request_id, useCalls[1].p_request_id, 'Retry reuses the request UUID')
  assert.equal(useCalls[0].p_offer, offer.id)
  await page.screenshot({ path: path.join(output, 'validation-mobile.png'), fullPage: true })
  const expires = receipt.expires_at
  const businessName = receipt.business_name
  receipt.business_name = '[TEST] Peluquería Brisa Latina'
  await page.reload()
  await page.getByText('Descuento válido', { exact: true }).waitFor()
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => {}))
    )
  )
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 390, height: 720 },
    { width: 360, height: 640 },
    { width: 320, height: 568 }
  ]) {
    await page.setViewportSize(viewport)
    const layout = await page.evaluate(() => {
      const proof = document.querySelector('.lc-proof').getBoundingClientRect()
      const back = document.querySelector('.lc-validation > .lc-button').getBoundingClientRect()
      return {
        proof: { top: proof.top, bottom: proof.bottom },
        back: { bottom: back.bottom },
        height: innerHeight,
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        children: [...document.querySelectorAll('.lc-proof > *')].map((el) => {
          const rect = el.getBoundingClientRect()
          return { name: el.className || el.id, bottom: rect.bottom, top: rect.top }
        })
      }
    })
    assert.ok(layout.proof.top >= 0 && layout.proof.bottom <= layout.height, JSON.stringify(layout))
    assert.ok(layout.back.bottom <= layout.height, 'Return button also fits the viewport')
    assert.ok(
      layout.scrollWidth <= layout.width && layout.scrollHeight <= layout.height + 1,
      JSON.stringify(layout)
    )
    for (const child of layout.children) {
      assert.ok(
        child.top >= layout.proof.top && child.bottom <= layout.proof.bottom + 1,
        `Clipped ${child.name} at ${viewport.width}x${viewport.height}: ${JSON.stringify(layout)}`
      )
    }
    await page.screenshot({
      path: path.join(output, `validation-${viewport.width}x${viewport.height}.png`)
    })
  }
  await page.setViewportSize({ width: 390, height: 844 })
  receipt.business_name = businessName
  await page.reload()
  await page.getByText('Descuento válido', { exact: true }).waitFor()
  assert.equal(receipt.expires_at, expires)
  assert.equal(useCalls.length, 2)
  await page.evaluate(() => window.dispatchEvent(new Event('offline')))
  await page.getByRole('alert').filter({ hasText: 'Conéctate a internet' }).waitFor()
  assert.equal(await page.getByText('Descuento válido', { exact: true }).count(), 0)
  await page.waitForFunction(() => window.wakeReleases > 0)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await page.getByText('Descuento válido', { exact: true }).waitFor()
  await page.evaluate(() => sessionStorage.setItem('lc-test-wake-denied', 'true'))
  await page.reload()
  await page.getByText('Descuento válido', { exact: true }).waitFor()
  assert.equal(
    await page.evaluate(() => window.wakeRequests),
    0,
    'Denied wake lock does not prevent using a valid receipt'
  )
  await page.evaluate(() => sessionStorage.removeItem('lc-test-wake-denied'))
  receipt.expires_at = new Date(Date.now() + 10000).toISOString()
  await page.reload()
  await page.getByText('Descuento válido', { exact: true }).waitFor()
  assert.equal(await page.locator('.lc-validation--ending').count(), 1)
  assert.equal(
    await page
      .locator('.lc-proof-timer-bar > div')
      .evaluate((el) => getComputedStyle(el).backgroundColor),
    'rgb(227, 139, 18)'
  )
  // Expire while this page stays open: no reload and no extra use request.
  await page.getByRole('heading', { name: 'Validación finalizada', exact: true }).waitFor()
  assert.equal(await page.getByText('Descuento válido', { exact: true }).count(), 0)
  await page.getByRole('link', { name: 'Volver a mi tarjeta', exact: true }).click()
  await page.waitForURL(origin + '/card')
  await page.getByRole('heading', { name: 'Descuentos para ti', exact: true }).waitFor()
  await page.locator('#lc-tab-available[aria-selected="true"]').waitFor()
  assert.equal(
    await page.locator('.lc-business-heading').count(),
    0,
    'Returning shows the normal card page, without a business heading'
  )
  await page.getByRole('tab', { name: /^Usados \(/ }).click()
  await page.locator('#lc-tab-used[aria-selected="true"]').waitFor()
  await page.getByText('Usado', { exact: true }).first().waitFor()
  assert.equal(await page.locator('.lc-use-row').count(), 1)
  await page.getByRole('tab', { name: /^Disponibles \(/ }).click()
  await page.getByRole('heading', { name: special.title, exact: true }).waitFor()
  const usedMonthlyCard = page.locator('.lc-discount-card').filter({ hasText: offer.title })
  await usedMonthlyCard.getByText(/^Disponible de nuevo el/).waitFor()
  assert.equal(
    await usedMonthlyCard.getByRole('button', { name: /^(Activar|Usar ahora)$/ }).isDisabled(),
    true
  )
  await usedMonthlyCard.screenshot({
    path: path.join(output, 'used-discount-available-mobile.png')
  })
  await page
    .locator('.lc-discount-card')
    .filter({ hasText: special.title })
    .getByRole('button', { name: /^(Activar|Usar ahora)$/ })
    .click()
  await page.getByRole('dialog').getByRole('button', { name: 'Usar ahora', exact: true }).click()
  await page.getByText('Descuento válido', { exact: true }).waitFor()
  await page.getByText('Regalo', { exact: true }).waitFor()
  assert.equal(useCalls.at(-1).p_offer, special.id)
  assert.ok(!rpcCalls.includes('lc_claim_offer'))
  await page.getByRole('link', { name: 'Volver a mi tarjeta', exact: true }).click()
  await page.waitForURL(origin + '/card')
  await page.locator('#lc-tab-available[aria-selected="true"]').waitFor()
  await page.getByRole('tab', { name: /^Usados \(/ }).click()
  await page.locator('#lc-tab-used[aria-selected="true"]').waitFor()
  assert.equal(await page.locator('.lc-use-row').count(), 2)
  assert.equal(
    await page.locator('.lc-use-row button').count(),
    0,
    'History never offers activation or reopening, even for a live receipt'
  )
  assert.equal(await page.getByRole('button', { name: /^(Activar|Mostrar)$/ }).count(), 0)
  await page.screenshot({ path: path.join(output, 'member-mobile.png'), fullPage: true })
  // Local history shows each used offer once, using its latest redemption, without actions.
  const usesBeforeBusinessVisit = useCalls.length
  const duplicateUse = {
    ...receipts[0],
    id: '00000000-0000-4000-8000-000000000970',
    redeemed_at: new Date(Date.now() + 1000).toISOString()
  }
  receipts.push(duplicateUse)
  await page.goto(origin + `/card/negocio/${providerId}`)
  await page.getByRole('tab', { name: 'Usadas (2)', exact: true }).click()
  assert.equal(await page.locator('.lc-business-used-offer').count(), 2)
  assert.equal(
    await page.locator('.lc-business-used-offer button, .lc-business-used-offer a').count(),
    0
  )
  assert.equal(
    await page
      .locator('.lc-business-used-offer')
      .filter({ hasText: offer.title })
      .locator('time')
      .getAttribute('datetime'),
    duplicateUse.redeemed_at
  )
  await scopedSearch.fill(special.title)
  assert.equal(await page.locator('.lc-business-used-offer').count(), 1)
  await scopedSearch.fill('sin-coincidencias-xyz')
  await page.getByText('No hay ofertas que coincidan con tu búsqueda.', { exact: true }).waitFor()
  await scopedSearch.fill('')
  await page.screenshot({ path: path.join(output, 'business-used-mobile.png'), fullPage: true })
  await page.getByRole('tab', { name: 'Usadas (2)', exact: true }).focus()
  await page.keyboard.press('ArrowLeft')
  await page.locator('#lc-tab-available[aria-selected="true"]').waitFor()
  await page.locator('.lc-business-offer-guide summary').click()
  await page.getByText('Confirma el uso para activar tu oferta.', { exact: true }).waitFor()
  assert.equal(
    useCalls.length,
    usesBeforeBusinessVisit,
    'Browsing business offers and history never consumes a use'
  )
  receipts.pop()
  await page.getByRole('link', { name: 'Volver a los negocios', exact: true }).click()
  await page.waitForURL(origin + '/card')
  await page.locator('.lc-member-strip-heading').waitFor()
  await page.getByRole('link', { name: 'Mi negocio', exact: true }).click()
  await page.getByRole('heading', { name: 'El QR de tu negocio', exact: true }).waitFor()
  await page.getByAltText(`QR público de ${offer.business_name}`).waitFor()
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => {}))
    )
  )
  const qrPanel = page.locator('.lc-business-qr')
  const businessCard = page.locator('.lc-business-current')
  const createBounds = await businessCard
    .getByRole('button', { name: 'Crear oferta', exact: true })
    .boundingBox()
  const publishedBounds = await businessCard
    .getByRole('button', { name: 'Mis ofertas', exact: true })
    .boundingBox()
  assert.ok(
    publishedBounds.x + publishedBounds.width <= createBounds.x &&
      Math.abs(publishedBounds.y - createBounds.y) < 1,
    `Business actions share one row with published offers on the left: ${JSON.stringify({ createBounds, publishedBounds })}`
  )
  assert.equal(
    await page.getByRole('heading', { name: 'Tus ofertas', exact: true }).count(),
    0,
    'Offers stay folded until requested'
  )
  const qrBounds = await qrPanel.boundingBox()
  assert.ok(createBounds.y < qrBounds.y, 'Creating a discount takes priority over the QR')
  assert.deepEqual(
    await page.locator('#lc-business-sticker').locator('strong,h3,p,small').allTextContents(),
    ['TARJETA LATIDO', offer.business_name, 'Escanea para obtener descuentos']
  )
  assert.equal(
    await qrPanel.getByRole('link').count(),
    0,
    'No extra preview link below the public URL'
  )
  await qrPanel.getByRole('button', { name: 'Copiar enlace público', exact: true }).click()
  await qrPanel.getByText('Copiado', { exact: true }).waitFor()
  assert.equal(
    await page.evaluate(() => window.lastCopiedText),
    origin + `/card/negocio/${providerId}`
  )
  await qrPanel.getByRole('button', { name: 'Compartir', exact: true }).click()
  assert.equal(
    await page.evaluate(() => window.lastSharedLink.url),
    origin + `/card/negocio/${providerId}`
  )
  await qrPanel.getByRole('button', { name: 'Imprimir', exact: true }).click()
  assert.equal(await page.evaluate(() => window.printRequests), 1)
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 }
  ]) {
    await page.setViewportSize(viewport)
    const printBounds = await qrPanel
      .getByRole('button', { name: 'Imprimir', exact: true })
      .boundingBox()
    const shareBounds = await qrPanel
      .getByRole('button', { name: 'Compartir', exact: true })
      .boundingBox()
    const publicUrlBounds = await qrPanel
      .getByLabel('Enlace público', { exact: true })
      .boundingBox()
    const copyBounds = await qrPanel
      .getByRole('button', { name: 'Copiar enlace público', exact: true })
      .boundingBox()
    assert.ok(
      Math.abs(printBounds.y - shareBounds.y) < 1 &&
        printBounds.x + printBounds.width <= shareBounds.x,
      'Print and Share stay side by side'
    )
    assert.ok(
      Math.abs(publicUrlBounds.y - copyBounds.y) < 1 &&
        publicUrlBounds.x + publicUrlBounds.width <= copyBounds.x,
      'Copy stays to the right of the public URL'
    )
  }
  await qrPanel.screenshot({ path: path.join(output, 'business-qr-mobile.png') })
  await page.emulateMedia({ media: 'print' })
  assert.equal(await page.locator('.lc-offer-modal[open]').count(), 0)
  assert.equal(
    await page.locator('#lc-business-sticker').evaluate((el) => getComputedStyle(el).visibility),
    'visible'
  )
  assert.equal(
    await page.locator('.lc-public-link').evaluate((el) => getComputedStyle(el).display),
    'none'
  )
  await page
    .locator('#lc-business-sticker')
    .screenshot({ path: path.join(output, 'business-qr-print.png') })
  await page.emulateMedia({ media: 'screen' })
  await businessCard.getByRole('button', { name: 'Mis ofertas', exact: true }).click()
  await page.getByRole('heading', { name: 'Tus ofertas', exact: true }).waitFor()
  const pausedCard = page.locator('article.lc-offer').filter({ hasText: pausedOffer.title })
  assert.equal(
    await page
      .locator('article.lc-offer')
      .filter({ hasText: offer.title })
      .getByRole('button', { name: 'Borrar', exact: true })
      .count(),
    0
  )
  page.once('dialog', (dialog) => dialog.dismiss())
  await pausedCard.getByRole('button', { name: 'Borrar', exact: true }).click()
  assert.ok(!rpcCalls.includes('lc_delete_offer'), 'Cancelling deletion does nothing')
  page.once('dialog', (dialog) => dialog.accept())
  await pausedCard.getByRole('button', { name: 'Borrar', exact: true }).click()
  await page
    .getByRole('status')
    .filter({ hasText: 'Descuento borrado. El historial se conserva.' })
    .waitFor()
  await pausedCard.waitFor({ state: 'detached' })
  assert.equal(await pausedCard.count(), 0)
  assert.equal(
    await page.locator('.lc-public-link input').inputValue(),
    origin + `/card/negocio/${providerId}`
  )
  assert.equal(await page.getByRole('button', { name: /Scanner|revocar|cámara/i }).count(), 0)
  assert.equal(
    await page
      .locator('details')
      .first()
      .evaluate((e) => e.open),
    false
  )
  await page.screenshot({ path: path.join(output, 'business-mobile.png'), fullPage: true })
  await page.getByLabel('Selecciona el negocio que quieres gestionar').selectOption(provider2)
  await page.getByRole('heading', { name: 'Peluquería Latina', exact: true }).first().waitFor()
  assert.equal(
    await page.locator('.lc-public-link input').inputValue(),
    origin + `/card/negocio/${provider2}`
  )
  await page.getByRole('button', { name: 'Copiar enlace público', exact: true }).click()
  await page.getByText('Copiado', { exact: true }).waitFor()
  assert.equal(
    await page.evaluate(() => window.lastCopiedText),
    origin + `/card/negocio/${provider2}`,
    'Copy follows the selected business'
  )
  // Walk the four-step composer, its validation, bundle variants and review edits.
  await page.getByRole('button', { name: 'Crear mi oferta', exact: true }).click()
  const offerModal = page.getByRole('dialog', { name: 'Crear oferta', exact: true })
  const nextOfferStep = () =>
    offerModal.getByRole('button', { name: 'Siguiente', exact: true }).click()
  const changeOffer = () =>
    offerModal.getByRole('button', { name: 'Cambiar la oferta', exact: true }).click()
  await offerModal.waitFor()
  await offerModal.getByText('Paso 1 de 4', { exact: true }).waitFor()
  await offerModal.screenshot({ path: path.join(output, 'offer-step-1-mobile.png') })
  await page.setViewportSize({ width: 320, height: 568 })
  const nextOnSmallScreen = await offerModal
    .getByRole('button', { name: 'Siguiente', exact: true })
    .boundingBox()
  assert.ok(
    nextOnSmallScreen.y >= 0 && nextOnSmallScreen.y + nextOnSmallScreen.height <= 568,
    'Navigation stays visible on a small mobile screen'
  )
  assert.ok(
    await offerModal
      .locator('.lc-create-body')
      .evaluate((element) => element.scrollHeight > element.clientHeight)
  )
  await offerModal.screenshot({ path: path.join(output, 'offer-step-1-small-mobile.png') })
  await page.setViewportSize({ width: 390, height: 844 })
  await offerModal.getByRole('radio', { name: '15 %', exact: true }).check()
  await nextOfferStep()
  await offerModal.getByRole('radio', { name: /^En algo concreto/ }).check()
  await nextOfferStep()
  await offerModal.getByRole('alert').getByText('Escribe el producto o servicio.').waitFor()
  await offerModal.getByLabel('¿Qué producto o servicio?').fill('el corte de pelo')
  await offerModal.screenshot({ path: path.join(output, 'offer-step-2-mobile.png') })
  await nextOfferStep()
  await offerModal.screenshot({ path: path.join(output, 'offer-step-3-mobile.png') })
  await nextOfferStep()
  await offerModal
    .locator('.lc-offer-preview-info > strong')
    .getByText('15 % en el corte de pelo', { exact: true })
    .waitFor()
  await offerModal.screenshot({ path: path.join(output, 'offer-review-mobile.png') })
  assert.equal(await offerModal.getByRole('button', { name: 'Activar', exact: true }).count(), 0)
  assert.equal(await offerModal.getByLabel('Válido hasta (hora local)').count(), 1)
  await changeOffer()
  await offerModal.getByRole('radio', { name: /^Cantidad fija/ }).check()
  await offerModal.getByRole('radio', { name: 'Otro', exact: true }).check()
  await offerModal.getByLabel('Cantidad de la oferta').fill('0')
  await nextOfferStep()
  await offerModal
    .getByRole('alert')
    .getByText('Escribe una cantidad válida para la oferta.')
    .waitFor()
  await offerModal.getByLabel('Cantidad de la oferta').fill('5.50')
  await nextOfferStep()
  await nextOfferStep()
  await nextOfferStep()
  await offerModal
    .locator('.lc-offer-preview-info > strong')
    .getByText('CHF 5.50 en el corte de pelo', { exact: true })
    .waitFor()
  await changeOffer()
  await offerModal.getByRole('radio', { name: /^2x1 o similar/ }).check()
  await offerModal.screenshot({ path: path.join(output, 'offer-combo-mobile.png') })
  await offerModal.getByRole('radio', { name: '3x2', exact: true }).check()
  await nextOfferStep()
  await nextOfferStep()
  await nextOfferStep()
  await offerModal.locator('.lc-offer-value-number').getByText('3x2', { exact: true }).waitFor()
  await changeOffer()
  await offerModal.getByRole('radio', { name: '2.ª a mitad', exact: true }).check()
  await nextOfferStep()
  await nextOfferStep()
  await nextOfferStep()
  await offerModal.locator('.lc-offer-value-number').getByText('−50 %', { exact: true }).waitFor()
  await changeOffer()
  await offerModal.getByRole('radio', { name: /^Regalo/ }).check()
  await nextOfferStep()
  await offerModal.getByRole('alert').getByText('Escribe qué regalas.').waitFor()
  await offerModal.getByLabel('¿Qué regalas?').fill('un café')
  await nextOfferStep()
  await offerModal.getByRole('radio', { name: /^Con cualquier compra/ }).check()
  await nextOfferStep()
  await nextOfferStep()
  await offerModal
    .locator('.lc-offer-preview-info > strong')
    .getByText('Regalo: un café con tu compra', { exact: true })
    .waitFor()
  await changeOffer()
  await offerModal.getByRole('radio', { name: /^Otro beneficio/ }).check()
  await offerModal.getByLabel('Describe el beneficio').fill('Primera consulta gratis')
  await nextOfferStep()
  await offerModal.getByText('Paso 2 de 3', { exact: true }).waitFor()
  await nextOfferStep()
  await offerModal.getByText('Paso 3 de 3', { exact: true }).waitFor()
  await offerModal
    .locator('.lc-offer-preview-info > strong')
    .getByText('Primera consulta gratis', { exact: true })
    .waitFor()
  await offerModal.getByRole('button', { name: 'Cerrar creación de oferta', exact: true }).click()
  await page.getByRole('button', { name: 'Mis ofertas', exact: true }).click()
  await page.getByText('Aún no has publicado descuentos.', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Crear oferta', exact: true }).click()
  assert.equal(
    await offerModal.locator('.lc-offer-preview-info > strong').innerText(),
    'Primera consulta gratis',
    'Closing the modal and viewing offers preserves the draft'
  )
  await offerModal.locator('.lc-create-options summary').click()
  assert.ok(await page.getByLabel('Frecuencia').locator('option[value="day"]').count())
  assert.ok(await page.getByLabel('Frecuencia').locator('option[value="week"]').count())
  assert.equal(
    await page.getByRole('radio', { name: /Activación automática|Activación manual/ }).count(),
    0
  )
  await page.getByLabel('Válido hasta (hora local)').fill('2027-01-01T12:00')
  await page
    .getByText('El socio activa la oferta en Latido.', {
      exact: true
    })
    .waitFor()
  await page.screenshot({
    path: path.join(output, 'wizard-confirmation-mobile.png'),
    fullPage: true
  })
  await offerModal.getByRole('button', { name: 'Cerrar creación de oferta', exact: true }).click()
  // One optional invitation at app entry; dismissal persists and its CTA opens the right wizard.
  invitationEligible = true
  await page.goto(origin + '/')
  const invitation = page.locator('.lc-business-invitation-dialog')
  await invitation.waitFor()
  await page.waitForLoadState('networkidle')
  await invitation.getByRole('heading', { name: 'Dales un motivo para visitarte' }).waitFor()
  for (const label of ['10 %', '2x1', 'Regalo', 'Otro'])
    assert.equal(await invitation.getByRole('button', { name: label, exact: true }).count(), 1)
  await invitation.locator('.lc-offer-preview').getByText('Zürich', { exact: true }).waitFor()
  await invitation.getByRole('button', { name: 'Comparte tu negocio', exact: true }).click()
  assert.equal(
    await page.evaluate(() => window.lastSharedLink.url),
    origin + `/negocios/${provider2}`
  )
  assert.equal(await page.locator('dialog[open], [role="dialog"]').count(), 1)
  assert.ok((await invitation.boundingBox()).height <= 844)
  await page.screenshot({
    path: path.join(output, 'business-invitation-mobile.png'),
    fullPage: true
  })
  await page.keyboard.press('Escape')
  await invitation.waitFor({ state: 'detached' })
  await page.reload()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1300)
  assert.equal(
    await invitation.count(),
    0,
    'Dismissed invitation does not reopen on the next visit'
  )
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('latido_share_card_reminder_v1:benefits:')) {
        localStorage.setItem(key, JSON.stringify({ lastShownAt: Date.now() - 31 * 86400000 }))
      }
    }
  })
  await page.reload()
  await invitation.waitFor()
  await page.waitForLoadState('networkidle')
  await invitation.getByRole('button', { name: '2x1', exact: true }).click()
  await offerModal.waitFor()
  assert.equal(
    new URL(page.url()).pathname,
    '/',
    'Offering a discount keeps the current page behind the modal'
  )
  await offerModal.getByRole('radio', { name: /^2x1 o similar/ }).waitFor()
  assert.equal(await offerModal.getByRole('radio', { name: '2x1', exact: true }).isChecked(), true)
  await offerModal.getByText('Peluquería Latina', { exact: true }).first().waitFor()
  assert.equal(await page.locator('dialog[open]').count(), 1)
  await offerModal.getByRole('button', { name: 'Cerrar creación de oferta', exact: true }).click()
  await page.goto(origin + `/?crear-oferta=${provider2}`)
  await offerModal.waitFor()
  await offerModal.getByRole('heading', { name: '¿Qué quieres ofrecer?', exact: true }).waitFor()
  await page.waitForLoadState('networkidle')
  await offerModal.getByRole('button', { name: 'Cerrar creación de oferta', exact: true }).click()
  assert.equal(new URL(page.url()).searchParams.has('crear-oferta'), false)
  await page.waitForLoadState('networkidle')
  invitationEligible = false
  // Landing is an option inside promotion. Publication ends with an inline invitation, not an upsell popup.
  await page.goto(origin + '/registrar-negocio')
  await page.getByRole('button', { name: /Belleza/ }).click()
  await page.getByRole('button', { name: 'Continuar →', exact: true }).click()
  await page.getByPlaceholder('Ej: El Rincón Colombiano').fill('Peluquería Latina')
  await page.getByPlaceholder('Nombre de la ciudad').fill('Zürich')
  await page.locator('.latido-page-container--form select').selectOption('ZH')
  await page.getByPlaceholder('Ej: Bahnhofstrasse 10, 8001 Zürich').fill('Bahnhofstrasse 10')
  await page.getByRole('button', { name: 'Continuar →', exact: true }).click()
  await page.getByPlaceholder('hola@minegocio.ch').fill('negocio@test.example')
  await page.getByRole('button', { name: 'Continuar →', exact: true }).click()
  assert.equal(
    await page.getByRole('button', { name: 'Landing page en Latido', exact: true }).count(),
    0
  )
  await page.getByRole('switch', { name: 'Activar potenciar tu negocio', exact: true }).click()
  const promotion = page
    .locator('section')
    .filter({ has: page.getByRole('button', { name: 'Potenciar tu negocio', exact: false }) })
  await promotion.getByRole('button', { name: 'Landing page en Latido', exact: true }).waitFor()
  await promotion.screenshot({ path: path.join(output, 'promotion-with-landing-mobile.png') })
  await page
    .getByRole('button', { name: 'Continuar solo con el perfil gratuito', exact: true })
    .click()
  await page.getByRole('button', { name: '🏪 Registrar negocio', exact: true }).click()
  await page
    .getByRole('dialog', { name: 'No te pierdas nada', exact: true })
    .getByRole('button', { name: 'Ahora no', exact: true })
    .click()
  await page.getByRole('heading', { name: '¡Negocio publicado!', exact: true }).waitFor()
  assert.equal(await page.getByText('Profesional desbloqueado', { exact: true }).count(), 0)
  businesses = businesses.map((item) => (item.id === provider2 ? { ...item, active: false } : item))
  const joinsBeforeInvite = rpcCalls.filter((name) => name === 'lc_join_card_business').length
  await page.getByRole('button', { name: 'Crear mi oferta', exact: true }).click()
  await offerModal.waitFor()
  await offerModal.getByRole('radio', { name: /^Otro beneficio/ }).check()
  await offerModal.getByLabel('Describe el beneficio').fill('Oferta para la comunidad')
  assert.equal(new URL(page.url()).pathname, '/registrar-negocio')
  assert.equal(
    rpcCalls.filter((name) => name === 'lc_join_card_business').length,
    joinsBeforeInvite,
    'Viewing the modal never enrolls an empty business'
  )
  await nextOfferStep()
  await nextOfferStep()
  await offerModal.locator('.lc-create-options summary').click()
  await offerModal.getByLabel('Válido hasta (hora local)').fill('')
  await offerModal.getByText('Sin compra mínima · Sin fecha de fin', { exact: true }).waitFor()
  await offerModal.getByRole('button', { name: 'Publicar oferta', exact: true }).click()
  await page.getByText('Tu oferta ya está publicada en Tarjeta Latido.', { exact: false }).waitFor()
  assert.equal(savedOffers.at(-1).p_provider, provider2)
  assert.equal(savedOffers.at(-1).p_offer.title, 'Oferta para la comunidad')
  assert.equal(savedOffers.at(-1).p_offer.ends_at, 'infinity')
  assert.equal(savedOffers.at(-1).p_offer.benefit_type, 'service')
  assert.equal(
    rpcCalls.filter((name) => name === 'lc_join_card_business').length,
    joinsBeforeInvite,
    'Publication uses a single atomic save, with no separate business signup'
  )
  assert.equal(await page.locator('dialog[open]').count(), 0)
  user.email = 'admin@test.example'
  await page.evaluate(
    (auth) => localStorage.setItem('sb-127-auth-token', JSON.stringify(auth)),
    session()
  )
  await page.goto(origin + '/card/admin')
  await page.getByRole('heading', { name: 'Socios, negocios y descuentos.', exact: true }).waitFor()
  await page.getByLabel('Seleccionar usuario').selectOption(user.id)
  assert.equal(await page.getByLabel('UUID del usuario', { exact: true }).inputValue(), user.id)
  await page.getByLabel('Vigencia hasta', { exact: true }).fill('2027-01-01T12:00')
  await page.getByRole('button', { name: 'Guardar membresía', exact: true }).click()
  await page.getByRole('status').filter({ hasText: 'Cambios guardados.' }).waitFor()
  assert.ok(rpcCalls.includes('lc_admin_enroll'))
  assert.equal(await page.getByRole('button', { name: /tarjeta física|email/i }).count(), 0)
  user.email = 'ana@test.example'
  await page.evaluate(
    (auth) => localStorage.setItem('sb-127-auth-token', JSON.stringify(auth)),
    session()
  )
  await page.goto(origin + '/card')
  discoveryMode = true
  await page.reload()
  await page.locator('.lc-member-strip-heading').waitFor()
  const discountsRegion = page.getByRole('region', { name: 'Descuentos para ti', exact: true })
  const businessesRegion = page.getByRole('region', { name: 'Negocios participantes', exact: true })
  assert.equal(await discountsRegion.locator('.lc-discount-card').count(), 10)
  assert.equal(await businessesRegion.locator('li').count(), 10)
  assert.equal(await membershipCard.isVisible(), true, 'Membership card is always visible')
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => {}))
    )
  )
  const firstDiscount = await discountsRegion.locator('.lc-discount-card').first().boundingBox()
  assert.equal(
    await discountsRegion
      .locator('.lc-discount-card')
      .first()
      .getAttribute('class')
      .then((value) => value.includes('lc-discount-card--unavailable')),
    false,
    'Available discounts come before already-used ones'
  )
  assert.ok(
    firstDiscount.y > (await membershipCard.boundingBox()).y,
    'Discounts follow the open membership card'
  )
  await page.screenshot({ path: path.join(output, 'compact-member-mobile.png') })
  assert.equal(await page.getByRole('combobox').count(), 1, 'Only the city filter is present')
  assert.equal(await page.getByLabel('Categoría', { exact: true }).count(), 0)
  assert.equal(await page.getByLabel('Ordenar', { exact: true }).count(), 0)
  assert.equal(await page.getByText('Condiciones generales', { exact: true }).count(), 0)
  assert.equal(await page.locator('.lc-how-it-works').count(), 0)
  assert.equal(await page.locator('.lc-discount-open svg, .lc-discount-badge').count(), 0)
  assert.ok(
    ['none', 'normal'].includes(
      await businessesRegion
        .locator('.lc-discount-photo')
        .first()
        .evaluate((el) => getComputedStyle(el, '::after').content)
    ),
    'Business photos have no color stripe'
  )
  const helpButton = page.getByRole('button', { name: '¿Cómo funciona?', exact: true })
  const helpBounds = await helpButton.boundingBox()
  const headingBounds = await page
    .getByRole('heading', { name: 'Descuentos para ti', exact: true })
    .boundingBox()
  assert.ok(
    helpBounds.x > headingBounds.x &&
      Math.abs(helpBounds.y + helpBounds.height / 2 - headingBounds.y - headingBounds.height / 2) <
        3,
    'Help is a text link alongside the heading'
  )
  await helpButton.click()
  const helpDialog = page.getByRole('dialog', { name: '¿Cómo funciona?', exact: true })
  await helpDialog.waitFor()
  assert.equal(await helpDialog.locator('li').count(), 3)
  await helpDialog.screenshot({ path: path.join(output, 'how-it-works-modal.png') })
  await helpDialog.getByRole('button', { name: 'Cerrar', exact: true }).click()
  await helpDialog.waitFor({ state: 'detached' })
  await helpButton.click()
  await helpDialog.waitFor()
  await page.keyboard.press('Escape')
  await helpDialog.waitFor({ state: 'detached' })
  assert.equal(await helpButton.evaluate((el) => el === document.activeElement), true)
  assert.equal(
    await page
      .getByRole('combobox', { name: 'Ciudad', exact: true })
      .locator('option[value="Basilea"]')
      .count(),
    0,
    'Empty business registrations do not add cities to the filter'
  )
  await page.getByRole('combobox', { name: 'Ciudad', exact: true }).selectOption('Genève')
  assert.equal(await discountsRegion.locator('.lc-discount-card').count(), 1)
  assert.equal(await businessesRegion.locator('li').count(), 1)
  await page.getByRole('combobox', { name: 'Ciudad', exact: true }).selectOption('')
  assert.equal(await discountsRegion.getByText('Historial de usos', { exact: true }).count(), 0)
  await discountsRegion.getByRole('button', { name: 'Mostrar todos (14)', exact: true }).click()
  assert.equal(await discountsRegion.locator('.lc-discount-card').count(), 14)
  assert.equal(
    await businessesRegion.locator('li').count(),
    10,
    'Expanding discounts does not expand businesses'
  )
  await discountsRegion.getByRole('button', { name: 'Mostrar menos', exact: true }).click()
  assert.equal(await discountsRegion.locator('.lc-discount-card').count(), 10)
  const discountSearch = page.getByRole('searchbox', {
    name: 'Buscar descuentos y negocios',
    exact: true
  })
  await discountSearch.fill('cafe geneve')
  assert.equal(
    await discountsRegion.locator('.lc-discount-card').count(),
    1,
    'Search ignores accents across business and city'
  )
  const usesBeforeAuto = useCalls.length
  assert.equal(await discountsRegion.getByText('Activada', { exact: true }).count(), 0)
  assert.equal(useCalls.length, usesBeforeAuto, 'Automatic activation does not consume on listing')
  await discountsRegion.getByRole('button', { name: /^(Activar|Usar ahora)$/ }).click()
  await page.getByRole('dialog', { name: '¿Usar este descuento ahora?' }).waitFor()
  assert.equal(useCalls.length, usesBeforeAuto, 'Legacy automatic offers also require confirmation')
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
  assert.equal(useCalls.length, usesBeforeAuto)
  await discountsRegion.getByRole('button', { name: /^(Activar|Usar ahora)$/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Usar ahora', exact: true }).click()
  await page.waitForURL('**/card/validacion/**')
  await page.getByText('Descuento válido', { exact: true }).waitFor()
  assert.equal(await page.getByRole('dialog').count(), 0)
  assert.equal(useCalls.length, usesBeforeAuto + 1)
  await page.goto(origin + '/card')
  await page.locator('#lc-business-directory li').first().waitFor()
  await discountSearch.fill('sin-coincidencias-xyz')
  await discountsRegion
    .getByText('No encontramos descuentos con esa búsqueda.', { exact: true })
    .waitFor()
  await discountSearch.fill('')
  assert.equal(await discountsRegion.locator('.lc-discount-card').count(), 10)
  await businessesRegion.getByRole('button', { name: 'Mostrar todos (13)', exact: true }).click()
  assert.equal(await businessesRegion.locator('li').count(), 13)
  const businessSearch = discountSearch
  assert.equal(await page.getByRole('searchbox').count(), 1)
  await businessSearch.fill('cafe geneve')
  assert.equal(await businessesRegion.locator('li').count(), 1)
  await businessesRegion
    .getByRole('link', { name: 'Ver descuentos de Café Encuentro · Genève', exact: true })
    .click()
  await page.waitForURL(origin + `/card/negocio/${discoveryOffers[11].provider_id}`)
  await page.getByRole('heading', { name: 'Ofertas de este negocio', exact: true }).waitFor()
  await page.getByRole('heading', { name: 'Descuento 12', exact: true }).waitFor()
  assert.equal(
    await page.locator('.lc-discount-card').count(),
    1,
    'Opening a business shows only its discounts'
  )
  await page.getByRole('link', { name: 'Volver a los negocios', exact: true }).click()
  await page.waitForURL(origin + '/card')
  await page.locator('#lc-business-directory li').first().waitFor()
  await businessSearch.fill('sin-coincidencias-xyz')
  await businessesRegion
    .getByText('No encontramos negocios con esa búsqueda.', { exact: true })
    .waitFor()
  await businessSearch.fill('')
  assert.equal(await businessesRegion.locator('li').count(), 10, 'A new search resets the preview')
  await businessesRegion.getByRole('button', { name: 'Mostrar todos (13)', exact: true }).click()
  const upcoming = businessesRegion.locator('li').filter({ hasText: 'Negocio sin descuentos' })
  assert.equal(
    await upcoming.count(),
    0,
    'Businesses without discounts are excluded even when an older directory API returns them'
  )
  await page.goto(origin + '/card/negocio/' + emptyBusinessId)
  await page.getByText('Todavía no hay descuentos disponibles aquí.', { exact: true }).waitFor()
  assert.equal(await page.locator('.lc-offer-list--empty').count(), 1)
  await page.getByRole('link', { name: 'Volver a los negocios', exact: true }).click()
  await page.waitForURL(origin + '/card')
  await page.locator('#lc-business-directory li').first().waitFor()
  assert.equal(await page.locator('.lc-discount-card').count(), 10)
  directoryFailure = true
  await page.reload()
  await page.locator('.lc-discovery').getByRole('alert').waitFor()
  assert.equal(
    await page.locator('.lc-discount-card').count(),
    10,
    'A missing directory migration does not break discounts'
  )
  directoryFailure = false
  await page.reload()
  await page.locator('#lc-business-directory li').first().waitFor()
  await businessesRegion.screenshot({ path: path.join(output, 'directory-mobile.png') })
  await discountsRegion.screenshot({ path: path.join(output, 'discount-search-mobile.png') })
  ownsBusiness = false
  membershipValidUntil = new Date(Date.now() + 86400000 * 2).toISOString()
  await page.reload()
  await page
    .locator('.lc-membership-expiry')
    .getByRole('link', { name: 'Renovar', exact: true })
    .waitFor()
  assert.equal(
    await page.locator('.lc-links').getByRole('link', { name: 'Mi negocio', exact: true }).count(),
    0
  )
  await page.getByRole('link', { name: 'Volver al inicio de Latido', exact: true }).waitFor()
  ownsBusiness = true
  membershipValidUntil = null
  discoveryMode = false
  membershipActive = false
  await page.reload()
  await page.locator('.lc-membership-summary').getByText('Inactiva', { exact: true }).waitFor()
  assert.equal(await page.locator('.lc-membership-card__number').innerText(), '2481')
  assert.equal(await page.locator('.lc-intro-card-preview').count(), 0)
  assert.equal(
    await page.getByRole('heading', { name: 'Ahorra en los negocios de tu comunidad' }).count(),
    0
  )
  const renewal = page
    .locator('.lc-membership-renewal')
    .getByRole('link', { name: 'Renovar', exact: true })
  assert.match(await renewal.getAttribute('href'), /^mailto:info@latido\.ch\?subject=Renovar/)
  assert.equal(
    await page.getByRole('link', { name: 'Solicitar mi tarjeta', exact: true }).count(),
    0
  )
  await page.screenshot({
    path: path.join(output, 'inactive-membership-mobile.png'),
    fullPage: true
  })
  hasMembership = false
  await page.goto(origin + '/')
  await homeCardLink.getByText('Tarjeta Latido', { exact: true }).waitFor()
  await page.waitForLoadState('networkidle')
  assert.equal(await homeCardLink.getByText(/Socio nº/).count(), 0)
  await homeCardLink.click()
  await page.waitForURL(origin + '/card')
  await page.getByRole('heading', { name: 'Ahorra en los negocios de tu comunidad' }).waitFor()
  assert.equal(await page.getByText('Tarjeta física o QR en tu móvil', { exact: true }).count(), 0)
  assert.equal(await page.evaluate(() => window.cameraRequests), 0)
  await page.screenshot({ path: path.join(output, 'intro-mobile.png'), fullPage: true })
  discoveryMode = true
  await page.evaluate(() => localStorage.removeItem('sb-127-auth-token'))
  await page.goto(origin + '/card')
  await page
    .locator('.lc-intro-login')
    .getByRole('link', { name: 'Inicia sesión', exact: true })
    .waitFor()
  assert.equal(await page.locator('.lc-visitor-highlights .lc-discount-card').count(), 3)
  assert.equal(
    await page.locator('.lc-discount-card').count(),
    10,
    'Visitor preview stays limited to ten discounts overall'
  )
  assert.equal(
    await page
      .locator('.lc-discount-card')
      .getByRole('link', { name: /Conseguir tarjeta|Inicia sesión/ })
      .count(),
    0
  )
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await page
    .locator('.lc-sticky-join')
    .getByRole('link', { name: 'Conseguir mi tarjeta', exact: true })
    .waitFor()
  await page.goto(origin + '/card?oferta=' + offer.id)
  await page.locator('.lc-intro-card-preview').waitFor()
  const sharedBounds = await page.locator('.lc-card-intro .lc-featured-offer').boundingBox()
  const titleBounds = await page
    .getByRole('heading', { name: 'Ahorra en los negocios de tu comunidad', exact: true })
    .boundingBox()
  assert.ok(
    sharedBounds.y > titleBounds.y && sharedBounds.y < titleBounds.y + titleBounds.height + 40
  )
  assert.equal(await page.locator('.lc-discount-card').filter({ hasText: offer.title }).count(), 1)
  await page.evaluate(() => {
    localStorage.setItem('latido_card_scanner_v1', 'retired-secret')
    sessionStorage.setItem('lc-business-qr:old', 'retired-secret')
  })
  await page.goto(origin + '/scanner/link/' + 'a'.repeat(64))
  await page.waitForURL(origin + '/card')
  assert.equal(await page.evaluate(() => localStorage.getItem('latido_card_scanner_v1')), null)
  assert.equal(await page.evaluate(() => sessionStorage.getItem('lc-business-qr:old')), null)
  assert.deepEqual(errors, [])
  assert.ok(!rpcCalls.some((name) => /scanner|physical|digital_card|card_code/.test(name)))
  console.log(
    `${useWebkit ? 'WebKit iPhone' : 'Chromium Android'}: public QR, login return, confirmation, retry, receipt, expiry, claims, business QR and wizard passed`
  )
} catch (error) {
  await page
    ?.screenshot({ path: path.join(output, 'failure-latest.png'), fullPage: true })
    .catch(() => {})
  throw error
} finally {
  await browser?.close()
  server.kill()
}
