import { supabase } from './supabase'

const PRESENCE_TOPIC = 'latido-presence-v2'

let channel = null
let currentUserId = null
let subscribed = false
let stopTimer = null
let onlineUserIds = new Set()
let presenceStatus = 'idle'
const listeners = new Set()
const statusListeners = new Set()

function extractPresenceIds(state = {}) {
  return new Set(
    Object.values(state)
      .flat()
      .map(meta => meta?.user_id)
      .filter(Boolean)
  )
}

function publishOnlineUsers(ids) {
  onlineUserIds = new Set(ids)
  listeners.forEach(listener => listener(new Set(onlineUserIds)))
}

function publishPresenceStatus(status) {
  presenceStatus = status
  statusListeners.forEach(listener => listener(presenceStatus))
}

function syncPresenceState() {
  if (!channel) return
  publishOnlineUsers(extractPresenceIds(channel.presenceState()))
}

export function subscribeToOnlineUsers(listener) {
  listeners.add(listener)
  listener(new Set(onlineUserIds))

  return () => {
    listeners.delete(listener)
  }
}

export function subscribeToPresenceStatus(listener) {
  statusListeners.add(listener)
  listener(presenceStatus)

  return () => {
    statusListeners.delete(listener)
  }
}

export function trackUserPresence() {
  if (!channel || !currentUserId || !subscribed) return

  channel
    .track({ user_id: currentUserId, online_at: new Date().toISOString() })
    .catch(err => console.warn('Could not track user presence:', err?.message || err))
}

function stopPresenceNow() {
  if (stopTimer) {
    window.clearTimeout(stopTimer)
    stopTimer = null
  }

  const activeChannel = channel
  channel = null
  currentUserId = null
  subscribed = false
  publishOnlineUsers(new Set())
  publishPresenceStatus('idle')

  if (activeChannel) {
    activeChannel.untrack().catch(() => {})
    supabase.removeChannel(activeChannel).catch(() => {})
  }
}

export function startUserPresence(userId) {
  if (!userId) return () => {}

  if (stopTimer) {
    window.clearTimeout(stopTimer)
    stopTimer = null
  }

  if (channel && currentUserId === userId) {
    trackUserPresence()
    return () => schedulePresenceStop(userId)
  }

  if (channel) stopPresenceNow()

  currentUserId = userId
  subscribed = false
  publishPresenceStatus('connecting')
  channel = supabase.channel(PRESENCE_TOPIC, {
    config: { presence: { key: userId } },
  })

  channel
    .on('presence', { event: 'sync' }, syncPresenceState)
    .on('presence', { event: 'join' }, syncPresenceState)
    .on('presence', { event: 'leave' }, syncPresenceState)
    .subscribe(status => {
      if (!channel || currentUserId !== userId) return

      if (status === 'SUBSCRIBED') {
        subscribed = true
        publishPresenceStatus('subscribed')
        trackUserPresence()
        syncPresenceState()
      }

      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        subscribed = false
        publishPresenceStatus(status.toLowerCase())
      }
    })

  return () => schedulePresenceStop(userId)
}

function schedulePresenceStop(userId) {
  if (userId !== currentUserId) return
  if (stopTimer) window.clearTimeout(stopTimer)
  stopTimer = window.setTimeout(stopPresenceNow, 800)
}

if (import.meta.hot) {
  import.meta.hot.dispose(stopPresenceNow)
}
