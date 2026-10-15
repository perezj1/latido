import { offerBenefitLabel } from './latidoCardCore.js'

// Share the public offer ID, never a private validation or reservation.
export function cardOfferShareData(offer, origin = window.location.origin) {
  const url = new URL('/card', origin)
  url.searchParams.set('oferta', offer.id)
  return {
    title: `${offer.title} · Tarjeta Latido`,
    text: `${offerBenefitLabel(offer)} en ${offer.business_name}. Crea tu cuenta en Latido y únete al club de descuentos con tu Tarjeta Latido por CHF 6,90 al mes.`,
    url: url.href
  }
}

export async function shareCardOffer(offer, nav = navigator, origin = window.location.origin) {
  return shareLatidoLink(cardOfferShareData(offer, origin), nav)
}

export function shareCardBusiness(
  providerId,
  businessName,
  nav = navigator,
  origin = window.location.origin
) {
  return shareLatidoLink(
    {
      title: `${businessName} · Tarjeta Latido`,
      text: `Descubre tus descuentos de Tarjeta Latido en ${businessName}.`,
      url: new URL(`/card/negocio/${providerId}`, origin).href
    },
    nav
  )
}

async function shareLatidoLink(data, nav) {
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
