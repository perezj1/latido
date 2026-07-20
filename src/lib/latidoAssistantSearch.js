import { CANTONS, CITIES_BY_CANTON, getCantonForCity } from './constants.js'
import { normalizeSearchText } from './naturalSearch.js'

const NUMBER_WORDS = {
  un:1,
  uno:1,
  una:1,
  dos:2,
  tres:3,
  cuatro:4,
  cinco:5,
  seis:6,
  siete:7,
  ocho:8,
}

const MONTHS = {
  enero:0,
  febrero:1,
  marzo:2,
  abril:3,
  mayo:4,
  junio:5,
  julio:6,
  agosto:7,
  septiembre:8,
  setiembre:8,
  octubre:9,
  noviembre:10,
  diciembre:11,
}

const LOCATION_ALIASES = {
  'zurich':{ municipality:'Zürich', canton:'ZH' },
  'zuerich':{ municipality:'Zürich', canton:'ZH' },
  'lucerna':{ municipality:'Luzern', canton:'LU' },
  'ginebra':{ municipality:'Genève', canton:'GE' },
  'geneva':{ municipality:'Genève', canton:'GE' },
  'basilea':{ municipality:'Basel', canton:'BS' },
  'berna':{ municipality:'Bern', canton:'BE' },
  'lausana':{ municipality:'Lausanne', canton:'VD' },
  'san galo':{ municipality:'St. Gallen', canton:'SG' },
  'friburgo':{ municipality:'Fribourg', canton:'FR' },
  'neuchatel':{ municipality:'Neuchâtel', canton:'NE' },
  'tesino':{ municipality:'Lugano', canton:'TI' },
  'ticino':{ canton:'TI' },
  'grisones':{ canton:'GR' },
  'grisons':{ canton:'GR' },
  'valais':{ canton:'VS' },
  'wallis':{ canton:'VS' },
  'vaud':{ canton:'VD' },
}

const POSTAL_LOCATION_RANGES = [
  { from:8000, to:8099, municipality:'Zürich', canton:'ZH' },
  { from:8400, to:8499, municipality:'Winterthur', canton:'ZH' },
  { from:6000, to:6099, municipality:'Luzern', canton:'LU' },
  { from:3000, to:3099, municipality:'Bern', canton:'BE' },
  { from:4000, to:4099, municipality:'Basel', canton:'BS' },
  { from:1200, to:1299, municipality:'Genève', canton:'GE' },
  { from:1000, to:1099, municipality:'Lausanne', canton:'VD' },
  { from:9000, to:9099, municipality:'St. Gallen', canton:'SG' },
  { from:6900, to:6999, municipality:'Lugano', canton:'TI' },
  { from:6300, to:6399, municipality:'Zug', canton:'ZG' },
]

const SCOPE_DEFINITIONS = [
  {
    id:'employment',
    label:'Empleo',
    category:'',
    entityTypes:['job', 'business', 'ad'],
    triggers:['empleo', 'trabajo', 'trabajar', 'vacante', 'puesto laboral', 'curro', 'chamba'],
    searchTerms:['empleo', 'trabajo', 'vacante', 'puesto', 'oferta laboral'],
    semanticSeed:'empleo',
  },
  {
    id:'cleaning',
    label:'Limpieza',
    category:'servicios',
    entityTypes:['business', 'ad'],
    triggers:['limpiar', 'limpieza', 'aseo', 'fregar', 'barrer', 'reinigung', 'cleaning'],
    searchTerms:['limpieza', 'limpiar', 'aseo', 'reinigung', 'cleaning'],
    semanticSeed:'limpieza',
  },
  {
    id:'translation',
    label:'Traducciones',
    category:'documentos',
    entityTypes:['business', 'ad', 'guide'],
    triggers:['traducir', 'traduccion', 'traductor', 'traductora', 'interprete', 'interpretacion'],
    searchTerms:['traduccion', 'traducir', 'traductor', 'interprete'],
    semanticSeed:'traduccion',
  },
  {
    id:'moving',
    label:'Mudanzas',
    category:'servicios',
    entityTypes:['business', 'ad'],
    triggers:['mudanza', 'mudar', 'traslado', 'transportar muebles', 'umzug'],
    searchTerms:['mudanza', 'mudanzas', 'traslado', 'transporte muebles', 'umzug'],
    semanticSeed:'mudanza',
  },
  {
    id:'repairs',
    label:'Reparaciones',
    category:'servicios',
    entityTypes:['business', 'ad'],
    triggers:['arreglar', 'averia', 'reparacion', 'reparar', 'fontanero', 'electricista', 'pintor', 'bricolaje', 'manitas', 'carpintero', 'montar muebles', 'colgar lampara'],
    searchTerms:['reparacion', 'mantenimiento', 'fontanero', 'electricista', 'pintor', 'bricolaje', 'manitas', 'carpinteria', 'reformas'],
    semanticSeed:'reparacion',
  },
  {
    id:'childcare',
    label:'Cuidado infantil',
    category:'cuidados',
    entityTypes:['business', 'ad'],
    triggers:['ninera', 'ninero', 'canguro', 'guarderia', 'au pair', 'aupair', 'cuidado de ninos'],
    searchTerms:['cuidado ninos', 'ninera', 'ninero', 'canguro', 'guarderia', 'au pair', 'kita'],
    semanticSeed:'ninera',
  },
  {
    id:'eldercare',
    label:'Cuidado de mayores',
    category:'cuidados',
    entityTypes:['business', 'ad'],
    triggers:['anciano', 'anciana', 'personas mayores', 'cuidado mayor', 'cuidar mayor', 'spitex'],
    searchTerms:['cuidado mayores', 'cuidador', 'cuidadora', 'spitex', 'asistencia personal'],
    semanticSeed:'cuidado mayores',
  },
  {
    id:'insurance',
    label:'Seguros y previsión',
    category:'documentos',
    entityTypes:['business', 'ad'],
    triggers:['seguro', 'seguros', 'aseguradora', 'poliza', 'tercer pilar', 'prevision', 'krankenkasse'],
    searchTerms:['seguro', 'seguros', 'aseguradora', 'poliza', 'tercer pilar', 'prevision', 'krankenkasse'],
    semanticSeed:'seguro',
  },
  {
    id:'paperwork',
    label:'Trámites y asesoría',
    category:'documentos',
    entityTypes:['business', 'ad', 'guide'],
    triggers:['tramite', 'gestoria', 'permiso', 'apostilla', 'impuesto', 'declaracion', 'asesoria', 'abogado', 'notario', 'residencia', 'empadronamiento'],
    searchTerms:['tramite', 'gestoria', 'permiso', 'apostilla', 'impuesto', 'declaracion', 'asesoria', 'abogado', 'notario', 'residencia'],
    semanticSeed:'tramite',
  },
  {
    id:'health',
    label:'Salud',
    category:'',
    entityTypes:['business', 'ad'],
    triggers:['dentista', 'medico', 'doctora', 'doctor', 'psicologo', 'psicologa', 'fisioterapia', 'terapia', 'pediatra', 'ginecologo', 'odontologo', 'odontologia', 'muela', 'diente', 'caries', 'ortodoncia', 'dolor de espalda', 'rehabilitacion'],
    searchTerms:['dentista', 'medico', 'doctor', 'psicologia', 'fisioterapia', 'terapia', 'salud', 'odontologia', 'clinica'],
    semanticSeed:'salud',
  },
  {
    id:'beauty',
    label:'Belleza',
    category:'',
    entityTypes:['business', 'ad'],
    triggers:['peluqueria', 'peluquero', 'peluquera', 'barberia', 'barbero', 'unas', 'maquillaje', 'estetica', 'manicura', 'pedicura', 'depilacion', 'masaje', 'cortar el pelo'],
    searchTerms:['peluqueria', 'barberia', 'estetica', 'belleza', 'unas', 'maquillaje', 'manicura', 'pedicura', 'depilacion', 'masaje'],
    semanticSeed:'belleza',
  },
  {
    id:'dance',
    label:'Baile y danza',
    category:'',
    entityTypes:['business', 'event', 'ad'],
    triggers:['bailar', 'baile', 'danza', 'bachata', 'tango', 'merengue', 'kizomba', 'zumba', 'coreografia', 'clases de salsa', 'aprender salsa', 'noche de salsa'],
    searchTerms:['baile', 'bailar', 'danza', 'salsa', 'bachata', 'tango', 'merengue', 'kizomba', 'zumba', 'clases de baile'],
    semanticSeed:'baile',
  },
  {
    id:'food',
    label:'Comida y restauración',
    category:'',
    entityTypes:['business', 'ad'],
    triggers:['comer', 'comida', 'restaurante', 'catering', 'pastel', 'torta', 'tarta', 'pasteleria', 'reposteria', 'panaderia', 'cupcake', 'postre', 'dulces', 'salsa'],
    searchTerms:['comida', 'restaurante', 'catering', 'pasteleria', 'reposteria', 'pastel', 'tarta', 'torta', 'panaderia', 'cupcake', 'postre'],
    semanticSeed:'restaurante',
  },
  {
    id:'education',
    label:'Clases y formación',
    category:'',
    entityTypes:['business', 'ad', 'event'],
    triggers:['aprender', 'clases', 'curso', 'cursos', 'profesor', 'profesora', 'academia', 'formacion', 'taller educativo'],
    searchTerms:['clases', 'curso', 'profesor', 'profesora', 'academia', 'formacion', 'taller'],
    semanticSeed:'clases',
  },
  {
    id:'vehicle',
    label:'Vehículos y talleres',
    category:'',
    entityTypes:['business', 'ad'],
    triggers:['coche', 'carro', 'auto', 'vehiculo', 'mecanico', 'mecanica', 'taller mecanico', 'neumaticos', 'llantas'],
    searchTerms:['coche', 'vehiculo', 'mecanico', 'mecanica', 'taller', 'automovil', 'neumaticos'],
    semanticSeed:'vehiculo',
  },
  {
    id:'transport',
    label:'Transporte',
    category:'',
    entityTypes:['business', 'ad'],
    triggers:['taxi', 'chofer', 'conductor', 'llevar al aeropuerto', 'traslado aeropuerto', 'transporte de personas'],
    searchTerms:['taxi', 'chofer', 'conductor', 'aeropuerto', 'transporte', 'traslado'],
    semanticSeed:'transporte',
  },
  {
    id:'events',
    label:'Eventos',
    category:'eventos',
    entityTypes:['event'],
    triggers:['evento', 'eventos', 'concierto', 'festival', 'fiesta', 'networking', 'quedada'],
    searchTerms:['evento', 'concierto', 'festival', 'fiesta', 'networking', 'quedada'],
    semanticSeed:'evento',
  },
  {
    id:'communities',
    label:'Grupos y comunidades',
    category:'grupos',
    entityTypes:['community'],
    triggers:['grupo', 'grupos', 'comunidad', 'comunidades', 'asociacion'],
    searchTerms:['grupo', 'comunidad', 'asociacion'],
    semanticSeed:'grupo',
  },
  {
    id:'marketplace',
    label:'Compra y venta',
    category:'venta',
    entityTypes:['ad'],
    triggers:['comprar', 'compro', 'vender', 'vendo', 'regalar', 'regalo', 'segunda mano', 'mercado'],
    searchTerms:['comprar', 'venta', 'vendo', 'regalo', 'segunda mano'],
    semanticSeed:'venta',
  },
  {
    id:'housing',
    label:'Vivienda',
    category:'vivienda',
    entityTypes:['ad'],
    triggers:['piso', 'apartamento', 'vivienda', 'habitacion', 'cuarto', 'casa', 'alquiler', 'alquilar', 'arrendar', 'sublet', 'estudio'],
    searchTerms:['vivienda', 'piso', 'apartamento', 'habitacion', 'alquiler', 'sublet', 'estudio'],
    semanticSeed:'vivienda',
  },
]

const ACTION_WORDS = new Set([
  'busca', 'buscando', 'buscar', 'busco', 'encuentra', 'encontrar', 'encuentro',
  'necesito', 'necesitamos', 'quiero', 'quisiera', 'ofrezco', 'ofrecer', 'ofrece',
  'tengo', 'hay', 'me', 'interesa', 'interesado', 'interesada', 'encargar', 'encargo',
  'pedir', 'pido', 'reservar', 'reservo', 'contratar', 'contrato', 'curar', 'curarme',
  'tratar', 'tratarme', 'comprar', 'compro', 'vender', 'vendo', 'regalar', 'regalo',
  'arreglar', 'reparar',
])

const STRUCTURAL_WORDS = new Set([
  'a', 'al', 'con', 'de', 'del', 'desde', 'el', 'en', 'entre', 'franco', 'francos',
  'hasta', 'la', 'las', 'lo', 'los', 'max', 'maximo', 'maxima', 'menos', 'min',
  'minimo', 'minima', 'para', 'por', 'que', 'se', 'sin', 'suiza', 'un', 'una',
  'chf', 'aproximadamente', 'presupuesto', 'tope', 'precio', 'cerca', 'zona',
  'vivo', 'vive', 'vivimos', 'no', 'solo', 'nivel',
])

function includesPhrase(text, phrase) {
  return (` ${text} `).includes(` ${normalizeSearchText(phrase)} `)
}

function parseSwissNumber(value) {
  if (!value) return null
  const compact = String(value).replace(/[\s.'’]/g, '').replace(',', '.')
  const parsed = Number(compact)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeForExtraction(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[^a-z0-9\s.,'€%-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const MONEY_VALUE = "(\\d{1,3}(?:[.' ]\\d{3})+|\\d{2,7}(?:[,.]\\d{1,2})?)"

function extractPriceRange(text) {
  const between = new RegExp(`\\bentre\\s+(?:chf\\s*)?${MONEY_VALUE}\\s+(?:y|a)\\s+(?:chf\\s*)?${MONEY_VALUE}(?:\\s*(?:chf|francos?|€|euros?))?\\b`)
  const betweenMatch = text.match(between)
  if (betweenMatch) {
    const first = parseSwissNumber(betweenMatch[1])
    const second = parseSwissNumber(betweenMatch[2])
    if (first != null && second != null) {
      return { min:Math.min(first, second), max:Math.max(first, second), matched:betweenMatch[0] }
    }
  }

  const maxPatterns = [
    new RegExp(`\\b(?:maximo|maxima|max|hasta|menos de|tope(?: de)?|presupuesto(?: de)?)\\s*(?:chf|francos?|€|euros?)?\\s*${MONEY_VALUE}(?:\\s*(?:chf|francos?|€|euros?))?\\b`),
    new RegExp(`\\b${MONEY_VALUE}\\s*(?:chf|francos?|€|euros?)\\s*(?:maximo|maxima|max)?\\b`),
  ]
  for (const pattern of maxPatterns) {
    const match = text.match(pattern)
    const value = parseSwissNumber(match?.[1])
    if (value != null) return { min:null, max:value, matched:match[0] }
  }

  const minPattern = new RegExp(`\\b(?:minimo|minima|min|desde|mas de|a partir de)\\s*(?:chf|francos?|€|euros?)?\\s*${MONEY_VALUE}(?:\\s*(?:chf|francos?|€|euros?))?\\b`)
  const minMatch = text.match(minPattern)
  const minValue = parseSwissNumber(minMatch?.[1])
  if (minValue != null) return { min:minValue, max:null, matched:minMatch[0] }

  return { min:null, max:null, matched:'' }
}

function extractRooms(text) {
  const normalized = normalizeForExtraction(text)
  const match = normalized.match(/\b(\d+(?:[,.]5)?|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho)\s*(?:habitaciones?|cuartos?|dormitorios?|zimmer)\b/)
  if (!match) return { value:null, matched:'' }
  const wordValue = NUMBER_WORDS[match[1]]
  const value = wordValue || Number(match[1].replace(',', '.'))
  return Number.isFinite(value) ? { value, matched:match[0] } : { value:null, matched:'' }
}

function toLocalIsoDate(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function extractDate(text, now) {
  const today = new Date(now)
  if (includesPhrase(text, 'hoy')) {
    return { value:toLocalIsoDate(today.getFullYear(), today.getMonth(), today.getDate()), matched:'hoy' }
  }
  if (includesPhrase(text, 'manana')) {
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    return { value:toLocalIsoDate(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate()), matched:'manana' }
  }

  const explicit = text.match(/\b(?:para|desde|a partir del?)?\s*(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+de\s+(\d{4}))?\b/)
  if (explicit) {
    const day = Number(explicit[1])
    const month = MONTHS[explicit[2]]
    let year = explicit[3] ? Number(explicit[3]) : today.getFullYear()
    const candidate = new Date(year, month, day)
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    if (!explicit[3] && candidate < startOfToday) year += 1
    if (day >= 1 && day <= 31) return { value:toLocalIsoDate(year, month, day), matched:explicit[0] }
  }

  return { value:null, matched:'' }
}

function getLocationRecords() {
  const records = []
  for (const [canton, cities] of Object.entries(CITIES_BY_CANTON)) {
    for (const city of cities) {
      records.push({ alias:normalizeSearchText(city), municipality:city, canton })
    }
  }
  for (const [alias, location] of Object.entries(LOCATION_ALIASES)) {
    records.push({ alias, ...location })
  }
  return records.sort((left, right) => right.alias.length - left.alias.length)
}

const LOCATION_RECORDS = getLocationRecords()

function extractLocation(original, normalized, priceMatched) {
  const direct = LOCATION_RECORDS.find(record => includesPhrase(normalized, record.alias))
  if (direct) return { ...direct, matched:direct.alias }

  const explicitCode = original.match(/\b[A-Z]{2}\b/)?.[0] || normalized.match(/\bcanton(?: de)?\s+([a-z]{2})\b/)?.[1]?.toUpperCase()
  const canton = explicitCode && CANTONS.some(item => item.code === explicitCode) ? explicitCode : ''
  if (canton) return { municipality:'', canton, matched:explicitCode.toLowerCase() }

  const postalContext = normalized.match(/\b(?:codigo postal|postal|cp|cerca del|zona)\s*(\d{4})\b/) || normalized.match(/\ben\s+(\d{4})\b/)
  const postalCode = postalContext?.[1] && !String(priceMatched || '').includes(postalContext[1])
    ? postalContext[1]
    : ''
  if (!postalCode) return null
  const postalNumber = Number(postalCode)
  const resolved = POSTAL_LOCATION_RANGES.find(range => postalNumber >= range.from && postalNumber <= range.to)
  return { municipality:resolved?.municipality || '', canton:resolved?.canton || '', postalCode, matched:postalCode }
}

function getScopeDefinition(id) {
  return SCOPE_DEFINITIONS.find(scope => scope.id === id) || null
}

function hasAnyPhrase(normalized, terms) {
  return terms.some(term => includesPhrase(normalized, term))
}

function focusScope(id, semanticSeed, focusTerms = [], focusKind = 'terms') {
  const scope = getScopeDefinition(id)
  if (!scope) return null
  return {
    ...scope,
    semanticSeed:semanticSeed || scope.semanticSeed,
    searchTerms:[...new Set([...focusTerms, ...scope.searchTerms])],
    consumedTerms:[...new Set([...(scope.consumedTerms || []), ...focusTerms])],
    focusTerms,
    focusKind,
  }
}

function detectScope(normalized) {
  const hasEmploymentContext = ['empleo', 'trabajo', 'trabajar', 'vacante', 'puesto laboral', 'curro', 'chamba']
    .some(term => includesPhrase(normalized, term))
  const hasConstruction = ['construccion', 'obra', 'albanil', 'encofrador', 'yesero']
    .some(term => includesPhrase(normalized, term))

  if (hasEmploymentContext) {
    const employment = getScopeDefinition('employment')
    return hasConstruction
      ? { ...employment, searchTerms:[...employment.searchTerms, 'construccion', 'obra', 'albanil'], semanticSeed:'empleo' }
      : employment
  }

  const hasHousing = ['piso', 'apartamento', 'vivienda', 'habitacion', 'cuarto', 'alquiler', 'sublet', 'estudio']
    .some(term => includesPhrase(normalized, term))
  const hasMarketplaceVerb = ['comprar', 'compro', 'vender', 'vendo', 'regalar', 'regalo']
    .some(term => includesPhrase(normalized, term))
  if (hasHousing && hasMarketplaceVerb) {
    return getScopeDefinition('housing')
  }

  const dentalTerms = ['dentista', 'odontologo', 'odontologia', 'muela', 'muelas', 'diente', 'dientes', 'caries', 'encia', 'encias', 'ortodoncia', 'endodoncia', 'implante dental']
  if (hasAnyPhrase(normalized, dentalTerms)) {
    return focusScope('health', 'dentista', ['dentista', 'odontologia', 'clinica dental', 'dental', 'muela', 'diente'])
  }

  const healthFocuses = [
    { terms:['psicologo', 'psicologa', 'psicologia', 'ansiedad', 'depresion', 'terapia de pareja'], seed:'psicologia', matches:['psicologo', 'psicologa', 'psicologia', 'psicoterapia', 'terapia'] },
    { terms:['fisioterapia', 'fisioterapeuta', 'fisio', 'rehabilitacion', 'dolor de espalda', 'lesion muscular'], seed:'fisioterapia', matches:['fisioterapia', 'fisioterapeuta', 'fisio', 'rehabilitacion'] },
    { terms:['pediatra', 'pediatria', 'medico para ninos'], seed:'pediatra', matches:['pediatra', 'pediatria'] },
    { terms:['ginecologo', 'ginecologa', 'ginecologia'], seed:'ginecologia', matches:['ginecologo', 'ginecologa', 'ginecologia'] },
  ]
  const healthFocus = healthFocuses.find(focus => hasAnyPhrase(normalized, focus.terms))
  if (healthFocus) {
    return focusScope('health', healthFocus.seed, healthFocus.matches)
  }

  const danceStyles = ['salsa', 'bachata', 'tango', 'merengue', 'kizomba', 'zumba', 'reggaeton']
  const danceContext = hasAnyPhrase(normalized, ['bailar', 'baile', 'danza', 'coreografia'])
    || hasAnyPhrase(normalized, ['clases de salsa', 'aprender salsa', 'noche de salsa', 'fiesta de salsa', 'evento de salsa', 'festival de salsa', 'noche latina'])
    || hasAnyPhrase(normalized, danceStyles.filter(style => style !== 'salsa'))
  if (danceContext) {
    const style = danceStyles.find(term => includesPhrase(normalized, term))
    return focusScope('dance', style || 'baile', style ? [style, 'baile', 'danza'] : ['baile', 'danza'], 'dance')
  }

  const cakeTerms = ['tarta', 'tartas', 'torta', 'tortas', 'pastel', 'pasteles', 'pasteleria', 'reposteria', 'cupcake', 'cupcakes']
  if (hasAnyPhrase(normalized, cakeTerms)) {
    return focusScope('food', 'tarta', ['tarta', 'torta', 'pastel', 'pasteleria', 'reposteria', 'cupcake'])
  }

  const foodFocuses = [
    { terms:['catering', 'banquete'], seed:'catering' },
    { terms:['panaderia', 'pan', 'bolleria'], seed:'panaderia' },
    { terms:['restaurante', 'comer fuera'], seed:'restaurante' },
    { terms:['comida', 'comer', 'cocina', 'gastronomia', 'plato', 'menu'], seed:'comida' },
    { terms:['salsa'], seed:'salsa' },
  ]
  const foodFocus = foodFocuses.find(focus => hasAnyPhrase(normalized, focus.terms))
  if (foodFocus) {
    return focusScope('food', foodFocus.seed, foodFocus.terms, foodFocus.seed === 'salsa' ? 'food' : 'terms')
  }

  const vehicleTerms = ['coche', 'carro', 'auto', 'vehiculo', 'mecanico', 'mecanica', 'taller mecanico', 'neumaticos', 'llantas']
  if (hasAnyPhrase(normalized, vehicleTerms)) {
    const repairContext = hasAnyPhrase(normalized, ['arreglar', 'reparar', 'averia', 'mecanico', 'mecanica', 'taller mecanico'])
    return focusScope('vehicle', repairContext ? 'mecanico' : 'vehiculo', repairContext
      ? ['mecanico', 'mecanica', 'taller', 'reparacion de coches']
      : ['coche', 'vehiculo', 'automovil'])
  }

  if (hasAnyPhrase(normalized, ['taxi', 'chofer', 'llevar al aeropuerto', 'traslado aeropuerto', 'transporte de personas'])) {
    return focusScope('transport', includesPhrase(normalized, 'aeropuerto') ? 'aeropuerto' : 'transporte')
  }

  return SCOPE_DEFINITIONS.find(scope => scope.triggers.some(term => includesPhrase(normalized, term))) || null
}

function detectResultIntents(normalized, scope) {
  const offering = ['ofrezco', 'ofrecemos', 'vendo', 'regalo', 'disponible']
    .some(term => includesPhrase(normalized, term))
  const seeking = ['busco', 'buscando', 'necesito', 'quiero', 'compro', 'encontrar']
    .some(term => includesPhrase(normalized, term))

  if (scope?.id === 'marketplace') {
    if (includesPhrase(normalized, 'vendo')) return ['busca']
    if (includesPhrase(normalized, 'regalo')) return ['busca']
    return ['vende', 'regala', 'ofrece']
  }
  if (offering && !seeking) return ['busca']
  const providesSomething = scope?.id !== 'marketplace'
    && scope?.entityTypes?.some(type => ['business', 'ad', 'job'].includes(type))
  if (scope && (seeking || providesSomething)) {
    return ['ofrece']
  }
  return []
}

function extractLanguageNeeds(normalized) {
  const spanishTerms = [
    'que hable espanol', 'habla espanol', 'atencion en espanol', 'atienda en espanol',
    'servicio en espanol', 'en castellano', 'en mi idioma',
  ]
  const germanNoneTerms = [
    'no se aleman', 'no hablo aleman', 'sin aleman', 'solo hablo espanol',
    'no tengo nivel de aleman',
  ]
  const spanishMatched = spanishTerms.find(term => includesPhrase(normalized, term)) || ''
  const germanNoneMatched = germanNoneTerms.find(term => includesPhrase(normalized, term)) || ''
  const spanishRequired = !!spanishMatched

  const germanNone = !!germanNoneMatched
  const germanLevel = normalized.match(/\baleman\s+(a1|a2|b1|b2|c1|c2|basico)\b/)?.[1] || (germanNone ? 'none' : '')

  return { spanishRequired, germanLevel, matched:[spanishMatched, germanNoneMatched].filter(Boolean) }
}

function getMeaningfulTerms(normalized, scope, location, extractedPhrases) {
  let remaining = normalized
  for (const phrase of extractedPhrases.filter(Boolean)) {
    remaining = remaining.replace(normalizeSearchText(phrase), ' ')
  }
  if (location?.matched) remaining = remaining.replace(location.matched, ' ')

  const triggerWords = new Set(
    [...(scope?.triggers || []), ...(scope?.consumedTerms || [])]
      .flatMap(term => normalizeSearchText(term).split(' '))
  )
  return remaining
    .split(/\s+/)
    .filter(token => token.length > 1)
    .filter(token => !/^\d+$/.test(token))
    .filter(token => !ACTION_WORDS.has(token) && !STRUCTURAL_WORDS.has(token) && !triggerWords.has(token))
    .slice(0, 5)
}

function formatCurrency(value) {
  return new Intl.NumberFormat('de-CH', { maximumFractionDigits:2 }).format(value)
}

function formatDetectedDate(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('es-CH', { day:'numeric', month:'short', year:'numeric', timeZone:'UTC' })
    .format(new Date(`${value}T00:00:00Z`))
}

function buildCriteria(parsed) {
  const criteria = []
  if (parsed.scope) criteria.push({ key:'scope', icon:'✨', label:parsed.scope.label })
  if (parsed.resultIntents.includes('ofrece')) criteria.push({ key:'result-intent', icon:'✓', label:'Ofertas disponibles' })
  if (parsed.municipality || parsed.canton) {
    const cityAndCanton = parsed.municipality
      ? `${parsed.municipality}${parsed.canton ? ` · ${parsed.canton}` : ''}`
      : parsed.canton
    criteria.push({ key:'location', icon:'📍', label:cityAndCanton })
  } else if (parsed.postalCode) {
    criteria.push({ key:'postal', icon:'📍', label:`CP ${parsed.postalCode}` })
  }
  if (parsed.priceMin != null && parsed.priceMax != null) criteria.push({ key:'price', icon:'💰', label:`CHF ${formatCurrency(parsed.priceMin)}–${formatCurrency(parsed.priceMax)}` })
  else if (parsed.priceMax != null) criteria.push({ key:'price-max', icon:'💰', label:`Máx. CHF ${formatCurrency(parsed.priceMax)}` })
  else if (parsed.priceMin != null) criteria.push({ key:'price-min', icon:'💰', label:`Desde CHF ${formatCurrency(parsed.priceMin)}` })
  if (parsed.roomsMin != null) criteria.push({ key:'rooms', icon:'🚪', label:`${parsed.roomsMin} hab. mínimo` })
  if (parsed.dateFrom) criteria.push({ key:'date', icon:'📅', label:`Para ${formatDetectedDate(parsed.dateFrom)}` })
  if (parsed.spanishRequired) criteria.push({ key:'spanish', icon:'🗣️', label:'Atención en español' })
  if (parsed.germanLevel === 'none') criteria.push({ key:'german', icon:'🇩🇪', label:'Sin alemán' })
  else if (parsed.germanLevel) criteria.push({ key:'german', icon:'🇩🇪', label:`Alemán ${parsed.germanLevel.toUpperCase()}` })
  return criteria
}

export function parseLatidoAssistantQuery(query, now = new Date()) {
  const originalQuery = String(query || '').trim()
  const normalizedQuery = normalizeSearchText(originalQuery)
  if (normalizedQuery.length < 2) {
    return {
      active:false,
      originalQuery,
      normalizedQuery,
      scope:null,
      category:'',
      entityTypes:[],
      resultIntents:[],
      criteria:[],
      semanticQuery:originalQuery,
      searchTerms:[],
      confidence:0,
      missingFields:[],
    }
  }

  const extractionText = normalizeForExtraction(originalQuery)
  const scope = detectScope(normalizedQuery)
  const price = extractPriceRange(extractionText)
  const rooms = extractRooms(extractionText)
  const date = extractDate(normalizedQuery, now)
  const location = extractLocation(originalQuery, normalizedQuery, price.matched)
  const languageNeeds = extractLanguageNeeds(normalizedQuery)
  const resultIntents = detectResultIntents(normalizedQuery, scope)
  const meaningfulTerms = getMeaningfulTerms(normalizedQuery, scope, location, [
    price.matched,
    rooms.matched,
    date.matched,
    ...languageNeeds.matched,
  ])
  const semanticParts = [...new Set(
    [scope?.semanticSeed, ...meaningfulTerms]
      .filter(Boolean)
      .flatMap(term => normalizeSearchText(term).split(' '))
      .filter(Boolean)
  )]
  const searchTerms = [...new Set([...(scope?.searchTerms || []), ...meaningfulTerms])]

  let confidence = 0.1
  if (scope) confidence += 0.4
  if (location?.municipality || location?.canton || location?.postalCode) confidence += 0.2
  if (price.min != null || price.max != null || rooms.value != null || date.value) confidence += 0.15
  if (resultIntents.length) confidence += 0.1
  if (languageNeeds.spanishRequired || languageNeeds.germanLevel) confidence += 0.05
  confidence = Math.min(confidence, 1)

  const parsed = {
    active:true,
    originalQuery,
    normalizedQuery,
    scope,
    category:scope?.category || '',
    entityTypes:scope?.entityTypes || [],
    resultIntents,
    canton:location?.canton || '',
    municipality:location?.municipality || '',
    postalCode:location?.postalCode || '',
    priceMin:price.min,
    priceMax:price.max,
    roomsMin:rooms.value,
    dateFrom:date.value,
    spanishRequired:languageNeeds.spanishRequired,
    germanLevel:languageNeeds.germanLevel,
    semanticQuery:semanticParts.join(' ').trim() || originalQuery,
    searchTerms,
    confidence,
    missingFields:[],
  }

  if (!scope) parsed.missingFields.push('qué necesitas')
  if (scope && !parsed.canton && !parsed.municipality && !parsed.postalCode) parsed.missingFields.push('ciudad o cantón')
  parsed.criteria = buildCriteria(parsed)
  parsed.hasStructuredCriteria = parsed.criteria.length > 0
  return parsed
}

function normalizeResultLocation(result) {
  const meta = result?.filterMeta || {}
  return normalizeSearchText(`${meta.location || ''} ${meta.canton || ''}`)
}

function canonicalizeCity(value) {
  const normalized = normalizeSearchText(value)
  const record = LOCATION_RECORDS.find(item => includesPhrase(normalized, item.alias))
  return normalizeSearchText(record?.municipality || normalized)
}

function isNationalResult(result) {
  const location = normalizeResultLocation(result)
  return !location || location.includes('toda suiza') || location === 'suiza' || location.includes('nacional')
}

function matchesLocation(result, parsed) {
  const meta = result?.filterMeta || {}
  if (!parsed.canton && !parsed.municipality && !parsed.postalCode) return true
  if (isNationalResult(result)) return true

  if (parsed.postalCode && meta.postalCode && String(meta.postalCode) !== parsed.postalCode) return false
  if (parsed.canton) {
    const resultCanton = String(meta.canton || getCantonForCity(meta.location) || '').toUpperCase()
    if (resultCanton && resultCanton !== parsed.canton) return false
  }
  if (parsed.municipality) {
    const resultCity = canonicalizeCity(meta.city || meta.location)
    const wantedCity = canonicalizeCity(parsed.municipality)
    const hasSpecificResultCity = resultCity && resultCity !== normalizeSearchText(meta.canton)
    if (hasSpecificResultCity && !resultCity.includes(wantedCity)) return false
  }
  return true
}

function containsSpanish(meta) {
  if (meta.spanishSupported === true) return true
  const languages = Array.isArray(meta.languages) ? meta.languages.join(' ') : meta.languages || ''
  const text = normalizeSearchText(`${languages} ${meta.languageText || ''}`)
  return ['espanol', 'spanish', 'castellano'].some(term => text.includes(term))
}

function matchesGermanRequirement(meta, level) {
  if (!level) return true
  const resultLevel = normalizeSearchText(meta.germanLevel || '')
  if (level === 'none') {
    return meta.germanRequired === false || !resultLevel || ['none', 'ninguno', 'sin aleman', 'basic', 'basico', 'a1', 'a2'].includes(resultLevel)
  }
  if (!resultLevel) return true
  const order = ['none', 'basic', 'a1', 'a2', 'b1', 'b2', 'c1', 'c2']
  return order.indexOf(resultLevel) <= order.indexOf(level)
}

function matchesScopeFocus(result, scope) {
  if (!scope?.focusKind) return true
  const meta = result?.filterMeta || {}
  const searchText = normalizeSearchText(meta.searchText || `${result?.label || ''} ${result?.sub || ''}`)
  if (!searchText) return false

  if (scope.focusKind === 'dance') {
    const explicitDanceTerms = ['baile', 'bailar', 'danza', 'bachata', 'tango', 'merengue', 'kizomba', 'zumba', 'reggaeton', 'coreografia']
    if (hasAnyPhrase(searchText, explicitDanceTerms)) return true
    return includesPhrase(searchText, 'salsa')
      && hasAnyPhrase(searchText, ['clase', 'clases', 'noche', 'noches', 'dj', 'musica', 'concierto', 'pista', 'academia', 'escuela'])
  }

  if (scope.focusKind === 'food') {
    return hasAnyPhrase(searchText, scope.focusTerms || [])
      && hasAnyPhrase(searchText, ['comida', 'cocina', 'restaurante', 'tortilla', 'picante', 'receta', 'catering', 'pasteleria', 'panaderia', 'postre'])
  }

  return hasAnyPhrase(searchText, scope.focusTerms || [])
}

export function matchesLatidoAssistantResult(result, parsed) {
  if (!parsed?.active) return true
  const meta = result?.filterMeta || {}

  if (parsed.entityTypes.length && !parsed.entityTypes.includes(result.type)) return false
  if (parsed.category && !meta.categories?.includes(parsed.category)) return false
  if (parsed.resultIntents.length && meta.intent && !parsed.resultIntents.includes(meta.intent)) return false
  if (!matchesScopeFocus(result, parsed.scope)) return false
  if (!matchesLocation(result, parsed)) return false

  const rawAmount = meta.priceAmount ?? meta.salaryAmount
  const amount = rawAmount == null || rawAmount === '' ? Number.NaN : Number(rawAmount)
  if (parsed.priceMin != null && (!Number.isFinite(amount) || amount < parsed.priceMin)) return false
  if (parsed.priceMax != null && (!Number.isFinite(amount) || amount > parsed.priceMax)) return false

  const rooms = meta.rooms == null || meta.rooms === '' ? Number.NaN : Number(meta.rooms)
  if (parsed.roomsMin != null && (!Number.isFinite(rooms) || rooms < parsed.roomsMin)) return false
  if (parsed.dateFrom && (!meta.availableFrom || String(meta.availableFrom).slice(0, 10) > parsed.dateFrom)) return false
  if (parsed.spanishRequired && !containsSpanish(meta)) return false
  if (!matchesGermanRequirement(meta, parsed.germanLevel)) return false

  return true
}

export function buildLatidoSearchRpcParams(parsed, limit = 240) {
  return {
    p_entity_types:parsed.entityTypes.length ? parsed.entityTypes : null,
    p_category:parsed.category || null,
    p_result_intents:parsed.resultIntents.length ? parsed.resultIntents : null,
    p_canton:parsed.canton || null,
    p_municipality:parsed.municipality || null,
    p_postal_code:parsed.postalCode || null,
    p_terms:parsed.searchTerms.length ? parsed.searchTerms : null,
    p_price_min:parsed.priceMin,
    p_price_max:parsed.priceMax,
    p_rooms_min:parsed.roomsMin,
    p_available_on:parsed.dateFrom || null,
    p_spanish_required:parsed.spanishRequired,
    p_german_level:parsed.germanLevel || null,
    p_limit:Math.min(Math.max(Number(limit) || 120, 1), 300),
  }
}

export function parseResultAmount(value) {
  const text = normalizeForExtraction(value)
  const match = text.match(/\b(?:chf|francos?)?\s*(\d{1,3}(?:[.' ]\d{3})+|\d{2,7}(?:[,.]\d{1,2})?)\s*(?:chf|francos?)?\b/)
  return parseSwissNumber(match?.[1])
}

export function parseResultRooms(...values) {
  const parsed = extractRooms(values.filter(Boolean).join(' '))
  return parsed.value
}
