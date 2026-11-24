const STATIC_ROUTES = new Set([
  '/', '/paquetes', '/explorar', '/tablon', '/publicar', '/comunidades',
  '/colaboraciones', '/tienda', '/club', '/tarjeta-latido', '/card',
  '/card/negocios', '/card/admin', '/guias', '/creadores', '/creadores/alta',
  '/creadores/mi-perfil', '/perfil', '/auth', '/auth/onboarding', '/reset-password',
  '/publicar-evento', '/publicar-empleo', '/registrar-negocio', '/registrar-comunidad',
  '/mensajes', '/admin-latido', '/impressum', '/privacidad', '/cookies', '/terminos',
  '/descargo', '/documentos', '/empleos', '/servicios-suiza', '/servicios-virtus360',
  '/santiago-cruz', '/contacto-punto-hispano',
  '/latido', '/publicar-contenido', '/colaboradores/mira', '/colaboradores/bellini',
  '/colaboradores/syna',
])
const DYNAMIC_ROUTES = [
  [/^\/card\/validacion\/[^/]+$/, '/card/validacion/[id]'],
  [/^\/card\/negocio\/[^/]+$/, '/card/negocio/[id]'],
  [/^\/card\/material\/[^/]+$/, '/card/material/[id]'],
  [/^\/c\/[^/]+$/, '/c/[token]'],
  [/^\/scanner(?:\/.*)?$/, '/scanner'],
  [/^\/publicar\/punto-hispano\/[^/]+$/, '/publicar/punto-hispano/[token]'],
  [/^\/anuncios\/[^/]+$/, '/anuncios/[adSlug]'],
  [/^\/empleos\/[^/]+$/, '/empleos/[jobSlug]'],
  [/^\/negocios\/[^/]+\/(destacar|alertas)$/, '/negocios/[businessSlug]/$1'],
  [/^\/negocios\/[^/]+$/, '/negocios/[businessSlug]'],
  [/^\/eventos\/[^/]+$/, '/eventos/[eventSlug]'],
  [/^\/guias\/[^/]+$/, '/guias/[guideSlug]'],
  [/^\/creadores\/[^/]+$/, '/creadores/[creatorSlug]'],
  [/^\/paquetes\/[^/]+$/, '/paquetes/[packageSlug]'],
  [/^\/latido-x\/[^/]+$/, '/latido-x/[businessSlug]'],
]

export function getAnalyticsRoute(pathname = '/') {
  // Never retain URL parameters, fragments, or unrecognised path segments.
  const route = String(pathname || '/').split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/'
  if (STATIC_ROUTES.has(route)) return route
  const match = DYNAMIC_ROUTES.find(([pattern]) => pattern.test(route))
  return match ? route.replace(match[0], match[1]) : '/[other]'
}

export function isPrivateAnalyticsRoute(pathname = '') {
  return /^\/(?:c(?:\/|$)|scanner(?:\/|$)|card\/(?:validacion|scanner)(?:\/|$)|publicar\/punto-hispano(?:\/|$)|seguimiento(?:\/|$))/.test(pathname)
}

// Keep counters and conversion attribution, never free text, result titles,
// contact details, arbitrary URLs, nested filters or conversation identifiers.
const METADATA_KEYS = new Set([
  'action', 'step', 'mode', 'scope', 'cat', 'category', 'active_filter',
  'method', 'entry_point', 'interest_count', 'creator_onboarding',
  'content_type', 'intent', 'channel', 'moderation_status',
  'partner_id', 'placement', 'service', 'giveaway_id', 'entry_type',
  'marketing_consent', 'video_id', 'entity_kind', 'has_query', 'has_location',
  'source', 'is_logged_in', 'is_pwa', 'search_attempt_id', 'results_count',
  'result_count', 'result_type', 'answer', 'had_solution_action',
  'solution_action', 'time_to_action_ms', 'time_to_feedback_ms', 'reason',
])

export function sanitizeAnalyticsMetadata(metadata = {}) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {}
  const clean = {}
  for (const [key, value] of Object.entries(metadata)) {
    if (!METADATA_KEYS.has(key)) continue
    if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) {
      clean[key] = value
    } else if (typeof value === 'string' && value.length <= 100
      && !/[@\r\n]|https?:|mailto:|tel:/i.test(value)) {
      clean[key] = value
    }
  }
  if (typeof metadata.query === 'string') clean.has_query = metadata.query.trim().length > 0
  return clean
}
