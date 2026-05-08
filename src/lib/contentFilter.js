const BLOCKED_TERMS = [
  'escort',
  'onlyfans',
  'porn',
  'porno',
  'sexo por dinero',
  'masajes con final',
]

const SUSPICIOUS_TERMS = [
  'western union',
  'moneygram',
  'pago por adelantado',
  'deposito por adelantado',
  'envia dinero',
  'enviar dinero',
  'anticipo',
  'transferencia urgente',
  'gana dinero facil',
  'inversion garantizada',
  'crypto garantizado',
  'bitcoin garantizado',
]

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[0@]/g, 'o')
    .replace(/[1!|]/g, 'i')
    .replace(/[3]/g, 'e')
    .replace(/[4]/g, 'a')
    .replace(/[5$]/g, 's')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim()
}

function findTerm(text, terms) {
  return terms.find(term => text.includes(normalizeText(term))) || ''
}

export function analyzeContent(...fields) {
  const text = normalizeText(fields.filter(Boolean).join(' '))
  if (!text) return { action: 'allow', matchedTerm: '' }

  const blocked = findTerm(text, BLOCKED_TERMS)
  if (blocked) return { action: 'block', matchedTerm: blocked }

  const suspicious = findTerm(text, SUSPICIOUS_TERMS)
  if (suspicious) return { action: 'review', matchedTerm: suspicious }

  return { action: 'allow', matchedTerm: '' }
}

export function shouldBlockContent(...fields) {
  return analyzeContent(...fields).action !== 'allow'
}

export function getContentFilterMessage(result) {
  if (result?.action === 'review') {
    return 'Por seguridad, este contenido necesita revision antes de publicarse.'
  }
  return 'El contenido contiene terminos no permitidos.'
}
