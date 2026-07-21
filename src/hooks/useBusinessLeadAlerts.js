import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

const POLL_INTERVAL_MS = 45_000

export function useBusinessLeadAlerts() {
  const { user } = useAuth()
  const [alerts, setAlerts] = useState([])

  const load = useCallback(async () => {
    if (!user?.id) {
      setAlerts([])
      return
    }
    const { data, error } = await supabase
      .from('business_lead_alerts')
      .select('id, provider_name, listing_title, listing_city, listing_canton, listing_path, matched_terms, read_at, created_at')
      .eq('notification_status', 'sent')
      .is('read_at', null)
      .order('created_at', { ascending:false })
      .limit(20)
    if (!error) setAlerts(data || [])
  }, [user?.id])

  useEffect(() => {
    load()
    const interval = window.setInterval(load, POLL_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [load])

  const markRead = useCallback(async alertId => {
    setAlerts(current => current.filter(alert => alert.id !== alertId))
    const { error } = await supabase.rpc('mark_business_lead_alert_read', { p_alert_id:alertId })
    if (error) load()
  }, [load])

  const markAllRead = useCallback(async () => {
    const alertIds = alerts.map(alert => alert.id)
    if (!alertIds.length) return

    setAlerts([])
    const results = await Promise.all(
      alertIds.map(alertId => supabase.rpc('mark_business_lead_alert_read', { p_alert_id:alertId }))
    )
    if (results.some(result => result.error)) load()
  }, [alerts, load])

  return {
    alerts,
    unreadCount:alerts.length,
    markRead,
    markAllRead,
  }
}
