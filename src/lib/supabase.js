import { createClient } from '@supabase/supabase-js'

const env = import.meta.env || {}
const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_ANON_KEY

if ((!url || !key) && env.DEV) {
  console.warn('Supabase environment variables are missing. Remote data features are unavailable.')
}

export const supabase = createClient(
  url  || 'https://placeholder.supabase.co',
  key  || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // OAuth uses PKCE so an installed PWA receives a short-lived code in
      // the query string instead of session tokens in the URL fragment.
      flowType: 'pkce',
      // AuthCallback owns this route. Keeping automatic detection enabled on
      // every other route preserves password recovery and email-link flows.
      detectSessionInUrl: url => !url.pathname.startsWith('/auth/callback'),
    },
  },
)
