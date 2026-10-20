import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium, webkit, expect } from '@playwright/test'
import tiktokMetadataHandler from '../api/tiktok-metadata.js'

const useWebkit = process.argv.includes('--webkit')
const port = useWebkit ? 5199 : 5198
const origin = `http://127.0.0.1:${port}`
const output = 'output/latido-card/image-fixes'
await mkdir(output, { recursive:true })
await writeFile(`${output}/fixture-${port}.html`, `<!doctype html><html><head><meta charset="utf-8"></head><body>
<div id="root"></div><script type="module">
import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '/src/hooks/useAuth.jsx'
import { CreatorAppContentCard, CreatorContentModal } from '/src/components/CreatorCards.jsx'
import { resolveImageUrl } from '/src/lib/imageVariants.js'
import '/src/index.css'
import '/src/pages/Creators.css'
const creator = { id:'creator-test', name:'Creadora de prueba', slug:'creadora', topics:['planes'] }
const signed = 'https://p16-common-sign.tiktokcdn-eu.com/expired.image?x-expires=123'
const content = (id, title, thumbnail_url) => ({ id, title, url:'https://www.tiktok.com/@latido/video/'+id, platform:'tiktok', topic:'planes', thumbnail_url })
const contents = [
  content('111111111', 'Portada antigua', signed),
  content('222222222', 'Proxy antiguo', '/api/tiktok-metadata?thumbnail=1&thumbnail_url='+encodeURIComponent(signed)),
  content('333333333', 'TikTok no disponible', signed),
  content('444444444', 'Portada personalizada', '${origin}/image-test-assets/custom.svg'),
  content('555555555', 'Imagen no disponible', '${origin}/image-test-assets/missing.svg'),
]
function Fixture() {
  const [selected, setSelected] = useState(null)
  const [revision, setRevision] = useState(0)
  return React.createElement('main', { style:{ maxWidth:390, margin:'auto', padding:16 } },
    React.createElement('h1', null, 'Imágenes de Inicio'),
    React.createElement('div', { style:{ display:'flex', gap:12, background:'#fff' } }, ...[
      ['Beauty Rocío','https://beauty-rocio.ch/wp-content/uploads/2022/12/Design-ohne-Titel-1.png'],
      ['Traducta','https://www.traducta.ch/sites/traducta.ch/files/agency-image/uebersetzungsbuero-traducta-luzern.jpg'],
    ].map(([alt,url]) => React.createElement('img', { key:alt, alt, src:resolveImageUrl(url), style:{ width:160, height:90, objectFit:'contain' } }))),
    ...contents.map(item => React.createElement(CreatorAppContentCard, { key:item.id, content:item, creator, discovery:true, onContentOpen:setSelected })),
    React.createElement('button', { onClick:()=>setRevision(revision+1) }, 'Actualizar '+revision),
    selected && React.createElement(CreatorContentModal, { content:selected, creator, onClose:()=>setSelected(null) }))
}
createRoot(document.getElementById('root')).render(React.createElement(MemoryRouter, null,
  React.createElement(AuthProvider, null, React.createElement(Fixture))))
</script></body></html>`)

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  env:{ ...process.env, VITE_SUPABASE_URL:`${origin}/image-test-api`, VITE_SUPABASE_ANON_KEY:'test-key' },
  stdio:'pipe', windowsHide:true,
})
let serverOutput = ''
server.stdout.on('data', chunk => { serverOutput += chunk })
server.stderr.on('data', chunk => { serverOutput += chunk })
const originalFetch = globalThis.fetch
let browser
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(serverOutput || 'Vite did not start')), 15000)
    const check = () => {
      if (serverOutput.includes('Local:')) { clearTimeout(timeout); resolve() }
    }
    server.stdout.on('data', check)
    server.once('exit', code => { clearTimeout(timeout); reject(new Error(`Vite exited ${code}: ${serverOutput}`)) })
    check()
  })
  browser = await (useWebkit ? webkit : chromium).launch({ headless:true })
  const page = await browser.newPage({ viewport:{ width:390, height:844 } })
  const pageErrors = [], requests = []
  page.on('pageerror', error => pageErrors.push(error.message))
  const image = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#d1fae5"/><circle cx="60" cy="60" r="35" fill="#10b981"/></svg>'
  // Exercise the actual thumbnail API against both fresh CDN data and a blocked
  // upstream. Tests must never contact TikTok or the production database.
  globalThis.fetch = async value => {
    const url = new URL(value)
    if (url.hostname === 'www.tiktok.com') {
      if (url.searchParams.get('url').includes('333333333')) return new Response('Forbidden', { status:403 })
      return Response.json({ title:'Vídeo', thumbnail_url:'https://p16-common-sign.tiktokcdn-eu.com/fresh.png' })
    }
    assert.equal(url.href, 'https://p16-common-sign.tiktokcdn-eu.com/fresh.png')
    return new Response(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXmYAAAAASUVORK5CYII=', 'base64'), { headers:{ 'Content-Type':'image/png' } })
  }
  await page.route('**/*', async route => {
    const url = new URL(route.request().url())
    requests.push(url.href)
    if (url.hostname === 'www.tiktok.com' && route.request().resourceType() === 'document') {
      return route.fulfill({ contentType:'text/html', body:'<!doctype html><title>Reproductor de prueba</title>' })
    }
    assert.equal(url.origin, origin, 'No browser requests to expired images or live external services')
    if (url.pathname.startsWith('/image-test-api/')) return route.fulfill({ contentType:'application/json', body:'[]' })
    if (url.pathname === '/api/tiktok-metadata') {
      const response = { headers:{}, setHeader(key,value) { this.headers[key] = value }, end(body) { this.body = body } }
      await tiktokMetadataHandler({ method:'GET', url:url.href }, response)
      assert.equal(response.statusCode, 200)
      return route.fulfill({ status:response.statusCode, headers:response.headers, body:response.body })
    }
    if (url.pathname === '/image-test-assets/custom.svg') return route.fulfill({ contentType:'image/svg+xml', body:image })
    if (url.pathname === '/image-test-assets/missing.svg') return route.fulfill({ status:404, body:'' })
    return route.continue()
  })
  await page.goto(`${origin}/${output}/fixture-${port}.html`)
  for (const name of ['Beauty Rocío','Traducta']) {
    await expect(page.getByRole('img', { name, exact:true })).toBeVisible()
    await expect.poll(() => page.getByRole('img', { name, exact:true }).evaluate(img => img.naturalWidth)).toBeGreaterThan(0)
  }
  const card = title => page.locator('.creator-app-content-card').filter({ hasText:title })
  for (const title of ['Portada antigua','Proxy antiguo','TikTok no disponible','Portada personalizada']) {
    const thumbnail = card(title).locator('.creator-home-content-card__thumbnail')
    await expect(thumbnail).toBeVisible()
    await expect.poll(() => thumbnail.evaluate(img => img.naturalWidth)).toBeGreaterThan(0)
  }
  await expect(card('Imagen no disponible').locator('img')).toHaveCount(0)
  await page.getByRole('button', { name:'Actualizar 0', exact:true }).click()
  await expect(page.getByRole('button', { name:'Actualizar 1', exact:true })).toBeVisible()
  assert.equal(requests.filter(url => url.endsWith('/image-test-assets/missing.svg')).length, 1, 'Do not retry a failed custom image on rerender')
  await page.screenshot({ path:`${output}/${useWebkit ? 'webkit' : 'chromium'}-cards.png`, fullPage:true })
  for (const title of ['Portada antigua','TikTok no disponible']) {
    await page.getByRole('button', { name:`Ver ${title}`, exact:true }).click()
    const modal = page.getByRole('dialog', { name:`${title} en TikTok`, exact:true })
    await expect(modal.locator('iframe')).toHaveAttribute('src', /https:\/\/www\.tiktok\.com\/player\/v1\/\d+/)
    await modal.getByRole('button', { name:'Volver', exact:true }).click()
    await expect(modal).toHaveCount(0)
  }
  assert.ok(!requests.some(url => url.includes('thumbnail_url=')), 'Legacy image-only proxy URLs must be replaced with the saved post')
  assert.deepEqual(pageErrors, [])
  console.log(`${useWebkit ? 'WebKit' : 'Chromium'}: local logos, renewed TikTok thumbnails, upstream fallback, custom images and video opening passed`)
} finally {
  globalThis.fetch = originalFetch
  await browser?.close()
  server.kill()
}
