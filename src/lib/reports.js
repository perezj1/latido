import { supabase } from './supabase'

export const REPORT_REASONS = [
  { id: 'fraud', label: 'Fraude o estafa' },
  { id: 'spam', label: 'Spam' },
  { id: 'abuse', label: 'Acoso o abuso' },
  { id: 'inappropriate', label: 'Contenido inapropiado' },
  { id: 'other', label: 'Otro motivo' },
]

export async function reportContent({
  reporterId,
  contentType,
  contentId,
  reason,
  notes = '',
  metadata = {},
}) {
  return supabase.from('reports').insert({
    reporter_id: reporterId,
    content_type: contentType,
    content_id: String(contentId),
    reason,
    notes,
    metadata,
  })
}

export async function addModerationQueueItem({
  contentType,
  contentId,
  authorId,
  reason,
  excerpt,
  matchedTerm = '',
  metadata = {},
}) {
  return supabase.from('moderation_queue').insert({
    content_type: contentType,
    content_id: String(contentId),
    author_id: authorId || null,
    reason,
    excerpt,
    matched_term: matchedTerm,
    metadata,
  })
}
