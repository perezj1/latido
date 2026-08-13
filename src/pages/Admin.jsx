import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { C, PP } from '../lib/theme'
import { Btn, Tag } from '../components/UI'
import { REPORT_REASONS } from '../lib/reports'
import { BUSINESS_VERIFICATION_STATUSES, calculateBusinessVerification, getBusinessVerificationStatus } from '../lib/businessVerification'
import { getMissingColumnName } from '../lib/supabaseCompat'
import { subscribeToOnlineUsers, subscribeToPresenceStatus } from '../lib/presence'
import { isAdminEmail } from '../lib/admin'
import {
  formatPromotionEndDate,
  getBusinessPromotionMeta,
  getEffectiveBusinessPromotionPlan,
  mergeBusinessPromotionPlans,
} from '../lib/businessPromotion'
import {
  getPartnerPlacementMeta,
  isPartnerOutboundAnalyticsEvent,
  PARTNER_ANALYTICS_PARTNERS,
  resolvePartnerAnalyticsId,
} from '../lib/partnerAnalytics'
import { INTEREST_OPTIONS, normalizeInterestIds } from '../lib/interests'
import { CREATOR_PLATFORMS, CREATOR_TOPICS } from '../lib/creators'

const STATUS_LABELS = {
  pending: 'Pendiente',
  reviewed: 'Revisado',
  actioned: 'Accionado',
  approved: 'Aprobado',
  rejected: 'Eliminado',
}

const BUSINESS_VERIFICATION_FILTERS = [
  { id: 'pending', label: 'Pendientes', color: '#D97706', bg: '#FFFBEB' },
  { id: 'unverified', label: 'No verificadas', color: C.primary, bg: C.primaryLight },
  { id: 'verified', label: 'Verificadas', color: '#059669', bg: '#ECFDF5' },
  { id: 'rejected', label: 'Rechazados', color: '#DC2626', bg: '#FEF2F2' },
]

const BUSINESS_VERIFICATION_ACTIONS = [
  { id: 'pending', label: 'Pendiente', color: C.primary, bg: C.primaryLight },
  { id: 'verified', label: 'Verificada', color: '#065F46', bg: '#D1FAE5' },
  { id: 'unverified', label: 'No verificada', color: C.primary, bg: C.primaryLight },
  { id: 'rejected', label: 'Rechazado', color: '#B91C1C', bg: '#FEE2E2' },
]
const OPTIONAL_PROVIDER_VERIFICATION_COLUMNS = new Set([
  'verification_status',
  'verification_score',
  'verified_at',
  'verified_by',
  'verification_notes',
])
const ADMIN_QUERY_PAGE_SIZE = 500
const ADMIN_LIST_PAGE_SIZE = 40
const ADMIN_ACTIVITY_RETENTION_DAYS = 60
const ADMIN_MAX_DELTA_DAYS = 70
const ADMIN_DELTA_CONCURRENCY = 2
const ADMIN_DELTA_REFRESH_RECENT_DAYS = 2
const ADMIN_PERIOD_OPTIONS = [1, 7, 30]
const PARTNER_MONTH_PERIOD_OPTIONS = [
  { value: 'current', label: 'Mes actual' },
  { value: 'previous', label: 'Mes pasado' },
]
const ADMIN_ANALYTICS_EVENT_TYPES = [
  'page_view',
  'search',
  'search_result_open',
  'search_solution_action',
  'search_resolution',
  'search_resolution_reason',
  'partner_card_impression',
  'partner_outbound_click',
  'partner_page_view',
  'partner_service_click',
  'partner_cross_click',
  'partner_promo_open',
  'partner_page_redirect',
]
const PARTNER_METRICS_EXCLUDED_EMAILS = new Set(['test@g.com'])
const ADMIN_TAB_DATA_GROUPS = {
  users: ['users'],
  analytics: ['users', 'analytics'],
  feedback: ['users', 'feedback'],
  partners: ['users', 'businesses', 'analytics'],
  live: ['users', 'analytics'],
  overview: ['users', 'reports', 'moderation', 'contentMetrics', 'businesses', 'analytics', 'messages', 'creators'],
  businessVerification: ['businesses'],
  content: ['content'],
  reports: ['users', 'reports'],
  moderation: ['users', 'moderation'],
  creators: ['users', 'creators'],
}

const CREATOR_REVIEW_META = {
  pending: { label: 'Pendiente', color: '#B45309', bg: '#FFFBEB' },
  approved: { label: 'Aprobado', color: '#047857', bg: '#ECFDF5' },
  rejected: { label: 'Rechazado', color: '#B91C1C', bg: '#FEF2F2' },
}

const CREATOR_SORT_OPTIONS = [
  { id: 'views', label: 'Más vistas de perfil' },
  { id: 'clicks', label: 'Más clics en contenido' },
  { id: 'helpful', label: 'Más votos de útil' },
  { id: 'saved', label: 'Más guardados' },
  { id: 'contents', label: 'Más contenidos' },
  { id: 'ctr', label: 'Mejor CTR' },
  { id: 'recent', label: 'Alta más reciente' },
  { id: 'name', label: 'Nombre (A-Z)' },
]

const CREATOR_METRIC_KEYS = ['profile_view', 'content_impression', 'content_click', 'content_share', 'social_click']

function getAdminTabDataGroups(tab) {
  return ADMIN_TAB_DATA_GROUPS[tab] || ['users']
}

function isPartnerMetricsExcludedEmail(email) {
  return PARTNER_METRICS_EXCLUDED_EMAILS.has(String(email || '').trim().toLowerCase())
}

function getBusinessPartnerAnalyticsId(providerId) {
  return `business:${providerId}`
}

function isBusinessPartnerAnalyticsId(value) {
  return String(value || '').startsWith('business:')
}

function isActiveBusinessPartner(business) {
  if (!['basic', 'premium'].includes(business?.promotion_plan)) return false
  if (business?.active === false) return false

  const startsAt = business?.promotion_starts_at ? new Date(business.promotion_starts_at).getTime() : 0
  const endsAt = business?.promotion_ends_at ? new Date(business.promotion_ends_at).getTime() : 0
  const now = Date.now()

  return startsAt <= now && endsAt > now
}

function businessPartnerColor(planKey) {
  return planKey === 'premium' ? '#EF3340' : C.primary
}

function businessPartnerTint(planKey) {
  return planKey === 'premium' ? '#FFF1F2' : C.primaryLight
}

function isPartnerClickAnalyticsEvent(event, partner) {
  if (partner?.isBusinessPartner) {
    return ['partner_outbound_click', 'partner_service_click'].includes(event?.event_type)
  }

  return isPartnerOutboundAnalyticsEvent(event, event.partnerMetadata)
}

async function fetchAllAdminRows({
  table,
  columns = '*',
  orderColumn = 'created_at',
  ascending = false,
  since = '',
  // Tables with a composite primary key (creator_metrics) need a different
  // tiebreaker so the keyset pagination stays deterministic.
  idColumn = 'id',
  transformQuery,
}) {
  const rows = []
  let offset = 0

  while (true) {
    let query = supabase
      .from(table)
      .select(columns)

    if (since) query = query.gte(orderColumn, since)
    if (transformQuery) query = transformQuery(query)
    query = query
      .order(orderColumn, { ascending })
      .order(idColumn, { ascending: true })
      .range(offset, offset + ADMIN_QUERY_PAGE_SIZE - 1)

    const response = await query
    if (response.error) return { data: rows, count: rows.length, error: response.error }

    const page = response.data || []
    rows.push(...page)

    if (page.length < ADMIN_QUERY_PAGE_SIZE) break
    offset += page.length
  }

  return { data: rows, count: rows.length, error: null }
}

function getAdminDayRanges(days = 30) {
  const safeDays = Math.max(1, Math.min(Number(days) || 1, ADMIN_MAX_DELTA_DAYS))
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return Array.from({ length: safeDays }, (_, index) => {
    const start = new Date(today)
    start.setDate(today.getDate() - (safeDays - 1 - index))
    const end = new Date(start)
    end.setDate(start.getDate() + 1)

    return {
      key: localDateKey(start),
      start:start.toISOString(),
      end:end.toISOString(),
    }
  })
}

function mergeRowsById(rows = []) {
  const byId = new Map()
  rows.forEach(row => {
    const key = row?.id || `${row?.created_at || ''}:${JSON.stringify(row)}`
    if (key) byId.set(key, row)
  })
  return [...byId.values()]
}

async function fetchAdminRowsByDayDelta({
  cache,
  cacheKey,
  table,
  columns = '*',
  orderColumn = 'created_at',
  days = 30,
  refreshRecent = false,
  transformQuery,
}) {
  const ranges = getAdminDayRanges(days)
  const missing = ranges.filter((range, index) => {
    const key = `${cacheKey}:${range.key}`
    const shouldRefresh = refreshRecent && index >= ranges.length - ADMIN_DELTA_REFRESH_RECENT_DAYS
    return shouldRefresh || !cache.has(key)
  })

  for (let index = 0; index < missing.length; index += ADMIN_DELTA_CONCURRENCY) {
    const chunk = missing.slice(index, index + ADMIN_DELTA_CONCURRENCY)
    await Promise.all(chunk.map(async range => {
      const response = await fetchAllAdminRows({
        table,
        columns,
        orderColumn,
        ascending:false,
        transformQuery: query => {
          const scoped = query.gte(orderColumn, range.start).lt(orderColumn, range.end)
          return transformQuery ? transformQuery(scoped) : scoped
        },
      })
      cache.set(`${cacheKey}:${range.key}`, {
        ...response,
        fetchedAt:new Date().toISOString(),
      })
    }))
  }

  const selected = ranges.map(range => cache.get(`${cacheKey}:${range.key}`)).filter(Boolean)
  const firstError = selected.find(item => item.error)?.error || null
  return {
    data: mergeRowsById(selected.flatMap(item => item.data || []))
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))),
    count: selected.reduce((sum, item) => sum + (item.count || item.data?.length || 0), 0),
    error:firstError,
    delta:{
      days:ranges.length,
      cached:ranges.length - missing.length,
      fetched:missing.length,
    },
  }
}

async function fetchAdminReportsDelta({ cache, days, refreshRecent }) {
  const [pendingRes, recentRes] = await Promise.all([
    fetchAllAdminRows({
      table:'reports',
      transformQuery: query => query.eq('status', 'pending'),
    }),
    fetchAdminRowsByDayDelta({
      cache,
      cacheKey:'reports:recent',
      table:'reports',
      days,
      refreshRecent,
    }),
  ])

  return {
    data: mergeRowsById([...(pendingRes.data || []), ...(recentRes.data || [])])
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))),
    count:(pendingRes.count || 0) + (recentRes.count || 0),
    error:pendingRes.error || recentRes.error,
    delta:recentRes.delta,
  }
}

async function fetchAdminRowsByIds(table, columns, ids) {
  const uniqueIds = [...new Set(ids.filter(Boolean))]
  if (!uniqueIds.length) return { data: [], error: null }

  const rows = []
  for (let index = 0; index < uniqueIds.length; index += 200) {
    const response = await supabase
      .from(table)
      .select(columns)
      .in('id', uniqueIds.slice(index, index + 200))
    if (response.error) return { data: rows, error: response.error }
    rows.push(...(response.data || []))
  }
  return { data: rows, error: null }
}

async function fetchAdminContentForItems(items = []) {
  const idsFor = type => {
    const ids = []
    for (const item of items) {
      if (type.includes(item.content_type)) ids.push(item.content_id)
    }
    return ids
  }

  const [
    listings,
    jobs,
    messages,
    profiles,
    events,
    providers,
    communities,
    creatorProfiles,
    creatorContents,
  ] = await Promise.all([
    fetchAdminRowsByIds('listings', 'id,title,desc,cat,sub,active,user_id,user_name,canton,city,created_at', idsFor(['listing'])),
    fetchAdminRowsByIds('jobs', 'id,title,company,desc,sector,active,user_id,canton,city,created_at', idsFor(['job'])),
    fetchAdminRowsByIds('messages', 'id,conversation_id,sender_id,body,created_at', idsFor(['message'])),
    fetchAdminRowsByIds('profiles', 'id,name,email,canton,banned,banned_reason,created_at,last_seen_at', idsFor(['profile'])),
    fetchAdminRowsByIds('events', '*', idsFor(['event'])),
    fetchAdminRowsByIds('providers', '*', idsFor(['provider', 'business'])),
    fetchAdminRowsByIds('communities', '*', idsFor(['community'])),
    fetchAdminRowsByIds('creator_profiles', 'id,owner_id,name,handle,tagline,status,active,created_at', idsFor(['creator_profile'])),
    fetchAdminRowsByIds('creator_contents', 'id,creator_id,title,summary,url,status,active,created_at', idsFor(['creator_content'])),
  ])

  const entries = []
  ;(listings.data || []).forEach(item => entries.push([`listing:${item.id}`, item]))
  ;(jobs.data || []).forEach(item => entries.push([`job:${item.id}`, item]))
  ;(messages.data || []).forEach(item => entries.push([`message:${item.id}`, item]))
  ;(profiles.data || []).forEach(item => entries.push([`profile:${item.id}`, item]))
  ;(events.data || []).forEach(item => entries.push([`event:${item.id}`, item]))
  ;(providers.data || []).forEach(item => {
    entries.push([`provider:${item.id}`, item])
    entries.push([`business:${item.id}`, item])
  })
  ;(communities.data || []).forEach(item => entries.push([`community:${item.id}`, item]))
  ;(creatorProfiles.data || []).forEach(item => entries.push([`creator_profile:${item.id}`, item]))
  ;(creatorContents.data || []).forEach(item => entries.push([`creator_content:${item.id}`, item]))

  const errors = []
  for (const [label, response] of [
    ['anuncios relacionados', listings],
    ['empleos relacionados', jobs],
    ['mensajes relacionados', messages],
    ['perfiles relacionados', profiles],
    ['eventos relacionados', events],
    ['negocios relacionados', providers],
    ['comunidades relacionadas', communities],
    ['perfiles de creadores relacionados', creatorProfiles],
    ['contenidos de creadores relacionados', creatorContents],
  ]) {
    if (response.error) errors.push(`${label}: ${response.error.message}`)
  }

  return { entries, errors }
}

function countUniqueByDay(items, days, identityFn) {
  const buckets = new Map(countByDay([], days).map(item => [item.date, new Set()]))
  items.forEach(item => {
    const key = localDateKey(item.created_at)
    const identity = identityFn(item)
    if (identity && buckets.has(key)) buckets.get(key).add(identity)
  })
  return [...buckets.entries()].map(([date, identities]) => ({ date, count: identities.size }))
}

function uniquePeriodTrend(items, days, identityFn) {
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  const currentStart = new Date(today)
  currentStart.setDate(currentStart.getDate() - (days - 1))
  currentStart.setHours(0, 0, 0, 0)
  const previousStart = new Date(currentStart)
  previousStart.setDate(previousStart.getDate() - days)
  const previousEnd = new Date(currentStart.getTime() - 1)
  const current = new Set()
  const previous = new Set()

  items.forEach(item => {
    const date = new Date(item.created_at)
    const identity = identityFn(item)
    if (!identity || Number.isNaN(date.getTime())) return
    if (date >= currentStart && date <= today) current.add(identity)
    else if (date >= previousStart && date <= previousEnd) previous.add(identity)
  })

  if (!previous.size) return current.size ? 100 : 0
  return Math.round(((current.size - previous.size) / previous.size) * 100)
}

function paginate(items, page, pageSize = ADMIN_LIST_PAGE_SIZE) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  const safePage = Math.min(Math.max(1, page), pageCount)
  const start = (safePage - 1) * pageSize
  return {
    page: safePage,
    pageCount,
    items: items.slice(start, start + pageSize),
  }
}

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => (
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false
  ))

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined
    const list = window.matchMedia(query)
    const handleChange = event => setMatches(event.matches)
    setMatches(list.matches)
    list.addEventListener('change', handleChange)
    return () => list.removeEventListener('change', handleChange)
  }, [query])

  return matches
}

const ADMIN_NUMBER_FORMATTER = new Intl.NumberFormat('es-ES')

function fmtNumber(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return value ?? '—'
  return ADMIN_NUMBER_FORMATTER.format(number)
}

function percentOf(value, total) {
  const base = Number(total) || 0
  if (!base) return 0
  return Math.round((Number(value) || 0) / base * 100)
}

function ratePerItem(value, total, decimals = 1) {
  const base = Number(total) || 0
  if (!base) return 0
  return Number(((Number(value) || 0) / base).toFixed(decimals))
}

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value)
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

// Excel in Spanish locales expects `;` as the separator and a BOM for accents.
function downloadCsv(filename, columns, rows) {
  const lines = [columns.map(column => csvCell(column.label)).join(';')]
  for (const row of rows) {
    lines.push(columns.map(column => csvCell(column.value(row))).join(';'))
  }

  const blob = new Blob([`﻿${lines.join('\r\n')}`], { type:'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function creatorTopicMeta(topicId) {
  return CREATOR_TOPICS.find(topic => topic.id === topicId)
    || { id:topicId, label:topicId || 'Sin tema', emoji:'📣', color:C.mid, bg:C.bg }
}

function creatorPlatformMeta(platformId) {
  return CREATOR_PLATFORMS.find(platform => platform.id === platformId)
    || { id:platformId, label:platformId || 'Otra', short:'—', color:C.mid, bg:C.bg }
}

function creatorStatusMeta(creator) {
  if (creator?.active === false) return { label:'Inactivo', color:'#B91C1C', bg:'#FEF2F2' }
  if (creator?.status !== 'published') return { label:'Borrador', color:'#B45309', bg:'#FFFBEB' }
  return { label:'Publicado', color:'#047857', bg:'#ECFDF5' }
}

const MODERATED_CONTENT_TABLES = {
  listing: 'listings',
  job: 'jobs',
  event: 'events',
  provider: 'providers',
  business: 'providers',
  community: 'communities',
  creator_profile: 'creator_profiles',
  creator_content: 'creator_contents',
}

function canToggleContent(type) {
  return Boolean(MODERATED_CONTENT_TABLES[type])
}

function reasonLabel(id) {
  return REPORT_REASONS.find(r => r.id === id)?.label || id || 'Sin motivo'
}

function fmtDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleString('es-ES', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function fmtDateShort(value) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtActivity(value) {
  if (!value) return 'Sin actividad'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin actividad'
  const diff = Date.now() - date.getTime()
  if (diff < 60_000) return 'Ahora'
  if (diff < 3_600_000) return `Hace ${Math.max(1, Math.floor(diff / 60_000))} min`
  if (diff < 86_400_000) return `Hace ${Math.floor(diff / 3_600_000)} h`
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

const SWISS_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Zurich',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function swissDateKey(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return SWISS_DATE_FORMATTER.format(date)
}

function isWithinRecentDays(value, days) {
  if (!value) return false
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return false
  if (days === 1) return swissDateKey(date) === swissDateKey(new Date())

  const start = new Date()
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - (days - 1))
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  return date >= start && date <= end
}

function countRecent(items, days) {
  return items.filter(item => isWithinRecentDays(item.created_at, days)).length
}

function localDateKey(value) {
  return swissDateKey(value)
}

function countByDay(items, days = 30) {
  const counts = {}
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    counts[localDateKey(d)] = 0
  }
  items.forEach(item => {
    const key = localDateKey(item.created_at)
    if (key in counts) counts[key]++
  })
  return Object.entries(counts).map(([date, count]) => ({ date, count }))
}

function calendarMonthRange(period = 'current') {
  const now = new Date()
  const offset = period === 'previous' ? -1 : 0
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const endExclusive = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1)
  const endInclusive = new Date(endExclusive.getTime() - 1)
  const monthLabel = start.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  const shortLabel = start.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })

  return {
    period,
    start,
    endExclusive,
    endInclusive,
    monthLabel,
    shortLabel,
    startLabel:start.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    endLabel:endInclusive.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }),
  }
}

function isWithinDateRange(value, range) {
  if (!value || !range) return false
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return false
  return date >= range.start && date < range.endExclusive
}

function countByDateRange(items, range) {
  if (!range) return []
  const counts = {}
  const cursor = new Date(range.start)

  while (cursor < range.endExclusive) {
    counts[localDateKey(cursor)] = 0
    cursor.setDate(cursor.getDate() + 1)
  }

  items.forEach(item => {
    const key = localDateKey(item.created_at)
    if (key in counts) counts[key] += 1
  })

  return Object.entries(counts).map(([date, count]) => ({ date, count }))
}

function getPartnerMonthlyLoadDays() {
  const previousMonth = calendarMonthRange('previous')
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let days = 0
  const cursor = new Date(previousMonth.start)
  while (cursor <= today) {
    days += 1
    cursor.setDate(cursor.getDate() + 1)
  }

  return Math.max(1, days)
}

function periodTrend(items, days) {
  const full = countByDay(items, days * 2)
  const cur  = full.slice(-days).reduce((s, d) => s + d.count, 0)
  const prev = full.slice(0, days).reduce((s, d) => s + d.count, 0)
  if (prev === 0) return cur > 0 ? 100 : 0
  return Math.round(((cur - prev) / prev) * 100)
}

function scoreByTarget(value, target, maxScore) {
  if (!target || target <= 0) return 0
  return Math.min(maxScore, Math.round((Math.max(0, value) / target) * maxScore))
}

function averageTrend(values) {
  const valid = values.filter(value => Number.isFinite(value))
  if (!valid.length) return 0
  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length)
}

function averageMetricValue(items, key) {
  const values = items
    .map(item => Number(item?.[key]))
    .filter(value => Number.isFinite(value))
  if (!values.length) return 0
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1))
}

function feedbackPercentage(value, total) {
  return total ? Math.round((value / total) * 100) : 0
}

function ratingFeedbackTone(rating) {
  const values = [rating?.overall_rating, rating?.usefulness_rating]
    .map(Number)
    .filter(value => Number.isFinite(value) && value >= 1)
  if (!values.length) return 'partial'
  const average = values.reduce((sum, value) => sum + value, 0) / values.length
  if (average >= 4) return 'positive'
  if (average < 3) return 'negative'
  return 'partial'
}

function feedbackToneMatches(filter, tone, hasComment = false) {
  if (filter === 'all') return true
  if (filter === 'comments') return hasComment
  return filter === tone
}

function feedbackSearchMatches(query, ...values) {
  if (!query) return true
  return values.some(value => String(value || '').toLocaleLowerCase('es').includes(query))
}

function formatFeedbackDuration(value) {
  const milliseconds = Number(value)
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return 'Sin tiempo registrado'
  const seconds = Math.round(milliseconds / 1000)
  if (seconds < 60) return `${seconds} s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes < 60) return remainingSeconds ? `${minutes} min ${remainingSeconds} s` : `${minutes} min`
  const hours = Math.floor(minutes / 60)
  return `${hours} h ${minutes % 60} min`
}

function humanizeFeedbackValue(value) {
  const clean = String(value || '').trim()
  if (!clean) return ''
  return clean
    .replace(/[_-]+/g, ' ')
    .replace(/^./, character => character.toUpperCase())
}

function readMetadata(value) {
  if (!value) return {}
  if (typeof value === 'object') return value
  try { return JSON.parse(value) } catch { return {} }
}

function pageLabel(path = '') {
  const clean = String(path || '/').split('?')[0]
  if (clean === '/') return 'Inicio'
  if (clean.startsWith('/tablon')) return 'Anuncios'
  if (clean.startsWith('/anuncios/')) return 'Detalle de anuncio'
  if (clean.startsWith('/empleos/')) return 'Detalle de empleo'
  if (clean.startsWith('/comunidades')) return 'Comunidad'
  if (clean.startsWith('/negocios/')) return 'Perfil de negocio'
  if (clean.startsWith('/eventos/')) return 'Evento'
  if (clean.startsWith('/mensajes')) return 'Mensajes'
  if (clean.startsWith('/perfil')) return 'Perfil'
  if (clean.startsWith('/publicar-empleo')) return 'Publicar empleo'
  if (clean.startsWith('/publicar-evento')) return 'Publicar evento'
  if (clean.startsWith('/registrar-negocio')) return 'Registrar negocio'
  if (clean.startsWith('/registrar-comunidad')) return 'Registrar grupo'
  if (clean.startsWith('/publicar')) return 'Publicar anuncio'
  if (clean.startsWith('/guias')) return 'Guías'
  if (clean.startsWith('/auth')) return 'Acceso'
  if (clean.startsWith('/admin-latido')) return 'Admin'
  return clean
}

function topAnalyticsRows(items, labelFn, limit = 8, subFn) {
  const map = new Map()
  items.forEach(item => {
    const label = String(labelFn(item) || '').trim()
    if (!label) return
    const current = map.get(label) || { label, value: 0, sub: '' }
    current.value += 1
    if (!current.sub && subFn) current.sub = subFn(item) || ''
    map.set(label, current)
  })
  return [...map.values()].sort((a, b) => b.value - a.value).slice(0, limit)
}

function analyticsQuery(event) {
  const metadata = readMetadata(event.metadata)
  return String(metadata.query || '').trim()
}

function analyticsSearchAttemptKey(event) {
  const metadata = readMetadata(event.metadata)
  const attemptId = String(metadata.search_attempt_id || '').trim()
  if (attemptId) return `attempt:${attemptId}`

  const identity = event.session_id || event.user_id || ''
  const query = analyticsQuery(event).toLowerCase()
  return identity && query ? `legacy:${identity}:${query}` : ''
}

const SEARCH_RESOLUTION_ANSWER_LABELS = {
  yes:'Resuelta',
  partial:'Parcial',
  no:'No resuelta',
}

const SEARCH_RESOLUTION_REASON_LABELS = {
  more_information:'Más información',
  different_location:'Otra ubicación',
  clearer_price:'Precio más claro',
  more_options:'Más alternativas',
  other:'Otro motivo',
}

const SEARCH_RESOLUTION_ANSWER_META = {
  yes:{ label:'Sí', color:'#047857', bg:'#ECFDF5' },
  partial:{ label:'Parcialmente', color:'#B45309', bg:'#FFFBEB' },
  no:{ label:'No', color:'#B91C1C', bg:'#FEF2F2' },
}

const LATIDO_USEFULNESS_ANSWER_META = {
  yes:{ label:'Sí', color:'#047857', bg:'#ECFDF5' },
  partial:{ label:'Parcialmente', color:'#B45309', bg:'#FFFBEB' },
  no:{ label:'No mucho', color:'#B91C1C', bg:'#FEF2F2' },
}

const LATIDO_USEFULNESS_DETAIL_LABELS = {
  jobs:'Empleo',
  housing:'Vivienda',
  businesses:'Negocios y servicios',
  events:'Eventos',
  community:'Comunidad',
  found_what_needed:'Encontró lo que buscaba',
  contacted_someone:'Contactó con alguien',
  discovered_nearby:'Descubrió algo cerca',
  published_got_responses:'Publicó y recibió respuestas',
  found_useful_information:'Encontró información útil',
  connected_with_community:'Conectó con la comunidad',
  more_offers:'Más ofertas',
  clearer_information:'Información más clara',
  more_relevant_results:'Resultados más relevantes',
  more_nearby_content:'Más contenido cerca de mí',
  better_filters:'Mejores filtros',
  new_content_alerts:'Avisos sobre novedades',
  cannot_find:'No encuentra lo que busca',
  few_offers:'Hay pocas ofertas',
  irrelevant_content:'Contenido no relevante',
  unclear_how_it_works:'No entiende cómo funciona',
  not_used_enough:'Todavía no lo ha usado suficiente',
  other:'Otro motivo',
}

function analyticsScope(event) {
  const metadata = readMetadata(event.metadata)
  const scope = metadata.scope || 'global'
  const labels = {
    global: 'Búsqueda global',
    tablon: 'Anuncios',
    empleos: 'Empleos',
    comunidad_grupos: 'Grupos',
    comunidad_negocios: 'Negocios',
  }
  return labels[scope] || scope
}

const WEEKDAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']

function countByHour(items) {
  const rows = Array.from({ length: 24 }, (_, hour) => ({
    label: `${String(hour).padStart(2, '0')}:00`,
    value: 0,
  }))

  items.forEach(item => {
    const date = new Date(item.created_at)
    if (!Number.isNaN(date.getTime())) rows[date.getHours()].value += 1
  })

  return rows
}

function countByWeekday(items) {
  const rows = WEEKDAY_LABELS.map(label => ({ label, value: 0 }))

  items.forEach(item => {
    const date = new Date(item.created_at)
    if (!Number.isNaN(date.getTime())) rows[date.getDay()].value += 1
  })

  return rows
}

function topTimeRows(rows, limit = 6) {
  return [...rows]
    .filter(row => row.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
}

function strongestTimeLabel(rows) {
  const best = rows.reduce((acc, row) => row.value > acc.value ? row : acc, { label: 'Sin datos', value: 0 })
  return best.value ? best.label : 'Sin datos'
}

function SparkBarChart({ data, color }) {
  const rawMax = Math.max(...data.map(d => d.count), 0)
  const axisMax = rawMax > 0 ? rawMax : 1

  const LW = 18
  const W  = 300
  const H  = 68
  const PAD_TOP = 6
  const PAD_BOT = 1
  const chartH = H - PAD_TOP - PAD_BOT
  const chartW = W - LW
  const n    = data.length
  const slot = chartW / n
  const bw   = slot * 0.65

  const mid  = Math.round(axisMax / 2)
  const ticks = [...new Set([0, mid, axisMax])]

  function yPos(value) {
    return PAD_TOP + chartH - (value / axisMax) * chartH
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 68, display: 'block' }}>
      {ticks.map(tick => {
        const y = yPos(tick)
        return (
          <g key={tick}>
            <line
              x1={LW} y1={y} x2={W} y2={y}
              stroke="#E2E8F0"
              strokeWidth={tick === 0 ? 1 : 0.7}
              strokeDasharray={tick === 0 ? '' : '3 3'}
            />
            <text
              x={LW - 3} y={y + 3.5}
              textAnchor="end"
              fontSize={8}
              fill="#94A3B8"
              fontFamily="system-ui,sans-serif"
            >
              {tick}
            </text>
          </g>
        )
      })}
      {data.map((d, i) => {
        const bh = Math.max(2, (d.count / axisMax) * chartH)
        return (
          <rect
            key={d.date}
            x={LW + i * slot + (slot - bw) / 2}
            y={yPos(0) - bh}
            width={bw}
            height={bh}
            rx={1.5}
            fill={color}
            opacity={0.82}
          />
        )
      })}
    </svg>
  )
}

function AdminChartCard({ title, items, color }) {
  const [days, setDays] = useState(30)
  const data = useMemo(() => countByDay(items, days), [items, days])
  const total = data.reduce((sum, item) => sum + item.count, 0)
  const trend = periodTrend(items, days)
  const trendColor = trend > 0 ? '#059669' : trend < 0 ? '#DC2626' : C.mid
  const trendLabel = trend > 0 ? `+${trend}%` : trend < 0 ? `-${Math.abs(trend)}%` : 'sin cambio'

  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${C.border}`,
      borderRadius: 22,
      padding: '18px 18px 12px',
      boxShadow: '0 18px 44px rgba(15,23,42,0.06)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, marginBottom: 10 }}>
        <div>
          <p style={{ fontFamily: PP, fontSize: 10, color: C.light, margin: '0 0 4px', fontWeight: 900, letterSpacing: 0.7, textTransform: 'uppercase' }}>
            {title}
          </p>
          <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 32, color: C.text, margin: 0, letterSpacing: -1, lineHeight: 1 }}>
            {total}
          </p>
        </div>
        <span style={{
          fontFamily: PP,
          fontSize: 11,
          fontWeight: 900,
          color: trendColor,
          background: `${trendColor}16`,
          padding: '6px 10px',
          borderRadius: 999,
          marginTop: 2,
          whiteSpace: 'nowrap',
        }}>
          {trendLabel}
        </span>
      </div>
      <SparkBarChart data={data} color={color} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {[7, 30].map(d => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              style={{
                fontFamily: PP,
                fontSize: 10,
                fontWeight: 900,
                padding: '4px 9px',
                borderRadius: 999,
                border: `1px solid ${days === d ? C.primary : C.border}`,
                cursor: 'pointer',
                background: days === d ? C.primary : '#fff',
                color: days === d ? '#fff' : C.light,
              }}
            >
              {d}d
            </button>
          ))}
        </div>
        <p style={{ fontFamily: PP, fontSize: 11, color: C.light, margin: 0 }}>
          ultimos {days} dias
        </p>
      </div>
    </div>
  )
}

function TrendChip({ value, invert = false, size = 10 }) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null
  const trend = Number(value)
  const good = invert ? trend < 0 : trend > 0
  const bad = invert ? trend > 0 : trend < 0
  const color = trend === 0 ? C.mid : good ? '#047857' : bad ? '#B91C1C' : C.mid
  const arrow = trend > 0 ? '↑' : trend < 0 ? '↓' : '→'

  return (
    <span style={{
      fontFamily: PP,
      fontSize: size,
      fontWeight: 900,
      color,
      background: `${color}14`,
      borderRadius: 999,
      padding: '3px 7px',
      whiteSpace: 'nowrap',
      flexShrink: 0,
    }}>
      {arrow} {trend === 0 ? 'igual' : `${Math.abs(trend)}%`}
    </span>
  )
}

function SummaryMetric({ label, value, hint, color = C.primary, trend = null, trendInvert = false, icon = '' }) {
  return (
    <div style={{
      position: 'relative',
      overflow: 'hidden',
      minWidth: 0,
      background: '#fff',
      border: '1px solid rgba(226,234,244,0.92)',
      borderRadius: 18,
      padding: '15px 15px 14px',
      boxShadow: '0 16px 34px rgba(15,23,42,0.055)',
    }}>
      <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: color }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <p style={{ fontFamily: PP, fontSize: 10, fontWeight: 900, color: C.light, textTransform: 'uppercase', letterSpacing: 0.7, margin: 0, minWidth: 0 }}>
          {icon ? `${icon} ` : ''}{label}
        </p>
        <TrendChip value={trend} invert={trendInvert} />
      </div>
      <p style={{ fontFamily: PP, fontSize: 25, fontWeight: 900, color, lineHeight: 1, margin: '0 0 5px', letterSpacing: -0.6, overflowWrap: 'anywhere' }}>
        {value}
      </p>
      <p style={{ fontFamily: PP, fontSize: 11, color: C.mid, lineHeight: 1.35, margin: 0 }}>
        {hint}
      </p>
    </div>
  )
}

function AdminSectionCard({ title, subtitle, action, children, style = {} }) {
  return (
    <Card style={{ padding: 16, overflow: 'hidden', ...style }}>
      {(title || action) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: subtitle ? 12 : 14 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 15, color: C.text, margin: 0 }}>{title}</p>
            {subtitle && (
              <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: '3px 0 0', lineHeight: 1.45 }}>{subtitle}</p>
            )}
          </div>
          {action}
        </div>
      )}
      {children}
    </Card>
  )
}

function FunnelSteps({ steps }) {
  const max = Math.max(...steps.map(step => Number(step.value) || 0), 1)

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {steps.map((step, index) => {
        const value = Number(step.value) || 0
        const previous = index > 0 ? Number(steps[index - 1].value) || 0 : 0
        const conversion = index > 0 && previous ? Math.round((value / previous) * 100) : null

        return (
          <div key={step.label} style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 5 }}>
              <span style={{ fontFamily: PP, fontSize: 12, fontWeight: 900, color: C.text, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {step.label}
              </span>
              <span style={{ display: 'flex', alignItems: 'baseline', gap: 7, flexShrink: 0 }}>
                {conversion !== null && (
                  <span style={{ fontFamily: PP, fontSize: 10, fontWeight: 800, color: C.light }}>{conversion}%</span>
                )}
                <span style={{ fontFamily: PP, fontSize: 13, fontWeight: 900, color: step.color }}>{fmtNumber(value)}</span>
              </span>
            </div>
            <div style={{ width: '100%', height: 9, borderRadius: 999, background: C.bg, overflow: 'hidden' }}>
              <div style={{ width: value ? `${Math.max(6, Math.round((value / max) * 100))}%` : 0, height: '100%', borderRadius: 999, background: step.color }} />
            </div>
            {step.hint && (
              <p style={{ fontFamily: PP, fontSize: 10, color: C.light, margin: '4px 0 0' }}>{step.hint}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

function AdminDataTable({ columns, rows, getRowKey, sort, onSortChange, activeRowKey, onRowClick, emptyText = 'Sin resultados con estos filtros.' }) {
  if (!rows.length) {
    return (
      <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: 0, padding: '18px 4px', textAlign: 'center' }}>
        {emptyText}
      </p>
    )
  }

  return (
    <div style={{ overflowX: 'auto', margin: '0 -4px' }}>
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 720 }}>
        <thead>
          <tr>
            {columns.map(column => {
              const sortable = Boolean(column.sortId && onSortChange)
              const isSorted = sortable && sort === column.sortId
              return (
                <th
                  key={column.key}
                  style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 1,
                    background: C.bgAlt,
                    textAlign: column.align || 'left',
                    fontFamily: PP,
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: 0.6,
                    textTransform: 'uppercase',
                    color: isSorted ? C.primary : C.light,
                    padding: '10px 10px',
                    borderBottom: `1px solid ${C.border}`,
                    whiteSpace: 'nowrap',
                    cursor: sortable ? 'pointer' : 'default',
                    width: column.width,
                  }}
                  onClick={sortable ? () => onSortChange(column.sortId) : undefined}
                >
                  {column.label}{isSorted ? ' ↓' : ''}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const key = getRowKey(row)
            const active = activeRowKey === key
            return (
              <tr
                key={key}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                style={{
                  background: active ? C.primaryLight : 'transparent',
                  cursor: onRowClick ? 'pointer' : 'default',
                }}
              >
                {columns.map(column => (
                  <td
                    key={column.key}
                    style={{
                      fontFamily: PP,
                      fontSize: 12,
                      color: C.text,
                      padding: '11px 10px',
                      borderBottom: `1px solid ${C.borderLight}`,
                      textAlign: column.align || 'left',
                      verticalAlign: 'middle',
                    }}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function InsightBarList({ title, subtitle, rows, color = C.primary, emptyText = 'Sin datos todavía.' }) {
  const max = Math.max(...rows.map(row => row.value), 1)

  return (
    <Card style={{ padding: 16, overflow: 'hidden' }}>
      <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 15, color: C.text, margin: '0 0 3px' }}>{title}</p>
      <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: '0 0 14px', lineHeight: 1.45 }}>{subtitle}</p>

      <div style={{ display: 'grid', gap: 10, minWidth: 0, overflow: 'hidden' }}>
        {rows.map(row => (
          <div key={row.label} style={{ minWidth: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 5 }}>
              <span style={{ minWidth: 0, flex: '1 1 0', overflow: 'hidden' }}>
                <span style={{ display: 'block', fontFamily: PP, fontSize: 12, fontWeight: 900, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.label}</span>
                {row.sub && (
                  <span style={{ display: 'block', fontFamily: PP, fontSize: 10, color: C.light, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{row.sub}</span>
                )}
              </span>
              <span style={{ fontFamily: PP, fontSize: 12, fontWeight: 900, color, flexShrink: 0 }}>{row.value}</span>
            </div>
            <div style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', height: 8, borderRadius: 999, background: C.bg, overflow: 'hidden' }}>
              <div style={{ width: row.value ? `${Math.max(8, Math.round((row.value / max) * 100))}%` : 0, height: '100%', borderRadius: 999, background: color }} />
            </div>
          </div>
        ))}

        {!rows.length && (
          <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: 0, lineHeight: 1.5 }}>{emptyText}</p>
        )}
      </div>
    </Card>
  )
}

function PeriodSwitch({ value, onChange }) {
  const options = [
    { value: 1, label: 'Hoy' },
    { value: 7, label: '7 días' },
    { value: 30, label: '30 días' },
  ]
  return (
    <div style={{ display: 'flex', gap: 6, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 999, padding: 5, boxShadow: '0 8px 20px rgba(15,23,42,0.04)' }}>
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          style={{
            border: 'none',
            borderRadius: 999,
            background: value === option.value ? C.primary : 'transparent',
            color: value === option.value ? '#fff' : C.mid,
            padding: '7px 10px',
            fontFamily: PP,
            fontSize: 11,
            fontWeight: 900,
            cursor: 'pointer',
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function MonthPeriodSwitch({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 999, padding: 5, boxShadow: '0 8px 20px rgba(15,23,42,0.04)' }}>
      {PARTNER_MONTH_PERIOD_OPTIONS.map(option => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          style={{
            border: 'none',
            borderRadius: 999,
            background: value === option.value ? '#4F46E5' : 'transparent',
            color: value === option.value ? '#fff' : C.mid,
            padding: '7px 10px',
            fontFamily: PP,
            fontSize: 11,
            fontWeight: 900,
            cursor: 'pointer',
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

// The period is chosen once in the sticky topbar, so the chart only reports it.
function AdminPeriodChart({ title, items, color, days }) {
  const data = useMemo(() => countByDay(items, days), [items, days])
  const trend = useMemo(() => periodTrend(items, days), [items, days])
  const total = data.reduce((sum, item) => sum + item.count, 0)
  const titleSuffix = days === 1 ? 'hoy' : `${days} días`

  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${C.border}`,
      borderRadius: 22,
      padding: '18px',
      boxShadow: '0 18px 44px rgba(15,23,42,0.06)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap', marginBottom: 10 }}>
        <div>
          <p style={{ fontFamily: PP, fontSize: 10, color: C.light, margin: '0 0 4px', fontWeight: 900, letterSpacing: 0.7, textTransform: 'uppercase' }}>
            {title} · {titleSuffix}
          </p>
          <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 32, color: C.text, margin: 0, letterSpacing: -1, lineHeight: 1 }}>
            {total}
          </p>
        </div>
        <span style={{ marginTop: 4 }}>
          <TrendChip value={trend} size={11} />
        </span>
      </div>
      <SparkBarChart data={data} color={color} />
    </div>
  )
}

function AdminMonthlyChart({ title, items, color, range }) {
  const data = useMemo(() => countByDateRange(items, range), [items, range])
  const total = data.reduce((sum, item) => sum + item.count, 0)

  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${C.border}`,
      borderRadius: 22,
      padding: '18px',
      boxShadow: '0 18px 44px rgba(15,23,42,0.06)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap', marginBottom: 10 }}>
        <div>
          <p style={{ fontFamily: PP, fontSize: 10, color: C.light, margin: '0 0 4px', fontWeight: 900, letterSpacing: 0.7, textTransform: 'uppercase' }}>
            {title} · {range.monthLabel}
          </p>
          <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 32, color: C.text, margin: 0, letterSpacing: -1, lineHeight: 1 }}>
            {total}
          </p>
        </div>
        <span style={{
          fontFamily: PP,
          fontSize: 11,
          fontWeight: 900,
          color,
          background: `${color}14`,
          padding: '6px 10px',
          borderRadius: 999,
          marginTop: 2,
          whiteSpace: 'nowrap',
        }}>
          {range.startLabel} - {range.endLabel}
        </span>
      </div>
      <SparkBarChart data={data} color={color} />
    </div>
  )
}

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid rgba(226,234,244,0.95)',
      borderRadius: 18,
      padding: 18,
      boxShadow: '0 14px 32px rgba(15,23,42,0.05)',
      ...style,
    }}>
      {children}
    </div>
  )
}

function AdminButton({ children, onClick, variant = 'secondary', disabled = false }) {
  return (
    <Btn
      size="sm"
      variant={variant}
      disabled={disabled}
      onClick={onClick}
      style={{ width: 'auto', minWidth: 0, padding: '9px 12px', borderRadius: 10, fontSize: 11 }}
    >
      {children}
    </Btn>
  )
}

function AdminFilterInput({ value, onChange, placeholder }) {
  return (
    <input
      value={value}
      onChange={event => onChange(event.target.value)}
      placeholder={placeholder}
      style={{
        minWidth: 0,
        flex: '1 1 220px',
        boxSizing: 'border-box',
        fontFamily: PP,
        fontSize: 12,
        color: C.text,
        background: '#fff',
        border: `1.5px solid ${C.border}`,
        borderRadius: 12,
        padding: '10px 12px',
        outline: 'none',
      }}
    />
  )
}

function AdminFilterSelect({ value, onChange, children, label }) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={event => onChange(event.target.value)}
      style={{
        minWidth: 0,
        width: '100%',
        flex: '0 1 190px',
        boxSizing: 'border-box',
        fontFamily: PP,
        fontSize: 11,
        fontWeight: 800,
        color: C.text,
        background: '#fff',
        border: `1.5px solid ${C.border}`,
        borderRadius: 12,
        padding: '10px 8px',
        outline: 'none',
      }}
    >
      {children}
    </select>
  )
}

function AdminFilterBar({ children, footer }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid rgba(226,234,244,0.95)',
      borderRadius: 18,
      padding: 12,
      boxShadow: '0 12px 28px rgba(15,23,42,0.045)',
      display: 'grid',
      gap: 9,
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))', gap: 8 }}>
        {children}
      </div>
      {footer && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          {footer}
        </div>
      )}
    </div>
  )
}

function AdminChipFilter({ options, value, onChange, label }) {
  return (
    <div role="group" aria-label={label} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {options.map(option => {
        const active = value === option.id
        const color = option.color || C.primary
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            style={{
              fontFamily: PP,
              fontSize: 11,
              fontWeight: 900,
              border: `1.5px solid ${active ? color : C.border}`,
              background: active ? (option.bg || `${color}12`) : '#fff',
              color: active ? color : C.mid,
              borderRadius: 999,
              padding: '7px 11px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {option.label}{option.count === undefined ? '' : ` · ${option.count}`}
          </button>
        )
      })}
    </div>
  )
}

function AdminPagination({ page, pageCount, total, onChange }) {
  if (pageCount <= 1) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 2px 2px' }}>
      <span style={{ fontFamily: PP, fontSize: 11, color: C.light }}>
        Página {page} de {pageCount} · {total} resultados
      </span>
      <div style={{ display: 'flex', gap: 7 }}>
        <AdminButton disabled={page <= 1} onClick={() => onChange(page - 1)}>Anterior</AdminButton>
        <AdminButton disabled={page >= pageCount} onClick={() => onChange(page + 1)}>Siguiente</AdminButton>
      </div>
    </div>
  )
}

function EmptyState({ icon, text }) {
  return (
    <Card style={{ textAlign: 'center', padding: '48px 24px', background: 'linear-gradient(180deg,#fff,#F8FAFF)' }}>
      <div style={{ fontSize: 34, marginBottom: 10 }}>{icon}</div>
      <p style={{ fontFamily: PP, color: C.light, margin: 0, fontSize: 14, lineHeight: 1.5 }}>{text}</p>
    </Card>
  )
}

async function logAdminAction(action) {
  await supabase.from('admin_actions').insert(action)
}

export default function Admin() {
  const { user } = useAuth()
  const activeLoadCountRef = useRef(0)
  const loadedDataGroupsRef = useRef(new Set())
  const loadingDataGroupsRef = useRef(new Set())
  const dataRangeDaysByGroupRef = useRef(new Map())
  const dailyRowsCacheRef = useRef(new Map())
  const [tab, setTab] = useState('overview')
  const [crmMenuOpen, setCrmMenuOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadedDataGroups, setLoadedDataGroups] = useState(new Set())
  const [dataErrorsByGroup, setDataErrorsByGroup] = useState({})
  const [dataRangeDaysByGroup, setDataRangeDaysByGroup] = useState(new Map())
  const [deltaLoadSummary, setDeltaLoadSummary] = useState(null)
  const [userSearch, setUserSearch] = useState('')
  const [userStatusFilter, setUserStatusFilter] = useState('all')
  const [userCantonFilter, setUserCantonFilter] = useState('all')
  const [userPage, setUserPage] = useState(1)
  const [userDays, setUserDays] = useState(1)
  const [overviewDays, setOverviewDays] = useState(7)
  const [reports, setReports] = useState([])
  const [reportTypeFilter, setReportTypeFilter] = useState('all')
  const [reportPage, setReportPage] = useState(1)
  const [queue, setQueue] = useState([])
  const [moderationTypeFilter, setModerationTypeFilter] = useState('all')
  const [moderationPage, setModerationPage] = useState(1)
  const [users, setUsers] = useState([])
  const [recentListings, setRecentListings] = useState([])
  const [recentJobs, setRecentJobs] = useState([])
  const [contentSearch, setContentSearch] = useState('')
  const [contentStatusFilter, setContentStatusFilter] = useState('all')
  const [listingPage, setListingPage] = useState(1)
  const [jobPage, setJobPage] = useState(1)
  const [businesses, setBusinesses] = useState([])
  const [businessVerificationFilter, setBusinessVerificationFilter] = useState('pending')
  const [businessSearch, setBusinessSearch] = useState('')
  const [businessPage, setBusinessPage] = useState(1)
  const [businessPromotionAvailability, setBusinessPromotionAvailability] = useState([])
  const [businessPromotionUnavailable, setBusinessPromotionUnavailable] = useState(false)
  const [businessPromotionLoading, setBusinessPromotionLoading] = useState(new Set())
  const [contentByKey, setContentByKey] = useState(new Map())
  const [onlineUserIds, setOnlineUserIds] = useState(new Set())
  const [presenceStatus, setPresenceStatus] = useState('idle')
  const [analyticsEvents, setAnalyticsEvents] = useState([])
  const [analyticsUnavailable, setAnalyticsUnavailable] = useState(false)
  const [analyticsDays, setAnalyticsDays] = useState(7)
  const [latidoRatings, setLatidoRatings] = useState([])
  const [searchFeedback, setSearchFeedback] = useState([])
  const [feedbackSearch, setFeedbackSearch] = useState('')
  const [feedbackToneFilter, setFeedbackToneFilter] = useState('all')
  const [partnerMonthPeriod, setPartnerMonthPeriod] = useState('current')
  const [selectedPartnerId, setSelectedPartnerId] = useState(PARTNER_ANALYTICS_PARTNERS[0]?.id || '')
  const [messageEvents, setMessageEvents] = useState([])
  const [messagesUnavailable, setMessagesUnavailable] = useState(false)
  const [creatorProfiles, setCreatorProfiles] = useState([])
  const [creatorContents, setCreatorContents] = useState([])
  const [creatorMetricRows, setCreatorMetricRows] = useState([])
  const [creatorsUnavailable, setCreatorsUnavailable] = useState(false)
  const [creatorSearch, setCreatorSearch] = useState('')
  const [creatorStatusFilter, setCreatorStatusFilter] = useState('all')
  const [creatorReviewFilter, setCreatorReviewFilter] = useState('all')
  const [creatorTopicFilter, setCreatorTopicFilter] = useState('all')
  const [creatorCantonFilter, setCreatorCantonFilter] = useState('all')
  const [creatorSort, setCreatorSort] = useState('views')
  const [creatorPage, setCreatorPage] = useState(1)
  const [creatorDays, setCreatorDays] = useState(30)
  const [selectedCreatorId, setSelectedCreatorId] = useState('')
  const [creatorActionLoading, setCreatorActionLoading] = useState(new Set())
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const dataErrors = Object.values(dataErrorsByGroup).filter(Boolean)

  const metricUsers = useMemo(
    () => users.filter(profile => !isAdminEmail(profile.email)),
    [users]
  )
  const adminUserIds = useMemo(
    () => {
      const ids = new Set()
      for (const profile of users) {
        if (isAdminEmail(profile.email)) ids.add(profile.id)
      }
      return ids
    },
    [users]
  )
  const partnerMetricsExcludedUserIds = useMemo(
    () => {
      const ids = new Set()
      for (const profile of users) {
        if (isAdminEmail(profile.email) || isPartnerMetricsExcludedEmail(profile.email)) ids.add(profile.id)
      }
      return ids
    },
    [users]
  )
  const metricLatidoRatings = useMemo(
    () => latidoRatings.filter(rating => !adminUserIds.has(rating.user_id)),
    [adminUserIds, latidoRatings]
  )
  const metricStarRatings = useMemo(
    () => metricLatidoRatings.filter(rating =>
      Number(rating.overall_rating) >= 1
      && Number(rating.usefulness_rating) >= 1
    ),
    [metricLatidoRatings]
  )
  const metricUsefulnessFeedback = useMemo(
    () => metricLatidoRatings.filter(rating =>
      ['yes', 'partial', 'no'].includes(rating.usefulness_answer)
    ),
    [metricLatidoRatings]
  )
  const metricSearchFeedback = useMemo(
    () => searchFeedback.filter(item => !item.user_id || !adminUserIds.has(item.user_id)),
    [adminUserIds, searchFeedback]
  )
  const usersWithInterests = useMemo(
    () => metricUsers.filter(profile => normalizeInterestIds(profile.interests).length > 0),
    [metricUsers]
  )
  const interestRows = useMemo(
    () => INTEREST_OPTIONS
      .map(option => {
        const value = metricUsers.filter(profile =>
          normalizeInterestIds(profile.interests).includes(option.id)
        ).length
        return {
          label:`${option.emoji} ${option.label}`,
          value,
          sub:metricUsers.length ? `${Math.round((value / metricUsers.length) * 100)}% de las cuentas` : '',
        }
      })
      .sort((a, b) => b.value - a.value),
    [metricUsers]
  )
  const selectedInterestCount = useMemo(
    () => metricUsers.reduce(
      (total, profile) => total + normalizeInterestIds(profile.interests).length,
      0
    ),
    [metricUsers]
  )
  const interestCoverage = metricUsers.length
    ? Math.round((usersWithInterests.length / metricUsers.length) * 100)
    : 0
  const overallRatingAverage = useMemo(
    () => averageMetricValue(metricStarRatings, 'overall_rating'),
    [metricStarRatings]
  )
  const usefulnessRatingAverage = useMemo(
    () => averageMetricValue(metricStarRatings, 'usefulness_rating'),
    [metricStarRatings]
  )
  const overallRatingRows = useMemo(
    () => [5, 4, 3, 2, 1].map(stars => {
      const value = metricStarRatings.filter(rating => Number(rating.overall_rating) === stars).length
      return {
        label:`${stars} ${stars === 1 ? 'estrella' : 'estrellas'}`,
        value,
        sub:`${feedbackPercentage(value, metricStarRatings.length)}% de las valoraciones`,
      }
    }),
    [metricStarRatings]
  )
  const usefulnessRatingRows = useMemo(
    () => [5, 4, 3, 2, 1].map(stars => {
      const value = metricStarRatings.filter(rating => Number(rating.usefulness_rating) === stars).length
      return {
        label:`${stars} ${stars === 1 ? 'estrella' : 'estrellas'}`,
        value,
        sub:`${feedbackPercentage(value, metricStarRatings.length)}% de las valoraciones`,
      }
    }),
    [metricStarRatings]
  )
  const usefulnessAnswerRows = useMemo(
    () => ['yes', 'partial', 'no'].map(answer => {
      const value = metricUsefulnessFeedback.filter(rating => rating.usefulness_answer === answer).length
      return {
        label:LATIDO_USEFULNESS_ANSWER_META[answer].label,
        value,
        sub:`${feedbackPercentage(value, metricUsefulnessFeedback.length)}% de las respuestas`,
      }
    }),
    [metricUsefulnessFeedback]
  )
  const positiveUsefulnessDetailRows = useMemo(
    () => topAnalyticsRows(
      metricUsefulnessFeedback.filter(rating => rating.usefulness_answer === 'yes' && rating.usefulness_detail),
      rating => LATIDO_USEFULNESS_DETAIL_LABELS[rating.usefulness_detail] || rating.usefulness_detail,
      10
    ).map(row => ({
      ...row,
      sub:`${feedbackPercentage(row.value, metricUsefulnessFeedback.filter(rating => rating.usefulness_answer === 'yes').length)}% de las respuestas positivas`,
    })),
    [metricUsefulnessFeedback]
  )
  const improvementUsefulnessDetailRows = useMemo(
    () => topAnalyticsRows(
      metricUsefulnessFeedback.filter(rating => ['partial', 'no'].includes(rating.usefulness_answer) && rating.usefulness_detail),
      rating => LATIDO_USEFULNESS_DETAIL_LABELS[rating.usefulness_detail] || rating.usefulness_detail,
      10
    ).map(row => ({
      ...row,
      sub:`${feedbackPercentage(row.value, metricUsefulnessFeedback.filter(rating => ['partial', 'no'].includes(rating.usefulness_answer)).length)}% de las respuestas a mejorar`,
    })),
    [metricUsefulnessFeedback]
  )
  const directSearchResolution = useMemo(() => {
    const yes = metricSearchFeedback.filter(item => item.answer === 'yes').length
    const partial = metricSearchFeedback.filter(item => item.answer === 'partial').length
    const no = metricSearchFeedback.filter(item => item.answer === 'no').length
    const total = yes + partial + no
    return {
      total,
      yes,
      partial,
      no,
      confirmedRate:total ? Math.round((yes / total) * 100) : 0,
      helpfulRate:total ? Math.round(((yes + partial) / total) * 100) : 0,
    }
  }, [metricSearchFeedback])
  const directUnresolvedSearchRows = useMemo(
    () => topAnalyticsRows(
      metricSearchFeedback.filter(item => ['partial', 'no'].includes(item.answer)),
      item => item.query,
      8,
      item => SEARCH_RESOLUTION_ANSWER_LABELS[item.answer] || ''
    ),
    [metricSearchFeedback]
  )
  const directSearchReasonRows = useMemo(
    () => topAnalyticsRows(
      metricSearchFeedback.filter(item => item.reason),
      item => SEARCH_RESOLUTION_REASON_LABELS[item.reason] || 'Otro motivo',
      8
    ).map(row => ({
      ...row,
      sub:`${feedbackPercentage(row.value, metricSearchFeedback.filter(item => ['partial', 'no'].includes(item.answer)).length)}% de las respuestas a mejorar`,
    })),
    [metricSearchFeedback]
  )
  const userProfilesById = useMemo(
    () => new Map(metricUsers.map(profile => [profile.id, profile])),
    [metricUsers]
  )
  const sortedLatidoRatings = useMemo(
    () => [...metricStarRatings]
      .sort((a, b) => String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || ''))),
    [metricStarRatings]
  )
  const sortedUsefulnessFeedback = useMemo(
    () => [...metricUsefulnessFeedback]
      .sort((a, b) => String(b.usefulness_answered_at || b.updated_at || b.created_at || '').localeCompare(String(a.usefulness_answered_at || a.updated_at || a.created_at || ''))),
    [metricUsefulnessFeedback]
  )
  const sortedSearchFeedback = useMemo(
    () => [...metricSearchFeedback]
      .sort((a, b) => String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || ''))),
    [metricSearchFeedback]
  )
  const identifiedFeedbackUserIds = useMemo(() => new Set([
    ...metricStarRatings.map(item => item.user_id).filter(Boolean),
    ...metricUsefulnessFeedback.map(item => item.user_id).filter(Boolean),
    ...metricSearchFeedback.map(item => item.user_id).filter(Boolean),
  ]), [metricSearchFeedback, metricStarRatings, metricUsefulnessFeedback])
  const starRatingPeople = useMemo(
    () => new Set(metricStarRatings.map(item => item.user_id).filter(Boolean)).size,
    [metricStarRatings]
  )
  const usefulnessFeedbackPeople = useMemo(
    () => new Set(metricUsefulnessFeedback.map(item => item.user_id).filter(Boolean)).size,
    [metricUsefulnessFeedback]
  )
  const searchFeedbackPeople = useMemo(
    () => new Set(metricSearchFeedback.map(item => item.user_id).filter(Boolean)).size,
    [metricSearchFeedback]
  )
  const anonymousSearchResponses = useMemo(
    () => metricSearchFeedback.filter(item => !item.user_id).length,
    [metricSearchFeedback]
  )
  const writtenFeedbackComments = useMemo(
    () => metricStarRatings.filter(item => String(item.comment || '').trim()).length
      + metricUsefulnessFeedback.filter(item => String(item.usefulness_comment || '').trim()).length,
    [metricStarRatings, metricUsefulnessFeedback]
  )
  const positiveFeedbackSignals = useMemo(
    () => metricStarRatings.filter(item => ratingFeedbackTone(item) === 'positive').length
      + metricUsefulnessFeedback.filter(item => item.usefulness_answer === 'yes').length
      + metricSearchFeedback.filter(item => item.answer === 'yes').length,
    [metricSearchFeedback, metricStarRatings, metricUsefulnessFeedback]
  )
  const feedbackSignalsToReview = useMemo(
    () => metricStarRatings.filter(item => ratingFeedbackTone(item) === 'negative').length
      + metricUsefulnessFeedback.filter(item => ['partial', 'no'].includes(item.usefulness_answer)).length
      + metricSearchFeedback.filter(item => ['partial', 'no'].includes(item.answer)).length,
    [metricSearchFeedback, metricStarRatings, metricUsefulnessFeedback]
  )
  const totalFeedbackResponses = metricStarRatings.length + metricUsefulnessFeedback.length + metricSearchFeedback.length
  const identifiedFeedbackCoverage = metricUsers.length
    ? Math.min(100, feedbackPercentage(identifiedFeedbackUserIds.size, metricUsers.length))
    : 0
  const normalizedFeedbackSearch = feedbackSearch.trim().toLocaleLowerCase('es')
  const filteredLatidoRatings = useMemo(
    () => sortedLatidoRatings.filter(rating => {
      const profile = userProfilesById.get(rating.user_id)
      if (!feedbackToneMatches(feedbackToneFilter, ratingFeedbackTone(rating), Boolean(String(rating.comment || '').trim()))) return false
      return feedbackSearchMatches(
        normalizedFeedbackSearch,
        profile?.name,
        profile?.email,
        profile?.canton,
        rating.comment,
        rating.overall_rating,
        rating.usefulness_rating
      )
    }),
    [feedbackToneFilter, normalizedFeedbackSearch, sortedLatidoRatings, userProfilesById]
  )
  const filteredUsefulnessFeedback = useMemo(
    () => sortedUsefulnessFeedback.filter(rating => {
      const profile = userProfilesById.get(rating.user_id)
      const tone = rating.usefulness_answer === 'yes' ? 'positive' : rating.usefulness_answer === 'no' ? 'negative' : 'partial'
      if (!feedbackToneMatches(feedbackToneFilter, tone, Boolean(String(rating.usefulness_comment || '').trim()))) return false
      return feedbackSearchMatches(
        normalizedFeedbackSearch,
        profile?.name,
        profile?.email,
        profile?.canton,
        rating.usefulness_comment,
        LATIDO_USEFULNESS_DETAIL_LABELS[rating.usefulness_detail],
        LATIDO_USEFULNESS_ANSWER_META[rating.usefulness_answer]?.label
      )
    }),
    [feedbackToneFilter, normalizedFeedbackSearch, sortedUsefulnessFeedback, userProfilesById]
  )
  const filteredSearchFeedback = useMemo(
    () => sortedSearchFeedback.filter(item => {
      const profile = userProfilesById.get(item.user_id)
      const tone = item.answer === 'yes' ? 'positive' : item.answer === 'no' ? 'negative' : 'partial'
      if (!feedbackToneMatches(feedbackToneFilter, tone, false)) return false
      return feedbackSearchMatches(
        normalizedFeedbackSearch,
        profile?.name,
        profile?.email,
        profile?.canton,
        item.query,
        item.result_label,
        item.result_type,
        SEARCH_RESOLUTION_REASON_LABELS[item.reason],
        item.solution_action
      )
    }),
    [feedbackToneFilter, normalizedFeedbackSearch, sortedSearchFeedback, userProfilesById]
  )
  const businessPromotionPlans = useMemo(
    () => mergeBusinessPromotionPlans(businessPromotionAvailability),
    [businessPromotionAvailability],
  )
  const businessPartnerOptions = useMemo(
    () => {
      const options = []
      for (const business of businesses) {
        if (!isActiveBusinessPartner(business)) continue
        const services = Array.isArray(business.services)
          ? Object.fromEntries(business.services.map(service => [service, service]))
          : {}
        options.push({
          id:getBusinessPartnerAnalyticsId(business.id),
          providerId:business.id,
          name:business.partner_card_title || business.name || 'Colaborador',
          logo:business.partner_logo_url || business.photo_url || '/favicon.svg',
          campaign:`business-${business.id}`,
          legacyPartnerIds:[],
          color:businessPartnerColor(business.promotion_plan),
          tint:businessPartnerTint(business.promotion_plan),
          services,
          isBusinessPartner:true,
          planKey:business.promotion_plan,
        })
      }
      return options.sort((a, b) => {
        const planDiff = (a.planKey === 'premium' ? 0 : 1) - (b.planKey === 'premium' ? 0 : 1)
        if (planDiff !== 0) return planDiff
        return a.name.localeCompare(b.name, 'es')
      })
    },
    [businesses],
  )
  const partnerOptions = useMemo(
    () => [...businessPartnerOptions, ...PARTNER_ANALYTICS_PARTNERS],
    [businessPartnerOptions],
  )
  const businessPartnerAnalyticsIds = useMemo(
    () => new Set(businessPartnerOptions.map(partner => partner.id)),
    [businessPartnerOptions],
  )

  const stats = useMemo(() => ({
    reports: reports.filter(r => r.status === 'pending').length,
    queue: queue.filter(r => r.status === 'pending').length,
    users: metricUsers.length,
    banned: metricUsers.filter(u => u.banned).length,
    content: recentListings.length + recentJobs.length,
    businessVerification: businesses.filter(b => getBusinessVerificationDetails(b).status === 'pending').length,
  }), [businesses, queue, reports, metricUsers, recentListings, recentJobs])

  const usersById = useMemo(() => {
    const map = new Map()
    for (const profile of users) map.set(profile.id, profile)
    return map
  }, [users])

  // creator_metrics stores lifetime counters (creator_id + metric + content_id),
  // so totals are cumulative and not filtered by the period switch.
  const creatorMetricIndex = useMemo(() => {
    const emptyTotals = () => Object.fromEntries(CREATOR_METRIC_KEYS.map(key => [key, 0]))
    const totals = emptyTotals()
    const byCreator = new Map()
    const byContent = new Map()
    let updatedAt = ''

    for (const row of creatorMetricRows) {
      const metric = row?.metric
      if (!CREATOR_METRIC_KEYS.includes(metric)) continue
      const count = Math.max(0, Number(row.count) || 0)
      totals[metric] += count

      const creatorTotals = byCreator.get(row.creator_id) || emptyTotals()
      creatorTotals[metric] += count
      byCreator.set(row.creator_id, creatorTotals)

      if (row.content_id) {
        const contentTotals = byContent.get(row.content_id) || emptyTotals()
        contentTotals[metric] += count
        byContent.set(row.content_id, contentTotals)
      }
      if (row.updated_at && row.updated_at > updatedAt) updatedAt = row.updated_at
    }

    return { totals, byCreator, byContent, updatedAt }
  }, [creatorMetricRows])

  const creatorContentsByCreator = useMemo(() => {
    const map = new Map()
    for (const content of creatorContents) {
      const list = map.get(content.creator_id)
      if (list) list.push(content)
      else map.set(content.creator_id, [content])
    }
    return map
  }, [creatorContents])

  const creatorRows = useMemo(() => creatorProfiles.map(creator => {
    const contents = creatorContentsByCreator.get(creator.id) || []
    const metrics = creatorMetricIndex.byCreator.get(creator.id)
    const owner = usersById.get(creator.owner_id)
    const profileViews = metrics?.profile_view || 0
    const impressions = metrics?.content_impression || 0
    const clicks = metrics?.content_click || 0
    const profileHelpful = Math.max(0, Number(creator.helpful_count) || 0)
    const contentHelpful = contents.reduce((sum, content) => sum + Math.max(0, Number(content.helpful_count) || 0), 0)
    const publishedContents = contents.filter(content => content.status === 'published' && content.active !== false)
    const lastPublishedAt = contents.reduce(
      (latest, content) => (content.published_at || '') > latest ? (content.published_at || '') : latest,
      '',
    )
    const platforms = [...new Set(contents.map(content => content.platform).filter(Boolean))]

    return {
      ...creator,
      contents,
      platforms,
      contentCount: contents.length,
      publishedContentCount: publishedContents.length,
      profileViews,
      impressions,
      clicks,
      shares: metrics?.content_share || 0,
      socialClicks: metrics?.social_click || 0,
      ctr: percentOf(clicks, impressions),
      profileHelpful,
      contentHelpful,
      helpful: profileHelpful + contentHelpful,
      saved: Math.max(0, Number(creator.saved_count) || 0),
      ownerEmail: owner?.email || '',
      ownerName: owner?.name || '',
      lastPublishedAt,
      isLive: creator.status === 'published' && creator.active !== false,
    }
  }), [creatorProfiles, creatorContentsByCreator, creatorMetricIndex, usersById])

  const creatorRowsById = useMemo(
    () => new Map(creatorRows.map(creator => [creator.id, creator])),
    [creatorRows]
  )

  const creatorStats = useMemo(() => {
    const live = creatorRows.filter(creator => creator.isLive)
    const totals = creatorMetricIndex.totals
    const helpful = creatorRows.reduce((sum, creator) => sum + creator.helpful, 0)
    const saved = creatorRows.reduce((sum, creator) => sum + creator.saved, 0)
    const publishedContents = creatorContents.filter(content => content.status === 'published' && content.active !== false)

    return {
      total: creatorRows.length,
      live: live.length,
      drafts: creatorRows.filter(creator => creator.status !== 'published').length,
      inactive: creatorRows.filter(creator => creator.active === false).length,
      verified: creatorRows.filter(creator => creator.verified).length,
      pendingReview: creatorRows.filter(creator => creator.review_status === 'pending').length,
      approved: creatorRows.filter(creator => creator.review_status === 'approved').length,
      rejected: creatorRows.filter(creator => creator.review_status === 'rejected').length,
      withoutContent: creatorRows.filter(creator => creator.contentCount === 0).length,
      contents: creatorContents.length,
      publishedContents: publishedContents.length,
      profileViews: totals.profile_view,
      impressions: totals.content_impression,
      clicks: totals.content_click,
      shares: totals.content_share,
      socialClicks: totals.social_click,
      ctr: percentOf(totals.content_click, totals.content_impression),
      helpful,
      saved,
      newCreators: creatorRows.filter(creator => isWithinRecentDays(creator.created_at, creatorDays)).length,
      newContents: creatorContents.filter(content => isWithinRecentDays(content.created_at, creatorDays)).length,
      creatorTrend: periodTrend(creatorRows, creatorDays),
      contentTrend: periodTrend(creatorContents, creatorDays),
    }
  }, [creatorRows, creatorContents, creatorMetricIndex, creatorDays])

  const creatorCantons = useMemo(
    () => [...new Set(creatorRows.map(creator => creator.canton).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')),
    [creatorRows]
  )

  const filteredCreators = useMemo(() => {
    const query = creatorSearch.trim().toLowerCase()
    const rows = creatorRows.filter(creator => {
      if (creatorStatusFilter === 'live' && !creator.isLive) return false
      if (creatorStatusFilter === 'draft' && creator.status === 'published') return false
      if (creatorStatusFilter === 'inactive' && creator.active !== false) return false
      if (creatorStatusFilter === 'empty' && creator.contentCount > 0) return false
      if (creatorReviewFilter === 'verified' && !creator.verified) return false
      if (['pending', 'approved', 'rejected'].includes(creatorReviewFilter) && creator.review_status !== creatorReviewFilter) return false
      if (creatorTopicFilter !== 'all' && !(creator.topics || []).includes(creatorTopicFilter)) return false
      if (creatorCantonFilter !== 'all' && (creator.canton || '') !== creatorCantonFilter) return false
      if (!query) return true
      return [creator.name, creator.handle, creator.slug, creator.city, creator.canton, creator.ownerEmail, (creator.topics || []).join(' ')]
        .some(value => String(value || '').toLowerCase().includes(query))
    })

    const sorters = {
      views: (a, b) => b.profileViews - a.profileViews,
      clicks: (a, b) => b.clicks - a.clicks,
      helpful: (a, b) => b.helpful - a.helpful,
      saved: (a, b) => b.saved - a.saved,
      contents: (a, b) => b.contentCount - a.contentCount,
      ctr: (a, b) => b.ctr - a.ctr,
      recent: (a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')),
      name: (a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es'),
    }

    return rows.sort(sorters[creatorSort] || sorters.views)
  }, [creatorRows, creatorSearch, creatorStatusFilter, creatorReviewFilter, creatorTopicFilter, creatorCantonFilter, creatorSort])

  const pagedCreators = useMemo(() => paginate(filteredCreators, creatorPage, 20), [filteredCreators, creatorPage])
  const selectedCreator = selectedCreatorId ? creatorRowsById.get(selectedCreatorId) : null

  const creatorTopicRows = useMemo(() => CREATOR_TOPICS
    .map(topic => {
      const creators = creatorRows.filter(creator => (creator.topics || []).includes(topic.id))
      const contents = creatorContents.filter(content => content.topic === topic.id)
      return {
        label:`${topic.emoji} ${topic.label}`,
        value:contents.length,
        sub:`${creators.length} creadores · ${contents.filter(content => content.status === 'published').length} publicados`,
      }
    })
    .filter(row => row.value > 0 || creatorRows.length === 0)
    .sort((a, b) => b.value - a.value),
    [creatorRows, creatorContents]
  )

  const creatorPlatformRows = useMemo(() => CREATOR_PLATFORMS
    .map(platform => {
      const contents = creatorContents.filter(content => content.platform === platform.id)
      const clicks = contents.reduce(
        (sum, content) => sum + (creatorMetricIndex.byContent.get(content.id)?.content_click || 0),
        0,
      )
      return {
        label:platform.label,
        value:contents.length,
        sub:`${fmtNumber(clicks)} clics · ${contents.filter(content => content.status === 'published').length} publicados`,
      }
    })
    .filter(row => row.value > 0)
    .sort((a, b) => b.value - a.value),
    [creatorContents, creatorMetricIndex]
  )

  const creatorCantonRows = useMemo(() => {
    const counts = new Map()
    for (const creator of creatorRows) {
      const key = creator.canton || 'Sin cantón'
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    return [...counts.entries()]
      .map(([label, value]) => ({ label, value, sub:`${percentOf(value, creatorRows.length)}% del total` }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [creatorRows])

  const topCreatorRows = useMemo(() => creatorRows
    .slice()
    .sort((a, b) => (b.profileViews + b.clicks) - (a.profileViews + a.clicks))
    .slice(0, 8)
    .map(creator => ({
      label:creator.name || creator.handle || 'Sin nombre',
      value:creator.profileViews + creator.clicks,
      sub:`${fmtNumber(creator.profileViews)} vistas · ${fmtNumber(creator.clicks)} clics · ${creator.contentCount} contenidos`,
    })),
    [creatorRows]
  )

  const topCreatorHelpfulRows = useMemo(() => creatorRows
    .filter(creator => creator.helpful > 0 || creator.saved > 0)
    .sort((a, b) => (b.helpful + b.saved) - (a.helpful + a.saved))
    .slice(0, 8)
    .map(creator => ({
      label:creator.name || creator.handle || 'Sin nombre',
      value:creator.helpful + creator.saved,
      sub:`${fmtNumber(creator.helpful)} útiles · ${fmtNumber(creator.saved)} guardados`,
    })),
    [creatorRows]
  )

  const topCreatorContentRows = useMemo(() => creatorContents
    .map(content => {
      const metrics = creatorMetricIndex.byContent.get(content.id)
      const clicks = metrics?.content_click || 0
      const impressions = metrics?.content_impression || 0
      const creator = creatorRowsById.get(content.creator_id)
      return {
        label:content.title || 'Sin título',
        value:clicks,
        sub:`${creator?.name || 'Creador'} · ${creatorPlatformMeta(content.platform).label} · ${impressions ? `${percentOf(clicks, impressions)}% CTR` : 'sin impresiones'} · ${fmtNumber(Math.max(0, Number(content.helpful_count) || 0))} útiles`,
      }
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 8),
    [creatorContents, creatorMetricIndex, creatorRowsById]
  )

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase()
    return metricUsers.filter(profile => {
      if (userStatusFilter === 'banned' && !profile.banned) return false
      if (userStatusFilter === 'active' && profile.banned) return false
      if (userCantonFilter !== 'all' && (profile.canton || '') !== userCantonFilter) return false
      if (!q) return true
      return (profile.name || '').toLowerCase().includes(q)
        || (profile.email || '').toLowerCase().includes(q)
        || (profile.canton || '').toLowerCase().includes(q)
    })
  }, [metricUsers, userCantonFilter, userSearch, userStatusFilter])
  const userCantons = useMemo(
    () => [...new Set(metricUsers.map(profile => profile.canton).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')),
    [metricUsers]
  )
  const pagedUsers = useMemo(() => paginate(filteredUsers, userPage), [filteredUsers, userPage])
  const newUsersInRange = useMemo(
    () => metricUsers.filter(profile => isWithinRecentDays(profile.created_at, userDays)),
    [metricUsers, userDays]
  )
  const userRangeLabel = userDays === 1 ? 'hoy' : `${userDays} dias`
  const userTrendInRange = useMemo(() => periodTrend(metricUsers, userDays), [metricUsers, userDays])
  const creatorRangeText = creatorDays === 1 ? 'hoy' : `${creatorDays}d`
  const activeUsersToday = useMemo(
    () => metricUsers.filter(profile => isWithinRecentDays(profile.last_seen_at, 1)),
    [metricUsers]
  )
  const activeUsersWeek = useMemo(
    () => metricUsers.filter(profile => isWithinRecentDays(profile.last_seen_at, 7)),
    [metricUsers]
  )
  const activeUsersMonth = useMemo(
    () => metricUsers.filter(profile => isWithinRecentDays(profile.last_seen_at, 30)),
    [metricUsers]
  )
  const onlineUsers = useMemo(
    () => metricUsers.filter(profile => onlineUserIds.has(profile.id)),
    [metricUsers, onlineUserIds]
  )
  const recentActiveUsers = useMemo(
    () => [...metricUsers]
      .filter(profile => profile.last_seen_at)
      .sort((a, b) => String(b.last_seen_at || '').localeCompare(String(a.last_seen_at || '')))
      .slice(0, 6),
    [metricUsers]
  )
  const activeChartUsers = useMemo(
    () => {
      const rows = []
      for (const profile of metricUsers) {
        if (profile.last_seen_at) rows.push({ ...profile, created_at: profile.last_seen_at })
      }
      return rows
    },
    [metricUsers]
  )
  const contentItems = useMemo(() => [...recentListings, ...recentJobs], [recentListings, recentJobs])
  const analyticsInRange = useMemo(
    () => analyticsEvents.filter(event => isWithinRecentDays(event.created_at, analyticsDays) && !adminUserIds.has(event.user_id)),
    [adminUserIds, analyticsDays, analyticsEvents]
  )
  const pageViewEvents = useMemo(
    () => analyticsInRange.filter(event => event.event_type === 'page_view' && !String(event.path || '').startsWith('/admin-latido')),
    [analyticsInRange]
  )
  const searchEvents = useMemo(
    () => analyticsInRange.filter(event => event.event_type === 'search' && analyticsQuery(event)),
    [analyticsInRange]
  )
  const searchResultEvents = useMemo(
    () => analyticsInRange.filter(event => event.event_type === 'search_result_open'),
    [analyticsInRange]
  )
  const searchSolutionActionEvents = useMemo(
    () => analyticsInRange.filter(event => event.event_type === 'search_solution_action'),
    [analyticsInRange]
  )
  const searchResolutionEvents = useMemo(
    () => analyticsInRange.filter(event => event.event_type === 'search_resolution'),
    [analyticsInRange]
  )
  const searchResolutionReasonEvents = useMemo(
    () => analyticsInRange.filter(event => event.event_type === 'search_resolution_reason'),
    [analyticsInRange]
  )
  const analyticsUserIdBySession = useMemo(() => {
    const usersBySession = new Map()
    for (const event of analyticsEvents) {
      if (event.session_id && event.user_id) usersBySession.set(event.session_id, event.user_id)
    }
    return usersBySession
  }, [analyticsEvents])
  const partnerAnalyticsEvents = useMemo(
    () => {
      const rows = []
      for (const event of analyticsEvents) {
        const attributedUserId = event.user_id || analyticsUserIdBySession.get(event.session_id) || null
        if (
          !String(event.event_type || '').startsWith('partner_')
          || partnerMetricsExcludedUserIds.has(attributedUserId)
        ) continue
        const metadata = readMetadata(event.metadata)
        const explicitPartnerId = String(metadata.partner_id || metadata.partnerId || '').trim()
        const businessPartnerId = isBusinessPartnerAnalyticsId(explicitPartnerId)
          && businessPartnerAnalyticsIds.has(explicitPartnerId)
          ? explicitPartnerId
          : ''
        const partnerAnalyticsId = businessPartnerId || resolvePartnerAnalyticsId(metadata)
        if (!partnerAnalyticsId) continue
        rows.push({
          ...event,
          user_id:attributedUserId,
          partnerAnalyticsId,
          partnerMetadata:metadata,
        })
      }
      return rows
    },
    [analyticsEvents, analyticsUserIdBySession, businessPartnerAnalyticsIds, partnerMetricsExcludedUserIds]
  )
  const selectedPartner = partnerOptions.find(partner => partner.id === selectedPartnerId)
    || partnerOptions[0]
    || PARTNER_ANALYTICS_PARTNERS[0]
  const partnerMonthRange = useMemo(
    () => calendarMonthRange(partnerMonthPeriod),
    [partnerMonthPeriod],
  )
  const selectedPartnerEvents = useMemo(
    () => partnerAnalyticsEvents.filter(event =>
      event.partnerAnalyticsId === selectedPartner?.id
      && isWithinDateRange(event.created_at, partnerMonthRange)
    ),
    [partnerAnalyticsEvents, partnerMonthRange, selectedPartner?.id]
  )
  const partnerClickEvents = useMemo(
    () => selectedPartnerEvents.filter(event =>
      isPartnerClickAnalyticsEvent(event, selectedPartner)
    ),
    [selectedPartnerEvents, selectedPartner]
  )
  const partnerImpressionEvents = useMemo(
    () => selectedPartnerEvents.filter(event => event.event_type === 'partner_card_impression'),
    [selectedPartnerEvents]
  )
  const partnerServiceEvents = useMemo(
    () => partnerClickEvents.filter(event => event.partnerMetadata.service),
    [partnerClickEvents]
  )
  const partnerLandingClicks = useMemo(
    () => partnerClickEvents.filter(event =>
      getPartnerPlacementMeta(event.partnerMetadata.placement).channel === 'Landing'
    ),
    [partnerClickEvents]
  )
  const partnerAppClicks = useMemo(
    () => partnerClickEvents.filter(event =>
      getPartnerPlacementMeta(event.partnerMetadata.placement).channel === 'App'
    ),
    [partnerClickEvents]
  )
  const partnerAnonymousClicks = useMemo(
    () => partnerClickEvents.filter(event => !event.user_id).length,
    [partnerClickEvents]
  )
  const partnerPlacementRows = useMemo(
    () => topAnalyticsRows(
      partnerClickEvents,
      event => getPartnerPlacementMeta(event.partnerMetadata.placement).label,
      8,
      event => getPartnerPlacementMeta(event.partnerMetadata.placement).channel
    ),
    [partnerClickEvents]
  )
  const partnerServiceRows = useMemo(
    () => topAnalyticsRows(
      partnerServiceEvents,
      event => selectedPartner?.services[event.partnerMetadata.service] || event.partnerMetadata.service || 'Servicio',
      8
    ),
    [partnerServiceEvents, selectedPartner]
  )
  const partnerDailyAccounts = useMemo(() => {
    const profilesById = new Map(users.map(profile => [profile.id, profile]))
    const dailyAccounts = new Map()

    partnerClickEvents.forEach(event => {
      if (!event.user_id) return

      const date = localDateKey(event.created_at)
      if (!date) return

      const key = `${date}:${event.user_id}`
      const placement = getPartnerPlacementMeta(event.partnerMetadata.placement)
      const current = dailyAccounts.get(key) || {
        key,
        date,
        userId:event.user_id,
        created_at:event.created_at,
        lastEventAt:event.created_at,
        origins:new Set(),
        clicks:0,
      }

      current.origins.add(placement.channel)
      current.clicks += 1
      if (String(event.created_at || '') > String(current.lastEventAt || '')) {
        current.lastEventAt = event.created_at
      }
      dailyAccounts.set(key, current)
    })

    return [...dailyAccounts.values()]
      .map(item => {
        const profile = profilesById.get(item.userId)
        return {
          ...item,
          name:profile?.name || 'Usuario sin nombre',
          email:profile?.email || 'Email no disponible',
          origins:[...item.origins].sort(),
        }
      })
      .sort((a, b) => String(b.lastEventAt || '').localeCompare(String(a.lastEventAt || '')))
  }, [partnerClickEvents, users])
  const partnerUniqueAccounts = useMemo(
    () => new Set(partnerDailyAccounts.map(item => item.userId)).size,
    [partnerDailyAccounts]
  )
  const partnerMetricSuffix = partnerMonthRange.shortLabel
  const partnerRangeText = `${partnerMonthRange.monthLabel}, del ${partnerMonthRange.startLabel} al ${partnerMonthRange.endLabel}`
  const topPageRows = useMemo(
    () => topAnalyticsRows(pageViewEvents, event => pageLabel(event.path), 8, event => event.path),
    [pageViewEvents]
  )
  const topSearchRows = useMemo(
    () => topAnalyticsRows(searchEvents, analyticsQuery, 8, analyticsScope),
    [searchEvents]
  )
  const analyticsSessions = useMemo(() => {
    const ids = new Set()
    pageViewEvents.forEach(event => {
      const sessionKey = event.session_id || event.user_id || ''
      if (sessionKey) ids.add(sessionKey)
    })
    return ids.size
  }, [pageViewEvents])
  const searchConversion = useMemo(() => {
    const searches = new Set()
    for (const event of searchEvents) {
      const key = analyticsSearchAttemptKey(event)
      if (key) searches.add(key)
    }
    const opened = new Set()
    for (const event of searchResultEvents) {
      const key = analyticsSearchAttemptKey(event)
      if (searches.has(key)) opened.add(key)
    }
    return {
      searches: searches.size,
      opened: opened.size,
      rate: searches.size ? Math.round((opened.size / searches.size) * 100) : 0,
    }
  }, [searchEvents, searchResultEvents])
  const searchActionRate = searchConversion.rate
  const searchResolution = useMemo(() => {
    const responsesByAttempt = new Map()
    for (const event of searchResolutionEvents) {
      const key = analyticsSearchAttemptKey(event)
      const answer = String(readMetadata(event.metadata).answer || '')
      if (key && SEARCH_RESOLUTION_ANSWER_LABELS[answer]) {
        responsesByAttempt.set(key, answer)
      }
    }

    const answers = [...responsesByAttempt.values()]
    const yes = answers.filter(answer => answer === 'yes').length
    const partial = answers.filter(answer => answer === 'partial').length
    const no = answers.filter(answer => answer === 'no').length
    const total = answers.length
    return {
      total,
      yes,
      partial,
      no,
      confirmedRate:total ? Math.round((yes / total) * 100) : 0,
      helpfulRate:total ? Math.round(((yes + partial) / total) * 100) : 0,
      coverage:searchConversion.searches
        ? Math.min(100, Math.round((total / searchConversion.searches) * 100))
        : 0,
    }
  }, [searchConversion.searches, searchResolutionEvents])
  const searchSolutionActions = useMemo(() => {
    const attempts = new Set()
    for (const event of searchSolutionActionEvents) {
      const key = analyticsSearchAttemptKey(event)
      if (key) attempts.add(key)
    }
    return attempts.size
  }, [searchSolutionActionEvents])
  const searchesWithoutResults = useMemo(() => {
    const attempts = new Set()
    for (const event of searchEvents) {
      const metadata = readMetadata(event.metadata)
      if (Number(metadata.results_count) !== 0) continue
      const key = analyticsSearchAttemptKey(event)
      if (key) attempts.add(key)
    }
    return attempts.size
  }, [searchEvents])
  const topSearchActionRows = useMemo(
    () => topAnalyticsRows(
      searchResultEvents,
      event => readMetadata(event.metadata).query,
      6,
      event => {
        const metadata = readMetadata(event.metadata)
        return [metadata.result_type, metadata.result_label].filter(Boolean).join(' · ')
      }
    ),
    [searchResultEvents]
  )
  const topResultTypeRows = useMemo(
    () => topAnalyticsRows(
      searchResultEvents,
      event => readMetadata(event.metadata).result_type || 'resultado',
      6
    ),
    [searchResultEvents]
  )
  const topUnresolvedSearchRows = useMemo(
    () => topAnalyticsRows(
      searchResolutionEvents.filter(event => ['partial', 'no'].includes(readMetadata(event.metadata).answer)),
      analyticsQuery,
      6,
      event => {
        const metadata = readMetadata(event.metadata)
        return [
          SEARCH_RESOLUTION_ANSWER_LABELS[metadata.answer],
          metadata.result_label,
        ].filter(Boolean).join(' · ')
      }
    ),
    [searchResolutionEvents]
  )
  const topResolutionReasonRows = useMemo(
    () => topAnalyticsRows(
      searchResolutionReasonEvents,
      event => SEARCH_RESOLUTION_REASON_LABELS[readMetadata(event.metadata).reason] || 'Otro motivo',
      6,
      event => SEARCH_RESOLUTION_ANSWER_LABELS[readMetadata(event.metadata).answer] || ''
    ),
    [searchResolutionReasonEvents]
  )
  const pageHourRows = useMemo(() => countByHour(pageViewEvents), [pageViewEvents])
  const searchHourRows = useMemo(() => countByHour(searchEvents), [searchEvents])
  const signupItemsInAnalyticsRange = useMemo(() => metricUsers.filter(profile => isWithinRecentDays(profile.created_at, analyticsDays)), [analyticsDays, metricUsers])
  const publicationItemsInAnalyticsRange = useMemo(() => contentItems.filter(item => isWithinRecentDays(item.created_at, analyticsDays)), [analyticsDays, contentItems])
  const signupHourRows = useMemo(() => countByHour(signupItemsInAnalyticsRange), [signupItemsInAnalyticsRange])
  const publicationHourRows = useMemo(() => countByHour(publicationItemsInAnalyticsRange), [publicationItemsInAnalyticsRange])
  const pageWeekdayRows = useMemo(() => countByWeekday(pageViewEvents), [pageViewEvents])
  const signupWeekdayRows = useMemo(() => countByWeekday(signupItemsInAnalyticsRange), [signupItemsInAnalyticsRange])
  const publicationWeekdayRows = useMemo(() => countByWeekday(publicationItemsInAnalyticsRange), [publicationItemsInAnalyticsRange])
  const analyticsMetricSuffix = analyticsDays === 1 ? 'hoy' : `${analyticsDays}d`
  const analyticsRangeText = analyticsDays === 1 ? 'hoy, de 00:00 a 23:59' : `últimos ${analyticsDays} días`
  const topPageHourRows = useMemo(() => topTimeRows(pageHourRows), [pageHourRows])
  const topSearchHourRows = useMemo(() => topTimeRows(searchHourRows), [searchHourRows])
  const topSignupHourRows = useMemo(() => topTimeRows(signupHourRows), [signupHourRows])
  const topPublicationHourRows = useMemo(() => topTimeRows(publicationHourRows), [publicationHourRows])
  const livePageViewEvents = useMemo(
    () => analyticsEvents.filter(event =>
      event.event_type === 'page_view'
      && !adminUserIds.has(event.user_id)
      && !String(event.path || '').startsWith('/admin-latido')
    ),
    [adminUserIds, analyticsEvents]
  )
  const liveLast14Days = useMemo(
    () => analyticsUnavailable
      ? countByDay(activeChartUsers, 14)
      : countUniqueByDay(livePageViewEvents, 14, event => event.user_id || event.session_id),
    [activeChartUsers, analyticsUnavailable, livePageViewEvents]
  )
  const recentLiveUsers = useMemo(() => {
    const byId = new Map()
    onlineUsers.forEach(profile => byId.set(profile.id, profile))
    recentActiveUsers.forEach(profile => byId.set(profile.id, profile))
    return [...byId.values()].slice(0, 8)
  }, [onlineUsers, recentActiveUsers])
  const liveWeeklyTrend = useMemo(
    () => analyticsUnavailable
      ? periodTrend(activeChartUsers, 7)
      : uniquePeriodTrend(livePageViewEvents, 7, event => event.user_id || event.session_id),
    [activeChartUsers, analyticsUnavailable, livePageViewEvents]
  )
  const activeCantonRows = useMemo(() => {
    const counts = activeUsersWeek.reduce((acc, profile) => {
      const key = profile.canton || 'Sin canton'
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})
    return Object.entries(counts)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
  }, [activeUsersWeek])
  const activeCantonMax = Math.max(...activeCantonRows.map(row => row.value), 1)
  const usersWithActivityBaseline = metricUsers.filter(profile => profile.last_seen_at)
  const liveInactiveUsers = usersWithActivityBaseline.filter(profile => !isWithinRecentDays(profile.last_seen_at, 30)).length
  const liveUntrackedUsers = metricUsers.length - usersWithActivityBaseline.length
  const liveOnlineRate = metricUsers.length ? Math.round((onlineUsers.length / metricUsers.length) * 100) : 0
  const liveTodayRate = metricUsers.length ? Math.round((activeUsersToday.length / metricUsers.length) * 100) : 0
  const liveWeekRate = metricUsers.length ? Math.round((activeUsersWeek.length / metricUsers.length) * 100) : 0
  // DAU/MAU: cuánta de la base mensual vuelve cada día.
  const stickinessRate = percentOf(activeUsersToday.length, activeUsersMonth.length)
  const liveLast14Total = analyticsUnavailable
    ? liveLast14Days.reduce((sum, item) => sum + item.count, 0)
    : (() => {
      const identities = new Set()
      for (const event of livePageViewEvents) {
        if (!isWithinRecentDays(event.created_at, 14)) continue
        const identity = event.user_id || event.session_id
        if (identity) identities.add(identity)
      }
      return identities.size
    })()
  const presenceStatusMeta = {
    subscribed: { label: 'Conectado', color: '#059669', bg: '#D1FAE5', note: 'Canal Presence activo' },
    connecting: { label: 'Conectando', color: '#D97706', bg: '#FEF3C7', note: 'Esperando Supabase Presence' },
    channel_error: { label: 'Reconectando', color: '#D97706', bg: '#FEF3C7', note: 'Reintentando conexión Presence' },
    timed_out: { label: 'Reconectando', color: '#D97706', bg: '#FEF3C7', note: 'Supabase no respondió; reintentando' },
    closed: { label: 'Reconectando', color: '#D97706', bg: '#FEF3C7', note: 'Canal cerrado; abriendo uno nuevo' },
    idle: { label: 'Inactivo', color: '#64748B', bg: '#F1F5F9', note: 'Sin canal abierto' },
  }[presenceStatus] || { label: presenceStatus, color: '#64748B', bg: '#F1F5F9', note: 'Estado realtime' }

  function getLoadDaysForTab(tabId = tab) {
    if (tabId === 'overview') return Math.min(ADMIN_ACTIVITY_RETENTION_DAYS, Math.max(overviewDays * 2, 14))
    if (tabId === 'analytics') return analyticsDays
    if (tabId === 'partners') return Math.min(ADMIN_MAX_DELTA_DAYS, getPartnerMonthlyLoadDays())
    if (tabId === 'live') return 14
    if (tabId === 'users') return userDays
    return 30
  }

  function isRangeSensitiveGroup(group) {
    return ['analytics', 'messages', 'contentMetrics', 'content', 'reports'].includes(group)
  }

  function groupHasRequiredRange(group, days) {
    if (!isRangeSensitiveGroup(group)) return true
    return (dataRangeDaysByGroupRef.current.get(group) || 0) >= days
  }

  useEffect(() => {
    if (tab !== 'live' && tab !== 'overview') {
      setPresenceStatus('idle')
      return undefined
    }

    const stopOnline = subscribeToOnlineUsers(setOnlineUserIds)
    const stopStatus = subscribeToPresenceStatus(setPresenceStatus)

    return () => {
      stopOnline()
      stopStatus()
    }
  }, [tab])

  useEffect(() => {
    loadAdminData({ groups: getAdminTabDataGroups('overview'), days: getLoadDaysForTab('overview') })
  }, [])

  useEffect(() => {
    const groups = getAdminTabDataGroups(tab)
    const needsMoreRange = groups.some(group => !groupHasRequiredRange(group, getLoadDaysForTab(tab)))
    if (needsMoreRange) {
      loadAdminData({ groups, days: getLoadDaysForTab(tab), silent:true })
    }
  }, [overviewDays, analyticsDays, userDays, tab])

  function switchTab(nextTab) {
    setCrmMenuOpen(false)
    setTab(nextTab)
    loadAdminData({ groups: getAdminTabDataGroups(nextTab), days: getLoadDaysForTab(nextTab) })
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    })
  }

  async function loadAdminData(options = {}) {
    const force = options?.force === true
    const silent = options?.silent === true
    const requestedDays = Math.max(1, Math.min(Number(options?.days || getLoadDaysForTab(tab)) || 1, ADMIN_MAX_DELTA_DAYS))
    const requestedGroups = [...new Set(options?.groups || getAdminTabDataGroups(tab))]
    const groups = requestedGroups.filter(group =>
      !loadingDataGroupsRef.current.has(group)
      && !(group === 'contentMetrics' && !force && loadedDataGroupsRef.current.has('content') && groupHasRequiredRange('contentMetrics', requestedDays))
      && (force || !loadedDataGroupsRef.current.has(group) || !groupHasRequiredRange(group, requestedDays))
    )

    if (!groups.length) return

    groups.forEach(group => loadingDataGroupsRef.current.add(group))
    activeLoadCountRef.current += 1
    setDataErrorsByGroup(previous => ({ ...previous, general: '' }))
    setDeltaLoadSummary(previous => silent ? previous : {
      status:'loading',
      groups,
      days:requestedDays,
      fetched:0,
      cached:0,
    })
    if (!silent) setLoading(true)

    try {
      const wantsContent = groups.includes('content')
      const wantsContentMetrics = groups.includes('contentMetrics')
      const contentGroup = wantsContent ? 'content' : 'contentMetrics'
      const skipped = data => ({ data, count: data.length, error: null, skipped: true })
      const [
        reportsRes,
        queueRes,
        usersRes,
        listingsRes,
        jobsRes,
        providersRes,
        analyticsRes,
        messagesRes,
        ratingsRes,
        searchFeedbackRes,
        creatorProfilesRes,
        creatorContentsRes,
        creatorMetricsRes,
      ] = await Promise.all([
        groups.includes('reports') ? fetchAdminReportsDelta({
          cache:dailyRowsCacheRef.current,
          days:requestedDays,
          refreshRecent:force,
        }) : skipped(reports),
        groups.includes('moderation') ? fetchAllAdminRows({
          table: 'moderation_queue',
          transformQuery: query => query.eq('status', 'pending'),
        }) : skipped(queue),
        groups.includes('users')
          ? fetchAllAdminRows({ table: 'profiles', columns: 'id,name,email,canton,interests,banned,banned_reason,banned_at,created_at,last_seen_at' })
          : skipped(users),
        wantsContent || wantsContentMetrics
          ? fetchAdminRowsByDayDelta({
              cache:dailyRowsCacheRef.current,
              cacheKey:`listings:${wantsContent ? 'full' : 'metrics'}`,
              table: 'listings',
              columns: wantsContent
                ? 'id,title,desc,cat,sub,active,user_id,user_name,canton,city,created_at'
                : 'id,active,created_at',
              days:requestedDays,
              refreshRecent:force,
            })
          : skipped(recentListings),
        wantsContent || wantsContentMetrics
          ? fetchAdminRowsByDayDelta({
              cache:dailyRowsCacheRef.current,
              cacheKey:`jobs:${wantsContent ? 'full' : 'metrics'}`,
              table: 'jobs',
              columns: wantsContent
                ? 'id,title,company,desc,sector,active,user_id,canton,city,created_at'
                : 'id,active,created_at',
              days:requestedDays,
              refreshRecent:force,
            })
          : skipped(recentJobs),
        groups.includes('businesses') ? fetchAllAdminRows({ table: 'providers' }) : skipped(businesses),
        groups.includes('analytics') ? fetchAdminRowsByDayDelta({
          cache:dailyRowsCacheRef.current,
          cacheKey:'analytics:events',
          table: 'analytics_events',
          columns: 'id,event_type,path,search,user_id,session_id,metadata,created_at',
          days:requestedDays,
          refreshRecent:force,
          transformQuery: query => query.in('event_type', ADMIN_ANALYTICS_EVENT_TYPES),
        }) : skipped(analyticsEvents),
        groups.includes('messages') ? fetchAdminRowsByDayDelta({
          cache:dailyRowsCacheRef.current,
          cacheKey:'messages:activity',
          table: 'messages',
          columns: 'id,sender_id,created_at',
          days:requestedDays,
          refreshRecent:force,
        }) : skipped(messageEvents),
        groups.includes('feedback')
          ? fetchAllAdminRows({
              table:'latido_ratings',
              columns:'id,user_id,overall_rating,usefulness_rating,comment,usefulness_answer,usefulness_detail,usefulness_comment,usefulness_answered_at,account_created_at,created_at,updated_at',
              orderColumn:'updated_at',
            })
          : skipped(latidoRatings),
        groups.includes('feedback')
          ? fetchAllAdminRows({
              table:'search_resolution_feedback',
              columns:'id,search_attempt_id,user_id,query,result_id,result_type,result_label,answer,reason,had_solution_action,solution_action,time_to_feedback_ms,created_at,updated_at',
              orderColumn:'created_at',
            })
          : skipped(searchFeedback),
        groups.includes('creators')
          ? fetchAllAdminRows({
              table:'creator_profiles',
              columns:'id,owner_id,slug,name,handle,tagline,city,canton,reach,topics,socials,avatar_url,verified,active,status,review_status,helpful_count,saved_count,featured_content_ids,created_at,updated_at',
            })
          : skipped(creatorProfiles),
        groups.includes('creators')
          ? fetchAllAdminRows({
              table:'creator_contents',
              columns:'id,creator_id,title,url,platform,format,topic,canton,status,active,helpful_count,published_at,created_at,updated_at',
            })
          : skipped(creatorContents),
        groups.includes('creators')
          ? fetchAllAdminRows({
              table:'creator_metrics',
              columns:'creator_id,metric,content_id,count,updated_at',
              orderColumn:'updated_at',
              idColumn:'creator_id',
            })
          : skipped(creatorMetricRows),
      ])

      const responses = [
        ['reports', 'reportes', reportsRes],
        ['moderation', 'moderacion', queueRes],
        ['users', 'usuarios', usersRes],
        [contentGroup, 'anuncios', listingsRes],
        [contentGroup, 'empleos', jobsRes],
        ['businesses', 'negocios', providersRes],
        ['analytics', 'analitica', analyticsRes],
        ['messages', 'mensajes', messagesRes],
        ['feedback', 'valoraciones de Latido', ratingsRes],
        ['feedback', 'respuestas de busqueda', searchFeedbackRes],
        ['creators', 'creadores', creatorProfilesRes],
        ['creators', 'contenidos de creadores', creatorContentsRes],
        ['creators', 'metricas de creadores', creatorMetricsRes],
      ]
      const deltaResponses = []
      for (const [group, label, response] of responses) {
        if (groups.includes(group) && response.delta) deltaResponses.push({ label, ...response.delta })
      }
      const deltaTotals = deltaResponses.reduce((acc, item) => ({
        fetched:acc.fetched + (item.fetched || 0),
        cached:acc.cached + (item.cached || 0),
      }), { fetched:0, cached:0 })
      const nextErrors = []
      for (const [group, label, response] of responses) {
        if (groups.includes(group) && response.error) nextErrors.push(`${label}: ${response.error.message}`)
      }

      groups.forEach(group => {
        const groupErrors = []
        for (const [responseGroup, label, response] of responses) {
          if (responseGroup === group && response.error) groupErrors.push(`${label}: ${response.error.message}`)
        }
        setDataErrorsByGroup(previous => ({ ...previous, [group]: groupErrors.join(' · ') }))
      })

      if (groups.includes('analytics') && !analyticsRes.error) {
        setAnalyticsEvents(analyticsRes.data)
        setAnalyticsUnavailable(false)
      } else if (groups.includes('analytics')) {
        setAnalyticsUnavailable(true)
        console.warn('Analytics events unavailable:', analyticsRes.error.message)
      }
      if (groups.includes('messages') && !messagesRes.error) {
        setMessageEvents(messagesRes.data)
        setMessagesUnavailable(false)
      } else if (groups.includes('messages')) {
        setMessagesUnavailable(true)
        console.warn('Messages activity unavailable:', messagesRes.error.message)
      }
      if (groups.includes('creators')) {
        const creatorsFailed = Boolean(creatorProfilesRes.error)
        setCreatorsUnavailable(creatorsFailed)
        if (!creatorsFailed) setCreatorProfiles(creatorProfilesRes.data)
        if (!creatorContentsRes.error) setCreatorContents(creatorContentsRes.data)
        if (!creatorMetricsRes.error) setCreatorMetricRows(creatorMetricsRes.data)
        if (creatorsFailed) console.warn('Creator profiles unavailable:', creatorProfilesRes.error.message)
      }
      if (groups.includes('feedback') && !ratingsRes.error) {
        setLatidoRatings(ratingsRes.data)
      }
      if (groups.includes('feedback') && !searchFeedbackRes.error) {
        setSearchFeedback(searchFeedbackRes.data)
      }

      const nextReports = groups.includes('reports') && !reportsRes.error ? reportsRes.data : []
      const nextQueue = groups.includes('moderation') && !queueRes.error ? queueRes.data : []
      const relatedContent = await fetchAdminContentForItems([
        ...nextReports.filter(item => item.status === 'pending'),
        ...nextQueue,
      ])
      nextErrors.push(...relatedContent.errors)

      const nextContent = new Map()
      ;(wantsContent ? listingsRes.data || [] : []).forEach(item => nextContent.set(`listing:${item.id}`, item))
      ;(wantsContent ? jobsRes.data || [] : []).forEach(item => nextContent.set(`job:${item.id}`, item))
      ;(groups.includes('businesses') ? providersRes.data || [] : []).forEach(item => {
        nextContent.set(`provider:${item.id}`, item)
        nextContent.set(`business:${item.id}`, item)
      })
      relatedContent.entries.forEach(([key, value]) => nextContent.set(key, value))

      if (relatedContent.errors.length) {
        for (const group of groups) {
          if (group !== 'reports' && group !== 'moderation') continue
          setDataErrorsByGroup(previous => ({
            ...previous,
            [group]: [previous[group], ...relatedContent.errors].filter(Boolean).join(' ? '),
          }))
        }
      }

      if (groups.includes('reports') && !reportsRes.error) setReports(nextReports)
      if (groups.includes('moderation') && !queueRes.error) setQueue(nextQueue)
      if (groups.includes('users') && !usersRes.error) setUsers(usersRes.data)
      if ((wantsContent || wantsContentMetrics) && !listingsRes.error) setRecentListings(listingsRes.data)
      if ((wantsContent || wantsContentMetrics) && !jobsRes.error) setRecentJobs(jobsRes.data)
      if (groups.includes('businesses') && !providersRes.error) setBusinesses(providersRes.data)
      if (groups.includes('businesses')) await loadBusinessPromotionAvailability({ silent:true })
      if (nextContent.size) {
        setContentByKey(previous => {
          const merged = new Map(previous)
          nextContent.forEach((value, key) => merged.set(key, value))
          return merged
        })
      }

      groups.forEach(group => loadedDataGroupsRef.current.add(group))
      if (wantsContent) loadedDataGroupsRef.current.add('contentMetrics')
      groups.forEach(group => {
        if (isRangeSensitiveGroup(group)) {
          dataRangeDaysByGroupRef.current.set(group, Math.max(
            dataRangeDaysByGroupRef.current.get(group) || 0,
            requestedDays,
          ))
        }
      })
      if (wantsContent) {
        dataRangeDaysByGroupRef.current.set('contentMetrics', Math.max(
          dataRangeDaysByGroupRef.current.get('contentMetrics') || 0,
          requestedDays,
        ))
      }
      setLoadedDataGroups(new Set(loadedDataGroupsRef.current))
      setDataRangeDaysByGroup(new Map(dataRangeDaysByGroupRef.current))
      setDeltaLoadSummary({
        status:'ready',
        groups,
        days:requestedDays,
        fetched:deltaTotals.fetched,
        cached:deltaTotals.cached,
        at:new Date().toISOString(),
      })
      if (nextErrors.length && !silent) {
        toast.error('Hay apartados sin datos. El panel muestra el detalle del error.')
      }
    } catch (error) {
      setDataErrorsByGroup(previous => ({
        ...previous,
        general: error.message || 'Error inesperado al cargar el panel',
      }))
      setDeltaLoadSummary(previous => ({
        ...(previous || {}),
        status:'error',
        at:new Date().toISOString(),
      }))
      if (!silent) toast.error('No se pudo actualizar el panel')
    } finally {
      groups.forEach(group => loadingDataGroupsRef.current.delete(group))
      activeLoadCountRef.current = Math.max(0, activeLoadCountRef.current - 1)
      if (activeLoadCountRef.current === 0) setLoading(false)
    }
  }

  function metadataOwnerId(item) {
    const m = item?.metadata || {}
    return m.reported_owner_id || m.owner_id || m.author_id || ''
  }

  async function updateReport(report, status) {
    const { data, error } = await supabase
      .from('reports')
      .update({ status, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
      .eq('id', report.id)
      .select('id')
      .maybeSingle()
    if (error) { toast.error(error.message || 'No se pudo actualizar el reporte'); return }
    if (!data) { toast.error('El reporte no se actualizó. Revisa los permisos RLS del administrador.'); return }
    setReports(previous => previous.map(item =>
      item.id === report.id
        ? { ...item, status, reviewed_by:user.id, reviewed_at:new Date().toISOString() }
        : item
    ))
    await logAdminAction({ admin_id: user.id, action_type: `report_${status}`, target_type: report.content_type, target_id: report.content_id, notes: report.reason || '' })
    toast.success('Reporte actualizado')
  }

  async function setUserBanned(profile, banned) {
    const reason = banned ? window.prompt('Motivo del baneo', profile.banned_reason || 'Uso fraudulento') : ''
    if (banned && reason === null) return
    const { data, error } = await supabase.from('profiles')
      .update({ banned, banned_reason: banned ? reason : null, banned_at: banned ? new Date().toISOString() : null })
      .eq('id', profile.id)
      .select('id,banned,banned_reason,banned_at')
      .maybeSingle()
    if (error) { toast.error(error.message || 'No se pudo actualizar el usuario'); return }
    if (!data) { toast.error('El usuario no se actualizó. Revisa los permisos RLS del administrador.'); return }
    setUsers(previous => previous.map(item => item.id === profile.id ? { ...item, ...data } : item))
    await logAdminAction({ admin_id: user.id, action_type: banned ? 'ban_user' : 'unban_user', target_type: 'profile', target_id: profile.id, notes: reason || '' })
    toast.success(banned ? 'Usuario baneado' : 'Usuario reactivado')
  }

  async function updateCreatorProfile(creator, patch, { actionType, successMessage }) {
    setCreatorActionLoading(previous => new Set(previous).add(creator.id))
    try {
      const { data, error } = await supabase
        .from('creator_profiles')
        .update(patch)
        .eq('id', creator.id)
        .select('id,verified,active,status,review_status,updated_at')
        .maybeSingle()

      if (error) { toast.error(error.message || 'No se pudo actualizar el creador'); return }
      if (!data) { toast.error('El creador no se actualizó. Revisa los permisos RLS del administrador.'); return }

      setCreatorProfiles(previous => previous.map(item => item.id === creator.id ? { ...item, ...data } : item))
      await logAdminAction({
        admin_id: user.id,
        action_type: actionType,
        target_type: 'creator_profile',
        target_id: creator.id,
        notes: creator.name || creator.handle || '',
      })
      toast.success(successMessage)
    } finally {
      setCreatorActionLoading(previous => {
        const next = new Set(previous)
        next.delete(creator.id)
        return next
      })
    }
  }

  function setCreatorReview(creator, reviewStatus) {
    return updateCreatorProfile(
      creator,
      { review_status: reviewStatus },
      {
        actionType: `creator_review_${reviewStatus}`,
        successMessage: reviewStatus === 'approved' ? 'Creador aprobado' : reviewStatus === 'rejected' ? 'Creador rechazado' : 'Creador marcado como pendiente',
      },
    )
  }

  function setCreatorVerified(creator, verified) {
    return updateCreatorProfile(
      creator,
      { verified },
      {
        actionType: verified ? 'creator_verify' : 'creator_unverify',
        successMessage: verified ? 'Creador verificado' : 'Verificación retirada',
      },
    )
  }

  function setCreatorActive(creator, active) {
    return updateCreatorProfile(
      creator,
      { active },
      {
        actionType: active ? 'creator_activate' : 'creator_deactivate',
        successMessage: active ? 'Creador visible en el directorio' : 'Creador oculto del directorio',
      },
    )
  }

  function exportCreatorsCsv() {
    downloadCsv(
      `latido-creadores-${swissDateKey(new Date().toISOString())}.csv`,
      [
        { label:'Creador', value:row => row.name || '' },
        { label:'Handle', value:row => row.handle || '' },
        { label:'Email cuenta', value:row => row.ownerEmail || '' },
        { label:'Estado', value:row => creatorStatusMeta(row).label },
        { label:'Revisión', value:row => (CREATOR_REVIEW_META[row.review_status] || {}).label || row.review_status || '' },
        { label:'Verificado', value:row => row.verified ? 'Sí' : 'No' },
        { label:'Ciudad', value:row => row.city || '' },
        { label:'Cantón', value:row => row.canton || '' },
        { label:'Temas', value:row => (row.topics || []).join(' | ') },
        { label:'Contenidos', value:row => row.contentCount },
        { label:'Contenidos publicados', value:row => row.publishedContentCount },
        { label:'Vistas de perfil', value:row => row.profileViews },
        { label:'Impresiones', value:row => row.impressions },
        { label:'Clics', value:row => row.clicks },
        { label:'CTR %', value:row => row.ctr },
        { label:'Compartidos', value:row => row.shares },
        { label:'Clics a redes', value:row => row.socialClicks },
        { label:'Útiles', value:row => row.helpful },
        { label:'Guardados', value:row => row.saved },
        { label:'Alta', value:row => fmtDateShort(row.created_at) },
        { label:'Último contenido', value:row => row.lastPublishedAt ? fmtDateShort(row.lastPublishedAt) : '' },
      ],
      filteredCreators,
    )
    toast.success(`${filteredCreators.length} creadores exportados`)
  }

  function exportUsersCsv() {
    downloadCsv(
      `latido-usuarios-${swissDateKey(new Date().toISOString())}.csv`,
      [
        { label:'Nombre', value:row => row.name || '' },
        { label:'Email', value:row => row.email || '' },
        { label:'Cantón', value:row => row.canton || '' },
        { label:'Intereses', value:row => normalizeInterestIds(row.interests).join(' | ') },
        { label:'Estado', value:row => row.banned ? 'Baneado' : 'Activo' },
        { label:'Motivo baneo', value:row => row.banned_reason || '' },
        { label:'Alta', value:row => fmtDateShort(row.created_at) },
        { label:'Última visita', value:row => row.last_seen_at ? fmtDateShort(row.last_seen_at) : '' },
      ],
      filteredUsers,
    )
    toast.success(`${filteredUsers.length} usuarios exportados`)
  }

  async function setContentActive(type, id, active) {
    const table = MODERATED_CONTENT_TABLES[type]
    if (!table) return
    const { data, error } = await supabase.from(table).update({ active }).eq('id', id).select('id,active').maybeSingle()
    if (error) throw error
    if (!data) throw new Error('No se actualizó el contenido. Revisa los permisos RLS del administrador.')

    const updateItems = previous => previous.map(item =>
      String(item.id) === String(id) ? { ...item, active:data.active } : item
    )
    if (table === 'listings') setRecentListings(updateItems)
    if (table === 'jobs') setRecentJobs(updateItems)
    if (table === 'providers') setBusinesses(updateItems)
    setContentByKey(previous => {
      const key = `${type}:${id}`
      if (!previous.has(key)) return previous
      const next = new Map(previous)
      next.set(key, { ...next.get(key), active:data.active })
      return next
    })

    return data
  }

  function getContentOwnerId(item) {
    if (!item) return ''
    if (item.content_type === 'profile') return item.content_id
    const content = contentByKey.get(`${item.content_type}:${item.content_id}`)
    if (item.content_type === 'message' && content?.sender_id) return content.sender_id
    if (item.content_type === 'creator_profile' && content?.owner_id) return content.owner_id
    if (item.content_type === 'creator_content' && content?.creator_id) {
      return contentByKey.get(`creator_profile:${content.creator_id}`)?.owner_id || item.author_id || metadataOwnerId(item)
    }
    if (canToggleContent(item.content_type) && content?.user_id) return content.user_id
    return item.author_id || metadataOwnerId(item)
  }

  function getUserProfileById(id) {
    if (!id) return null
    return users.find(u => u.id === id) || { id, name: 'Usuario' }
  }

  function getContentOwnerProfile(item) {
    return getUserProfileById(getContentOwnerId(item))
  }

  function getBusinessVerificationDetails(business) {
    const computed = calculateBusinessVerification(business, { existingBusinesses: businesses })
    const storedStatus = getBusinessVerificationStatus(business)
    const hasStoredStatus = !!business?.verification_status && BUSINESS_VERIFICATION_STATUSES[business.verification_status]
    return {
      ...computed,
      score: computed.score,
      status: hasStoredStatus || business?.verified ? storedStatus : computed.status,
    }
  }

  async function persistBusinessVerification(business, patch) {
    const nextPatch = { ...patch }
    const strippedColumns = []

    while (true) {
      const result = await supabase
        .from('providers')
        .update(nextPatch)
        .eq('id', business.id)
        .select('*')
        .maybeSingle()

      if (!result.error) {
        return { ...result, patch: nextPatch, strippedColumns }
      }

      const missingColumn = getMissingColumnName(result.error, 'providers')
      if (
        !missingColumn ||
        !OPTIONAL_PROVIDER_VERIFICATION_COLUMNS.has(missingColumn) ||
        !(missingColumn in nextPatch)
      ) {
        return { ...result, patch: nextPatch, strippedColumns }
      }

      delete nextPatch[missingColumn]
      strippedColumns.push(missingColumn)
    }
  }

  async function updateBusinessVerification(business, status) {
    const details = getBusinessVerificationDetails(business)
    const now = new Date().toISOString()
    let notes = business.verification_notes || null

    if (status === 'rejected') {
      notes = window.prompt('Motivo del rechazo', notes || 'Datos insuficientes o no verificables')
      if (notes === null) return
    }

    const patch = {
      verification_status: status,
      verification_score: details.score,
      verified: status === 'verified',
      ...(status === 'verified' ? {} : { featured:false }),
      verified_at: status === 'verified' ? now : null,
      verified_by: status === 'verified' ? user.id : null,
      verification_notes: status === 'rejected' ? notes : null,
    }

    const { data: savedBusiness, error, patch: savedPatch, strippedColumns } = await persistBusinessVerification(business, patch)
    if (error) {
      toast.error(error.message?.includes('verification_')
        ? 'Aplica primero el SQL de verificacion en Supabase.'
        : error.message || 'No se pudo actualizar el negocio')
      return
    }

    if (!savedBusiness) {
      toast.error('No se guardó el cambio. Revisa la política RLS de providers para permitir actualizar negocios desde admin.')
      return
    }

    setBusinesses(prev => prev.map(item => String(item.id) === String(business.id) ? { ...item, ...savedPatch, ...savedBusiness } : item))

    try {
      await logAdminAction({
        admin_id: user.id,
        action_type: `business_verification_${status}`,
        target_type: 'provider',
        target_id: business.id,
        notes: `Score ${details.score}/100${notes ? ` - ${notes}` : ''}`,
      })
    } catch (error) {
      console.warn('Admin action log failed:', error)
    }
    toast.success(strippedColumns.length
      ? 'Estado guardado'
      : status === 'verified' ? 'Negocio verificado' : 'Estado actualizado')
  }

  async function loadBusinessPromotionAvailability({ silent = false } = {}) {
    const { data, error } = await supabase.rpc('get_business_promotion_availability')

    if (error) {
      setBusinessPromotionUnavailable(true)
      if (!silent) toast.error('Aplica primero el SQL de planes de negocios en Supabase.')
      return false
    }

    setBusinessPromotionAvailability(data || [])
    setBusinessPromotionUnavailable(false)
    return true
  }

  async function updateBusinessPromotionLimit(plan) {
    if (!plan?.key || plan.key === 'free') return

    const nextValue = window.prompt(
      `Cupo máximo para ${plan.label}`,
      String(plan.maxActive ?? ''),
    )
    if (nextValue === null) return

    const maxActive = Number.parseInt(nextValue, 10)
    if (!Number.isInteger(maxActive) || maxActive < 1) {
      toast.error('Introduce un cupo válido mayor que cero')
      return
    }

    const { error } = await supabase.rpc('update_business_promotion_plan', {
      p_plan_key:plan.key,
      p_max_active:maxActive,
      p_enabled:plan.enabled !== false,
      p_rotation_weight:plan.rotationWeight,
    })

    if (error) {
      toast.error(String(error.message || '').includes('LIMIT_BELOW_ACTIVE')
        ? 'El cupo no puede ser menor que los planes activos.'
        : error.message || 'No se pudo actualizar el cupo')
      return
    }

    await loadBusinessPromotionAvailability()
    toast.success(`Cupo de ${plan.label} actualizado`)
  }

  async function setBusinessPromotion(business, planKey) {
    const businessId = business?.id
    if (!businessId || businessPromotionLoading.has(businessId)) return

    const plan = businessPromotionPlans.find(item => item.key === planKey) || getBusinessPromotionMeta(planKey)
    const currentPlanKey = getEffectiveBusinessPromotionPlan(business)
    if (planKey !== 'free' && plan.enabled === false) {
      toast.error('Este plan está desactivado')
      return
    }
    if (
      planKey !== 'free' &&
      currentPlanKey !== planKey &&
      plan.availableSlots != null &&
      plan.availableSlots <= 0
    ) {
      toast.error(`${plan.label} no tiene plazas disponibles`)
      return
    }

    let startsAt = null
    let endsAt = null
    if (planKey !== 'free') {
      const durationValue = window.prompt(
        `Duración en días para ${plan.label}`,
        '30',
      )
      if (durationValue === null) return

      const durationDays = Number.parseInt(durationValue, 10)
      if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 730) {
        toast.error('La duración debe estar entre 1 y 730 días')
        return
      }

      const startsAtDate = new Date()
      const endsAtDate = new Date(startsAtDate.getTime() + durationDays * 86_400_000)
      startsAt = startsAtDate.toISOString()
      endsAt = endsAtDate.toISOString()
    }

    setBusinessPromotionLoading(previous => {
      const next = new Set(previous)
      next.add(businessId)
      return next
    })

    try {
      const { data, error } = await supabase.rpc('set_provider_business_promotion', {
        p_provider_id:businessId,
        p_plan_key:planKey,
        p_starts_at:startsAt,
        p_ends_at:endsAt,
      })

      if (error) throw error
      const savedBusiness = Array.isArray(data) ? data[0] : data
      if (!savedBusiness) throw new Error('No se actualizó el plan del negocio.')

      setBusinesses(previous => previous.map(item =>
        String(item.id) === String(businessId) ? { ...item, ...savedBusiness } : item
      ))

      try {
        await logAdminAction({
          admin_id:user.id,
          action_type:planKey === 'free' ? 'business_promotion_disable' : 'business_promotion_enable',
          target_type:'provider',
          target_id:businessId,
          notes:`${business.name || ''} · ${plan.label}${endsAt ? ` · hasta ${endsAt}` : ''}`,
        })
      } catch (logError) {
        console.warn('Admin action log failed:', logError)
      }

      await loadBusinessPromotionAvailability({ silent:true })
      toast.success(planKey === 'free' ? 'Plan retirado' : `${plan.label} activado`)
    } catch (error) {
      const message = String(error?.message || '')
      toast.error(message.includes('PLAN_FULL')
        ? `${plan.label} ya no tiene plazas disponibles`
        : message.includes('BUSINESS_NOT_VERIFIED')
          ? 'El negocio debe estar activo'
          : message || 'No se pudo actualizar el plan')
    } finally {
      setBusinessPromotionLoading(previous => {
        const next = new Set(previous)
        next.delete(businessId)
        return next
      })
    }
  }

  function renderContentOwnerMeta(item) {
    const p = getContentOwnerProfile(item)
    if (!p?.id) return null
    return (
      <p style={{ fontFamily: PP, fontSize: 11, color: p.banned ? '#B91C1C' : C.light, margin: '8px 0 0', overflowWrap: 'anywhere' }}>
        Autor: {p.name || p.email || p.id}{p.banned ? ' · baneado' : ''}
      </p>
    )
  }

  function banAuthorButtonLabel(item) {
    const p = getContentOwnerProfile(item)
    if (!p?.id) return 'Sin autor'
    if (p.id === user.id) return 'Tu usuario'
    if (p.banned) return 'Autor baneado'
    return 'Banear autor'
  }

  function canBanContentAuthor(item) {
    const p = getContentOwnerProfile(item)
    return !!p?.id && p.id !== user.id && !p.banned
  }

  async function banContentAuthor(item) {
    const p = getContentOwnerProfile(item)
    if (!p?.id) { toast.error('No se encontro el autor'); return }
    if (p.id === user.id) { toast.error('No puedes banear tu propia cuenta'); return }
    if (p.banned) { toast.success('El autor ya esta baneado'); return }
    await setUserBanned(p, true)
  }

  async function resolveQueueItem(item, status) {
    try {
      if (canToggleContent(item.content_type)) {
        await setContentActive(item.content_type, item.content_id, status === 'approved')
      }
      const { data, error } = await supabase
        .from('moderation_queue')
        .update({ status, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
        .eq('id', item.id)
        .select('id')
        .maybeSingle()
      if (error) throw error
      if (!data) throw new Error('La cola no se actualizó. Revisa los permisos RLS del administrador.')
      setQueue(previous => previous.filter(queueItem => queueItem.id !== item.id))
      await logAdminAction({ admin_id: user.id, action_type: `moderation_${status}`, target_type: item.content_type, target_id: item.content_id, notes: item.reason || '' })
      toast.success(status === 'approved' ? 'Contenido aprobado' : 'Contenido eliminado')
    } catch (err) {
      toast.error(err.message || 'No se pudo procesar')
    }
  }

  async function removeReportedContent(report) {
    try {
      if (canToggleContent(report.content_type)) {
        await setContentActive(report.content_type, report.content_id, false)
      } else if (report.content_type === 'message') {
        const { data, error } = await supabase.from('messages').delete().eq('id', report.content_id).select('id').maybeSingle()
        if (error) throw error
        if (!data) throw new Error('El mensaje no se eliminó. Revisa los permisos RLS del administrador.')
      }
      await updateReport(report, 'actioned')
    } catch (err) {
      toast.error(err.message || 'No se pudo eliminar el contenido')
    }
  }

  function renderContentSummary(contentType, contentId, fallback = '') {
    const content = contentByKey.get(`${contentType}:${contentId}`)
    if (!content) return <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: 0 }}>{fallback || 'Contenido no encontrado'}</p>

    if (contentType === 'message') {
      return (
        <p style={{ fontFamily: PP, fontSize: 13, color: C.text, lineHeight: 1.55, margin: 0, fontStyle: 'italic' }}>
          "{content.body}"
        </p>
      )
    }
    if (contentType === 'profile') {
      return (
        <div>
          <p style={{ fontFamily: PP, fontWeight: 800, fontSize: 14, color: C.text, margin: '0 0 3px' }}>{content.name || 'Usuario'}</p>
          <p style={{ fontFamily: PP, fontSize: 12, color: C.mid, lineHeight: 1.5, margin: 0, overflowWrap: 'anywhere' }}>
            {content.email || content.id}{content.canton ? ` · ${content.canton}` : ''}
          </p>
          {content.banned && (
            <p style={{ fontFamily: PP, fontSize: 11, color: '#B91C1C', margin: '5px 0 0' }}>
              Baneado: {content.banned_reason || 'Sin motivo'}
            </p>
          )}
        </div>
      )
    }
    return (
      <div>
        <p style={{ fontFamily: PP, fontWeight: 800, fontSize: 14, color: C.text, margin: '0 0 4px' }}>
          {content.title || content.name || content.company || content.host || 'Sin titulo'}
        </p>
        <p style={{ fontFamily: PP, fontSize: 12, color: C.mid, lineHeight: 1.5, margin: 0 }}>
          {(content.desc || content.description || content.summary || content.tagline || (Array.isArray(content.services) ? content.services.join(', ') : '') || content.contact || '').slice(0, 200)}
        </p>
      </div>
    )
  }

  const pendingQueue = queue.filter(item => item.status === 'pending')
  const pendingReports = reports.filter(item => item.status === 'pending')
  const moderationTypeSet = new Set()
  for (const item of pendingQueue) {
    if (item.content_type) moderationTypeSet.add(item.content_type)
  }
  const moderationTypes = [...moderationTypeSet].sort()
  const reportTypeSet = new Set()
  for (const item of pendingReports) {
    if (item.content_type) reportTypeSet.add(item.content_type)
  }
  const reportTypes = [...reportTypeSet].sort()
  const filteredPendingQueue = pendingQueue.filter(item =>
    moderationTypeFilter === 'all' || item.content_type === moderationTypeFilter
  )
  const filteredPendingReports = pendingReports.filter(item =>
    reportTypeFilter === 'all' || item.content_type === reportTypeFilter
  )
  const pagedModeration = paginate(filteredPendingQueue, moderationPage)
  const pagedReports = paginate(filteredPendingReports, reportPage)
  const businessVerificationCounts = BUSINESS_VERIFICATION_FILTERS.reduce((acc, item) => {
    acc[item.id] = businesses.filter(business => getBusinessVerificationDetails(business).status === item.id).length
    return acc
  }, {})
  const businessQuery = businessSearch.trim().toLowerCase()
  const filteredVerificationBusinesses = []
  for (const business of businesses) {
    if (getBusinessVerificationDetails(business).status !== businessVerificationFilter) continue
    if (businessQuery && ![
      business.name,
      business.category,
      business.city,
      business.canton,
      business.address,
      business.email,
      business.website,
      business.phone,
      business.whatsapp,
    ].some(value => String(value || '').toLowerCase().includes(businessQuery))) continue
    filteredVerificationBusinesses.push(business)
  }
  filteredVerificationBusinesses.sort((a, b) => getBusinessVerificationDetails(b).score - getBusinessVerificationDetails(a).score)
  const pagedBusinesses = paginate(filteredVerificationBusinesses, businessPage)
  const contentQuery = contentSearch.trim().toLowerCase()
  const contentMatches = item => {
    if (contentStatusFilter === 'active' && item.active === false) return false
    if (contentStatusFilter === 'hidden' && item.active !== false) return false
    if (!contentQuery) return true
    return [
      item.title,
      item.company,
      item.desc,
      item.cat,
      item.sub,
      item.sector,
      item.user_name,
      item.canton,
      item.city,
    ].some(value => String(value || '').toLowerCase().includes(contentQuery))
  }
  const filteredListings = recentListings.filter(contentMatches)
  const filteredJobs = recentJobs.filter(contentMatches)
  const pagedListings = paginate(filteredListings, listingPage)
  const pagedJobs = paginate(filteredJobs, jobPage)
  const totalPendingActions = stats.queue + stats.reports + stats.businessVerification + creatorStats.pendingReview
  const activePublications = recentListings.filter(item => item.active !== false).length + recentJobs.filter(item => item.active !== false).length
  const verifiedBusinessCount = businessVerificationCounts.verified || 0
  const adminHealth = totalPendingActions > 0 ? 'Requiere atencion' : 'Todo al dia'
  const adminHealthColor = totalPendingActions > 0 ? '#D97706' : '#059669'
  const activeBusinesses = businesses.filter(business => business.active !== false).length
  const featuredBusinesses = businesses.filter(
    business => getEffectiveBusinessPromotionPlan(business) !== 'free',
  ).length
  const businessAverageScore = businesses.length
    ? Math.round(businesses.reduce((sum, business) => sum + getBusinessVerificationDetails(business).score, 0) / businesses.length)
    : 0
  const overviewMetricSuffix = overviewDays === 1 ? 'hoy' : `${overviewDays}d`
  const overviewPeriodLabel = overviewDays === 1 ? 'Hoy' : `${overviewDays} días`
  const overviewRangeText = overviewDays === 1 ? 'hoy, de 00:00 a 23:59' : `últimos ${overviewDays} días`
  const overviewComparisonText = overviewDays === 1 ? 'hoy con ayer' : `los últimos ${overviewDays} días con los ${overviewDays} anteriores`
  const overviewTargets = {
    activeUsers: Math.max(1, Math.ceil(metricUsers.length * (overviewDays === 1 ? 0.05 : overviewDays === 7 ? 0.14 : 0.25))),
    newUsers: overviewDays === 1 ? 1 : overviewDays === 7 ? 3 : 8,
    businesses: overviewDays === 1 ? 1 : overviewDays === 7 ? 1 : 3,
    listings: overviewDays === 1 ? 1 : overviewDays === 7 ? 4 : 12,
    jobs: overviewDays === 1 ? 1 : overviewDays === 7 ? 2 : 5,
    interactions: overviewDays === 1 ? 20 : overviewDays === 7 ? 120 : 450,
    messages: overviewDays === 1 ? 1 : overviewDays === 7 ? 6 : 20,
  }
  const overviewAnalyticsBaseEvents = analyticsEvents.filter(event =>
    !adminUserIds.has(event.user_id) && !String(event.path || '').startsWith('/admin-latido')
  )
  const overviewInteractionEvents = overviewAnalyticsBaseEvents.filter(event => isWithinRecentDays(event.created_at, overviewDays))
  const overviewMessageBaseEvents = messageEvents.filter(event => !event.sender_id || !adminUserIds.has(event.sender_id))
  const overviewMessageEvents = overviewMessageBaseEvents.filter(event => isWithinRecentDays(event.created_at, overviewDays))
  const activeUsersInOverviewRange = metricUsers.filter(profile => isWithinRecentDays(profile.last_seen_at, overviewDays))
  const recentListingsInOverviewRange = recentListings.filter(item => isWithinRecentDays(item.created_at, overviewDays)).length
  const recentJobsInOverviewRange = recentJobs.filter(item => isWithinRecentDays(item.created_at, overviewDays)).length
  const newCreatorContentInOverviewRange = creatorContents.filter(item => isWithinRecentDays(item.created_at, overviewDays)).length
  const newCreatorsInOverviewRange = countRecent(creatorProfiles, overviewDays)
  const newBusinessesInOverviewRange = countRecent(businesses, overviewDays)
  const newUsersInOverviewRange = countRecent(metricUsers, overviewDays)
  const newContentInOverviewRange = countRecent(contentItems, overviewDays)
  const overviewTotalNewContent = newContentInOverviewRange + newBusinessesInOverviewRange
  const reportsInOverviewRange = countRecent(reports, overviewDays)
  const overviewPageViews = overviewInteractionEvents.filter(event => event.event_type === 'page_view').length
  const overviewSearchInteractions = overviewInteractionEvents.filter(event => event.event_type === 'search' || event.event_type === 'search_result_open').length
  const overviewInteractionCount = overviewInteractionEvents.length
  const overviewMessagesCount = overviewMessageEvents.length
  const overviewEngagementCount = (analyticsUnavailable ? 0 : overviewInteractionCount) + (messagesUnavailable ? 0 : overviewMessagesCount)
  const overviewEngagementText = analyticsUnavailable && messagesUnavailable
    ? 'sin datos de interacción disponibles'
    : `${overviewEngagementCount} señales de interacción`
  const userTrendInOverviewRange = periodTrend(metricUsers, overviewDays)
  const activeTrendInOverviewRange = analyticsUnavailable
    ? null
    : uniquePeriodTrend(
      livePageViewEvents.filter(event => event.user_id),
      overviewDays,
      event => event.user_id
    )
  const businessTrendInOverviewRange = periodTrend(businesses, overviewDays)
  const listingTrendInOverviewRange = periodTrend(recentListings, overviewDays)
  const jobTrendInOverviewRange = periodTrend(recentJobs, overviewDays)
  const creatorContentTrendInOverviewRange = periodTrend(creatorContents, overviewDays)
  const interactionTrendInOverviewRange = analyticsUnavailable ? null : periodTrend(overviewAnalyticsBaseEvents, overviewDays)
  const messageTrendInOverviewRange = messagesUnavailable ? null : periodTrend(overviewMessageBaseEvents, overviewDays)
  const reportsTrendInOverviewRange = periodTrend(reports, overviewDays)
  const lowContentThreshold = overviewDays === 1 ? 1 : overviewDays === 7 ? 3 : 5
  const overviewPerformanceTrends = [
    activeTrendInOverviewRange,
    userTrendInOverviewRange,
    businessTrendInOverviewRange,
    listingTrendInOverviewRange,
    jobTrendInOverviewRange,
    interactionTrendInOverviewRange,
    messageTrendInOverviewRange,
  ].filter(value => value !== null)
  const overviewAverageTrend = averageTrend(overviewPerformanceTrends)
  const overviewPositiveTrendCount = overviewPerformanceTrends.filter(value => value > 10).length
  const overviewNegativeTrendCount = overviewPerformanceTrends.filter(value => value < -20).length
  const overviewTrendAdjustment = overviewAverageTrend > 20 ? 6 : overviewAverageTrend > 8 ? 3 : overviewAverageTrend < -25 ? -8 : overviewAverageTrend < -10 ? -4 : 0
  const overviewPendingPenalty = Math.min(24, totalPendingActions * 4)
  const overviewReportPenalty = Math.min(10, reportsInOverviewRange * 2) + (reportsTrendInOverviewRange > 25 ? 6 : 0)
  const generalScore = Math.max(0, Math.min(100,
    22
    + scoreByTarget(activeUsersInOverviewRange.length, overviewTargets.activeUsers, 18)
    + scoreByTarget(newUsersInOverviewRange, overviewTargets.newUsers, 10)
    + scoreByTarget(newBusinessesInOverviewRange, overviewTargets.businesses, 8)
    + scoreByTarget(recentListingsInOverviewRange, overviewTargets.listings, 10)
    + scoreByTarget(recentJobsInOverviewRange, overviewTargets.jobs, 6)
    + (analyticsUnavailable ? 7 : scoreByTarget(overviewInteractionCount, overviewTargets.interactions, 14))
    + (messagesUnavailable ? 4 : scoreByTarget(overviewMessagesCount, overviewTargets.messages, 8))
    + overviewTrendAdjustment
    - overviewPendingPenalty
    - overviewReportPenalty
  ))
  const generalStatus = generalScore >= 82 ? 'Bueno' : generalScore >= 64 ? 'Estable' : 'Requiere atención'
  const generalTrend = reportsTrendInOverviewRange > 25 || overviewNegativeTrendCount >= 2 || overviewAverageTrend < -18
    ? 'Empeora'
    : overviewPositiveTrendCount >= 2 || overviewAverageTrend > 12
      ? 'Mejora'
      : 'Estable'
  const generalTrendColor = generalTrend === 'Mejora' ? '#059669' : generalTrend === 'Empeora' ? '#DC2626' : '#D97706'
  const generalSuggestions = [
    totalPendingActions > 0 && `Resolver ${totalPendingActions} acciones pendientes para bajar fricción administrativa.`,
    stats.queue > 0 && `Revisar ${stats.queue} elementos en cola antes de que se acumulen publicaciones bloqueadas.`,
    stats.reports > 0 && `Atender ${stats.reports} reportes pendientes para mantener confianza y seguridad.`,
    stats.businessVerification > 0 && `Verificar ${stats.businessVerification} negocios pendientes para mejorar confianza visual.`,
    creatorStats.pendingReview > 0 && `Revisar ${creatorStats.pendingReview} creadores pendientes para que su contenido llegue al directorio.`,
    creatorStats.withoutContent > 0 && `Acompañar a ${creatorStats.withoutContent} creadores sin contenido publicado.`,
    activeUsersInOverviewRange.length < overviewTargets.activeUsers && `Subir actividad: hay ${activeUsersInOverviewRange.length} usuarios activos y el objetivo del periodo es ${overviewTargets.activeUsers}.`,
    newUsersInOverviewRange === 0 && `Atraer usuarios nuevos: no hay altas registradas en ${overviewRangeText}.`,
    newBusinessesInOverviewRange === 0 && overviewDays > 1 && `Impulsar negocios: no hay negocios nuevos en ${overviewRangeText}.`,
    newContentInOverviewRange < lowContentThreshold && `Impulsar publicaciones recientes: hay poca creación de contenido en ${overviewRangeText}.`,
    !analyticsUnavailable && overviewInteractionCount < Math.ceil(overviewTargets.interactions * 0.35) && `Revisar interacción: hay ${overviewInteractionCount} eventos de navegación/búsqueda en ${overviewRangeText}.`,
    !messagesUnavailable && overviewMessagesCount < Math.ceil(overviewTargets.messages * 0.35) && `Fomentar conversaciones: hay ${overviewMessagesCount} mensajes en ${overviewRangeText}.`,
    analyticsUnavailable && 'Conectar analytics_events para que el score mida interacción real de navegación y búsquedas.',
    messagesUnavailable && 'Revisar permisos de messages para que el score mida conversaciones reales.',
    liveUntrackedUsers > metricUsers.length * 0.4 && 'Esperar unos días para leer actividad real: muchos usuarios antiguos aún no tienen last_seen_at.',
  ].filter(Boolean).slice(0, 5)
  const overviewSignals = [
    { label: `Usuarios activos ${overviewMetricSuffix}`, value: activeUsersInOverviewRange.length, trend: activeTrendInOverviewRange, color: '#0F766E' },
    { label: `Usuarios nuevos ${overviewMetricSuffix}`, value: newUsersInOverviewRange, trend: userTrendInOverviewRange, color: C.primary },
    { label: `Negocios nuevos ${overviewMetricSuffix}`, value: newBusinessesInOverviewRange, trend: businessTrendInOverviewRange, color: '#059669' },
    { label: `Anuncios nuevos ${overviewMetricSuffix}`, value: recentListingsInOverviewRange, trend: listingTrendInOverviewRange, color: '#0284C7' },
    { label: `Empleos nuevos ${overviewMetricSuffix}`, value: recentJobsInOverviewRange, trend: jobTrendInOverviewRange, color: '#7C3AED' },
    { label: `Contenidos de creadores ${overviewMetricSuffix}`, value: newCreatorContentInOverviewRange, trend: creatorContentTrendInOverviewRange, color: '#DB2777' },
    { label: `Interacción ${overviewMetricSuffix}`, value: analyticsUnavailable ? 'No disp.' : overviewInteractionCount, trend: interactionTrendInOverviewRange, color: '#0891B2' },
    { label: `Mensajes ${overviewMetricSuffix}`, value: messagesUnavailable ? 'No disp.' : overviewMessagesCount, trend: messageTrendInOverviewRange, color: '#9333EA' },
    { label: `Reportes ${overviewMetricSuffix}`, value: reportsInOverviewRange, trend: reportsTrendInOverviewRange, color: '#DC2626' },
    { label: 'Pendientes ahora', value: totalPendingActions, trend: null, color: adminHealthColor },
  ]
  const topPageMax = Math.max(...topPageRows.map(row => row.value), 1)
  const topSearchMax = Math.max(...topSearchRows.map(row => row.value), 1)

  const isDataGroupReady = group =>
    loadedDataGroups.has(group)
    || (group === 'contentMetrics' && loadedDataGroups.has('content'))
  const isTabDataReady = tabId =>
    getAdminTabDataGroups(tabId).every(isDataGroupReady)
  const isTabDataLoading = tabId =>
    getAdminTabDataGroups(tabId).some(group => loadingDataGroupsRef.current.has(group))
  const navValue = (tabId, value) =>
    !isTabDataReady(tabId) || isTabDataLoading(tabId) ? '...' : value

  const NAV_ITEMS = [
    { id: 'users', icon: '👥', label: 'Usuarios', value: navValue('users', `${stats.users} total`), color: C.primary, bg: C.primaryLight },
    { id: 'creators', icon: '🎬', label: 'Creadores', value: navValue('creators', `${creatorStats.live} activos`), color: '#DB2777', bg: '#FDF2F8', alert: creatorStats.pendingReview },
    { id: 'analytics', icon: '📈', label: 'Uso app', value: navValue('analytics', `${pageViewEvents.length} vistas`), color: '#0284C7', bg: '#E0F2FE' },
    { id: 'feedback', icon: '⭐', label: 'Intereses y valoraciones', short: 'Valoración', value: navValue('feedback', `${totalFeedbackResponses} respuestas`), color: '#B45309', bg: '#FFFBEB' },
    { id: 'partners', icon: '🚀', label: 'Colaboraciones', value: navValue('partners', `${partnerClickEvents.length} salidas`), color: '#4F46E5', bg: '#EEF2FF' },
    { id: 'live', icon: '📡', label: 'Live', value: navValue('live', `${onlineUsers.length} online`), color: '#7C3AED', bg: '#F3E8FF' },
    { id: 'overview', icon: '📊', label: 'Estado general', short: 'Estado', value: navValue('overview', `${generalScore}/100`), color: generalTrendColor, bg: generalTrend === 'Mejora' ? '#ECFDF5' : generalTrend === 'Empeora' ? '#FEF2F2' : '#FFFBEB' },
    { id: 'businessVerification', icon: '✓', label: 'Negocios', value: navValue('businessVerification', `${stats.businessVerification} pend.`), color: '#059669', bg: '#ECFDF5', alert: stats.businessVerification },
    { id: 'content', icon: '📋', label: 'Publicaciones', value: navValue('content', `${stats.content} items`), color: '#0284C7', bg: '#E0F2FE' },
    { id: 'reports', icon: '🚨', label: 'Reportes', value: navValue('reports', `${stats.reports} pend.`), color: '#DC2626', bg: '#FEF2F2', alert: stats.reports },
    { id: 'moderation', icon: '⏳', label: 'Revisión', value: navValue('moderation', `${stats.queue} en cola`), color: '#D97706', bg: '#FFFBEB', alert: stats.queue },
  ]

  const navById = new Map(NAV_ITEMS.map(item => [item.id, item]))
  const NAV_GROUPS = [
    { label: 'Dirección', hint: 'Estado global y decisiones rápidas', items: ['overview', 'live'] },
    { label: 'Crecimiento', hint: 'Usuarios, creadores, valoraciones y colaboraciones', items: ['users', 'creators', 'analytics', 'feedback', 'partners'] },
    { label: 'Operación', hint: 'Negocios, publicaciones y seguridad', items: ['businessVerification', 'content', 'reports', 'moderation'] },
  ]
  const BOTTOM_NAV_ITEMS = []
  for (const id of ['users', 'creators', 'feedback', 'analytics']) {
    const item = navById.get(id)
    if (item) BOTTOM_NAV_ITEMS.push(item)
  }
  const activeRangeValues = []
  for (const group of getAdminTabDataGroups(tab)) {
    if (isRangeSensitiveGroup(group)) activeRangeValues.push(dataRangeDaysByGroup.get(group) || 0)
  }
  const activeRangeDays = Math.max(...activeRangeValues, 0)
  const deltaStatusColor = deltaLoadSummary?.status === 'error'
    ? '#DC2626'
    : deltaLoadSummary?.status === 'loading'
      ? '#D97706'
      : '#059669'
  const deltaStatusBg = deltaLoadSummary?.status === 'error'
    ? '#FEF2F2'
    : deltaLoadSummary?.status === 'loading'
      ? '#FFFBEB'
      : '#ECFDF5'
  const deltaStatusLabel = deltaLoadSummary?.status === 'loading'
    ? `Cargando delta ${deltaLoadSummary.days || getLoadDaysForTab(tab)}d`
    : activeRangeDays
      ? `Delta ${activeRangeDays}d listo`
      : 'Carga ligera'

  const SECTION_TITLES = {
    overview: { icon: '📊', label: 'Estado general' },
    live: { icon: '📡', label: 'Live' },
    creators: { icon: '🎬', label: 'Creadores' },
    analytics: { icon: '📈', label: 'Uso de la app' },
    feedback: { icon: '⭐', label: 'Intereses y valoraciones' },
    partners: { icon: '🚀', label: 'Colaboraciones' },
    moderation: { icon: '⏳', label: 'Revisión manual' },
    reports:    { icon: '🚨', label: 'Reportes pendientes' },
    businessVerification: { icon: '✓', label: 'Verificación de negocios' },
    users:      { icon: '👥', label: 'Usuarios' },
    content:    { icon: '📋', label: 'Contenido reciente' },
  }

  const activeSection = tab === 'content'
    ? { ...SECTION_TITLES.content, label: 'Publicaciones recientes' }
    : SECTION_TITLES[tab]
  const SECTION_DETAILS = {
    overview: { description: `Rapport de ${overviewRangeText} con señales de crecimiento, actividad, pendientes y recomendaciones.`, color: generalTrendColor, count: generalScore, badge: `${generalStatus} · ${generalTrend}` },
    live: { description: 'Online ahora se actualiza en directo; actividad diaria y semanal usa la última consulta a Supabase.', color: '#7C3AED', count: onlineUsers.length, badge: `${onlineUsers.length} online` },
    analytics: { description: `Páginas más usadas, búsquedas frecuentes, soluciones confirmadas y comportamiento de navegación en ${analyticsRangeText}.`, color: '#0284C7', count: pageViewEvents.length, badge: `${pageViewEvents.length} vistas · ${searchEvents.length} búsquedas · ${searchResolution.yes} resueltas` },
    feedback: { description: 'Personas participantes, preferencias, valoraciones, votos de utilidad, búsquedas evaluadas y comentarios completos.', color: '#B45309', count: totalFeedbackResponses, badge: `${identifiedFeedbackUserIds.size} personas · ${totalFeedbackResponses} respuestas` },
    partners: { description: `Salidas reales hacia el colaborador seleccionado, separadas entre landing y app en ${partnerRangeText}.`, color: '#4F46E5', count: partnerClickEvents.length, badge: `${partnerClickEvents.length} salidas · ${partnerLandingClicks.length} landing · ${partnerAppClicks.length} app` },
    moderation: { description: 'Publicaciones retenidas por filtros o pendientes de una decisión manual antes de quedar visibles.', color: '#D97706', count: stats.queue, badge: `${stats.queue} elementos en cola` },
    reports: { description: 'Denuncias de la comunidad que necesitan revision y accion.', color: '#DC2626', count: stats.reports, badge: `${stats.reports} reportes pendientes` },
    businessVerification: { description: 'Evalua datos, contacto y señales antes de mostrar la etiqueta Verificada.', color: '#059669', count: stats.businessVerification, badge: `${stats.businessVerification} negocios pendientes` },
    users: { description: 'Busca cuentas, revisa actividad basica y gestiona baneos. Las métricas excluyen la cuenta admin.', color: C.primary, count: metricUsers.length, badge: `${metricUsers.length} usuarios sin admin` },
    creators: { description: 'Directorio de creadores: alcance, contenido publicado, rendimiento por creador y decisiones de revisión.', color: '#DB2777', count: creatorStats.total, badge: `${creatorStats.live} activos · ${creatorStats.contents} contenidos · ${creatorStats.pendingReview} por revisar` },
    content: { description: 'Control completo de anuncios y empleos publicados en Latido.', color: '#059669', count: stats.content, badge: `${stats.content} publicaciones totales` },
  }
  const activeSectionDetails = SECTION_DETAILS[tab]
  const sectionMetrics = tab === 'overview'
    ? [
        { label: 'Estado', value: loading ? '...' : generalStatus, hint: `Score operativo ${generalScore}/100`, color: generalTrendColor },
        { label: `Usuarios activos ${overviewMetricSuffix}`, value: loading ? '...' : activeUsersInOverviewRange.length, hint: `${newUsersInOverviewRange} usuarios nuevos`, color: '#0F766E' },
        { label: `Contenido ${overviewMetricSuffix}`, value: loading ? '...' : overviewTotalNewContent, hint: `${recentListingsInOverviewRange} anuncios · ${recentJobsInOverviewRange} empleos · ${newBusinessesInOverviewRange} negocios`, color: '#059669' },
        { label: 'Interacción', value: loading ? '...' : (analyticsUnavailable && messagesUnavailable ? 'No disp.' : overviewEngagementCount), hint: `${analyticsUnavailable ? 'sin analytics' : `${overviewPageViews} vistas · ${overviewSearchInteractions} búsquedas`} · ${messagesUnavailable ? 'sin mensajes' : `${overviewMessagesCount} mensajes`}`, color: analyticsUnavailable && messagesUnavailable ? '#D97706' : '#0891B2' },
        { label: `Creadores ${overviewMetricSuffix}`, value: loading ? '...' : creatorStats.live, hint: `${newCreatorsInOverviewRange} altas · ${newCreatorContentInOverviewRange} contenidos nuevos · ${creatorStats.pendingReview} por revisar`, color: '#DB2777', trend: creatorContentTrendInOverviewRange },
        { label: `Tendencia ${overviewMetricSuffix}`, value: loading ? '...' : generalTrend, hint: `Promedio ${overviewAverageTrend > 0 ? '+' : ''}${overviewAverageTrend}% · reportes ${reportsTrendInOverviewRange > 0 ? '+' : ''}${reportsTrendInOverviewRange}%`, color: generalTrendColor },
      ]
    : tab === 'live'
    ? [
        { label: 'Online ahora', value: loading ? '...' : onlineUsers.length, hint: `${liveOnlineRate}% de la base cargada`, color: '#7C3AED' },
        { label: 'Activos hoy', value: loading ? '...' : activeUsersToday.length, hint: `${liveTodayRate}% han abierto Latido`, color: C.primary },
        { label: 'Activos 7 días', value: loading ? '...' : activeUsersWeek.length, hint: `${liveWeekRate}% activos esta semana`, color: '#059669' },
        { label: 'Activos 30 días', value: loading ? '...' : activeUsersMonth.length, hint: `${percentOf(activeUsersMonth.length, metricUsers.length)}% de la base registrada`, color: '#0891B2' },
        { label: 'Fidelidad diaria', value: loading ? '...' : `${stickinessRate}%`, hint: 'Activos hoy sobre activos del mes (DAU/MAU)', color: stickinessRate >= 20 ? '#047857' : stickinessRate >= 10 ? '#B45309' : '#DC2626' },
        { label: 'Conexión live', value: loading ? '...' : presenceStatusMeta.label, hint: presenceStatusMeta.note, color: presenceStatusMeta.color },
        { label: 'Sin registro', value: loading ? '...' : liveUntrackedUsers, hint: 'Usuarios previos al tracking', color: '#D97706' },
      ]
    : tab === 'analytics'
      ? [
          { label: `Vistas ${analyticsMetricSuffix}`, value: loading ? '...' : pageViewEvents.length, hint: `${analyticsSessions} sesiones registradas`, color: '#0284C7' },
          { label: `Búsquedas ${analyticsMetricSuffix}`, value: loading ? '...' : searchEvents.length, hint: 'Términos escritos en barras', color: C.primary },
          { label: 'Búsquedas con apertura', value: loading ? '...' : searchConversion.opened, hint: `${searchActionRate}% de búsquedas únicas`, color: '#059669' },
          { label: 'Solución confirmada', value: loading ? '...' : `${searchResolution.confirmedRate}%`, hint: `${searchResolution.yes} de ${searchResolution.total} respuestas · ${searchResolution.coverage}% cobertura`, color: '#047857' },
          { label: 'Hora fuerte', value: loading ? '...' : strongestTimeLabel(pageHourRows), hint: analyticsUnavailable ? 'Falta tabla analytics_events' : 'Según vistas de página', color: analyticsUnavailable ? '#D97706' : '#0F766E' },
        ]
    : tab === 'feedback'
      ? [
          { label: 'Con intereses', value: loading ? '...' : `${interestCoverage}%`, hint: `${usersWithInterests.length} de ${metricUsers.length} cuentas`, color: '#7C3AED' },
          { label: 'Personas participantes', value: loading ? '...' : identifiedFeedbackUserIds.size, hint: `${identifiedFeedbackCoverage}% de las cuentas · ${anonymousSearchResponses} respuestas anónimas`, color: C.primary },
          { label: 'Valoración Latido', value: loading ? '...' : (metricStarRatings.length ? `${overallRatingAverage}/5` : 'Sin datos'), hint: `${starRatingPeople} personas valoraron`, color: '#B45309' },
          { label: 'Encuentra lo necesario', value: loading ? '...' : (metricStarRatings.length ? `${usefulnessRatingAverage}/5` : 'Sin datos'), hint: 'Media de la segunda pregunta', color: '#047857' },
          { label: 'Búsquedas resueltas', value: loading ? '...' : `${directSearchResolution.confirmedRate}%`, hint: `${directSearchResolution.yes} Sí de ${directSearchResolution.total}`, color: '#059669' },
          { label: 'Respuestas útiles', value: loading ? '...' : `${directSearchResolution.helpfulRate}%`, hint: 'Sí o parcialmente', color: '#0284C7' },
        ]
    : tab === 'partners'
      ? [
          { label: `Vistas tarjeta ${partnerMetricSuffix}`, value: loading ? '...' : partnerImpressionEvents.length, hint: 'Apariciones registradas de la tarjeta', color: '#0284C7' },
          { label: `Total enviado ${partnerMetricSuffix}`, value: loading ? '...' : partnerClickEvents.length, hint: 'Aperturas y contactos del colaborador', color: '#4F46E5' },
          { label: `Cuentas enviadas ${partnerMetricSuffix}`, value: loading ? '...' : partnerDailyAccounts.length, hint: `${partnerUniqueAccounts} perfiles distintos · ${partnerAnonymousClicks} salidas anónimas`, color: '#7C3AED' },
          { label: 'Desde landing', value: loading ? '...' : partnerLandingClicks.length, hint: 'Landing pública de Latido', color: '#2563EB' },
          { label: 'Desde la app', value: loading ? '...' : partnerAppClicks.length, hint: 'Inicio, búsqueda o guías', color: '#0F766E' },
        ]
    : tab === 'users'
      ? [
        { label: 'Nuevos usuarios', value: loading ? '...' : newUsersInRange.length, hint: `Registrados ${userRangeLabel}`, color: C.primary, trend: userTrendInRange },
        { label: 'Usuarios totales', value: loading ? '...' : fmtNumber(metricUsers.length), hint: `Sin contar admin · ${filteredUsers.length} según filtros`, color: C.text },
        { label: 'Activos 7 días', value: loading ? '...' : activeUsersWeek.length, hint: `${percentOf(activeUsersWeek.length, metricUsers.length)}% de la base abrió Latido`, color: '#0F766E' },
        { label: 'Usuarios baneados', value: loading ? '...' : stats.banned, hint: stats.banned ? 'Revisar cuentas bloqueadas' : 'Sin bloqueos activos', color: stats.banned ? '#DC2626' : '#059669' },
        { label: 'Cantones nuevos', value: loading ? '...' : new Set(newUsersInRange.map(u => u.canton).filter(Boolean)).size, hint: `Diversidad en ${userRangeLabel}`, color: '#7C3AED' },
      ]
    : tab === 'creators'
      ? [
          { label: 'Creadores activos', value: loading ? '...' : creatorStats.live, hint: `${creatorStats.total} en total · ${creatorStats.drafts} borradores · ${creatorStats.inactive} ocultos`, color: '#DB2777' },
          { label: 'Pendientes de revisión', value: loading ? '...' : creatorStats.pendingReview, hint: `${creatorStats.verified} verificados · ${creatorStats.rejected} rechazados`, color: creatorStats.pendingReview ? '#B45309' : '#047857' },
          { label: `Nuevos creadores ${creatorRangeText}`, value: loading ? '...' : creatorStats.newCreators, hint: `${creatorStats.newContents} contenidos nuevos`, color: C.primary, trend: creatorStats.creatorTrend },
          { label: 'Contenidos publicados', value: loading ? '...' : fmtNumber(creatorStats.publishedContents), hint: `${creatorStats.contents} totales · ${ratePerItem(creatorStats.contents, creatorStats.total)} por creador`, color: '#0284C7' },
          { label: 'Vistas de perfil', value: loading ? '...' : fmtNumber(creatorStats.profileViews), hint: `${fmtNumber(ratePerItem(creatorStats.profileViews, creatorStats.total, 0))} de media por creador`, color: '#7C3AED' },
          { label: 'Clics en contenido', value: loading ? '...' : fmtNumber(creatorStats.clicks), hint: `${creatorStats.ctr}% CTR sobre ${fmtNumber(creatorStats.impressions)} impresiones`, color: '#0F766E' },
          { label: 'Votos de útil', value: loading ? '...' : fmtNumber(creatorStats.helpful), hint: `${fmtNumber(creatorStats.saved)} guardados · ${fmtNumber(creatorStats.socialClicks)} clics a redes`, color: '#047857' },
        ]
    : tab === 'businessVerification'
      ? [
          { label: 'Negocios activos', value: loading ? '...' : activeBusinesses, hint: `${businesses.length} negocios cargados`, color: '#059669' },
          { label: 'Verificadas', value: loading ? '...' : verifiedBusinessCount, hint: 'Con etiqueta visible en ficha', color: '#0F766E' },
          { label: 'Pendientes', value: loading ? '...' : businessVerificationCounts.pending || 0, hint: 'Esperan decision manual', color: '#D97706' },
          { label: 'Score medio', value: loading ? '...' : `${businessAverageScore}/100`, hint: `${featuredBusinesses} planes activos`, color: C.primary },
        ]
      : tab === 'reports'
        ? [
            { label: 'Reportes pendientes', value: loading ? '...' : stats.reports, hint: 'Necesitan revision', color: '#DC2626' },
            { label: 'Reportes cargados', value: loading ? '...' : reports.length, hint: `Últimos ${ADMIN_ACTIVITY_RETENTION_DAYS} días y pendientes`, color: C.text },
            { label: 'Contenido accionable', value: loading ? '...' : filteredPendingReports.length, hint: 'Pendiente según filtro', color: '#D97706' },
          ]
        : tab === 'moderation'
          ? [
              { label: 'En revision', value: loading ? '...' : stats.queue, hint: 'Cola pendiente', color: '#D97706' },
              { label: 'Cola cargada', value: loading ? '...' : queue.length, hint: 'Solo elementos pendientes', color: C.text },
              { label: 'Acciones pendientes', value: loading ? '...' : totalPendingActions, hint: 'Incluye reportes y negocios', color: adminHealthColor },
            ]
          : [
              { label: 'Publicaciones activas', value: loading ? '...' : activePublications, hint: `${stats.content} totales`, color: '#059669' },
              { label: 'Anuncios', value: loading ? '...' : recentListings.length, hint: 'Total de anuncios', color: C.primary },
              { label: 'Empleos', value: loading ? '...' : recentJobs.length, hint: 'Total de empleos', color: '#0F766E' },
            ]
  const activeChart =
    tab === 'users'
      ? <AdminPeriodChart title="Nuevos usuarios" items={metricUsers} color={C.primary} days={userDays} />
      : tab === 'analytics'
        ? <AdminPeriodChart title="Vistas de página" items={pageViewEvents} color="#0284C7" days={analyticsDays} />
      : tab === 'partners'
        ? <AdminMonthlyChart title={`Salidas a ${selectedPartner?.name || 'partners'}`} items={partnerClickEvents} color="#4F46E5" range={partnerMonthRange} />
      : tab === 'creators'
        ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 12 }}>
            <AdminPeriodChart title="Altas de creadores" items={creatorProfiles} color="#DB2777" days={creatorDays} />
            <AdminPeriodChart title="Contenidos publicados" items={creatorContents} color="#0284C7" days={creatorDays} />
          </div>
        )
      : tab === 'reports'
        ? <AdminChartCard title="Reportes recibidos" items={reports} color="#DC2626" />
        : tab === 'businessVerification'
          ? <AdminChartCard title="Negocios registrados" items={businesses} color="#059669" />
          : tab === 'content'
            ? <AdminChartCard title="Publicaciones" items={[...recentListings, ...recentJobs]} color="#059669" />
          : null
  const showChartPlaceholder = ['users', 'analytics', 'partners', 'reports', 'businessVerification', 'content', 'creators'].includes(tab)
  const topbarPeriodControl = tab === 'overview'
    ? <PeriodSwitch value={overviewDays} onChange={setOverviewDays} />
    : tab === 'analytics'
      ? <PeriodSwitch value={analyticsDays} onChange={setAnalyticsDays} />
      : tab === 'users'
        ? <PeriodSwitch value={userDays} onChange={setUserDays} />
        : tab === 'creators'
          ? <PeriodSwitch value={creatorDays} onChange={setCreatorDays} />
          : tab === 'partners'
            ? <MonthPeriodSwitch value={partnerMonthPeriod} onChange={setPartnerMonthPeriod} />
            : null
  const menuNavActive = crmMenuOpen || !BOTTOM_NAV_ITEMS.some(item => item.id === tab)

  function creatorReviewTag(creator) {
    const meta = CREATOR_REVIEW_META[creator.review_status] || { label:creator.review_status || 'Sin estado', color:C.mid, bg:C.bg }
    return <Tag bg={meta.bg} color={meta.color}>{meta.label}</Tag>
  }

  function renderCreatorActions(creator, { compact = false } = {}) {
    const busy = creatorActionLoading.has(creator.id)
    return (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: compact ? 'flex-start' : 'flex-end' }}>
        {creator.review_status !== 'approved' && (
          <AdminButton variant="success" disabled={busy} onClick={() => setCreatorReview(creator, 'approved')}>✓ Aprobar</AdminButton>
        )}
        {creator.review_status !== 'rejected' && (
          <AdminButton variant="danger" disabled={busy} onClick={() => setCreatorReview(creator, 'rejected')}>✕ Rechazar</AdminButton>
        )}
        <AdminButton disabled={busy} onClick={() => setCreatorVerified(creator, !creator.verified)}>
          {creator.verified ? 'Quitar verificado' : '★ Verificar'}
        </AdminButton>
        <AdminButton
          variant={creator.active === false ? 'success' : 'danger'}
          disabled={busy}
          onClick={() => setCreatorActive(creator, creator.active === false)}
        >
          {creator.active === false ? '↩ Mostrar' : 'Ocultar'}
        </AdminButton>
      </div>
    )
  }

  const creatorTableColumns = [
    {
      key: 'creator',
      label: 'Creador',
      sortId: 'name',
      render: creator => (
        <span style={{ display: 'block', minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: PP, fontWeight: 900, fontSize: 12.5, color: C.text }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 190 }}>
              {creator.name || 'Sin nombre'}
            </span>
            {creator.verified && <span title="Verificado" style={{ color: '#0284C7', fontSize: 12 }}>✔</span>}
          </span>
          <span style={{ display: 'block', fontFamily: PP, fontSize: 10.5, color: C.light, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
            {creator.handle || creator.slug}{creator.canton ? ` · ${creator.canton}` : ''}{creator.ownerEmail ? ` · ${creator.ownerEmail}` : ''}
          </span>
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Estado',
      render: creator => {
        const meta = creatorStatusMeta(creator)
        return (
          <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <Tag bg={meta.bg} color={meta.color}>{meta.label}</Tag>
            {creatorReviewTag(creator)}
          </span>
        )
      },
    },
    {
      key: 'contents',
      label: 'Cont.',
      align: 'right',
      sortId: 'contents',
      render: creator => (
        <span style={{ fontFamily: PP, fontWeight: 900 }}>
          {creator.publishedContentCount}
          <span style={{ color: C.light, fontWeight: 800 }}>/{creator.contentCount}</span>
        </span>
      ),
    },
    { key: 'views', label: 'Vistas', align: 'right', sortId: 'views', render: creator => fmtNumber(creator.profileViews) },
    { key: 'impressions', label: 'Impr.', align: 'right', render: creator => fmtNumber(creator.impressions) },
    { key: 'clicks', label: 'Clics', align: 'right', sortId: 'clicks', render: creator => fmtNumber(creator.clicks) },
    {
      key: 'ctr',
      label: 'CTR',
      align: 'right',
      sortId: 'ctr',
      render: creator => (
        <span style={{ fontFamily: PP, fontWeight: 900, color: creator.ctr >= 10 ? '#047857' : creator.ctr > 0 ? C.text : C.light }}>
          {creator.impressions ? `${creator.ctr}%` : '—'}
        </span>
      ),
    },
    { key: 'helpful', label: 'Útil', align: 'right', sortId: 'helpful', render: creator => fmtNumber(creator.helpful) },
    { key: 'saved', label: 'Guard.', align: 'right', sortId: 'saved', render: creator => fmtNumber(creator.saved) },
    { key: 'created', label: 'Alta', align: 'right', sortId: 'recent', render: creator => fmtDateShort(creator.created_at) },
    {
      key: 'actions',
      label: 'Acciones',
      align: 'right',
      width: 260,
      render: creator => (
        <span onClick={event => event.stopPropagation()} style={{ display: 'block' }}>
          {renderCreatorActions(creator)}
        </span>
      ),
    },
  ]

  function renderCreatorCard(creator) {
    const meta = creatorStatusMeta(creator)
    const open = selectedCreatorId === creator.id

    return (
      <Card key={creator.id} style={{ padding: '12px 14px' }}>
        <button
          type="button"
          onClick={() => setSelectedCreatorId(previous => previous === creator.id ? '' : creator.id)}
          style={{ display: 'block', width: '100%', border: 'none', background: 'transparent', padding: 0, textAlign: 'left', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 14, color: C.text, margin: 0, overflowWrap: 'anywhere' }}>
                {creator.name || 'Sin nombre'}{creator.verified ? ' ✔' : ''}
              </p>
              <p style={{ fontFamily: PP, fontSize: 11, color: C.light, margin: '2px 0 0', overflowWrap: 'anywhere' }}>
                {creator.handle || creator.slug}
                {creator.canton ? ` · ${creator.canton}` : ''}
                {creator.created_at ? ` · alta ${fmtDateShort(creator.created_at)}` : ''}
              </p>
            </div>
            <span style={{ fontFamily: PP, fontSize: 16, fontWeight: 900, color: C.light, flexShrink: 0 }}>{open ? '−' : '+'}</span>
          </div>

          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', margin: '8px 0' }}>
            <Tag bg={meta.bg} color={meta.color}>{meta.label}</Tag>
            {creatorReviewTag(creator)}
            {(creator.topics || []).slice(0, 2).map(topicId => {
              const topic = creatorTopicMeta(topicId)
              return <Tag key={topicId} bg={topic.bg} color={topic.color}>{topic.emoji} {topic.label}</Tag>
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
            {[
              { label:'Contenidos', value:`${creator.publishedContentCount}/${creator.contentCount}` },
              { label:'Vistas', value:fmtNumber(creator.profileViews) },
              { label:'Clics', value:fmtNumber(creator.clicks) },
              { label:'Útiles', value:fmtNumber(creator.helpful) },
            ].map(item => (
              <div key={item.label} style={{ background: C.bgAlt, borderRadius: 12, padding: '7px 8px', minWidth: 0 }}>
                <p style={{ fontFamily: PP, fontSize: 9, fontWeight: 900, color: C.light, margin: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>{item.label}</p>
                <p style={{ fontFamily: PP, fontSize: 13, fontWeight: 900, color: C.text, margin: '2px 0 0' }}>{item.value}</p>
              </div>
            ))}
          </div>
        </button>

        <div style={{ marginTop: 10 }}>
          {renderCreatorActions(creator, { compact: true })}
        </div>
      </Card>
    )
  }

  function renderCreatorDetail(creator) {
    const contents = [...creator.contents].sort(
      (a, b) => String(b.published_at || b.created_at || '').localeCompare(String(a.published_at || a.created_at || ''))
    )

    return (
      <AdminSectionCard
        title={`${creator.name || 'Creador'} · detalle`}
        subtitle={`${creator.handle || creator.slug}${creator.city ? ` · ${creator.city}` : ''}${creator.canton ? ` (${creator.canton})` : ''}${creator.ownerEmail ? ` · ${creator.ownerEmail}` : ''}`}
        action={(
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            <a
              href={`/creadores/${creator.slug}`}
              target="_blank"
              rel="noreferrer"
              style={{ fontFamily: PP, fontSize: 11, fontWeight: 900, color: C.primary, background: C.primaryLight, borderRadius: 10, padding: '9px 12px', textDecoration: 'none' }}
            >
              Ver perfil público ↗
            </a>
            <AdminButton onClick={() => setSelectedCreatorId('')}>Cerrar</AdminButton>
          </div>
        )}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: 8, marginBottom: 14 }}>
          {[
            { label:'Vistas de perfil', value:fmtNumber(creator.profileViews), color:'#7C3AED' },
            { label:'Impresiones', value:fmtNumber(creator.impressions), color:'#0284C7' },
            { label:'Clics', value:fmtNumber(creator.clicks), color:'#0F766E' },
            { label:'CTR', value:creator.impressions ? `${creator.ctr}%` : '—', color:'#047857' },
            { label:'Útiles', value:fmtNumber(creator.helpful), color:'#DB2777' },
            { label:'Guardados', value:fmtNumber(creator.saved), color:C.primary },
            { label:'Compartidos', value:fmtNumber(creator.shares), color:'#B45309' },
            { label:'Clics a redes', value:fmtNumber(creator.socialClicks), color:'#4F46E5' },
          ].map(item => (
            <div key={item.label} style={{ border: `1px solid ${C.border}`, borderRadius: 14, padding: '10px 11px', minWidth: 0 }}>
              <p style={{ fontFamily: PP, fontSize: 9.5, fontWeight: 900, color: C.light, margin: 0, textTransform: 'uppercase', letterSpacing: 0.6 }}>{item.label}</p>
              <p style={{ fontFamily: PP, fontSize: 17, fontWeight: 900, color: item.color, margin: '3px 0 0' }}>{item.value}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
          {(creator.topics || []).map(topicId => {
            const topic = creatorTopicMeta(topicId)
            return <Tag key={topicId} bg={topic.bg} color={topic.color}>{topic.emoji} {topic.label}</Tag>
          })}
          {(creator.socials || []).map(social => {
            const platform = creatorPlatformMeta(social.platform)
            return <Tag key={`${social.platform}-${social.url}`} bg={platform.bg} color={platform.color}>{platform.label}</Tag>
          })}
        </div>

        <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 12, color: C.mid, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Contenidos ({contents.length})
        </p>

        {!contents.length ? (
          <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: 0 }}>Este creador aún no ha publicado contenido.</p>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {contents.map(content => {
              const metrics = creatorMetricIndex.byContent.get(content.id)
              const clicks = metrics?.content_click || 0
              const impressions = metrics?.content_impression || 0
              const platform = creatorPlatformMeta(content.platform)
              const topic = creatorTopicMeta(content.topic)
              const published = content.status === 'published' && content.active !== false

              return (
                <div key={content.id} style={{ border: `1px solid ${C.border}`, borderRadius: 14, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0, flex: '1 1 260px' }}>
                    <a
                      href={content.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontFamily: PP, fontWeight: 900, fontSize: 12.5, color: C.text, textDecoration: 'none', overflowWrap: 'anywhere' }}
                    >
                      {content.title || 'Sin título'} ↗
                    </a>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
                      <Tag bg={platform.bg} color={platform.color}>{platform.label}</Tag>
                      <Tag bg={topic.bg} color={topic.color}>{topic.emoji} {topic.label}</Tag>
                      <Tag bg={published ? '#D1FAE5' : '#FEE2E2'} color={published ? '#065F46' : '#B91C1C'}>
                        {published ? 'Publicado' : content.status === 'draft' ? 'Borrador' : 'Oculto'}
                      </Tag>
                      <Tag bg={C.bg} color={C.mid}>{fmtDateShort(content.published_at || content.created_at)}</Tag>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexShrink: 0 }}>
                    {[
                      { label:'Impr.', value:fmtNumber(impressions) },
                      { label:'Clics', value:fmtNumber(clicks) },
                      { label:'CTR', value:impressions ? `${percentOf(clicks, impressions)}%` : '—' },
                      { label:'Útil', value:fmtNumber(Math.max(0, Number(content.helpful_count) || 0)) },
                    ].map(item => (
                      <div key={item.label} style={{ textAlign: 'right' }}>
                        <p style={{ fontFamily: PP, fontSize: 9, fontWeight: 900, color: C.light, margin: 0, textTransform: 'uppercase' }}>{item.label}</p>
                        <p style={{ fontFamily: PP, fontSize: 13, fontWeight: 900, color: C.text, margin: '2px 0 0' }}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </AdminSectionCard>
    )
  }

  const refreshButton = (
    <button
      onClick={() => loadAdminData({ groups: getAdminTabDataGroups(tab), days: getLoadDaysForTab(tab), force: true })}
      disabled={loading}
      style={{ fontFamily: PP, fontWeight: 900, fontSize: 12, background: C.primary, color: '#fff', border: 'none', borderRadius: 14, padding: '11px 15px', cursor: loading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 7, boxShadow: '0 14px 30px rgba(37,99,235,0.22)', opacity: loading ? 0.72 : 1, whiteSpace: 'nowrap' }}
    >
      <span style={{ fontSize: 14 }}>↻</span> {loading ? 'Actualizando' : 'Actualizar'}
    </button>
  )

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg,#F4F7FB 0%,#EEF4FF 100%)',
      padding: isDesktop
        ? '20px var(--latido-page-gutter) 40px'
        : '14px var(--latido-page-gutter) calc(104px + env(safe-area-inset-bottom))',
    }}>
      <div style={{
        maxWidth: isDesktop ? 1680 : 1180,
        margin: '0 auto',
        display: 'flex',
        alignItems: 'flex-start',
        gap: isDesktop ? 20 : 0,
      }}>
        {isDesktop && (
          <aside style={{
            width: 258,
            flexShrink: 0,
            position: 'sticky',
            top: 20,
            maxHeight: 'calc(100vh - 40px)',
            overflowY: 'auto',
            background: '#fff',
            border: '1px solid rgba(226,234,244,0.95)',
            borderRadius: 24,
            padding: 14,
            boxShadow: '0 18px 46px rgba(15,23,42,0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 4px 14px', borderBottom: `1px solid ${C.borderLight}`, marginBottom: 12 }}>
              <span style={{ width: 38, height: 38, borderRadius: 13, background: `linear-gradient(135deg,${C.primary},#7C3AED)`, display: 'grid', placeItems: 'center', fontSize: 17, flexShrink: 0 }}>
                💓
              </span>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 14, color: C.text, margin: 0, letterSpacing: -0.3 }}>Latido CRM</p>
                <p style={{ fontFamily: PP, fontSize: 10, color: C.light, margin: '1px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.email || 'Panel de administración'}
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 14 }}>
              {NAV_GROUPS.map(group => (
                <div key={group.label}>
                  <p style={{ fontFamily: PP, fontSize: 9.5, fontWeight: 900, letterSpacing: 0.8, textTransform: 'uppercase', color: C.light, margin: '0 0 7px', padding: '0 4px' }}>
                    {group.label}
                  </p>
                  <div style={{ display: 'grid', gap: 4 }}>
                    {group.items.map(id => {
                      const item = navById.get(id)
                      if (!item) return null
                      const active = tab === item.id
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => switchTab(item.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 9,
                            width: '100%',
                            border: 'none',
                            borderRadius: 13,
                            padding: '9px 10px',
                            background: active ? item.bg : 'transparent',
                            color: active ? item.color : C.text,
                            cursor: 'pointer',
                            textAlign: 'left',
                            position: 'relative',
                          }}
                        >
                          <span style={{ width: 28, height: 28, borderRadius: 10, background: active ? '#fff' : C.bgAlt, display: 'grid', placeItems: 'center', fontSize: 13, flexShrink: 0 }}>
                            {item.icon}
                          </span>
                          <span style={{ minWidth: 0, flex: 1 }}>
                            <span style={{ display: 'block', fontFamily: PP, fontWeight: active ? 900 : 800, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.label}
                            </span>
                            <span style={{ display: 'block', fontFamily: PP, fontWeight: 800, fontSize: 9.5, color: active ? item.color : C.light, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.value}
                            </span>
                          </span>
                          {Number(item.alert) > 0 && (
                            <span style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: item.color, color: '#fff', fontFamily: PP, fontSize: 9.5, fontWeight: 900, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                              {item.alert}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.borderLight}`, display: 'grid', gap: 7 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Tag bg={deltaStatusBg} color={deltaStatusColor}>{deltaStatusLabel}</Tag>
                <Tag bg={totalPendingActions ? '#FEF3C7' : '#D1FAE5'} color={totalPendingActions ? '#92400E' : '#047857'}>
                  {totalPendingActions} pendientes
                </Tag>
              </div>
              {deltaLoadSummary?.at && (
                <p style={{ fontFamily: PP, fontSize: 10, color: C.light, margin: 0 }}>
                  Actualizado {fmtActivity(deltaLoadSummary.at)}
                </p>
              )}
            </div>
          </aside>
        )}

        <main style={{ minWidth: 0, flex: '1 1 0' }}>

      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 14,
        flexWrap: 'wrap',
        marginBottom: 14,
        background: 'rgba(255,255,255,0.92)',
        border: '1px solid rgba(226,234,244,0.95)',
        borderRadius: 24,
        padding: isDesktop ? '16px 20px' : 18,
        boxShadow: '0 18px 46px rgba(15,23,42,0.06)',
        position: 'sticky',
        top: isDesktop ? 20 : 0,
        zIndex: 40,
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
      }}>
        <div style={{ minWidth: 200, flex: '1 1 340px' }}>
          <p style={{ fontFamily: PP, fontSize: 10.5, fontWeight: 900, color: activeSectionDetails.color, margin: '0 0 5px', letterSpacing: 0.8, textTransform: 'uppercase' }}>
            {activeSection.icon} Latido CRM · {activeSection.label}
          </p>
          <h1 style={{ fontFamily: PP, fontWeight: 900, fontSize: isDesktop ? 26 : 22, color: C.text, margin: '0 0 5px', letterSpacing: -0.8, lineHeight: 1.1 }}>
            {activeSection.label}
          </h1>
          <p style={{ fontFamily: PP, fontSize: 12, color: C.mid, margin: 0, lineHeight: 1.5, maxWidth: 680 }}>
            {activeSectionDetails.description}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {topbarPeriodControl}
          {refreshButton}
        </div>
      </div>


      {dataErrors.length > 0 && (
        <Card style={{ marginBottom: 14, borderColor: '#FCA5A5', background: '#FEF2F2' }}>
          <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 13, color: '#B91C1C', margin: '0 0 5px' }}>
            Datos incompletos
          </p>
          <p style={{ fontFamily: PP, fontSize: 11, color: '#991B1B', lineHeight: 1.5, margin: 0 }}>
            {dataErrors.join(' · ')}
          </p>
        </Card>
      )}

      {!isTabDataReady(tab) && (
        <Card style={{ marginBottom: 14, textAlign: 'center', padding: '34px 20px' }}>
          <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 14, color: C.text, margin: '0 0 5px' }}>
            {isTabDataLoading(tab)
              ? `Cargando ${activeSection.label.toLowerCase()}`
              : 'Datos no disponibles'}
          </p>
          <p style={{ fontFamily: PP, fontSize: 11, color: C.light, margin: 0 }}>
            {isTabDataLoading(tab)
              ? 'Solo estamos consultando los datos necesarios para esta seccion.'
              : 'Usa Actualizar para volver a intentar esta consulta.'}
          </p>
        </Card>
      )}

      {/* KPI row */}
      {isTabDataReady(tab) && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${isDesktop ? 190 : 155}px, 1fr))`, gap: 10, marginBottom: 16 }}>
          {sectionMetrics.map(metric => (
            <SummaryMetric
              key={metric.label}
              label={metric.label}
              value={metric.value}
              hint={metric.hint}
              color={metric.color}
              trend={metric.trend}
              trendInvert={metric.trendInvert}
            />
          ))}
        </div>
      )}

      {/* Context chart */}
      {isTabDataReady(tab) && !loading && activeChart && tab !== 'partners' && (
        <div style={{ marginBottom: 24 }}>
          {activeChart}
        </div>
      )}

      {isTabDataReady(tab) && loading && showChartPlaceholder && tab !== 'partners' && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 16, padding: '16px', height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: 0 }}>Cargando...</p>
          </div>
        </div>
      )}

      {/* Section context strip: resumen de la sección + frescura de los datos */}
      {isTabDataReady(tab) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14, background: '#fff', border: '1px solid rgba(226,234,244,0.95)', borderRadius: 18, padding: '11px 14px', boxShadow: '0 12px 28px rgba(15,23,42,0.04)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
            <span style={{ width: 32, height: 32, borderRadius: 12, background: `${activeSectionDetails.color}14`, display: 'grid', placeItems: 'center', fontSize: 15, flexShrink: 0 }}>
              {activeSection.icon}
            </span>
            <span style={{ fontFamily: PP, fontSize: 12, fontWeight: 900, color: activeSectionDetails.color, minWidth: 0, lineHeight: 1.4 }}>
              {activeSectionDetails.badge || (tab === 'live' ? `${activeSectionDetails.count} online` : `${activeSectionDetails.count} items`)}
            </span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Tag bg={deltaStatusBg} color={deltaStatusColor}>{deltaStatusLabel}</Tag>
            {deltaLoadSummary?.at && (
              <span style={{ fontFamily: PP, fontSize: 10.5, color: C.light }}>
                Actualizado {fmtActivity(deltaLoadSummary.at)}
              </span>
            )}
          </span>
        </div>
      )}

      {/* ── Estado general ─────────────────────────────── */}
      {tab === 'overview' && isTabDataReady('overview') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card style={{ padding: 0, overflow: 'hidden', borderRadius: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 0 }}>
              <div style={{ padding: 22, background: `linear-gradient(135deg,${generalTrendColor} 0%,#2563EB 100%)`, color: '#fff' }}>
                <p style={{ fontFamily: PP, fontSize: 11, fontWeight: 900, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: 0.8, opacity: 0.86 }}>
                  Rapport {overviewPeriodLabel.toLowerCase()}
                </p>
                <h3 style={{ fontFamily: PP, fontWeight: 900, fontSize: 31, lineHeight: 1.05, margin: '0 0 8px', letterSpacing: -0.8 }}>
                  {generalStatus}
                </h3>
                <p style={{ fontFamily: PP, fontSize: 13, lineHeight: 1.55, margin: '0 0 18px', opacity: 0.9 }}>
                  {activeUsersInOverviewRange.length} usuarios activos, {newUsersInOverviewRange} nuevos, {newBusinessesInOverviewRange} negocios, {recentListingsInOverviewRange} anuncios y {overviewEngagementText} en {overviewRangeText}.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, height: 10, borderRadius: 999, background: 'rgba(255,255,255,0.22)', overflow: 'hidden' }}>
                    <div style={{ width: `${generalScore}%`, height: '100%', borderRadius: 999, background: '#fff' }} />
                  </div>
                  <strong style={{ fontFamily: PP, fontSize: 22, fontWeight: 900 }}>{generalScore}/100</strong>
                </div>
              </div>

              <div style={{ padding: 22, background: '#fff' }}>
                <p style={{ fontFamily: PP, fontSize: 10, fontWeight: 900, color: C.light, textTransform: 'uppercase', letterSpacing: 0.7, margin: '0 0 8px' }}>
                  Lectura automática
                </p>
                <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 22, color: C.text, margin: '0 0 8px', lineHeight: 1.15 }}>
                  La tendencia está {generalTrend.toLowerCase()}.
                </p>
                <p style={{ fontFamily: PP, fontSize: 13, color: C.mid, lineHeight: 1.6, margin: 0 }}>
                  Se calcula sin IA, comparando {overviewComparisonText} en actividad, usuarios nuevos, negocios, anuncios, empleos, navegación, búsquedas, mensajes y reportes.
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 15 }}>
                  <Tag bg={generalTrend === 'Mejora' ? '#D1FAE5' : generalTrend === 'Empeora' ? '#FEE2E2' : '#FEF3C7'} color={generalTrendColor}>
                    {generalTrend}
                  </Tag>
                  <Tag bg={C.bg} color={C.mid}>{overviewPeriodLabel}</Tag>
                  <Tag bg={totalPendingActions ? '#FEF3C7' : '#D1FAE5'} color={totalPendingActions ? '#92400E' : '#047857'}>
                    {totalPendingActions} pendientes
                  </Tag>
                </div>
              </div>
            </div>
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12 }}>
            {overviewSignals.map(signal => (
              <Card key={signal.label} style={{ padding: 15 }}>
                <p style={{ fontFamily: PP, fontSize: 10, fontWeight: 900, color: C.light, textTransform: 'uppercase', letterSpacing: 0.7, margin: '0 0 7px' }}>
                  {signal.label}
                </p>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                  <strong style={{ fontFamily: PP, fontWeight: 900, fontSize: 28, color: signal.color, lineHeight: 1 }}>
                    {loading ? '...' : signal.value}
                  </strong>
                  {signal.trend != null && (
                    <span style={{ fontFamily: PP, fontSize: 11, fontWeight: 900, color: signal.trend > 0 ? '#047857' : signal.trend < 0 ? '#B91C1C' : C.light, background: signal.trend > 0 ? '#D1FAE5' : signal.trend < 0 ? '#FEE2E2' : C.bg, borderRadius: 999, padding: '5px 8px' }}>
                      {signal.trend > 0 ? `+${signal.trend}%` : signal.trend < 0 ? `${signal.trend}%` : '0%'}
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 14 }}>
            <Card style={{ padding: 16, overflow: 'hidden' }}>
              <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 16, color: C.text, margin: '0 0 4px' }}>Sugerencias de mejora</p>
              <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: '0 0 14px' }}>Reglas simples basadas en actividad y carga pendiente.</p>
              <div style={{ display: 'grid', gap: 10 }}>
                {(generalSuggestions.length ? generalSuggestions : ['El panel no detecta bloqueos fuertes ahora mismo. Mantén revisión y reportes al día.']).map((text, index) => (
                  <div key={text} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '11px 12px', border: `1px solid ${C.border}`, borderRadius: 14, background: '#F8FAFF' }}>
                    <span style={{ width: 25, height: 25, borderRadius: 9, background: C.primaryLight, color: C.primary, display: 'grid', placeItems: 'center', fontFamily: PP, fontWeight: 900, fontSize: 12, flexShrink: 0 }}>
                      {index + 1}
                    </span>
                    <p style={{ fontFamily: PP, fontSize: 12, color: C.mid, margin: 0, lineHeight: 1.45 }}>{text}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card style={{ padding: 16 }}>
              <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 16, color: C.text, margin: '0 0 4px' }}>Cola operativa</p>
              <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: '0 0 14px' }}>Qué necesita atención ahora.</p>
              <div style={{ display: 'grid', gap: 10 }}>
                {[
                  { label: 'Revisión de contenido', value: stats.queue, color: '#D97706' },
                  { label: 'Reportes pendientes', value: stats.reports, color: '#DC2626' },
                  { label: 'Negocios por verificar', value: stats.businessVerification, color: '#059669' },
                ].map(item => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => switchTab(item.label.includes('contenido') ? 'moderation' : item.label.includes('Reportes') ? 'reports' : 'businessVerification')}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, border: `1px solid ${C.border}`, borderRadius: 14, padding: '11px 12px', background: '#fff', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <span style={{ fontFamily: PP, fontSize: 12, fontWeight: 900, color: C.text }}>{item.label}</span>
                    <strong style={{ fontFamily: PP, fontSize: 13, color: item.color }}>{item.value} pend.</strong>
                  </button>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* -- Intereses y valoraciones ----------------------- */}
      {tab === 'feedback' && isTabDataReady('feedback') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card style={{ padding: 18, background: 'linear-gradient(135deg,#FFFFFF 0%,#F7FAFF 55%,#FFF9EC 100%)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
              <div>
                <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 17, color: C.text, margin: '0 0 4px' }}>Participación y opinión general</p>
                <p style={{ fontFamily: PP, fontSize: 11.5, color: C.light, lineHeight: 1.5, margin: 0 }}>Quién responde, cuántas respuestas hay y qué señales requieren atención.</p>
              </div>
              <Tag bg={identifiedFeedbackCoverage >= 20 ? '#ECFDF5' : '#FFFBEB'} color={identifiedFeedbackCoverage >= 20 ? '#047857' : '#B45309'}>
                {identifiedFeedbackCoverage}% de participación identificada
              </Tag>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 145px), 1fr))', gap: 9 }}>
              {[
                { label:'Personas identificadas', value:identifiedFeedbackUserIds.size, hint:`de ${metricUsers.length} cuentas`, color:C.primary },
                { label:'Valoraron Latido', value:starRatingPeople, hint:`${metricStarRatings.length} valoraciones`, color:'#B45309' },
                { label:'Votaron utilidad', value:usefulnessFeedbackPeople, hint:`${metricUsefulnessFeedback.length} respuestas`, color:'#047857' },
                { label:'Evaluaron búsquedas', value:searchFeedbackPeople, hint:`${metricSearchFeedback.length} votos · ${anonymousSearchResponses} anónimos`, color:'#0284C7' },
                { label:'Comentarios escritos', value:writtenFeedbackComments, hint:'En valoración o utilidad', color:'#7C3AED' },
                { label:'Señales a revisar', value:feedbackSignalsToReview, hint:`Frente a ${positiveFeedbackSignals} positivas`, color:'#B91C1C' },
              ].map(item => (
                <div key={item.label} style={{ minWidth: 0, border: `1px solid ${C.border}`, borderRadius: 14, padding: '12px 11px', background: 'rgba(255,255,255,0.92)' }}>
                  <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 24, color: item.color, lineHeight: 1, margin: '0 0 6px' }}>{item.value}</p>
                  <p style={{ fontFamily: PP, fontWeight: 850, fontSize: 10.5, color: C.text, margin: '0 0 3px' }}>{item.label}</p>
                  <p style={{ fontFamily: PP, fontSize: 9.5, color: C.light, lineHeight: 1.35, margin: 0 }}>{item.hint}</p>
                </div>
              ))}
            </div>
            <p style={{ fontFamily: PP, fontSize: 10, color: C.light, lineHeight: 1.5, margin: '12px 1px 0' }}>
              “Personas identificadas” cuenta una sola vez a cada cuenta aunque haya respondido en varios apartados. Las respuestas anónimas de búsqueda se contabilizan aparte y la cuenta administradora está excluida.
            </p>
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 14 }}>
            <InsightBarList
              title="Intereses seleccionados"
              subtitle="Preferencias actuales elegidas durante el registro o desde el perfil."
              rows={interestRows}
              color="#7C3AED"
              emptyText="Todavía no hay intereses seleccionados."
            />

            <Card style={{ padding: 18, background: 'linear-gradient(180deg,#FFFFFF,#F7F3FF)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
                <div>
                  <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 16, color: C.text, margin: '0 0 3px' }}>Cobertura de intereses</p>
                  <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: 0, lineHeight: 1.5 }}>Cuántas cuentas han indicado al menos una preferencia.</p>
                </div>
                <Tag bg="#F3E8FF" color="#7C3AED">{interestCoverage}%</Tag>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 9 }}>
                {[
                  { label:'Con intereses', value:usersWithInterests.length, color:'#7C3AED' },
                  { label:'Sin intereses', value:Math.max(0, metricUsers.length - usersWithInterests.length), color:'#D97706' },
                  { label:'Selecciones totales', value:selectedInterestCount, color:C.primary },
                  { label:'Media por cuenta', value:metricUsers.length ? (selectedInterestCount / metricUsers.length).toFixed(1) : '0.0', color:'#0F766E' },
                ].map(item => (
                  <div key={item.label} style={{ border: `1px solid ${C.border}`, borderRadius: 14, padding: '12px 11px', background: '#fff' }}>
                    <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 23, color: item.color, lineHeight: 1, margin: '0 0 5px' }}>{item.value}</p>
                    <p style={{ fontFamily: PP, fontWeight: 800, fontSize: 10, color: C.light, margin: 0 }}>{item.label}</p>
                  </div>
                ))}
              </div>
              <p style={{ fontFamily: PP, fontSize: 10.5, color: C.mid, lineHeight: 1.5, margin: '13px 0 0' }}>
                Cada persona puede elegir hasta tres intereses. Los datos se muestran agregados y excluyen la cuenta administradora.
              </p>
            </Card>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 14 }}>
            <InsightBarList
              title="¿Te parece útil Latido?"
              subtitle={`${metricUsefulnessFeedback.length} respuestas al nuevo banner de inicio.`}
              rows={usefulnessAnswerRows}
              color="#047857"
              emptyText="Todavía no hay respuestas al banner."
            />
            <InsightBarList
              title="Lo que más valoran"
              subtitle="Qué ayudó a quienes respondieron que Latido sí les resulta útil."
              rows={positiveUsefulnessDetailRows}
              color="#047857"
              emptyText="Todavía no hay motivos positivos seleccionados."
            />
            <InsightBarList
              title="Lo que echan en falta"
              subtitle="Necesidades indicadas en respuestas parciales o negativas."
              rows={improvementUsefulnessDetailRows}
              color="#B91C1C"
              emptyText="Todavía no hay aspectos a mejorar seleccionados."
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 14 }}>
            <InsightBarList
              title="¿Qué te parece Latido?"
              subtitle={`Distribución de ${metricStarRatings.length} valoraciones · media ${overallRatingAverage || 0}/5.`}
              rows={overallRatingRows}
              color="#B45309"
              emptyText="Todavía no hay valoraciones de Latido."
            />
            <InsightBarList
              title="¿Encuentras en Latido lo que necesitas?"
              subtitle={`Distribución de respuestas · media ${usefulnessRatingAverage || 0}/5.`}
              rows={usefulnessRatingRows}
              color="#047857"
              emptyText="Todavía no hay respuestas para esta pregunta."
            />
          </div>

          <Card style={{ padding: 18, background: 'linear-gradient(180deg,#FFFFFF,#F3FCF8)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 15 }}>
              <div>
                <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 16, color: C.text, margin: '0 0 3px' }}>¿Encontraron lo que buscaban?</p>
                <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: 0, lineHeight: 1.5 }}>Respuestas guardadas después de una búsqueda, independientemente del consentimiento de métricas.</p>
              </div>
              <Tag bg="#ECFDF5" color="#047857">
                {directSearchResolution.total ? `${directSearchResolution.confirmedRate}% Sí` : 'Sin respuestas'}
              </Tag>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 8 }}>
              {[
                { label:'Total', value:directSearchResolution.total, color:C.text },
                { label:'Sí', value:directSearchResolution.yes, color:'#047857' },
                { label:'Parcial', value:directSearchResolution.partial, color:'#B45309' },
                { label:'No', value:directSearchResolution.no, color:'#B91C1C' },
              ].map(item => (
                <div key={item.label} style={{ minWidth: 0, border: `1px solid ${C.border}`, borderRadius: 14, padding: '12px 8px', background: '#fff' }}>
                  <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 24, color: item.color, lineHeight: 1, margin: '0 0 5px' }}>{item.value}</p>
                  <p style={{ fontFamily: PP, fontWeight: 800, fontSize: 10, color: C.light, margin: 0 }}>{item.label}</p>
                </div>
              ))}
            </div>
            <p style={{ fontFamily: PP, fontSize: 11, color: C.mid, lineHeight: 1.5, margin: '12px 0 0' }}>
              {directSearchResolution.helpfulRate}% respondió Sí o Parcialmente.
            </p>
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 14 }}>
            <InsightBarList
              title="Búsquedas que necesitan mejorar"
              subtitle="Consultas respondidas como Parcialmente o No."
              rows={directUnresolvedSearchRows}
              color="#D97706"
              emptyText="Todavía no hay búsquedas con respuesta negativa o parcial."
            />
            <InsightBarList
              title="Qué podríamos mejorar"
              subtitle="Motivos indicados después de una respuesta parcial o negativa."
              rows={directSearchReasonRows}
              color="#7C3AED"
              emptyText="Todavía no se han indicado motivos."
            />
          </div>

          <Card style={{ padding: 16, background: '#F8FAFF' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 11 }}>
              <div>
                <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 16, color: C.text, margin: '0 0 3px' }}>Explorar todas las respuestas</p>
                <p style={{ fontFamily: PP, fontSize: 11, color: C.light, lineHeight: 1.45, margin: 0 }}>Busca por persona, email, comentario, motivo, consulta o resultado.</p>
              </div>
              <Tag bg="#E0F2FE" color="#0369A1">
                {filteredLatidoRatings.length + filteredUsefulnessFeedback.length + filteredSearchFeedback.length} de {totalFeedbackResponses} visibles
              </Tag>
            </div>
            <div style={{ display: 'flex', alignItems: 'stretch', gap: 9, flexWrap: 'wrap' }}>
              <AdminFilterInput
                value={feedbackSearch}
                onChange={setFeedbackSearch}
                placeholder="Buscar persona, comentario o búsqueda..."
              />
              <div style={{ flex: '0 1 220px', minWidth: 'min(100%, 180px)' }}>
                <AdminFilterSelect value={feedbackToneFilter} onChange={setFeedbackToneFilter} label="Filtrar respuestas por tipo">
                  <option value="all">Todas las respuestas</option>
                  <option value="positive">Positivas</option>
                  <option value="partial">Intermedias</option>
                  <option value="negative">Negativas</option>
                  <option value="comments">Con comentario escrito</option>
                </AdminFilterSelect>
              </div>
              {(feedbackSearch || feedbackToneFilter !== 'all') && (
                <AdminButton onClick={() => { setFeedbackSearch(''); setFeedbackToneFilter('all') }}>Limpiar filtros</AdminButton>
              )}
            </div>
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: 14 }}>
            <Card style={{ padding: 16, overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 13 }}>
                <div>
                  <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 15, color: C.text, margin: '0 0 3px' }}>Votos de utilidad</p>
                  <p style={{ fontFamily: PP, fontSize: 11, color: C.light, margin: 0 }}>Todas las personas, motivos y comentarios.</p>
                </div>
                <Tag bg="#ECFDF5" color="#047857">{filteredUsefulnessFeedback.length}/{metricUsefulnessFeedback.length}</Tag>
              </div>
              <div role="region" aria-label="Listado completo de votos de utilidad" tabIndex={0} style={{ display: 'grid', gap: 9, maxHeight: 560, overflowY: 'auto', paddingRight: 4, scrollbarGutter: 'stable' }}>
                {filteredUsefulnessFeedback.map(rating => {
                  const answerMeta = LATIDO_USEFULNESS_ANSWER_META[rating.usefulness_answer]
                  const profile = userProfilesById.get(rating.user_id)
                  const profileMeta = [profile?.email, profile?.canton ? `Cantón ${profile.canton}` : ''].filter(Boolean).join(' · ')
                  return (
                    <div key={rating.id} style={{ border: `1px solid ${C.border}`, borderRadius: 14, padding: 12, background: '#F8FAFF', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 9 }}>
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: 'block', fontFamily: PP, fontWeight: 900, fontSize: 11.5, color: C.text, overflowWrap: 'anywhere' }}>
                            {profile?.name || profile?.email || 'Usuario sin perfil'}
                          </span>
                          {profileMeta && <span style={{ display: 'block', fontFamily: PP, fontSize: 9.5, color: C.mid, marginTop: 2, overflowWrap: 'anywhere' }}>{profileMeta}</span>}
                          <span style={{ display: 'block', fontFamily: PP, fontSize: 9.5, color: C.light, marginTop: 2 }}>{fmtDate(rating.usefulness_answered_at || rating.updated_at || rating.created_at)}</span>
                        </span>
                        <Tag bg={answerMeta.bg} color={answerMeta.color}>{answerMeta.label}</Tag>
                      </div>
                      <div style={{ borderRadius: 11, padding: '9px 10px', background: '#fff', border: `1px solid ${C.border}`, marginBottom: 7 }}>
                        <p style={{ fontFamily: PP, fontSize: 9, fontWeight: 900, letterSpacing: 0.55, color: C.light, margin: '0 0 3px', textTransform: 'uppercase' }}>Qué indicó</p>
                        <p style={{ fontFamily: PP, fontSize: 10.5, fontWeight: 750, color: C.mid, lineHeight: 1.45, margin: 0, overflowWrap: 'anywhere' }}>
                          {LATIDO_USEFULNESS_DETAIL_LABELS[rating.usefulness_detail] || 'Sin opción adicional'}
                        </p>
                      </div>
                      <p style={{ fontFamily: PP, fontSize: 10.5, color: rating.usefulness_comment ? C.text : C.light, fontStyle: rating.usefulness_comment ? 'normal' : 'italic', lineHeight: 1.5, margin: 0, padding: rating.usefulness_comment ? '8px 10px' : 0, borderRadius: 10, background: rating.usefulness_comment ? '#FFF' : 'transparent', overflowWrap: 'anywhere' }}>
                        {rating.usefulness_comment ? `“${rating.usefulness_comment}”` : 'Sin comentario escrito'}
                      </p>
                    </div>
                  )
                })}
                {!filteredUsefulnessFeedback.length && (
                  <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: 0 }}>{metricUsefulnessFeedback.length ? 'Ningún voto coincide con los filtros.' : 'Todavía no hay respuestas al banner.'}</p>
                )}
              </div>
            </Card>

            <Card style={{ padding: 16, overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 13 }}>
                <div>
                  <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 15, color: C.text, margin: '0 0 3px' }}>Valoraciones de Latido</p>
                  <p style={{ fontFamily: PP, fontSize: 11, color: C.light, margin: 0 }}>Las dos puntuaciones y el comentario completo.</p>
                </div>
                <Tag bg="#FFFBEB" color="#B45309">{filteredLatidoRatings.length}/{metricStarRatings.length}</Tag>
              </div>
              <div role="region" aria-label="Listado completo de valoraciones de Latido" tabIndex={0} style={{ display: 'grid', gap: 9, maxHeight: 560, overflowY: 'auto', paddingRight: 4, scrollbarGutter: 'stable' }}>
                {filteredLatidoRatings.map(rating => {
                  const profile = userProfilesById.get(rating.user_id)
                  const profileMeta = [profile?.email, profile?.canton ? `Cantón ${profile.canton}` : ''].filter(Boolean).join(' · ')
                  const tone = ratingFeedbackTone(rating)
                  const toneMeta = tone === 'positive'
                    ? { label:'Positiva', color:'#047857', bg:'#ECFDF5' }
                    : tone === 'negative'
                      ? { label:'A revisar', color:'#B91C1C', bg:'#FEF2F2' }
                      : { label:'Intermedia', color:'#B45309', bg:'#FFFBEB' }
                  return (
                    <div key={rating.id} style={{ border: `1px solid ${C.border}`, borderRadius: 14, padding: 12, background: '#F8FAFF', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 9 }}>
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: 'block', fontFamily: PP, fontWeight: 900, fontSize: 11.5, color: C.text, overflowWrap: 'anywhere' }}>{profile?.name || profile?.email || 'Usuario sin perfil'}</span>
                          {profileMeta && <span style={{ display: 'block', fontFamily: PP, fontSize: 9.5, color: C.mid, marginTop: 2, overflowWrap: 'anywhere' }}>{profileMeta}</span>}
                          <span style={{ display: 'block', fontFamily: PP, fontSize: 9.5, color: C.light, marginTop: 2 }}>{fmtDate(rating.updated_at || rating.created_at)}</span>
                        </span>
                        <Tag bg={toneMeta.bg} color={toneMeta.color}>{toneMeta.label}</Tag>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 7, marginBottom: 8 }}>
                        <div style={{ borderRadius: 11, padding: '9px 8px', background: '#fff', border: `1px solid ${C.border}` }}>
                          <p style={{ fontFamily: PP, fontSize: 9, color: C.light, fontWeight: 850, margin: '0 0 3px' }}>LATIDO</p>
                          <p style={{ fontFamily: PP, fontSize: 14, color: '#B45309', fontWeight: 900, margin: 0 }}>★ {rating.overall_rating}/5</p>
                        </div>
                        <div style={{ borderRadius: 11, padding: '9px 8px', background: '#fff', border: `1px solid ${C.border}` }}>
                          <p style={{ fontFamily: PP, fontSize: 9, color: C.light, fontWeight: 850, margin: '0 0 3px' }}>ENCUENTRA LO NECESARIO</p>
                          <p style={{ fontFamily: PP, fontSize: 14, color: '#047857', fontWeight: 900, margin: 0 }}>★ {rating.usefulness_rating}/5</p>
                        </div>
                      </div>
                      <p style={{ fontFamily: PP, fontSize: 10.5, color: rating.comment ? C.text : C.light, fontStyle: rating.comment ? 'normal' : 'italic', lineHeight: 1.5, margin: 0, padding: rating.comment ? '8px 10px' : 0, borderRadius: 10, background: rating.comment ? '#FFF' : 'transparent', overflowWrap: 'anywhere' }}>
                        {rating.comment ? `“${rating.comment}”` : 'Sin comentario escrito'}
                      </p>
                    </div>
                  )
                })}
                {!filteredLatidoRatings.length && (
                  <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: 0 }}>{metricStarRatings.length ? 'Ninguna valoración coincide con los filtros.' : 'Todavía no hay valoraciones.'}</p>
                )}
              </div>
            </Card>

            <Card style={{ padding: 16, overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 13 }}>
                <div>
                  <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 15, color: C.text, margin: '0 0 3px' }}>Votos sobre búsquedas</p>
                  <p style={{ fontFamily: PP, fontSize: 11, color: C.light, margin: 0 }}>Persona, consulta, resultado, motivo y acción.</p>
                </div>
                <Tag bg="#E0F2FE" color="#0369A1">{filteredSearchFeedback.length}/{metricSearchFeedback.length}</Tag>
              </div>
              <div role="region" aria-label="Listado completo de votos sobre búsquedas" tabIndex={0} style={{ display: 'grid', gap: 9, maxHeight: 560, overflowY: 'auto', paddingRight: 4, scrollbarGutter: 'stable' }}>
                {filteredSearchFeedback.map(item => {
                  const answerMeta = SEARCH_RESOLUTION_ANSWER_META[item.answer] || SEARCH_RESOLUTION_ANSWER_META.no
                  const profile = userProfilesById.get(item.user_id)
                  const profileMeta = [profile?.email, profile?.canton ? `Cantón ${profile.canton}` : ''].filter(Boolean).join(' · ')
                  return (
                    <div key={item.id} style={{ border: `1px solid ${C.border}`, borderRadius: 14, padding: 12, background: '#F8FAFF', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 9 }}>
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: 'block', fontFamily: PP, fontWeight: 900, fontSize: 11.5, color: C.text, overflowWrap: 'anywhere' }}>{profile?.name || profile?.email || 'Respuesta anónima'}</span>
                          {profileMeta && <span style={{ display: 'block', fontFamily: PP, fontSize: 9.5, color: C.mid, marginTop: 2, overflowWrap: 'anywhere' }}>{profileMeta}</span>}
                          <span style={{ display: 'block', fontFamily: PP, fontSize: 9.5, color: C.light, marginTop: 2 }}>{fmtDate(item.updated_at || item.created_at)}</span>
                        </span>
                        <Tag bg={answerMeta.bg} color={answerMeta.color}>{answerMeta.label}</Tag>
                      </div>
                      <div style={{ display: 'grid', gap: 6 }}>
                        <div style={{ borderRadius: 11, padding: '9px 10px', background: '#fff', border: `1px solid ${C.border}` }}>
                          <p style={{ fontFamily: PP, fontSize: 9, fontWeight: 900, letterSpacing: 0.55, color: C.light, margin: '0 0 3px', textTransform: 'uppercase' }}>Búsqueda</p>
                          <p style={{ fontFamily: PP, fontSize: 11, fontWeight: 850, color: C.text, lineHeight: 1.45, margin: 0, overflowWrap: 'anywhere' }}>“{item.query}”</p>
                        </div>
                        <div style={{ display: 'grid', gap: 3, padding: '2px 1px' }}>
                          <p style={{ fontFamily: PP, fontSize: 10, color: C.mid, lineHeight: 1.45, margin: 0, overflowWrap: 'anywhere' }}><strong>Resultado:</strong> {[item.result_label, humanizeFeedbackValue(item.result_type)].filter(Boolean).join(' · ') || 'Sin resultado identificado'}</p>
                          <p style={{ fontFamily: PP, fontSize: 10, color: C.mid, lineHeight: 1.45, margin: 0, overflowWrap: 'anywhere' }}><strong>Motivo:</strong> {SEARCH_RESOLUTION_REASON_LABELS[item.reason] || 'No indicó motivo'}</p>
                          <p style={{ fontFamily: PP, fontSize: 10, color: C.mid, lineHeight: 1.45, margin: 0, overflowWrap: 'anywhere' }}><strong>Acción previa:</strong> {item.had_solution_action ? (humanizeFeedbackValue(item.solution_action) || 'Acción registrada') : 'Ninguna'}</p>
                          <p style={{ fontFamily: PP, fontSize: 10, color: C.light, lineHeight: 1.45, margin: 0 }}><strong>Tiempo hasta votar:</strong> {formatFeedbackDuration(item.time_to_feedback_ms)}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
                {!filteredSearchFeedback.length && (
                  <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: 0 }}>{metricSearchFeedback.length ? 'Ningún voto de búsqueda coincide con los filtros.' : 'Todavía no hay respuestas de búsqueda.'}</p>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* -- Uso de la app ---------------------------------- */}
      {tab === 'analytics' && isTabDataReady('analytics') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {analyticsUnavailable && (
            <Card style={{ borderColor: '#F59E0B', background: '#FFFBEB' }}>
              <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 15, color: '#92400E', margin: '0 0 5px' }}>
                Tracking pendiente de activar
              </p>
              <p style={{ fontFamily: PP, fontSize: 12, color: '#92400E', lineHeight: 1.55, margin: 0 }}>
                El panel ya está preparado, pero Supabase no devuelve la tabla analytics_events. Cuando exista, aquí aparecerán páginas más usadas y búsquedas reales.
              </p>
            </Card>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 14 }}>
            <Card style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                <div>
                  <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 16, color: C.text, margin: '0 0 3px' }}>Páginas más usadas</p>
                  <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: 0 }}>Agrupado por sección en {analyticsRangeText}.</p>
                </div>
                <Tag bg="#E0F2FE" color="#0284C7">{pageViewEvents.length} vistas</Tag>
              </div>

              <div style={{ display: 'grid', gap: 11, minWidth: 0, overflow: 'hidden' }}>
                {topPageRows.map((row, index) => (
                  <div key={row.label} style={{ minWidth: 0, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                      <div style={{ minWidth: 0, maxWidth: '100%', flex: '1 1 0', display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                        <span style={{ width: 24, height: 24, borderRadius: 9, background: '#E0F2FE', color: '#0284C7', display: 'grid', placeItems: 'center', fontFamily: PP, fontWeight: 900, fontSize: 11, flexShrink: 0 }}>
                          {index + 1}
                        </span>
                        <div style={{ minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
                          <p style={{ fontFamily: PP, fontSize: 12, fontWeight: 900, color: C.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.label}</p>
                          <p style={{ fontFamily: PP, fontSize: 10, color: C.light, margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.sub}</p>
                        </div>
                      </div>
                      <strong style={{ fontFamily: PP, fontSize: 12, color: '#0284C7', flexShrink: 0 }}>{row.value}</strong>
                    </div>
                    <div style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', height: 8, borderRadius: 999, background: C.bg, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.max(8, Math.round((row.value / topPageMax) * 100))}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,#0284C7,#2563EB)' }} />
                    </div>
                  </div>
                ))}
                {!topPageRows.length && (
                  <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: 0, lineHeight: 1.5 }}>
                    Todavía no hay vistas registradas. Empezará a llenarse cuando los usuarios naveguen con el tracking activo.
                  </p>
                )}
              </div>
            </Card>

            <Card style={{ padding: 16, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                <div>
                  <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 16, color: C.text, margin: '0 0 3px' }}>Búsquedas frecuentes</p>
                  <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: 0 }}>Términos escritos en búsqueda global, anuncios y comunidad en {analyticsRangeText}.</p>
                </div>
                <Tag bg={C.primaryLight} color={C.primary}>{searchEvents.length} búsquedas</Tag>
              </div>

              <div style={{ display: 'grid', gap: 11, minWidth: 0, overflow: 'hidden' }}>
                {topSearchRows.map((row, index) => (
                  <div key={row.label} style={{ minWidth: 0, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                      <div style={{ minWidth: 0, maxWidth: '100%', flex: '1 1 0', display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                        <span style={{ width: 24, height: 24, borderRadius: 9, background: C.primaryLight, color: C.primary, display: 'grid', placeItems: 'center', fontFamily: PP, fontWeight: 900, fontSize: 11, flexShrink: 0 }}>
                          {index + 1}
                        </span>
                        <div style={{ minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
                          <p style={{ fontFamily: PP, fontSize: 12, fontWeight: 900, color: C.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.label}</p>
                          <p style={{ fontFamily: PP, fontSize: 10, color: C.light, margin: '2px 0 0' }}>{row.sub}</p>
                        </div>
                      </div>
                      <strong style={{ fontFamily: PP, fontSize: 12, color: C.primary, flexShrink: 0 }}>{row.value}</strong>
                    </div>
                    <div style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', height: 8, borderRadius: 999, background: C.bg, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.max(8, Math.round((row.value / topSearchMax) * 100))}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,#2563EB,#10B981)' }} />
                    </div>
                  </div>
                ))}
                {!topSearchRows.length && (
                  <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: 0, lineHeight: 1.5 }}>
                    Todavía no hay búsquedas registradas. Se guardan solo términos de 2 o más caracteres con una pequeña pausa.
                  </p>
                )}
              </div>
            </Card>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 14 }}>
            <InsightBarList
              title="Horas con más navegación"
              subtitle="Cuándo se abren más páginas de Latido."
              rows={topPageHourRows}
              color="#0284C7"
              emptyText="Sin vistas suficientes para detectar horas fuertes."
            />
            <InsightBarList
              title="Horas de búsqueda"
              subtitle="Cuándo la gente escribe más en las barras de búsqueda."
              rows={topSearchHourRows}
              color={C.primary}
              emptyText="Sin búsquedas suficientes para detectar horarios."
            />
            <InsightBarList
              title="Altas por hora"
              subtitle={`Nuevas cuentas creadas en ${analyticsRangeText}.`}
              rows={topSignupHourRows}
              color="#7C3AED"
              emptyText="Sin nuevas cuentas recientes."
            />
            <InsightBarList
              title="Publicaciones por hora"
              subtitle={`Anuncios y empleos creados en ${analyticsRangeText}.`}
              rows={topPublicationHourRows}
              color="#059669"
              emptyText="Sin publicaciones recientes."
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 14 }}>
            <InsightBarList
              title="Días con más navegación"
              subtitle="Distribución semanal de vistas de página."
              rows={pageWeekdayRows.some(row => row.value > 0) ? pageWeekdayRows : []}
              color="#0284C7"
              emptyText="Sin navegación suficiente por día."
            />
            <InsightBarList
              title="Días de nuevas cuentas"
              subtitle="Qué días se registran más usuarios."
              rows={signupWeekdayRows.some(row => row.value > 0) ? signupWeekdayRows : []}
              color="#7C3AED"
              emptyText="Sin altas recientes por día."
            />
            <InsightBarList
              title="Días de publicación"
              subtitle="Qué días se crean más anuncios y empleos."
              rows={publicationWeekdayRows.some(row => row.value > 0) ? publicationWeekdayRows : []}
              color="#059669"
              emptyText="Sin publicaciones recientes por día."
            />
            <InsightBarList
              title="Resultados abiertos"
              subtitle="Qué tipo de resultado abre la gente desde búsqueda."
              rows={topResultTypeRows}
              color="#0F766E"
              emptyText="Todavía no hay aperturas desde búsqueda."
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 14 }}>
            <Card style={{ padding: 16, background: 'linear-gradient(180deg,#FFFFFF,#F8FAFF)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
                <div>
                  <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 16, color: C.text, margin: '0 0 3px' }}>Embudo de búsqueda</p>
                  <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: 0 }}>Desde la consulta hasta una acción útil sobre el resultado.</p>
                </div>
                <Tag bg="#ECFDF5" color="#047857">{searchActionRate}% acción</Tag>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(92px, 1fr))', gap: 8 }}>
                {[
                  { label: 'Búsquedas únicas', value: searchConversion.searches, color: C.primary },
                  { label: 'Con apertura', value: searchConversion.opened, color: '#059669' },
                  { label: 'Con acción útil', value: searchSolutionActions, color: '#0F766E' },
                  { label: 'Sin resultados', value: searchesWithoutResults, color: '#DC2626' },
                ].map(item => (
                  <div key={item.label} style={{ border: `1px solid ${C.border}`, borderRadius: 14, padding: '11px 10px', background: '#fff' }}>
                    <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 22, color: item.color, lineHeight: 1, margin: '0 0 4px' }}>{item.value}</p>
                    <p style={{ fontFamily: PP, fontWeight: 800, fontSize: 10, color: C.light, margin: 0 }}>{item.label}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card style={{ padding: 16, background: 'linear-gradient(180deg,#FFFFFF,#F3FCF8)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
                <div>
                  <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 16, color: C.text, margin: '0 0 3px' }}>Soluciones encontradas</p>
                  <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: 0 }}>Respuesta directa después de revisar un resultado.</p>
                </div>
                <Tag bg="#ECFDF5" color="#047857">
                  {searchResolution.total ? `${searchResolution.confirmedRate}% confirmada` : 'Sin respuestas'}
                </Tag>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 7 }}>
                {[
                  { label: 'Respuestas', value: searchResolution.total, color: C.text },
                  { label: 'Sí', value: searchResolution.yes, color: '#047857' },
                  { label: 'Parcial', value: searchResolution.partial, color: '#B45309' },
                  { label: 'No', value: searchResolution.no, color: '#B91C1C' },
                ].map(item => (
                  <div key={item.label} style={{ border: `1px solid ${C.border}`, borderRadius: 13, padding: '10px 8px', background: '#fff' }}>
                    <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 21, color: item.color, lineHeight: 1, margin: '0 0 4px' }}>{item.value}</p>
                    <p style={{ fontFamily: PP, fontWeight: 800, fontSize: 9.5, color: C.light, margin: 0 }}>{item.label}</p>
                  </div>
                ))}
              </div>
              <p style={{ fontFamily: PP, fontSize: 10.5, color: C.mid, lineHeight: 1.5, margin: '11px 0 0' }}>
                {searchResolution.helpfulRate}% respondió Sí o Parcialmente · {searchResolution.coverage}% de las búsquedas únicas tiene respuesta.
              </p>
            </Card>

            <InsightBarList
              title="Términos que abren resultados"
              subtitle="Búsquedas que terminaron en clic o Enter sobre un resultado."
              rows={topSearchActionRows}
              color="#059669"
              emptyText="Todavía no hay términos con apertura registrada."
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 14 }}>
            <InsightBarList
              title="Búsquedas que necesitan mejorar"
              subtitle="Consultas respondidas como Parcialmente o No."
              rows={topUnresolvedSearchRows}
              color="#D97706"
              emptyText="Todavía no hay búsquedas con respuesta negativa o parcial."
            />
            <InsightBarList
              title="Qué faltó"
              subtitle="Motivos elegidos después de una respuesta parcial o negativa."
              rows={topResolutionReasonRows}
              color="#7C3AED"
              emptyText="Todavía no se han indicado motivos."
            />
          </div>

          <Card style={{ padding: 16, background: '#fff' }}>
            <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 15, color: C.text, margin: '0 0 3px' }}>Cómo se mide</p>
            <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: '0 0 14px', lineHeight: 1.55 }}>
              La navegación, las búsquedas y las respuestas salen de analytics_events. Estas métricas representan las sesiones que aceptaron la analítica.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 10 }}>
              {[
                { label: 'Páginas usadas', note: 'Agrupa rutas como Inicio, Anuncios, Comunidad, Mensajes o Detalle de anuncio.', color: '#0284C7' },
                { label: 'Búsquedas', note: 'Cada intento tiene un identificador propio, el término, los filtros y el número de resultados.', color: C.primary },
                { label: 'Aperturas', note: 'Registra cuando una persona abre un resultado de búsqueda con clic o Enter.', color: '#059669' },
                { label: 'Acciones útiles', note: 'Detecta llamadas, WhatsApp, email, webs externas y botones para contactar o enviar mensajes.', color: '#0F766E' },
                { label: 'Resoluciones', note: 'Pregunta si encontró lo necesario y separa respuestas Sí, Parcialmente y No.', color: '#047857' },
                { label: 'Contenido faltante', note: 'Muestra búsquedas sin resultados y los motivos indicados en respuestas parciales o negativas.', color: '#DC2626' },
                { label: 'Horarios', note: 'Usa la hora local del created_at para detectar horas y días con más movimiento.', color: '#7C3AED' },
              ].map(item => (
                <div key={item.label} style={{ border: `1px solid ${C.border}`, borderRadius: 14, padding: 12, background: '#F8FAFF' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 999, background: item.color, display: 'inline-block', marginBottom: 8 }} />
                  <p style={{ fontFamily: PP, fontSize: 12, fontWeight: 900, color: C.text, margin: '0 0 4px' }}>{item.label}</p>
                  <p style={{ fontFamily: PP, fontSize: 11, color: C.light, margin: 0, lineHeight: 1.45 }}>{item.note}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ── Partners ───────────────────────────────────── */}
      {tab === 'partners' && isTabDataReady('partners') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {analyticsUnavailable && (
            <Card style={{ borderColor: '#F59E0B', background: '#FFFBEB' }}>
              <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 15, color: '#92400E', margin: '0 0 5px' }}>
                Métricas no disponibles
              </p>
              <p style={{ fontFamily: PP, fontSize: 12, color: '#92400E', lineHeight: 1.55, margin: 0 }}>
                Esta sección usa analytics_events. Revisa la tabla o sus permisos si los clics no aparecen.
              </p>
            </Card>
          )}

          <Card style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
              <div>
                <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 16, color: C.text, margin: '0 0 3px' }}>Colaboraciones</p>
                <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: 0 }}>Selecciona un colaborador para consultar sus resultados por mes natural.</p>
              </div>
              <Tag bg="#EEF2FF" color="#4F46E5">{partnerMonthRange.monthLabel}</Tag>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))', gap: 10 }}>
              {partnerOptions.map(partner => {
                const active = selectedPartner?.id === partner.id
                const clicks = partnerAnalyticsEvents.filter(event =>
                  event.partnerAnalyticsId === partner.id
                  && isWithinDateRange(event.created_at, partnerMonthRange)
                  && isPartnerClickAnalyticsEvent(event, partner)
                ).length

                return (
                  <button
                    key={partner.id}
                    type="button"
                    onClick={() => setSelectedPartnerId(partner.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 11,
                      width: '100%',
                      padding: 12,
                      borderRadius: 16,
                      border: `1.5px solid ${active ? partner.color : C.border}`,
                      background: active ? partner.tint : '#fff',
                      cursor: 'pointer',
                      textAlign: 'left',
                      boxShadow: active ? `0 12px 28px ${partner.color}16` : 'none',
                    }}
                  >
                    <span style={{ width: 42, height: 42, borderRadius: 13, background: '#fff', border: `1px solid ${C.border}`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      <img src={partner.logo} alt="" style={{ width: 32, height: 32, objectFit: 'contain' }} />
                    </span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <strong style={{ display: 'block', fontFamily: PP, fontSize: 13, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{partner.name}</strong>
                      <span style={{ display: 'block', fontFamily: PP, fontSize: 10, fontWeight: 800, color: active ? partner.color : C.light, marginTop: 3 }}>
                        {partner.isBusinessPartner ? `${partner.planKey === 'premium' ? 'Premium' : 'Básica'} · ` : ''}{clicks} salidas · {partnerMonthRange.monthLabel}
                      </span>
                    </span>
                    <span aria-hidden="true" style={{ color: active ? partner.color : C.light, fontWeight: 900 }}>›</span>
                  </button>
                )
              })}
            </div>
          </Card>

          {!loading && activeChart && (
            <div style={{ marginBottom: 10 }}>
              {activeChart}
            </div>
          )}

          {loading && showChartPlaceholder && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 16, padding: '16px', height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: PP, fontSize: 12, color: C.light }}>Cargando gráfico...</span>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 14 }}>
            <Card style={{ padding: 16, background: 'linear-gradient(145deg,#FFFFFF,#F6F8FF)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 16 }}>
                <span style={{ width: 46, height: 46, borderRadius: 15, background: '#fff', border: `1px solid ${C.border}`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <img src={selectedPartner?.logo} alt="" style={{ width: 35, height: 35, objectFit: 'contain' }} />
                </span>
                <div>
                  <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 16, color: C.text, margin: '0 0 3px' }}>{selectedPartner?.name}</p>
                  <p style={{ fontFamily: PP, fontSize: 11, color: C.light, margin: 0 }}>Aperturas y contactos del colaborador en {partnerRangeText}.</p>
                </div>
              </div>

              {[
                { label: 'Landing', value: partnerLandingClicks.length, color: '#2563EB' },
                { label: 'App', value: partnerAppClicks.length, color: '#0F766E' },
              ].map(row => {
                const max = Math.max(partnerLandingClicks.length, partnerAppClicks.length, 1)
                const share = partnerClickEvents.length ? Math.round((row.value / partnerClickEvents.length) * 100) : 0
                return (
                  <div key={row.label} style={{ marginTop: 13 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontFamily: PP, fontWeight: 900, fontSize: 12, color: C.text }}>{row.label}</span>
                      <span style={{ fontFamily: PP, fontWeight: 900, fontSize: 12, color: row.color }}>{row.value} · {share}%</span>
                    </div>
                    <div style={{ height: 10, borderRadius: 999, overflow: 'hidden', background: C.bg }}>
                      <div style={{ width: `${row.value ? Math.max(8, Math.round((row.value / max) * 100)) : 0}%`, height: '100%', borderRadius: 999, background: row.color }} />
                    </div>
                  </div>
                )
              })}
            </Card>

            <InsightBarList
              title="Origen de las salidas"
              subtitle="Detalle de dónde se abrió la página LIVE: landing, inicio, búsqueda o guías."
              rows={partnerPlacementRows}
              color="#4F46E5"
              emptyText="Todavía no hay salidas reales hacia este partner en el periodo."
            />

            <InsightBarList
              title="Servicios consultados"
              subtitle="Opción elegida antes de abrir la página LIVE, cuando se pulsó un servicio concreto."
              rows={partnerServiceRows}
              color="#0F766E"
              emptyText="Todavía no hay salidas desde una opción de servicio."
            />

          </div>

          <Card style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
              <div>
                <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 16, color: C.text, margin: '0 0 3px' }}>Cuentas enviadas por día</p>
                <p style={{ fontFamily: PP, fontSize: 12, color: C.light, lineHeight: 1.5, margin: 0 }}>
                  Cada perfil aparece una sola vez por fecha, aunque abra el partner varias veces. Las salidas sin una cuenta identificada no pueden mostrar email.
                </p>
              </div>
              <Tag bg="#F3E8FF" color="#7C3AED">{partnerDailyAccounts.length} registros diarios</Tag>
            </div>

            <div style={{ display: 'grid', gap: 9 }}>
              {partnerDailyAccounts.map(account => (
                <div
                  key={account.key}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 13px',
                    border: `1px solid ${C.border}`,
                    borderRadius: 15,
                    background: '#F8FAFF',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 12, color: C.text, margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {account.name}
                    </p>
                    <p style={{ fontFamily: PP, fontSize: 11, color: C.mid, margin: 0, overflowWrap: 'anywhere' }}>
                      {account.email}
                    </p>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                      {account.origins.map(origin => (
                        <Tag
                          key={origin}
                          bg={origin === 'Landing' ? '#EFF6FF' : '#ECFDF5'}
                          color={origin === 'Landing' ? '#2563EB' : '#0F766E'}
                        >
                          {origin}
                        </Tag>
                      ))}
                      <Tag bg="#F3E8FF" color="#7C3AED">1 cuenta contabilizada</Tag>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', alignSelf: 'start' }}>
                    <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 11, color: C.text, margin: '0 0 3px', whiteSpace: 'nowrap' }}>
                      {new Date(`${account.date}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                    </p>
                    <p style={{ fontFamily: PP, fontSize: 9, color: C.light, margin: 0, whiteSpace: 'nowrap' }}>
                      {new Date(`${account.date}T12:00:00`).toLocaleDateString('es-ES', { year: 'numeric' })}
                    </p>
                  </div>
                </div>
              ))}

              {!partnerDailyAccounts.length && (
                <p style={{ fontFamily: PP, fontSize: 12, color: C.light, lineHeight: 1.5, margin: 0 }}>
                  Todavía no hay cuentas enviadas en el periodo seleccionado.
                </p>
              )}
            </div>
          </Card>

          <Card style={{ padding: 16, background: '#fff' }}>
            <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 15, color: C.text, margin: '0 0 4px' }}>Qué significa cada número</p>
            <p style={{ fontFamily: PP, fontSize: 12, color: C.light, lineHeight: 1.6, margin: 0 }}>
              “Total enviado” cuenta cada apertura o contacto registrado hacia el colaborador. “Cuentas enviadas” agrupa por perfil y fecha: tres clics de una misma cuenta hoy cuentan como una cuenta; si vuelve mañana, genera una nueva fila para mañana. “Landing” y “App” son partes del total de aperturas. Las cuentas admin y test@g.com quedan excluidas.
            </p>
          </Card>
        </div>
      )}

      {/* ── Moderación ─────────────────────────────────── */}
      {tab === 'moderation' && isTabDataReady('moderation') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Card style={{ padding: 16, background: '#FFFBEB', borderColor: '#FDE68A' }}>
            <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 15, color: '#92400E', margin: '0 0 5px' }}>Qué significa revisión</p>
            <p style={{ fontFamily: PP, fontSize: 12, color: '#92400E', lineHeight: 1.55, margin: 0 }}>
              Aquí aparecen publicaciones retenidas por filtros automáticos o marcadas para decisión manual. El objetivo es aprobar contenido válido, eliminar contenido problemático o bloquear al autor si el caso lo requiere.
            </p>
          </Card>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <AdminFilterSelect
              label="Tipo de contenido en moderación"
              value={moderationTypeFilter}
              onChange={value => { setModerationTypeFilter(value); setModerationPage(1) }}
            >
              <option value="all">Todos los tipos ({pendingQueue.length})</option>
              {moderationTypes.map(type => <option key={type} value={type}>{type}</option>)}
            </AdminFilterSelect>
          </div>
          {filteredPendingQueue.length === 0 ? (
            <EmptyState icon="✅" text="No hay contenido pendiente con este filtro." />
          ) : pagedModeration.items.map(item => (
            <Card key={item.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Tag bg="#FEF3C7" color="#92400E">{STATUS_LABELS[item.status] || item.status}</Tag>
                  <Tag bg={C.bg} color={C.mid}>{item.content_type}</Tag>
                </div>
                <span style={{ fontFamily: PP, fontSize: 11, color: C.light, whiteSpace: 'nowrap' }}>{fmtDate(item.created_at)}</span>
              </div>
              {renderContentSummary(item.content_type, item.content_id, item.excerpt)}
              {renderContentOwnerMeta(item)}
              <p style={{ fontFamily: PP, fontSize: 11, color: C.light, margin: '8px 0 12px' }}>
                Motivo: {item.reason || 'Filtro automático'}{item.matched_term ? ` · término: "${item.matched_term}"` : ''}
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <AdminButton variant="success" onClick={() => resolveQueueItem(item, 'approved')}>✓ Aprobar</AdminButton>
                <AdminButton variant="danger"  onClick={() => resolveQueueItem(item, 'rejected')}>✕ Eliminar</AdminButton>
                <AdminButton variant="danger" disabled={!canBanContentAuthor(item)} onClick={() => banContentAuthor(item)}>
                  🚫 {banAuthorButtonLabel(item)}
                </AdminButton>
              </div>
            </Card>
          ))}
          <AdminPagination
            page={pagedModeration.page}
            pageCount={pagedModeration.pageCount}
            total={filteredPendingQueue.length}
            onChange={setModerationPage}
          />
        </div>
      )}

      {/* ── Reportes ───────────────────────────────────── */}
      {tab === 'reports' && isTabDataReady('reports') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <AdminFilterSelect
              label="Tipo de contenido reportado"
              value={reportTypeFilter}
              onChange={value => { setReportTypeFilter(value); setReportPage(1) }}
            >
              <option value="all">Todos los tipos ({pendingReports.length})</option>
              {reportTypes.map(type => <option key={type} value={type}>{type}</option>)}
            </AdminFilterSelect>
          </div>
          {filteredPendingReports.length === 0 ? (
            <EmptyState icon="✅" text="No hay reportes pendientes con este filtro." />
          ) : pagedReports.items.map(report => (
            <Card key={report.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Tag bg="#FEE2E2" color="#B91C1C">{reasonLabel(report.reason)}</Tag>
                  <Tag bg={C.bg} color={C.mid}>{report.content_type}</Tag>
                </div>
                <span style={{ fontFamily: PP, fontSize: 11, color: C.light, whiteSpace: 'nowrap' }}>{fmtDate(report.created_at)}</span>
              </div>
              {renderContentSummary(report.content_type, report.content_id)}
              {renderContentOwnerMeta(report)}
              {report.notes && (
                <p style={{ fontFamily: PP, fontSize: 12, color: C.mid, margin: '8px 0 0', fontStyle: 'italic' }}>
                  "{report.notes}"
                </p>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                <AdminButton onClick={() => updateReport(report, 'reviewed')}>✓ Mantener</AdminButton>
                <AdminButton variant="danger" onClick={() => removeReportedContent(report)}>✕ Eliminar contenido</AdminButton>
                <AdminButton variant="danger" disabled={!canBanContentAuthor(report)} onClick={() => banContentAuthor(report)}>
                  🚫 {banAuthorButtonLabel(report)}
                </AdminButton>
              </div>
            </Card>
          ))}
          <AdminPagination
            page={pagedReports.page}
            pageCount={pagedReports.pageCount}
            total={filteredPendingReports.length}
            onChange={setReportPage}
          />
        </div>
      )}

      {/* ── Verificación de negocios ───────────────────────────────────── */}
      {tab === 'businessVerification' && isTabDataReady('businessVerification') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {businessPromotionUnavailable ? (
            <div style={{ padding:14, borderRadius:16, border:'1px solid #F59E0B', background:'#FFFBEB' }}>
              <p style={{ fontFamily:PP, fontWeight:900, fontSize:12, color:'#92400E', margin:'0 0 4px' }}>
                Planes de Inicio pendientes de configurar
              </p>
              <p style={{ fontFamily:PP, fontSize:11, color:'#A16207', margin:0, lineHeight:1.55 }}>
                Ejecuta el SQL de planes en Supabase para activar cupos, vigencia y rotación.
              </p>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:8 }}>
              {businessPromotionPlans.map(plan => plan.key !== 'free' ? (
                <div key={plan.key} style={{ padding:12, borderRadius:16, border:`1px solid ${plan.color}44`, background:plan.background }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                    <div>
                      <p style={{ fontFamily:PP, fontWeight:900, fontSize:11, color:plan.color, margin:'0 0 4px' }}>{plan.label}</p>
                      <p style={{ fontFamily:PP, fontWeight:800, fontSize:16, color:C.text, margin:0 }}>
                        {plan.availableSlots ?? '∞'} libres
                      </p>
                    </div>
                    {plan.key === 'featured' ? (
                      <span style={{ border:`1px solid ${plan.color}55`, background:'#fff', color:plan.color, borderRadius:9, padding:'6px 8px', fontFamily:PP, fontWeight:800, fontSize:9 }}>
                        Fijo
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => updateBusinessPromotionLimit(plan)}
                        style={{ border:`1px solid ${plan.color}55`, background:'#fff', color:plan.color, borderRadius:9, padding:'6px 8px', fontFamily:PP, fontWeight:800, fontSize:9, cursor:'pointer' }}
                      >
                        Editar
                      </button>
                    )}
                  </div>
                  <p style={{ fontFamily:PP, fontSize:9, color:C.mid, margin:'5px 0 0' }}>
                    {plan.activeCount || 0} activos de {plan.maxActive ?? '∞'} · peso {plan.rotationWeight}
                  </p>
                </div>
              ) : null)}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 18, padding: 8, boxShadow: '0 10px 26px rgba(15,23,42,0.04)' }}>
            {BUSINESS_VERIFICATION_FILTERS.map(item => (
              <button
                key={item.id}
                onClick={() => { setBusinessVerificationFilter(item.id); setBusinessPage(1) }}
                style={{
                  fontFamily: PP,
                  fontWeight: 900,
                  fontSize: 11,
                  borderRadius: 999,
                  border: `1.5px solid ${businessVerificationFilter === item.id ? item.color : C.border}`,
                  background: item.bg,
                  color: item.color,
                  padding: '9px 12px',
                  cursor: 'pointer',
                  width: '100%',
                  minHeight: 44,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  boxShadow: businessVerificationFilter === item.id ? `0 0 0 3px ${item.color}14, 0 10px 22px ${item.color}12` : 'none',
                }}
              >
                {item.label} ({businessVerificationCounts[item.id] || 0})
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <AdminFilterInput
              value={businessSearch}
              onChange={value => { setBusinessSearch(value); setBusinessPage(1) }}
              placeholder="Buscar negocio, categoría, ciudad, email o web..."
            />
          </div>

          {filteredVerificationBusinesses.length === 0 ? (
            <EmptyState icon="✓" text="No hay negocios en este estado." />
          ) : pagedBusinesses.items.map(business => {
            const details = getBusinessVerificationDetails(business)
            const statusMeta = BUSINESS_VERIFICATION_STATUSES[details.status] || BUSINESS_VERIFICATION_STATUSES.unverified
            const description = business.description || business.desc || ''
            const contactBits = [
              business.whatsapp || business.phone,
              business.email,
              business.website,
            ].filter(Boolean)
            const promotionPlanKey = getEffectiveBusinessPromotionPlan(business)
            const promotionPlan = businessPromotionPlans.find(plan => plan.key === promotionPlanKey)
              || getBusinessPromotionMeta(promotionPlanKey)
            const promotionEndsOn = promotionPlanKey === 'free'
              ? ''
              : formatPromotionEndDate(business.promotion_ends_at)

            return (
              <Card key={business.id}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  {business.photo_url ? (
                    <img
                      src={business.photo_url}
                      alt={business.name || 'Negocio'}
                      style={{ width: 74, height: 74, objectFit: 'contain', borderRadius: 12, background: C.bg, border: `1px solid ${C.border}`, flexShrink: 0 }}
                    />
                  ) : (
                    <div style={{ width: 74, height: 74, borderRadius: 12, background: C.bg, display: 'grid', placeItems: 'center', fontSize: 28, flexShrink: 0 }}>🏪</div>
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', marginBottom:3 }}>
                          <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 15, color: C.text, margin: 0, overflowWrap: 'anywhere' }}>
                            {business.name || 'Negocio sin nombre'}
                          </p>
                          {promotionPlanKey !== 'free' && (
                            <Tag bg={promotionPlan.background} color={promotionPlan.color}>
                              {promotionPlan.label}{promotionEndsOn ? ` · hasta ${promotionEndsOn}` : ''}
                            </Tag>
                          )}
                        </div>
                        <p style={{ fontFamily: PP, fontSize: 11, color: C.light, margin: 0, overflowWrap: 'anywhere' }}>
                          {[business.category, business.city || business.canton].filter(Boolean).join(' · ') || 'Sin categoría'}
                        </p>
                      </div>
                      <Tag bg={statusMeta.bg} color={statusMeta.color}>{statusMeta.label}</Tag>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <div style={{ flex: 1, height: 8, background: C.border, borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(details.score, 100)}%`, height: '100%', background: details.score >= 80 ? '#10B981' : details.score >= 50 ? '#F59E0B' : '#EF4444' }} />
                      </div>
                      <span style={{ fontFamily: PP, fontSize: 12, fontWeight: 900, color: C.text, whiteSpace: 'nowrap' }}>
                        {details.score}/100
                      </span>
                    </div>

                    {description && (
                      <p style={{ fontFamily: PP, fontSize: 12, color: C.mid, lineHeight: 1.55, margin: '0 0 8px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {description}
                      </p>
                    )}

                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
                      {details.criteria.map(item => (
                        <span
                          key={item.id}
                          style={{
                            fontFamily: PP,
                            fontWeight: 700,
                            fontSize: 10,
                            color: item.passed ? '#065F46' : '#B91C1C',
                            background: item.passed ? '#ECFDF5' : '#FEF2F2',
                            borderRadius: 999,
                            padding: '3px 8px',
                          }}
                        >
                          {item.passed ? '✓' : '×'} {item.label} (+{item.points})
                        </span>
                      ))}
                    </div>

                    <p style={{ fontFamily: PP, fontSize: 11, color: C.light, margin: '0 0 10px', overflowWrap: 'anywhere' }}>
                      Contacto: {contactBits.length ? contactBits.join(' · ') : 'sin contacto'}{business.verification_notes ? ` · Nota: ${business.verification_notes}` : ''}
                    </p>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ width:'100%', padding:10, borderRadius:14, border:`1px solid ${C.border}`, background:C.bg }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, marginBottom:8 }}>
                          <p style={{ fontFamily:PP, fontWeight:900, fontSize:11, color:C.text, margin:0 }}>
                            Plan de rotación en Inicio
                          </p>
                          <span style={{ fontFamily:PP, fontSize:9, fontWeight:800, color:promotionPlan.color }}>
                            {businessPromotionLoading.has(business.id) ? 'Guardando...' : promotionPlan.label}
                          </span>
                        </div>
                        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                          {businessPromotionPlans.map(plan => {
                            const isCurrent = promotionPlanKey === plan.key
                            const noAvailability = plan.key !== 'free'
                              && !isCurrent
                              && plan.availableSlots != null
                              && plan.availableSlots <= 0
                            const disabled = businessPromotionUnavailable
                              || businessPromotionLoading.has(business.id)
                              || (plan.key === 'free' && isCurrent)
                              || (plan.key !== 'free' && (plan.enabled === false || noAvailability))

                            return (
                              <button
                                key={plan.key}
                                type="button"
                                disabled={disabled}
                                onClick={() => setBusinessPromotion(business, plan.key)}
                                title={noAvailability ? 'Plan completo' : isCurrent && plan.key !== 'free' ? 'Renovar o cambiar duración' : ''}
                                style={{
                                  fontFamily:PP,
                                  fontWeight:900,
                                  fontSize:9,
                                  borderRadius:999,
                                  border:`1.5px solid ${isCurrent ? plan.color : C.border}`,
                                  background:isCurrent ? plan.background : '#fff',
                                  color:isCurrent ? plan.color : C.mid,
                                  padding:'7px 9px',
                                  cursor:disabled ? 'not-allowed' : 'pointer',
                                  opacity:disabled && !isCurrent ? 0.45 : 1,
                                }}
                              >
                                {plan.shortLabel}
                                {plan.key !== 'free' && plan.availableSlots != null ? ` · ${plan.availableSlots}` : ''}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                      {BUSINESS_VERIFICATION_ACTIONS.map(action => {
                        const isCurrent = details.status === action.id
                        return (
                          <button
                            key={action.id}
                            type="button"
                            onClick={() => updateBusinessVerification(business, action.id)}
                            style={{
                              fontFamily: PP,
                              fontWeight: 800,
                              fontSize: 11,
                              borderRadius: 10,
                              border: `1.5px solid ${isCurrent ? action.color : action.bg}`,
                              background: action.bg,
                              color: action.color,
                              padding: '9px 12px',
                              cursor: 'pointer',
                              boxShadow: isCurrent ? `0 0 0 3px ${action.bg}` : 'none',
                            }}
                          >
                            {isCurrent ? 'Actual: ' : ''}{action.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
          <AdminPagination
            page={pagedBusinesses.page}
            pageCount={pagedBusinesses.pageCount}
            total={filteredVerificationBusinesses.length}
            onChange={setBusinessPage}
          />
        </div>
      )}

      {/* ── Live ───────────────────────────────────────── */}
      {tab === 'live' && isTabDataReady('live') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card style={{ padding: 0, overflow: 'hidden', borderRadius: 24, boxShadow: '0 24px 60px rgba(15,23,42,0.08)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 0 }}>
              <div style={{ padding: 20, background: 'linear-gradient(135deg,#7C3AED 0%,#2563EB 58%,#0F766E 100%)', color: '#fff' }}>
                <p style={{ fontFamily: PP, fontSize: 11, fontWeight: 900, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: 0.8, opacity: 0.86 }}>
                  Monitor en vivo
                </p>
                <h3 style={{ fontFamily: PP, fontSize: 28, fontWeight: 900, lineHeight: 1.05, margin: '0 0 10px', letterSpacing: -0.7 }}>
                  Actividad de Latido
                </h3>
                <p style={{ fontFamily: PP, fontSize: 13, lineHeight: 1.5, margin: '0 0 18px', opacity: 0.86 }}>
                  Online ahora en tiempo real y métricas históricas de la última consulta.
                </p>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.24)', borderRadius: 999, padding: '7px 10px', marginBottom: 12 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: presenceStatusMeta.color, boxShadow: `0 0 0 3px ${presenceStatusMeta.color}22` }} />
                  <span style={{ fontFamily: PP, fontWeight: 900, fontSize: 11, color: '#fff' }}>
                    Realtime: {presenceStatusMeta.label}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                  {[
                    { label: 'Online', value: onlineUsers.length },
                    { label: 'Hoy', value: activeUsersToday.length },
                    { label: '7 dias', value: activeUsersWeek.length },
                  ].map(item => (
                    <div key={item.label} style={{ background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.24)', borderRadius: 16, padding: '11px 12px' }}>
                      <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 22, margin: '0 0 3px', lineHeight: 1 }}>{loading ? '...' : item.value}</p>
                      <p style={{ fontFamily: PP, fontSize: 10, fontWeight: 800, margin: 0, opacity: 0.82 }}>{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ padding: 20, background: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
                  <div>
                    <p style={{ fontFamily: PP, fontSize: 10, fontWeight: 900, color: C.light, textTransform: 'uppercase', letterSpacing: 0.7, margin: '0 0 5px' }}>
                      {analyticsUnavailable ? 'Últimas conexiones en 14 días' : 'Visitantes únicos en 14 días'}
                    </p>
                    <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 30, color: C.text, margin: 0, lineHeight: 1 }}>
                      {loading ? '...' : liveLast14Total}
                    </p>
                  </div>
                  <span style={{ fontFamily: PP, fontSize: 11, fontWeight: 900, color: liveWeeklyTrend >= 0 ? '#047857' : '#B91C1C', background: liveWeeklyTrend >= 0 ? '#D1FAE5' : '#FEE2E2', borderRadius: 999, padding: '7px 10px', whiteSpace: 'nowrap' }}>
                    {liveWeeklyTrend > 0 ? `+${liveWeeklyTrend}%` : liveWeeklyTrend < 0 ? `${liveWeeklyTrend}%` : 'estable'}
                  </span>
                </div>
                <SparkBarChart data={liveLast14Days} color="#7C3AED" />
              </div>
            </div>
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 14 }}>
            <Card style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 15, color: C.text, margin: '0 0 3px' }}>Usuarios online</p>
                  <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: 0 }}>Presencia conectada en tiempo real.</p>
                </div>
                <span style={{ width: 44, height: 44, borderRadius: 16, background: '#F3E8FF', color: '#7C3AED', display: 'grid', placeItems: 'center', fontFamily: PP, fontWeight: 900 }}>
                  {onlineUsers.length}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {onlineUsers.slice(0, 7).map(profile => (
                  <div key={profile.id} style={{ display: 'flex', alignItems: 'center', gap: 10, border: `1px solid ${C.border}`, borderRadius: 14, padding: '9px 10px', background: '#F8FAFF' }}>
                    <span style={{ width: 10, height: 10, borderRadius: 999, background: '#10B981', boxShadow: '0 0 0 4px rgba(16,185,129,0.14)' }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 12, color: C.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {profile.name || profile.email || 'Usuario'}
                      </p>
                      <p style={{ fontFamily: PP, fontSize: 11, color: C.light, margin: '2px 0 0' }}>
                        {profile.canton || 'Sin canton'}
                      </p>
                    </div>
                    <span style={{ fontFamily: PP, fontSize: 10, fontWeight: 900, color: '#047857', background: '#D1FAE5', borderRadius: 999, padding: '4px 7px' }}>
                      online
                    </span>
                  </div>
                ))}
                {!onlineUsers.length && (
                  <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: 0, padding: '18px 0' }}>
                    No hay usuarios online ahora mismo.
                  </p>
                )}
              </div>
            </Card>

            <Card style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 15, color: C.text, margin: '0 0 3px' }}>Últimas señales</p>
                  <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: 0 }}>Usuarios con actividad más reciente.</p>
                </div>
                <span style={{ fontFamily: PP, fontSize: 11, fontWeight: 900, color: C.primary, background: C.primaryLight, borderRadius: 999, padding: '7px 10px' }}>
                  {recentLiveUsers.length}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {recentLiveUsers.map(profile => {
                  const isOnline = onlineUserIds.has(profile.id)
                  return (
                    <div key={profile.id} style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: `1px solid ${C.border}`, padding: '8px 0' }}>
                      <span style={{ flex: '0 0 auto', width: 34, height: 34, borderRadius: 12, background: isOnline ? '#D1FAE5' : C.bg, display: 'grid', placeItems: 'center', fontFamily: PP, fontWeight: 900, color: isOnline ? '#047857' : C.mid }}>
                        {(profile.name || profile.email || 'U').slice(0, 1).toUpperCase()}
                      </span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 12, color: C.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {profile.name || profile.email || 'Usuario'}
                        </p>
                        <p style={{ fontFamily: PP, fontSize: 11, color: C.light, margin: '2px 0 0' }}>
                          {profile.canton || 'Sin canton'}
                        </p>
                      </div>
                      <span style={{ fontFamily: PP, fontSize: 10, fontWeight: 900, color: isOnline ? '#047857' : C.light, background: isOnline ? '#D1FAE5' : C.bg, borderRadius: 999, padding: '4px 7px', whiteSpace: 'nowrap' }}>
                        {isOnline ? 'online' : fmtActivity(profile.last_seen_at)}
                      </span>
                    </div>
                  )
                })}
                {!recentLiveUsers.length && (
                  <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: 0, padding: '18px 0' }}>
                    Sin actividad registrada todavía.
                  </p>
                )}
              </div>
            </Card>

            <Card style={{ padding: 16 }}>
              <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 15, color: C.text, margin: '0 0 3px' }}>Actividad por cantón</p>
              <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: '0 0 14px' }}>Top de usuarios activos esta semana.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {activeCantonRows.map(row => (
                  <div key={row.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 5 }}>
                      <span style={{ fontFamily: PP, fontSize: 12, fontWeight: 900, color: C.text }}>{row.label}</span>
                      <span style={{ fontFamily: PP, fontSize: 12, fontWeight: 900, color: C.primary }}>{row.value}</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 999, background: C.bg, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.max(8, Math.round((row.value / activeCantonMax) * 100))}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,#7C3AED,#10B981)' }} />
                    </div>
                  </div>
                ))}
                {!activeCantonRows.length && (
                  <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: 0 }}>
                    Todavía no hay actividad semanal para agrupar.
                  </p>
                )}
              </div>
            </Card>

            <Card style={{ padding: 16, background: 'linear-gradient(180deg,#FFFFFF,#F8FAFF)' }}>
              <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 15, color: C.text, margin: '0 0 3px' }}>Lectura rápida</p>
              <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: '0 0 14px' }}>Resumen para decidir si hay que activar, revisar o esperar.</p>
              <div style={{ display: 'grid', gap: 9 }}>
                {[
                  { label: 'Tracción diaria', value: `${liveTodayRate}%`, note: `${activeUsersToday.length} usuarios activos hoy`, color: C.primary },
                  { label: 'Retención semanal', value: `${liveWeekRate}%`, note: `${activeUsersWeek.length} usuarios activos en 7 días`, color: '#059669' },
                  { label: 'Sin registro', value: liveUntrackedUsers, note: 'usuarios antiguos sin last_seen_at todavía', color: '#D97706' },
                  { label: 'Reactivación real', value: liveInactiveUsers, note: 'con tracking, sin señal en 30 días', color: '#B45309' },
                ].map(item => (
                  <div key={item.label} style={{ display: 'grid', gridTemplateColumns: '76px 1fr', gap: 10, alignItems: 'center', border: `1px solid ${C.border}`, borderRadius: 14, padding: '10px 11px', background: '#fff' }}>
                    <strong style={{ fontFamily: PP, fontSize: 22, fontWeight: 900, color: item.color, lineHeight: 1 }}>{item.value}</strong>
                    <div>
                      <p style={{ fontFamily: PP, fontSize: 12, fontWeight: 900, color: C.text, margin: 0 }}>{item.label}</p>
                      <p style={{ fontFamily: PP, fontSize: 11, color: C.light, margin: '2px 0 0' }}>{item.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card style={{ padding: 16, background: '#fff' }}>
              <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 15, color: C.text, margin: '0 0 3px' }}>Cómo se mide</p>
              <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: '0 0 14px', lineHeight: 1.5 }}>
                La actividad empieza a ser fiable desde que Latido guarda presencia y última conexión.
              </p>
              <div style={{ display: 'grid', gap: 9 }}>
                {[
                  { label: 'Online ahora', note: 'Supabase Presence: usuarios con sesión conectada en este momento.', color: '#7C3AED' },
                  { label: 'Activos hoy/semana/mes', note: 'Usuarios cuyo profiles.last_seen_at cae dentro del día, los últimos 7 o los últimos 30 días.', color: C.primary },
                  { label: 'Fidelidad diaria (DAU/MAU)', note: 'Porcentaje de los activos del mes que han vuelto hoy. Por encima del 20% indica un hábito fuerte.', color: '#0891B2' },
                  { label: 'Conexión live', note: `Estado actual del canal realtime: ${presenceStatusMeta.label}.`, color: presenceStatusMeta.color },
                  { label: 'Sin registro', note: 'Usuarios antiguos que aún no han vuelto a abrir la app desde que se activó el tracking.', color: '#D97706' },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ width: 9, height: 9, borderRadius: 999, background: item.color, marginTop: 5, flexShrink: 0 }} />
                    <div>
                      <p style={{ fontFamily: PP, fontSize: 12, fontWeight: 900, color: C.text, margin: '0 0 2px' }}>{item.label}</p>
                      <p style={{ fontFamily: PP, fontSize: 11, color: C.light, margin: 0, lineHeight: 1.45 }}>{item.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ── Creadores ──────────────────────────────────── */}
      {tab === 'creators' && isTabDataReady('creators') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {creatorsUnavailable && (
            <Card style={{ borderColor: '#FCD34D', background: '#FFFBEB' }}>
              <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 13, color: '#92400E', margin: '0 0 4px' }}>
                Sin acceso a la plataforma de creadores
              </p>
              <p style={{ fontFamily: PP, fontSize: 11, color: '#B45309', margin: 0, lineHeight: 1.5 }}>
                Comprueba que tu cuenta esté en business_promotion_admins para que las políticas RLS de creator_profiles te dejen leer todo el directorio.
              </p>
            </Card>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${isDesktop ? 340 : 280}px), 1fr))`, gap: 12 }}>
            <AdminSectionCard
              title="Embudo del directorio"
              subtitle="Recorrido acumulado desde que una tarjeta aparece hasta que la comunidad la guarda."
            >
              <FunnelSteps steps={[
                { label:'Impresiones de contenido', value:creatorStats.impressions, color:'#0284C7', hint:`${fmtNumber(creatorStats.profileViews)} vistas de perfil registradas` },
                { label:'Clics en contenido', value:creatorStats.clicks, color:'#0F766E', hint:`${creatorStats.ctr}% de las impresiones acaban en clic` },
                { label:'Votos de útil', value:creatorStats.helpful, color:'#047857', hint:`${percentOf(creatorStats.helpful, creatorStats.clicks)}% de los clics dejan un voto` },
                { label:'Guardados', value:creatorStats.saved, color:'#7C3AED' },
                { label:'Clics a redes del creador', value:creatorStats.socialClicks, color:'#DB2777' },
              ]} />
              {creatorMetricIndex.updatedAt && (
                <p style={{ fontFamily: PP, fontSize: 10, color: C.light, margin: '12px 0 0' }}>
                  Contadores acumulados · último registro {fmtActivity(creatorMetricIndex.updatedAt)}
                </p>
              )}
            </AdminSectionCard>

            <AdminSectionCard
              title="Salud del directorio"
              subtitle="Señales que indican dónde hace falta una decisión tuya."
            >
              <div style={{ display: 'grid', gap: 8 }}>
                {[
                  { label:'Pendientes de revisión', value:creatorStats.pendingReview, color:creatorStats.pendingReview ? '#B45309' : '#047857', hint:'Perfiles esperando aprobación', filter:() => { setCreatorReviewFilter('pending'); setCreatorStatusFilter('all'); setCreatorPage(1) } },
                  { label:'Creadores sin contenido', value:creatorStats.withoutContent, color:creatorStats.withoutContent ? '#D97706' : '#047857', hint:'Perfiles creados pero vacíos', filter:() => { setCreatorStatusFilter('empty'); setCreatorReviewFilter('all'); setCreatorPage(1) } },
                  { label:'Borradores sin publicar', value:creatorStats.drafts, color:'#0284C7', hint:'No aparecen en el directorio público', filter:() => { setCreatorStatusFilter('draft'); setCreatorReviewFilter('all'); setCreatorPage(1) } },
                  { label:'Ocultos por admin', value:creatorStats.inactive, color:creatorStats.inactive ? '#B91C1C' : '#047857', hint:'Marcados como inactivos', filter:() => { setCreatorStatusFilter('inactive'); setCreatorReviewFilter('all'); setCreatorPage(1) } },
                  { label:'Verificados', value:creatorStats.verified, color:'#047857', hint:`${percentOf(creatorStats.verified, creatorStats.total)}% del directorio`, filter:() => { setCreatorReviewFilter('verified'); setCreatorStatusFilter('all'); setCreatorPage(1) } },
                ].map(row => (
                  <button
                    key={row.label}
                    type="button"
                    onClick={row.filter}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      width: '100%',
                      border: `1px solid ${C.border}`,
                      borderRadius: 14,
                      padding: '10px 12px',
                      background: '#fff',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontFamily: PP, fontSize: 12, fontWeight: 900, color: C.text }}>{row.label}</span>
                      <span style={{ display: 'block', fontFamily: PP, fontSize: 10, color: C.light, marginTop: 1 }}>{row.hint}</span>
                    </span>
                    <span style={{ fontFamily: PP, fontSize: 18, fontWeight: 900, color: row.color, flexShrink: 0 }}>{row.value}</span>
                  </button>
                ))}
              </div>
            </AdminSectionCard>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${isDesktop ? 320 : 280}px), 1fr))`, gap: 12 }}>
            <InsightBarList
              title="Creadores con más tracción"
              subtitle="Vistas de perfil + clics en su contenido."
              rows={topCreatorRows}
              color="#DB2777"
              emptyText="Todavía no hay métricas de creadores."
            />
            <InsightBarList
              title="Creadores más valorados"
              subtitle="Votos de útil y guardados recibidos."
              rows={topCreatorHelpfulRows}
              color="#047857"
              emptyText="Aún nadie ha votado contenido de creadores."
            />
            <InsightBarList
              title="Contenidos con más clics"
              subtitle="Piezas que mejor convierten en el directorio."
              rows={topCreatorContentRows}
              color="#0F766E"
              emptyText="Sin clics registrados todavía."
            />
            <InsightBarList
              title="Temas cubiertos"
              subtitle="Contenidos publicados por temática."
              rows={creatorTopicRows}
              color="#0284C7"
              emptyText="Sin contenidos publicados."
            />
            <InsightBarList
              title="Plataformas"
              subtitle="Dónde publica la comunidad de creadores."
              rows={creatorPlatformRows}
              color="#7C3AED"
              emptyText="Sin contenidos publicados."
            />
            <InsightBarList
              title="Cobertura por cantón"
              subtitle="Creadores registrados por zona."
              rows={creatorCantonRows}
              color={C.primary}
              emptyText="Sin creadores registrados."
            />
          </div>

          <AdminChipFilter
            label="Filtro rápido por revisión"
            value={creatorReviewFilter}
            onChange={value => { setCreatorReviewFilter(value); setCreatorPage(1) }}
            options={[
              { id:'all', label:'Todos', count:creatorStats.total },
              { id:'pending', label:'Pendientes', count:creatorStats.pendingReview, color:'#B45309', bg:'#FFFBEB' },
              { id:'approved', label:'Aprobados', count:creatorStats.approved, color:'#047857', bg:'#ECFDF5' },
              { id:'rejected', label:'Rechazados', count:creatorStats.rejected, color:'#B91C1C', bg:'#FEF2F2' },
              { id:'verified', label:'Verificados', count:creatorStats.verified, color:'#0284C7', bg:'#E0F2FE' },
            ]}
          />

          <AdminFilterBar
            footer={(
              <>
                <span style={{ fontFamily: PP, fontSize: 11, color: C.mid }}>
                  <strong style={{ color: C.text }}>{filteredCreators.length}</strong> de {creatorStats.total} creadores
                  {' · '}<strong style={{ color: C.text }}>{fmtNumber(filteredCreators.reduce((sum, creator) => sum + creator.profileViews, 0))}</strong> vistas
                  {' · '}<strong style={{ color: C.text }}>{fmtNumber(filteredCreators.reduce((sum, creator) => sum + creator.clicks, 0))}</strong> clics
                </span>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  <AdminButton onClick={exportCreatorsCsv} disabled={!filteredCreators.length}>⬇ Exportar CSV</AdminButton>
                  <AdminButton
                    onClick={() => {
                      setCreatorSearch('')
                      setCreatorStatusFilter('all')
                      setCreatorReviewFilter('all')
                      setCreatorTopicFilter('all')
                      setCreatorCantonFilter('all')
                      setCreatorSort('views')
                      setCreatorPage(1)
                    }}
                  >
                    Limpiar filtros
                  </AdminButton>
                </div>
              </>
            )}
          >
            <AdminFilterInput
              value={creatorSearch}
              onChange={value => { setCreatorSearch(value); setCreatorPage(1) }}
              placeholder="Buscar nombre, handle, ciudad, cantón o email..."
            />
            <AdminFilterSelect
              label="Estado del creador"
              value={creatorStatusFilter}
              onChange={value => { setCreatorStatusFilter(value); setCreatorPage(1) }}
            >
              <option value="all">Estado: todos</option>
              <option value="live">Publicados y visibles</option>
              <option value="draft">Borradores</option>
              <option value="inactive">Ocultos</option>
              <option value="empty">Sin contenido</option>
            </AdminFilterSelect>
            <AdminFilterSelect
              label="Tema del creador"
              value={creatorTopicFilter}
              onChange={value => { setCreatorTopicFilter(value); setCreatorPage(1) }}
            >
              <option value="all">Tema: todos</option>
              {CREATOR_TOPICS.map(topic => (
                <option key={topic.id} value={topic.id}>{topic.label}</option>
              ))}
            </AdminFilterSelect>
            <AdminFilterSelect
              label="Cantón del creador"
              value={creatorCantonFilter}
              onChange={value => { setCreatorCantonFilter(value); setCreatorPage(1) }}
            >
              <option value="all">Cantón: todos</option>
              {creatorCantons.map(canton => <option key={canton} value={canton}>{canton}</option>)}
            </AdminFilterSelect>
            <AdminFilterSelect
              label="Orden de la lista"
              value={creatorSort}
              onChange={value => { setCreatorSort(value); setCreatorPage(1) }}
            >
              {CREATOR_SORT_OPTIONS.map(option => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </AdminFilterSelect>
          </AdminFilterBar>

          {isDesktop ? (
            <Card style={{ padding: 12 }}>
              <AdminDataTable
                columns={creatorTableColumns}
                rows={pagedCreators.items}
                getRowKey={creator => creator.id}
                sort={creatorSort}
                onSortChange={value => { setCreatorSort(value); setCreatorPage(1) }}
                activeRowKey={selectedCreatorId}
                onRowClick={creator => setSelectedCreatorId(previous => previous === creator.id ? '' : creator.id)}
                emptyText="No hay creadores con estos filtros."
              />
              <AdminPagination
                page={pagedCreators.page}
                pageCount={pagedCreators.pageCount}
                total={filteredCreators.length}
                onChange={setCreatorPage}
              />
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {!filteredCreators.length ? (
                <EmptyState icon="🎬" text="No hay creadores con estos filtros." />
              ) : pagedCreators.items.map(creator => renderCreatorCard(creator))}
              <AdminPagination
                page={pagedCreators.page}
                pageCount={pagedCreators.pageCount}
                total={filteredCreators.length}
                onChange={setCreatorPage}
              />
            </div>
          )}

          {selectedCreator && renderCreatorDetail(selectedCreator)}
        </div>
      )}

      {/* ── Usuarios ───────────────────────────────────── */}
      {tab === 'users' && isTabDataReady('users') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <AdminFilterBar
            footer={(
              <>
                <span style={{ fontFamily: PP, fontSize: 11, color: C.mid }}>
                  <strong style={{ color: C.text }}>{filteredUsers.length}</strong> mostrados
                  {' · '}<strong style={{ color: '#DC2626' }}>{stats.banned}</strong> baneados
                  {' · '}<strong style={{ color: C.text }}>{metricUsers.length}</strong> total sin admin
                  {' · '}<strong style={{ color: '#0F766E' }}>{activeUsersWeek.length}</strong> activos 7d
                </span>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  <AdminButton onClick={exportUsersCsv} disabled={!filteredUsers.length}>⬇ Exportar CSV</AdminButton>
                  <AdminButton
                    onClick={() => {
                      setUserSearch('')
                      setUserStatusFilter('all')
                      setUserCantonFilter('all')
                      setUserPage(1)
                    }}
                  >
                    Limpiar filtros
                  </AdminButton>
                </div>
              </>
            )}
          >
            <AdminFilterInput
              value={userSearch}
              onChange={value => { setUserSearch(value); setUserPage(1) }}
              placeholder="Buscar por nombre, email o cantón..."
            />
            <AdminFilterSelect
              label="Estado del usuario"
              value={userStatusFilter}
              onChange={value => { setUserStatusFilter(value); setUserPage(1) }}
            >
              <option value="all">Estado: todos</option>
              <option value="active">Activos</option>
              <option value="banned">Baneados</option>
            </AdminFilterSelect>
            <AdminFilterSelect
              label="Cantón del usuario"
              value={userCantonFilter}
              onChange={value => { setUserCantonFilter(value); setUserPage(1) }}
            >
              <option value="all">Cantón: todos</option>
              {userCantons.map(canton => <option key={canton} value={canton}>{canton}</option>)}
            </AdminFilterSelect>
          </AdminFilterBar>

          {filteredUsers.length === 0 ? (
            <EmptyState icon="👤" text="No se encontraron usuarios." />
          ) : pagedUsers.items.map(profile => (
            <Card key={profile.id} style={{ padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <p style={{ fontFamily: PP, fontWeight: 800, fontSize: 14, color: C.text, margin: 0, overflowWrap: 'anywhere' }}>
                      {profile.name || 'Sin nombre'}
                    </p>
                    {profile.banned && (
                      <span style={{ fontFamily: PP, fontSize: 10, fontWeight: 700, color: '#B91C1C', background: '#FEE2E2', borderRadius: 999, padding: '2px 8px' }}>
                        BANEADO
                      </span>
                    )}
                  </div>
                  <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: '2px 0 0', overflowWrap: 'anywhere' }}>
                    {profile.email || profile.id}
                    {profile.canton ? ` · ${profile.canton}` : ''}
                    {profile.created_at ? ` · desde ${fmtDateShort(profile.created_at)}` : ''}
                  </p>
                  {profile.banned && profile.banned_reason && (
                    <p style={{ fontFamily: PP, fontSize: 11, color: '#B91C1C', margin: '5px 0 0' }}>
                      Motivo: {profile.banned_reason}
                    </p>
                  )}
                </div>
                <AdminButton
                  variant={profile.banned ? 'success' : 'danger'}
                  onClick={() => setUserBanned(profile, !profile.banned)}
                >
                  {profile.banned ? '↩ Desbanear' : '🚫 Banear'}
                </AdminButton>
              </div>
            </Card>
          ))}
          <AdminPagination
            page={pagedUsers.page}
            pageCount={pagedUsers.pageCount}
            total={filteredUsers.length}
            onChange={setUserPage}
          />
        </div>
      )}

      {/* ── Contenido ──────────────────────────────────── */}
      {tab === 'content' && isTabDataReady('content') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <AdminFilterInput
              value={contentSearch}
              onChange={value => {
                setContentSearch(value)
                setListingPage(1)
                setJobPage(1)
              }}
              placeholder="Buscar título, descripción, categoría, empresa o cantón..."
            />
            <AdminFilterSelect
              label="Estado de publicación"
              value={contentStatusFilter}
              onChange={value => {
                setContentStatusFilter(value)
                setListingPage(1)
                setJobPage(1)
              }}
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="hidden">Ocultos</option>
            </AdminFilterSelect>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
          {/* Anuncios */}
          <div>
            <p style={{ fontFamily: PP, fontWeight: 800, fontSize: 13, color: C.mid, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Anuncios ({filteredListings.length})
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredListings.length === 0 ? (
                <EmptyState icon="📭" text="Sin anuncios con estos filtros." />
              ) : pagedListings.items.map(item => (
                <Card key={item.id} style={{ padding: '12px 14px' }}>
                  {renderContentSummary('listing', item.id)}
                  <div style={{ display: 'flex', gap: 6, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Tag bg={item.active ? '#D1FAE5' : '#FEE2E2'} color={item.active ? '#065F46' : '#B91C1C'}>
                      {item.active ? 'Activo' : 'Oculto'}
                    </Tag>
                    <span style={{ fontFamily: PP, fontSize: 11, color: C.light, flex: 1 }}>{fmtDate(item.created_at)}</span>
                    <AdminButton
                      variant={item.active ? 'danger' : 'success'}
                      onClick={() => setContentActive('listing', item.id, !item.active)
                        .catch(error => toast.error(error.message || 'No se pudo actualizar el anuncio'))}
                    >
                      {item.active ? 'Ocultar' : 'Activar'}
                    </AdminButton>
                  </div>
                </Card>
              ))}
              <AdminPagination
                page={pagedListings.page}
                pageCount={pagedListings.pageCount}
                total={filteredListings.length}
                onChange={setListingPage}
              />
            </div>
          </div>

          {/* Empleos */}
          <div>
            <p style={{ fontFamily: PP, fontWeight: 800, fontSize: 13, color: C.mid, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Empleos ({filteredJobs.length})
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredJobs.length === 0 ? (
                <EmptyState icon="📭" text="Sin empleos con estos filtros." />
              ) : pagedJobs.items.map(item => (
                <Card key={item.id} style={{ padding: '12px 14px' }}>
                  {renderContentSummary('job', item.id)}
                  <div style={{ display: 'flex', gap: 6, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Tag bg={item.active ? '#D1FAE5' : '#FEE2E2'} color={item.active ? '#065F46' : '#B91C1C'}>
                      {item.active ? 'Activo' : 'Oculto'}
                    </Tag>
                    <span style={{ fontFamily: PP, fontSize: 11, color: C.light, flex: 1 }}>{fmtDate(item.created_at)}</span>
                    <AdminButton
                      variant={item.active ? 'danger' : 'success'}
                      onClick={() => setContentActive('job', item.id, !item.active)
                        .catch(error => toast.error(error.message || 'No se pudo actualizar el empleo'))}
                    >
                      {item.active ? 'Ocultar' : 'Activar'}
                    </AdminButton>
                  </div>
                </Card>
              ))}
              <AdminPagination
                page={pagedJobs.page}
                pageCount={pagedJobs.pageCount}
                total={filteredJobs.length}
                onChange={setJobPage}
              />
            </div>
          </div>
          </div>
        </div>
      )}
        </main>
      </div>

      {crmMenuOpen && !isDesktop && (
        <>
          <button
            type="button"
            className="latido-overlay-backdrop latido-backdrop-hitbox"
            aria-label="Cerrar menú CRM"
            onClick={() => setCrmMenuOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 78,
              background: 'rgba(15,23,42,0.22)',
              border: 'none',
              cursor: 'default',
            }}
          />
          <div
            className="latido-sheet-panel"
            role="dialog"
            aria-label="Control CRM Latido"
            style={{
              position: 'fixed',
              left: 12,
              right: 12,
              bottom: 'calc(82px + env(safe-area-inset-bottom))',
              zIndex: 79,
              maxWidth: 620,
              margin: '0 auto',
              background: '#fff',
              border: '1px solid rgba(203,213,225,0.95)',
              borderRadius: 26,
              boxShadow: '0 24px 74px rgba(15,23,42,0.24)',
              padding: 14,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
              <div>
                <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 15, color: C.text, margin: '0 0 3px' }}>
                  Control CRM Latido
                </p>
                <p style={{ fontFamily: PP, fontSize: 11, color: C.light, margin: 0, lineHeight: 1.45 }}>
                  Accesos completos del panel, sin duplicar información en la página.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCrmMenuOpen(false)}
                style={{ width: 34, height: 34, borderRadius: 13, border: `1px solid ${C.border}`, background: C.bg, color: C.mid, cursor: 'pointer', fontFamily: PP, fontWeight: 900 }}
              >
                ×
              </button>
            </div>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 12 }}>
              <Tag bg={deltaStatusBg} color={deltaStatusColor}>{deltaStatusLabel}</Tag>
              <Tag bg={C.bg} color={C.mid}>Carga delta</Tag>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {NAV_GROUPS.map(group => (
                <div key={group.label} style={{ border: `1px solid ${C.border}`, borderRadius: 18, padding: 10, background: '#F8FAFC' }}>
                  <p style={{ fontFamily: PP, fontSize: 10, fontWeight: 900, letterSpacing: 0.7, textTransform: 'uppercase', color: C.light, margin: '0 0 8px' }}>
                    {group.label}
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', gap: 7 }}>
                    {group.items.map(id => {
                      const item = navById.get(id)
                      if (!item) return null
                      const active = tab === item.id
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => switchTab(item.id)}
                          style={{
                            border: `1.5px solid ${active ? `${item.color}66` : C.border}`,
                            borderRadius: 15,
                            background: active ? item.bg : '#fff',
                            color: active ? item.color : C.text,
                            cursor: 'pointer',
                            padding: '10px 9px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            textAlign: 'left',
                            boxShadow: active ? `0 10px 22px ${item.color}12` : 'none',
                          }}
                        >
                          <span style={{ width: 30, height: 30, borderRadius: 12, background: active ? '#fff' : item.bg, display: 'grid', placeItems: 'center', fontSize: 15, flexShrink: 0 }}>
                            {item.icon}
                          </span>
                          <span style={{ minWidth: 0 }}>
                            <span style={{ display: 'block', fontFamily: PP, fontWeight: 900, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                            <span style={{ display: 'block', fontFamily: PP, fontWeight: 800, fontSize: 9, color: active ? item.color : C.light, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.value}</span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {!isDesktop && (
      <nav
        aria-label="Navegación admin"
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 80,
          width: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          gap: 7,
          overflowX: 'auto',
          padding: '8px max(12px, env(safe-area-inset-left)) calc(8px + env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-right))',
          background: 'rgba(255,255,255,0.94)',
          borderTop: '1px solid rgba(203,213,225,0.9)',
          boxShadow: '0 -18px 58px rgba(15,23,42,0.14)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
        }}
      >
        {BOTTOM_NAV_ITEMS.map(item => {
          const active = tab === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => switchTab(item.id)}
              style={{
                flex: '1 1 0',
                minWidth: 0,
                minHeight: 58,
                borderRadius: 17,
                border: `1.5px solid ${active ? `${item.color}55` : 'transparent'}`,
                background: active ? item.bg : 'transparent',
                color: active ? item.color : C.mid,
                cursor: 'pointer',
                padding: '8px 3px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                textAlign: 'center',
                boxShadow: active ? `0 12px 28px ${item.color}16` : 'none',
                transition: 'background .15s ease, border-color .15s ease, box-shadow .15s ease',
                position: 'relative',
              }}
            >
              <span style={{ width: 31, height: 31, borderRadius: 13, background: active ? '#fff' : item.bg, display: 'grid', placeItems: 'center', fontSize: 16, flexShrink: 0 }}>
                {item.icon}
              </span>
              {Number(item.alert) > 0 && (
                <span style={{ position: 'absolute', top: 6, right: '50%', marginRight: -22, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999, background: item.color, color: '#fff', fontFamily: PP, fontSize: 9, fontWeight: 900, display: 'grid', placeItems: 'center' }}>
                  {item.alert}
                </span>
              )}
              <span style={{ fontFamily: PP, fontWeight: 900, fontSize: 9.5, letterSpacing: -0.1, lineHeight: 1.05, color: active ? item.color : C.text, maxWidth: '100%', whiteSpace: 'normal', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.short || item.label}
              </span>
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => setCrmMenuOpen(open => !open)}
          style={{
            flex: '1 1 0',
            minWidth: 0,
            minHeight: 58,
            borderRadius: 17,
            border: `1.5px solid ${menuNavActive ? `color-mix(in srgb, ${C.primary} 33%, transparent)` : 'transparent'}`,
            background: menuNavActive ? C.primaryLight : 'transparent',
            color: menuNavActive ? C.primary : C.text,
            cursor: 'pointer',
            padding: '8px 5px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            textAlign: 'center',
            boxShadow: menuNavActive ? '0 12px 28px rgba(37,99,235,0.16)' : 'none',
            transition: 'background .15s ease, border-color .15s ease, box-shadow .15s ease',
          }}
        >
          <span style={{ width: 31, height: 31, borderRadius: 13, background: menuNavActive ? '#fff' : C.primaryLight, display: 'grid', placeItems: 'center', fontSize: 17, fontFamily: PP, fontWeight: 900, flexShrink: 0 }}>
            ☰
          </span>
          <span style={{ fontFamily: PP, fontWeight: 900, fontSize: 9.5, letterSpacing: -0.1, lineHeight: 1.05, maxWidth: '100%', whiteSpace: 'normal', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Menú
          </span>
        </button>
      </nav>
      )}
    </div>
  )
}
