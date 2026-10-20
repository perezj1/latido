import { supabase } from './supabase'
import { cardActionAvailable } from './latidoCardLaunch'

export async function cardRpc(name, params = {}, { signal } = {}) {
  if (!cardActionAvailable(name)) throw new Error('Esta función todavía no está disponible.')
  const request = supabase.rpc(name, params)
  const { data, error } = await (signal ? request.abortSignal(signal) : request)
  if (error) throw error
  // Older dashboard SQL still lists archived publications. Revalidate against
  // providers before using that list for business access or offer management.
  if (name === 'lc_business_dashboard' && data?.businesses?.length) {
    const verification = supabase.from('providers').select('id')
      .in('id', data.businesses.map((business) => business.id))
      .is('deleted_at', null)
    const { data: providers, error: verificationError } = await (
      signal ? verification.abortSignal(signal) : verification
    )
    if (verificationError) throw verificationError
    const visibleIds = new Set(providers.map((provider) => provider.id))
    return { ...data, businesses: data.businesses.filter((business) => visibleIds.has(business.id)) }
  }
  return data
}

export const businessCardUrl = (providerId) =>
  `${window.location.origin}/card/negocio/${providerId}`
