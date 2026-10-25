import assert from 'node:assert/strict'
import { readFile, access } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import { build } from 'esbuild'
import { chromium, webkit, expect } from '@playwright/test'

// Exercise the actual hook and blue banner in isolation; never contact the live backend.
const app = await readFile('src/App.jsx', 'utf8')
const banner = app.slice(app.indexOf('function PWAInstallBanner('), app.indexOf('function PushRegistrationSync('))
assert.ok(banner.includes('Instala Latido'))
const bundle = await build({ stdin: { contents: `
  import { useEffect, useLayoutEffect, useRef, useState } from 'react'
  import { createRoot } from 'react-dom/client'
  import { usePWA } from './hooks/usePWA.js'
  const useAuth = () => ({ isLoggedIn: true })
  const useNavigate = () => () => {}
  const C = { primary: '#2563eb', primaryDark: '#1d4ed8' }, PP = 'Arial'
  const INSTALL_BANNER_LIFT_VAR = '--latido-install-banner-lift'
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent)
  ${banner}
  function Harness() {
    const state = usePWA()
    return <><PWAInstallBanner {...state} /><output id="state">{JSON.stringify(state)}</output></>
  }
  createRoot(document.getElementById('root')).render(<Harness />)
`, loader: 'jsx', resolveDir: path.resolve('src') }, bundle: true, write: false, platform: 'browser', format: 'esm', jsx: 'automatic' })
const manifest = JSON.parse(await readFile('public/manifest.json', 'utf8'))
assert.equal(manifest.id, manifest.start_url, 'Preserve the existing computed app identity')
assert.ok(manifest.related_applications.some(app => app.platform === 'webapp' && app.url === '/manifest.json' && app.id === 'https://www.latido.ch/?pwa=1'))
const server = createServer((request, response) => {
  if (request.url === '/app.js') {
    response.setHeader('Content-Type', 'text/javascript')
    response.end(bundle.outputFiles[0].text)
  } else {
    response.setHeader('Content-Type', 'text/html')
    response.end('<!doctype html><html><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>')
  }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`
const scenarios = []
async function run(browser, name) {
  const contexts = []
  const errors = []
  const open = async (options = {}, suffix = '/') => {
    const context = await browser.newContext(options.ios ? { userAgent: 'Mozilla/5.0 (iPhone) AppleWebKit Safari/604.1' } : {})
    contexts.push(context)
    await context.addInitScript(options => {
      window.__mode = options.mode || 'browser'
      const nativeMatchMedia = window.matchMedia.bind(window)
      const queries = []
      window.matchMedia = query => {
        if (!query.startsWith('(display-mode:')) return nativeMatchMedia(query)
        const result = new EventTarget()
        Object.defineProperty(result, 'matches', { get: () => query === `(display-mode: ${window.__mode})` })
        result.addListener = callback => result.addEventListener('change', callback)
        queries.push(result)
        return result
      }
      window.__setMode = mode => { window.__mode = mode; queries.forEach(query => query.dispatchEvent(new Event('change'))) }
      if (options.iosStandalone) Object.defineProperty(navigator, 'standalone', { value: true })
      Object.defineProperty(navigator, 'getInstalledRelatedApps', { configurable: true, value: !options.api ? undefined : async () => {
        if (options.apiDelay) await new Promise(resolve => setTimeout(resolve, options.apiDelay))
        if (options.api === 'error') throw new Error('Unavailable')
        if (options.api === 'pending') return new Promise(() => {})
        if (options.api === 'self') return [{ platform: 'webapp', url: new URL('/manifest.json', location.href).href }]
        if (options.api === 'other') return [{ platform: 'webapp', url: 'https://other.example/manifest.json' }]
        return []
      } })
      if (options.remembered) localStorage.setItem('latido_pwa_installed', '1')
      if (options.blockStorage) Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError') } })
    }, options)
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(origin + suffix)
    await page.locator('#state').waitFor()
    return { page, context }
  }
  const state = page => page.locator('#state').evaluate(element => JSON.parse(element.textContent))
  const emitPrompt = (page, outcome = 'dismissed') => page.evaluate(outcome => {
    const event = new Event('beforeinstallprompt', { cancelable: true })
    event.prompt = async () => {}
    event.userChoice = Promise.resolve({ outcome })
    window.dispatchEvent(event)
  }, outcome)
  const hidden = page => expect(page.getByText('Instala Latido en tu móvil', { exact: true })).toHaveCount(0)
  const visible = page => expect(page.getByText('Instala Latido en tu móvil', { exact: true })).toBeVisible()
  try {
    const fresh = await open()
    await emitPrompt(fresh.page)
    await visible(fresh.page)
    await fresh.page.evaluate(() => window.dispatchEvent(new Event('appinstalled')))
    await hidden(fresh.page)
    assert.equal((await state(fresh.page)).isPWA, false, 'Installing in a tab does not change its display mode')
    await fresh.page.reload()
    await emitPrompt(fresh.page)
    await hidden(fresh.page)
    assert.equal((await state(fresh.page)).isInstalled, true)

    for (const mode of ['standalone', 'minimal-ui', 'window-controls-overlay']) {
      const { page } = await open({ mode })
      await emitPrompt(page)
      await hidden(page)
      assert.equal((await state(page)).isInstalled, true)
      await page.evaluate(() => window.__setMode('browser'))
      await hidden(page)
      assert.equal((await state(page)).isPWA, false)
    }
    for (const options of [{ ios: true, iosStandalone: true }, { remembered: true }]) {
      const { page } = await open(options)
      await emitPrompt(page)
      await hidden(page)
    }
    const shortcut = await open({}, '/?pwa=1')
    await hidden(shortcut.page)
    await shortcut.page.goto(origin + '/')
    await emitPrompt(shortcut.page)
    await hidden(shortcut.page)
    assert.equal((await state(shortcut.page)).isInstalled, true)

    const related = await open({ api: 'self', apiDelay: 300, ios: true })
    await emitPrompt(related.page)
    await hidden(related.page)
    await expect.poll(async () => (await state(related.page)).isInstalled).toBe(true)
    await hidden(related.page)
    for (const api of ['other', 'error', 'pending']) {
      const { page } = await open({ api })
      await emitPrompt(page)
      await visible(page)
      assert.equal((await state(page)).isInstalled, false)
    }
    for (const outcome of ['accepted', 'dismissed']) {
      const { page } = await open()
      await emitPrompt(page, outcome)
      await visible(page)
      await page.getByRole('button', { name: 'Instalar', exact: true }).click()
      await hidden(page)
      assert.equal((await state(page)).isInstalled, outcome === 'accepted')
    }
    const blocked = await open({ blockStorage: true })
    await emitPrompt(blocked.page)
    await visible(blocked.page)
    await blocked.page.evaluate(() => window.dispatchEvent(new Event('appinstalled')))
    await hidden(blocked.page)

    const tabs = await open()
    await emitPrompt(tabs.page)
    await visible(tabs.page)
    const otherTab = await tabs.context.newPage()
    await otherTab.goto(origin + '/')
    await otherTab.locator('#state').waitFor()
    await otherTab.evaluate(() => window.dispatchEvent(new Event('appinstalled')))
    await hidden(tabs.page)
    assert.deepEqual(errors, [])
    console.log(`${name}: actual blue banner, installation persistence, app/shortcut launches, iOS, related-app checks, API failures/timeouts, prompt outcomes, storage denial and cross-tab sync passed`)
    scenarios.push(name)
  } finally { await Promise.all(contexts.map(context => context.close())) }
}
try {
  const brave = 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe'
  for (const [name, engine, options] of [['Chromium', chromium, {}], ['WebKit', webkit, {}],
    ...await access(brave).then(() => [['Brave', chromium, { executablePath: brave }]]).catch(() => [])]) {
    const browser = await engine.launch({ headless: true, ...options })
    try { await run(browser, name) } finally { await browser.close() }
  }
  assert.ok(scenarios.length >= 2)
} finally { await new Promise(resolve => server.close(resolve)) }
