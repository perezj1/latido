import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const SETTINGS_KEY = 'latido_alerts'
const LAST_CHECK_KEY = 'latido_alerts_last_check'

function loadSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') } catch { return {} }
}

export function dismissZoneAlerts() {
  localStorage.setItem(LAST_CHECK_KEY, new Date().toISOString())
}

export function useZoneAlerts() {
  const [alertCount, setAlertCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function check() {
      const settings = loadSettings()
      if (!settings.enabled || !settings.canton) { setAlertCount(0); return }

      const lastCheck = localStorage.getItem(LAST_CHECK_KEY)

      let q = supabase
        .from('ads')
        .select('id', { count: 'exact', head: true })
        .ilike('canton', `%${settings.canton}%`)
        .or('active.is.null,active.eq.true')

      if (lastCheck) q = q.gt('created_at', lastCheck)

      if (settings.categories?.length) {
        q = q.in('cat', settings.categories)
      }

      const { count } = await q
      if (!cancelled) setAlertCount(count || 0)
    }

    check()
    const interval = setInterval(check, 60_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  return { alertCount }
}
