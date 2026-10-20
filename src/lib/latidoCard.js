import { supabase } from './supabase'
import { cardActionAvailable } from './latidoCardLaunch'

export async function cardRpc(name, params = {}, { signal } = {}) {
  if (!cardActionAvailable(name)) throw new Error('Esta función todavía no está disponible.')
  const request = supabase.rpc(name, params)
  const { data, error } = await (signal ? request.abortSignal(signal) : request)
  if (error) throw error
  // Older dashboard SQL still lists archived publications. Verify ownership
  // and publication separately from the administrator's management access.
  if (name === 'lc_business_dashboard' && data?.businesses?.length) {
    const verification = supabase.from('providers').select('id,user_id,active')
      .in('id', data.businesses.map((business) => business.id))
      .is('deleted_at', null)
    const { data: providers, error: verificationError } = await (
      signal ? verification.abortSignal(signal) : verification
    )
    if (verificationError) throw verificationError
    const visibleProviders = new Map(providers.map((provider) => [provider.id, provider]))
    return {
      ...data,
      businesses: data.businesses
        .filter((business) => visibleProviders.has(business.id))
        .map((business) => ({
          ...business,
          owner_id: visibleProviders.get(business.id).user_id,
          published: visibleProviders.get(business.id).active === true
        }))
    }
  }
  return data
}

export const businessCardUrl = (providerId) =>
  `${window.location.origin}/card/negocio/${providerId}`
