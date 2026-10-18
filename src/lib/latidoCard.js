import { supabase } from './supabase'

export async function cardRpc(name, params = {}, { signal } = {}) {
  const request = supabase.rpc(name, params)
  const { data, error } = await (signal ? request.abortSignal(signal) : request)
  if (error) throw error
  return data
}

export const businessCardUrl = (providerId) =>
  `${window.location.origin}/card/negocio/${providerId}`
