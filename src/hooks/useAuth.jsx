import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react'
import { supabase } from '../lib/supabase'
import { isAdminUser } from '../lib/admin'
import { normalizeInterestIds } from '../lib/interests'
import { getAccountUser, requiresCooperatorAccess } from '../lib/accountAccess'

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
  const [authUser, setAuthUser] = useState(localUser)
  const [accountAccess, setAccountAccess] = useState(null)
  const resolvedAccess = accountAccess?.userId === authUser?.id ? accountAccess : null
  const restrictedLogin = requiresCooperatorAccess(authUser)
  const isCooperator = restrictedLogin || resolvedAccess?.data?.role === 'cooperator'
  const user = isCooperator && (!resolvedAccess || resolvedAccess.error || resolvedAccess.data?.role !== 'cooperator')
    ? null
    : getAccountUser(authUser, resolvedAccess?.data)
  // Only show loading spinner if we have no cached user to show immediately
  const [loading, setLoading] = useState(!localUser)
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [profileMeta, setProfileMeta] = useState({ banned: false, bannedReason: '', bannedAt: null, interests: [] })
  const [profileMetaLoaded, setProfileMetaLoaded] = useState(!localUser)
  const authRevisionRef = useRef(0)

  const applySession = useCallback(session => {
    authRevisionRef.current += 1
    setAuthUser(session?.user ?? null)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!authUser?.id) {
      setAccountAccess(null)
      return undefined
    }
    let cancelled = false
    // Keep this outside onAuthStateChange to avoid awaiting Supabase work inside its auth lock.
    supabase.rpc('get_my_account_access').then(({ data, error }) => {
      if (cancelled) return
      setAccountAccess({ userId:authUser.id, data:error ? null : data, error:error?.message || '' })
    }).catch(error => {
      if (!cancelled) setAccountAccess({ userId:authUser.id, data:null, error:error.message })
    })
    return () => { cancelled = true }
  }, [authUser?.id])

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
          latido_onboarding_completed:true,
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

  const signInWithProvider = async ({ provider, redirectTo }) => supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      ...(provider === 'google' ? { queryParams:{ prompt:'select_account' } } : {}),
    },
  })

  const signInWithGoogle = async ({ redirectTo }) => signInWithProvider({ provider:'google', redirectTo })
  const signInWithApple = async ({ redirectTo }) => signInWithProvider({ provider:'apple', redirectTo })

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
    loading:loading || Boolean(restrictedLogin && !resolvedAccess),
    authUser,
    isCooperator,
    canDelete:!isCooperator,
    accountAccessError:isCooperator ? resolvedAccess?.error || '' : '',
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
    isAdmin: isAdminUser(authUser),
    updateAvatar,
    signUp, signIn, signInWithGoogle, signInWithApple, signInWithGoogleIdToken, signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export const useAccountPermissions = () => {
  const ctx = useContext(AuthContext)
  return { canDelete:ctx?.canDelete ?? true, isCooperator:ctx?.isCooperator ?? false }
}
