import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { createExternalNotificationRows, groupAppNotifications } from '../lib/appNotifications'
import { useAuth } from './useAuth'
import { dismissZoneAlert, useZoneAlerts } from './useZoneAlerts'
import { useBusinessLeadAlerts } from './useBusinessLeadAlerts'
import { useSavedSearchAlerts } from './useSavedSearchAlerts'

const AppNotificationsContext = createContext(null)
const ALERT_SEEN_KEY_PREFIX = 'latido_in_app_alert_seen'
const MAX_SEEN_IDS = 600

function loadAlertSeenIds(userId) {
  try {
    return new Set(JSON.parse(localStorage.getItem(`${ALERT_SEEN_KEY_PREFIX}:${userId || 'guest'}`) || '[]'))
  } catch {
    return new Set()
  }
}

function saveAlertSeenIds(userId, ids) {
  try {
    localStorage.setItem(
      `${ALERT_SEEN_KEY_PREFIX}:${userId || 'guest'}`,
      JSON.stringify([...ids].slice(-MAX_SEEN_IDS)),
    )
  } catch {}
}

function replaceNotification(rows, notification) {
  if (notification.read_at) return rows.filter(row => row.id !== notification.id)
  const existingIndex = rows.findIndex(row => row.id === notification.id)
  if (existingIndex < 0) return [notification, ...rows]
  return rows.map(row => row.id === notification.id ? notification : row)
}

export function AppNotificationsProvider({ children }) {
  const { user, isLoggedIn } = useAuth()
  const zoneAlertsState = useZoneAlerts()
  const businessLeadAlertsState = useBusinessLeadAlerts()
  const savedSearchAlertsState = useSavedSearchAlerts()
  const [notifications, setNotifications] = useState([])
  const [available, setAvailable] = useState(true)
  const [alertSeenIds, setAlertSeenIds] = useState(() => loadAlertSeenIds(user?.id))
  const userIdRef = useRef(user?.id || '')

  useEffect(() => {
    userIdRef.current = user?.id || ''
    setAlertSeenIds(loadAlertSeenIds(user?.id))
  }, [user?.id])

  useEffect(() => {
    if (!isLoggedIn || !user?.id) {
      setNotifications([])
      setAvailable(true)
      return undefined
    }

    let cancelled = false
    const scope = Math.random().toString(36).slice(2, 10)

    async function loadNotifications() {
      const { data, error } = await supabase
        .from('app_notifications')
        .select('id, recipient_id, kind, source_id, data, seen_at, read_at, created_at')
        .eq('recipient_id', user.id)
        .is('read_at', null)
        .order('created_at', { ascending:false })
        .limit(200)

      if (cancelled) return
      if (error) {
        setNotifications([])
        setAvailable(false)
        if (import.meta.env.DEV && !/app_notifications/i.test(error.message || '')) {
          console.warn('Could not load app notifications:', error.message)
        }
        return
      }

      setAvailable(true)
      setNotifications(data || [])
    }

    void loadNotifications()

    const channel = supabase
      .channel(`app-notifications:${user.id}:${scope}`)
      .on('postgres_changes', {
        event:'INSERT',
        schema:'public',
        table:'app_notifications',
        filter:`recipient_id=eq.${user.id}`,
      }, payload => {
        if (payload.new?.recipient_id !== userIdRef.current) return
        setNotifications(rows => replaceNotification(rows, payload.new))
      })
      .on('postgres_changes', {
        event:'UPDATE',
        schema:'public',
        table:'app_notifications',
        filter:`recipient_id=eq.${user.id}`,
      }, payload => {
        if (payload.new?.recipient_id !== userIdRef.current) return
        setNotifications(rows => replaceNotification(rows, payload.new))
      })
      .on('postgres_changes', {
        event:'DELETE',
        schema:'public',
        table:'app_notifications',
      }, payload => {
        if (!payload.old?.id) return
        setNotifications(rows => rows.filter(row => row.id !== payload.old.id))
      })
      .subscribe()

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [isLoggedIn, user?.id])

  const markSeen = useCallback(async (group, notificationIds) => {
    const ids = [...new Set(notificationIds || [])].filter(Boolean)
    if (!ids.length) return

    setAlertSeenIds(currentIds => {
      const nextIds = new Set(currentIds)
      ids.forEach(id => nextIds.add(group?.source === 'app' ? `app:${id}` : id))
      saveAlertSeenIds(user?.id, nextIds)
      return nextIds
    })

    if (group?.source && group.source !== 'app') {
      return
    }

    if (!user?.id) return

    const seenAt = new Date().toISOString()
    setNotifications(rows => rows.map(row => ids.includes(row.id) && !row.seen_at
      ? { ...row, seen_at:seenAt }
      : row))

    const { error } = await supabase
      .from('app_notifications')
      .update({ seen_at:seenAt })
      .eq('recipient_id', user.id)
      .in('id', ids)
      .is('seen_at', null)

    if (error && import.meta.env.DEV) console.warn('Could not mark notifications as shown:', error.message)
  }, [user?.id])

  const markGroupRead = useCallback(async (group) => {
    const ids = [...new Set(group?.notificationIds || [])].filter(Boolean)
    if (!ids.length) return

    if (group?.source === 'zone') {
      group.notifications.forEach(notification => dismissZoneAlert(notification.source_id))
      return
    }
    if (group?.source === 'business_lead') {
      await Promise.all(group.notifications.map(notification => (
        businessLeadAlertsState.markRead(notification.source_id)
      )))
      return
    }
    if (group?.source === 'saved_search') {
      await Promise.all(group.notifications.map(notification => (
        savedSearchAlertsState.markRead(notification.source_id)
      )))
      return
    }

    if (!user?.id) return

    const readAt = new Date().toISOString()
    setNotifications(rows => rows.filter(row => !ids.includes(row.id)))
    const { error } = await supabase
      .from('app_notifications')
      .update({ read_at:readAt, seen_at:readAt })
      .eq('recipient_id', user.id)
      .in('id', ids)
      .is('read_at', null)

    if (error && import.meta.env.DEV) console.warn('Could not mark notification group as read:', error.message)
  }, [businessLeadAlertsState.markRead, savedSearchAlertsState.markRead, user?.id])

  const markAllRead = useCallback(async () => {
    if (!user?.id || !notifications.length) return

    const readAt = new Date().toISOString()
    setNotifications([])
    const { error } = await supabase
      .from('app_notifications')
      .update({ read_at:readAt, seen_at:readAt })
      .eq('recipient_id', user.id)
      .is('read_at', null)

    if (error && import.meta.env.DEV) console.warn('Could not mark all app notifications as read:', error.message)
  }, [notifications.length, user?.id])

  const persistedAppNotifications = useMemo(() => notifications.map(notification => (
    !notification.seen_at && alertSeenIds.has(`app:${notification.id}`)
      ? { ...notification, seen_at:'persisted' }
      : notification
  )), [alertSeenIds, notifications])
  const externalNotifications = useMemo(() => createExternalNotificationRows({
    zoneAlerts:zoneAlertsState.alertItems,
    businessLeadAlerts:businessLeadAlertsState.alerts,
    savedSearchAlerts:savedSearchAlertsState.alerts,
    getSavedSearchAlertPath:savedSearchAlertsState.getAlertPath,
    seenIds:alertSeenIds,
  }), [
    alertSeenIds,
    businessLeadAlertsState.alerts,
    savedSearchAlertsState.alerts,
    savedSearchAlertsState.getAlertPath,
    zoneAlertsState.alertItems,
  ])
  const groups = useMemo(
    () => groupAppNotifications([...persistedAppNotifications, ...externalNotifications]),
    [externalNotifications, persistedAppNotifications],
  )
  const value = useMemo(() => ({
    available,
    notifications,
    groups,
    unreadCount:notifications.length,
    zoneAlerts:zoneAlertsState,
    businessLeadAlerts:businessLeadAlertsState,
    savedSearchAlerts:savedSearchAlertsState,
    markSeen,
    markGroupRead,
    markAllRead,
  }), [
    available,
    businessLeadAlertsState,
    groups,
    markAllRead,
    markGroupRead,
    markSeen,
    notifications,
    savedSearchAlertsState,
    zoneAlertsState,
  ])

  return <AppNotificationsContext.Provider value={value}>{children}</AppNotificationsContext.Provider>
}

export function useAppNotifications() {
  const context = useContext(AppNotificationsContext)
  if (!context) throw new Error('useAppNotifications must be used within AppNotificationsProvider')
  return context
}
