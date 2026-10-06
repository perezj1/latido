import dns from 'node:dns'
import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import gelatoHandler from './api/gelato.js'
import { resolveTikTokLink } from './api/tiktok-resolve.js'
import tiktokMetadataHandler from './api/tiktok-metadata.js'

dns.setDefaultResultOrder('verbatim')

function tiktokResolverPlugin() {
  return {
    name:'latido-tiktok-resolver',
    configureServer(server) {
      server.middlewares.use('/api/tiktok-metadata', tiktokMetadataHandler)
      server.middlewares.use('/api/tiktok-resolve', async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.statusCode = 204
          res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
          res.end()
          return
        }

        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        if (req.method !== 'GET') {
          res.statusCode = 405
          res.setHeader('Allow', 'GET, OPTIONS')
          res.end(JSON.stringify({ error:'Method not allowed' }))
          return
        }

        const requestedUrl = new URL(req.url || '/', 'http://localhost').searchParams.get('url')
        if (!requestedUrl || requestedUrl.length > 2048) {
          res.statusCode = 400
          res.end(JSON.stringify({ error:'Missing TikTok URL' }))
          return
        }

        try {
          const result = await resolveTikTokLink(requestedUrl)
          res.statusCode = 200
          res.setHeader('Cache-Control', 'no-store')
          res.end(JSON.stringify(result))
        } catch (error) {
          res.statusCode = error?.statusCode || 502
          res.end(JSON.stringify({ error:error?.message || 'TikTok link resolution failed' }))
        }
      })
    },
  }
}

function gelatoDevPlugin() {
  return {
    name:'latido-gelato-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/gelato', async (req, res) => {
        const requestUrl = new URL(req.url || '/', 'http://localhost')
        req.query = Object.fromEntries(requestUrl.searchParams)

        if (req.method === 'POST') {
          const chunks = []
          let size = 0
          for await (const chunk of req) {
            size += chunk.length
            if (size > 1_000_000) {
              res.statusCode = 413
              res.end(JSON.stringify({ error:'Solicitud demasiado grande.' }))
              return
            }
            chunks.push(chunk)
          }

          try {
            req.body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}
          } catch {
            res.statusCode = 400
            res.end(JSON.stringify({ error:'JSON no válido.' }))
            return
          }
        }

        res.status = code => {
          res.statusCode = code
          return res
        }
        res.json = payload => res.end(JSON.stringify(payload))
        await gelatoHandler(req, res)
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Vite reloads its config when an env file changes. Always copy the latest
  // local Gelato values so a key that was replaced does not remain cached in
  // the long-running development process.
  for (const key of [
    'GELATO_API_KEY',
    'GELATO_PRODUCT_CATALOG_JSON',
    'GELATO_STORE_ID',
    'GELATO_STORE_NAME',
  ]) {
    if (env[key] !== undefined) process.env[key] = env[key]
  }
  const eventfrogKey =
    env.EVENTFROG_API_KEY ||
    env.VITE_EVENTFROG_PUBLIC_API_KEY ||
    env.VITE_EVENTFROG_CALENDAR_KEY

  function rewriteEventfrogPath(path) {
    const [pathname, search = ''] = path.split('?')
    const params = new URLSearchParams(search)
    const resource = params.get('resource')
    params.delete('resource')

    const endpoint = resource === 'locations'
      ? '/public/v1/locations'
      : '/public/v1/events'
    const query = params.toString()

    return `${pathname.replace(/^\/api\/eventfrog/, endpoint)}${query ? `?${query}` : ''}`
  }

  function rewriteProviderImagePath(path) {
    const requestUrl = new URL(path, 'http://localhost')
    if (requestUrl.searchParams.get('key') === 'colombia-cancilleria') {
      return '/sites/default/files/inline-images/logo-cancilleria.png'
    }
    return '/provider-image-not-found'
  }

  return {
    plugins: [react(), tiktokResolverPlugin(), gelatoDevPlugin()],
    resolve: {
      alias: {
        react: path.resolve(process.cwd(), 'node_modules/react'),
        'react-dom': path.resolve(process.cwd(), 'node_modules/react-dom'),
      },
      dedupe: ['react', 'react-dom'],
    },
    server: {
      host: 'localhost',
      port: 8080,
      watch: {
        // Windows + Deno's node-compat fs watcher can crash when Vite tries to
        // watch a path that was just removed during HMR. Polling is a little
        // less fancy, but much more stable for local development here.
        usePolling: true,
        interval: 350,
        ignored: ['**/.git/**', '**/dist/**', '**/node_modules/**'],
      },
      proxy: {
        '/api/provider-image': {
          target: 'https://suiza.embajada.gov.co',
          changeOrigin: true,
          secure: true,
          rewrite: rewriteProviderImagePath,
          configure(proxy) {
            proxy.on('proxyReq', proxyRequest => {
              proxyRequest.removeHeader('referer')
              proxyRequest.removeHeader('origin')
            })
          },
        },
        '/api/eventfrog': {
          target: 'https://api.eventfrog.net',
          changeOrigin: true,
          secure: true,
          rewrite: rewriteEventfrogPath,
          headers: eventfrogKey ? { Authorization: `Bearer ${eventfrogKey}` } : {},
          configure(proxy) {
            const emit = proxy.emit.bind(proxy)
            proxy.emit = (event, error, ...args) => {
              const aborted = event === 'error'
                && (
                  error?.name === 'AbortError'
                  || error?.code === 'ECONNRESET'
                  || error?.message === 'The request has been cancelled.'
                )
              if (aborted) return false
              return emit(event, error, ...args)
            }
          },
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            react:['react', 'react-dom', 'react-router-dom'],
            supabase:['@supabase/supabase-js'],
            toast:['react-hot-toast'],
          },
        },
      },
    },
  }
})
