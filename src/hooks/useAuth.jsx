import { useState, useEffect, createContext, useContext } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

// Read cached session from localStorage synchronously — avoids blocking the UI
// on a network round-trip before rendering anything.
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

  useEffect(() => {
    // Verify / refresh the session in the background — does not block rendering
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    }).catch(() => {})

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const signUp = async ({ email, password, name, canton }) => {
    // The database trigger creates the profile row after auth signup.
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
  }

  const value = {
    user,
    loading,
    isLoggedIn: !!user,
    displayName: user?.user_metadata?.name || user?.email?.split('@')[0] || 'Usuario',
    userCanton: user?.user_metadata?.canton || '',
    signUp, signIn, signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
