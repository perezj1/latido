export const JOBLI_PROVIDER_ID = 'eb01f0b2-101c-4634-8909-b432981d37eb'

const JOBLI_CARD_DESTINATION_URL = 'https://www.joblis.ch/?utm_source=latido&utm_medium=web&utm_campaign=empleos'

const JOBLI_CARD_SERVICE_LABELS = {
  'CV y carta de motivación al estándar suizo':'CV + Carta',
  'Estrategia personal de búsqueda de empleo':'Estrategia personal',
  'Brújula Laboral: documentos + estrategia + lista de empresas':'Brújula laboral',
}

export function getBusinessPartnerCardDestinationOverride(providerId) {
  if (String(providerId || '') !== JOBLI_PROVIDER_ID) return null

  return {
    href:JOBLI_CARD_DESTINATION_URL,
    label:'Contactar',
    external:true,
    direct:true,
  }
}

export function getBusinessPartnerCardServiceLabel(providerId, service) {
  const originalLabel = String(service || '')
  if (String(providerId || '') !== JOBLI_PROVIDER_ID) return originalLabel
  return JOBLI_CARD_SERVICE_LABELS[originalLabel] || originalLabel
}
