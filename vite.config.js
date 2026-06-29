import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
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

  return {
    plugins: [react()],
    resolve: {
      alias: {
        react: path.resolve(process.cwd(), 'node_modules/react'),
        'react-dom': path.resolve(process.cwd(), 'node_modules/react-dom'),
      },
      dedupe: ['react', 'react-dom'],
    },
    server: {
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
