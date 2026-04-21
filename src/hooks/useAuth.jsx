import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

function getLocalUser() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const parsed = JSON.parse(localStorage.getItem(key) || '{}')
        const user = parsed?.user ?? null
        const expiresAt = parsed?.expires_at
        if (!user) continue
        if (expiresAt && expiresAt < Date.now() / 1000) continue
        return user
      }
    }
  } catch {}
  return null
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getLocalUser)
  const [loading, setLoading] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(null)

  // Load avatar from profiles whenever user changes
  useEffect(() => {
    if (!user?.id) { setAvatarUrl(null); return }
    supabase.from('profiles').select('avatar_url').eq('id', user.id).maybeSingle()
      .then(({ data }) => { if (data?.avatar_url) setAvatarUrl(data.avatar_url) })
  }, [user?.id])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    }).catch(() => {})

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const signUp = async ({ email, password, name, canton }) => {
    const result = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, canton } },
    })
    setUser(result.data?.session?.user ?? result.data?.user ?? null)
    return result
  }

  const signIn = async ({ email, password }) => {
    const result = await supabase.auth.signInWithPassword({ email, password })
    setUser(result.data?.session?.user ?? null)
    return result
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setAvatarUrl(null)
  }

  // Called after a successful avatar upload so all consumers update instantly
  const updateAvatar = useCallback((url) => setAvatarUrl(url), [])

  const value = {
    user,
    loading,
    isLoggedIn: !!user,
    displayName: user?.user_metadata?.name || user?.email?.split('@')[0] || 'Usuario',
    userCanton: user?.user_metadata?.canton || '',
    avatarUrl,
    updateAvatar,
    signUp, signIn, signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
