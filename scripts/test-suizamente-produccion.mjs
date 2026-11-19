import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { preview } from 'vite'
import { chromium, expect } from '@playwright/test'

// Exercise the built app against the deployed Edge Function. Only GETs are
// allowed through: this smoke test never creates fictitious community votes.
const server = await preview({ preview:{ host:'127.0.0.1', port:5266, strictPort:true } })
const browser = await chromium.launch({ headless:true })
const context = await browser.newContext({ viewport:{ width:375, height:667 }, reducedMotion:'reduce' })
const origin = 'http://127.0.0.1:5266'
const errors = [], responses = [], forbidden = []
await mkdir('output/suizamente-referencia', { recursive:true })
try {
  await context.route('**/*', route => {
    const req = route.request(), url = new URL(req.url())
    if (url.origin === origin) {
      if (url.pathname.startsWith('/api/suizamente')) forbidden.push(url.pathname)
      return route.continue()
    }
    if (url.pathname.startsWith('/functions/v1/suizamente-votos/')) {
      assert.ok(['GET','OPTIONS'].includes(req.method()), 'Live test must not write votes')
      return route.continue()
    }
    return route.fulfill({ json:[] })
  })
  const page = await context.newPage()
  page.on('pageerror', e => errors.push(e.message))
  page.on('response', response => {
    if (response.url().includes('/functions/v1/suizamente-votos/')) responses.push({ url:response.url(), status:response.status() })
  })
  await page.goto(origin + '/suizamente')
  const game = page.frameLocator('iframe[title="Suizamente, un juego de Latido"]')
  await expect(game.locator('.title')).toHaveText('Suizamente')
  await expect(game.locator('#nota')).toHaveText('Tus votos cuentan para los porcentajes de la comunidad.', { timeout:20000 })
  for (const mode of ['dilemas','preguntas','mix']) {
    await game.locator(`[data-modo="${mode}"]`).click()
    await expect(game.locator('.q')).toBeVisible()
    await expect(game.locator('.prog')).toHaveAttribute('aria-label','Pregunta 1 de 10')
    await game.locator('#salir').click()
  }
  await page.screenshot({ path:'output/suizamente-referencia/produccion-conexion-real.png', fullPage:true })
  assert.ok(responses.some(r => r.url.includes('/votos/resumen') && r.status === 200))
  assert.ok(responses.some(r => r.url.endsWith('/votos/mios') && r.status === 200))
  assert.ok(responses.every(r => r.status === 200))
  assert.deepEqual(forbidden, [])
  assert.deepEqual(errors, [])
  console.log('PASS: production build + deployed Supabase API; real CORS, 200 summaries and own votes, three modes, zero fictitious votes, no Vercel server secrets.')
} finally {
  await context.close()
  await browser.close()
  await new Promise(resolve => server.httpServer.close(resolve))
}
