import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react'
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
  const [profileMetaLoaded, setProfileMetaLoaded] = useState(!localUser)
  const authRevisionRef = useRef(0)

  const applySession = useCallback(session => {
    authRevisionRef.current += 1
    setUser(session?.user ?? null)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!user?.id) {
      setAvatarUrl(null)
      setProfileMeta({ banned: false, bannedReason: '', bannedAt: null, interests: [] })
      setProfileMetaLoaded(true)
      return
    }

    let cancelled = false
    setProfileMetaLoaded(false)

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
      setAvatarUrl(
        profile.avatar_url
        || user.user_metadata?.avatar_url
        || user.user_metadata?.picture
        || null
      )
      setProfileMeta({
        banned: profile.banned === true,
        bannedReason: profile.banned_reason || '',
        bannedAt: profile.banned_at || null,
        interests: normalizeInterestIds(profile.interests),
      })
      setProfileMetaLoaded(true)
    }

    loadProfileMeta()
    return () => { cancelled = true }
  }, [user?.id])

  useEffect(() => {
    let active = true
    const initialRevision = authRevisionRef.current

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return
      if (event === 'SIGNED_OUT') {
        applySession(null)
        setAvatarUrl(null)
        setProfileMeta({ banned: false, bannedReason: '', bannedAt: null, interests: [] })
        setProfileMetaLoaded(true)
      } else if (session?.user) {
        // SIGNED_IN, TOKEN_REFRESHED, USER_UPDATED — real session
        applySession(session)
      }
      // Ignore events without session (e.g. SIGNED_UP with email confirmation pending).
    })

    // Do not let an initialization read overwrite a newer SIGNED_IN event.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return
      if (authRevisionRef.current === initialRevision) applySession(session)
      else setLoading(false)
    }).catch(() => {
      if (active) setLoading(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [applySession])

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
    // A user object without a session is not authenticated. Supabase can
    // return that shape for email confirmation and obfuscated duplicate users.
    applySession(result.data?.session ?? null)
    return result
  }

  const signIn = async ({ email, password }) => {
    const result = await supabase.auth.signInWithPassword({
      email:String(email || '').trim().toLowerCase(),
      password,
    })
    applySession(result.data?.session ?? null)
    return result
  }

  const signInWithGoogle = async ({ redirectTo }) => supabase.auth.signInWithOAuth({
    provider:'google',
    options: {
      redirectTo,
      queryParams: {
        prompt:'select_account',
      },
    },
  })

  const signInWithGoogleIdToken = async ({ token, nonce }) => {
    const result = await supabase.auth.signInWithIdToken({
      provider:'google',
      token,
      ...(nonce ? { nonce } : {}),
    })
    applySession(result.data?.session ?? null)
    return result
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    applySession(null)
    setAvatarUrl(null)
    setProfileMeta({ banned: false, bannedReason: '', bannedAt: null, interests: [] })
    setProfileMetaLoaded(true)
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
    profileMetaLoaded,
    avatarUrl,
    isBanned: profileMeta.banned,
    bannedReason: profileMeta.bannedReason,
    bannedAt: profileMeta.bannedAt,
    isAdmin: isAdminUser(user),
    updateAvatar,
    signUp, signIn, signInWithGoogle, signInWithGoogleIdToken, signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
