export const CARD_INVITATION_DESCRIPTION =
  'Crea ofertas y haz que tu negocio destaque en Latido. Aparece en las secciones principales y consigue que más personas te descubran.'

export function cardInvitationPath(providerId) {
  return `/?crear-oferta=${encodeURIComponent(providerId)}`
}
