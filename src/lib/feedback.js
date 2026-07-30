import { supabase } from './supabase'
import { getMissingColumnName } from './supabaseCompat'

export const LATIDO_RATING_SUBMITTED_EVENT = 'latido:rating-submitted'
export const LATIDO_USEFULNESS_SUBMITTED_EVENT = 'latido:usefulness-submitted'
export const LATIDO_RATING_REMINDER_AFTER_MS = 7 * 24 * 60 * 60 * 1000
const LATIDO_RATING_COLUMNS = 'overall_rating, usefulness_rating, comment, account_created_at, created_at, updated_at'
const LATIDO_USEFULNESS_COLUMNS = `${LATIDO_RATING_COLUMNS}, usefulness_answer, usefulness_detail, usefulness_comment, usefulness_answered_at`

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

  const result = await supabase
    .from('latido_ratings')
    .select(LATIDO_USEFULNESS_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle()

  if (!result.error) return result.data || null

  const missingColumn = getMissingColumnName(result.error, 'latido_ratings')
  if (!missingColumn?.startsWith('usefulness_')) throw result.error

  const fallback = await supabase
    .from('latido_ratings')
    .select(LATIDO_RATING_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle()

  if (fallback.error) throw fallback.error
  return fallback.data
    ? {
        ...fallback.data,
        usefulness_answer:null,
        usefulness_detail:null,
        usefulness_comment:null,
        usefulness_answered_at:null,
      }
    : null
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
    .select(LATIDO_RATING_COLUMNS)
    .single()

  if (error) throw error
  return data
}

export async function saveLatidoUsefulnessFeedback({
  userId,
  answer,
  detail,
  comment = null,
  accountCreatedAt,
}) {
  const cleanComment = String(comment || '').trim().slice(0, 150)
  const { data, error } = await supabase
    .from('latido_ratings')
    .upsert({
      user_id:userId,
      usefulness_answer:answer,
      usefulness_detail:detail,
      usefulness_comment:cleanComment || null,
      usefulness_answered_at:new Date().toISOString(),
      account_created_at:accountCreatedAt || null,
    }, { onConflict:'user_id' })
    .select(LATIDO_USEFULNESS_COLUMNS)
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

export function notifyLatidoUsefulnessSubmitted(rating) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(LATIDO_USEFULNESS_SUBMITTED_EVENT, {
    detail:rating,
  }))
}
