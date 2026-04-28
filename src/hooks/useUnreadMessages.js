import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { unreadStore } from '../lib/unreadStore'
import { useAuth } from './useAuth'

const STORAGE_KEY = 'latido_msgs_last_visit'

async function fetchVisibleConversations(userId) {
  let response = await supabase
    .from('conversations')
    .select('id')
    .or(`and(sender_id.eq.${userId},deleted_by_sender.eq.false),and(owner_id.eq.${userId},deleted_by_owner.eq.false)`)

  if (response.error) {
    response = await supabase
      .from('conversations')
      .select('id')
      .or(`sender_id.eq.${userId},owner_id.eq.${userId}`)
  }

  return response
}

export function markConvRead(convId) {
  unreadStore.remove(convId)
  if (unreadStore.get().size === 0) {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString())
  }
}

export function markAllRead() {
  unreadStore.clear()
  localStorage.setItem(STORAGE_KEY, new Date().toISOString())
}

export function useUnreadMessages() {
  const { user, isLoggedIn } = useAuth()
  const [unreadConvIds, setUnreadConvIds] = useState(() => unreadStore.get())
  const channelRef = useRef(null)
  const convIdsRef = useRef(new Set())
  const channelScopeRef = useRef(Math.random().toString(36).slice(2, 10))

  // Stay in sync with the store
  useEffect(() => unreadStore.subscribe(setUnreadConvIds), [])

  useEffect(() => {
    if (!isLoggedIn || !user?.id) { unreadStore.clear(); return }

    let cancelled = false

    async function init() {
      const lastVisit = localStorage.getItem(STORAGE_KEY)

      const { data: convs } = await fetchVisibleConversations(user.id)

      if (cancelled) return
      const convIds = (convs || []).map(c => c.id)
      convIdsRef.current = new Set(convIds)
      if (!convIds.length) {
        unreadStore.replace([])
        return
      }

      // Rebuild from visible conversations only so deleted/hidden threads
      // cannot keep stale unread badges alive.
      let q = supabase
        .from('messages')
        .select('conversation_id')
        .in('conversation_id', convIds)
        .neq('sender_id', user.id)

      if (lastVisit) q = q.gt('created_at', lastVisit)

      const { data: unreadMsgs } = await q
      if (cancelled) return

      unreadStore.replace(
        [...new Set((unreadMsgs || []).map(m => m.conversation_id))]
      )

      // Real-time: new messages from others → add to store
      if (channelRef.current) supabase.removeChannel(channelRef.current)
      channelRef.current = supabase
        .channel(`unread-${user.id}-${channelScopeRef.current}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
          const msg = payload.new
          if (msg.sender_id === user.id) return
          if (!convIdsRef.current.has(msg.conversation_id)) return
          unreadStore.add(msg.conversation_id)
        })
        .subscribe()
    }

    init()
    return () => {
      cancelled = true
      if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null }
    }
  }, [user?.id, isLoggedIn])

  useEffect(() => {
    if (!('setAppBadge' in navigator)) return
    if (unreadConvIds.size > 0) {
      navigator.setAppBadge(unreadConvIds.size).catch(() => {})
    } else {
      navigator.clearAppBadge().catch(() => {})
    }
  }, [unreadConvIds])

  return { unreadConvIds, hasUnread: unreadConvIds.size > 0 }
}
