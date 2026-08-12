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
      detectSessionInUrl: true,
    },
  },
)
