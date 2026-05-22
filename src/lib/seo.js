import {
  EVENTO_TYPES,
  MOCK_ADS,
  MOCK_DOCS,
  MOCK_EVENTOS_LATINOS,
  MOCK_JOBS,
  MOCK_NEGOCIOS,
  formatAdLocation,
  getAdDisplayCat,
  getJobIntentMeta,
  getNegocioTypeMeta,
} from './constants.js'

export const SITE_URL = (import.meta.env?.VITE_SITE_URL || 'https://latido.ch').replace(/\/$/, '')
export const SITE_NAME = 'Latido.ch'
export const DEFAULT_IMAGE = '/og-image.png'

const DEFAULT_DESCRIPTION = 'La plataforma para hispanohablantes en Suiza: anuncios, empleo, comunidades, eventos, negocios y guías prácticas en español.'

export const DEFAULT_SEO = {
  title:'Latido.ch - Comunidad hispanohablante en Suiza',
  description:DEFAULT_DESCRIPTION,
  path:'/',
  image:DEFAULT_IMAGE,
  type:'website',
  robots:'index, follow',
}

export const SEARCHABLE_SITE_PAGES = [
  { id:'inicio', icon:'🏠', title:'Inicio', section:'Latido', desc:'Resumen de anuncios, empleos, negocios, eventos y guías.', href:'/' },
  { id:'tablon', icon:'📌', title:'Tablón de anuncios', section:'Anuncios', desc:'Vivienda, servicios, cuidados, mercado, trámites y empleo.', href:'/tablon' },
  { id:'vivienda', icon:'🏠', title:'Vivienda', section:'Tablón', desc:'Pisos, habitaciones, compañeros y alquileres temporales.', href:'/tablon?cat=vivienda' },
  { id:'empleo', icon:'💼', title:'Empleo', section:'Tablón', desc:'Ofertas de trabajo y perfiles que buscan empleo.', href:'/tablon?cat=empleo' },
  { id:'mercado', icon:'🛍️', title:'Mercado', section:'Tablón', desc:'Compra, venta, regalos y artículos de segunda mano.', href:'/tablon?cat=venta' },
  { id:'servicios', icon:'🔧', title:'Servicios', section:'Tablón', desc:'Limpieza, clases, reparaciones, mudanzas y ayuda local.', href:'/tablon?cat=servicios' },
  { id:'tramites', icon:'📄', title:'Trámites', section:'Tablón', desc:'Cartas, traducciones, asesoría y gestiones en Suiza.', href:'/tablon?cat=documentos' },
  { id:'comunidades', icon:'🤝', title:'Comunidades', section:'Comunidad', desc:'Grupos latinos por país, ciudad, deporte, idioma e intereses.', href:'/comunidades' },
  { id:'negocios', icon:'🏪', title:'Negocios latinos', section:'Comunidad', desc:'Directorio de restaurantes, tiendas, belleza, salud y servicios.', href:'/comunidades?view=negocios' },
  { id:'eventos', icon:'🎉', title:'Eventos latinos', section:'Comunidad', desc:'Conciertos, fiestas, quedadas, networking y planes familiares.', href:'/comunidades?view=eventos' },
  { id:'guias', icon:'📚', title:'Guías para vivir en Suiza', section:'Guías', desc:'Permisos, impuestos, salud, banco, educación, trabajo y vivienda.', href:'/guias' },
  { id:'perfil', icon:'👤', title:'Perfil', section:'Cuenta', desc:'Datos personales, avatar, preferencias y configuración.', href:'/perfil' },
  { id:'mensajes', icon:'💬', title:'Mensajes', section:'Cuenta', desc:'Conversaciones con anunciantes, negocios y miembros de Latido.', href:'/mensajes' },
  { id:'privacidad', icon:'🔒', title:'Privacidad', section:'Legal', desc:'Cómo Latido trata los datos y protege la información.', href:'/privacidad' },
  { id:'terminos', icon:'📜', title:'Términos', section:'Legal', desc:'Condiciones de uso de Latido.', href:'/terminos' },
  { id:'impressum', icon:'ℹ️', title:'Impressum', section:'Legal', desc:'Información legal y contacto responsable de Latido.', href:'/impressum' },
]

const ROUTE_SEO = [
  {
    path:'/',
    title:'Latido.ch - Comunidad hispanohablante en Suiza',
    description:DEFAULT_DESCRIPTION,
  },
  {
    path:'/tablon',
    title:'Tablón de anuncios para hispanohablantes en Suiza | Latido.ch',
    description:'Encuentra vivienda, servicios, empleo, cuidados, trámites y mercado entre la comunidad hispanohablante en Suiza.',
  },
  {
    path:'/comunidades',
    title:'Comunidades, negocios y eventos latinos en Suiza | Latido.ch',
    description:'Conecta con grupos, negocios latinos, eventos y planes para hispanohablantes en Suiza.',
  },
  {
    path:'/guias',
    title:'Guías para vivir en Suiza en español | Latido.ch',
    description:'Guías prácticas sobre permisos, impuestos, salud, bancos, trabajo, vivienda y educación para vivir en Suiza.',
  },
  {
    path:'/impressum',
    title:'Impressum | Latido.ch',
    description:'Información legal y datos de contacto de Latido.ch.',
  },
  {
    path:'/privacidad',
    title:'Privacidad | Latido.ch',
    description:'Politica de privacidad y tratamiento de datos de Latido.ch.',
  },
  {
    path:'/terminos',
    title:'Términos y condiciones | Latido.ch',
    description:'Condiciones de uso de Latido.ch para usuarios, anuncios, comunidades y servicios.',
  },
  {
    path:'/descargo',
    title:'Descargo de responsabilidad | Latido.ch',
    description:'Avisos y límites de responsabilidad sobre la información publicada en Latido.ch.',
  },
]

const PRIVATE_PATHS = [
  '/auth',
  '/perfil',
  '/mensajes',
  '/admin-latido',
  '/publicar',
  '/publicar-empleo',
  '/publicar-evento',
  '/registrar-negocio',
  '/registrar-comunidad',
  '/reset-password',
]

const CATEGORY_SEO = {
  vivienda:{
    title:'Vivienda en Suiza para hispanohablantes | Latido.ch',
    description:'Busca pisos, habitaciones, compañeros de piso y alquileres temporales en Suiza dentro de la comunidad hispanohablante.',
  },
  empleo:{
    title:'Empleo en Suiza para hispanohablantes | Latido.ch',
    description:'Ofertas de trabajo y perfiles profesionales de la comunidad hispanohablante en Suiza.',
  },
  venta:{
    title:'Mercado latino en Suiza | Latido.ch',
    description:'Compra, vende o regala artículos entre hispanohablantes en Suiza.',
  },
  servicios:{
    title:'Servicios en Suiza en español | Latido.ch',
    description:'Encuentra limpieza, clases, reparaciones, mudanzas y ayuda local ofrecida por la comunidad hispanohablante.',
  },
  cuidados:{
    title:'Cuidados y apoyo familiar en Suiza | Latido.ch',
    description:'Cuidados de niños, mayores, au pair y asistencia dentro de la comunidad hispanohablante en Suiza.',
  },
  documentos:{
    title:'Trámites y documentos en Suiza en español | Latido.ch',
    description:'Ayuda con cartas, traducciones, asesoría y gestiones para hispanohablantes en Suiza.',
  },
}

const COMMUNITY_VIEW_SEO = {
  negocios:{
    title:'Negocios latinos en Suiza | Latido.ch',
    description:'Directorio de restaurantes, tiendas, belleza, salud, asesoria y servicios latinos en Suiza.',
  },
  eventos:{
    title:'Eventos latinos en Suiza | Latido.ch',
    description:'Conciertos, fiestas, quedadas, networking y planes familiares para hispanohablantes en Suiza.',
  },
}

function normalizePath(path = '/') {
  if (!path || path === '/') return '/'
  return path.replace(/\/+$/, '') || '/'
}

export function slugify(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function stripMarkdown(value = '') {
  return String(value || '')
    .replace(/\*\*/g, '')
    .replace(/[•·]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function truncate(value = '', max = 156) {
  const clean = stripMarkdown(value)
  if (clean.length <= max) return clean
  return `${clean.slice(0, max - 1).replace(/\s+\S*$/, '')}.`
}

function ensureUrl(value = '', fallback = SITE_URL) {
  const clean = String(value || '').trim()
  if (!clean) return fallback
  return /^https?:\/\//i.test(clean) ? clean : `https://${clean}`
}

export function getGuidePath(doc) {
  if (!doc?.id) return '/guias'
  const slug = slugify(doc.title || doc.id)
  return `/guias/${doc.id}${slug ? `-${slug}` : ''}`
}

export function getAdPath(ad) {
  if (!ad?.id) return '/tablon'
  const slug = slugify(ad.title || ad.id)
  return `/anuncios/${ad.id}${slug ? `--${slug}` : ''}`
}

export function getJobPath(job) {
  if (!job?.id) return '/tablon?cat=empleo'
  const slug = slugify(job.title || job.company || job.id)
  return `/empleos/${job.id}${slug ? `--${slug}` : ''}`
}

export function getBusinessPath(business) {
  if (!business?.id) return '/comunidades?view=negocios'
  const slug = slugify(business.name || business.id)
  return `/negocios/${business.id}${slug ? `--${slug}` : ''}`
}

export function getEventPath(event) {
  if (!event?.id) return '/comunidades?view=eventos'
  const slug = slugify(event.title || event.id)
  return `/eventos/${event.id}${slug ? `--${slug}` : ''}`
}

export function getIdFromSlug(slug = '') {
  const clean = String(slug || '').replace(/^\/+|\/+$/g, '')
  if (!clean) return ''
  const slugSeparator = clean.indexOf('--')
  if (slugSeparator >= 0) return clean.slice(0, slugSeparator)
  return clean.split('-')[0] || ''
}

export function getGuideBySlug(slug = '') {
  const clean = String(slug || '').replace(/^\/+|\/+$/g, '')
  if (!clean) return null

  const id = getIdFromSlug(clean)
  return MOCK_DOCS.find(doc => doc.id === id) ||
    MOCK_DOCS.find(doc => slugify(doc.title) === clean) ||
    null
}

export function getAdBySlug(slug = '') {
  const clean = String(slug || '').replace(/^\/+|\/+$/g, '')
  if (!clean) return null

  const id = getIdFromSlug(clean)
  return MOCK_ADS.find(ad => String(ad.id) === id) ||
    MOCK_ADS.find(ad => slugify(ad.title) === clean) ||
    null
}

export function getJobBySlug(slug = '') {
  const clean = String(slug || '').replace(/^\/+|\/+$/g, '')
  if (!clean) return null

  const id = getIdFromSlug(clean)
  return MOCK_JOBS.find(job => String(job.id) === id) ||
    MOCK_JOBS.find(job => slugify(job.title) === clean) ||
    null
}

export function getBusinessBySlug(slug = '') {
  const clean = String(slug || '').replace(/^\/+|\/+$/g, '')
  if (!clean) return null

  const id = getIdFromSlug(clean)
  return MOCK_NEGOCIOS.find(business => String(business.id) === id) ||
    MOCK_NEGOCIOS.find(business => slugify(business.name) === clean) ||
    null
}

export function getEventBySlug(slug = '') {
  const clean = String(slug || '').replace(/^\/+|\/+$/g, '')
  if (!clean) return null

  const id = getIdFromSlug(clean)
  return MOCK_EVENTOS_LATINOS.find(event => String(event.id) === id) ||
    MOCK_EVENTOS_LATINOS.find(event => slugify(event.title) === clean) ||
    null
}

export function getGuideById(id = '') {
  return MOCK_DOCS.find(doc => doc.id === id) || null
}

export function toAbsoluteUrl(pathOrUrl = '/') {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`
  return `${SITE_URL}${path}`
}

function withDefaults(seo) {
  const path = normalizePath(seo.path || DEFAULT_SEO.path)
  const image = seo.image || DEFAULT_SEO.image

  return {
    ...DEFAULT_SEO,
    ...seo,
    path,
    canonical:toAbsoluteUrl(path),
    image:toAbsoluteUrl(image),
  }
}

function getGuideSeo(doc) {
  const path = getGuidePath(doc)
  return withDefaults({
    path,
    title:`${doc.title} | Latido.ch`,
    description:truncate(doc.summary || doc.content),
    image:doc.img || DEFAULT_IMAGE,
    type:'article',
    guide:doc,
  })
}

function getAdSeo(ad) {
  const cat = getAdDisplayCat(ad)
  const location = formatAdLocation(ad)

  return withDefaults({
    path:getAdPath(ad),
    title:`${ad.title || 'Anuncio'} | Latido.ch`,
    description:truncate(ad.desc || ad.description || [cat?.label, location, ad.price].filter(Boolean).join(' · ')),
    image:ad.img_url || ad.img || DEFAULT_IMAGE,
    type:'article',
    ad,
  })
}

function getJobSeo(job) {
  const intent = getJobIntentMeta(job)
  const location = job.city || job.canton || 'Suiza'

  return withDefaults({
    path:getJobPath(job),
    title:`${job.title || 'Empleo en Suiza'} | Latido.ch`,
    description:truncate(job.desc || job.description || [intent.label, job.company, location, job.type, job.salary].filter(Boolean).join(' · ')),
    image:job.logo_url || job.img || DEFAULT_IMAGE,
    type:'article',
    job,
  })
}

function getBusinessSeo(business) {
  const type = getNegocioTypeMeta(business.type || business.category)?.label || 'Negocio'
  const city = business.city || business.canton || 'Suiza'

  return withDefaults({
    path:getBusinessPath(business),
    title:`${business.name || 'Negocio latino'} | Latido.ch`,
    description:truncate(business.desc || business.description || `${type} en ${city}.`),
    image:business.photo_url || business.img || DEFAULT_IMAGE,
    type:'business.business',
    business,
  })
}

function getEventSeo(event) {
  const eventType = EVENTO_TYPES.find(item => item.id === event.type)?.label || event.type || 'Evento'
  const city = event.city || event.canton || 'Suiza'

  return withDefaults({
    path:getEventPath(event),
    title:`${event.title || 'Evento latino'} | Latido.ch`,
    description:truncate(event.desc || event.description || [eventType, city, event.venue, event.price].filter(Boolean).join(' · ')),
    image:event.img || event.photo_url || DEFAULT_IMAGE,
    type:'event',
    event,
  })
}

function isPrivatePath(pathname) {
  return PRIVATE_PATHS.some(path => pathname === path || pathname.startsWith(`${path}/`))
}

export function getSeoForLocation(location = {}) {
  const pathname = normalizePath(location.pathname || '/')
  const params = new URLSearchParams(location.search || '')

  if (pathname.startsWith('/guias/')) {
    const guide = getGuideBySlug(pathname.replace('/guias/', ''))
    if (guide) return getGuideSeo(guide)
  }

  if (pathname.startsWith('/anuncios/')) {
    const ad = getAdBySlug(pathname.replace('/anuncios/', ''))
    if (ad) return getAdSeo(ad)
  }

  if (pathname.startsWith('/empleos/')) {
    const job = getJobBySlug(pathname.replace('/empleos/', ''))
    if (job) return getJobSeo(job)
  }

  if (pathname.startsWith('/negocios/')) {
    const business = getBusinessBySlug(pathname.replace('/negocios/', ''))
    if (business) return getBusinessSeo(business)
  }

  if (pathname.startsWith('/eventos/')) {
    const event = getEventBySlug(pathname.replace('/eventos/', ''))
    if (event) return getEventSeo(event)
  }

  const openGuide = params.get('openGuide')
  if (pathname === '/guias' && openGuide) {
    const guide = getGuideById(openGuide)
    if (guide) return getGuideSeo(guide)
  }

  if (pathname === '/tablon') {
    const cat = params.get('cat')
    if (CATEGORY_SEO[cat]) {
      return withDefaults({ path:`/tablon?cat=${cat}`, ...CATEGORY_SEO[cat] })
    }
  }

  if (pathname === '/comunidades') {
    const view = params.get('view')
    if (COMMUNITY_VIEW_SEO[view]) {
      return withDefaults({ path:`/comunidades?view=${view}`, ...COMMUNITY_VIEW_SEO[view] })
    }
  }

  if (isPrivatePath(pathname)) {
    return withDefaults({
      path:pathname,
      title:'Area privada | Latido.ch',
      description:'Area privada de Latido.ch.',
      robots:'noindex, nofollow',
    })
  }

  const route = ROUTE_SEO.find(item => item.path === pathname)
  if (route) return withDefaults(route)

  return withDefaults({
    path:pathname,
    title:'Página no encontrada | Latido.ch',
    description:'La pagina que buscas no esta disponible en Latido.ch.',
    robots:'noindex, follow',
  })
}

export function getStructuredData(seo = DEFAULT_SEO) {
  const website = {
    '@context':'https://schema.org',
    '@type':'WebSite',
    name:SITE_NAME,
    url:SITE_URL,
    inLanguage:'es',
    description:DEFAULT_DESCRIPTION,
    publisher:{
      '@type':'Organization',
      name:SITE_NAME,
      url:SITE_URL,
      logo:toAbsoluteUrl('/icon-512.png'),
    },
  }

  const breadcrumb = (sectionName, sectionPath, itemName) => ({
    '@context':'https://schema.org',
    '@type':'BreadcrumbList',
    itemListElement:[
      {
        '@type':'ListItem',
        position:1,
        name:'Inicio',
        item:SITE_URL,
      },
      {
        '@type':'ListItem',
        position:2,
        name:sectionName,
        item:toAbsoluteUrl(sectionPath),
      },
      {
        '@type':'ListItem',
        position:3,
        name:itemName,
        item:seo.canonical,
      },
    ],
  })

  if (seo.ad) {
    const category = getAdDisplayCat(seo.ad)?.label || 'Anuncio'
    return [
      website,
      {
        '@context':'https://schema.org',
        '@type':'Offer',
        name:seo.ad.title,
        description:seo.description,
        url:seo.canonical,
        image:seo.image,
        category,
        areaServed:formatAdLocation(seo.ad),
        availability:'https://schema.org/InStock',
      },
      breadcrumb('Tablón', '/tablon', seo.ad.title),
    ]
  }

  if (seo.job) {
    return [
      website,
      {
        '@context':'https://schema.org',
        '@type':'JobPosting',
        title:seo.job.title,
        description:seo.description,
        employmentType:seo.job.type,
        hiringOrganization:{
          '@type':'Organization',
          name:seo.job.company || SITE_NAME,
        },
        jobLocation:{
          '@type':'Place',
          address:{
            '@type':'PostalAddress',
            addressLocality:seo.job.city || seo.job.canton || 'Suiza',
            addressCountry:'CH',
          },
        },
        url:seo.canonical,
      },
      breadcrumb('Empleos', '/tablon?cat=empleo', seo.job.title),
    ]
  }

  if (seo.business) {
    return [
      website,
      {
        '@context':'https://schema.org',
        '@type':'LocalBusiness',
        name:seo.business.name,
        description:seo.description,
        image:seo.image,
        url:ensureUrl(seo.business.website, seo.canonical),
        address:{
          '@type':'PostalAddress',
          addressLocality:seo.business.city || seo.business.canton || 'Suiza',
          addressCountry:'CH',
        },
      },
      breadcrumb('Negocios', '/comunidades?view=negocios', seo.business.name),
    ]
  }

  if (seo.event) {
    return [
      website,
      {
        '@context':'https://schema.org',
        '@type':'Event',
        name:seo.event.title,
        description:seo.description,
        image:seo.image,
        eventAttendanceMode:'https://schema.org/OfflineEventAttendanceMode',
        eventStatus:'https://schema.org/EventScheduled',
        location:{
          '@type':'Place',
          name:seo.event.venue || seo.event.city || 'Suiza',
          address:{
            '@type':'PostalAddress',
            addressLocality:seo.event.city || seo.event.canton || 'Suiza',
            addressCountry:'CH',
          },
        },
        organizer:{
          '@type':'Organization',
          name:seo.event.host || SITE_NAME,
        },
        url:seo.canonical,
      },
      breadcrumb('Eventos', '/comunidades?view=eventos', seo.event.title),
    ]
  }

  if (!seo.guide) return website

  return [
    website,
    {
      '@context':'https://schema.org',
      '@type':'Article',
      headline:seo.guide.title,
      description:seo.description,
      image:seo.image,
      inLanguage:'es',
      mainEntityOfPage:seo.canonical,
      author:{
        '@type':'Organization',
        name:SITE_NAME,
      },
      publisher:{
        '@type':'Organization',
        name:SITE_NAME,
        logo:{
          '@type':'ImageObject',
          url:toAbsoluteUrl('/icon-512.png'),
        },
      },
    },
    breadcrumb('Guías', '/guias', seo.guide.title),
  ]
}

export function getPublicSeoPages() {
  const routePages = [
    '/',
    '/tablon',
    '/tablon?cat=vivienda',
    '/tablon?cat=empleo',
    '/tablon?cat=venta',
    '/tablon?cat=servicios',
    '/tablon?cat=cuidados',
    '/tablon?cat=documentos',
    '/comunidades',
    '/comunidades?view=negocios',
    '/comunidades?view=eventos',
    '/guias',
    '/impressum',
    '/privacidad',
    '/terminos',
    '/descargo',
  ].map(path => getSeoForLocation(new URL(path, SITE_URL)))

  const guidePages = MOCK_DOCS.map(getGuideSeo)
  const adPages = MOCK_ADS.filter(ad => ad.privacy === 'public').map(getAdSeo)
  const jobPages = MOCK_JOBS.map(getJobSeo)
  const businessPages = MOCK_NEGOCIOS.map(getBusinessSeo)
  const eventPages = MOCK_EVENTOS_LATINOS.map(getEventSeo)

  return [...routePages, ...guidePages, ...adPages, ...jobPages, ...businessPages, ...eventPages]
}
