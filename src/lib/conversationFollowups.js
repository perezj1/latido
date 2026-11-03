import { supabase } from './supabase'
export const FOLLOWUP_QUESTION = '¿Conseguiste lo que buscabas con este contacto?'
export const FOLLOWUP_REASONS = { not_replied: 'No me respondió', not_match: 'No era lo que buscaba', no_agreement: 'No hubo acuerdo', other: 'Otro motivo' }
export const followupDate = value => value ? new Date(value).toLocaleDateString('es-ES', { timeZone: 'Europe/Zurich', weekday: 'long', day: 'numeric', month: 'long' }) : ''
export const followupApi = {
  async get(conversationId) {
    const { data, error } = await supabase.rpc('cf_get', { p_conversation: conversationId })
    if (error) throw error
    return data
  },
  async answer(conversationId, round, answer) {
    const { data, error } = await supabase.rpc('cf_answer', { p_conversation: conversationId, p_round: round, p_answer: answer })
    if (error) throw error
    return data
  },
  async email(token, answer) {
    const { data, error } = await supabase.functions.invoke('conversation_followup_answer', { body: { token, ...(answer ? { answer } : {}) } })
    if (error || !data?.ok) throw error || new Error(data?.error || 'LINK_UNAVAILABLE')
    return data.followup
  },
  async feedback(conversationId, round, action, value = null) {
    const { data, error } = await supabase.rpc('cf_feedback', { p_conversation: conversationId, p_round: round, p_action: action, p_value: value })
    if (error) throw error
    return data
  },
  async emailChange(token, round, action, value = null) {
    const { data, error } = await supabase.functions.invoke('conversation_followup_answer', { body: { token, round, action, value } })
    if (error || !data?.ok) throw error || new Error(data?.error || 'LINK_UNAVAILABLE')
    return data.followup
  },
}
