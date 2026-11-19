export function publicConfig(env) {
  const url = new URL(env.VITE_SUPABASE_URL || 'https://missing.invalid')
  if (!env.VITE_SUPABASE_URL || url.username || url.password || url.search || url.hash
    || !['', '/'].includes(url.pathname)
    || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) {
    throw new Error('Configura VITE_SUPABASE_URL con la URL del proyecto Supabase de Latido.')
  }
  const key = String(env.VITE_SUPABASE_ANON_KEY || '').trim()
  let role = null
  if (key.split('.').length === 3) {
    try { role = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role } catch { /* Invalid key below. */ }
  }
  if (!key.startsWith('sb_publishable_') && role !== 'anon') {
    throw new Error('VITE_SUPABASE_ANON_KEY debe ser una clave pública anon o publishable. No uses service_role ni claves secretas.')
  }
  const site = new URL(env.VITE_SITE_URL || 'https://suizamente.latido.ch')
  if (site.protocol !== 'https:' || site.username || site.password || site.search || site.hash || !['', '/'].includes(site.pathname)) {
    throw new Error('VITE_SITE_URL debe ser el origen HTTPS público de Suizamente.')
  }
  return { url:url.origin, key, api:url.origin + '/functions/v1/suizamente-votos', site:site.origin }
}
