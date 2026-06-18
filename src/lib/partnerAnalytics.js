export const DEFAULT_PARTNER_ANALYTICS_ID = 'suiza-en-espanol'

export const PARTNER_ANALYTICS_PARTNERS = [
  {
    id:DEFAULT_PARTNER_ANALYTICS_ID,
    name:'Suiza en Español',
    logo:'/partners/suiza-en-espanol/logo-see.webp',
    campaign:'servicios-latido',
    legacyPartnerIds:['latido'],
    color:'#2563EB',
    tint:'#EFF6FF',
    services:{
      seguros:'Seguro de salud',
      'tercer-pilar':'Tercer pilar',
      curso:'Curso para llegar',
    },
  },
  {
    id:'virtus360',
    name:'Virtus360',
    logo:'/partners/virtus360/logo.svg',
    campaign:'virtus360-latido',
    legacyPartnerIds:[],
    color:'#E64661',
    tint:'#FFF1F4',
    services:{
      gestoria:'Gestoria',
      finanzas:'Finanzas',
      seguros:'Seguros',
    },
  },
]

export function resolvePartnerAnalyticsId(metadata = {}) {
  const explicitId = String(metadata.partner_id || metadata.partnerId || '').trim()
  if (PARTNER_ANALYTICS_PARTNERS.some(partner => partner.id === explicitId)) return explicitId

  const campaign = String(metadata.campaign || '').trim()
  const legacyPartnerId = String(metadata.partner || '').trim()
  const legacyMatch = PARTNER_ANALYTICS_PARTNERS.find(partner =>
    partner.campaign === campaign
    || partner.legacyPartnerIds.includes(legacyPartnerId)
  )

  return legacyMatch?.id || ''
}

export function isPartnerOutboundAnalyticsEvent(event, metadata = {}) {
  if (event?.event_type === 'partner_outbound_click') return true
  if (!['partner_promo_open', 'partner_service_click', 'partner_page_redirect'].includes(event?.event_type)) return false

  try {
    const destination = new URL(String(metadata.destination || ''), 'https://latido.ch')
    return destination.hostname === 'suizaespanol.com'
  } catch {
    return false
  }
}

export function getPartnerPlacementMeta(placement = '') {
  const value = String(placement || '').trim()

  if (value.startsWith('public_landing')) {
    return { id:'landing', label:'Landing pública', channel:'Landing' }
  }
  if (value.startsWith('app_home')) {
    return { id:'app_home', label:'Inicio de la app', channel:'App' }
  }
  if (value.startsWith('global_search')) {
    return { id:'search', label:'Búsqueda global', channel:'App' }
  }
  if (value.startsWith('guides')) {
    return { id:'guides', label:'Guías', channel:'App' }
  }
  if (value === 'direct') {
    return { id:'direct', label:'Acceso directo', channel:'App' }
  }

  return {
    id:value || 'unknown',
    label:value ? value.replaceAll('_', ' ') : 'Sin ubicación',
    channel:'App',
  }
}
