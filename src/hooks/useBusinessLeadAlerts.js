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
    const { error } = await supabase.rpc('mark_business_lead_alert_read', { p_alert_id:alertId })
    if (!error) setAlerts(current => current.map(alert => alert.id === alertId ? { ...alert, read_at:alert.read_at || new Date().toISOString() } : alert))
  }, [])

  return {
    alerts,
    unreadCount:alerts.filter(alert => !alert.read_at).length,
    markRead,
  }
}
