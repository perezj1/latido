const SEARCH_STOP_WORDS = new Set([
  'a', 'al', 'algo', 'alguien', 'ando', 'atencion', 'atienda', 'atiende', 'atender',
  'ayuda', 'ayudar', 'castellano', 'como', 'compania', 'conseguir', 'cual', 'cuales',
  'cuando', 'de', 'del', 'donde', 'el', 'ella', 'empresa', 'en', 'encontrar', 'encuentro',
  'esa', 'ese', 'espanol', 'especialista', 'esta', 'estar', 'estoy', 'esto', 'experto',
  'favor', 'gustaria', 'habla', 'hablar', 'hable', 'hacer', 'hay', 'informacion', 'la',
  'las', 'lo', 'los', 'me', 'mi', 'mis', 'necesito', 'negocio', 'obtener', 'ofrecer',
  'ofrezca', 'para', 'persona', 'por', 'profesional', 'pueda', 'puede', 'pueden', 'que',
  'quien', 'quiero', 'quisiera', 'sacar', 'se', 'sobre', 'su',
  'sus', 'tema', 'tenga', 'un', 'una', 'unas', 'uno', 'unos', 'urgente', 'ya',
  'busca', 'buscando', 'buscar', 'busco', 'comprar', 'compro', 'contratar', 'contrato',
  'curar', 'curarme', 'encargar', 'encargo', 'pedir', 'pido', 'reservar', 'reservo',
])

const HOME_SERVICE_EXCLUDED_TERMS = [
  'personalberater', 'agencia de colocacion', 'empresa de trabajo temporal',
  'oportunidad laboral', 'oportunidades laborales', 'oferta laboral', 'vacante',
  'reclutamiento', 'incorporar personal', 'buscas una oportunidad', 'busca trabajadores',
]

const INTENT_DEFINITIONS = [
  {
    id:'employment',
    triggers:[
      'empleo', 'trabajo', 'trabajar', 'chamba', 'curro', 'vacante',
      'emprego', 'trabalho', 'trabalhar', 'stelle', 'arbeit', 'emploi', 'lavoro',
    ],
    consumed:['laboral', 'oferta', 'oportunidad', 'puesto'],
    terms:['empleo', 'trabajo', 'vacante', 'oferta laboral', 'puesto', 'job', 'reclutamiento', 'emprego', 'trabalho', 'stelle', 'arbeit', 'emploi', 'lavoro'],
  },
  {
    id:'construction',
    triggers:['construccion', 'obra', 'albanil', 'maestro de obra', 'bau', 'baustelle', 'construction'],
    consumed:['trabajo', 'empleo', 'puesto', 'sector'],
    terms:['construccion', 'obra', 'albanil', 'reformas', 'bau', 'baustelle', 'construction'],
  },
  {
    id:'cleaning',
    triggers:['limpiar', 'limpieza', 'aseo', 'fregar', 'barrer', 'reinigung', 'cleaning', 'limpeza', 'nettoyage', 'pulizia'],
    consumed:['apartamento', 'bano', 'casa', 'cocina', 'cristal', 'oficina', 'piso', 'suelo', 'ventana'],
    terms:['limpieza', 'limpiar', 'aseo', 'servicio domestico', 'cleaning', 'reinigung', 'hauswartung', 'limpeza', 'nettoyage', 'pulizia'],
  },
  {
    id:'translation',
    triggers:['traducir', 'traduccion', 'traductor', 'interprete', 'interpretacion'],
    consumed:['acta', 'carta', 'certificado', 'documento', 'oficial', 'papel', 'jurada', 'jurado'],
    terms:['traduccion', 'traducir', 'traductor', 'interprete', 'interpretacion', 'traduccion jurada'],
  },
  {
    id:'moving',
    triggers:['mudanza', 'mudar', 'traslado', 'umzug', 'mudanca', 'demenagement', 'trasloco'],
    consumed:['casa', 'mueble', 'piso'],
    terms:['mudanza', 'mudanzas', 'traslado', 'transporte de muebles', 'umzug', 'mudanca', 'demenagement', 'trasloco'],
  },
  {
    id:'plumbing',
    triggers:[
      'fontanero', 'fontaneria', 'plomero', 'plomeria',
      'reparar ducha', 'arreglar ducha', 'instalar ducha', 'cambiar grifo',
      'fuga de agua', 'tuberia rota', 'desatascar desague',
    ],
    consumed:['ducha', 'banera', 'grifo', 'tuberia', 'caneria', 'fuga', 'agua', 'lavabo', 'inodoro', 'cisterna', 'desague'],
    terms:['fontanero', 'fontaneria', 'plomero', 'plomeria', 'instalacion sanitaria', 'tuberia', 'desague'],
    fallbackTerms:['manitas', 'handyman', 'bricolaje', 'reparaciones hogar', 'reparaciones varias', 'arreglos generales'],
    excludedTerms:HOME_SERVICE_EXCLUDED_TERMS,
  },
  {
    id:'electrical',
    triggers:[
      'electricista', 'electricidad', 'instalacion electrica',
      'reparar enchufe', 'arreglar enchufe', 'cortocircuito', 'cuadro electrico',
    ],
    consumed:['enchufe', 'interruptor', 'fusible', 'lampara', 'cable', 'corriente'],
    terms:['electricista', 'electricidad', 'instalacion electrica', 'enchufe', 'cortocircuito', 'cuadro electrico'],
  },
  {
    id:'locksmith',
    triggers:['cerrajero', 'cerrajeria', 'cambiar cerradura', 'reparar cerradura', 'llave rota', 'puerta bloqueada'],
    consumed:['cerradura', 'llave', 'puerta'],
    terms:['cerrajero', 'cerrajeria', 'cerradura', 'apertura de puertas', 'llaves'],
  },
  {
    id:'painting',
    triggers:['pintor', 'pintura de paredes', 'pintar pared', 'pintar techo', 'pintar casa'],
    consumed:['pared', 'paredes', 'techo', 'casa', 'habitacion'],
    terms:['pintor', 'pintura', 'pintura interior', 'pintura exterior', 'maler'],
  },
  {
    id:'carpentry',
    triggers:['carpintero', 'carpinteria', 'reparar mueble', 'montar mueble', 'montar armario', 'reparar puerta'],
    consumed:['mueble', 'muebles', 'armario', 'puerta', 'madera', 'parquet'],
    terms:['carpintero', 'carpinteria', 'muebles', 'madera', 'montaje de muebles', 'schreiner'],
  },
  {
    id:'gardening',
    triggers:['jardinero', 'jardinera', 'jardineria', 'paisajista', 'paisajismo', 'podar arbol', 'cortar cesped', 'gartenbau', 'gartenpflege', 'gartner'],
    consumed:['jardin', 'jardines', 'cesped', 'seto', 'setos', 'arbol', 'arboles', 'plantas'],
    terms:['jardinero', 'jardinera', 'jardineria', 'paisajista', 'paisajismo', 'mantenimiento jardines', 'cuidado jardines', 'poda arboles', 'cortar cesped', 'gartenbau', 'gartenpflege', 'gartner'],
    fallbackTerms:['manitas', 'handyman'],
    excludedTerms:HOME_SERVICE_EXCLUDED_TERMS,
  },
  {
    id:'appliance_repair',
    triggers:[
      'tecnico electrodomesticos', 'reparacion electrodomesticos',
      'reparar lavadora', 'lavadora rota', 'reparar lavavajillas', 'reparar nevera', 'reparar frigorifico',
    ],
    consumed:['electrodomestico', 'electrodomesticos', 'lavadora', 'lavavajillas', 'secadora', 'nevera', 'frigorifico', 'horno'],
    terms:['tecnico electrodomesticos', 'reparacion electrodomesticos', 'servicio tecnico', 'lavadora', 'lavavajillas', 'nevera', 'frigorifico'],
  },
  {
    id:'repairs',
    triggers:['arreglar', 'averia', 'reparacion', 'reparar', 'bricolaje', 'manitas'],
    consumed:['casa', 'piso', 'mueble', 'lampara'],
    terms:[
      'reparacion', 'mantenimiento', 'fontanero', 'fontaneria', 'plomero', 'plomeria',
      'electricista', 'electricidad', 'pintor', 'pintura', 'cerrajero', 'cerrajeria',
      'cerradura', 'bricolaje', 'manitas', 'carpinteria', 'montaje de muebles',
      'servicio tecnico', 'electrodomesticos', 'calefaccion', 'handwerker',
    ],
  },
  {
    id:'childcare',
    triggers:['ninera', 'ninero', 'canguro', 'guarderia', 'aupair'],
    consumed:['bebe', 'hija', 'hijo', 'nina', 'nino'],
    terms:['cuidado de ninos', 'ninera', 'ninero', 'canguro', 'guarderia', 'au pair', 'kita'],
  },
  {
    id:'eldercare',
    triggers:['anciano', 'anciana', 'personas mayores', 'cuidado mayor', 'cuidar mayor', 'spitex'],
    consumed:['cuidar', 'cuidado', 'persona'],
    terms:['cuidado de mayores', 'asistencia personal', 'cuidador', 'cuidadora', 'spitex'],
  },
  {
    id:'paperwork',
    triggers:['tramite', 'gestoria', 'permiso', 'apostilla', 'impuesto', 'declaracion'],
    consumed:['carta', 'documento', 'papel', 'suiza'],
    terms:['tramite', 'gestoria', 'permiso', 'apostilla', 'impuesto', 'declaracion fiscal', 'seguro', 'asesoria'],
  },
  {
    id:'housing',
    triggers:['alquiler', 'alquilar', 'arrendar', 'habitacion', 'apartamento', 'departamento', 'vivienda', 'sublet', 'wohnung', 'zimmer', 'logement', 'moradia'],
    consumed:['casa', 'piso', 'cuarto'],
    terms:['alquiler', 'alquilar', 'habitacion', 'apartamento', 'departamento', 'vivienda', 'piso', 'sublet', 'wohnung', 'zimmer', 'logement', 'moradia'],
  },
  {
    id:'health',
    triggers:['dentista', 'medico', 'psicologo', 'psicologa', 'fisioterapia', 'terapia', 'salud', 'odontologo', 'odontologia', 'muela', 'diente', 'caries', 'ortodoncia'],
    consumed:['cita', 'consulta', 'muelas', 'dientes', 'encias', 'dolor'],
    terms:['dentista', 'odontologia', 'clinica dental', 'medico', 'psicologia', 'psicologo', 'fisioterapia', 'terapia', 'salud'],
  },
  {
    id:'beauty',
    triggers:['peluqueria', 'peluquero', 'peluquera', 'barberia', 'barbero', 'unas', 'maquillaje', 'manicura', 'pedicura', 'depilacion', 'masaje'],
    consumed:['cabello', 'corte', 'pelo'],
    terms:['peluqueria', 'peluquero', 'barberia', 'barbero', 'estetica', 'belleza', 'unas', 'maquillaje', 'manicura', 'pedicura', 'depilacion', 'masaje'],
  },
  {
    id:'dance',
    triggers:['bailar', 'baile', 'danza', 'bachata', 'tango', 'merengue', 'kizomba', 'zumba', 'coreografia'],
    consumed:['clase', 'clases', 'aprender', 'salsa', 'reggaeton'],
    terms:['baile', 'bailar', 'danza', 'salsa', 'bachata', 'tango', 'merengue', 'kizomba', 'zumba', 'coreografia'],
  },
  {
    id:'food',
    triggers:['comer', 'comida', 'restaurante', 'restaurantes', 'catering', 'pastel', 'torta', 'tarta', 'pasteleria', 'reposteria', 'panaderia', 'cupcake', 'postre'],
    consumed:['domicilio', 'llevar', 'pasteles', 'tartas', 'tortas', 'cupcakes'],
    terms:['comida', 'restaurante', 'restaurantes', 'gastronomia', 'catering', 'pasteleria', 'reposteria', 'pastel', 'tarta', 'torta', 'panaderia', 'cupcake', 'postre', 'delivery'],
  },
  {
    id:'education',
    triggers:['aprender', 'clase', 'clases', 'curso', 'cursos', 'profesor', 'profesora', 'academia', 'formacion'],
    consumed:['ensenar', 'ensenanza', 'estudiar'],
    terms:['clase', 'clases', 'curso', 'profesor', 'profesora', 'academia', 'formacion', 'taller'],
  },
  {
    id:'vehicle',
    triggers:['coche', 'coches', 'carro', 'carros', 'auto', 'autos', 'automovil', 'automoviles', 'vehiculo', 'vehiculos', 'moto', 'motos', 'motocicleta', 'motocicletas', 'motociclo', 'motociclos', 'scooter', 'scooters', 'ciclomotor', 'ciclomotores', 'mecanico', 'taller'],
    consumed:['comprar', 'reparar', 'vender'],
    terms:['coche', 'coches', 'carro', 'carros', 'auto', 'autos', 'automovil', 'automoviles', 'vehiculo', 'vehiculos', 'moto', 'motos', 'motocicleta', 'motocicletas', 'motociclo', 'motociclos', 'scooter', 'scooters', 'ciclomotor', 'ciclomotores', 'mecanico', 'mecanica', 'taller'],
  },
  {
    id:'transport',
    triggers:['taxi', 'chofer', 'conductor', 'chauffeur', 'motorista', 'aeropuerto', 'transporte de personas'],
    consumed:['llevar', 'recoger', 'traslado'],
    terms:['taxi', 'chofer', 'conductor', 'chauffeur', 'motorista', 'aeropuerto', 'transporte', 'traslado'],
  },
  {
    id:'marketplace',
    triggers:['comprar', 'vender', 'regalar', 'segunda mano'],
    consumed:['articulo', 'objeto'],
    terms:['comprar', 'venta', 'vendo', 'regalo', 'mercado', 'segunda mano'],
  },
]

const NORMALIZED_TEXT_CACHE = new Map()
const SEARCH_WORDS_CACHE = new Map()
const SEARCH_WORD_PROFILE_CACHE = new Map()
const RELATED_WORDS_CACHE = new Map()
const TEXT_CACHE_LIMIT = 12_000
const RELATED_WORDS_CACHE_LIMIT = 30_000

function rememberInCache(cache, key, value, limit) {
  if (cache.size >= limit) {
    cache.delete(cache.keys().next().value)
  }
  cache.set(key, value)
  return value
}

export function normalizeSearchText(value = '') {
  const rawValue = String(value || '')
  const cached = NORMALIZED_TEXT_CACHE.get(rawValue)
  if (cached !== undefined) return cached

  const normalized = rawValue
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')

  return rememberInCache(NORMALIZED_TEXT_CACHE, rawValue, normalized, TEXT_CACHE_LIMIT)
}

function getWords(value) {
  const normalized = normalizeSearchText(value)
  if (!normalized) return []

  const cached = SEARCH_WORDS_CACHE.get(normalized)
  if (cached) return cached

  return rememberInCache(SEARCH_WORDS_CACHE, normalized, normalized.split(' '), TEXT_CACHE_LIMIT)
}

function getWordForms(word) {
  return [
    word,
    ...(word.endsWith('s') ? [word.slice(0, -1)] : []),
    ...(word.endsWith('es') ? [word.slice(0, -2)] : []),
  ]
}

function getWordProfile(value) {
  const normalized = normalizeSearchText(value)
  if (!normalized) return null

  const cached = SEARCH_WORD_PROFILE_CACHE.get(normalized)
  if (cached) return cached

  const words = getWords(normalized)
  const forms = new Set()
  const byPrefix = new Map()
  for (const word of words) {
    getWordForms(word).forEach(form => forms.add(form))
    const prefix = word.slice(0, 2)
    const prefixedWords = byPrefix.get(prefix)
    if (prefixedWords) prefixedWords.push(word)
    else byPrefix.set(prefix, [word])
  }

  return rememberInCache(
    SEARCH_WORD_PROFILE_CACHE,
    normalized,
    { words, forms, byPrefix },
    TEXT_CACHE_LIMIT,
  )
}

function boundedEditDistance(left, right, limit) {
  if (left === right) return 0
  if (Math.abs(left.length - right.length) > limit) return limit + 1

  let previous = Array.from({ length:right.length + 1 }, (_, index) => index)
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex]
    let rowMinimum = current[0]

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitution = previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1)
      const insertion = current[rightIndex - 1] + 1
      const deletion = previous[rightIndex] + 1
      current[rightIndex] = Math.min(substitution, insertion, deletion)
      rowMinimum = Math.min(rowMinimum, current[rightIndex])
    }

    if (rowMinimum > limit) return limit + 1
    previous = current
  }

  return previous[right.length]
}

function computeWordsAreRelated(left, right) {
  if (!left || !right) return false
  if (left === right) return true

  const shortestLength = Math.min(left.length, right.length)
  if (shortestLength < 4) return false

  const leftForms = new Set(getWordForms(left))
  const rightForms = new Set(getWordForms(right))
  if ([...leftForms].some(form => rightForms.has(form))) return true

  const canonicalLeft = left.replace(/^traduz/, 'traduc')
  const canonicalRight = right.replace(/^traduz/, 'traduc')
  const controlledFamilies = ['limpi', 'traduc', 'repara']
  if (controlledFamilies.some(stem => canonicalLeft.startsWith(stem) && canonicalRight.startsWith(stem))) {
    return true
  }

  const isProfessionalSuffixExtension = (longer, shorter) => (
    shorter.length >= 5
    && longer.startsWith(shorter)
    && ['ero', 'era', 'eria'].some(suffix => longer.endsWith(suffix))
  )
  if (isProfessionalSuffixExtension(canonicalLeft, canonicalRight)
    || isProfessionalSuffixExtension(canonicalRight, canonicalLeft)) {
    return false
  }

  const fuzzyLimit = shortestLength >= 9 ? 2 : shortestLength >= 6 ? 1 : 0
  if (
    fuzzyLimit > 0
    && canonicalLeft.slice(0, 2) === canonicalRight.slice(0, 2)
    && boundedEditDistance(canonicalLeft, canonicalRight, fuzzyLimit) <= fuzzyLimit
  ) {
    return true
  }

  return shortestLength >= 6 && (
    canonicalLeft.startsWith(canonicalRight) || canonicalRight.startsWith(canonicalLeft)
  )
}

function wordsAreRelated(left, right) {
  if (!left || !right) return false
  if (left === right) return true

  const cacheKey = left < right ? `${left}\u0000${right}` : `${right}\u0000${left}`
  if (RELATED_WORDS_CACHE.has(cacheKey)) return RELATED_WORDS_CACHE.get(cacheKey)

  return rememberInCache(
    RELATED_WORDS_CACHE,
    cacheKey,
    computeWordsAreRelated(left, right),
    RELATED_WORDS_CACHE_LIMIT,
  )
}

function valueMatchesTerm(value, term) {
  const normalizedTerm = normalizeSearchText(term)
  if (!value || !normalizedTerm) return false

  const valueProfile = getWordProfile(value)
  if (!valueProfile) return false

  const termWords = getWords(normalizedTerm)
  return termWords.every(termWord => {
    if (getWordForms(termWord).some(form => valueProfile.forms.has(form))) return true

    const candidates = valueProfile.byPrefix.get(termWord.slice(0, 2)) || []
    return candidates.some(valueWord => wordsAreRelated(termWord, valueWord))
  })
}

function tokenMatchesAny(token, values) {
  return values.some(value => getWords(value).some(word => wordsAreRelated(token, word)))
}

export function buildSearchProfile(query) {
  const normalized = normalizeSearchText(query)
  const allTokens = getWords(normalized)
  const tokens = allTokens.filter(token => token.length > 1 && !SEARCH_STOP_WORDS.has(token))
  const matchedIntents = INTENT_DEFINITIONS.filter(intent => (
    intent.triggers.some(trigger => valueMatchesTerm(normalized, trigger))
  ))
  const hasSpecificIntent = matchedIntents.some(intent => intent.id !== 'marketplace')
  const intents = hasSpecificIntent
    ? matchedIntents.filter(intent => intent.id !== 'marketplace')
    : matchedIntents
  const consumedTerms = intents.flatMap(intent => [...intent.triggers, ...(intent.consumed || [])])
  const requiredTokens = tokens.filter(token => !tokenMatchesAny(token, consumedTerms))

  return { normalized, tokens, intents, requiredTokens }
}

function normalizeFields(fields) {
  return fields
    .map(field => typeof field === 'object' && field !== null
      ? { value:normalizeSearchText(field.value), weight:Number(field.weight) || 1 }
      : { value:normalizeSearchText(field), weight:1 })
    .filter(field => field.value)
}

function getBestMatchWeight(term, fields) {
  let bestWeight = 0
  for (const field of fields) {
    if (valueMatchesTerm(field.value, term)) bestWeight = Math.max(bestWeight, field.weight)
  }
  return bestWeight
}

export function scoreSearchFields(profile, fields, { allowIntentFallback = false } = {}) {
  if (!profile?.normalized || profile.normalized.length < 2) return 0

  const normalizedFields = normalizeFields(fields)
  if (!normalizedFields.length) return 0

  const directWeights = profile.tokens.map(token => getBestMatchWeight(token, normalizedFields))
  const directWeightByToken = new Map(
    profile.tokens.map((token, index) => [token, directWeights[index]])
  )
  const directMatches = directWeights.filter(Boolean).length
  const requiredMatches = profile.requiredTokens.filter(token => (
    (directWeightByToken.has(token)
      ? directWeightByToken.get(token)
      : getBestMatchWeight(token, normalizedFields)) > 0
  )).length
  const exactIntentWeights = profile.intents.map(intent => (
    Math.max(...intent.terms.map(term => getBestMatchWeight(term, normalizedFields)), 0)
  ))
  const fallbackIntentWeights = profile.intents.map((intent, index) => (
    allowIntentFallback && !exactIntentWeights[index] && intent.fallbackTerms?.length
      ? Math.max(...intent.fallbackTerms.map(term => getBestMatchWeight(term, normalizedFields)), 0)
      : 0
  ))
  const intentWeights = exactIntentWeights.map((weight, index) => weight || fallbackIntentWeights[index])
  const matchedIntents = intentWeights.filter(Boolean).length

  const hasExcludedIntentTerm = profile.intents.some(intent => (
    intent.excludedTerms?.some(term => getBestMatchWeight(term, normalizedFields) > 0)
  ))
  if (hasExcludedIntentTerm) return 0

  if (profile.intents.length > 0 && matchedIntents < profile.intents.length) return 0
  if (profile.requiredTokens.length > 0 && requiredMatches < Math.ceil(profile.requiredTokens.length * 0.7)) return 0
  if (profile.intents.length === 0 && directMatches < Math.max(1, Math.ceil(profile.tokens.length * 0.7))) return 0
  if (profile.tokens.length === 0 && matchedIntents === 0) return 0

  let score = 0
  for (const field of normalizedFields) {
    if (field.value.includes(profile.normalized)) score += 30 * field.weight
  }

  score += directWeights.reduce((total, weight) => total + (weight * 12), 0)
  score += exactIntentWeights.reduce((total, weight) => total + (weight ? 24 + (weight * 8) : 0), 0)
  score += fallbackIntentWeights.reduce((total, weight) => total + (weight ? 8 + (weight * 3) : 0), 0)
  score += Math.round((directMatches / Math.max(profile.tokens.length, 1)) * 20)
  score += requiredMatches * 8

  return score
}

export function profileHasIntent(profile, intentId) {
  return !!profile?.intents?.some(intent => intent.id === intentId)
}
