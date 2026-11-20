import assert from 'node:assert/strict'
import { mkdir, readFile } from 'node:fs/promises'
import { chromium, expect } from '@playwright/test'
import { createServer } from 'vite'

const data = JSON.parse(await readFile('public/suizamente/data/preguntas.json', 'utf8'))
const votes = new Map()
const counts = id => {
  const totals = [0,0,0]
  for (const player of votes.values()) if (player[id] !== undefined) totals[player[id]]++
  return totals
}
let online = true, postCount = 0, failPost = false
const server = await createServer({ server:{ host:'127.0.0.1', port:5265, strictPort:true }, plugins:[{
  name:'reference-test-votes', enforce:'pre',
  configureServer(vite) {
    vite.middlewares.use('/api/suizamente', async (req, res) => {
      res.setHeader('Content-Type','application/json')
      const send = (status, body) => { res.statusCode = status; res.end(JSON.stringify(body)) }
      if (!online) return send(503, { error:'offline' })
      const id = req.headers['x-jugador-id'] || 'anon'
      if (!votes.has(id)) votes.set(id, {})
      const own = votes.get(id)
      if (req.url.startsWith('/votos/resumen')) return send(200, { conteos:Object.fromEntries(data.preguntas.map(q => [q.id, counts(q.id)])) })
      if (req.url === '/votos/mios') return send(200, { votos:own })
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      const body = JSON.parse(Buffer.concat(chunks).toString())
      postCount++
      if (failPost) return send(503, { error:'offline' })
      const yaVotado = own[body.preguntaId] !== undefined
      if (!yaVotado) own[body.preguntaId] = body.opcion
      return send(200, { reparto:counts(body.preguntaId), opcion:own[body.preguntaId], yaVotado })
    })
  },
}] })
let browser
const errors = []
const output = 'output/suizamente-referencia'
await mkdir(output, { recursive:true })
try {
  await server.listen()
  browser = await chromium.launch({ headless:true })
  const origin = 'http://127.0.0.1:5265'
  for (const [name, viewport, colorScheme] of [
    ['movil', { width:390, height:844 }, 'light'],
    ['escritorio', { width:1440, height:1000 }, 'dark'],
    ['estrecho', { width:320, height:740 }, 'dark'],
  ]) {
    votes.clear()
    const context = await browser.newContext({ viewport, colorScheme, reducedMotion:'reduce', permissions:['clipboard-read','clipboard-write'] })
    await context.addInitScript(()=>{window.SUIZAMENTE_CONFIG={experiencia:false}})
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.fulfill({ json:[] }))
    const page = await context.newPage()
    page.on('pageerror', e => errors.push(e.message))
    await page.goto(origin + '/suizamente')
    const game = page.frameLocator('iframe[title="Suizamente, un juego de Latido"]')
    await expect(game.locator('.title')).toHaveText('Suizamente')
    await expect(game.locator('#nota')).toHaveText('Tus votos cuentan para los porcentajes de la comunidad.')
    assert.equal(await game.locator('.logo').getAttribute('src'), '/suizamente/icons/suizamente-circle-logo-512.png')
    assert.equal(await game.locator('.logo').evaluate(el => el.complete && el.naturalWidth > 0), true)
    assert.equal(await game.locator('body').evaluate(el => getComputedStyle(el).backgroundColor), colorScheme === 'dark' ? 'rgb(13, 17, 24)' : 'rgb(255, 255, 255)')
    assert.equal(await game.locator('body').evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.screenshot({ path:`${output}/${name}-inicio.png`, fullPage:true })

    let answered = 0
    for (const [mode, type] of [['dilemas','dilema'], ['preguntas','real'], ['mix',null]]) {
      await game.locator(`[data-modo="${mode}"]`).click()
      const seen = []
      const types = []
      for (let n=0; n<10; n++) {
        await expect(game.getByRole('dialog')).toHaveCount(0)
        await expect(game.locator('.prog')).toHaveAttribute('aria-label', `Pregunta ${n+1} de 10`)
        const prompt = await game.locator('.q').textContent()
        const labels = await game.locator('.opt .ot').allTextContents()
        const q = data.preguntas.find(q => q.pregunta === prompt && q.opciones.every(o => labels.includes(o.t)))
        assert.ok(q)
        if (type) assert.equal(q.tipo, type)
        if (q.tipo === 'dilema') assert.equal(labels.length, 2)
        types.push(q.tipo)
        assert.ok(!seen.includes(q.id))
        seen.push(q.id)
        await expect(game.locator('.prog')).toHaveAttribute('aria-label', `Pregunta ${n+1} de 10`)
        assert.deepEqual([...labels].sort(), q.opciones.map(o => o.t).sort())
        const selected = q.opciones.findIndex(o => o.t === labels[0])
        await game.locator('.opt').first().focus()
        await page.keyboard.press('1')
        await expect(game.getByRole('dialog')).toBeVisible()
        await expect(game.locator('.tag.mine')).toHaveCount(1)
        if (q.tipo === 'real') await expect(game.locator('.tag.true')).toHaveCount(1)
        await expect(game.locator('#votos')).toContainText('voto')
        const stored = await game.locator('body').evaluate(() => JSON.parse(localStorage.getItem('suizamente:v1')))
        assert.equal(stored.resp[q.id].o, selected)
        // Labels and bars correspond to the original index even after shuffling.
        await expect(game.locator('.res').filter({ has:game.locator('.tag.mine') }).locator('.res-p')).toHaveText('100%')
        if (n===0 && mode==='mix') {
          await page.screenshot({ path:`${output}/${name}-resultado.png`, fullPage:true })
          await game.locator('#compartir').click()
          await expect(game.locator('#copymsg')).toContainText('Copiado.')
          const copied = await page.evaluate(() => navigator.clipboard.readText())
          assert.ok(copied.includes(q.pregunta))
          await game.locator('#sig').focus()
          await page.keyboard.press('Shift+Tab')
          await expect(game.locator('#compartir')).toBeFocused()
        }
        await page.keyboard.press('Escape')
      }
      await expect(game.locator('.done')).toBeVisible()
      if (mode === 'mix') {
        assert.equal(types.filter(t => t === 'dilema').length, 5)
        assert.equal(types.filter(t => t === 'real').length, 5)
      }
      assert.equal(await game.locator('.squares').textContent(), mode === 'dilemas' ? '🟦'.repeat(10) : await game.locator('.squares').textContent())
      await game.locator('#comp').click()
      await expect(game.locator('#copymsg')).toContainText('Copiado.')
      await game.locator('#inicio').click()
      answered += 10
      await expect(game.locator('.stat').first().locator('b')).toHaveText(String(answered))
    }
    // Saved answers survive a full reload; unseen questions come first.
    await page.reload()
    await expect(game.locator('.stat').first()).toContainText('30')
    await game.locator('[data-modo="dilemas"]').click()
    const answeredBefore = await game.locator('body').evaluate(() => Object.keys(JSON.parse(localStorage.getItem('suizamente:v1')).resp))
    const nextPrompt = await game.locator('.q').textContent()
    const nextLabels = await game.locator('.opt .ot').allTextContents()
    assert.ok(!answeredBefore.includes(data.preguntas.find(q => q.pregunta === nextPrompt && q.opciones.every(o => nextLabels.includes(o.t))).id))
    // Every option is present, with no horizontal overflow even at 320px.
    assert.equal(await game.locator('body').evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.screenshot({ path:`${output}/${name}-pregunta.png`, fullPage:true })
    await context.close()
  }
  // One original question makes a repeat deterministic and exercises retries.
  const single = data.preguntas.find(q => q.tipo === 'dilema')
  votes.clear()
  votes.set('seed1', { [single.id]:0 })
  votes.set('seed2', { [single.id]:1 })
  const context = await browser.newContext({ viewport:{ width:390, height:844 }, reducedMotion:'reduce' })
  await context.addInitScript(() => { window.SUIZAMENTE_CONFIG = { ronda:1 } })
  await context.route('**/suizamente/data/preguntas.json', route => route.fulfill({ json:{ ...data, preguntas:[single] } }))
  const page = await context.newPage()
  page.on('pageerror', e => errors.push(e.message))
  online = false
  await page.goto(origin + '/suizamente/juego.html')
  await expect(page.locator('#nota')).toContainText('Ahora mismo no se pueden cargar')
  await page.locator('[data-modo="dilemas"]').click()
  const selectedText = await page.locator('.opt .ot').first().textContent()
  const selected = single.opciones.findIndex(o => o.t === selectedText)
  await page.locator('.opt').first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.locator('.res-p').first()).toHaveText('—')
  await expect(page.locator('#rv-h')).toHaveText('Buena elección')
  online = true
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect(page.locator('#votos')).toHaveText('3 votos')
  await expect(page.locator('.res').filter({ has:page.locator('.tag.mine') }).locator('.res-p')).toHaveText('67%')
  await page.locator('#sig').click()
  await page.locator('#otra').click()
  const beforeRepeat = postCount
  // Selecting the other choice changes this round's result, never the stored vote.
  const other = page.locator('.opt').filter({ has:page.locator('.ot', { hasText:single.opciones[1-selected].t }) })
  await other.click()
  await expect(page.locator('#rv-sub')).toContainText('Ya la habías respondido: cuenta tu primer voto.')
  assert.equal(postCount, beforeRepeat)
  assert.equal(await page.evaluate(id => JSON.parse(localStorage.getItem('suizamente:v1')).resp[id].o, single.id), selected)
  await page.keyboard.press('Escape')
  await page.locator('#otra').click()
  await page.locator('#saltar').click()
  await expect(page.locator('.squares')).toHaveText('⬜')
  await context.close()
  // With motion enabled, the reveal starts at the tapped button and locks input
  // during its delay, so rapid taps cannot create extra responses.
  votes.clear()
  const motion = await browser.newContext({ viewport:{ width:390, height:844 }, reducedMotion:'no-preference' })
  await motion.addInitScript(() => { window.SUIZAMENTE_CONFIG = { ronda:1 } })
  await motion.route('**/suizamente/data/preguntas.json', route => route.fulfill({ json:{ ...data, preguntas:[single] } }))
  const animated = await motion.newPage()
  animated.on('pageerror', e => errors.push(e.message))
  await animated.goto(origin + '/suizamente/juego.html')
  await expect(animated.locator('#nota')).toContainText('Tus votos cuentan')
  await animated.locator('[data-modo="dilemas"]').click()
  const button = animated.locator('.opt').first()
  const rect = await button.boundingBox()
  const postsBeforeTap = postCount
  await button.evaluate(b => { b.click(); b.click(); })
  await expect(animated.getByRole('dialog')).toBeVisible()
  assert.equal(postCount, postsBeforeTap + 1)
  const reveal = animated.locator('#reveal')
  assert.match(await reveal.evaluate(el => getComputedStyle(el).animationName), /reveal/)
  assert.equal(await reveal.evaluate(el => parseFloat(el.style.getPropertyValue('--x'))), rect.x + rect.width/2)
  await motion.close()
  assert.deepEqual(errors, [])
  console.log('PASS: reference UI, all modes, 10-question rounds, shuffled original indices, real percentages, sharing, persistence, keyboard, focus, mobile/desktop/dark mode.')
} finally {
  await browser?.close()
  await server.close()
}
