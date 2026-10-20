const RENEWING_STATUSES = new Set(['active', 'past_due', 'processing'])

// Check local billing first: deleting a free publication never needs Stripe.
export async function getBusinessDeletionState(client, providerId) {
  const { data, error } = await client.rpc('get_business_deletion_status', {
    p_provider_id: providerId,
  })
  const unavailable = error?.code === 'PGRST202'
  if (error && !unavailable) throw error
  const subscription = data?.subscription
  const blocked = Boolean(data?.blocked || (
    RENEWING_STATUSES.has(subscription?.status) && subscription.cancelAtPeriodEnd !== true
  ))
  return { blocked, subscription: subscription || null }
}

export async function deleteBusinessPublication(client, { providerId, userId, title, confirm }) {
  if (!userId) throw new Error('Necesitas iniciar sesión para eliminar tu negocio.')
  const state = await getBusinessDeletionState(client, providerId)
  const message = state.blocked
    ? `Tienes una suscripción activa. ¿Seguro que quieres eliminar este negocio?\n\nSe cancelará la renovación de tu suscripción y se eliminará el negocio.\n\n${title}`
    : `¿Seguro que quieres borrar esta publicación?\n\n${title}`
  if (!await confirm(message)) return false

  if (state.blocked) {
    const { data, error } = await client.functions.invoke('create_business_promotion_portal', {
      body: { providerId, cancelForDeletion: true },
    })
    if (error || data?.ok !== true || data.blocked !== false || data.cancellationScheduled !== true) {
      throw new Error('No se pudo confirmar la cancelación de la renovación. Tu negocio no se ha eliminado. Inténtalo de nuevo.')
    }
  }

  // The database guard remains authoritative if billing changes concurrently.
  const { error } = await client.from('providers').delete().eq('id', providerId).eq('user_id', userId)
  if (error) throw error
  return true
}
