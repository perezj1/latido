const SEARCH_STOP_WORDS = new Set([
  'a', 'al', 'algo', 'alguien', 'ando', 'atencion', 'atienda', 'atiende', 'atender',
  'ayuda', 'ayudar', 'castellano', 'como', 'compania', 'conseguir', 'cual', 'cuales',
  'cuando', 'de', 'del', 'donde', 'el', 'ella', 'empresa', 'en', 'encontrar', 'encuentro',
  'esa', 'ese', 'espanol', 'especialista', 'esta', 'estar', 'estoy', 'esto', 'experto',
  'favor', 'gustaria', 'habla', 'hablar', 'hable', 'hacer', 'hay', 'informacion', 'la',
  'las', 'lo', 'los', 'me', 'mi', 'mis', 'necesito', 'negocio', 'obtener', 'ofrecer',
  'ofrezca', 'para', 'persona', 'por', 'profesional', 'pueda', 'puede', 'pueden', 'que',
  'quien', 'quiero', 'quisiera', 'sacar', 'se', 'servicio', 'servicios', 'sobre', 'su',
  'sus', 'tema', 'tenga', 'un', 'una', 'unas', 'uno', 'unos', 'urgente', 'ya',
  'busca', 'buscando', 'buscar', 'busco',
])

const INTENT_DEFINITIONS = [
  {
    id:'employment',
    triggers:['empleo', 'trabajo', 'trabajar', 'chamba', 'curro', 'vacante'],
    consumed:['laboral', 'oferta', 'oportunidad', 'puesto'],
    terms:['empleo', 'trabajo', 'vacante', 'oferta laboral', 'puesto', 'job', 'reclutamiento'],
  },
  {
    id:'cleaning',
    triggers:['limpiar', 'limpieza', 'aseo', 'fregar', 'barrer', 'reinigung', 'cleaning'],
    consumed:['apartamento', 'bano', 'casa', 'cocina', 'cristal', 'oficina', 'piso', 'suelo', 'ventana'],
    terms:['limpieza', 'limpiar', 'aseo', 'servicio domestico', 'cleaning', 'reinigung', 'hauswartung'],
  },
  {
    id:'translation',
    triggers:['traducir', 'traduccion', 'traductor', 'interprete', 'interpretacion'],
    consumed:['acta', 'carta', 'certificado', 'documento', 'oficial', 'papel', 'jurada', 'jurado'],
    terms:['traduccion', 'traducir', 'traductor', 'interprete', 'interpretacion', 'traduccion jurada'],
  },
  {
    id:'moving',
    triggers:['mudanza', 'mudar', 'traslado', 'umzug'],
    consumed:['casa', 'mueble', 'piso'],
    terms:['mudanza', 'mudanzas', 'traslado', 'transporte de muebles', 'umzug'],
  },
  {
    id:'repairs',
    triggers:['arreglar', 'averia', 'reparacion', 'reparar', 'fontanero', 'electricista'],
    consumed:['casa', 'piso'],
    terms:['reparacion', 'mantenimiento', 'fontanero', 'electricista', 'handwerker'],
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
    triggers:['alquiler', 'alquilar', 'arrendar', 'habitacion', 'apartamento', 'vivienda', 'sublet'],
    consumed:['casa', 'piso', 'cuarto'],
    terms:['alquiler', 'alquilar', 'habitacion', 'apartamento', 'vivienda', 'piso', 'sublet'],
  },
  {
    id:'health',
    triggers:['dentista', 'medico', 'psicologo', 'psicologa', 'fisioterapia', 'terapia', 'salud'],
    consumed:['cita', 'consulta'],
    terms:['dentista', 'medico', 'psicologia', 'psicologo', 'fisioterapia', 'terapia', 'salud'],
  },
  {
    id:'beauty',
    triggers:['peluqueria', 'peluquero', 'peluquera', 'barberia', 'barbero', 'unas', 'maquillaje'],
    consumed:['cabello', 'corte', 'pelo'],
    terms:['peluqueria', 'peluquero', 'barberia', 'barbero', 'estetica', 'belleza', 'unas', 'maquillaje'],
  },
  {
    id:'food',
    triggers:['comer', 'comida', 'restaurante', 'catering', 'pastel', 'torta'],
    consumed:['domicilio', 'llevar'],
    terms:['comida', 'restaurante', 'cocina', 'catering', 'pasteleria', 'pastel', 'delivery'],
  },
  {
    id:'vehicle',
    triggers:['coche', 'carro', 'auto', 'vehiculo', 'mecanico', 'taller'],
    consumed:['comprar', 'reparar', 'vender'],
    terms:['coche', 'vehiculo', 'mecanico', 'mecanica', 'taller', 'automovil'],
  },
  {
    id:'marketplace',
    triggers:['comprar', 'vender', 'regalar', 'segunda mano'],
    consumed:['articulo', 'objeto'],
    terms:['comprar', 'venta', 'vendo', 'regalo', 'mercado', 'segunda mano'],
  },
]

export function normalizeSearchText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function getWords(value) {
  const normalized = normalizeSearchText(value)
  return normalized ? normalized.split(' ') : []
}

function wordsAreRelated(left, right) {
  if (!left || !right) return false
  if (left === right) return true

  const shortestLength = Math.min(left.length, right.length)
  if (shortestLength < 4) return false

  const leftForms = new Set([
    left,
    ...(left.endsWith('s') ? [left.slice(0, -1)] : []),
    ...(left.endsWith('es') ? [left.slice(0, -2)] : []),
  ])
  const rightForms = new Set([
    right,
    ...(right.endsWith('s') ? [right.slice(0, -1)] : []),
    ...(right.endsWith('es') ? [right.slice(0, -2)] : []),
  ])
  if ([...leftForms].some(form => rightForms.has(form))) return true

  const canonicalLeft = left.replace(/^traduz/, 'traduc')
  const canonicalRight = right.replace(/^traduz/, 'traduc')
  const controlledFamilies = ['limpi', 'traduc', 'repara']
  if (controlledFamilies.some(stem => canonicalLeft.startsWith(stem) && canonicalRight.startsWith(stem))) {
    return true
  }

  return shortestLength >= 6 && (
    canonicalLeft.startsWith(canonicalRight) || canonicalRight.startsWith(canonicalLeft)
  )
}

function valueMatchesTerm(value, term) {
  const normalizedTerm = normalizeSearchText(term)
  if (!value || !normalizedTerm) return false

  const valueWords = value.split(' ')
  const termWords = normalizedTerm.split(' ')
  return termWords.every(termWord => valueWords.some(valueWord => wordsAreRelated(termWord, valueWord)))
}

function tokenMatchesAny(token, values) {
  return values.some(value => getWords(value).some(word => wordsAreRelated(token, word)))
}

export function buildSearchProfile(query) {
  const normalized = normalizeSearchText(query)
  const allTokens = getWords(normalized)
  const tokens = allTokens.filter(token => token.length > 1 && !SEARCH_STOP_WORDS.has(token))
  const intents = INTENT_DEFINITIONS.filter(intent => (
    intent.triggers.some(trigger => valueMatchesTerm(normalized, trigger))
  ))
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

export function scoreSearchFields(profile, fields) {
  if (!profile?.normalized || profile.normalized.length < 2) return 0

  const normalizedFields = normalizeFields(fields)
  if (!normalizedFields.length) return 0

  const directWeights = profile.tokens.map(token => getBestMatchWeight(token, normalizedFields))
  const directMatches = directWeights.filter(Boolean).length
  const requiredMatches = profile.requiredTokens.filter(token => getBestMatchWeight(token, normalizedFields) > 0).length
  const intentWeights = profile.intents.map(intent => (
    Math.max(...intent.terms.map(term => getBestMatchWeight(term, normalizedFields)), 0)
  ))
  const matchedIntents = intentWeights.filter(Boolean).length

  if (profile.intents.length > 0 && matchedIntents < profile.intents.length) return 0
  if (profile.requiredTokens.length > 0 && requiredMatches < Math.ceil(profile.requiredTokens.length * 0.6)) return 0
  if (profile.intents.length === 0 && directMatches < Math.max(1, Math.ceil(profile.tokens.length * 0.6))) return 0
  if (profile.tokens.length === 0 && matchedIntents === 0) return 0

  let score = 0
  for (const field of normalizedFields) {
    if (field.value.includes(profile.normalized)) score += 30 * field.weight
  }

  score += directWeights.reduce((total, weight) => total + (weight * 12), 0)
  score += intentWeights.reduce((total, weight) => total + 24 + (weight * 8), 0)
  score += Math.round((directMatches / Math.max(profile.tokens.length, 1)) * 20)
  score += requiredMatches * 8

  return score
}

export function profileHasIntent(profile, intentId) {
  return !!profile?.intents?.some(intent => intent.id === intentId)
}
