import { supabase } from './supabase'

export async function cardRpc(name, params = {}) {
  const { data, error } = await supabase.rpc(name, params)
  if (error) throw error
  return data
}

export const cardUrl = (token) => `${window.location.origin}/c/${token}`
export const scannerLinkUrl = (token) => `${window.location.origin}/scanner/link/${token}`
