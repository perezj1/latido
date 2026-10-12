import assert from 'node:assert/strict'
import path from 'node:path'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { getGuideById, getGuidePath } from '../src/lib/seo.js'

if (!process.argv[2]) throw new Error('Pass the path to playwright/index.mjs; start Vite first (default port 8080).')
const { chromium } = await import(pathToFileURL(path.resolve(process.argv[2])).href)
const baseUrl = process.env.LATIDO_TEST_URL || 'http://127.0.0.1:8080'
const outputDir = mkdtempSync(path.join(tmpdir(), 'latido-guide-businesses-'))
const provider = (id, name, services, extra = {}) => ({
  id, name, services, active:true, category:'asesoria_tramites', city:'Zürich', canton:'ZH',
  promotion_plan:'free', featured:false, created_at:'2026-01-01', ...extra,
})
const promoted = plan => ({promotion_plan:plan, promotion_starts_at:'2020-01-01', promotion_ends_at:'2100-01-01'})
const providers = [
  provider('rav', 'RAV (Oficina de empleo)', null, {category:'empleo', description:'Servicio público suizo de empleo.'}),
  provider('ayuda', 'Tu Ayuda en Suiza', null, {description:'Gestiones relacionadas con RAV y desempleo. Trámites administrativos.'}),
  provider('syna', 'SYNA', ['Sindicato'], {category:'otro'}),
  provider('legal', 'Asesoría jurídica', ['Asesoría legal']),
  provider('exclusive', 'Orientación exclusiva', ['Asesoría laboral'], promoted('exclusive')),
  provider('premium', 'Orientación premium', ['Asesoría laboral'], promoted('premium')),
  provider('basic', 'Orientación básica', ['Asesoría laboral'], promoted('basic')),
  provider('featured', 'Orientación destacada', ['Asesoría laboral'], {featured:true}),
  provider('hairdresser', 'Peluquería de prueba', ['Corte de cabello'], {...promoted('exclusive'), category:'belleza', description:'Atención en alemán y español.'}),
  provider('language', 'Escuela de alemán', ['Clases de alemán'], {category:'otro'}),
  provider('rental', 'Alquiler de coches', ['Alquiler de coches'], {category:'vehiculos'}),
  provider('0e1e602e-dda4-4e78-aa67-5027cf43620b', '360 Virtus GmbH', ['Gestoría', 'Trámites y papeleo'], {photo_url:'/partners/virtus360/logo.svg'}),
]
const browser = await chromium.launch({executablePath:process.env.LATIDO_TEST_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true})

async function setup(viewport, failProviders = false) {
  const context = await browser.newContext({viewport})
  const errors = []
  let directoryRequests = 0
  let failing = failProviders
  await context.addInitScript(() => localStorage.setItem('latido_cookie_consent', JSON.stringify({
    policyVersion:'2026-08-08', expiresAt:new Date(Date.now() + 86400000).toISOString(),
    categories:{necessary:true, analytics:false, externalMedia:false},
  })))
  await context.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.protocol === 'blob:') return route.continue()
    if (url.pathname.endsWith('/providers')) {
      directoryRequests++
      return route.fulfill({status:failing ? 503 : 200, contentType:'application/json', body:JSON.stringify(failing ? {message:'Directory unavailable'} : providers)})
    }
    return route.fulfill({contentType:'application/json', body:'[]'})
  })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  return {page, context, errors, requestCount:() => directoryRequests, recover:() => { failing = false }}
}

try {
  for (const viewport of [{width:390, height:844}, {width:1280, height:900}]) {
    const test = await setup(viewport)
    const { page } = test
    await page.goto(`${baseUrl}/paquetes/sin-trabajo`)
    const steps = page.locator('.rp-step')
    const unemployment = steps.nth(0).locator('.latido-guide-businesses')
    await unemployment.getByRole('button', {name:/RAV \(Oficina de empleo\)/}).waitFor()
    await unemployment.getByRole('button', {name:/Tu Ayuda en Suiza/}).waitFor()
    await unemployment.getByRole('button', {name:/SYNA/}).waitFor()
    assert.equal(test.requestCount(), 1, 'All steps share one directory request')
    assert.deepEqual((await unemployment.locator('.latido-guide-businesses-rail > button > div:last-child > p:first-child').allTextContents()).slice(0, 4), [
      'Orientación exclusiva', 'Orientación premium', 'Orientación básica', 'Orientación destacada',
    ])
    assert.equal(await page.getByRole('button', {name:/Peluquería de prueba/}).count(), 0)
    await steps.nth(1).getByRole('button', {name:/Asesoría jurídica/}).waitFor()
    await steps.nth(4).getByRole('button', {name:/Tu Ayuda en Suiza/}).waitFor()
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'The package must fit the viewport')
    assert.ok(await page.evaluate(() => {
      const bounds = document.querySelector('.rp-page').getBoundingClientRect()
      return [...document.querySelectorAll('.rp-step__card')].every(card => {
        const rect = card.getBoundingClientRect()
        return rect.left >= bounds.left && rect.right <= bounds.right
      })
    }), 'Step cards must fit inside the package, with horizontally scrolling recommendations')
    assert.ok(await unemployment.locator('h4').evaluate(element => parseFloat(getComputedStyle(element).fontSize)) <= 14)
    const toggle = steps.nth(0).getByRole('button', {name:/Marcar.*como hecho/})
    await toggle.click()
    await steps.nth(0).getByRole('button', {name:/Marcar.*como pendiente/}).waitFor()
    await page.getByRole('heading', {name:'Sin trabajo', exact:true}).scrollIntoViewIfNeeded()
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({path:path.join(outputDir, `unemployment-${viewport.width}.png`), fullPage:true, animations:'disabled'})
    await page.getByRole('link', {name:'Ver todos', exact:true}).click()
    await page.waitForURL(`${baseUrl}/paquetes`)
    await page.getByRole('heading', {name:'📦 Paquetes'}).waitFor()
    await page.goto(`${baseUrl}${getGuidePath(getGuideById('d6'))}`)
    const languageRail = page.getByRole('region', {name:'Negocios relacionados'})
    await languageRail.getByRole('button', {name:/Escuela de alemán/}).waitFor()
    assert.equal(await languageRail.getByRole('button').count(), 1)
    await page.goto(`${baseUrl}/paquetes/acabo-de-llegar`)
    const paperwork = page.locator('.rp-step').nth(3).locator('.latido-guide-businesses')
    const virtusCard = paperwork.getByRole('button',{name:/360 Virtus GmbH/})
    await virtusCard.waitFor()
    assert.match(await virtusCard.innerText(), /Premium/)
    assert.equal(await paperwork.locator('.latido-guide-businesses-rail > button > div:last-child > p:first-child').first().textContent(),'360 Virtus GmbH')
    assert.doesNotMatch(await virtusCard.innerText(), /gestoría · gestoria/i)
    await paperwork.screenshot({path:path.join(outputDir,`virtus-paperwork-${viewport.width}.png`),animations:'disabled'})
    assert.deepEqual(test.errors, [])
    await test.context.close()
  }
  const retryTest = await setup({width:390, height:844}, true)
  await retryTest.page.goto(`${baseUrl}${getGuidePath(getGuideById('d15'))}`)
  await retryTest.page.getByRole('button', {name:'Reintentar'}).waitFor()
  const failedRequests = retryTest.requestCount()
  retryTest.recover()
  await retryTest.page.getByRole('button', {name:'Reintentar'}).click()
  await retryTest.page.getByRole('button', {name:/RAV \(Oficina de empleo\)/}).waitFor()
  assert.equal(retryTest.requestCount(), failedRequests + 1)
  assert.deepEqual(retryTest.errors, [])
  await retryTest.context.close()
  console.log(`Package navigation, per-step relevance, editorial Premium priority, promotion order, shared requests, retry, progress and responsive layout passed. Screenshots: ${outputDir}`)
} finally {
  await browser.close()
}
