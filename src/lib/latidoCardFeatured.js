import { getCantonForCity } from './constants.js'

export function cardFeaturedDay(now = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date(now))
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return Math.floor(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)) / 86400000)
}

export function selectFeaturedCardOffer(offers, { canton = '', businesses = [], now = Date.now() } = {}) {
  const providers = new Map(businesses.map((business) => [business.id, business]))
  const eligible = offers.filter((offer) =>
    offer.provider_id && offer.id && offer.active !== false && !offer.deleted_at &&
    (offer.ends_at === 'infinity' || Date.parse(offer.ends_at) > now) &&
    (!offer.starts_at || Date.parse(offer.starts_at) <= now) &&
    (offer.remaining == null || Number(offer.remaining) > 0)
  ).map((offer) => {
    const business = providers.get(offer.provider_id)
    return {
      ...offer,
      canton: offer.canton || business?.canton || getCantonForCity(offer.city),
      business_photo_url: offer.business_photo_url || business?.photo_url
    }
  })
  const local = canton ? eligible.filter((offer) => offer.canton === canton) : []
  const grouped = new Map()
  for (const offer of local.length ? local : eligible) {
    if (!grouped.has(offer.provider_id)) grouped.set(offer.provider_id, [])
    grouped.get(offer.provider_id).push(offer)
  }
  const ids = [...grouped.keys()].sort()
  if (!ids.length) return null
  const day = cardFeaturedDay(now)
  const businessOffers = grouped.get(ids[day % ids.length]).sort((a, b) => a.id.localeCompare(b.id))
  return businessOffers[Math.floor(day / ids.length) % businessOffers.length]
}
