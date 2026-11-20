import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { defineConfig, loadEnv } from 'vite'
import { publicConfig } from './src/config.js'

const appRoot = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = path.resolve(appRoot, '../..')
const sharedRoot = path.join(repoRoot, 'public')
const routes = new Set(['/cuenta','/auth/callback','/auth/restablecer','/instalar','/bienvenida','/como-se-juega','/retos','/ranking','/libreta','/perfil','/perfil/editar','/amigos','/medallas','/ajustes','/proponer','/moderacion','/avisos','/jugar'])
const publicRoutes=new Set(['/instalar','/bienvenida','/como-se-juega'])
const routeTitles={'/instalar':'Instalar Suizamente','/bienvenida':'Bienvenido a Suizamente','/como-se-juega':'Cómo jugar a Suizamente','/retos':'Retos','/ranking':'Rankings','/libreta':'Tu libreta','/perfil':'Tu perfil','/perfil/editar':'Editar tu perfil','/amigos':'Amigos','/medallas':'Medallas','/ajustes':'Ajustes','/proponer':'Proponer una pregunta','/moderacion':'Revisar propuestas','/avisos':'Avisos','/jugar':'Jugar'}
const knownPath=pathname=>routes.has(pathname)||/^\/duelo\/[A-Fa-f0-9]{8}$/.test(pathname)
const icons = {
  '/favicon.svg':'favicon.svg',
  '/icons/icon-192.png':'icon-192.png',
  '/icons/icon-512.png':'icon-512.png',
  '/icons/maskable-192.png':'maskable_icon_192.png',
  '/icons/maskable-512.png':'maskable_icon_512.png',
  '/icons/apple-touch-icon.png':'apple-touch-icon-180.png',
}
const mime = { '.js':'text/javascript', '.json':'application/json', '.css':'text/css', '.html':'text/html', '.svg':'image/svg+xml', '.png':'image/png', '.woff2':'font/woff2' }

async function sharedFiles() {
  const entries = new Map(Object.entries(icons).map(([url, file]) => [url, path.join(sharedRoot, file)]))
  async function walk(directory, prefix) {
    for (const item of await readdir(directory, { withFileTypes:true })) {
      const file = path.join(directory, item.name), url = prefix + '/' + item.name
      if (item.isDirectory()) await walk(file, url)
      else entries.set(url, file)
    }
  }
  await walk(path.join(sharedRoot, 'suizamente'), '/suizamente')
  return entries
}

export default defineConfig(({ command, mode }) => {
  const env = { ...loadEnv(mode, appRoot, 'VITE_'), ...process.env }
  const site = env.VITE_SITE_URL || 'https://suizamente.latido.ch'
  if (command === 'build') publicConfig(env)
  const preview = process.env.VERCEL_ENV === 'preview'
  let output
  return {
    root:appRoot, envDir:appRoot, appType:'mpa',
    define:{ __SUIZAMENTE_PREVIEW__:JSON.stringify(preview) },
    // Do not inherit Latido's PostCSS/Tailwind plugins or its dependencies.
    css:{ postcss:{ plugins:[] } },
    optimizeDeps:{ entries:['index.html'] },
    server:{ host:'127.0.0.1', port:5270, fs:{ allow:[appRoot, path.join(repoRoot,'src/lib')] } },
    preview:{ host:'127.0.0.1', port:5271 },
    build:{ outDir:'dist', emptyOutDir:true },
    plugins:[{
      name:'suizamente-shared-game',
      configResolved(config) { output = path.resolve(appRoot, config.build.outDir) },
      transformIndexHtml(html) {
        return html.replaceAll('__SITE_URL__', site.replace(/\/$/, '')).replaceAll('__ROBOTS__', preview ? 'noindex, nofollow' : 'index, follow')
      },
      configurePreviewServer(server) {
        server.middlewares.use((req, _res, next) => {
          const url = new URL(req.url || '/', 'http://localhost'), pathname = url.pathname.replace(/\/$/, '') || '/'
          if (knownPath(pathname)) req.url = (routes.has(pathname)?pathname+'/index.html':'/duelo.html') + url.search
          next()
        })
      },
      async configureServer(server) {
        const files = await sharedFiles()
        server.watcher.add([...files.values()])
        server.watcher.on('change', file => { if ([...files.values()].includes(file)) server.ws.send({ type:'full-reload' }) })
        server.middlewares.use(async (req, res, next) => {
          const url = new URL(req.url || '/', 'http://localhost'), pathname = url.pathname.replace(/\/$/, '') || '/'
          if (knownPath(pathname)) { req.url = '/index.html' + url.search; return next() }
          const file = files.get(url.pathname)
          if (!file) return next()
          try {
            res.setHeader('Content-Type', (mime[path.extname(file)] || 'application/octet-stream') + (path.extname(file) === '.woff2' || path.extname(file) === '.png' ? '' : '; charset=utf-8'))
            res.setHeader('Cache-Control', 'no-store')
            res.end(await readFile(file))
          } catch (error) { next(error) }
        })
      },
      async closeBundle() {
        if (command !== 'build') return
        await cp(path.join(sharedRoot, 'suizamente'), path.join(output, 'suizamente'), { recursive:true })
        for (const [url, source] of Object.entries(icons)) {
          const destination = path.join(output, url.slice(1))
          await mkdir(path.dirname(destination), { recursive:true })
          await cp(path.join(sharedRoot, source), destination)
        }
        // Private routes have their own noindex HTML as well as HTTP headers.
        const index = await readFile(path.join(output, 'index.html'), 'utf8')
        for (const route of routes) {
          const privatePage = !publicRoutes.has(route)
          const title = routeTitles[route] ? routeTitles[route]+' · Latido.ch' : 'Tu cuenta · Suizamente'
          let html = index.replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
            .replace(/(<link rel="canonical" href=")[^"]+/, `$1${site.replace(/\/$/,'')}${route}`)
            .replace(/(<meta property="og:url" content=")[^"]+/, `$1${site.replace(/\/$/,'')}${route}`)
            .replace(/(<meta name="robots" content=")[^"]+/, `$1${privatePage || preview ? 'noindex, nofollow' : 'index, follow'}`)
          if (privatePage) html = html.replace(/(<meta name="referrer" content=")[^"]+/, '$1no-referrer')
          let fallback = privatePage
            ? '<section class="page"><h1>Tu cuenta de Suizamente</h1><p>Abriendo tu cuenta…</p><noscript>Activa JavaScript para entrar.</noscript><a href="/">Volver al juego</a></section>'
            : '<section class="page"><h1>Instalar Suizamente</h1><p>Un juego de Latido.ch para aprender sobre Suiza.</p><p>En Chrome o Edge, usa la opción de instalación del menú. En iPhone o iPad, abre Safari, pulsa Compartir y elige «Añadir a pantalla de inicio».</p><p>Necesitas conexión para abrir el juego y consultar la comunidad.</p><a href="/">Jugar a Suizamente</a></section>'
          if (route==='/bienvenida'||route==='/como-se-juega') fallback='<section class="page"><h1>'+routeTitles[route]+'</h1><p>Elige entre dilemas suizos y preguntas con respuesta. Descubre qué eligió la comunidad, aprende un dato en cada respuesta y guarda tus favoritos.</p><p>Juega el reto diario o invita a tus amigos a un duelo con las mismas preguntas.</p><a href="/">Jugar a Suizamente</a></section>'
          html = html.replace(/(<main id="app">)[\s\S]*?(<\/main>)/, `$1${fallback}$2`)
          const directory = path.join(output, route.slice(1))
          await mkdir(directory, { recursive:true })
          await writeFile(path.join(directory, 'index.html'), html)
        }
        await writeFile(path.join(output,'duelo.html'),index.replace(/(<meta name="robots" content=")[^"]+/,'$1noindex, nofollow').replace(/(<meta name="referrer" content=")[^"]+/,'$1no-referrer'))
        await writeFile(path.join(output, 'robots.txt'), preview ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\nDisallow: /cuenta\nDisallow: /auth/\nDisallow: /suizamente/\nDisallow: /sin-conexion.html\nSitemap: ${site.replace(/\/$/,'')}/sitemap.xml\n`)
        await writeFile(path.join(output, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${site.replace(/\/$/,'')}/</loc></url><url><loc>${site.replace(/\/$/,'')}/instalar</loc></url></urlset>\n`)
        await writeFile(path.join(output, '404.html'), '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Página no encontrada · Suizamente</title><h1>Página no encontrada</h1><p><a href="/">Volver a Suizamente</a></p></html>')
        const worker = await readFile(path.join(output, 'sw.js'), 'utf8')
        const build = createHash('sha256').update(index).update(worker).update(await readFile(path.join(output, 'suizamente/data/preguntas.json'))).digest('hex').slice(0,12)
        await writeFile(path.join(output, 'sw.js'), worker.replaceAll('__BUILD_ID__', build))
      },
    }],
  }
})
