import { offerBenefitLabel } from './latidoCardCore.js'

// Share the public offer ID, never a membership/Scanner credential or a reservation.
export function cardOfferShareData(offer, origin = window.location.origin) {
  const url = new URL('/card', origin)
  url.searchParams.set('oferta', offer.id)
  return {
    title: `${offer.title} · Tarjeta Latido`,
    text: `${offerBenefitLabel(offer)} en ${offer.business_name}. Crea tu cuenta en Latido y únete al club de ventajas con tu Tarjeta Latido por CHF 6,90 al mes.`,
    url: url.href
  }
}

export async function shareCardOffer(offer, nav = navigator, origin = window.location.origin) {
  const data = cardOfferShareData(offer, origin)
  if (typeof nav.share === 'function') {
    try {
      await nav.share(data)
      return { status: 'shared', url: data.url }
    } catch (error) {
      if (error?.name === 'AbortError') return { status: 'cancelled', url: data.url }
    }
  }
  try {
    if (typeof nav.clipboard?.writeText === 'function') {
      await nav.clipboard.writeText(`${data.text}\n${data.url}`)
      return { status: 'copied', url: data.url }
    }
  } catch {}
  return { status: 'manual', url: data.url }
}
