import { offerComboLabel } from './latidoCardCore.js'

export const liveOffers = (offers = [], now = Date.now()) =>
  offers.filter(
    (offer) =>
      offer.active &&
      !offer.deleted_at &&
      (offer.ends_at === 'infinity' || Date.parse(offer.ends_at) > now)
  )

export function businessBenefit(offers = []) {
  const best = Math.max(
    0,
    ...offers.filter((o) => o.benefit_type === 'percent').map((o) => Number(o.benefit_value))
  )
  const fixed = Math.max(
    0,
    ...offers.filter((o) => o.benefit_type === 'fixed').map((o) => Number(o.benefit_value))
  )
  return best
    ? `Hasta −${best} %`
    : fixed
      ? `−CHF ${fixed}`
      : offerComboLabel(offers.find((o) => offerComboLabel(o)) || {}) ||
        (offers.some((o) => o.benefit_type === 'gift') ? 'Regalo' : 'Beneficio')
}

export function membershipMailUrl({ user, name, member, renew = false }) {
  const subject = renew ? 'Renovar membresía de Latido Club' : 'Latido Club - Membresía CHF 6,90 al mes'
  const body = [
    renew ? 'Quiero renovar mi membresía de Latido Club' : 'Quiero hacerme socio de Latido Club',
    '',
    `Nombre: ${name || user?.user_metadata?.name || ''}`,
    `Email de la cuenta: ${user?.email || ''}`,
    member?.member_number != null ? `Número de socio: ${member.member_number}` : ''
  ]
    .filter((line) => line !== '')
    .join('\n')
  return `mailto:info@latido.ch?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export function offerState(offer, now = Date.now()) {
  if (offer.ends_at !== 'infinity' && Date.parse(offer.ends_at) <= now) return 'Caducada'
  if (!offer.active) return 'Pausada'
  if (offer.requires_claim && offer.remaining != null && Number(offer.remaining) <= 0)
    return 'Agotada'
  return 'Activa'
}
