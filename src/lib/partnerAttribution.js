import { trackAnalyticsEvent } from './analytics'

const PARTNER_ID = 'latido'
const DEFAULT_CAMPAIGN = 'servicios-latido'
const STORAGE_KEY = 'latido_partner_attribution'
const FIRST_TOUCH_KEY = 'latido_partner_first_touch'

function readStorage(key) {
  try {
    return JSON.parse(window.localStorage.getItem(key))
  } catch {
    return null
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Attribution still travels in the outbound URL when storage is unavailable.
  }
}

function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${PARTNER_ID}-${crypto.randomUUID()}`
  }

  return `${PARTNER_ID}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function getPartnerAttribution() {
  if (typeof window === 'undefined') {
    return {
      partner:PARTNER_ID,
      cid:'',
      utmSource:PARTNER_ID,
      utmMedium:'partner',
      utmCampaign:DEFAULT_CAMPAIGN,
    }
  }

  const params = new URLSearchParams(window.location.search)
  const previous = readStorage(STORAGE_KEY) || {}
  const attribution = {
    partner:params.get('partner') || previous.partner || PARTNER_ID,
    cid:params.get('see_cid') || previous.cid || createId(),
    utmSource:params.get('utm_source') || previous.utmSource || PARTNER_ID,
    utmMedium:params.get('utm_medium') || previous.utmMedium || 'partner',
    utmCampaign:params.get('utm_campaign') || previous.utmCampaign || DEFAULT_CAMPAIGN,
    updatedAt:Date.now(),
  }

  if (!readStorage(FIRST_TOUCH_KEY)) writeStorage(FIRST_TOUCH_KEY, attribution)
  writeStorage(STORAGE_KEY, attribution)
  return attribution
}

export function getPartnerServiceUrl(path, service) {
  const attribution = getPartnerAttribution()
  const url = new URL(path, 'https://suizaespanol.com')

  url.searchParams.set('utm_source', attribution.utmSource)
  url.searchParams.set('utm_medium', attribution.utmMedium)
  url.searchParams.set('utm_campaign', attribution.utmCampaign)
  url.searchParams.set('utm_content', service)
  url.searchParams.set('partner', attribution.partner)
  url.searchParams.set('see_cid', attribution.cid)

  return url.toString()
}

export function trackPartnerInteraction(eventType, {
  userId = null,
  placement = '',
  service = '',
  destination = '',
} = {}) {
  const attribution = getPartnerAttribution()

  return trackAnalyticsEvent(eventType, {
    user_id:userId,
    metadata:{
      partner:attribution.partner,
      campaign:attribution.utmCampaign,
      cid:attribution.cid,
      placement,
      service,
      destination,
    },
  })
}
