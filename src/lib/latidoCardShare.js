import { extractCardToken, offerBenefitLabel } from './latidoCardCore.js'

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
  return shareLatidoLink(cardOfferShareData(offer, origin), nav)
}

// This private capability link is shared deliberately by the business owner,
// exclusively with staff. It grants no access without an authenticated account.
export function scannerConnectionShareData(link, businessName, origin = window.location.origin) {
  const token = extractCardToken(link, 'scanner', origin)
  if (!token) throw new Error('SCANNER_LINK_INVALID')
  const url = new URL(`/scanner/link/${token}`, origin)
  url.searchParams.set('camera', '1')
  return {
    title: `Conectar con ${businessName} · Latido Scanner`,
    text: `Conéctate al equipo de ${businessName} en Latido Scanner. Abre este enlace e inicia sesión o crea una cuenta gratis. No necesitas una suscripción de pago.`,
    url: url.href
  }
}

export async function shareScannerConnection(
  link,
  businessName,
  nav = navigator,
  origin = window.location.origin
) {
  return shareLatidoLink(scannerConnectionShareData(link, businessName, origin), nav)
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
