import { createClient } from '@supabase/supabase-js'
import { resilientAuthStorage } from './authStorage.js'
import { createSessionTransport } from './sessionTransport.js'

const env = import.meta.env || {}
const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_ANON_KEY

if ((!url || !key) && env.DEV) {
  console.warn('Supabase environment variables are missing. Remote data features are unavailable.')
}

let client
const transport=createSessionTransport({anonKey:key||'placeholder-key',getSession:()=>client.auth.getSession(),refreshSession:()=>client.auth.refreshSession(),signOut:()=>client.auth.signOut({scope:'local'})})
export const recoverSupabaseSession=transport.recover
export const invalidateSupabaseSession=transport.invalidate
export const supabase = client = createClient(
  url  || 'https://placeholder.supabase.co',
  key  || 'placeholder-key',
  {
    global:{fetch:transport.fetch},
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: resilientAuthStorage,
    },
  },
)
