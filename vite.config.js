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
    server: {
      port: 8080,
      proxy: {
        '/api/eventfrog': {
          target: 'https://api.eventfrog.net',
          changeOrigin: true,
          secure: true,
          rewrite: rewriteEventfrogPath,
          headers: eventfrogKey ? { Authorization: `Bearer ${eventfrogKey}` } : {},
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
