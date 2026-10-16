export const CARD_INVITATION_TITLE = 'Dales un motivo para visitarte'
export const CARD_INVITATION_DESCRIPTION =
  'Ofrece un descuento a los socios de Tarjeta Latido y haz que más personas de la comunidad elijan tu negocio.'

export function cardInvitationPath(providerId) {
  return `/?crear-oferta=${encodeURIComponent(providerId)}`
}
