export function requiresCooperatorAccess(user) {
  // app_metadata is server-managed. user_metadata must never grant account access.
  return user?.app_metadata?.latido_account_role === 'cooperator'
}

export function getAccountUser(authUser, access) {
  if (!authUser || access?.role !== 'cooperator') return authUser
  if (!access.account_id || access.account_id === authUser.id) return null
  return {
    ...authUser,
    id:access.account_id,
    user_metadata:{
      ...authUser.user_metadata,
      name:access.name || 'Cuenta compartida',
      canton:access.canton || '',
      avatar_url:access.avatar_url || '',
    },
  }
}
