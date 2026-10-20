export const CARD_INVITATION_TITLE = 'Haz crecer tu negocio Gratis'
export const CARD_INVITATION_DESCRIPTION =
  'Los negocios con ofertas ganan visibilidad en Latido y tienen más posibilidades de ser elegidos.'

export function cardInvitationPath(providerId) {
  return `/?crear-oferta=${encodeURIComponent(providerId)}`
}
