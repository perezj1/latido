import { supabase } from './supabase'

export const LATIDO_RATING_SUBMITTED_EVENT = 'latido:rating-submitted'
export const LATIDO_RATING_REMINDER_AFTER_MS = 7 * 24 * 60 * 60 * 1000

export function isLatidoRatingDue(accountCreatedAt, now = Date.now()) {
  const createdAt = Date.parse(accountCreatedAt || '')
  return Number.isFinite(createdAt)
    && now - createdAt >= LATIDO_RATING_REMINDER_AFTER_MS
}

export async function submitSearchResolutionFeedback(context, answer, reason = null) {
  if (!context?.search_attempt_id || !context?.query || !answer) return null

  const { data, error } = await supabase.rpc('submit_search_resolution_feedback', {
    p_search_attempt_id:context.search_attempt_id,
    p_query:context.query,
    p_answer:answer,
    p_result_id:context.result_id || null,
    p_result_type:context.result_type || null,
    p_result_label:context.result_label || null,
    p_reason:reason || null,
    p_had_solution_action:Boolean(context.action_recorded_at),
    p_solution_action:context.action || null,
    p_time_to_feedback_ms:Math.max(
      0,
      Date.now() - Number(context.opened_at || Date.now()),
    ),
  })

  if (error) throw error
  return data
}

export async function getLatidoRating(userId) {
  if (!userId) return null

  const { data, error } = await supabase
    .from('latido_ratings')
    .select('overall_rating, usefulness_rating, comment, account_created_at, created_at, updated_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data || null
}

export async function saveLatidoRating({
  userId,
  overallRating,
  usefulnessRating,
  comment,
  accountCreatedAt,
}) {
  const { data, error } = await supabase
    .from('latido_ratings')
    .upsert({
      user_id:userId,
      overall_rating:overallRating,
      usefulness_rating:usefulnessRating,
      comment:comment.trim() || null,
      account_created_at:accountCreatedAt || null,
    }, { onConflict:'user_id' })
    .select('overall_rating, usefulness_rating, comment, account_created_at, created_at, updated_at')
    .single()

  if (error) throw error
  return data
}

export function notifyLatidoRatingSubmitted(rating) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(LATIDO_RATING_SUBMITTED_EVENT, {
    detail:rating,
  }))
}
