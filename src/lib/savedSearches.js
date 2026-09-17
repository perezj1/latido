import { supabase } from './supabase'
import { trackAnalyticsEvent } from './analytics'

export const SAVED_SEARCHES_CHANGED_EVENT = 'latido_saved_searches_changed'

const ENTITY_KINDS = new Set([
  'listing',
  'job',
  'provider',
  'event',
  'community',
  'creator',
  'creator_content',
])

function cleanText(value, max = 160) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max)
}

function compactObject(value = {}) {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== '' && entry !== null && entry !== undefined)
      .map(([key, entry]) => [
        key,
        Array.isArray(entry)
          ? entry.map(item => cleanText(item)).filter(Boolean)
          : typeof entry === 'string'
            ? cleanText(entry)
            : entry,
      ]),
  )
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map(key => [key, stableValue(value[key])]),
  )
}

export function normalizeSavedSearchDraft(draft = {}) {
  const entityKinds = Array.from(new Set(
    (draft.entityKinds || [])
      .map(kind => cleanText(kind))
      .filter(kind => ENTITY_KINDS.has(kind)),
  )).sort()

  const normalized = {
    name:cleanText(draft.name, 100),
    query:cleanText(draft.query, 120),
    entityKinds,
    category:cleanText(draft.category, 60),
    intent:cleanText(draft.intent, 30),
    canton:cleanText(draft.canton, 20),
    city:cleanText(draft.city, 80),
    plz:cleanText(draft.plz, 12),
    filters:compactObject(draft.filters),
    resultPath:cleanText(draft.resultPath, 500),
  }

  if (!normalized.name || !normalized.entityKinds.length || !normalized.resultPath.startsWith('/')) {
    return null
  }

  return normalized
}

export function getSavedSearchFingerprint(draft) {
  const normalized = normalizeSavedSearchDraft(draft)
  if (!normalized) return ''

  return JSON.stringify(stableValue({
    query:normalized.query.toLocaleLowerCase('es'),
    entityKinds:normalized.entityKinds,
    category:normalized.category,
    intent:normalized.intent,
    canton:normalized.canton,
    city:normalized.city,
    plz:normalized.plz,
    filters:normalized.filters,
  }))
}

export function notifySavedSearchesChanged(search = null) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SAVED_SEARCHES_CHANGED_EVENT, {
      detail:search ? { search } : null,
    }))
  }
}

export async function findSavedSearch(userId, draft) {
  const fingerprint = getSavedSearchFingerprint(draft)
  const normalized = normalizeSavedSearchDraft(draft)
  if (!userId || !fingerprint) return null

  const { data, error } = await supabase
    .from('saved_searches')
    .select('id,active,push_enabled')
    .eq('user_id', userId)
    .eq('fingerprint', fingerprint)
    .maybeSingle()

  if (error) throw error
  if (data) return data

  // Las entradas creadas antes de Mi lista no incluian todos los criterios
  // semanticos en su fingerprint. La frase evita que el cambio de interfaz
  // cree una segunda anotacion identica.
  if (normalized?.query) {
    const fallback = await supabase
      .from('saved_searches')
      .select('id,active,push_enabled')
      .eq('user_id', userId)
      .eq('query', normalized.query)
      .order('updated_at', { ascending:false })
      .limit(1)
      .maybeSingle()
    if (fallback.error) throw fallback.error
    return fallback.data || null
  }

  return null
}

export async function saveSavedSearch(userId, draft) {
  const normalized = normalizeSavedSearchDraft(draft)
  const fingerprint = getSavedSearchFingerprint(draft)
  if (!userId || !normalized || !fingerprint) {
    throw new Error('Esta búsqueda necesita al menos una sección y un destino válido.')
  }

  const row = {
      user_id:userId,
      name:normalized.query || normalized.name,
      query:normalized.query,
      entity_kinds:normalized.entityKinds,
      category:normalized.category || null,
      intent:normalized.intent || null,
      canton:normalized.canton || null,
      city:normalized.city || null,
      plz:normalized.plz || null,
      filters:normalized.filters,
      result_path:normalized.resultPath,
      fingerprint,
      frequency:'daily',
      push_enabled:true,
      // El email se reserva para una futura funcion de pago. Mi lista funciona
      // dentro de la aplicacion y, si el usuario lo permite, mediante push.
      email_enabled:false,
      in_app_enabled:true,
      active:true,
      completed_at:null,
      updated_at:new Date().toISOString(),
  }

  let response = await supabase
    .from('saved_searches')
    .upsert(row, { onConflict:'user_id,fingerprint' })
    .select()
    .single()

  // Compatibilidad durante el despliegue: el frontend puede publicarse unos
  // minutos antes que la migracion que incorpora completed_at.
  if (response.error && /completed_at|schema cache|column/i.test(response.error.message || '')) {
    const legacyRow = { ...row }
    delete legacyRow.completed_at
    response = await supabase
      .from('saved_searches')
      .upsert(legacyRow, { onConflict:'user_id,fingerprint' })
      .select()
      .single()
  }

  const { data, error } = response

  if (error) throw error
  notifySavedSearchesChanged(data)
  void trackAnalyticsEvent('saved_search_created', {
    user_id:userId,
    metadata:{
      entity_kind:normalized.entityKinds.join(','),
      category:normalized.category,
      has_query:Boolean(normalized.query),
      has_location:Boolean(normalized.canton || normalized.city || normalized.plz),
    },
  })
  return data
}

export async function listSavedSearches(userId) {
  if (!userId) return []

  let response = await supabase
    .from('saved_searches')
    .select('id,user_id,name,query,entity_kinds,category,intent,canton,city,plz,filters,result_path,active,completed_at,push_enabled,email_enabled,created_at,updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending:false })

  if (response.error && /completed_at|schema cache|column/i.test(response.error.message || '')) {
    response = await supabase
      .from('saved_searches')
      .select('id,user_id,name,query,entity_kinds,category,intent,canton,city,plz,filters,result_path,active,push_enabled,email_enabled,created_at,updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending:false })
  }

  const { data, error } = response

  if (error) throw error
  return (data || []).map(search => ({
    ...search,
    // Antes de Mi lista, active=false significaba una alerta pausada. Esas
    // entradas se muestran ahora en Conseguido en vez de desaparecer.
    completed_at:search.completed_at || (!search.active ? search.updated_at : null),
  }))
}

export async function setSavedSearchActive(userId, searchId, active) {
  const { error } = await supabase
    .from('saved_searches')
    .update({ active:Boolean(active), updated_at:new Date().toISOString() })
    .eq('id', searchId)
    .eq('user_id', userId)

  if (error) throw error
  notifySavedSearchesChanged()
}

export async function deleteSavedSearch(userId, searchId) {
  const { error } = await supabase
    .from('saved_searches')
    .delete()
    .eq('id', searchId)
    .eq('user_id', userId)

  if (error) throw error
  notifySavedSearchesChanged()
}

export async function setSavedSearchCompleted(userId, searchId, completed) {
  if (!userId || !searchId) return
  const now = new Date().toISOString()
  const values = completed
    ? { active:false, completed_at:now, email_enabled:false, updated_at:now }
    : { active:true, completed_at:null, email_enabled:false, updated_at:now }

  let { error } = await supabase
    .from('saved_searches')
    .update(values)
    .eq('id', searchId)
    .eq('user_id', userId)

  if (error && /completed_at|schema cache|column/i.test(error.message || '')) {
    const legacyValues = { active:!completed, email_enabled:false, updated_at:now }
    const legacy = await supabase
      .from('saved_searches')
      .update(legacyValues)
      .eq('id', searchId)
      .eq('user_id', userId)
    error = legacy.error
  }

  if (error) throw error
  notifySavedSearchesChanged()
}

export async function updateSavedSearch(userId, searchId, draft) {
  const normalized = normalizeSavedSearchDraft(draft)
  const fingerprint = getSavedSearchFingerprint(draft)
  if (!userId || !searchId || !normalized || !fingerprint) {
    throw new Error('Escribe algo que Latido pueda buscar.')
  }

  const values = {
    name:normalized.query || normalized.name,
    query:normalized.query,
    entity_kinds:normalized.entityKinds,
    category:normalized.category || null,
    intent:normalized.intent || null,
    canton:normalized.canton || null,
    city:normalized.city || null,
    plz:normalized.plz || null,
    filters:normalized.filters,
    result_path:normalized.resultPath,
    fingerprint,
    active:true,
    completed_at:null,
    email_enabled:false,
    updated_at:new Date().toISOString(),
  }

  let response = await supabase
    .from('saved_searches')
    .update(values)
    .eq('id', searchId)
    .eq('user_id', userId)
    .select()
    .single()

  if (response.error && /completed_at|schema cache|column/i.test(response.error.message || '')) {
    const legacyValues = { ...values }
    delete legacyValues.completed_at
    response = await supabase
      .from('saved_searches')
      .update(legacyValues)
      .eq('id', searchId)
      .eq('user_id', userId)
      .select()
      .single()
  }

  const { data, error } = response

  if (error) throw error
  notifySavedSearchesChanged(data)
  return data
}

export async function markSavedSearchMatchOpened(matchId, userId) {
  if (!matchId || !userId) return

  const openedAt = new Date().toISOString()
  const { error } = await supabase
    .from('saved_search_matches')
    .update({ read_at:openedAt, opened_at:openedAt })
    .eq('id', matchId)
    .eq('user_id', userId)

  if (error) {
    console.warn('Saved search match open could not be recorded:', error.message)
    return
  }

  void trackAnalyticsEvent('saved_search_result_open', {
    user_id:userId,
    metadata:{ source:'saved_search' },
  })
}

export async function markSavedSearchDigestOpened(searchId, userId) {
  if (!searchId || !userId) return

  const openedAt = new Date().toISOString()
  const { error } = await supabase
    .from('saved_search_matches')
    .update({ read_at:openedAt, opened_at:openedAt })
    .eq('saved_search_id', searchId)
    .eq('user_id', userId)
    .is('read_at', null)

  if (error) {
    console.warn('Saved search digest open could not be recorded:', error.message)
    return
  }

  void trackAnalyticsEvent('saved_search_result_open', {
    user_id:userId,
    metadata:{ source:'saved_search_digest' },
  })
}

export function getSavedSearchSummary(search) {
  const location = search.canton || search.city || search.plz
  const parts = [
    search.query ? `“${search.query}”` : '',
    location ? `en ${location}` : 'en toda Suiza',
  ].filter(Boolean)
  return parts.join(' ')
}

export function withSearchParam(path, key, value) {
  if (!path || !value) return path || '/'
  const separator = path.includes('?') ? '&' : '?'
  return `${path}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`
}
