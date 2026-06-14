import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  getEnhancedStructuredData,
  getLlmsText,
  getPublicSeoPages,
  getSeoSnapshot,
  SITE_URL,
} from '../src/lib/seo.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const distDir = path.join(rootDir, 'dist')
const distIndex = path.join(distDir, 'index.html')

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeXml(value = '') {
  return escapeHtml(value).replace(/'/g, '&apos;')
}

function setMeta(html, selector, tag) {
  const nextTag = tag.trim()
  const match = html.match(new RegExp(`<meta\\s+[^>]*${selector}[^>]*>`, 'i'))

  if (match) return html.replace(match[0], nextTag)
  return html.replace('</head>', `    ${nextTag}\n  </head>`)
}

function setCanonical(html, href) {
  const tag = `<link rel="canonical" href="${escapeHtml(href)}" />`
  const match = html.match(/<link\s+[^>]*rel=["']canonical["'][^>]*>/i)

  if (match) return html.replace(match[0], tag)
  return html.replace('</head>', `    ${tag}\n  </head>`)
}

function setJsonLd(html, data) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c')
  const tag = `<script type="application/ld+json" id="latido-structured-data">${json}</script>`
  const match = html.match(/<script\s+[^>]*id=["']latido-structured-data["'][^>]*>[\s\S]*?<\/script>/i)

  if (match) return html.replace(match[0], tag)
  return html.replace('</head>', `    ${tag}\n  </head>`)
}

function setSnapshotAssets(html) {
  if (html.includes('id="latido-seo-snapshot-style"')) return html

  const tag = [
    '<script>document.documentElement.classList.add("latido-js")</script>',
    '<style id="latido-seo-snapshot-style">',
    'html.latido-js #latido-seo-snapshot{display:none!important}',
    '#latido-seo-snapshot{font-family:Poppins,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;max-width:860px;margin:0 auto;padding:32px 24px;color:#0f172a;background:#fff}',
    '#latido-seo-snapshot a{color:#2563eb}',
    '#latido-seo-snapshot h1{font-size:28px;line-height:1.2;margin:8px 0 12px}',
    '#latido-seo-snapshot p,#latido-seo-snapshot li{font-size:14px;line-height:1.7}',
    '</style>',
  ].join('')

  return html.replace('</head>', `    ${tag}\n  </head>`)
}

function renderSnapshot(seo) {
  const snapshot = getSeoSnapshot(seo)
  const facts = (snapshot.facts || [])
    .map(item => `<li>${escapeHtml(item)}</li>`)
    .join('')
  const links = (snapshot.links || [])
    .map(link => `<li><a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>${link.description ? ` - ${escapeHtml(link.description)}` : ''}</li>`)
    .join('')

  return [
    '<main id="latido-seo-snapshot" aria-label="Contenido principal">',
    `  <p>${escapeHtml(snapshot.eyebrow || 'Latido.ch')}</p>`,
    `  <h1>${escapeHtml(snapshot.title || seo.title)}</h1>`,
    `  <p>${escapeHtml(snapshot.description || seo.description)}</p>`,
    snapshot.body ? `  <p>${escapeHtml(snapshot.body)}</p>` : '',
    facts ? `  <ul>${facts}</ul>` : '',
    links ? `  <nav aria-label="Enlaces relacionados"><ul>${links}</ul></nav>` : '',
    '</main>',
  ].filter(Boolean).join('\n')
}

function setSnapshot(html, seo) {
  const snapshot = renderSnapshot(seo)
  const rootTag = '<div id="root"></div>'

  if (!html.includes(rootTag)) return html
  return html.replace(rootTag, `${snapshot}\n    ${rootTag}`)
}

function renderHtml(baseHtml, seo) {
  let html = baseHtml.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(seo.title)}</title>`)

  html = setMeta(html, 'name=["\']description["\']', `<meta name="description" content="${escapeHtml(seo.description)}" />`)
  html = setMeta(html, 'name=["\']robots["\']', `<meta name="robots" content="${escapeHtml(seo.robots)}" />`)
  html = setMeta(html, 'property=["\']og:title["\']', `<meta property="og:title" content="${escapeHtml(seo.title)}" />`)
  html = setMeta(html, 'property=["\']og:description["\']', `<meta property="og:description" content="${escapeHtml(seo.description)}" />`)
  html = setMeta(html, 'property=["\']og:type["\']', `<meta property="og:type" content="${escapeHtml(seo.type)}" />`)
  html = setMeta(html, 'property=["\']og:url["\']', `<meta property="og:url" content="${escapeHtml(seo.canonical)}" />`)
  html = setMeta(html, 'property=["\']og:image["\']', `<meta property="og:image" content="${escapeHtml(seo.image)}" />`)
  html = setMeta(html, 'name=["\']twitter:title["\']', `<meta name="twitter:title" content="${escapeHtml(seo.title)}" />`)
  html = setMeta(html, 'name=["\']twitter:description["\']', `<meta name="twitter:description" content="${escapeHtml(seo.description)}" />`)
  html = setMeta(html, 'name=["\']twitter:image["\']', `<meta name="twitter:image" content="${escapeHtml(seo.image)}" />`)
  html = setCanonical(html, seo.canonical)
  html = setJsonLd(html, getEnhancedStructuredData(seo))
  html = setSnapshotAssets(html)
  html = setSnapshot(html, seo)

  return html
}

function getOutputPath(url) {
  if (url.pathname === '/') return distIndex
  return path.join(distDir, url.pathname.replace(/^\/+/, ''), 'index.html')
}

function getSitemapXml(pages) {
  const today = new Date().toISOString().slice(0, 10)
  const urls = pages
    .filter(page => !page.robots?.includes('noindex'))
    .map(page => [
      '  <url>',
      `    <loc>${escapeXml(page.canonical)}</loc>`,
      `    <lastmod>${today}</lastmod>`,
      '  </url>',
    ].join('\n'))
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

async function injectServiceWorkerPrecache() {
  const assetsDir = path.join(distDir, 'assets')
  const serviceWorkerPath = path.join(distDir, 'sw.js')
  const assetNames = await readdir(assetsDir)
  const assets = assetNames
    .filter(name => /\.(?:css|js|woff2?)$/i.test(name))
    .sort()
    .map(name => `/assets/${name}`)

  const marker = 'const PRECACHE_ASSETS = []'
  const serviceWorker = await readFile(serviceWorkerPath, 'utf8')
  if (!serviceWorker.includes(marker)) {
    throw new Error('Could not find service worker precache marker')
  }

  await writeFile(
    serviceWorkerPath,
    serviceWorker.replace(marker, `const PRECACHE_ASSETS = ${JSON.stringify(assets)}`),
    'utf8',
  )

  return assets.length
}

const baseHtml = await readFile(distIndex, 'utf8')
const pages = getPublicSeoPages()

for (const seo of pages) {
  const url = new URL(seo.canonical)
  if (url.origin !== SITE_URL || url.search) continue

  const outputPath = getOutputPath(url)
  await mkdir(path.dirname(outputPath), { recursive:true })
  await writeFile(outputPath, renderHtml(baseHtml, seo), 'utf8')
}

await writeFile(path.join(distDir, 'sitemap.xml'), getSitemapXml(pages), 'utf8')
await writeFile(path.join(distDir, 'llms.txt'), getLlmsText(pages), 'utf8')
const precachedAssetCount = await injectServiceWorkerPrecache()

console.log(`SEO prerender generated ${pages.filter(page => !new URL(page.canonical).search).length} HTML entry files, sitemap.xml and llms.txt; precached ${precachedAssetCount} app assets`)
