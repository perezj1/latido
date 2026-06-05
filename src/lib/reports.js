import { supabase } from './supabase'

export const REPORT_REASONS = [
  { id: 'fraud', label: 'Fraude, estafa o anuncio falso', description: 'Pagos sospechosos, identidad falsa, oferta inexistente o información engañosa.' },
  { id: 'illegal_content', label: 'Contenido ilegal o peligroso', description: 'Productos, servicios o actividades prohibidas, amenazas o violencia.' },
  { id: 'discrimination', label: 'Discriminación u odio', description: 'Origen, nacionalidad, sexo, religión, edad, discapacidad, orientación o situación familiar.' },
  { id: 'privacy', label: 'Datos personales o privacidad', description: 'Teléfonos, direcciones, fotos privadas o datos de terceros sin permiso.' },
  { id: 'copyright', label: 'Copyright, marca o imagen sin permiso', description: 'Fotos, logos, marcas, textos o imágenes publicados sin autorización.' },
  { id: 'regulated_service', label: 'Servicio regulado o licencia dudosa', description: 'Salud, legal, seguros, finanzas, transporte, construcción, cuidado infantil u otros permisos.' },
  { id: 'employment_housing', label: 'Empleo o vivienda irregular', description: 'Trabajo sin contrato, empleo sin permiso, requisitos discriminatorios o vivienda sospechosa.' },
  { id: 'spam', label: 'Spam o publicidad abusiva', description: 'Contenido repetido, enlaces masivos o promoción no solicitada.' },
  { id: 'abuse', label: 'Acoso, insultos o abuso', description: 'Hostigamiento, difamación, insultos graves o intimidación.' },
  { id: 'other', label: 'Otro motivo', description: 'Cuéntanos qué ocurre para revisarlo.' },
]

export async function reportContent({
  reporterId,
  contentType,
  contentId,
  reason,
  notes = '',
  metadata = {},
}) {
  return supabase.from('reports').insert({
    reporter_id: reporterId,
    content_type: contentType,
    content_id: String(contentId),
    reason,
    notes,
    metadata,
  })
}

export async function addModerationQueueItem({
  contentType,
  contentId,
  authorId,
  reason,
  excerpt,
  matchedTerm = '',
  metadata = {},
}) {
  return supabase.from('moderation_queue').insert({
    content_type: contentType,
    content_id: String(contentId),
    author_id: authorId || null,
    reason,
    excerpt,
    matched_term: matchedTerm,
    metadata,
  })
}
