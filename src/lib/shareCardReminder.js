const REMINDER_PREFIX = 'latido_share_card_reminder_v1'
export const SHARE_CARD_REMINDER_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000

function reminderKey(kind, userId, contentId) {
  return `${REMINDER_PREFIX}:${kind}:${String(userId || '')}:${String(contentId || '')}`
}

export function getShareCardReminderState(kind, userId, contentId) {
  if (typeof window === 'undefined' || !userId || !contentId) return {}
  try {
    return JSON.parse(window.localStorage.getItem(reminderKey(kind, userId, contentId)) || '{}')
  } catch {
    return {}
  }
}

function saveShareCardReminderState(kind, userId, contentId, patch) {
  if (typeof window === 'undefined' || !userId || !contentId) return
  try {
    const previous = getShareCardReminderState(kind, userId, contentId)
    window.localStorage.setItem(reminderKey(kind, userId, contentId), JSON.stringify({ ...previous, ...patch }))
  } catch {}
}

export function shouldShowShareCardReminder(kind, userId, contentId, now=Date.now()) {
  const state = getShareCardReminderState(kind, userId, contentId)
  if (state.sharedAt) return false
  return !state.lastShownAt || now - Number(state.lastShownAt) >= SHARE_CARD_REMINDER_INTERVAL_MS
}

export function markShareCardReminderShown(kind, userId, contentId) {
  saveShareCardReminderState(kind, userId, contentId, { lastShownAt:Date.now() })
}

export function markShareCardShared(kind, userId, contentId) {
  saveShareCardReminderState(kind, userId, contentId, { sharedAt:Date.now() })
}
