import { trackAnalyticsEvent } from './analytics'
import { DEFAULT_PARTNER_ANALYTICS_ID } from './partnerAnalytics'

const PARTNER_ID = 'latido'
const DEFAULT_CAMPAIGN = 'servicios-latido'
const STORAGE_KEY = 'latido_partner_attribution'
const FIRST_TOUCH_KEY = 'latido_partner_first_touch'
export const PARTNER_LANDING_URL = 'https://suizaespanol.com/latido/?utm_source=latido&utm_medium=partner&utm_campaign=servicios-latido'

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

export function getPartnerServiceUrl() {
  return PARTNER_LANDING_URL
}

export function trackPartnerInteraction(eventType, {
  userId = null,
  partnerId = DEFAULT_PARTNER_ANALYTICS_ID,
  placement = '',
  action = '',
  service = '',
  destination = '',
} = {}) {
  const attribution = getPartnerAttribution()

  return trackAnalyticsEvent(eventType, {
    user_id:userId,
    metadata:{
      partner_id:partnerId,
      affiliate:attribution.partner,
      campaign:attribution.utmCampaign,
      cid:attribution.cid,
      placement,
      action,
      service,
      destination,
    },
  })
}
