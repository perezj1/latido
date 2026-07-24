import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { supabase } from '../lib/supabase'
import { isAdminUser } from '../lib/admin'
import { normalizeInterestIds } from '../lib/interests'

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
  const localUser = getLocalUser()
  const [user, setUser] = useState(localUser)
  // Only show loading spinner if we have no cached user to show immediately
  const [loading, setLoading] = useState(!localUser)
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [profileMeta, setProfileMeta] = useState({ banned: false, bannedReason: '', bannedAt: null, interests: [] })

  useEffect(() => {
    if (!user?.id) {
      setAvatarUrl(null)
      setProfileMeta({ banned: false, bannedReason: '', bannedAt: null, interests: [] })
      return
    }

    let cancelled = false

    async function loadProfileMeta() {
      let response = await supabase
        .from('profiles')
        .select('avatar_url, banned, banned_reason, banned_at, interests')
        .eq('id', user.id)
        .maybeSingle()

      if (response.error) {
        response = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('id', user.id)
          .maybeSingle()
      }

      if (cancelled) return
      const profile = response.data || {}
      setAvatarUrl(profile.avatar_url || null)
      setProfileMeta({
        banned: profile.banned === true,
        bannedReason: profile.banned_reason || '',
        bannedAt: profile.banned_at || null,
        interests: normalizeInterestIds(profile.interests),
      })
    }

    loadProfileMeta()
    return () => { cancelled = true }
  }, [user?.id])

  useEffect(() => {
    // Verify session in background; resolves loading if no cached user
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    }).catch(() => setLoading(false))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null)
        setAvatarUrl(null)
        setProfileMeta({ banned: false, bannedReason: '', bannedAt: null, interests: [] })
      } else if (session?.user) {
        // SIGNED_IN, TOKEN_REFRESHED, USER_UPDATED — real session
        setUser(session.user)
        setLoading(false)
      }
      // Ignore events without session (e.g. SIGNED_UP with email confirmation pending)
      // so we don't wipe out the user set by signUp()
    })
    return () => subscription.unsubscribe()
  }, [])

  const signUp = async ({ email, password, name, canton, languages=[], interests=[] }) => {
    const result = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          canton,
          languages,
          interests:normalizeInterestIds(interests),
        },
      },
    })
    // Set user from session (immediate login) or from user object (email confirmation flow)
    const u = result.data?.session?.user ?? result.data?.user ?? null
    setUser(u)
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
    setProfileMeta({ banned: false, bannedReason: '', bannedAt: null, interests: [] })
  }

  const updateAvatar = useCallback((url) => setAvatarUrl(url), [])

  const value = {
    user,
    loading,
    isLoggedIn: !!user,
    displayName: user?.user_metadata?.name || user?.email?.split('@')[0] || 'Usuario',
    userCanton: user?.user_metadata?.canton || '',
    userInterests: normalizeInterestIds(
      Array.isArray(user?.user_metadata?.interests)
        ? user.user_metadata.interests
        : profileMeta.interests
    ),
    avatarUrl,
    isBanned: profileMeta.banned,
    bannedReason: profileMeta.bannedReason,
    bannedAt: profileMeta.bannedAt,
    isAdmin: isAdminUser(user),
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
