export function offerUsageLabel(offer) {
  if (offer.usage_period === 'unlimited') return 'Sin límite de usos'
  const limit = offer.usage_limit || 1
  const period = {
    day: 'al día',
    week: 'por semana',
    month: 'por mes natural',
    lifetime: 'en total'
  }
  return `${limit} ${limit === 1 ? 'uso' : 'usos'} ${period[offer.usage_period] || 'en total'}`
}

export function offerHasEnd(offer) {
  return Number.isFinite(Date.parse(offer.ends_at))
}

export function offerComboLabel(offer) {
  if (offer.benefit_type === 'two_for_one') return '2x1'
  if (offer.benefit_type !== 'service') return ''
  if (/^3[x×]2(?:\s|$)/i.test(offer.title || '')) return '3x2'
  if (/^2\.ª unidad a mitad de precio(?:\s|$)/i.test(offer.title || '')) return '2.ª a mitad'
  return ''
}

export function offerBenefitLabel(offer) {
  if (offer.benefit_type === 'percent') return `${Number(offer.benefit_value)} % de descuento`
  if (offer.benefit_type === 'fixed') return `CHF ${Number(offer.benefit_value)} de descuento`
  if (offer.benefit_type === 'two_for_one') return '2 × 1'
  return offer.benefit_type === 'service'
    ? offer.title || 'Beneficio para socios'
    : 'Regalo incluido'
}

export function remainingValidationSeconds(receipt, verifiedAt, now = performance.now()) {
  if (!receipt?.valid || !Number.isFinite(verifiedAt)) return 0
  const lifetime = Date.parse(receipt.expires_at) - Date.parse(receipt.server_now)
  return Math.max(0, Math.ceil((lifetime - Math.max(0, now - verifiedAt)) / 1000))
}

export function offerAvailability(offer, { memberActive = false, now = Date.now() } = {}) {
  const used =
    offer.claim?.status === 'used' ||
    (offer.usage_period !== 'unlimited' &&
      Number(offer.used_count || 0) >= Number(offer.usage_limit || 1))
  if (used) {
    const next = Date.parse(offer.next_available_at)
    const message =
      Number.isFinite(next) && next > now
        ? `Disponible de nuevo el ${new Intl.DateTimeFormat('es-CH', { day: 'numeric', month: 'short', timeZone: 'Europe/Zurich' }).format(new Date(next))}`
        : 'Ya has utilizado este descuento.'
    return { unavailable: true, message }
  }
  if (
    offer.requires_claim &&
    offer.claim?.status !== 'claimed' &&
    offer.remaining != null &&
    Number(offer.remaining) <= 0
  ) {
    return { unavailable: true, message: 'Sin unidades disponibles.' }
  }
  if (memberActive && !offer.requires_claim && offer.available === false) {
    return { unavailable: true, message: 'No disponible en este momento.' }
  }
  return { unavailable: false, message: '' }
}

export function cardErrorMessage(
  error,
  fallback = 'No se pudo confirmar la operación. Comprueba la conexión y vuelve a intentarlo.'
) {
  const text = String(error?.message || error || '')
  const messages = {
    MEMBERSHIP_INACTIVE: 'Tu membresía no está activa.',
    OFFER_UNAVAILABLE: 'Este descuento ya no está disponible. Consulta tus descuentos de nuevo.',
    OFFER_SOLD_OUT: 'No quedan unidades disponibles.',
    OFFER_USED: 'Ya has utilizado esta promoción.',
    OFFER_CAPACITY: 'Puedes publicar un descuento habitual y dos promociones limitadas vigentes.',
    BUSINESS_SUSPENDED: 'Latido ha retirado este negocio del programa. Contacta con Latido.',
    OFFER_REQUIRED: 'Publica un descuento para participar en Tarjeta Latido.',
    BUSINESS_INACTIVE: 'Este negocio no está participando en Tarjeta Latido.',
    FORBIDDEN: 'No tienes permiso para realizar esta operación.',
    AUTH_REQUIRED: 'Inicia sesión para continuar.',
    OFFER_TERMS_LOCKED: 'Esta oferta ya tiene actividad. Usa «Crear nueva versión» para cambiar sus condiciones.',
    OFFER_PAUSE_REQUIRED: 'Pausa el descuento antes de borrarlo.',
    VALIDATION_NOT_FOUND: 'Esta validación no pertenece a tu cuenta o ya no existe.',
    REASON_REQUIRED: 'Escribe el motivo de la anulación.',
    REQUEST_CONFLICT: 'Este intento corresponde a otra operación. Consulta el historial.'
  }
  const code = Object.keys(messages).find((key) => text.includes(key))
  if (code) return messages[code]
  if (error?.code === 'PGRST202' || error?.code === '42P01')
    return 'Falta instalar la actualización de Tarjeta Latido en este servidor.'
  return fallback
}
