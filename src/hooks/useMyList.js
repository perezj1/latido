import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'
import {
  deleteSavedSearch,
  findSavedSearch,
  listSavedSearches,
  markSavedSearchDigestOpened,
  saveSavedSearch,
  SAVED_SEARCHES_CHANGED_EVENT,
  setSavedSearchCompleted,
  updateSavedSearch,
} from '../lib/savedSearches'
import {
  buildMyListDraft,
  listMyListUnreadCounts,
  searchMyListResults,
} from '../lib/myList'

export function useMyList({ loadResults=false } = {}) {
  const { user, isLoggedIn } = useAuth()
  const [items, setItems] = useState([])
  const [resultsById, setResultsById] = useState({})
  const [loading, setLoading] = useState(false)
  const [loadingResults, setLoadingResults] = useState({})
  const [error, setError] = useState('')

  const refresh = useCallback(async ({ silent=false } = {}) => {
    if (!isLoggedIn || !user?.id) {
      setItems([])
      setResultsById({})
      setError('')
      return
    }

    if (!silent) setLoading(true)
    setError('')
    try {
      const [searches, unreadCounts] = await Promise.all([
        listSavedSearches(user.id),
        listMyListUnreadCounts(user.id),
      ])
      setItems(searches.map(search => ({
        ...search,
        unread_count:unreadCounts[search.id] || 0,
      })))
    } catch (nextError) {
      console.warn('Mi lista could not be loaded:', nextError)
      setError('No pudimos cargar Mi lista.')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [isLoggedIn, user?.id])

  useEffect(() => { void refresh() }, [refresh])

  useEffect(() => {
    const onChanged = () => { void refresh({ silent:true }) }
    window.addEventListener(SAVED_SEARCHES_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(SAVED_SEARCHES_CHANGED_EVENT, onChanged)
  }, [refresh])

  useEffect(() => {
    if (!isLoggedIn || !user?.id) return undefined
    const channel = supabase
      .channel(`my-list:${user.id}`)
      .on('postgres_changes', {
        event:'INSERT',
        schema:'public',
        table:'saved_search_matches',
        filter:`user_id=eq.${user.id}`,
      }, () => { void refresh({ silent:true }) })
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [isLoggedIn, refresh, user?.id])

  const loadItemResults = useCallback(async (item, { force=false } = {}) => {
    if (!item?.id || (!force && resultsById[item.id])) return resultsById[item.id] || []
    setLoadingResults(current => ({ ...current, [item.id]:true }))
    try {
      const results = await searchMyListResults(item)
      setResultsById(current => ({ ...current, [item.id]:results }))
      return results
    } catch (nextError) {
      console.warn('Mi lista results could not be loaded:', nextError)
      setResultsById(current => ({ ...current, [item.id]:[] }))
      return []
    } finally {
      setLoadingResults(current => ({ ...current, [item.id]:false }))
    }
  }, [resultsById])

  useEffect(() => {
    if (!loadResults || !isLoggedIn) return
    items.filter(item => item.active && !item.completed_at).forEach(item => {
      if (!resultsById[item.id] && !loadingResults[item.id]) void loadItemResults(item)
    })
  }, [isLoggedIn, items, loadItemResults, loadResults, loadingResults, resultsById])

  const add = useCallback(async phrase => {
    if (!user?.id) throw new Error('Inicia sesión para usar Mi lista.')
    const draft = buildMyListDraft(phrase)
    if (!draft) throw new Error('Escribe al menos dos caracteres.')
    const existing = await findSavedSearch(user.id, draft)
    let saved
    if (existing) {
      await setSavedSearchCompleted(user.id, existing.id, false)
      saved = { ...existing, ...draft, id:existing.id, active:true }
    } else {
      saved = await saveSavedSearch(user.id, draft)
    }
    await refresh({ silent:true })
    const item = { ...saved, completed_at:null, unread_count:0 }
    void loadItemResults(item, { force:true })
    return item
  }, [loadItemResults, refresh, user?.id])

  const complete = useCallback(async (item, completed=true) => {
    if (!user?.id || !item?.id) return
    await setSavedSearchCompleted(user.id, item.id, completed)
    setItems(current => current.map(entry => entry.id === item.id ? {
      ...entry,
      active:!completed,
      completed_at:completed ? new Date().toISOString() : null,
    } : entry))
  }, [user?.id])

  const remove = useCallback(async item => {
    if (!user?.id || !item?.id) return
    await deleteSavedSearch(user.id, item.id)
    setItems(current => current.filter(entry => entry.id !== item.id))
    setResultsById(current => {
      const next = { ...current }
      delete next[item.id]
      return next
    })
  }, [user?.id])

  const rename = useCallback(async (item, phrase) => {
    if (!user?.id || !item?.id) return null
    const draft = buildMyListDraft(phrase)
    if (!draft) throw new Error('Escribe al menos dos caracteres.')
    const updated = await updateSavedSearch(user.id, item.id, draft)
    setItems(current => current.map(entry => entry.id === item.id ? {
      ...entry,
      ...updated,
      completed_at:null,
    } : entry))
    setResultsById(current => {
      const next = { ...current }
      delete next[item.id]
      return next
    })
    const nextItem = { ...item, ...updated, completed_at:null }
    void loadItemResults(nextItem, { force:true })
    return nextItem
  }, [loadItemResults, user?.id])

  const open = useCallback(async item => {
    if (!item?.id) return []
    const results = await loadItemResults(item)
    if (user?.id && item.unread_count > 0) {
      setItems(current => current.map(entry => entry.id === item.id
        ? { ...entry, unread_count:0 }
        : entry))
      void markSavedSearchDigestOpened(item.id, user.id)
    }
    return results
  }, [loadItemResults, user?.id])

  const activeItems = useMemo(
    () => items.filter(item => item.active && !item.completed_at),
    [items],
  )
  const completedItems = useMemo(
    () => items.filter(item => !item.active || item.completed_at),
    [items],
  )
  const unreadCount = activeItems.reduce((sum, item) => sum + (item.unread_count || 0), 0)

  return {
    items,
    activeItems,
    completedItems,
    unreadCount,
    resultsById,
    loadingResults,
    loading,
    error,
    refresh,
    add,
    complete,
    remove,
    rename,
    open,
    isLoggedIn,
    user,
  }
}
