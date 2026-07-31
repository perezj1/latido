import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import {
  SAVED_SEARCHES_CHANGED_EVENT,
  withSearchParam,
} from '../lib/savedSearches'

const MATCH_SELECT = 'id,saved_search_id,user_id,entity_kind,entity_id,search_name,result_title,result_location,result_path,matched_at,read_at,opened_at'

export function useSavedSearchAlerts() {
  const { user, isLoggedIn } = useAuth()
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!isLoggedIn || !user?.id) {
      setAlerts([])
      return
    }

    setLoading(true)
    const { data, error } = await supabase
      .from('saved_search_matches')
      .select(MATCH_SELECT)
      .eq('user_id', user.id)
      .is('read_at', null)
      .order('matched_at', { ascending:false })
      .limit(20)

    if (error) {
      if (!/saved_search_matches|schema cache|does not exist/i.test(error.message || '')) {
        console.warn('Saved search alerts could not be loaded:', error)
      }
    } else {
      setAlerts(data || [])
    }
    setLoading(false)
  }, [isLoggedIn, user?.id])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!isLoggedIn || !user?.id) return undefined

    const channel = supabase
      .channel(`saved-search-alerts:${user.id}`)
      .on(
        'postgres_changes',
        {
          event:'INSERT',
          schema:'public',
          table:'saved_search_matches',
          filter:`user_id=eq.${user.id}`,
        },
        () => { void load() },
      )
      .subscribe()

    const refresh = () => { void load() }
    window.addEventListener(SAVED_SEARCHES_CHANGED_EVENT, refresh)
    return () => {
      window.removeEventListener(SAVED_SEARCHES_CHANGED_EVENT, refresh)
      void supabase.removeChannel(channel)
    }
  }, [isLoggedIn, load, user?.id])

  const markRead = useCallback(async matchId => {
    if (!user?.id || !matchId) return
    setAlerts(current => current.filter(alert => alert.id !== matchId))
    const { error } = await supabase
      .from('saved_search_matches')
      .update({ read_at:new Date().toISOString() })
      .eq('id', matchId)
      .eq('user_id', user.id)

    if (error) {
      console.warn('Saved search alert could not be marked read:', error)
      void load()
    }
  }, [load, user?.id])

  const markAllRead = useCallback(async () => {
    if (!user?.id || !alerts.length) return
    const ids = alerts.map(alert => alert.id)
    setAlerts([])
    const { error } = await supabase
      .from('saved_search_matches')
      .update({ read_at:new Date().toISOString() })
      .eq('user_id', user.id)
      .in('id', ids)

    if (error) {
      console.warn('Saved search alerts could not be marked read:', error)
      void load()
    }
  }, [alerts, load, user?.id])

  const getAlertPath = useCallback(alert => (
    withSearchParam(
      withSearchParam(alert.result_path, 'savedSearch', alert.saved_search_id),
      'savedMatch',
      alert.id,
    )
  ), [])

  return {
    alerts,
    unreadCount:alerts.length,
    loading,
    markRead,
    markAllRead,
    getAlertPath,
    refresh:load,
  }
}
