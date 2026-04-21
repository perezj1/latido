import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

const SETTINGS_KEY = 'latido_alerts'
const LAST_CHECK_KEY = 'latido_alerts_last_check'
const DISMISSED_EVENT = 'latido_alerts_dismissed'
const UPDATED_EVENT = 'latido_alerts_updated'
const MAX_ALERTS = 20

const ALERT_SOURCES = [
  {
    kind: 'ad',
    table: 'listings',
    select: 'id, title, cat, canton, created_at, active',
    channelPrefix: 'zone-alert-ads',
  },
  {
    kind: 'job',
    table: 'jobs',
    select: 'id, title, company, canton, created_at, active',
    channelPrefix: 'zone-alert-jobs',
  },
  {
    kind: 'business',
    table: 'providers',
    select: 'id, name, category, canton, city, created_at, active',
    channelPrefix: 'zone-alert-businesses',
  },
  {
    kind: 'event',
    table: 'events',
    select: 'id, title, type, canton, city, created_at, active',
    channelPrefix: 'zone-alert-events',
  },
]

function loadSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') } catch { return {} }
}

function dispatchZoneAlertEvent(name) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(name))
}

function sortAlertItems(items) {
  return [...items].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
}

function dedupeAlertItems(items) {
  const seen = new Map()
  items.forEach(item => {
    if (!item?.key) return
    if (!seen.has(item.key)) seen.set(item.key, item)
  })
  return [...seen.values()]
}

function mergeAlertItems(previous, incoming) {
  return sortAlertItems(dedupeAlertItems([...incoming, ...previous])).slice(0, MAX_ALERTS)
}

function normalizeAlertItem(kind, row) {
  if (kind === 'ad') {
    return {
      key: `ad:${row.id}`,
      id: row.id,
      kind,
      title: row.title || 'Nuevo anuncio',
      category: row.cat || 'servicios',
      kindLabel: 'Tablón',
      meta: `${row.cat || 'anuncio'} · ${row.canton || ''}`.trim(),
      href: `/tablon?openAd=${encodeURIComponent(row.id)}`,
      icon: '📌',
      canton: row.canton || '',
      createdAt: row.created_at || '',
    }
  }

  if (kind === 'job') {
    return {
      key: `job:${row.id}`,
      id: row.id,
      kind,
      title: row.title || row.company || 'Nuevo empleo',
      category: 'empleo',
      kindLabel: 'Empleo',
      meta: `empleo · ${row.canton || ''}`.trim(),
      href: `/tablon?cat=empleo&openJob=${encodeURIComponent(row.id)}`,
      icon: '💼',
      canton: row.canton || '',
      createdAt: row.created_at || '',
    }
  }

  if (kind === 'event') {
    return {
      key: `event:${row.id}`,
      id: row.id,
      kind,
      title: row.title || 'Nuevo evento',
      category: null,
      kindLabel: 'Evento',
      meta: `evento · ${row.canton || row.city || ''}`.trim(),
      href: `/comunidades?view=eventos&openEvent=${encodeURIComponent(row.id)}`,
      icon: '🎉',
      canton: row.canton || '',
      createdAt: row.created_at || '',
    }
  }

  return {
    key: `business:${row.id}`,
    id: row.id,
    kind: 'business',
    title: row.name || 'Nuevo negocio',
    category: 'servicios',
    kindLabel: 'Negocio',
    meta: `negocio · ${row.canton || row.city || ''}`.trim(),
    href: `/comunidades?view=negocios&openBusiness=${encodeURIComponent(row.id)}`,
    icon: '🏪',
    canton: row.canton || '',
    createdAt: row.created_at || '',
  }
}

function shouldTrackKind(settings, kind) {
  const categories = settings.categories || []
  if (!categories.length) return true
  if (kind === 'ad') return true
  if (kind === 'job') return categories.includes('empleo')
  if (kind === 'business') return categories.includes('servicios')
  if (kind === 'event') return false
  return false
}

function matchesSettings(row, kind, settings, lastCheck) {
  if (!settings.enabled || !settings.canton) return false
  if ((row.canton || '') !== settings.canton) return false
  if (row.active === false) return false
  if (lastCheck && row.created_at && row.created_at <= lastCheck) return false

  const categories = settings.categories || []
  if (!categories.length) return true

  if (kind === 'ad') return categories.includes(row.cat)
  if (kind === 'job') return categories.includes('empleo')
  if (kind === 'business') return categories.includes('servicios')
  if (kind === 'event') return false

  return false
}

async function fetchAlertsForSource(source, settings, lastCheck) {
  if (!shouldTrackKind(settings, source.kind)) return []

  let query = supabase
    .from(source.table)
    .select(source.select)
    .eq('canton', settings.canton)
    .or('active.is.null,active.eq.true')
    .order('created_at', { ascending: false })
    .limit(MAX_ALERTS)

  if (lastCheck) query = query.gt('created_at', lastCheck)
  if (source.kind === 'ad' && settings.categories?.length) query = query.in('cat', settings.categories)

  const { data, error } = await query
  if (error) return []

  return (data || [])
    .filter(row => matchesSettings(row, source.kind, settings, lastCheck))
    .map(row => normalizeAlertItem(source.kind, row))
}

export function notifyZoneAlertsUpdated() {
  dispatchZoneAlertEvent(UPDATED_EVENT)
}

export function dismissZoneAlerts() {
  localStorage.setItem(LAST_CHECK_KEY, new Date().toISOString())
  dispatchZoneAlertEvent(DISMISSED_EVENT)
}

export function useZoneAlerts() {
  const { userCanton } = useAuth()
  const [alertItems, setAlertItems] = useState([])
  const cancelRef = useRef(false)
  const channelsRef = useRef([])
  const channelScopeRef = useRef(Math.random().toString(36).slice(2, 10))
  const [settingsVersion, setSettingsVersion] = useState(0)

  useEffect(() => {
    function onUpdated() {
      setSettingsVersion(version => version + 1)
    }

    function onStorage(event) {
      if (event.key === SETTINGS_KEY || event.key === LAST_CHECK_KEY) onUpdated()
    }

    window.addEventListener(UPDATED_EVENT, onUpdated)
    window.addEventListener('storage', onStorage)

    return () => {
      window.removeEventListener(UPDATED_EVENT, onUpdated)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  useEffect(() => {
    cancelRef.current = false

    async function check() {
      const settings = loadSettings()
      const effectiveSettings = { ...settings, canton: settings.canton || userCanton || '' }
      if (!effectiveSettings.enabled || !effectiveSettings.canton) {
        if (!cancelRef.current) setAlertItems([])
        return
      }

      const lastCheck = localStorage.getItem(LAST_CHECK_KEY)
      const results = await Promise.all(
        ALERT_SOURCES.map(source => fetchAlertsForSource(source, effectiveSettings, lastCheck))
      )

      if (!cancelRef.current) {
        setAlertItems(sortAlertItems(dedupeAlertItems(results.flat())).slice(0, MAX_ALERTS))
      }
    }

    function clearChannels() {
      channelsRef.current.forEach(channel => supabase.removeChannel(channel))
      channelsRef.current = []
    }

    function subscribeToRealtime() {
      clearChannels()

      const settings = loadSettings()
      const effectiveSettings = { ...settings, canton: settings.canton || userCanton || '' }
      if (!effectiveSettings.enabled || !effectiveSettings.canton) return

      ALERT_SOURCES
        .filter(source => shouldTrackKind(effectiveSettings, source.kind))
        .forEach(source => {
          const channel = supabase
            .channel(`${source.channelPrefix}-${effectiveSettings.canton}-${channelScopeRef.current}`)
            .on('postgres_changes', {
              event: 'INSERT',
              schema: 'public',
              table: source.table,
              filter: `canton=eq.${effectiveSettings.canton}`,
            }, payload => {
              const lastCheck = localStorage.getItem(LAST_CHECK_KEY)
              const latestSettings = loadSettings()
              const latestEffectiveSettings = { ...latestSettings, canton: latestSettings.canton || userCanton || '' }
              if (!matchesSettings(payload.new, source.kind, latestEffectiveSettings, lastCheck)) return
              const nextItem = normalizeAlertItem(source.kind, payload.new)
              setAlertItems(prev => mergeAlertItems(prev, [nextItem]))
            })
            .subscribe()

          channelsRef.current.push(channel)
        })
    }

    check()
    subscribeToRealtime()

    const interval = setInterval(check, 60_000)

    function onDismiss() {
      setAlertItems([])
    }

    window.addEventListener(DISMISSED_EVENT, onDismiss)

    return () => {
      cancelRef.current = true
      clearInterval(interval)
      window.removeEventListener(DISMISSED_EVENT, onDismiss)
      clearChannels()
    }
  }, [settingsVersion, userCanton])

  return { alertItems, alertCount: alertItems.length }
}
