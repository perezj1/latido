const BLOCKED_TERMS = [
  'escort',
  'onlyfans',
  'porn',
  'porno',
  'sexo por dinero',
  'masajes con final',
  'servicios sexuales',
  'prostitucion',
  'prostitución',
  'cocaina',
  'cocaína',
  'vendo droga',
  'venta de droga',
  'armas de fuego',
  'pistola',
  'municion',
  'munición',
  'documentos falsos',
  'pasaporte falso',
  'permiso falso',
  'visado falso',
  'certificado falso',
  'contrato falso',
  'receta falsa',
  'medicamentos sin receta',
  'licencia falsa',
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
  'deposito antes de ver',
  'depósito antes de ver',
  'reserva antes de visitar',
  'sin ver el piso',
  'paga primero',
  'pago solo en efectivo',
  'solo efectivo',
  'trabajo en negro',
  'sin contrato',
  'sin permiso de trabajo',
  'no hace falta permiso',
  'pagamos en efectivo',
  'solo mujeres',
  'solo hombres',
  'no extranjeros',
  'solo españoles',
  'solo espanoles',
  'no familias',
  'sin niños',
  'sin ninos',
  'joven y guapa',
  'garantizo permiso',
  'permiso garantizado',
  'trabajo garantizado',
  'abogado sin licencia',
  'asesoria legal garantizada',
  'asesoría legal garantizada',
  'prestamo urgente',
  'préstamo urgente',
  'sin requisitos',
  'inversion sin riesgo',
  'inversión sin riesgo',
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
    return 'Por seguridad legal, este contenido necesita revisión antes de publicarse.'
  }
  return 'El contenido incluye términos no permitidos por las reglas de Latido.'
}
