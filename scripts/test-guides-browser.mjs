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
  provider('housing', 'Apoyo con tu alquiler', ['Contratos de alquiler']),
]
const ad = (id,title,extra={}) => ({id,title,cat:'vivienda',type:'ofrece',active:true,privacy:'public',city:'Zürich',canton:'ZH',created_at:'2026-10-01',...extra})
const listings = [
  ad('flat','Piso de 2,5 habitaciones',{price_amount:1800,price_unit:'mes'}),
  ad('room','Habitación amueblada',{price_amount:850,price_unit:'mes'}),
  ad('closed-flat','Piso alquilado',{lifecycle_status:'resolved'}),
  ad('private-flat','Piso privado',{privacy:'private'}),
  ad('seeking-flat','Busco piso',{type:'busca'}),
  ad('other-flat','Piso de Ginebra',{city:'Genève',canton:'GE'}),
  ad('legacy-job','Se necesita camarero',{cat:'empleo',price_amount:25,price_unit:'hora'}),
  ad('cv','Ayuda con tu CV',{cat:'documentos'}),
  ad('translation','Traducciones certificadas',{cat:'documentos'}),
  ad('language-ad','Clases de alemán con profesora',{cat:'servicios'}),
  ad('legal-ad','Asesoría laboral en español',{cat:'servicios'}),
]
const jobs = [
  {id:'cook',title:'Cocinero · jornada completa',company:'Restaurante',city:'Zürich',canton:'ZH',active:true,job_intent:'ofrece',salary_amount:4800,salary_unit:'mes',created_at:'2026-10-02'},
  {id:'applicant',title:'Busco trabajo en cocina',city:'Zürich',canton:'ZH',active:true,job_intent:'busca'},
  {id:'expired',title:'Oferta caducada',city:'Zürich',canton:'ZH',active:true,job_intent:'ofrece',expires_at:'2020-01-01'},
]
const pickFilter = (scope,label) => scope.locator('.related-resources__filters').getByRole('button',{name:new RegExp(label)})
const resourceCards = (scope,type) => scope.locator(`[data-resource-type="${type}"] > button`)
const browser = await chromium.launch({executablePath:process.env.LATIDO_TEST_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true})

async function setup(viewport, failProviders = false, failSource='') {
  const context = await browser.newContext({viewport})
  const errors = []
  let directoryRequests = 0
  const sourceRequests = {}
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
    const source = ['listings','jobs'].find(name=>url.pathname.endsWith(`/${name}`))
    if (source) {
      sourceRequests[source] = (sourceRequests[source] || 0)+1
      return route.fulfill({status:source === failSource ? 503 : 200,contentType:'application/json',body:JSON.stringify(source === failSource ? {message:'Source unavailable'} : source === 'jobs' ? jobs : listings)})
    }
    return route.fulfill({contentType:'application/json', body:'[]'})
  })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  return {page, context, errors, sourceRequests, requestCount:() => directoryRequests, recover:() => { failing = false }}
}

try {
  for (const viewport of [{width:320,height:740},{width:390, height:844}, {width:1280, height:900}]) {
    const test = await setup(viewport)
    const { page } = test
    await page.goto(`${baseUrl}/paquetes/sin-trabajo`)
    const steps = page.locator('.rp-step')
    const unemployment = steps.nth(0).locator('.related-resources')
    await unemployment.getByRole('button', {name:/RAV \(Oficina de empleo\)/}).waitFor()
    await unemployment.getByRole('button', {name:/Tu Ayuda en Suiza/}).waitFor()
    await unemployment.getByRole('button', {name:/SYNA/}).waitFor()
    assert.equal(test.requestCount(), 1, 'All steps share one directory request')
    assert.deepEqual((await resourceCards(unemployment,'business').locator('div:last-child > p:first-child').allTextContents()).slice(0, 4), [
      'Orientación exclusiva', 'Orientación premium', 'Orientación básica', 'Orientación destacada',
    ])
    assert.equal(await page.getByRole('button', {name:/Peluquería de prueba/}).count(), 0)
    await steps.nth(1).getByRole('button', {name:/Asesoría jurídica/}).waitFor()
    await steps.nth(4).getByRole('button', {name:/Tu Ayuda en Suiza/}).waitFor()
    await unemployment.getByRole('button',{name:/Cocinero/}).waitFor()
    assert.equal(test.sourceRequests.listings,1,'All steps share public listings')
    assert.equal(test.sourceRequests.jobs,1,'All employment steps share jobs')
    const originalBusinessCount = await resourceCards(unemployment,'business').count()
    const originalAdCount = await resourceCards(unemployment,'ad').count()
    await pickFilter(unemployment,'Anuncios').click()
    assert.equal(await resourceCards(unemployment,'business').count(),0)
    assert.equal(await resourceCards(unemployment,'ad').count(),originalAdCount)
    assert.equal(await unemployment.getByRole('button',{name:/Busco trabajo|Oferta caducada/}).count(),0)
    assert.match(await unemployment.getByRole('button',{name:/Cocinero/}).innerText(),/CHF 4.?800\/mes/)
    await pickFilter(unemployment,'Negocios').focus()
    await page.keyboard.press('Enter')
    assert.equal(await resourceCards(unemployment,'ad').count(),0)
    assert.equal(await resourceCards(unemployment,'business').count(),originalBusinessCount)
    assert.equal(await pickFilter(unemployment,'Negocios').getAttribute('aria-pressed'),'true')
    // The business card keeps its existing 156px width and 112px image area.
    assert.equal(await resourceCards(unemployment,'business').first().evaluate(element=>element.getBoundingClientRect().width),156)
    assert.equal(await resourceCards(unemployment,'business').first().locator('div').first().evaluate(element=>element.getBoundingClientRect().height),112)
    await pickFilter(unemployment,'Todo').click()
    assert.equal(await resourceCards(unemployment,'business').count(),originalBusinessCount)
    assert.equal(await resourceCards(unemployment,'ad').count(),originalAdCount)
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
    const languageRail = page.getByRole('region', {name:'Recursos recomendados'})
    await languageRail.getByRole('button', {name:/Escuela de alemán/}).waitFor()
    await languageRail.getByRole('button',{name:/Clases de alemán con profesora/}).waitFor()
    await pickFilter(languageRail,'Negocios').click()
    assert.equal(await resourceCards(languageRail,'business').count(),1)
    assert.equal(await resourceCards(languageRail,'ad').count(),0)
    await page.goto(`${baseUrl}/paquetes/acabo-de-llegar`)
    const paperwork = page.locator('.rp-step').nth(3).locator('.related-resources')
    const virtusCard = paperwork.getByRole('button',{name:/360 Virtus GmbH/})
    await virtusCard.waitFor()
    assert.match(await virtusCard.innerText(), /Premium/)
    assert.equal(await resourceCards(paperwork,'business').locator('div:last-child > p:first-child').first().textContent(),'360 Virtus GmbH')
    assert.doesNotMatch(await virtusCard.innerText(), /gestoría · gestoria/i)
    await paperwork.screenshot({path:path.join(outputDir,`virtus-paperwork-${viewport.width}.png`),animations:'disabled',style:'.rp-compactbar,.bottom-nav { visibility:hidden !important; }'})
    await page.goto(`${baseUrl}/paquetes/busco-piso?canton=ZH`)
    const housing = page.locator('.rp-step').nth(0).locator('.related-resources')
    await housing.getByRole('button',{name:/Habitación amueblada/}).waitFor()
    await housing.getByRole('button',{name:/Apoyo con tu alquiler/}).waitFor()
    await pickFilter(housing,'Anuncios').click()
    assert.equal(await resourceCards(housing,'ad').count(),2)
    assert.equal(await housing.getByRole('button',{name:/Piso privado|Piso alquilado|Busco piso|Piso de Ginebra/}).count(),0)
    assert.equal(await housing.getByRole('link',{name:'Explorar más'}).getAttribute('href'),'/tablon?cat=vivienda&type=ofrece&canton=ZH')
    await housing.screenshot({path:path.join(outputDir,`housing-${viewport.width}.png`),animations:'disabled',style:'.rp-compactbar,.bottom-nav { visibility:hidden !important; }'})
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth))
    assert.ok(await housing.locator('.related-resources__filters').evaluate(element=>element.scrollWidth<=element.clientWidth),'Filter pills must fit even on a 320px mobile screen')
    await housing.getByRole('button',{name:/Piso de 2,5 habitaciones/}).click()
    await page.waitForURL(/\/anuncios\/flat--/)
    await page.getByRole('heading',{level:1,name:'Piso de 2,5 habitaciones',exact:true}).waitFor()
    await page.goto(`${baseUrl}/paquetes/busco-piso?canton=ZH`)
    await page.locator('.rp-step').nth(0).getByRole('link',{name:'Leer la guía',exact:true}).click()
    await page.waitForURL(/canton=ZH/)
    assert.match(await page.locator('.gj-next__step').getAttribute('href'),/canton=ZH/)
    await page.goto(`${baseUrl}/paquetes/busco-piso?canton=TI`)
    const emptyHousing = page.locator('.rp-step').nth(0).locator('.related-resources')
    await pickFilter(emptyHousing,'Anuncios').click()
    await emptyHousing.getByText('Aún no hay recursos para mostrar').waitFor()
    await pickFilter(emptyHousing,'Negocios').click()
    await emptyHousing.getByRole('button',{name:/Apoyo con tu alquiler/}).waitFor()
    assert.deepEqual(test.errors, [])
    await test.context.close()
  }
  const retryTest = await setup({width:390, height:844}, true)
  await retryTest.page.goto(`${baseUrl}${getGuidePath(getGuideById('d15'))}`)
  await pickFilter(retryTest.page.locator('.related-resources'),'Negocios').click()
  await retryTest.page.getByRole('button', {name:'Reintentar'}).waitFor()
  const failedRequests = retryTest.requestCount()
  retryTest.recover()
  await retryTest.page.getByRole('button', {name:'Reintentar'}).click()
  await retryTest.page.getByRole('button', {name:/RAV \(Oficina de empleo\)/}).waitFor()
  assert.equal(retryTest.requestCount(), failedRequests + 1)
  assert.deepEqual(retryTest.errors, [])
  await retryTest.context.close()
  const partialTest = await setup({width:390,height:844},false,'jobs')
  await partialTest.page.goto(`${baseUrl}/paquetes/busco-trabajo`)
  const offers = partialTest.page.locator('.rp-step').nth(0).locator('.related-resources')
  await offers.getByRole('button',{name:/Se necesita camarero/}).waitFor()
  await offers.getByText('Algunos recursos no se han podido cargar.').waitFor()
  await pickFilter(offers,'Anuncios').click()
  assert.ok(await resourceCards(offers,'ad').count()>0,'Legacy ads remain visible when jobs fail')
  await pickFilter(offers,'Negocios').click()
  await offers.getByRole('button',{name:/RAV \(Oficina de empleo\)/}).waitFor()
  assert.deepEqual(partialTest.errors,[])
  await partialTest.context.close()
  console.log(`All/ads/business filters, housing and jobs, unchanged card design, relevance, paid priority, shared requests, keyboard, empty/error states, canton navigation and mobile/desktop layout passed. Screenshots: ${outputDir}`)
} finally {
  await browser.close()
}
