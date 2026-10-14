export const SCANNER_STORAGE_KEY = 'latido_card_scanner_v1'
export const SCANNER_CONNECTION_KEY = 'latido_card_scanner_connection_v1'
export const SCANNER_SESSIONS_KEY = 'latido_card_scanner_sessions_v1'

export function readScannerConnections(local) {
  try {
    const sessions = JSON.parse(local.getItem(SCANNER_SESSIONS_KEY) || '[]')
    return Array.isArray(sessions)
      ? sessions.filter((s) => s?.session_id && /^[a-f0-9]{64}$/.test(s.token))
      : []
  } catch {
    return []
  }
}

export function forgetScannerConnection(session, { local, temporary }) {
  if (!session) return
  local.setItem(
    SCANNER_SESSIONS_KEY,
    JSON.stringify(readScannerConnections(local).filter((s) => s.session_id !== session.session_id))
  )
  for (const target of [local, temporary]) {
    try {
      const active = JSON.parse(target.getItem(SCANNER_STORAGE_KEY) || 'null')
      if (active?.token === session.token) target.removeItem(SCANNER_STORAGE_KEY)
    } catch {}
  }
}

// Capture the private fragment before Auth/onboarding redirects can change the
// route. Fragments are never sent to the HTTP server or copied into login URLs.
export function captureScannerHandoff(location, temporary, history, now = Date.now()) {
  if (location.pathname !== '/card/scanner/vincular' || !location.hash) return false
  const params = new URLSearchParams(location.hash.slice(1))
  const token = params.get('token'),
    fingerprint = params.get('fingerprint')
  if (!/^[a-f0-9]{64}$/.test(token) || !/^[a-f0-9]{64}$/.test(fingerprint)) return false
  try {
    temporary.setItem(
      SCANNER_CONNECTION_KEY,
      JSON.stringify({
        token,
        fingerprint,
        label: (params.get('label') || 'Scanner').slice(0, 80),
        created_at: now
      })
    )
    history.replaceState(null, '', `${location.pathname}${location.search || ''}`)
    return true
  } catch {
    return false
  }
}

export function extractCardToken(value, kind = 'card', base = 'https://latido.ch') {
  const input = String(value || '').trim()
  if (/^[a-f0-9]{64}$/.test(input)) return input
  try {
    const url = new URL(input, base)
    const allowed = new Set([new URL(base).origin, 'https://latido.ch', 'https://www.latido.ch'])
    if (!allowed.has(url.origin) || !['https:', 'http:'].includes(url.protocol)) return null
    const pattern =
      kind === 'scanner' ? /^\/scanner\/link\/([a-f0-9]{64})\/?$/ : /^\/c\/([a-f0-9]{64})\/?$/
    return url.pathname.match(pattern)?.[1] || null
  } catch {
    return null
  }
}

// Camera QRs include their route. A bare token is ambiguous and is only
// accepted by the separate, explicitly labelled manual entry forms.
export function classifyLatidoQr(value, base = 'https://latido.ch') {
  if (/^[a-f0-9]{64}$/.test(String(value || '').trim())) return null
  for (const kind of ['scanner', 'card']) {
    const token = extractCardToken(value, kind, base)
    if (token) return { kind, token }
  }
  return null
}

export function offerUsageLabel(offer) {
  if (offer.usage_period === 'unlimited') return 'Sin límite de usos'
  const limit = offer.usage_limit || 1
  return `${limit} ${limit === 1 ? 'uso' : 'usos'} ${offer.usage_period === 'month' ? 'por mes natural' : 'en total'}`
}

export function offerBenefitLabel(offer) {
  if (offer.benefit_type === 'percent') return `${Number(offer.benefit_value)} % de descuento`
  if (offer.benefit_type === 'fixed') return `CHF ${Number(offer.benefit_value)} de descuento`
  if (offer.benefit_type === 'two_for_one') return '2 × 1'
  return offer.benefit_type === 'service' ? 'Servicio incluido' : 'Regalo incluido'
}

export function storeScannerSession(session, { local, temporary }) {
  const selected = session.persistent ? local : temporary
  const other = session.persistent ? temporary : local
  // Save before removing the fallback; unavailable storage must not lose access.
  selected.setItem(SCANNER_STORAGE_KEY, JSON.stringify(session))
  other.removeItem(SCANNER_STORAGE_KEY)
  if (session.persistent && session.session_id) {
    const saved = readScannerConnections(local).filter((s) => s.session_id !== session.session_id)
    // Bound browser storage without revoking other valid server connections.
    local.setItem(SCANNER_SESSIONS_KEY, JSON.stringify([...saved, session].slice(-100)))
  }
}

export function readScannerSession({ local, temporary }, now = Date.now()) {
  for (const storage of [temporary, local]) {
    try {
      const session = JSON.parse(storage.getItem(SCANNER_STORAGE_KEY) || 'null')
      if (!session || !/^[a-f0-9]{64}$/.test(session.token)) continue
      if (session.expires_at && Date.parse(session.expires_at) <= now) {
        storage.removeItem(SCANNER_STORAGE_KEY)
        continue
      }
      return session
    } catch {
      /* Recover using the other storage area. */
    }
  }
  return null
}

export function cardErrorMessage(error) {
  const text = String(error?.message || error || '')
  const messages = {
    CARD_CODE_INVALID:
      'El código no es válido o ha caducado. Pide al cliente que muestre uno nuevo.',
    CARD_CODE_RATE_LIMIT:
      'Has hecho varios intentos. Espera un minuto antes de probar otro código.',
    CARD_CODE_ISSUE_LIMIT: 'Has generado varios códigos. Vuelve a intentarlo más tarde.',
    CARD_CODE_PENDING: 'Confirma el canje pendiente antes de consultar otra tarjeta.',
    PROFILE_NAME_REQUIRED:
      'Añade tu nombre en el perfil de Latido antes de vincular este dispositivo.',
    PHYSICAL_REQUEST_ALREADY_OPEN:
      'Ya tienes una solicitud de tarjeta en curso. Puedes consultarla aquí.',
    PHYSICAL_REQUEST_RATE_LIMIT: 'Has enviado varias solicitudes hoy. Vuelve a intentarlo mañana.',
    PHYSICAL_REQUEST_KIND_INVALID:
      'El tipo de solicitud ha cambiado. Actualiza la página antes de continuar.',
    PHYSICAL_DETAILS_INVALID:
      'Comprueba el nombre y los datos de entrega. El envío requiere una dirección y código postal suizos.',
    PHYSICAL_REQUEST_IN_PROGRESS:
      'La tarjeta ya está en preparación. Contacta con Latido para cambiar esta solicitud.',
    PHYSICAL_REQUEST_CHANGED:
      'Otro administrador ha actualizado esta solicitud. Actualiza la bandeja antes de continuar.',
    PHYSICAL_REQUEST_NOT_FOUND: 'No se encontró esta solicitud.',
    PHYSICAL_STATUS_INVALID: 'Este cambio de estado no corresponde al paso actual de la solicitud.',
    PHYSICAL_CARD_ALREADY_ISSUED:
      'Esta solicitud ya tiene una tarjeta emitida. Utiliza la reemisión si necesitas otro QR.',
    PHYSICAL_CARD_INVALID:
      'El QR asociado a esta solicitud está bloqueado. Reemite la tarjeta antes de continuar con la entrega.',
    CONTACT_EMAIL_REQUIRED:
      'Necesitamos un email de contacto en tu perfil para gestionar la solicitud.',
    SCANNER_EXPIRED: 'El acceso a Scanner ha caducado o se ha revocado. Vuelve a vincularlo.',
    SCANNER_LINK_INVALID:
      'El QR del negocio ya no es válido. Solicita el QR actual al propietario.',
    SCANNER_RATE_LIMIT: 'Se han vinculado muchos Scanners recientemente. Inténtalo más tarde.',
    CARD_INVALID: 'Esta tarjeta ha caducado o está bloqueada. Pide al socio una tarjeta válida.',
    MEMBERSHIP_INACTIVE: 'La membresía no está activa.',
    OFFER_UNAVAILABLE: 'La ventaja ya no está disponible. Vuelve a consultar la tarjeta.',
    OFFER_SOLD_OUT: 'No quedan unidades para reclamar.',
    OFFER_USED: 'Ya has utilizado esta promoción.',
    OFFER_CAPACITY:
      'El negocio puede tener una ventaja incluida y dos promociones especiales vigentes.',
    BUSINESS_SUSPENDED:
      'Latido ha suspendido este negocio. Contacta con Latido para revisar el caso.',
    SCANNER_LINK_RATE_LIMIT:
      'Se han generado muchos QR para este negocio hoy. Reutiliza un QR existente o inténtalo mañana.',
    BUSINESS_INACTIVE: 'El negocio no está activo en Tarjeta Latido.',
    FORBIDDEN: 'No tienes permiso para realizar esta operación.',
    AUTH_REQUIRED: 'Inicia sesión para continuar.',
    OFFER_TERMS_LOCKED:
      'Esta oferta ya tiene actividad. Crea una nueva versión para cambiar las condiciones.',
    SCANNER_ACTION_INVALID: 'La solicitud de Scanner ha caducado o ya no se puede aprobar.',
    REASON_REQUIRED: 'Escribe el motivo de la anulación.',
    REQUEST_CONFLICT: 'Este intento corresponde a otra operación. Consulta el historial.'
  }
  const code = Object.keys(messages).find((key) => text.includes(key))
  if (code) return messages[code]
  if (error?.code === 'PGRST202' || error?.code === '42P01' || text.includes('lc_catalog')) {
    return 'Tarjeta Latido todavía no está habilitado en este servidor. Falta instalar su migración.'
  }
  return 'No se pudo confirmar la operación. Comprueba la conexión e inténtalo de nuevo.'
}
