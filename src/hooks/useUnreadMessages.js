import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { unreadStore } from '../lib/unreadStore'
import { useAuth } from './useAuth'

const STORAGE_KEY = 'latido_msgs_last_visit'

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

      const { data: convs } = await supabase
        .from('conversations')
        .select('id')
        .or(`sender_id.eq.${user.id},owner_id.eq.${user.id}`)

      if (cancelled) return
      const convIds = (convs || []).map(c => c.id)
      convIdsRef.current = new Set(convIds)
      if (!convIds.length) return

      // Seed the store with initially unread convs
      let q = supabase
        .from('messages')
        .select('conversation_id')
        .in('conversation_id', convIds)
        .neq('sender_id', user.id)

      if (lastVisit) q = q.gt('created_at', lastVisit)

      const { data: unreadMsgs } = await q
      if (cancelled) return

      ;(unreadMsgs || []).forEach(m => unreadStore.add(m.conversation_id))

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

  return { unreadConvIds, hasUnread: unreadConvIds.size > 0 }
}
