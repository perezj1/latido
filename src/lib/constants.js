import { GUIDES } from './guides.js'

// ── CANTONS ────────────────────────────────────────────────────
export const CANTONS = [
  { code:'AG', name:'Aargau' },       { code:'AI', name:'Appenzell I.' },
  { code:'AR', name:'Appenzell A.' }, { code:'BE', name:'Bern' },
  { code:'BL', name:'Basel-Land' },   { code:'BS', name:'Basel-Stadt' },
  { code:'FR', name:'Fribourg' },     { code:'GE', name:'Genève' },
  { code:'GL', name:'Glarus' },       { code:'GR', name:'Graubünden' },
  { code:'JU', name:'Jura' },         { code:'LU', name:'Luzern' },
  { code:'NE', name:'Neuchâtel' },    { code:'NW', name:'Nidwalden' },
  { code:'OW', name:'Obwalden' },     { code:'SG', name:'St. Gallen' },
  { code:'SH', name:'Schaffhausen' }, { code:'SO', name:'Solothurn' },
  { code:'SZ', name:'Schwyz' },       { code:'TG', name:'Thurgau' },
  { code:'TI', name:'Ticino' },       { code:'UR', name:'Uri' },
  { code:'VD', name:'Vaud' },         { code:'VS', name:'Valais' },
  { code:'ZG', name:'Zug' },          { code:'ZH', name:'Zürich' },
]

export const CITIES_BY_CANTON = {
  AG: ['Aarau', 'Baden', 'Wettingen', 'Wohlen', 'Zofingen', 'Brugg', 'Rheinfelden', 'Lenzburg'],
  AI: ['Appenzell', 'Gonten', 'Oberegg', 'Schwende-Rüte'],
  AR: ['Herisau', 'Teufen', 'Heiden', 'Speicher', 'Trogen', 'Walzenhausen'],
  BE: ['Bern', 'Biel/Bienne', 'Thun', 'Köniz', 'Burgdorf', 'Langenthal', 'Interlaken', 'Münsingen'],
  BL: ['Liestal', 'Allschwil', 'Muttenz', 'Pratteln', 'Binningen', 'Reinach', 'Münchenstein'],
  BS: ['Basel', 'Riehen', 'Bettingen'],
  FR: ['Fribourg', 'Bulle', 'Villars-sur-Glâne', 'Marly', 'Düdingen', 'Murten', 'Estavayer'],
  GE: ['Genève', 'Vernier', 'Lancy', 'Meyrin', 'Carouge', 'Onex', 'Thônex', 'Versoix'],
  GL: ['Glarus', 'Näfels', 'Netstal', 'Mollis', 'Ennenda'],
  GR: ['Chur', 'Davos', 'St. Moritz', 'Arosa', 'Landquart', 'Ilanz', 'Thusis', 'Samedan'],
  JU: ['Delémont', 'Porrentruy', 'Saignelégier', 'Courroux', 'Bassecourt'],
  LU: ['Luzern', 'Emmen', 'Kriens', 'Horw', 'Sursee', 'Ebikon', 'Willisau'],
  NE: ['Neuchâtel', 'La Chaux-de-Fonds', 'Le Locle', 'Val-de-Travers', 'Peseux', 'Boudry'],
  NW: ['Stans', 'Hergiswil', 'Buochs', 'Ennetbürgen', 'Oberdorf'],
  OW: ['Sarnen', 'Kerns', 'Alpnach', 'Sachseln', 'Engelberg'],
  SG: ['St. Gallen', 'Rapperswil-Jona', 'Wil', 'Gossau', 'Uzwil', 'Buchs', 'Wattwil'],
  SH: ['Schaffhausen', 'Neuhausen am Rheinfall', 'Thayngen', 'Beringen', 'Stein am Rhein'],
  SO: ['Solothurn', 'Olten', 'Grenchen', 'Zuchwil', 'Biberist', 'Dornach', 'Balsthal'],
  SZ: ['Schwyz', 'Freienbach', 'Küssnacht', 'Einsiedeln', 'Wollerau', 'Lachen', 'Arth'],
  TG: ['Frauenfeld', 'Kreuzlingen', 'Arbon', 'Weinfelden', 'Amriswil', 'Romanshorn'],
  TI: ['Lugano', 'Bellinzona', 'Locarno', 'Mendrisio', 'Chiasso', 'Minusio', 'Biasca'],
  UR: ['Altdorf', 'Schattdorf', 'Erstfeld', 'Bürglen', 'Andermatt'],
  VD: ['Lausanne', 'Yverdon-les-Bains', 'Montreux', 'Nyon', 'Renens', 'Vevey', 'Morges', 'Payerne'],
  VS: ['Sion', 'Martigny', 'Monthey', 'Sierre', 'Brig-Glis', 'Visp', 'Crans-Montana'],
  ZG: ['Zug', 'Baar', 'Cham', 'Risch-Rotkreuz', 'Steinhausen', 'Unterägeri', 'Menzingen'],
  ZH: ['Zürich', 'Winterthur', 'Uster', 'Dübendorf', 'Dietikon', 'Wetzikon', 'Horgen', 'Kloten', 'Bülach', 'Opfikon'],
}

export const POPULAR_SWISS_CITIES = [
  'Zürich', 'Genève', 'Basel', 'Bern', 'Lausanne', 'Winterthur', 'Luzern',
  'St. Gallen', 'Lugano', 'Biel/Bienne', 'Thun', 'Köniz', 'La Chaux-de-Fonds',
  'Fribourg', 'Schaffhausen', 'Chur', 'Neuchâtel', 'Vernier', 'Sion', 'Zug',
]

const CITY_RECORDS = Object.entries(CITIES_BY_CANTON).flatMap(([canton, cities]) =>
  cities.map(city => ({ city, canton }))
)

const normalizeCitySearch = value =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

export function getCitySuggestionItems(canton='', query='', limit=8) {
  const normalizedQuery = normalizeCitySearch(query)
  const source = canton
    ? CITY_RECORDS.filter(item => item.canton === canton)
    : CITY_RECORDS

  const filtered = normalizedQuery
    ? source
        .filter(item => normalizeCitySearch(item.city).includes(normalizedQuery))
        .sort((a, b) => {
          const aStarts = normalizeCitySearch(a.city).startsWith(normalizedQuery) ? 0 : 1
          const bStarts = normalizeCitySearch(b.city).startsWith(normalizedQuery) ? 0 : 1
          return aStarts - bStarts || a.city.localeCompare(b.city)
        })
    : POPULAR_SWISS_CITIES
        .map(city => CITY_RECORDS.find(item => item.city === city))
        .filter(Boolean)

  return filtered.slice(0, limit)
}

export function getCitySuggestions(canton='', query='', limit=8) {
  return getCitySuggestionItems(canton, query, limit).map(item => item.city)
}

export function getCantonForCity(city='') {
  const normalizedCity = normalizeCitySearch(city)
  return CITY_RECORDS.find(item => normalizeCitySearch(item.city) === normalizedCity)?.canton || ''
}

// ── AD CATEGORIES ──────────────────────────────────────────────
const CITY_BY_PLZ = {
  '1000':'Lausanne',
  '1201':'Gen\u00e8ve',
  '1204':'Gen\u00e8ve',
  '1227':'Carouge',
  '1200':'Gen\u00e8ve',
  '3001':'Bern',
  '3000':'Bern',
  '3011':'Bern',
  '3012':'Bern',
  '4001':'Basel',
  '4051':'Basel',
  '5001':'Aarau',
  '6004':'Luzern',
  '6300':'Zug',
  '8001':'Z\u00fcrich',
  '8002':'Z\u00fcrich',
  '8003':'Z\u00fcrich',
  '8004':'Z\u00fcrich',
  '8005':'Z\u00fcrich',
  '8006':'Z\u00fcrich',
  '8050':'Z\u00fcrich',
}

function cleanLocationPart(value='') {
  return String(value || '').trim()
}

export function formatAdLocation(ad={}) {
  const rawCanton = cleanLocationPart(ad.canton)
  const canton = rawCanton.length <= 2 ? rawCanton.toUpperCase() : rawCanton
  const rawCity = cleanLocationPart(ad.city)
  const cityFromPlz = CITY_BY_PLZ[cleanLocationPart(ad.plz).slice(0, 4)] || ''
  const city = rawCity && rawCity.toUpperCase() !== canton ? rawCity : cityFromPlz

  if (city && canton) return `${city} ${canton}`
  return city || canton || cleanLocationPart(ad.plz) || 'Toda Suiza'
}

export const SERVICE_SUBCATS = [
  { label:'Limpieza', emoji:'🧹' },
  { label:'Cocina', emoji:'🍳' },
  { label:'Reparaciones', emoji:'🔧' },
  { label:'Mudanza', emoji:'🚚' },
  { label:'Transporte', emoji:'🚕', aliases:['Taxi', 'Chofer', 'Conductor'] },
  { label:'Clases', emoji:'🎓' },
  { label:'Peluquería', emoji:'💇' },
  { label:'Estética', emoji:'💅' },
  { label:'Vehículos', emoji:'🚗', aliases:['Mecánico', 'Mecánica'] },
  { label:'Informática', emoji:'💻' },
  { label:'Otro', emoji:'✨' },
]

export const CARE_SUBCATS = [
  { label:'Cuidado de niños', emoji:'🧸', aliases:['Cuidado niños'] },
  { label:'Cuidado de mayores', emoji:'👵', aliases:['Cuidado mayores'] },
  { label:'Au pair', emoji:'👶' },
  { label:'Otro', emoji:'✨', aliases:['Asistencia'] },
]

export const AD_CATS = [
  {
    id:'vivienda',
    emoji:'🏠',
    label:'Vivienda',
    desc:'Pisos, habitaciones, sublets y compañeros',
    types:['busca','ofrece'],
    sub:[
      { label:'Piso o casa', aliases:['Se busca piso','Se ofrece piso','Piso','Casa'] },
      { label:'Habitación', aliases:['Se busca habitación','Se ofrece habitación'] },
      { label:'Compartir piso', aliases:['Compañero/a piso','Compañero de piso','Compañera de piso'] },
      { label:'Alquiler temporal', aliases:['Sublet temporal','Sublet'] },
    ],
  },
  { id:'servicios',  emoji:'🔧', label:'Servicios',   desc:'Ayuda práctica: limpieza, clases, mudanzas y reparaciones', types:['busca','ofrece'], sub:SERVICE_SUBCATS },
  { id:'cuidados',   emoji:'❤️', label:'Cuidados',    desc:'Niños, mayores, au pair y asistencia personal', types:['busca','ofrece'], sub:CARE_SUBCATS },
  { id:'venta',      emoji:'🛍️', label:'Compraventa', desc:'Artículos para comprar, vender o regalar', types:['busca','vende','regala'], sub:['Electrónica','Ropa','Muebles','Vehículos','Comida','Otro'] },
  { id:'documentos', emoji:'📄', label:'Trámites',    desc:'Cartas, traducciones, permisos y asesoría', types:['busca','ofrece'],      sub:['Cartas','Trámites','Traducción','Asesoría'] },
  { id:'empleo',     emoji:'💼', label:'Empleo',      desc:'Ofertas y solicitudes de empleo', types:['busca','ofrece'], sub:['Full-time','Part-time','Freelance','Prácticas'] },
]

export const CATEGORY_INTENT_VIEWS = {
  vivienda: [
    { id:'ofrece', emoji:'🏠', label:'Ofertas de vivienda', shortLabel:'Ofertas', itemLabel:'Oferta de vivienda', publishLabel:'Ofrecer vivienda', emptyTitle:'Todavía no hay ofertas de vivienda', emptyText:'Prueba otra zona o publica una oferta de vivienda.' },
    { id:'busca', emoji:'🔎', label:'Solicitudes de vivienda', shortLabel:'Solicitudes', itemLabel:'Solicitud de vivienda', publishLabel:'Solicitar vivienda', emptyTitle:'Todavía no hay solicitudes de vivienda', emptyText:'Sé la primera persona en crear una solicitud de vivienda.' },
  ],
  empleo: [
    { id:'ofrece', emoji:'💼', label:'Ofertas de empleo', shortLabel:'Ofertas', itemLabel:'Oferta de empleo', publishLabel:'Publicar oferta de empleo', emptyTitle:'Todavía no hay ofertas de empleo', emptyText:'Prueba otro cantón o publica una oferta de empleo.' },
    { id:'busca', emoji:'👤', label:'Solicitudes de empleo', shortLabel:'Solicitudes', itemLabel:'Solicitud de empleo', publishLabel:'Crear solicitud de empleo', emptyTitle:'Todavía no hay solicitudes de empleo', emptyText:'Crea una solicitud de empleo para que empresas y empleadores puedan encontrarte.' },
  ],
  servicios: [
    { id:'ofrece', emoji:'🧰', label:'Ofertas de servicios', shortLabel:'Ofertas', itemLabel:'Oferta de servicios', publishLabel:'Ofrecer servicios', emptyTitle:'Todavía no hay ofertas de servicios', emptyText:'Prueba otra zona o publica una oferta de servicios.' },
    { id:'busca', emoji:'🔎', label:'Solicitudes de servicios', shortLabel:'Solicitudes', itemLabel:'Solicitud de servicios', publishLabel:'Solicitar servicios', emptyTitle:'Todavía no hay solicitudes de servicios', emptyText:'Publica una solicitud con el servicio que necesitas.' },
  ],
  cuidados: [
    { id:'ofrece', emoji:'❤️', label:'Ofertas de cuidados', shortLabel:'Ofertas', itemLabel:'Oferta de cuidados', publishLabel:'Ofrecer cuidados', emptyTitle:'Todavía no hay ofertas de cuidados', emptyText:'Prueba otra zona o publica una oferta de cuidados.' },
    { id:'busca', emoji:'🔎', label:'Solicitudes de cuidados', shortLabel:'Solicitudes', itemLabel:'Solicitud de cuidados', publishLabel:'Solicitar cuidados', emptyTitle:'Todavía no hay solicitudes de cuidados', emptyText:'Publica una solicitud con el tipo de cuidados que necesitas.' },
  ],
  venta: [
    { id:'vende', emoji:'🏷️', label:'Artículos en venta', shortLabel:'En venta', itemLabel:'Venta', publishLabel:'Vender artículo', emptyTitle:'Todavía no hay artículos en venta', emptyText:'Prueba otra categoría o publica un artículo.' },
    { id:'busca', emoji:'🔎', label:'Artículos que busca la comunidad', shortLabel:'Se busca', itemLabel:'Solicitud de compra', publishLabel:'Buscar artículo', emptyTitle:'Todavía no hay solicitudes de compra', emptyText:'Publica el artículo que estás buscando.' },
    { id:'regala', emoji:'🎁', label:'Artículos gratis', shortLabel:'Gratis', itemLabel:'Regalo', publishLabel:'Regalar artículo', emptyTitle:'Todavía no hay artículos gratis', emptyText:'Publica algo que quieras regalar a la comunidad.' },
  ],
  documentos: [
    { id:'ofrece', emoji:'📄', label:'Ofertas de ayuda', shortLabel:'Ofertas', itemLabel:'Oferta de ayuda', publishLabel:'Ofrecer ayuda', emptyTitle:'Todavía no hay ofertas de ayuda', emptyText:'Publica una oferta de ayuda con trámites, cartas o traducciones.' },
    { id:'busca', emoji:'🔎', label:'Solicitudes de ayuda', shortLabel:'Solicitudes', itemLabel:'Solicitud de ayuda', publishLabel:'Solicitar ayuda', emptyTitle:'Todavía no hay solicitudes de ayuda', emptyText:'Publica el trámite, carta o traducción con el que necesitas ayuda.' },
  ],
}

export function getCategoryIntentViews(cat='') {
  return CATEGORY_INTENT_VIEWS[normalizeAdCat(cat)] || []
}

export function getDefaultCategoryIntent(cat='') {
  return getCategoryIntentViews(cat)[0]?.id || ''
}

export function getCategoryIntentMeta(cat='', intent='') {
  const views = getCategoryIntentViews(cat)
  return views.find(item => item.id === intent) || views[0] || null
}

export function getPublishPathForIntent(cat='', intent='') {
  const normalizedCat = normalizeAdCat(cat)
  const resolvedIntent = intent || getDefaultCategoryIntent(normalizedCat)
  if (normalizedCat === 'empleo') {
    return `/publicar-empleo?intent=${encodeURIComponent(resolvedIntent)}`
  }

  const params = new URLSearchParams()
  if (normalizedCat) params.set('cat', normalizedCat)
  if (resolvedIntent) params.set('intent', resolvedIntent)
  const query = params.toString()
  return `/publicar${query ? `?${query}` : ''}`
}

export function normalizeAdCat(cat='') {
  return cat === 'hogar' ? 'servicios' : cat
}

export function getAdCat(cat='') {
  return AD_CATS.find(item => item.id === normalizeAdCat(cat))
}

export function getAdSubLabel(sub) {
  return typeof sub === 'string' ? sub : sub?.label || ''
}

export function getAdCategoriesForType(type='') {
  if (!type) return AD_CATS.filter(item => item.id !== 'empleo')
  return AD_CATS.filter(item => item.id !== 'empleo' && item.types?.includes(type))
}

export function getAdSubOptions(cat='', type='') {
  const options = getAdCat(cat)?.sub || []
  if (!type) return options
  return options.filter(item => !Array.isArray(item?.types) || item.types.includes(type))
}

function normalizeSubLabel(value='') {
  return String(value)
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function getAdSubOption(cat='', sub='', type='') {
  const normalizedSub = normalizeSubLabel(sub)
  if (!normalizedSub) return null

  return getAdSubOptions(cat, type).find(item => {
    const labels = [getAdSubLabel(item), ...(item?.aliases || [])]
    return labels.some(label => normalizeSubLabel(label) === normalizedSub)
  }) || null
}

export function getAdCategoryId(ad={}) {
  return normalizeAdCat(ad.cat || '')
}

export function getAdDisplayCat(ad={}) {
  return getAdCat(getAdCategoryId(ad))
}

export function getAdDisplayEmoji(ad={}) {
  const categoryId = getAdCategoryId(ad)
  const subEmoji = getAdSubOption(categoryId, ad.sub)?.emoji
  const categoryEmoji = getAdCat(categoryId)?.emoji

  return subEmoji || ad.emoji || categoryEmoji || '📣'
}

export const AD_TYPES = [
  { id:'busca',  emoji:'🔍', label:'Busco o necesito',   desc:'Estás buscando algo o a alguien' },
  { id:'ofrece', emoji:'✨', label:'Ofrezco',            desc:'Ofreces un servicio o ayuda' },
  { id:'vende',  emoji:'🏷️', label:'Vendo',              desc:'Quieres vender algo' },
  { id:'regala', emoji:'🎁', label:'Regalo',             desc:'Das algo gratis' },
]

export const JOB_INTENTS = [
  { id:'ofrece', emoji:'💼', label:'Oferta de empleo', shortLabel:'Oferta', desc:'Publicas una vacante, puesto o encargo de trabajo' },
  { id:'busca',  emoji:'👤', label:'Solicitud de empleo', shortLabel:'Solicitud', desc:'Publicas tu experiencia y disponibilidad para trabajar' },
]

export const JOB_SECTORS = [
  { id:'hosteleria',     emoji:'👨‍🍳', label:'Hostelería & Cocina',   sub:'Camarero/a, cocinero/a, barista, ayudante de cocina…' },
  { id:'cuidados',       emoji:'❤️',   label:'Cuidados & Au pair',     sub:'Niñero/a, au pair, cuidador/a de personas mayores…' },
  { id:'limpieza',       emoji:'🧹',   label:'Limpieza & Servicios',   sub:'Limpieza doméstica, oficinas, hoteles, conserje…' },
  { id:'tecnologia',     emoji:'💻',   label:'Tecnología & IT',        sub:'Desarrollo, soporte técnico, sistemas, diseño digital…' },
  { id:'estetica',       emoji:'💇',   label:'Estética & Belleza',     sub:'Peluquería, barbería, uñas, maquillaje, estética…' },
  { id:'construccion',   emoji:'🏗️',  label:'Construcción',           sub:'Albañil, electricista, fontanero, pintor, carpintero…' },
  { id:'transporte',     emoji:'🚚',   label:'Transporte & Logística', sub:'Conductor/a, repartidor/a, almacén, mensajería…' },
  { id:'administracion', emoji:'📋',   label:'Administración',         sub:'Recepcionista, asistente, contabilidad, oficina…' },
  { id:'educacion',      emoji:'🎓',   label:'Educación & Clases',     sub:'Profesor/a, tutor/a, clases particulares, monitor/a…' },
  { id:'servicios',      emoji:'🔧',   label:'Servicios & Técnico',    sub:'Reparaciones, mantenimiento, instalaciones, jardinería…' },
  { id:'salud',          emoji:'🏥',   label:'Salud & Enfermería',     sub:'Enfermero/a, auxiliar, farmacia, fisioterapia…' },
  { id:'ventas',         emoji:'🛒',   label:'Comercio & Ventas',      sub:'Dependiente/a, cajero/a, atención al cliente, tienda…' },
]

export const JOB_TYPES = [
  { id:'Full-time', emoji:'🕐', label:'Full-time', desc:'Jornada completa', seekingDesc:'Disponibilidad para jornada completa' },
  { id:'Part-time', emoji:'🕔', label:'Part-time', desc:'Media jornada', seekingDesc:'Disponibilidad para media jornada' },
  { id:'Freelance', emoji:'💡', label:'Freelance', desc:'Por proyecto o autónomo', seekingDesc:'Disponibilidad por proyecto o como autónomo' },
  { id:'Prácticas', emoji:'🎓', label:'Prácticas', desc:'Internship o aprendizaje', seekingDesc:'Buscas prácticas o aprendizaje' },
]

function normalizeJobIntentText(value='') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function inferJobSeekingIntent(job={}) {
  const title = normalizeJobIntentText(job.title)
  const description = normalizeJobIntentText(job.desc || job.description)
  const text = `${title} ${description}`.trim()

  if (!text) return ''

  const clearSeekingPatterns = [
    /^(?:busco|buscando|necesito|solicito)\s+(?:un\s+)?(?:trabajo|empleo)\b/,
    /^(?:puedo|quiero|deseo)\s+trabajar\b/,
    /\bestoy\s+buscando\s+(?:un\s+)?(?:trabajo|empleo)\b/,
    /\bdisponible\s+para\s+trabajar\b/,
    /\b(?:tengo|cuento con)\s+experiencia\b.*\b(?:empezar|comenzar)\s+a\s+trabajar\b/,
  ]

  return clearSeekingPatterns.some(pattern => pattern.test(text)) ? 'busca' : ''
}

export function getJobIntentId(job={}) {
  const raw = job.job_intent || job.intent || (job.cat === 'empleo' ? job.type : '')
  if (raw === 'busca') return raw

  // Algunas publicaciones anteriores al selector de intención recibieron
  // "ofrece" por defecto. Solo corregimos frases inequívocas de búsqueda.
  const inferredIntent = inferJobSeekingIntent(job)
  if (inferredIntent) return inferredIntent

  return JOB_INTENTS.some(item => item.id === raw) ? raw : 'ofrece'
}

export function getJobIntentMeta(job={}) {
  return JOB_INTENTS.find(item => item.id === getJobIntentId(job)) || JOB_INTENTS[0]
}

export const JOB_SECTOR_EMOJI = {
  hosteleria:'\u{1F468}\u200D\u{1F373}',
  cuidados:'\u2764\uFE0F',
  limpieza:'\u{1F9F9}',
  tecnologia:'\u{1F4BB}',
  estetica:'\u{1F487}',
  construccion:'\u{1F3D7}\uFE0F',
  transporte:'\u{1F69A}',
  administracion:'\u{1F4CB}',
  educacion:'\u{1F393}',
  servicios:'\u{1F527}',
  salud:'\u{1F3E5}',
  ventas:'\u{1F6D2}',
}

const JOB_SECTOR_ALIASES = {
  cocina:'hosteleria',
  restaurantes:'hosteleria',
  restaurante:'hosteleria',
  belleza:'estetica',
  it:'tecnologia',
  tech:'tecnologia',
  logistica:'transporte',
  comercio:'ventas',
}

function normalizeJobSector(value='') {
  return String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split('&')[0]
    .trim()
}

export function getJobCategoryEmoji(job={}) {
  const sector = normalizeJobSector(job.sector || job.category || job.sub)
  return JOB_SECTOR_EMOJI[JOB_SECTOR_ALIASES[sector] || sector] || job.emoji || '\u{1F4BC}'
}

// ── COMMUNITY CATEGORIES ───────────────────────────────────────
export const COMMUNITY_CATS = [
  { id:'pais',         emoji:'🌎', label:'País de origen', desc:'Grupos de personas del mismo país o región' },
  { id:'mamas',        emoji:'👩‍👧', label:'Mamás latinas', desc:'Familias, crianza, apoyo y planes con niños' },
  { id:'deporte',      emoji:'⚽', label:'Deportes', desc:'Equipos, partidos, entrenos y actividades físicas' },
  { id:'profesional',  emoji:'💼', label:'Profesionales', desc:'Networking, empleo, emprendimiento y contactos' },
  { id:'idioma',       emoji:'🗣️', label:'Idiomas', desc:'Intercambio, práctica y aprendizaje de idiomas' },
  { id:'fe',           emoji:'🙏', label:'Fe & Espiritualidad', desc:'Grupos religiosos, espirituales o de reflexión' },
  { id:'gastronomia',  emoji:'🍳', label:'Gastronomía', desc:'Comida, recetas, restaurantes y productos latinos' },
  { id:'voluntariado', emoji:'❤️', label:'Voluntariado', desc:'Ayuda comunitaria, iniciativas sociales y apoyo' },
]

// ── EVENT CATEGORIES ───────────────────────────────────────────
export const EVENT_CATS = [
  { id:'dj',         emoji:'🎵', label:'DJ & Música' },
  { id:'fotografia', emoji:'📸', label:'Fotografía & Video' },
  { id:'catering',   emoji:'🍽️', label:'Catering & Comida' },
  { id:'reposteria', emoji:'🎂', label:'Repostería' },
  { id:'decoracion', emoji:'🎪', label:'Decoración' },
  { id:'animacion',  emoji:'💃', label:'Animación & Shows' },
  { id:'musica',     emoji:'🎸', label:'Música en Vivo' },
  { id:'transporte', emoji:'🚐', label:'Transporte' },
]

export const PRICE_RANGES = [
  { id:'bajo',  label:'Económico',  desc:'Hasta CHF 500',  color:'bg-green-100 text-green-700' },
  { id:'medio', label:'Moderado',   desc:'CHF 500–1500',   color:'bg-yellow-100 text-yellow-700' },
  { id:'alto',  label:'Premium',    desc:'CHF 1500+',      color:'bg-purple-100 text-purple-700' },
]

export const EVENT_TYPES = [
  'Quinceañera','Boda','Bautizo','Cumpleaños','Fiesta de empresa',
  'Graduación','Reunión cultural','Otro',
]

// ── MOCK DATA ──────────────────────────────────────────────────
export const MOCK_ADS = [
  { id:'a1', cat:'vivienda',   sub:'Se busca piso',         title:'Busco habitación en Zürich',              desc:'Mujer 32 años, trabajo estable, no fumo. Zona Zürich o alrededores. Máximo CHF 950.',              user:'María C.',   canton:'ZH', plz:'8001', price:'hasta CHF 950/mes', type:'busca',  privacy:'private', verified:true,  ts:'Hace 2h',   img:null },
  { id:'a2', cat:'cuidados',   sub:'Cuidado niños',         title:'Ofrezco cuidado de niños tardes',          desc:'Maestra con 8 años de exp. Lunes a viernes 15:00–19:00. Referencias disponibles.',               user:'Ana R.',     canton:'BE', plz:'3001', price:'CHF 22/h',         type:'ofrece', privacy:'public',  verified:true,  ts:'Hace 4h',   img:null,  contact_phone:'+41 79 234 56 78' },
  { id:'a3', cat:'venta',      sub:'Electrónica',           title:'iPhone 13 128GB — perfecto estado',        desc:'Caja original, cargador incluido. Sin golpes ni rayones. Precio negociable.',                    user:'Carlos M.',  canton:'GE', plz:'1201', price:'CHF 450',           type:'vende',  privacy:'public',  verified:false, ts:'Hace 5h',   img:'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=400&h=260&fit=crop', contact_phone:'+41 78 345 67 89' },
  { id:'a4', cat:'servicios',  sub:'Limpieza',              title:'Limpieza profesional de pisos',             desc:'Servicio de limpieza profunda o mantenimiento semanal. Productos incluidos.',                    user:'Rosa P.',    canton:'BS', plz:'4001', price:'CHF 30/h',         type:'ofrece', privacy:'private', verified:true,  ts:'Hace 6h',   img:null },
  { id:'a5', cat:'documentos', sub:'Cartas',                title:'Ayudo con cartas en alemán suizo',          desc:'Traduzco y explico cartas oficiales suizas. 6 años viviendo aquí. Respondo en 24h.',             user:'Diego F.',   canton:'ZH', plz:'8050', price:'CHF 15/carta',     type:'ofrece', privacy:'public',  verified:false, ts:'Ayer',      img:null,  contact_email:'tramites.diego@gmail.com' },
  { id:'a6', cat:'regalo',     sub:'Muebles',               title:'Regalo sofá 3 plazas — Bern',               desc:'Sofá gris en buen estado. Solo para recoger esta semana. Primera persona que responda.',          user:'Lucia T.',   canton:'BE', plz:'3011', price:'Gratis',           type:'regala', privacy:'public',  verified:true,  ts:'Ayer',      img:'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=260&fit=crop', contact_phone:'+41 76 456 78 90' },
  { id:'a7', cat:'servicios',  sub:'Clases',                title:'Clases de español para suizos',             desc:'Profesora nativa. Principiantes y avanzados. Online o presencial en Lausana.',                  user:'Valentina B.',canton:'VD',plz:'1000', price:'CHF 40/h',         type:'ofrece', privacy:'private', verified:true,  ts:'Hace 2d',   img:null },
  { id:'a8', cat:'vivienda',   sub:'Se ofrece habitación',  title:'Habitación en piso compartido Ginebra',    desc:'2 latinos, ambiente tranquilo. Incluye wifi y acceso a cocina. Disponible 1 de mayo.',            user:'Pablo G.',   canton:'GE', plz:'1204', price:'CHF 800/mes',      type:'ofrece', privacy:'public',  verified:false, ts:'Hace 2d',   img:null },
  { id:'a9', cat:'cuidados',   sub:'Cuidado mayores',       title:'Busco cuidadora para mi madre (73)',        desc:'Mi madre necesita compañía y ayuda diaria. Español esencial. Zona Zug.',                         user:'Roberto L.', canton:'ZG', plz:'6300', price:'CHF 25/h',         type:'busca',  privacy:'private', verified:true,  ts:'Hace 3d',   img:null },
  { id:'a10',cat:'servicios',  sub:'Reparaciones',          title:'Hago reparaciones del hogar',               desc:'Plomería, electricidad básica, pintura. 10 años de experiencia en Suiza.',                      user:'Jorge S.',   canton:'AG', plz:'5001', price:'CHF 50/h',         type:'ofrece', privacy:'public',  verified:false, ts:'Hace 3d',   img:null },
]

export const MOCK_COMMUNITIES = [
  { id:'c1', name:'Colombianos en Zürich',      cat:'pais',       city:'Zürich',     members:342, emoji:'🇨🇴', verified:true,  desc:'La comunidad más grande de colombianos en Suiza.', contact:'https://chat.whatsapp.com/ejemplo' },
  { id:'c2', name:'Mamás Latinas Suiza',        cat:'mamas',      city:'Toda Suiza', members:891, emoji:'👩‍👧', verified:true,  desc:'Red de madres latinoamericanas. Crianza y apoyo mutuo.', contact:'https://t.me/mamaslatinasch' },
  { id:'c3', name:'Venezolanos en Suiza',       cat:'pais',       city:'Toda Suiza', members:523, emoji:'🇻🇪', verified:true,  desc:'Comunidad venezolana unida. Asesoría, trabajo y vivienda.', contact:'https://t.me/venezusuiza' },
  { id:'c4', name:'Fútbol Latino Ginebra',      cat:'deporte',    city:'Ginebra',    members:156, emoji:'⚽', verified:false, desc:'Liga amateur de fútbol para latinos. Partidos cada domingo.', contact:'https://chat.whatsapp.com/ejemplo' },
  { id:'c5', name:'Profesionales Latinos CH',   cat:'profesional',city:'Toda Suiza', members:267, emoji:'💼', verified:true,  desc:'Red de profesionales latinoamericanos. Networking y mentoring.', contact:'https://chat.whatsapp.com/ejemplo' },
  { id:'c6', name:'Aprende Alemán con Latinos', cat:'idioma',     city:'Zürich',     members:198, emoji:'🇩🇪', verified:false, desc:'Práctica de alemán para hispanohablantes. Clases peer-to-peer.', contact:'https://t.me/alemanlatinoch' },
  { id:'c7', name:'Fe Latina Suiza',            cat:'fe',         city:'Toda Suiza', members:445, emoji:'🙏', verified:true,  desc:'Comunidad cristiana latina. Cultos y grupos de estudio.', contact:'https://chat.whatsapp.com/ejemplo' },
  { id:'c8', name:'Gastronomía Latina CH',      cat:'gastronomia',city:'Toda Suiza', members:334, emoji:'🍳', verified:false, desc:'Recetas, ingredientes latinos y cenas comunitarias.', contact:'https://t.me/gastrolatinoch' },
]

export const MOCK_DOCS = GUIDES

export const MOCK_PROVIDERS = [
  { id:'p1', name:'Foto & Film Latino',     cat:'fotografia',city:'GE', description:'Especialistas en quinceañeras y bodas. Álbum digital + video.', services:['Fotografía','Video','Drone'],             price_range:'alto',  whatsapp:'+41798765432', instagram:'@fotofilmlatino',  verified:true,  featured:false, photo_url:'https://images.unsplash.com/photo-1554080353-a576cf803bda?w=400&h=300&fit=crop' },
  { id:'p2', name:'Sabor Latino Catering',  cat:'catering',  city:'ZH', description:'Cocina latinoamericana auténtica. Ceviche, tamales, lechón.', services:['Colombiana','Peruana','Mexicana'],           price_range:'medio', whatsapp:'+41791122334', instagram:'@saborlatino_ch', verified:true,  featured:true,  photo_url:'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400&h=300&fit=crop' },
  { id:'p3', name:'Dulces de mi Tierra',    cat:'reposteria', city:'BS', description:'Pasteles y postres latinoamericanos artesanales. Tortas, churros.', services:['Tortas','Tres leches','Churros'],      price_range:'bajo',  whatsapp:'+41794455667', instagram:'@dulcesmitierra', verified:false, featured:false, photo_url:'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop' },
  { id:'p4', name:'Banda Caliente Zürich',  cat:'musica',    city:'ZH', description:'Banda en vivo de música latina. Salsa, cumbia, vallenato.', services:['Salsa','Cumbia','Vallenato'],                   price_range:'alto',  whatsapp:'+41796677889', instagram:'@bandacalientezh', verified:true,  featured:true,  photo_url:'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=300&fit=crop' },
]

export const MOCK_POSTS = [
  { id:'f1', emoji:'🎓', title:'¿Cómo convalidar mi título universitario en Suiza?', cat:'documentos', author:'Miguel · Bolivia',  time:'Hace 2h',  replies:12, solved:false },
  { id:'f2', emoji:'💬', title:'Grupos de WhatsApp venezolanos en Zürich',           cat:'comunidad',  author:'Luisa García',     time:'Hace 4h',  replies:28, solved:true  },
  { id:'f3', emoji:'👶', title:'¿Guarderías que hablen español en Ginebra?',         cat:'familias',   author:'Valentina Mora',   time:'Ayer',     replies:7,  solved:true  },
  { id:'f4', emoji:'🧾', title:'Pagar AHV como autónomo — dudas frecuentes',        cat:'impuestos',  author:'Carlos Pineda',    time:'Hace 2d',  replies:19, solved:false },
  { id:'f5', emoji:'🏠', title:'¿Hipoteca siendo permiso B? ¿Alguien lo logró?',   cat:'vivienda',   author:'Ana Reyes',        time:'Hace 3d',  replies:34, solved:false },
  { id:'f6', emoji:'🍽️', title:'Mejores restaurantes latinos en Basilea',           cat:'gastronomia',author:'Diego Ramírez',    time:'Hace 4d',  replies:22, solved:false },
]

export const MOCK_CAREGIVERS = [
  { id:'cg1', name:'María González', type:'Cuidadora niños',  city:'ZH', price:'CHF 22/h', ages:'0–6 años',    langs:['Español','Alemán'],   verified:true,  emoji:'👩🏽', desc:'10 años de experiencia con bebés. Permiso B vigente.' },
  { id:'cg2', name:'Ana Ruiz',       type:'Cuidadora mayores',city:'GE', price:'CHF 28/h', ages:'Adultos',     langs:['Español','Francés'],  verified:true,  emoji:'👩🏻', desc:'Enfermera auxiliar en Colombia. Acompañamiento paciente.' },
  { id:'cg3', name:'Sofia Torres',   type:'Niñera / Tutora',  city:'BS', price:'CHF 20/h', ages:'2–12 años',   langs:['Español','Inglés'],   verified:false, emoji:'👩🏼‍🦰', desc:'Maestra de primaria. Ayudo también con tareas.' },
]

export const MOCK_FAMILY_GROUPS = [
  { id:'fg1', name:'Mamás Latinas Zürich',     city:'Zürich',  members:184, emoji:'👩‍👧',     desc:'Grupo de apoyo para madres latinas con quedadas, recomendaciones y ayuda mutua.', contact:'https://chat.whatsapp.com/ejemplo-mamas-zh' },
  { id:'fg2', name:'Familias Latinas Ginebra', city:'Ginebra', members:126, emoji:'👨‍👩‍👧', desc:'Planes familiares, actividades de fin de semana y orientación para recién llegados.', contact:'https://t.me/familiaslatinasge' },
  { id:'fg3', name:'Papás y Mamás Basel',      city:'Basilea', members:93,  emoji:'🧸',          desc:'Red cercana para compartir guarderías, escuelas y contactos de confianza.', contact:'https://chat.whatsapp.com/ejemplo-familias-bs' },
  { id:'fg4', name:'Crianza Latina Lausanne',  city:'Lausana', members:77,  emoji:'🍀',          desc:'Comunidad para acompañarse en crianza bilingüe, lactancia y reagrupación familiar.', contact:'https://t.me/crianzalatina-vd' },
]

export const MOCK_JOBS = [
  { id:'j1', job_intent:'ofrece', emoji:'👨‍🍳', title:'Cocinero/a latino/a',         company:'El Rincón Latino',  city:'ZH', type:'Full-time',  salary:'CHF 4.200–4.800/mes', lang:'Español + alemán básico' },
  { id:'j2', job_intent:'ofrece', emoji:'👶', title:'Cuidadora de niños',           company:'Familia particular', city:'BS', type:'Part-time',  salary:'CHF 25/hora',         lang:'Español' },
  { id:'j3', job_intent:'ofrece', emoji:'💻', title:'Técnico/a IT soporte usuario', company:'Tech Company',       city:'ZH', type:'Full-time',  salary:'CHF 6.000–7.500/mes', lang:'Inglés + alemán' },
  { id:'j4', job_intent:'busca',  emoji:'💇', title:'Peluquera busca empleo',       company:'Solicitud de empleo', city:'BE', type:'Full-time',  salary:'CHF 3.500 + comisión', lang:'Español' },
]

export const NEGOCIO_TYPES = [
  { id:'',            label:'Todos' },
  { id:'restaurante', label:'🍽️ Restaurante', desc:'Comida, bebidas, take away o delivery' },
  { id:'tienda',      label:'🛒 Tienda', desc:'Productos latinos, alimentación, ropa o artículos' },
  { id:'pasteleria',  label:'🍰 Pastelería', desc:'Tortas, postres, panadería y pedidos especiales' },
  { id:'belleza',     label:'💇 Belleza', desc:'Peluquería, barbería, uñas, maquillaje y estética' },
  { id:'hogar', label:'🏠 Hogar', desc:'Construcción, limpieza, jardinería, mudanzas y reparaciones' },
  { id:'vehiculos', label:'🚗 Vehículos', desc:'Alquiler de coches, mecánicos, compra/venta y servicios para vehículos' },
  { id:'salud', label:'🩺 Salud', desc:'Dentistas, psicólogos, fisioterapia, terapias y cuidado especializado' },
  { id:'asesoria_tramites', label:'📄 Asesoría', desc:'Seguros, impuestos, permisos, traducciones, gestoría y orientación' },
  { id:'otro',        label:'✨ Otro', desc:'Para negocios que no encajan en las categorías anteriores' },
]

const NEGOCIO_TYPE_ALIASES = {
  barberia: 'belleza',
  coches: 'vehiculos',
  mecanica: 'vehiculos',
  mecanico: 'vehiculos',
  vehiculo: 'vehiculos',
  servicios: 'hogar',
  servicios_hogar: 'hogar',
  servicios_profesionales: 'asesoria_tramites',
  salud_bienestar: 'salud',
}

export const HIDDEN_NEGOCIO_TYPE_IDS = []
export const VISIBLE_NEGOCIO_TYPES = NEGOCIO_TYPES.filter(item => !HIDDEN_NEGOCIO_TYPE_IDS.includes(item.id))

export function normalizeNegocioType(type='') {
  return NEGOCIO_TYPE_ALIASES[type] || type
}

export function getNegocioTypeMeta(type='') {
  const normalizedType = normalizeNegocioType(type)
  return NEGOCIO_TYPES.find(item => item.id === normalizedType) || NEGOCIO_TYPES.find(item => item.id === type)
}

export const MOCK_NEGOCIOS = [
  { id:'n1', emoji:'🍽️', name:'El Rincón Colombiano',  type:'restaurante', city:'Zürich',  canton:'ZH', desc:'Bandeja paisa, arepas y sancocho auténtico. Cocina casera colombiana de lunes a domingo.', phone:'+41791234567', email:'hola@rinconcolombiano.ch', website:'rinconcolombiano.ch', instagram:'@rinconcolombiano_zh', verified:true,  featured:true  },
  { id:'n2', emoji:'✂️', name:'Barber Latino ZH',        type:'barberia',    city:'Zürich',  canton:'ZH', desc:'Cortes al estilo caribeño. Fades, diseños y barba. Solo con cita previa vía WhatsApp.',     phone:'+41792345678', email:'citas@barberlatinozh.ch', instagram:'@barberlatino_zh',     verified:true,  featured:false },
  { id:'n3', emoji:'🛒', name:'Tienda Latina Bern',       type:'tienda',      city:'Berna',   canton:'BE', desc:'Productos latinoamericanos importados: frijoles, masa, chiles, bebidas típicas y más.',      phone:'+41793456789', website:'tiendalatinabern.ch', instagram:'@tiendalatina_bern',   verified:true,  featured:true  },
  { id:'n4', emoji:'🍰', name:'Dulces de mi Tierra',      type:'pasteleria',  city:'Basilea', canton:'BS', desc:'Pasteles artesanales: tres leches, torta de queso, buñuelos. Pedidos con anticipación.',      phone:'+41794567890', email:'pedidos@dulcesmitierra.ch', instagram:'@dulcesmitierra_bs',   verified:false, featured:false },
  { id:'n5', emoji:'💇', name:'Afro & Latino Hair',        type:'belleza',     city:'Ginebra', canton:'GE', desc:'Especialistas en cabello afro y latino. Trenzas, extensiones y relaxado permanente.',         phone:'+41795678901', website:'afrolatinohair.ch', instagram:'@afrolatinohair_ge',   verified:true,  featured:false },
  { id:'n6', emoji:'🌮', name:'Tacos & Más',               type:'restaurante', city:'Lausana', canton:'VD', desc:'Tacos, burritos y enchiladas mexicanas auténticas. Para llevar o comer en local.',             phone:'+41796789012', email:'hola@tacosymas.ch', instagram:'@tacosymas_lsn',       verified:false, featured:false },
  { id:'n7', emoji:'💸', name:'Latino Transfer ZH',        type:'asesoria_tramites', city:'Zürich',  canton:'ZH', desc:'Envío de dinero a Latinoamérica. Mejores tasas, sin comisiones ocultas. Atención en español.', phone:'+41797890123', website:'latinotransfer.ch', instagram:'@latinotransfer_zh',   verified:true,  featured:false },
  { id:'n8', emoji:'🥩', name:'Carnicería El Gaucho',      type:'tienda',      city:'Ginebra', canton:'GE', desc:'Cortes de carne al estilo latinoamericano. Chorizos, morcillas y especias importadas.',         phone:'+41798901234', email:'pedidos@elgaucho.ch', instagram:'@elgaucho_ge',         verified:false, featured:false },
]

export const MOCK_NEGOCIO_SERVICES = {
  n1:['Arepas', 'Menú casero', 'Delivery'],
  n2:['Fade', 'Barba', 'Diseños'],
  n3:['Abarrotes', 'Harinas', 'Bebidas latinas'],
  n4:['Tres leches', 'Tortas', 'Pedidos por encargo'],
  n5:['Trenzas', 'Extensiones', 'Cabello afro'],
  n6:['Tacos', 'Burritos', 'Take away'],
  n7:['Envíos', 'Cambio', 'Asesoría'],
  n8:['Cortes premium', 'Chorizos', 'Parrilla'],
}

export const MOCK_NEGOCIO_REVIEWS = {
  n1: [
    { id:'nr1', author:'Paula M.', canton:'ZH', stars:5, date:'Hace 4 días', text:'Las arepas y el sancocho saben a casa. Atención súper cercana y local muy limpio.' },
    { id:'nr2', author:'Andrés C.', canton:'AG', stars:4, date:'Hace 2 semanas', text:'Muy rico todo. El menú del día sale bien de precio para Zürich.' },
    { id:'nr3', author:'Lucía R.', canton:'ZH', stars:5, date:'Hace 1 mes', text:'Perfecto para llevar a amigos suizos a probar comida colombiana auténtica.' },
  ],
  n2: [
    { id:'nr4', author:'Kevin S.', canton:'ZH', stars:5, date:'Hace 6 días', text:'Fade limpio y rápido. Muy buen ambiente y hablan español, que se agradece.' },
    { id:'nr5', author:'Jhon P.', canton:'ZH', stars:5, date:'Hace 2 semanas', text:'La mejor barbería latina que he probado en Zürich. Reservé por WhatsApp sin problema.' },
  ],
  n3: [
    { id:'nr6', author:'María G.', canton:'BE', stars:5, date:'Hace 1 semana', text:'Encontré harina PAN, ají amarillo y galletas que no veía desde hace años.' },
    { id:'nr7', author:'César D.', canton:'FR', stars:4, date:'Hace 3 semanas', text:'Muy surtida y la dueña te ayuda a encontrar productos parecidos si no hay stock.' },
  ],
  n4: [
    { id:'nr8', author:'Sofía T.', canton:'BS', stars:5, date:'Hace 5 días', text:'Le encargamos una torta tres leches y quedó espectacular. Muy recomendable.' },
  ],
  n5: [
    { id:'nr9', author:'Laura V.', canton:'GE', stars:5, date:'Hace 1 semana', text:'Por fin un salón que entiende cabello afro y latino de verdad. Trenzas impecables.' },
    { id:'nr10', author:'Nadia F.', canton:'GE', stars:4, date:'Hace 3 semanas', text:'Muy buen trato y consejos honestos para cuidar el pelo en invierno.' },
  ],
  n6: [
    { id:'nr11', author:'Miguel R.', canton:'VD', stars:4, date:'Hace 4 días', text:'Los tacos al pastor están buenísimos y el local tiene ambiente muy agradable.' },
  ],
  n7: [
    { id:'nr12', author:'Carolina P.', canton:'ZH', stars:5, date:'Hace 2 semanas', text:'Me explicaron todo en español y el envío llegó rápido. Transparencia total.' },
  ],
  n8: [
    { id:'nr13', author:'Esteban L.', canton:'GE', stars:5, date:'Hace 1 semana', text:'La carne para asado estaba excelente. También tienen chorizo muy bueno.' },
  ],
}

export const MOCK_NEGOCIO_PHOTOS = {
  n1: [
    'https://images.unsplash.com/photo-1544025162-d76694265947?w=900&h=600&fit=crop',
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=900&h=600&fit=crop',
    'https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?w=900&h=600&fit=crop',
  ],
  n2: [
    'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=900&h=600&fit=crop',
    'https://images.unsplash.com/photo-1517832606299-7ae9b720a186?w=900&h=600&fit=crop',
    'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=900&h=600&fit=crop',
  ],
  n3: [
    'https://images.unsplash.com/photo-1542838132-92c53300491e?w=900&h=600&fit=crop',
    'https://images.unsplash.com/photo-1579113800032-c38bd7635818?w=900&h=600&fit=crop',
    'https://images.unsplash.com/photo-1516594798947-e65505dbb29d?w=900&h=600&fit=crop',
  ],
  n4: [
    'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=900&h=600&fit=crop',
    'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=900&h=600&fit=crop',
  ],
  n5: [
    'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=900&h=600&fit=crop',
    'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=900&h=600&fit=crop',
    'https://images.unsplash.com/photo-1522337660859-02fbefca4702?w=900&h=600&fit=crop',
  ],
  n6: [
    'https://images.unsplash.com/photo-1552332386-f8dd00dc2f85?w=900&h=600&fit=crop',
    'https://images.unsplash.com/photo-1565299507177-b0ac66763828?w=900&h=600&fit=crop',
  ],
  n7: [
    'https://images.unsplash.com/photo-1556740749-887f6717d7e4?w=900&h=600&fit=crop',
    'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=900&h=600&fit=crop',
  ],
  n8: [
    'https://images.unsplash.com/photo-1603048297172-c92544798d5a?w=900&h=600&fit=crop',
    'https://images.unsplash.com/photo-1529692236671-f1dc31c4a87d?w=900&h=600&fit=crop',
  ],
}

export const EVENTO_TYPES = [
  { id:'', label:'Todos' },
  { id:'concierto', label:'🎵 Concierto', desc:'Música en vivo, artistas, bandas o shows' },
  { id:'festival', label:'🎪 Festival', desc:'Eventos grandes con música, comida o cultura' },
  { id:'quedada', label:'🤝 Quedada', desc:'Encuentros informales, planes y actividades' },
  { id:'fiesta', label:'💃 Fiesta', desc:'Baile, DJ, celebración o noche latina' },
  { id:'networking', label:'💼 Networking', desc:'Contactos profesionales, negocio y comunidad' },
  { id:'familia', label:'👨‍👩‍👧 Familiar', desc:'Planes para niños, familias o todos los públicos' },
]

export const MOCK_EVENTOS_LATINOS = [
  { id:'e1', type:'festival', emoji:'🎪', title:'Festival Latino de Primavera', city:'Zürich', canton:'ZH', venue:'Rote Fabrik', day:'18', month:'MAY', time:'14:00', price:'Desde CHF 12', host:'Asociación Latina Zürich', featured:true, desc:'Comida, música en vivo, talleres y zona familiar para toda la comunidad.', img:'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=900&h=600&fit=crop', link:'https://latido.ch/eventos/festival-primavera' },
  { id:'e2', type:'quedada', emoji:'🤝', title:'Quedada de nuevos en Suiza', city:'Berna', canton:'BE', venue:'Rosengarten Café', day:'24', month:'MAY', time:'17:30', price:'Gratis', host:'Latido Comunidad', featured:false, desc:'Encuentro informal para hacer contactos, resolver dudas y conocer gente latina en tu ciudad.', img:'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=900&h=600&fit=crop', link:'https://latido.ch/eventos/quedada-berna' },
  { id:'e3', type:'concierto', emoji:'🎵', title:'Noche de salsa en Lausanne', city:'Lausana', canton:'VD', venue:'Le Romandie', day:'31', month:'MAY', time:'21:00', price:'CHF 18', host:'Salsa Vaud', featured:true, desc:'Banda en vivo, DJ invitado y clases cortas antes del concierto para todos los niveles.', img:'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=900&h=600&fit=crop', link:'https://latido.ch/eventos/salsa-lausanne' },
  { id:'e4', type:'networking', emoji:'💼', title:'Networking latino profesional', city:'Ginebra', canton:'GE', venue:'Impact Hub', day:'06', month:'JUN', time:'19:00', price:'CHF 10', host:'Profesionales Latinos CH', featured:false, desc:'Afterwork para emprendedores, recién llegados y profesionales que quieren ampliar su red en Suiza.', img:'https://images.unsplash.com/photo-1511578314322-379afb476865?w=900&h=600&fit=crop', link:'https://latido.ch/eventos/networking-geneva' },
  { id:'e5', type:'familia', emoji:'👨‍👩‍👧', title:'Picnic familiar latino', city:'Basilea', canton:'BS', venue:'Kannenfeldpark', day:'09', month:'JUN', time:'12:00', price:'Gratis', host:'Mamás Latinas Suiza', featured:false, desc:'Planes con niños, comida compartida y actividades al aire libre para familias latinas.', img:'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=900&h=600&fit=crop', link:'https://latido.ch/eventos/picnic-familiar' },
  { id:'e6', type:'fiesta', emoji:'💃', title:'Fiesta reggaetón & perreo old school', city:'Zürich', canton:'ZH', venue:'Club Zukunft', day:'14', month:'JUN', time:'23:00', price:'CHF 20', host:'Latido Nights', featured:true, desc:'Sesión larga con hits clásicos, trap latino y ambientazo para bailar hasta tarde.', img:'https://images.unsplash.com/photo-1521334884684-d80222895322?w=900&h=600&fit=crop', link:'https://latido.ch/eventos/perreo-zurich' },
]

export const MOCK_HOUSING = [
  { id:'h1', emoji:'🛏️', type:'Habitación',     price:'CHF 850/mes',  city:'ZH', plz:'8001', available:'Ya disponible', rooms:'Compartido 3 pers.', desc:'En piso con latinos. Cerca del transporte.' },
  { id:'h2', emoji:'🏠', type:'Piso completo',   price:'CHF 1.650/mes',city:'GE', plz:'1204', available:'1 de mayo',     rooms:'2 habitaciones',    desc:'En Carouge. No se requieren referencias previas.' },
  { id:'h3', emoji:'🏡', type:'Sublet temporal', price:'CHF 600/mes',  city:'BS', plz:'4001', available:'Ya disponible', rooms:'Estudio',           desc:'3 meses. Ideal para recién llegados. Incluye internet.' },
]

// ── MOCK REVIEWS ───────────────────────────────────────────────
export const MOCK_REVIEWS = {
  p1: [
    { id:'r1', author:'María C.',  canton:'ZH', stars:5, date:'Hace 3 días',  text:'DJ increíble. Puso salsa, reggaetón y hasta cumbia vallenata. Todos bailaron hasta las 3am. Muy profesional y puntual.' },
    { id:'r2', author:'Diego F.',  canton:'BE', stars:5, date:'Hace 1 semana', text:'Para la quinceañera de mi hija fue perfecto. Conocía todos los temas que pedimos. Super recomendado.' },
    { id:'r3', author:'Ana R.',    canton:'GE', stars:4, date:'Hace 2 semanas', text:'Muy buena música y equipo de sonido potente. Solo le falta un poco más de variedad en música andina.' },
    { id:'r4', author:'Carlos M.', canton:'ZH', stars:5, date:'Hace 1 mes',    text:'Segundo evento con él y siempre cumple. Precio justo para la calidad que da.' },
  ],
  p2: [
    { id:'r5', author:'Valentina B.', canton:'GE', stars:5, date:'Hace 5 días',  text:'Las fotos de nuestra boda son espectaculares. Capturaron momentos que ni notamos en el momento. Álbum precioso.' },
    { id:'r6', author:'Roberto L.',   canton:'VD', stars:5, date:'Hace 2 semanas', text:'Video editado profesionalmente, música perfecta, entrega en 2 semanas. Muy satisfechos.' },
    { id:'r7', author:'Paula G.',     canton:'GE', stars:4, date:'Hace 1 mes',    text:'Muy buenos fotógrafos. El drone le da un toque especial. Un poquito caros pero vale la pena.' },
  ],
  p3: [
    { id:'r8',  author:'Jorge S.',   canton:'ZH', stars:5, date:'Hace 2 días',  text:'El lechón al palo fue la estrella de la fiesta. Llegaron puntual con todo el equipo. 100% recomendado.' },
    { id:'r9',  author:'Lucia T.',   canton:'BE', stars:5, date:'Hace 1 semana', text:'Ceviche y bandeja paisa auténticos. Mis amigos suizos quedaron fascinados. Servicio impecable.' },
    { id:'r10', author:'Patricia M.',canton:'ZH', stars:4, date:'Hace 3 semanas', text:'Muy rica la comida, buena cantidad. El servicio podría mejorar un poco en la puntualidad al servir.' },
    { id:'r11', author:'Andrés C.',  canton:'AG', stars:5, date:'Hace 1 mes',    text:'Para nuestra reunión de colombianos en Suiza fue perfecta. Trajeron hasta chicha y buñuelos.' },
  ],
  p4: [
    { id:'r12', author:'Sofía R.',   canton:'BS', stars:5, date:'Hace 1 semana', text:'El tres leches estaba para llorar de lo rico. Igualito al de mi abuela en Colombia. Muy recomendada.' },
    { id:'r13', author:'Miguel F.',  canton:'BE', stars:4, date:'Hace 2 semanas', text:'Los churros con chocolate estaban deliciosos. La torta de quinceañera quedó hermosa.' },
  ],
  p5: [
    { id:'r14', author:'Elena P.',   canton:'ZH', stars:5, date:'Hace 4 días',  text:'La banda en vivo es otro nivel. Tocaron desde vallenato hasta salsa cali. Increíble energía.' },
    { id:'r15', author:'Tomás A.',   canton:'ZH', stars:5, date:'Hace 2 semanas', text:'Para nuestra boda fue el complemento perfecto. Muy profesionales y buen repertorio.' },
    { id:'r16', author:'Carmen L.',  canton:'GE', stars:4, date:'Hace 1 mes',    text:'Muy buena banda. Tal vez un poco alto el volumen al inicio pero ajustaron rápido.' },
  ],
}

// Extra gallery photos per provider
export const MOCK_PROVIDER_PHOTOS = {
  p1: [
    'https://images.unsplash.com/photo-1571266028243-3716f02d2d50?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1516873240891-4bf014598ab4?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1504680177321-2e6a879aac86?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=600&h=400&fit=crop',
  ],
  p2: [
    'https://images.unsplash.com/photo-1554080353-a576cf803bda?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1537907510278-d49e2afc89a4?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1505236858219-8359eb29e329?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=600&h=400&fit=crop',
  ],
  p3: [
    'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=600&h=400&fit=crop',
  ],
  p4: [
    'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1488477304112-4944851de03d?w=600&h=400&fit=crop',
  ],
  p5: [
    'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1468164016595-6108e4c60753?w=600&h=400&fit=crop',
  ],
}
