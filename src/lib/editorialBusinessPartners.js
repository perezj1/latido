import { PUNTO_HISPANO_PROVIDER_ID } from './puntoHispano.js'
import { normalizeSearchText } from './naturalSearch.js'

export const EDITORIAL_PREMIUM_PARTNERS = [
  {
    id:'punto-hispano',
    providerId:PUNTO_HISPANO_PROVIDER_ID,
    name:'Punto Hispano',
    aliases:['punto hispano', 'punto hispano asesoria'],
    type:'asesoria_tramites',
    city:'Zürich',
    canton:'ZH',
    description:'Gestoría, asesoría, alquiler, vivienda, seguros e idiomas en Suiza con atención en español.',
    services:['Alquiler', 'Gestoría', 'Vivienda', 'Seguros', 'Idiomas'],
    categories:['negocios', 'servicios', 'documentos', 'vivienda'],
    image:'/partners/punto-hispano/logo.webp',
    href:'/servicios-suiza',
  },
  {
    id:'suiza-en-espanol',
    name:'Suiza en Español',
    aliases:['suiza en espanol', 'suiza espanol'],
    type:'asesoria_tramites',
    city:'Suiza',
    canton:'',
    description:'Orientación en español sobre seguros, previsión y llegada a Suiza.',
    services:['Seguro de salud', 'Tercer pilar', 'Curso para llegar'],
    categories:['negocios', 'servicios', 'documentos'],
    image:'/partners/suiza-en-espanol/logo-see.webp',
    href:'/servicios-suiza?partner=suiza-en-espanol&from=global-search',
  },
  {
    id:'virtus360',
    providerId:'0e1e602e-dda4-4e78-aa67-5027cf43620b',
    name:'Virtus360',
    aliases:['360 virtus gmbh', 'virtus360'],
    type:'asesoria_tramites',
    city:'Horgen',
    canton:'ZH',
    description:'Gestoría, finanzas, seguros, impuestos, contabilidad y trámites para vivir o emprender en Suiza.',
    services:['Gestoría', 'Finanzas', 'Seguros', 'Impuestos', 'Contabilidad'],
    categories:['negocios', 'servicios', 'documentos'],
    image:'/partners/virtus360/logo.svg',
    href:'/servicios-virtus360',
  },
  {
    id:'bellini',
    providerId:'6a3dc2c6-bf70-47a4-8da8-3f5b82eea111',
    name:'Bellini Personal AG',
    aliases:['bellini', 'bellini personal ag'],
    type:'empleo',
    city:'Luzern',
    canton:'LU',
    description:'Empleo temporal, selección de personal y oportunidades laborales en construcción en Suiza.',
    services:['Empleo', 'Trabajo temporal', 'Construcción', 'Asesoramiento laboral'],
    categories:['negocios', 'empleo', 'servicios'],
    image:'/partners/bellini/logo-wide.svg',
    href:'/colaboradores/bellini',
  },
  {
    id:'syna',
    providerId:'7edd3612-cf9e-4d92-9b6e-861544127030',
    name:'Syna',
    aliases:['syna'],
    type:'empleo',
    city:'Luzern',
    canton:'LU',
    description:'Acompañamiento para trabajadores sobre empleo, contratos, salarios, derechos laborales y sindicatos en Suiza.',
    services:['Trabajo', 'Derechos laborales', 'Contratos', 'Salarios', 'Sindicato'],
    categories:['negocios', 'empleo', 'servicios'],
    image:'/partners/syna/logo.svg',
    href:'/colaboradores/syna',
  },
  {
    id:'gilda',
    name:'GILDA by de Matos',
    aliases:['gilda', 'gilda by de matos', 'de matos'],
    type:'restaurante',
    city:'Luzern',
    canton:'LU',
    description:'Tapas de autor, cocina española, wine bar, lunch y platos para compartir en Lucerna.',
    services:['Tapas', 'Cocina española', 'Wine bar', 'Lunch'],
    categories:['negocios'],
    image:'/partners/gilda/logo.png',
    href:'https://www.dematos-luzern.ch/cafeweinbar',
  },
  {
    id:'mira',
    name:'mira',
    aliases:['mira'],
    type:'asesoria_tramites',
    city:'Suiza',
    canton:'',
    description:'Información, asesoramiento y acompañamiento intercultural para personas migrantes en Suiza.',
    services:['Información', 'Asesoramiento', 'Migración', 'Intercambio'],
    categories:['negocios', 'servicios', 'documentos'],
    image:'/partners/mira/mira-removebg-preview.png',
    href:'/colaboradores/mira',
  },
]

export function getEditorialPremiumPartner(business) {
  const normalizedName = normalizeSearchText(business?.name)
  if (!normalizedName) return null
  return EDITORIAL_PREMIUM_PARTNERS.find(partner => (
    (partner.providerId && partner.providerId === business?.id)
    || partner.aliases.includes(normalizedName)
  )) || null
}

// Directory priority uses verified provider IDs, never a display name. These
// partners already have Premium editorial placement in Home and Search. Reuse
// their existing rows without creating businesses or changing subscriptions.
export function getEditorialDirectoryPartner(business) {
  if (!business?.id || business.active === false) return null
  return EDITORIAL_PREMIUM_PARTNERS.find(partner => partner.providerId === business.id) || null
}
