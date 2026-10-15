import { supabase } from './supabase'

export async function cardRpc(name, params = {}) {
  const { data, error } = await supabase.rpc(name, params)
  if (error) throw error
  return data
}

export const businessCardUrl = (providerId) => `${window.location.origin}/card/negocio/${providerId}`
