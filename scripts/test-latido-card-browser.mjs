import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { chromium, webkit, devices, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const businessPreview = process.argv.includes('--business-preview')
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
      VITE_LATIDO_CARD_MEMBERS_ENABLED: businessPreview ? 'false' : 'true',
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
  dashboardRequests = [],
  useCalls = [],
  savedOffers = []
let notificationPreference = { new_offers: false, canton: '' }
let failPreferenceSave = false
const preferenceWrites = []
const providerId = '00000000-0000-4000-8000-000000000010',
  provider2 = '00000000-0000-4000-8000-000000000011'
const archivedBusiness = {
  id: '00000000-0000-4000-8000-000000000012',
  name: 'Negocio archivado',
  participating: true,
  active: true,
  suspended: false,
  deleted_at: '2026-10-16T12:40:47.471389Z'
}
const housingAd = {
  id: '00000000-0000-4000-8000-000000000555',
  title: 'Habitaciones individuales y dobles',
  cat: 'vivienda',
  sub: 'Se ofrece habitación',
  type: 'ofrece',
  desc: 'Habitaciones disponibles en Zürich.',
  user: 'Negocio de prueba',
  canton: 'ZH',
  city: 'Zürich',
  price: 'CHF 900/mes',
  privacy: 'public',
  active: true,
  created_at: new Date().toISOString()
}
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
  description: 'Regístrate desde clino.ch/r/LATIDO. Más información en https://example.com/oferta?ref=LATIDO.',
  business_name: 'Restaurante Sabor Latino',
  business_photo_url: '/partners/punto-hispano/logo.webp',
  city: 'Zürich',
  category: 'restaurante',
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
  category: index % 2 ? 'belleza' : 'restaurante',
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
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: ({ files }) => files?.every((file) => file.type === 'image/png' && file.size > 1000)
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
    if (name === 'missing-business-photo.png') return respond(route, {}, 404)
    if (name === 'listings') return respond(route, [housingAd])
    if (name === 'providers' && route.request().method() === 'POST')
      return respond(route, { id: provider2 })
    if (name === 'providers' && url.searchParams.has('user_id')) return respond(route, [])
    if (name === 'providers' && url.searchParams.get('id')?.startsWith('in.')) {
      assert.equal(url.searchParams.get('deleted_at'), 'is.null')
      return respond(route, businesses.filter((item) => !item.deleted_at).map((item) => ({
        id: item.id, user_id: item.owner_id ?? user.id, active: item.published !== false
      })))
    }
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
          ...item,
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
    if (name === 'lc_notification_preferences') {
      if (typeof args.p_enabled === 'boolean') {
        preferenceWrites.push(args)
        if (failPreferenceSave) return respond(route, { message: 'Temporary error' }, 503)
        notificationPreference = { new_offers: args.p_enabled, canton: args.p_canton }
      }
      return respond(route, notificationPreference)
    }
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
        server_now: new Date().toISOString(),
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
            claim: receipts.some((r) => r.offer_id === special.id) ? { status: 'used' } : null,
            validation:
              receipts.find(
                (r) => r.offer_id === special.id && Date.parse(r.expires_at) > Date.now()
              ) || null
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
        business: {
          ...(discoveryMode ? discoveryBusinesses : businesses).find(
            (b) => b.id === args.p_provider
          ),
          ...(args.p_provider === providerId
            ? { photo_url: '/card-test-api/missing-business-photo.png' }
            : {}),
          address: 'Bahnhofstrasse 10',
          phone: '+41 44 123 45 67',
          hours: 'Lunes a viernes, 9–18 h'
        },
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
    if (name === 'lc_business_dashboard') dashboardRequests.push(args)
    if (businessPreview && name === 'lc_business_dashboard' && args.p_provider &&
      (businesses.find((item) => item.id === args.p_provider)?.participating === false ||
        businesses.find((item) => item.id === args.p_provider)?.suspended ||
        businesses.find((item) => item.id === args.p_provider)?.deleted_at))
      return respond(route, { message: 'FORBIDDEN' }, 400)
    if (name === 'lc_business_dashboard')
      return respond(route, {
        server_now: new Date().toISOString(),
        summary: { month_uses: 1, month_members: 1, total_uses: 1 },
        businesses: ownsBusiness ? businesses.map((item) => {
          if (!businessPreview) return item
          const legacy = { ...item, photo_url: undefined }
          delete legacy.deleted_at
          return legacy
        }) : [],
        offers:
          args.p_provider === providerId
            ? [
                { ...offer, has_activity: true, month_uses: 1 },
                special,
                {
                  ...offer,
                  id: '00000000-0000-4000-8000-000000000021',
                  title: 'Otra oferta habitual'
                },
                { ...special, id: '00000000-0000-4000-8000-000000000022', title: 'Otra promoción' },
                {
                  ...special,
                  id: '00000000-0000-4000-8000-000000000023',
                  title: 'Tercera promoción'
                },
                ...(!pausedDeleted ? [pausedOffer] : [])
              ]
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
  page.setDefaultTimeout(15000)
  // WebKit can report canceled mocked requests as access-control errors when
  // a hard navigation interrupts initialization. Finish the current page's
  // requests before changing documents; keep every pageerror assertion enabled.
  const navigate = async (url) => {
    await page.waitForLoadState('networkidle')
    return page.goto(url)
  }
  const reloadPage = async () => {
    await page.waitForLoadState('networkidle')
    return page.reload()
  }
  const checkDescriptionLinks = async (card) => {
    const beforeUrl = page.url()
    const beforeUses = useCalls.length
    const link = card.getByRole('link', { name: 'clino.ch/r/LATIDO', exact: true })
    await expect(link).toHaveAttribute('href', 'https://clino.ch/r/LATIDO')
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    await expect(card.getByRole('link', { name: 'https://example.com/oferta?ref=LATIDO', exact: true }))
      .toHaveAttribute('href', 'https://example.com/oferta?ref=LATIDO')
    await context.route('https://clino.ch/r/LATIDO', route => route.fulfill({ contentType: 'text/html', body: '<h1>Mock destination</h1>' }))
    const opened = page.waitForEvent('popup')
    await link.click()
    const popup = await opened
    await popup.waitForLoadState('domcontentloaded')
    assert.equal(popup.url(), 'https://clino.ch/r/LATIDO')
    await popup.close()
    assert.equal(page.url(), beforeUrl)
    assert.equal(useCalls.length, beforeUses, 'Opening a description link never redeems the offer')
    await expect(card.locator('.lc-discount-details')).toBeVisible()
  }
  const checkBusinessReturn = async (card) => {
    const search = page.getByRole('searchbox', { name: businessPreview ? 'Buscar ofertas publicadas' : 'Buscar descuentos y negocios', exact: true })
    const previousQuery = await search.inputValue()
    await search.fill('Sabor')
    if (!(await card.locator('.lc-discount-details').isVisible()))
      await card.locator('.lc-discount-open').click()
    const originalUrl = page.url()
    for (const browserBack of [false, true]) {
      const link = card.getByRole('link', { name: 'Ver negocio', exact: true })
      await link.scrollIntoViewIfNeeded()
      const originalScroll = await page.evaluate(() => window.scrollY)
      await link.click()
      await page.waitForURL(origin + `/negocios/${providerId}--restaurante-sabor-latino`)
      await page.getByRole('heading', { name: offer.business_name, level: 1, exact: true }).waitFor()
      if (browserBack) await page.goBack()
      else await page.locator('.latido-fullpage-enter').getByRole('button', { name: 'Volver', exact: true }).click()
      await page.waitForURL(originalUrl)
      await expect(card.locator('.lc-discount-details')).toBeVisible()
      await expect(search).toHaveValue('Sabor')
      await expect.poll(async () => Math.abs((await page.evaluate(() => window.scrollY)) - originalScroll)).toBeLessThan(4)
    }
    await card.screenshot({ path: path.join(output, 'offer-business-link.png') })
    await search.fill(previousQuery)
    if (!(await card.locator('.lc-discount-details').isVisible()))
      await card.locator('.lc-discount-open').click()
  }
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (/Maximum update depth|Too many re-renders/.test(message.text())) errors.push(message.text())
  })
  await mkdir(output, { recursive: true })
  if (businessPreview) {
    await navigate(origin + '/')
    await page.waitForLoadState('networkidle')
    assert.equal(await page.locator('a[href="/club"], .home-latido-carousel, .home-business-offer').count(), 0)
    await navigate(origin + '/card')
    await page.waitForURL(origin + '/')
    await page.waitForLoadState('networkidle')
    await navigate(origin + '/colaboraciones')
    const more = page.getByRole('link', { name: 'Más información', exact: true })
    assert.equal(await more.getAttribute('href'), '/club#negocios')
    await more.click()
    await page.getByRole('heading', { name: 'Promocionar los negocios hispanohablantes', exact: true }).waitFor()
    assert.equal(await page.getByRole('button', { name: 'Socios', exact: true }).count(), 0)
    assert.equal(await page.getByText(/CHF 6,90|Solicitar mi tarjeta|Tarjeta de socio/).count(), 0)
    await page.getByRole('link', { name: 'Registrar mi negocio gratis', exact: true }).waitFor()
    await page.waitForLoadState('networkidle')
    businesses = [archivedBusiness, ...businesses.map((item) => item.id === providerId ? { ...item, participating: false } : item)]
    await page.evaluate((auth) => localStorage.setItem('sb-127-auth-token', JSON.stringify(auth)), session())
    await navigate(origin + '/')
    const homeBusiness = page.getByRole('link', { name: 'Promocionar mi negocio gratis', exact: true })
    await homeBusiness.waitFor()
    await page.waitForLoadState('networkidle')
    await expect(homeBusiness.locator('.home-business-offer-logo img')).toHaveAttribute('src', offer.business_photo_url)
    await homeBusiness.getByText('Atrae más clientes', { exact: true }).waitFor()
    await homeBusiness.getByText('Promociona tu negocio gratis y haz que crezca con latido', { exact: true }).waitFor()
    await homeBusiness.getByText('Empezar', { exact: true }).waitFor()
    await homeBusiness.screenshot({ path: path.join(output, 'business-phase-home.png') })
    assert.equal(await page.locator('.home-latido-carousel, .lc-membership-summary').count(), 0)
    const ownBusinesses = businesses
    const ownerEmail = user.email
    user.email = 'admin@test.example'
    businesses = businesses.map((item) => ({ ...item, owner_id: '00000000-0000-4000-8000-000000000888' }))
    await page.evaluate((auth) => localStorage.setItem('sb-127-auth-token', JSON.stringify(auth)), session())
    await navigate(origin + '/')
    await page.waitForLoadState('networkidle')
    assert.equal(await homeBusiness.count(), 0, 'Administrators managing other owners must not see the home invitation')
    const adminAccess = await page.evaluate((id) => JSON.parse(sessionStorage.getItem(`lc-access:${id}`)), user.id)
    assert.equal(adminAccess.hasBusiness, true, 'Administrative management access remains available')
    assert.deepEqual(adminAccess.ownedPublishedBusinesses, [])
    user.email = ownerEmail
    businesses = ownBusinesses.map((item) => ({ ...item, published: false }))
    await page.evaluate((auth) => localStorage.setItem('sb-127-auth-token', JSON.stringify(auth)), session())
    await navigate(origin + '/')
    await page.waitForLoadState('networkidle')
    assert.equal(await homeBusiness.count(), 0, 'An owned business pending publication must not show the home invitation')
    businesses = ownBusinesses
    await navigate(origin + '/')
    await homeBusiness.waitFor()
    await page.waitForLoadState('networkidle')
    businesses = businesses.map((item) => item.id === provider2 ? { ...item, suspended: true } : item)
    await navigate(origin + `/card/negocios?negocio=${provider2}`)
    await page.getByText('Participación suspendida', { exact: true }).waitFor()
    await page.waitForLoadState('networkidle')
    assert.equal(dashboardRequests.filter((args) => args.p_provider === provider2).length, 0,
      'Suspended businesses must not request offer details')
    assert.equal(await page.getByRole('button', { name: 'Crear oferta', exact: true }).count(), 0)
    assert.equal(await page.locator('[role="alert"]').count(), 0)
    await page.getByText(/Latido ha retirado este negocio del programa/).waitFor()
    await page.screenshot({ path: path.join(output, 'business-phase-suspended.png'), fullPage: true })
    businesses = businesses.map((item) => item.id === provider2 ? { ...item, suspended: false } : item)
    const detailsBeforeFirstOffer = rpcCalls.filter((name) => name === 'lc_business_dashboard').length
    await navigate(origin + '/card/negocios')
    await page.getByRole('heading', { name: 'Tus ofertas', exact: true }).waitFor()
    await page.waitForLoadState('networkidle')
    assert.equal(await page.locator('[role="alert"]').count(), 0, 'No permission warning before publishing the first offer')
    assert.equal(await page.getByRole('option', { name: archivedBusiness.name, exact: true }).count(), 0)
    assert.equal(await page.locator('.lc-managed-offer').count(), 0)
    assert.ok(rpcCalls.filter((name) => name === 'lc_business_dashboard').length > detailsBeforeFirstOffer)
    await navigate(origin + '/')
    await homeBusiness.waitFor()
    await page.waitForLoadState('networkidle')
    await homeBusiness.click()
    await page.getByRole('heading', { name: 'Promocionar los negocios hispanohablantes', exact: true }).waitFor()
    await page.screenshot({ path: path.join(output, 'business-phase-welcome.png'), fullPage: true })
    await page.getByRole('button', { name: 'Ofrecer mi primer descuento', exact: true }).click()
    const creation = page.getByRole('dialog', { name: 'Crear oferta', exact: true })
    await creation.getByText('Paso 1 de 4', { exact: true }).waitFor()
    for (let step = 0; step < 3; step++) await creation.getByRole('button', { name: 'Siguiente', exact: true }).click()
    await creation.getByRole('button', { name: 'Publicar oferta', exact: true }).click()
    const published = page.getByRole('dialog', { name: '¡Oferta publicada!', exact: true })
    await published.waitFor()
    assert.equal(savedOffers.at(-1).p_provider, providerId)
    assert.equal(await published.getByText(/Siguiente paso: pon tu QR|Descargar QR/).count(), 0)
    await published.getByRole('link', { name: 'Ir a Mi negocio', exact: true }).click()
    await page.getByRole('heading', { name: 'Tus ofertas', exact: true }).waitFor()
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: path.join(output, 'business-phase-dashboard.png'), fullPage: true })
    assert.equal(await page.getByRole('heading', { name: 'Resultados', exact: true }).count(), 0)
    assert.equal(await page.getByText('Material para tu local', { exact: true }).count(), 0)
    const paused = page.locator('.lc-managed-offer').filter({ hasText: pausedOffer.title })
    await paused.locator('summary').click()
    assert.equal(await page.getByRole('button', { name: 'Borrar', exact: true }).count(), 0)
    await page.getByRole('link', { name: 'Descuentos', exact: true }).click()
    await page.getByRole('heading', { name: 'Ofertas publicadas', exact: true }).waitFor()
    await page.locator('.lc-discount-card').first().waitFor()
    assert.equal(await page.getByRole('button', { name: /^(Activar|Usar ahora|Alertas de descuentos)$/ }).count(), 0)
    const linkedCard = page.locator('.lc-discount-card').filter({ hasText: offer.title })
    await linkedCard.locator('.lc-discount-open').click()
    await checkDescriptionLinks(linkedCard)
    await checkBusinessReturn(linkedCard)
    await linkedCard.locator('.lc-discount-open').click()
    assert.equal(await page.locator('.lc-membership-summary, .lc-card-intro, #lc-card-alerts').count(), 0)
    await page.getByRole('searchbox', { name: 'Buscar ofertas publicadas', exact: true }).fill('Café')
    await expect(page.locator('.lc-discount-card')).toHaveCount(1)
    await page.getByRole('searchbox', { name: 'Buscar ofertas publicadas', exact: true }).fill('')
    await page.evaluate((id) => sessionStorage.setItem(`lc-access:${id}`, JSON.stringify({ hasBusiness: false, participating: false, businesses: [] })), user.id)
    await reloadPage()
    await page.getByRole('heading', { name: 'Ofertas publicadas', exact: true }).waitFor()
    await page.locator('.lc-discount-card').first().waitFor()
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 844 })
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      await page.screenshot({ path: path.join(output, `business-preview-${width}.png`), fullPage: true })
    }
    const blocked = await page.evaluate(async () => {
      const { cardRpc } = await import('/src/lib/latidoCard.js')
      const names = ['lc_use_offer', 'lc_claim_offer', 'lc_delete_offer', 'lc_notification_preferences', 'lc_member_home', 'lc_validation']
      return Promise.all(names.map(async (name) => {
        try { await cardRpc(name); return false } catch { return true }
      }))
    })
    assert.ok(blocked.every(Boolean), 'Member actions and deletion are blocked before sending requests')
    await page.waitForLoadState('networkidle')
    await navigate(origin + `/card/validacion/disabled`)
    await page.waitForURL(origin + '/card')
    await page.getByRole('heading', { name: 'Ofertas publicadas', exact: true }).waitFor()
    await page.waitForLoadState('networkidle')
    const currentBusinesses = businesses
    businesses = [archivedBusiness]
    await navigate(origin + '/')
    await page.waitForLoadState('networkidle')
    assert.equal(await homeBusiness.count(), 0, 'An archived business alone must not show the business invitation')
    await navigate(origin + `/card/negocios?negocio=${archivedBusiness.id}`)
    await page.waitForURL(origin + '/')
    await page.waitForLoadState('networkidle')
    assert.equal(dashboardRequests.filter((args) => args.p_provider === archivedBusiness.id).length, 0,
      'Never request private offer management for archived businesses from legacy dashboards')
    businesses = currentBusinesses
    ownsBusiness = false
    await page.evaluate(() => {
      for (const key of Object.keys(sessionStorage)) if (key.startsWith('lc-access:')) sessionStorage.removeItem(key)
    })
    await navigate(origin + '/')
    await page.waitForLoadState('networkidle')
    assert.equal(await homeBusiness.count(), 0)
    await navigate(origin + '/card')
    await page.waitForURL(origin + '/')
    await page.waitForLoadState('networkidle')
    assert.ok(!rpcCalls.some((name) => ['lc_use_offer', 'lc_claim_offer', 'lc_delete_offer', 'lc_notification_preferences', 'lc_member_home', 'lc_validation'].includes(name)))
    assert.deepEqual(errors, [])
    console.log(`${useWebkit ? 'WebKit' : 'Chromium'}: business-only entry, landing, creation, management, read-only catalog, inactive member actions and non-owner restrictions passed`)
  } else {
  await navigate(origin + '/')
  await page.waitForLoadState('networkidle')
  for (const name of ['Cerrar evento especial', 'Solo necesarias']) {
    const dismiss = page.getByRole('button', { name, exact: true })
    if (await dismiss.isVisible()) await dismiss.click()
  }
  hasMembership = false
  await page.evaluate((auth) => localStorage.setItem('sb-127-auth-token', JSON.stringify(auth)), session())
  await reloadPage()
  await page.waitForLoadState('networkidle')
  const homeCarousel = page.getByRole('region', { name: 'Ofertas y Latido Club', exact: true })
  await homeCarousel.waitFor()
  await expect(homeCarousel.locator('.home-latido-carousel-slide').first().getByRole('link')).toHaveAccessibleName('Unirme a Latido Club')
  await expect(homeCarousel.locator('.home-latido-carousel-dots button')).toHaveCount(2)
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    const geometry = await homeCarousel.evaluate((element) => {
      const track = element.querySelector('.home-latido-carousel-track')
      track.scrollTo({ left: 0, behavior: 'instant' })
      const bounds = track.getBoundingClientRect()
      const next = track.children[1].getBoundingClientRect()
      return { right: bounds.right, next: next.left, height: track.children[0].getBoundingClientRect().height,
        width: innerWidth, scroll: document.documentElement.scrollWidth }
    })
    assert.ok(geometry.scroll <= width, `Home fits ${width}px`)
    assert.ok(geometry.next < geometry.right, 'The next card peeks into view')
    assert.ok(geometry.height <= 112, 'The get-card entry keeps its original compact height')
    await homeCarousel.screenshot({ path: path.join(output, `home-carousel-visitor-${width}.png`) })
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await homeCarousel.getByRole('button', { name: 'Mostrar Oferta destacada', exact: true }).click()
  await expect(homeCarousel.getByRole('button', { name: 'Mostrar Oferta destacada', exact: true })).toHaveAttribute('aria-current', 'true')
  const track = homeCarousel.locator('.home-latido-carousel-track')
  await track.focus()
  await track.press('ArrowLeft')
  await expect(homeCarousel.getByRole('button', { name: 'Mostrar Unirme a Latido Club', exact: true })).toHaveAttribute('aria-current', 'true')
  const trackBounds = await track.boundingBox()
  await page.mouse.move(trackBounds.x + trackBounds.width * 0.8, trackBounds.y + trackBounds.height / 2)
  await page.mouse.down()
  await page.mouse.move(trackBounds.x + trackBounds.width * 0.1, trackBounds.y + trackBounds.height / 2, { steps: 12 })
  await page.mouse.up()
  await expect(homeCarousel.getByRole('button', { name: 'Mostrar Oferta destacada', exact: true })).toHaveAttribute('aria-current', 'true')
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await page.waitForLoadState('networkidle')
  await expect(homeCarousel.getByRole('button', { name: 'Mostrar Oferta destacada', exact: true })).toHaveAttribute('aria-current', 'true')
  const emptyHomeCatalog = (route) => respond(route, [])
  await page.route('**/rpc/lc_catalog', emptyHomeCatalog)
  await reloadPage()
  await page.waitForLoadState('networkidle')
  assert.equal(await homeCarousel.count(), 0, 'No empty featured slide when the catalog is empty')
  await page.getByRole('link', { name: 'Unirme a Latido Club', exact: true }).waitFor()
  await page.unroute('**/rpc/lc_catalog', emptyHomeCatalog)
  hasMembership = true
  await page.evaluate(() => localStorage.removeItem('sb-127-auth-token'))
  // Business profiles must recover from the old permanent cache, including an
  // empty catalog, and revalidate fresh cache entries when opening a profile.
  await navigate(origin + '/')
  for (const cachedCatalog of [[], { offers: [], fetchedAt: Date.now() }]) {
    await page.evaluate((value) => {
      sessionStorage.setItem('lc-public-catalog-v1', JSON.stringify(value))
    }, cachedCatalog)
    await navigate(origin + `/negocios/${providerId}--restaurante-sabor-latino`)
    await page.getByRole('heading', { name: offer.business_name, level: 1, exact: true }).waitFor()
    await page.locator('.lc-business-card-pill').waitFor()
    await page.locator('.lc-business-benefit-block strong').filter({ hasText: 'Hasta 15 % para socios' }).waitFor()
  }
  const catalogOverride = (route) => respond(route, [{ ...offer, benefit_value: 25 }])
  await page.route('**/rpc/lc_catalog', catalogOverride)
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await page.locator('.lc-business-benefit-block strong').filter({ hasText: 'Hasta 25 % para socios' }).waitFor()
  assert.match(await page.locator('.lc-business-benefit-block').innerText(), /1 oferta/)
  await page.screenshot({ path: path.join(output, 'business-profile-refreshed.png'), fullPage: true })
  await page.unroute('**/rpc/lc_catalog', catalogOverride)
  await navigate(origin + `/negocios/${emptyBusinessId}--negocio-sin-descuentos`)
  await page.getByRole('heading', { name: 'Negocio sin descuentos', level: 1, exact: true }).waitFor()
  assert.equal(await page.locator('.lc-business-card-pill').count(), 0)
  assert.equal(await page.locator('.lc-business-benefit-block').count(), 0)
  // The main landing leads to the new, standalone card landing on mobile.
  await navigate(origin + '/')
  await page.waitForLoadState('networkidle')
  const promotionClose = page.getByRole('button', { name: 'Cerrar evento especial', exact: true })
  if (await promotionClose.isVisible()) await promotionClose.click()
  const necessaryCookies = page.getByRole('button', { name: 'Solo necesarias', exact: true })
  if (await necessaryCookies.isVisible()) await necessaryCookies.click()
  await page.getByRole('button', { name: 'Menú', exact: true }).click()
  await page
    .locator('.latido-nav-menu')
    .getByRole('link', { name: 'Latido Club', exact: true })
    .click()
  await page.waitForURL(origin + '/club')
  await page
    .getByRole('heading', {
      name: 'Apoya los negocios de tu comunidad y obtén descuentos',
      exact: true
    })
    .waitFor()
  assert.equal(await page.locator('.lc-landing [data-vista="negocios"]').isVisible(), false)
  assert.equal(
    await page.locator('.lc-landing [href="#"]').count(),
    0,
    'Landing CTAs never use placeholder links'
  )
  assert.match(
    await page.locator('[data-vista="socios"] .precio .boton').getAttribute('href'),
    /auth\?mode=register&next=%2Fcard/
  )
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 900 })
    await page
      .getByRole('heading', {
        name: 'Apoya los negocios de tu comunidad y obt\u00e9n descuentos',
        exact: true
      })
      .waitFor()
    assert.equal(
      await page.getByRole('button', { name: 'Socios', exact: true }).getAttribute('aria-pressed'),
      'true'
    )
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    )
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `Member landing fits ${width}px`
    )
    await page.screenshot({
      path: path.join(output, `landing-members-${width}.png`),
      fullPage: true
    })
    await page.getByRole('button', { name: 'Negocios', exact: true }).click()
    await page
      .getByRole('heading', { name: 'Haz que más personas descubran tu negocio', exact: true })
      .waitFor()
    assert.equal(await page.locator('.lc-landing [data-vista="socios"]').isVisible(), false)
    assert.equal(
      await page.locator('[data-vista="negocios"] .precio .boton').getAttribute('href'),
      '/registrar-negocio?origen=tarjeta'
    )
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `Business landing fits ${width}px`
    )
    await page.screenshot({
      path: path.join(output, `landing-business-${width}.png`),
      fullPage: true
    })
    await page.getByRole('button', { name: 'Socios', exact: true }).click()
    await page
      .getByRole('heading', {
        name: 'Apoya los negocios de tu comunidad y obt\u00e9n descuentos',
        exact: true
      })
      .waitFor()
  }
  await navigate(origin + '/club/')
  await page
    .getByRole('heading', {
      name: 'Apoya los negocios de tu comunidad y obt\u00e9n descuentos',
      exact: true
    })
    .waitFor()
  assert.equal(await page.locator('.bottom-nav').count(), 0)
  await navigate(origin + '/club#registro')
  await page
    .getByRole('heading', { name: 'Haz que más personas descubran tu negocio', exact: true })
    .waitFor()
  assert.equal(
    await page.getByRole('button', { name: 'Negocios', exact: true }).getAttribute('aria-pressed'),
    'true'
  )
  await page.setViewportSize({ width: 390, height: 844 })
  const businessPath = `/card/negocio/${providerId}?oferta=${offer.id}`
  await navigate(origin + businessPath)
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
  await page.waitForFunction((expected) => {
    const image = document.querySelector('.lc-business-detail-identity .lc-business-image img')
    return image?.getAttribute('src') === expected && image.complete && image.naturalWidth > 0
  }, offer.business_photo_url)
  assert.equal(await page.getByRole('searchbox').count(), 0)
  assert.equal(await page.getByRole('tab').count(), 0)
  await page.getByRole('button', { name: 'Compartir negocio', exact: true }).click()
  assert.equal(
    await page.evaluate(() => window.lastSharedLink.url),
    origin + `/card/negocio/${providerId}`
  )
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
  assert.equal(
    await page.getByRole('link', { name: 'Información de Latido Club', exact: true }).count(),
    0
  )
  const views = page.getByRole('tablist', { name: 'Ver', exact: true })
  await views.waitFor()
  await views.getByRole('tab', { name: /^Usados \(/ }).waitFor()
  await expect(views.getByRole('tab')).toHaveCount(3)
  await views.getByRole('tab', { name: 'Descuentos', exact: true }).press('ArrowRight')
  assert.equal(
    await views.getByRole('tab', { name: 'Negocios', exact: true }).getAttribute('aria-selected'),
    'true'
  )
  await views.getByRole('tab', { name: 'Negocios', exact: true }).press('ArrowRight')
  await page.getByText('Aún no has usado ningún descuento.', { exact: true }).waitFor()
  await views.getByRole('tab', { name: /^Usados \(/ }).press('Home')
  const alerts = page.locator('#lc-card-alerts')
  const alertsModal = page.getByRole('dialog', { name: 'Alertas de descuentos', exact: true })
  assert.equal(await alerts.isVisible(), false, 'Alert settings stay out of the catalog')
  await page.getByRole('switch', { name: 'Activar alertas', exact: true }).click()
  await alertsModal.waitFor()
  await alertsModal.press('Escape')
  await alertsModal.waitFor({ state: 'hidden' })
  assert.equal(
    await page
      .getByRole('switch', { name: 'Activar alertas', exact: true })
      .evaluate((button) => button === document.activeElement),
    true
  )
  await page.getByRole('button', { name: 'Alertas de descuentos', exact: true }).click()
  await alerts.getByRole('button', { name: 'Activar', exact: true }).click()
  await alerts.getByRole('alert').waitFor()
  const cantonSelect = alerts.getByLabel('Cantón para las alertas', { exact: true })
  assert.equal(await cantonSelect.getByRole('option').count(), 27)
  await cantonSelect.selectOption('VD')
  await cantonSelect.selectOption('ZH')
  failPreferenceSave = true
  await alerts.getByRole('button', { name: 'Activar', exact: true }).click()
  await alerts.getByRole('alert').waitFor()
  assert.equal(
    await alerts.locator('.lc-alerts-active').count(),
    0,
    'A failed save does not pretend that alerts are enabled'
  )
  failPreferenceSave = false
  await alerts.getByRole('button', { name: 'Activar', exact: true }).click()
  await alerts.getByRole('status').filter({ hasText: 'Alertas activadas' }).waitFor()
  assert.deepEqual(preferenceWrites.at(-1), { p_enabled: true, p_canton: 'ZH' })
  await alerts.getByRole('status').getByText('Zürich', { exact: true }).waitFor()
  assert.equal(await page.locator('.lc-alerts-invite').count(), 0)
  await alertsModal.getByRole('button', { name: 'Cerrar alertas', exact: true }).click()
  assert.equal(
    await page
      .getByRole('button', { name: 'Alertas de descuentos', exact: true })
      .evaluate((button) => button === document.activeElement),
    true
  )
  await reloadPage()
  await page.getByRole('button', { name: 'Alertas de descuentos', exact: true }).click()
  await alerts.getByRole('status').filter({ hasText: 'Alertas activadas' }).waitFor()
  await alertsModal.screenshot({ path: path.join(output, 'alerts-enabled-mobile.png') })
  await alerts.getByRole('button', { name: 'Desactivar', exact: true }).click()
  await alerts.getByRole('button', { name: 'Activar', exact: true }).waitFor()
  assert.deepEqual(preferenceWrites.at(-1), { p_enabled: false, p_canton: 'ZH' })
  await alertsModal.screenshot({ path: path.join(output, 'alerts-modal-mobile.png') })
  await alertsModal.getByRole('button', { name: 'Cerrar alertas', exact: true }).click()
  await alertsModal.waitFor({ state: 'hidden' })
  await page.getByRole('switch', { name: 'Activar alertas', exact: true }).waitFor()
  const backAfterAlerts = await page.locator('.lc-app-header-row button').first().boundingBox()
  assert.ok(backAfterAlerts.x >= 0, 'Closing alerts must not scroll the header out of view')
  await page.screenshot({ path: path.join(output, 'member-tabs-mobile.png'), fullPage: true })
  await navigate(origin + '/card')
  const firstAccordion = page.locator('.lc-discount-card').filter({ hasText: offer.title })
  const secondAccordion = page.locator('.lc-discount-card').filter({ hasText: special.title })
  await secondAccordion.waitFor()
  assert.equal(await secondAccordion.locator('.lc-offer-value .lucide-gift').count(), 1)
  assert.ok(!/🎁|✨/.test(await secondAccordion.locator('.lc-offer-value').innerText()))
  await firstAccordion.locator('.lc-discount-business').click()
  assert.equal(page.url(), origin + '/card', 'The business name toggles details without navigating')
  assert.equal(await firstAccordion.locator('.lc-discount-details').isVisible(), true)
  await checkDescriptionLinks(firstAccordion)
  await checkBusinessReturn(firstAccordion)
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
    /🎟️[\s\S]*Descuentos[\s\S]*🏪[\s\S]*Mi negocio/
  )
  assert.ok(
    (await page.getByRole('navigation', { name: 'Navegación de Latido Club' }).boundingBox())
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
  await page.locator('.lc-socio-mini').click({ position: { x: 12, y: 12 } })
  await page.getByRole('button', { name: 'Ocultar tarjeta', exact: true }).press('Space')
  await page.getByRole('button', { name: 'Ver tarjeta', exact: true }).press('Enter')
  await membershipCard.screenshot({
    path: path.join(output, 'membership-light-mobile.png'),
    animations: 'disabled'
  })
  assert.equal(await page.getByRole('radio', { name: /Clara|Oscura/ }).count(), 0)
  await page.evaluate((id) => localStorage.setItem(`latido-card-appearance:${id}`, 'dark'), user.id)
  await reloadPage()
  await page.locator('.lc-member-strip-heading').waitFor()
  assert.equal(await membershipCard.getAttribute('data-appearance'), 'light')
  assert.equal(
    await page
      .getByRole('button', { name: /Scanner|tarjeta física|Generar nuevo código/i })
      .count(),
    0
  )
  assert.equal(await page.getByRole('button', { name: 'Reclamar', exact: true }).count(), 0)
  const homeCardLink = page.getByRole('link', { name: /^(Ver mi tarjeta de Latido Club|Unirme a Latido Club)$/ })
  await navigate(origin + '/')
  await homeCardLink
    .locator('.home-latido-card-number')
    .getByText('2481', { exact: true })
    .waitFor()
  await homeCardLink.getByText(/^Válida hasta /).waitFor()
  await page.waitForLoadState('networkidle')
  await expect(homeCarousel.locator('.home-latido-carousel-slide').first().locator('.home-latido-featured')).toHaveCount(1)
  await homeCarousel.getByRole('button', { name: 'Mostrar Mi tarjeta del Club', exact: true }).click()
  await expect(homeCarousel.getByRole('button', { name: 'Mostrar Mi tarjeta del Club', exact: true })).toHaveAttribute('aria-current', 'true')
  assert.equal(await homeCardLink.getAttribute('href'), '/card')
  await page.evaluate(() => document.fonts.ready)
  await page
    .locator('.hero-section')
    .screenshot({ path: path.join(output, 'home-membership-mobile.png'), animations: 'disabled' })
  // Review-only mockup for D5: the production Home component is unchanged.
  const originalHomeInfo = await homeCardLink.locator('.home-latido-card-info').innerHTML()
  await homeCardLink.locator('.home-latido-card-info').evaluate((element) => {
    const heading = document.createElement('strong'),
      caption = document.createElement('span')
    heading.textContent = 'Latido Club'
    caption.textContent = '2 descuentos en Zürich'
    element.replaceChildren(heading, caption)
  })
  await homeCardLink.screenshot({ path: path.join(output, 'proposal-home-discounts-mobile.png') })
  await homeCardLink.locator('.home-latido-card-info').evaluate((element, html) => {
    element.innerHTML = html
  }, originalHomeInfo)
  await page.setViewportSize({ width: 320, height: 568 })
  const homeCardBounds = await homeCardLink.boundingBox()
  assert.ok(homeCardBounds.x >= 0 && homeCardBounds.x + homeCardBounds.width <= 320)
  await page.setViewportSize({ width: 390, height: 844 })
  await homeCardLink.click()
  await page.waitForURL(origin + '/card')
  await page.getByRole('heading', { name: 'Ofertas disponibles', exact: true }).waitFor()
  membershipActive = false
  await navigate(origin + '/')
  await homeCardLink.getByText('Membresía inactiva', { exact: true }).waitFor()
  await page.waitForLoadState('networkidle')
  assert.equal(await homeCardLink.getByText(/^Válida hasta /).count(), 0)
  membershipActive = true
  homeFailures = 10
  const failedHomeMembership = page.waitForResponse(
    (response) => response.url().endsWith('/lc_member_home') && response.status() === 503
  )
  await reloadPage()
  await failedHomeMembership
  await page.waitForLoadState('networkidle')
  await homeCardLink.getByText('Latido Club', { exact: true }).waitFor()
  homeFailures = 0
  await homeCardLink.click()
  await page.waitForURL(origin + '/card')
  await page.locator('.lc-member-strip-heading').waitFor()
  await navigate(origin + businessPath)
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
  await reloadPage()
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
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: ({ files }) => files?.every((file) => file.type === 'image/png' && file.size > 1000)
    })
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
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: ({ files }) => files?.every((file) => file.type === 'image/png' && file.size > 1000)
    })
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
    'rgb(42, 85, 223)'
  )
  await discountCard.screenshot({ path: path.join(output, 'discount-closed-mobile.png') })
  assert.equal(
    await discountCard.evaluate((element) => element.scrollLeft),
    0,
    'Sharing keeps coupon content aligned'
  )
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
  const originalValidationUrl = page.url(),
    recordedUses = useCalls.length
  await page.getByRole('link', { name: 'Volver a mi tarjeta', exact: true }).click()
  await page.evaluate(() => {
    window.cardTestRealNow = Date.now
    Date.now = () => window.cardTestRealNow() + 12 * 3600000
  })
  await page.getByRole('link', { name: /Tienes un descuento abierto/ }).waitFor()
  await page.evaluate(() => {
    Date.now = window.cardTestRealNow
    delete window.cardTestRealNow
  })
  await page.getByRole('link', { name: /Tienes un descuento abierto/ }).click()
  await page.waitForURL(originalValidationUrl)
  await page.getByText('Descuento válido', { exact: true }).waitFor()
  assert.equal(useCalls.length, recordedUses, 'Reopening the validation never records another use')
  await page.waitForFunction(() => window.wakeRequests > 0)
  assert.deepEqual(await page.evaluate(() => window.cardVibrations), [40, 40])
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
    [40, 40],
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
  await page.locator('.lc-proof-seal').waitFor()
  assert.equal(useCalls.length, 2)
  assert.equal(useCalls[0].p_request_id, useCalls[1].p_request_id, 'Retry reuses the request UUID')
  assert.equal(useCalls[0].p_offer, offer.id)
  await page.screenshot({ path: path.join(output, 'validation-mobile.png'), fullPage: true })
  const expires = receipt.expires_at
  const businessName = receipt.business_name
  receipt.business_name = '[TEST] Peluquería Brisa Latina'
  await reloadPage()
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
  await reloadPage()
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
  await reloadPage()
  await page.getByText('Descuento válido', { exact: true }).waitFor()
  assert.equal(
    await page.evaluate(() => window.wakeRequests),
    0,
    'Denied wake lock does not prevent using a valid receipt'
  )
  await page.evaluate(() => sessionStorage.removeItem('lc-test-wake-denied'))
  receipt.expires_at = new Date(Date.now() + 10000).toISOString()
  await reloadPage()
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
  await page.getByRole('heading', { name: 'Ofertas disponibles', exact: true }).waitFor()
  await page.locator('#lc-offers').waitFor()
  assert.equal(
    await page.locator('.lc-business-heading').count(),
    0,
    'Returning shows the normal card page, without a business heading'
  )
  await page.getByRole('tab', { name: /^Usados \(/ }).click()
  await page.locator('#lc-member-history').waitFor()
  await page.getByText('Usado', { exact: true }).first().waitFor()
  assert.equal(await page.locator('.lc-use-row').count(), 1)
  await page.getByRole('tab', { name: 'Descuentos', exact: true }).click()
  await page.getByRole('heading', { name: special.title, exact: true }).waitFor()
  const usedMonthlyCard = page.locator('.lc-discount-card').filter({ hasText: offer.title })
  await usedMonthlyCard.getByText(/^Disponible el/).waitFor()
  assert.equal(
    await usedMonthlyCard.getByRole('button', { name: 'Compartir', exact: true }).isEnabled(),
    true
  )
  const usesBeforeSharing = useCalls.length
  await page.evaluate(() => {
    window.lastSharedLink = null
  })
  await usedMonthlyCard.getByRole('button', { name: 'Compartir', exact: true }).click()
  await page.waitForFunction(
    (id) => window.lastSharedLink?.url?.endsWith(`?oferta=${id}`),
    offer.id
  )
  assert.equal(
    useCalls.length,
    usesBeforeSharing,
    'Sharing a used discount never registers another use'
  )
  for (const width of [320, 390, 480]) {
    await page.setViewportSize({ width, height: 844 })
    const spacing = await usedMonthlyCard.evaluate((card) => {
      const footer = card.querySelector('.lc-discount-summary')
      const button = footer.querySelector('.lc-discount-primary').getBoundingClientRect()
      const top =
        footer.getBoundingClientRect().top + parseFloat(getComputedStyle(footer).borderTopWidth)
      const bottom = card.querySelector('.lc-offer-brand-stripe').getBoundingClientRect().top
      return { above: button.top - top, below: bottom - button.bottom }
    })
    assert.ok(
      Math.abs(spacing.above - spacing.below) < 2,
      `Used action is vertically centered at ${width}px`
    )
    await usedMonthlyCard.screenshot({ path: path.join(output, `used-share-${width}.png`) })
  }
  await page.setViewportSize({ width: 390, height: 844 })
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
  const limitedValidationUrl = page.url(),
    limitedUseCount = useCalls.length
  await page.getByRole('link', { name: 'Volver a mi tarjeta', exact: true }).click()
  await page.getByRole('link', { name: /Tienes un descuento abierto/ }).click()
  await page.waitForURL(limitedValidationUrl)
  await page.getByText('Descuento válido', { exact: true }).waitFor()
  assert.equal(
    useCalls.length,
    limitedUseCount,
    'A consumed limited offer reopens the same validation without consuming again'
  )
  await page.getByRole('link', { name: 'Volver a mi tarjeta', exact: true }).click()
  await page.waitForURL(origin + '/card')
  await page.locator('#lc-offers').waitFor()
  const usedLimitedCard = page.locator('.lc-discount-card').filter({ hasText: special.title })
  await usedLimitedCard.getByText('Ya usado', { exact: true }).waitFor()
  assert.equal(
    await usedLimitedCard.getByRole('button', { name: 'Compartir', exact: true }).isEnabled(),
    true
  )
  await usedLimitedCard.screenshot({ path: path.join(output, 'used-limited-share-mobile.png') })
  await page.getByRole('tab', { name: /^Usados \(/ }).click()
  await page.locator('#lc-member-history').waitFor()
  assert.equal(await page.locator('.lc-use-row').count(), 2)
  assert.equal(
    await page.locator('.lc-use-row button').count(),
    0,
    'History never offers activation or reopening, even for a live receipt'
  )
  await page.screenshot({ path: path.join(output, 'member-mobile.png'), fullPage: true })
  const usesBeforeBusinessVisit = useCalls.length
  await navigate(origin + `/card/negocio/${providerId}`)
  await page.getByRole('heading', { name: 'Ya usaste aquí', exact: true }).waitFor()
  assert.equal(await page.locator('.lc-business-used-offer').count(), 2)
  assert.equal(await page.getByRole('searchbox').count(), 0)
  assert.equal(useCalls.length, usesBeforeBusinessVisit)
  await page.getByRole('link', { name: 'Volver a los negocios', exact: true }).click()
  await page.getByRole('link', { name: 'Mi negocio', exact: true }).click()
  await page.getByRole('heading', { name: 'Tus ofertas', exact: true }).waitFor()
  await page.getByRole('heading', { name: 'Actividad', exact: true }).waitFor()
  await page.locator('.lc-business-month-result').waitFor()
  assert.match(
    await page.locator('.lc-business-month-result').innerText(),
    /Descuentos usados este mes en tu negocio/
  )
  assert.equal(await page.getByText(/socios distintos|Descuento habitual \d\/1/).count(), 0)
  assert.equal(await page.getByRole('button', { name: 'Mis ofertas', exact: true }).count(), 0)
  const material = page
    .locator('details')
    .filter({ has: page.locator('summary').getByText('Material para tu local', { exact: true }) })
  assert.equal(await material.evaluate((el) => el.open), false)
  await material.locator('summary').click()
  await material.getByAltText(`QR público de ${offer.business_name}`).waitFor()
  await material.getByRole('button', { name: 'Copiar enlace público', exact: true }).click()
  await material.getByText('Copiado', { exact: true }).waitFor()
  assert.equal(
    await page.evaluate(() => window.lastCopiedText),
    origin + `/card/negocio/${providerId}`
  )
  assert.equal(
    await material.getByRole('button').count(),
    3,
    'Only download, image sharing and copy remain'
  )
  assert.equal(await material.getByRole('link').count(), 0)
  await material.getByRole('button', { name: 'Compartir imagen', exact: true }).click()
  assert.deepEqual(
    await page.evaluate(() => {
      const data = window.lastSharedLink
      return { type: data.files?.[0]?.type, image: data.files?.[0]?.size > 1000, url: data.url }
    }),
    { type: 'image/png', image: true, url: undefined }
  )
  await page.evaluate(() => {
    window.originalCanShare = navigator.canShare
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false })
  })
  const shareFallbackDownload = page.waitForEvent('download')
  await material.getByRole('button', { name: 'Compartir imagen', exact: true }).click()
  assert.match((await shareFallbackDownload).suggestedFilename(), /\.png$/)
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: window.originalCanShare
    })
  })
  const qrDownload = page.waitForEvent('download')
  await material.getByRole('button', { name: 'Descargar imagen', exact: true }).click()
  const downloadedImage = await qrDownload
  assert.match(downloadedImage.suggestedFilename(), /\.png$/)
  await downloadedImage.saveAs(path.join(output, 'business-material.png'))
  const imagePixels = await page.evaluate(async () => {
    const file = window.lastSharedLink.files[0]
    const href = URL.createObjectURL(file)
    try {
      const image = new Image()
      image.src = href
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(image, 0, 0)
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data
      let black = 0,
        blue = 0
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i] < 50 && pixels[i + 1] < 50 && pixels[i + 2] < 50) black++
        if (pixels[i] < 80 && pixels[i + 2] > 150) blue++
      }
      return { black, blue }
    } finally {
      URL.revokeObjectURL(href)
    }
  })
  assert.ok(imagePixels.black > 1000, 'The exported PNG contains the QR pixels')
  assert.ok(imagePixels.blue > 1000, 'The exported PNG contains the branded sticker')
  await page
    .getByText('Imagen descargada. Puedes compartirla desde tus archivos.', { exact: true })
    .waitFor({ state: 'hidden' })
  await material.screenshot({ path: path.join(output, 'business-material-mobile.png') })
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 844 })
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `Business layout fits ${width}px`
    )
    const createBox = await page
      .getByRole('button', { name: 'Crear oferta', exact: true })
      .boundingBox()
    assert.ok(
      createBox.y >= 0 && createBox.y + createBox.height <= page.viewportSize().height,
      'Create offer stays within the viewport after scrolling'
    )
    assert.equal(
      await page.locator('.lc-business-create-bar').evaluate((el) => getComputedStyle(el).position),
      'fixed'
    )
    await page.screenshot({ path: path.join(output, `business-${width}.png`), fullPage: true })
  }
  await page.setViewportSize({ width: 390, height: 844 })
  const printable = await context.newPage()
  await printable.goto(origin + `/card/material/${providerId}`)
  await printable.getByAltText(`QR público de ${offer.business_name}`).waitFor()
  await printable.emulateMedia({ media: 'print' })
  assert.equal(await printable.locator('.lc-print-controls').isVisible(), false)
  await printable.screenshot({ path: path.join(output, 'business-qr-print.png') })
  await printable.goto(origin + `/card/material/${providerId}?tipo=guia`)
  await printable
    .getByRole('heading', { name: 'Cómo aplicar un descuento de Latido Club', exact: true })
    .waitFor()
  assert.equal(await printable.locator('.lc-staff-guide li').count(), 3)
  await printable.screenshot({ path: path.join(output, 'staff-guide-a6.png') })
  await printable.close()
  await page.getByRole('button', { name: 'Crear oferta', exact: true }).click()
  let offerModal = page.getByRole('dialog', { name: 'Crear oferta', exact: true })
  await offerModal.getByText('Paso 1 de 4', { exact: true }).waitFor()
  assert.equal(
    await offerModal
      .getByRole('group', { name: 'Tipo de oferta', exact: true })
      .locator('.lucide-gift')
      .count(),
    1
  )
  assert.equal(
    await offerModal
      .getByRole('group', { name: 'Tipo de oferta', exact: true })
      .locator('.lucide-sparkles')
      .count(),
    1
  )
  assert.equal(await page.locator('.lc-capacity-notice').count(), 0)
  await offerModal.screenshot({ path: path.join(output, 'create-multiple-offers.png') })
  await offerModal.getByRole('button', { name: 'Siguiente', exact: true }).click()
  await offerModal.getByRole('button', { name: 'Siguiente', exact: true }).click()
  await offerModal.getByRole('radio', { name: /^Siempre que venga/ }).check()
  await offerModal.getByRole('button', { name: 'Siguiente', exact: true }).click()
  await offerModal.locator('.lc-create-options summary').click()
  const promotionToggle = offerModal.getByLabel('Promoción especial con unidades limitadas')
  assert.equal(await promotionToggle.isChecked(), false)
  assert.equal(await promotionToggle.isEnabled(), true)
  await promotionToggle.check()
  await offerModal.getByRole('spinbutton', { name: /^Unidades disponibles/ }).fill('10')
  await promotionToggle.uncheck()
  await offerModal.getByRole('button', { name: 'Publicar oferta', exact: true }).click()
  await page.getByRole('dialog', { name: '¡Oferta publicada!', exact: true }).waitFor()
  assert.equal(savedOffers.at(-1).p_offer.requires_claim, false)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Crear oferta', exact: true }).click()
  await offerModal.getByText('Paso 1 de 4', { exact: true }).waitFor()
  for (let index = 0; index < 3; index++)
    await offerModal.getByRole('button', { name: 'Siguiente', exact: true }).click()
  await offerModal.locator('.lc-create-options summary').click()
  await promotionToggle.check()
  await offerModal.getByRole('spinbutton', { name: /^Unidades disponibles/ }).fill('10')
  await offerModal.getByRole('button', { name: 'Publicar oferta', exact: true }).click()
  await page.getByRole('dialog', { name: '¡Oferta publicada!', exact: true }).waitFor()
  assert.equal(savedOffers.at(-1).p_offer.requires_claim, true)
  assert.ok(!rpcCalls.includes('lc_set_offer_active'), 'Creating offers never pauses existing ones')
  await page.keyboard.press('Escape')
  await page.getByLabel('Negocio que quieres gestionar', { exact: true }).selectOption(provider2)
  await page.getByRole('heading', { name: 'Peluquería Latina', exact: true, level: 1 }).waitFor()
  await page.locator('summary').getByText('Material para tu local', { exact: true }).click()
  await page.getByText('Publica tu primera oferta para obtener tu QR.', { exact: true }).waitFor()
  assert.equal(await page.locator('img.lc-qr').count(), 0)
  await page.getByRole('button', { name: 'Crear oferta', exact: true }).click()
  await offerModal.getByRole('heading', { name: '¿Qué quieres ofrecer?', exact: true }).waitFor()
  await offerModal.getByRole('radio', { name: /^Cantidad fija/ }).check()
  await offerModal
    .getByRole('group', { name: '¿Desde qué compra?', exact: true })
    .getByRole('radio', { name: 'CHF 20', exact: true })
    .check()
  await offerModal.screenshot({ path: path.join(output, 'offer-fixed-minimum-mobile.png') })
  for (let i = 0; i < 3; i++)
    await offerModal.getByRole('button', { name: 'Siguiente', exact: true }).click()
  await offerModal.locator('.lc-create-options summary').click()
  assert.equal(
    await offerModal.getByLabel('Válido hasta', { exact: true }).getAttribute('type'),
    'date'
  )
  await offerModal.getByLabel('Válido hasta', { exact: true }).fill('2027-07-10')
  await offerModal.getByText('Los socios ven tu oferta en Latido.', { exact: true }).waitFor()
  await page.setViewportSize({ width: 320, height: 568 })
  assert.ok(
    (await offerModal.getByRole('button', { name: 'Publicar oferta', exact: true }).boundingBox())
      .y < 568
  )
  await offerModal.screenshot({ path: path.join(output, 'offer-review-320.png') })
  await page.setViewportSize({ width: 390, height: 844 })
  await offerModal.screenshot({ path: path.join(output, 'offer-review-mobile.png') })
  await offerModal.getByRole('button', { name: 'Publicar oferta', exact: true }).click()
  const success = page.getByRole('dialog', { name: '¡Oferta publicada!', exact: true })
  await success
    .getByRole('heading', { name: 'Siguiente paso: pon tu QR en la caja', exact: true })
    .waitFor()
  assert.equal(savedOffers.at(-1).p_offer.minimum_spend, 20)
  assert.equal(savedOffers.at(-1).p_offer.ends_at, '2027-07-10T21:59:59.000Z')
  assert.ok(savedOffers.at(-1).p_offer.original_draft)
  await success.getByAltText('QR público de Peluquería Latina').waitFor()
  await success.screenshot({ path: path.join(output, 'first-offer-success-mobile.png') })
  const successDownload = page.waitForEvent('download')
  await success.getByRole('button', { name: 'Descargar imagen', exact: true }).click()
  assert.match((await successDownload).suggestedFilename(), /.png$/)
  await success.getByRole('link', { name: 'Ir a Mi negocio', exact: true }).click()
  assert.equal(await page.locator('dialog[open]').count(), 0)
  // Existing offers open prefilled, and used terms create a replacement.
  await page.getByLabel('Negocio que quieres gestionar', { exact: true }).selectOption(providerId)
  const managed = page.locator('.lc-managed-offer').filter({ hasText: offer.title })
  await managed.locator('summary').click()
  await managed.getByRole('button', { name: 'Editar', exact: true }).click()
  const replacement = page.getByRole('dialog', { name: 'Crear nueva versión', exact: true })
  await replacement.getByRole('heading', { name: '¿Qué quieres ofrecer?', exact: true }).waitFor()
  assert.equal(await replacement.getByRole('radio', { name: /^Descuento %/ }).isChecked(), true)
  await page.keyboard.press('Escape')
  const pausedCard = page.locator('.lc-managed-offer').filter({ hasText: pausedOffer.title })
  await pausedCard.locator('summary').click()
  page.once('dialog', (dialog) => dialog.dismiss())
  await pausedCard.getByRole('button', { name: 'Borrar', exact: true }).click()
  assert.ok(!rpcCalls.includes('lc_delete_offer'))
  page.once('dialog', (dialog) => dialog.accept())
  await pausedCard.getByRole('button', { name: 'Borrar', exact: true }).click()
  await pausedCard.waitFor({ state: 'detached' })
  // One optional invitation at app entry; dismissal persists and its CTA opens the right wizard.
  invitationEligible = true
  await navigate(origin + '/')
  const invitation = page.locator('.lc-business-invitation-dialog')
  await invitation.waitFor()
  await page.waitForLoadState('networkidle')
  await invitation.getByRole('heading', { name: 'Atrae más clientes', exact: true }).waitFor()
  await invitation.getByText('Tu negocio ya está publicado', { exact: true }).waitFor()
  for (const label of [/^Descuento/, /^Cantidad fija/, /^2x1 o similar/, /^Regalo/, /^Otro beneficio/])
    assert.equal(await invitation.getByRole('button', { name: label }).count(), 1)
  await invitation.locator('.lc-offer-preview').getByText('Zürich', { exact: true }).waitFor()
  assert.equal(
    await invitation.getByRole('button', { name: 'Comparte tu negocio', exact: true }).count(),
    0
  )
  assert.equal(await page.locator('dialog[open], [role="dialog"]').count(), 1)
  assert.ok((await invitation.boundingBox()).height <= 844)
  await page.screenshot({
    path: path.join(output, 'business-invitation-mobile.png'),
    fullPage: true
  })
  await page.keyboard.press('Escape')
  await invitation.waitFor({ state: 'detached' })
  await reloadPage()
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
  await reloadPage()
  await invitation.waitFor()
  await page.waitForLoadState('networkidle')
  await invitation.getByRole('button', { name: /^2x1 o similar/ }).click()
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
  await navigate(origin + `/?crear-oferta=${provider2}`)
  await offerModal.waitFor()
  await offerModal.getByRole('heading', { name: '¿Qué quieres ofrecer?', exact: true }).waitFor()
  await page.waitForLoadState('networkidle')
  await offerModal.getByRole('button', { name: 'Cerrar creación de oferta', exact: true }).click()
  assert.equal(new URL(page.url()).searchParams.has('crear-oferta'), false)
  await page.waitForLoadState('networkidle')
  invitationEligible = false
  // Landing is an option inside promotion. Publication ends with an inline invitation, not an upsell popup.
  await navigate(origin + '/registrar-negocio?origen=tarjeta')
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
  await page.getByText('Opcional. Puedes activarlo más tarde', { exact: true }).waitFor()
  await page.getByRole('switch', { name: 'Activar potenciar tu negocio', exact: true }).click()
  const promotion = page
    .locator('section')
    .filter({ has: page.getByRole('button', { name: 'Potenciar tu negocio', exact: false }) })
  await promotion.getByRole('button', { name: 'Landing page en Latido', exact: true }).waitFor()
  await promotion.screenshot({ path: path.join(output, 'promotion-with-landing-mobile.png') })
  await page
    .getByRole('button', { name: 'Continuar solo con el perfil gratuito', exact: true })
    .click()
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }))
  assert.ok(await page.evaluate(() => window.scrollY > 0), 'Publish from the bottom of the registration form')
  await page.getByRole('button', { name: '🏪 Registrar negocio', exact: true }).click()
  await page
    .getByRole('dialog', { name: 'No te pierdas nada', exact: true })
    .getByRole('button', { name: 'Ahora no', exact: true })
    .click()
  await page.getByRole('heading', { name: 'Atrae más clientes', level: 1, exact: true }).waitFor()
  assert.equal(await page.getByRole('heading', { name: '¡Negocio publicado!', exact: true }).count(), 0)
  await page.getByText('Tu negocio ya está publicado', { exact: true }).waitFor()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
  const nextOffer = page.locator('.lc-business-invitation')
  await nextOffer.getByRole('heading', { name: 'Atrae más clientes', exact: true }).waitFor()
  await nextOffer.getByText('Crea ofertas y haz que tu negocio destaque en Latido. Aparece en las secciones principales y consigue que más personas te descubran.', { exact: true }).waitFor()
  await nextOffer.getByText('¿Qué quieres ofrecer?', { exact: true }).waitFor()
  assert.equal(await nextOffer.locator('.lc-invitation-example-label').count(), 0)
  assert.equal(await nextOffer.locator('.lc-invitation-steps').count(), 0)
  await nextOffer.locator('.lc-offer-preview').getByText('1 vez al mes', { exact: true }).waitFor()
  await nextOffer.locator('.lc-offer-preview').getByText('Usar ahora', { exact: true }).waitFor()
  assert.equal(await page.getByText('Profesional desbloqueado', { exact: true }).count(), 0)
  await page.screenshot({
    path: path.join(output, 'registration-next-offer-mobile.png'),
    fullPage: true
  })
  assert.equal(
    await page.getByRole('button', { name: 'Comparte tu negocio', exact: true }).count(),
    0
  )
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
  await offerModal.getByRole('button', { name: 'Siguiente', exact: true }).click()
  await offerModal.getByRole('button', { name: 'Siguiente', exact: true }).click()
  await offerModal.locator('.lc-create-options summary').click()
  await offerModal.getByLabel('Válido hasta', { exact: true }).fill('')
  await offerModal.getByText('Sin compra mínima · Sin fecha de fin', { exact: true }).waitFor()
  await offerModal.getByRole('button', { name: 'Publicar oferta', exact: true }).click()
  await page.getByRole('dialog', { name: '¡Oferta publicada!', exact: true }).waitFor()
  await page.getByRole('dialog').getByRole('link', { name: 'Ir a Mi negocio', exact: true }).click()
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
  await navigate(origin + '/card/admin')
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
  await navigate(origin + '/card')
  discoveryMode = true
  await reloadPage()
  await page.getByRole('heading', { name: 'Ofertas disponibles', exact: true }).waitFor()
  const discounts = page.getByRole('region', { name: 'Ofertas disponibles', exact: true })
  await page.getByLabel('Ciudad', { exact: true }).selectOption('Genève')
  const localOffers = discounts.locator('#lc-offers .lc-discount-card')
  const nearbyOffers = discounts.getByRole('region', { name: 'Más ofertas cercanas', exact: true })
  assert.equal(await localOffers.count(), 1)
  assert.equal(await nearbyOffers.locator('.lc-discount-card').count(), 10)
  assert.equal(await nearbyOffers.locator('.lc-discount-title').first().innerText(), 'Descuento 1')
  await nearbyOffers.getByRole('button', { name: 'Mostrar todos (13)', exact: true }).click()
  assert.equal(await nearbyOffers.locator('.lc-discount-card').count(), 13)
  assert.deepEqual(
    (await nearbyOffers.locator('.lc-discount-city').allTextContents()).map((city) => city.trim()),
    [...Array(11).fill('· Berna'), '· Zürich', '· Zürich'],
    'Bern offers precede Zurich offers by geographic distance from Geneva'
  )
  await page.getByLabel('Ciudad', { exact: true }).selectOption('Berna')
  assert.equal(await localOffers.count(), 10)
  await discounts.getByRole('button', { name: 'Mostrar todos (11)', exact: true }).click()
  assert.equal(await localOffers.count(), 11)
  assert.deepEqual(
    (await nearbyOffers.locator('.lc-discount-city').allTextContents()).map((city) => city.trim()),
    ['· Zürich', '· Zürich', '· Genève'],
    'Changing city recomputes proximity instead of retaining the previous order'
  )
  await page.getByLabel('Ciudad', { exact: true }).selectOption('Genève')
  assert.equal(await localOffers.count(), 1)
  assert.equal(await nearbyOffers.locator('.lc-discount-card').count(), 10)
  await page
    .getByRole('searchbox', { name: 'Buscar descuentos y negocios', exact: true })
    .fill('noexiste')
  assert.equal(await discounts.locator('.lc-discount-card').count(), 0)
  await page.getByRole('searchbox', { name: 'Buscar descuentos y negocios', exact: true }).fill('')
  await page
    .getByRole('group', { name: 'Tipo de oferta', exact: true })
    .getByRole('button', { name: 'Regalos', exact: true })
    .click()
  assert.equal(await localOffers.count(), 0)
  assert.equal(await nearbyOffers.locator('.lc-discount-card').count(), 1)
  assert.equal(await nearbyOffers.locator('.lc-discount-title').innerText(), special.title)
  await page
    .getByRole('group', { name: 'Tipo de oferta', exact: true })
    .getByRole('button', { name: 'Todo', exact: true })
    .click()
  await page.screenshot({ path: path.join(output, 'nearby-offers-mobile.png'), fullPage: true })
  await page.getByRole('tab', { name: 'Negocios', exact: true }).click()
  assert.equal(await page.locator('#lc-business-directory li').count(), 1)
  assert.equal(await page.locator('#lc-business-directory-nearby li').count(), 10)
  const nearbyBusinesses = page.getByRole('region', { name: 'Más negocios cercanos', exact: true })
  await nearbyBusinesses.getByRole('button', { name: 'Mostrar todos (12)', exact: true }).click()
  assert.equal(await page.locator('#lc-business-directory-nearby li').count(), 12)
  assert.deepEqual(
    (await nearbyBusinesses.locator('.lc-directory-city').allTextContents()).map((city) =>
      city.trim()
    ),
    [...Array(11).fill('Berna'), 'Zürich']
  )
  await page.getByLabel('Ciudad', { exact: true }).selectOption('')
  assert.equal(await nearbyBusinesses.count(), 0)
  await page
    .getByRole('searchbox', { name: 'Buscar descuentos y negocios', exact: true })
    .fill('cafe geneve')
  assert.equal(await page.locator('#lc-business-directory li').count(), 1)
  await page
    .getByRole('tablist', { name: 'Ver', exact: true })
    .getByRole('tab', { name: 'Descuentos', exact: true })
    .click()
  assert.equal(await discounts.locator('.lc-discount-card').count(), 1)
  await page.getByRole('searchbox', { name: 'Buscar descuentos y negocios', exact: true }).fill('')
  const typeFilters = page.getByRole('group', { name: 'Tipo de oferta', exact: true })
  await typeFilters.getByRole('button', { name: 'Regalos', exact: true }).click()
  assert.equal(await discounts.locator('.lc-discount-card').count(), 1)
  await page.getByRole('tab', { name: 'Negocios', exact: true }).click()
  assert.equal(await page.locator('#lc-business-directory li').count(), 1)
  await page
    .getByRole('tablist', { name: 'Ver', exact: true })
    .getByRole('tab', { name: 'Descuentos', exact: true })
    .click()
  await typeFilters.getByRole('button', { name: '2x1', exact: true }).click()
  assert.equal(await discounts.locator('.lc-discount-card').count(), 0)
  await typeFilters.getByRole('button', { name: 'Todo', exact: true }).click()
  assert.equal(await page.locator('.lc-category-filters').count(), 0)
  assert.ok(await discounts.locator('.lc-discount-card').count())
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 320, height: 568 })
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  await page.screenshot({
    path: path.join(output, 'member-320-reduced-motion.png'),
    fullPage: true
  })
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.screenshot({ path: path.join(output, 'member-desktop.png'), fullPage: true })
  await navigate(origin + '/explorar')
  await page.locator('input[aria-label="Buscar en Latido"]:visible').fill('Sabor')
  const offerResult = page
    .locator('button')
    .filter({ hasText: 'Oferta para socios' })
    .filter({ hasText: offer.title })
    .first()
  await offerResult.waitFor()
  await offerResult.click()
  await page.waitForURL(origin + `/card/negocio/${providerId}?oferta=${offer.id}`)
  await page.getByRole('heading', { name: 'Ofertas de este negocio', exact: true }).waitFor()
  await navigate(origin + '/card')
  await page.setViewportSize({ width: 390, height: 844 })
  ownsBusiness = false
  await reloadPage()
  await page.waitForLoadState('networkidle')
  assert.equal(
    await page.locator('.lc-links').count(),
    1,
    'Customers have the discounts tab without business access'
  )
  await page.getByRole('link', { name: /¿Tienes un negocio/ }).waitFor()
  const firstDiscount = await discounts.locator('.lc-discount-card').first().boundingBox()
  assert.ok(firstDiscount.y < 844, 'A discount appears in the first mobile screen')
  await page.screenshot({ path: path.join(output, 'member-mobile.png'), fullPage: true })
  membershipActive = false
  await reloadPage()
  const renewal = page
    .locator('.lc-membership-renewal')
    .getByRole('link', { name: 'Renovar', exact: true })
  await renewal.waitFor()
  const mail = new URL(await renewal.getAttribute('href'))
  assert.match(mail.searchParams.get('body'), /ana@test.example/)
  assert.match(mail.searchParams.get('body'), /2481/)
  hasMembership = false
  await page.evaluate(() => localStorage.removeItem('sb-127-auth-token'))
  await navigate(origin + '/card')
  await page
    .getByRole('heading', { name: 'Ahorra en los negocios de tu comunidad', exact: true })
    .waitFor()
  assert.equal(await page.getByRole('tab').count(), 2)
  assert.equal(await page.locator('.lc-intro-card-preview').count(), 0)
  const introTitle = await page.locator('.lc-intro-presentation h1').boundingBox()
  const illustration = await page.locator('.lc-intro-illustration').boundingBox()
  const benefits = await page.locator('.lc-intro-benefits').boundingBox()
  assert.ok(
    illustration.y > introTitle.y && illustration.y < benefits.y,
    'The tilted card sits below the headline'
  )
  assert.equal(await page.locator('.lc-intro-benefits li').count(), 3)
  assert.equal(await page.locator('.lc-intro-how .lc-usage-steps li').count(), 3)
  await page.setViewportSize({ width: 320, height: 568 })
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.screenshot({
    path: path.join(output, 'visitor-320-reduced-motion.png'),
    fullPage: true
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: path.join(output, 'visitor-mobile.png'), fullPage: true })
  await page
    .locator('.lc-intro-presentation')
    .screenshot({ path: path.join(output, 'visitor-card-presentation.png') })
  await navigate(origin + `/card/negocio/${providerId}`)
  await page.getByRole('link', { name: 'Ver en Latido', exact: true }).waitFor()
  assert.equal(await page.getByRole('searchbox').count(), 0)
  assert.equal(await page.getByRole('tab').count(), 0)
  await page.getByRole('link', { name: 'Cómo llegar', exact: true }).waitFor()
  await page.screenshot({ path: path.join(output, 'business-detail-mobile.png'), fullPage: true })
  await navigate(origin + '/colaboraciones')
  await page
    .getByRole('heading', { name: 'Haz que más personas descubran tu negocio', exact: true })
    .waitFor()
  assert.equal(
    await page.getByRole('link', { name: 'Más información', exact: true }).getAttribute('href'),
    '/club#negocios'
  )
  const companyPromo = page.getByRole('region', {
    name: 'Haz que más personas descubran tu negocio',
    exact: true
  })
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    await page.evaluate(() => document.fonts.ready)
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    )
    const promoBox = await companyPromo.boundingBox()
    assert.ok(
      promoBox.x >= 0 && promoBox.x + promoBox.width <= width,
      `Company promo fits ${width}px`
    )
    await expect.poll(
      () => companyPromo.evaluate((card) =>
        card.querySelector('.lc-company-promo-types').getBoundingClientRect().left -
        card.querySelector('.lc-company-promo-free').getBoundingClientRect().right
      ),
      { message: `The offer illustration does not cover Gratis at ${width}px` }
    ).toBeGreaterThan(0)
    assert.equal(await companyPromo.locator('.lucide-gift').count(), 1)
    await companyPromo.screenshot({ path: path.join(output, `companies-invitation-${width}.png`) })
  }
  await page.setViewportSize({ width: 390, height: 844 })
  // A business owner without a personal membership still sees every matching offer.
  ownsBusiness = true
  discoveryMode = false
  await page.evaluate(
    (auth) => localStorage.setItem('sb-127-auth-token', JSON.stringify(auth)),
    session()
  )
  await navigate(origin + '/card')
  await page.getByRole('heading', { name: 'Ofertas disponibles', exact: true }).waitFor()
  const completeCatalog = page.getByRole('region', { name: 'Ofertas disponibles', exact: true })
  assert.equal(
    await completeCatalog.locator('.lc-discount-card').count(),
    2,
    'Highlights never remove the only offers from the filtered catalog'
  )
  await page.getByRole('link', { name: 'Mi negocio', exact: true }).waitFor()
  await page.screenshot({
    path: path.join(output, 'owner-without-membership-catalog.png'),
    fullPage: true
  })
  // Tablón receives search results through a parent callback; its idle and search
  // renders must settle, and both kinds of detail route must close normally.
  await navigate(origin + `/tablon?openAd=${housingAd.id}`)
  await page.getByRole('heading', { name: housingAd.title, exact: true, level: 1 }).waitFor()
  await page.getByRole('button', { name: 'Volver', exact: true }).click()
  await page.waitForURL(origin + '/tablon')
  await page
    .getByRole('heading', { name: housingAd.title, exact: true, level: 1 })
    .waitFor({ state: 'hidden' })
  await navigate(origin + `/anuncios/${housingAd.id}--habitaciones`)
  await page.getByRole('heading', { name: housingAd.title, exact: true, level: 1 }).waitFor()
  await page.getByRole('button', { name: 'Volver', exact: true }).click()
  await page.waitForURL(origin + '/tablon')
  await page
    .getByRole('textbox', { name: 'Buscar en esta sección', exact: true })
    .fill('Habitaciones')
  await page.waitForLoadState('networkidle')
  assert.ok(
    !errors.some((message) => /Maximum update depth|Too many re-renders/.test(message)),
    'Search result callbacks must not create a parent/child render loop'
  )
  assert.equal(await page.evaluate(() => window.cameraRequests), 0)
  assert.deepEqual(errors, [])
  assert.ok(!rpcCalls.some((name) => /scanner|physical|digital_card|card_code/.test(name)))
  console.log(
    `${useWebkit ? 'WebKit iPhone' : 'Chromium Android'}: confirmation and validation unchanged; recovery, multiple offers, QR/PNG/print, prefilled offers, shared filters, membership and visitor flows passed`
  )
  }
} catch (error) {
  await page
    ?.screenshot({ path: path.join(output, 'failure-latest.png'), fullPage: true })
    .catch(() => {})
  throw error
} finally {
  await browser?.close()
  server.kill()
}
