// Main categories and grouped services from SERVICIOS PUNTO HISPANO.pdf.
// Keep the database catalogue in punto_hispano_contacts.sql in sync.
export const PUNTO_HISPANO_SERVICES = [
  { id:'gestoria', label:'Gestoría y asesoría', services:[
    { id:'rav', label:'Desempleo y RAV' },
    { id:'tramites', label:'Trámites y acompañamientos' },
    { id:'impuestos', label:'Impuestos y contabilidad' },
    { id:'empresas', label:'Creación de empresas' },
    { id:'cv', label:'CV y cartas de presentación' },
    { id:'legal', label:'Asesoría legal' },
    { id:'traducciones', label:'Traducciones generales y oficiales' },
  ] },
  { id:'idiomas', label:'Idiomas', services:[
    { id:'aleman', label:'Alemán (A1–C1)' },
    { id:'ingles', label:'Inglés (A1–C1)' },
  ] },
  { id:'seguros', label:'Seguros y pensiones', services:[
    { id:'salud', label:'Salud y complementarios' },
    { id:'hogar', label:'Hogar, vehículos y viajes' },
    { id:'pensiones', label:'Vida y pensiones (pilares)' },
    { id:'empresa', label:'Seguros de empresa' },
    { id:'prestaciones', label:'Ayudas familiares, primas y baja laboral' },
    { id:'polizas', label:'Revisión de pólizas y reclamaciones' },
  ] },
  { id:'alquiler', label:'Vehículos y mudanzas', services:[
    { id:'coches', label:'Alquiler de coches' },
    { id:'furgonetas', label:'Alquiler de furgonetas' },
    { id:'mudanzas', label:'Mudanzas' },
  ] },
  { id:'vivienda', label:'Vivienda', services:[
    { id:'buscar', label:'Alquiler de pisos y habitaciones' },
    { id:'contratos', label:'Contratos y depósitos' },
    { id:'gestion', label:'Gestión y mantenimiento' },
    { id:'limpieza', label:'Mudanza y limpieza' },
  ] },
  { id:'relocation', label:'Llegada a Suiza y retorno', services:[
    { id:'llegada', label:'Pack de llegada e integración' },
    { id:'permisos', label:'Permisos y registro en Suiza' },
    { id:'instalacion', label:'Vivienda, banco y servicios básicos' },
    { id:'retorno', label:'Pack de retorno al país de origen' },
  ] },
  { id:'digital', label:'Soluciones digitales', services:[
    { id:'web', label:'Páginas web y tiendas online' },
    { id:'crm', label:'Gestión de clientes (CRM)' },
    { id:'ia', label:'Inteligencia artificial y automatización' },
    { id:'marketing', label:'Marketing y redes sociales' },
    { id:'apps', label:'Apps y proyectos personalizados' },
    { id:'soporte', label:'Consultoría y soporte digital' },
  ] },
]

export function getPuntoHispanoService(categoryId, serviceId) {
  const category = PUNTO_HISPANO_SERVICES.find(item => item.id === categoryId)
  if (!category) return null
  if (!String(serviceId || '').trim()) return { category:category.label, service:'' }
  const service = category?.services.find(item => item.id === serviceId)
  return service ? { category:category.label, service:service.label } : null
}

export function buildPuntoHispanoWhatsappUrl(name, category, service) {
  if (!String(name || '').trim() || !category) throw new Error('Faltan datos de contacto')
  const interest = service ? `${category}: ${service}` : category
  const message = `Hola soy ${name.trim()} y vengo de Latido.ch. Tengo interés en ${interest}. Saludos.`
  return `https://wa.me/41766232664?text=${encodeURIComponent(message)}`
}

export function puntoHispanoContactsCsv(rows) {
  const cell = value => {
    let text = String(value ?? '')
    // Prevent spreadsheet formulas, including whitespace-prefixed formulas.
    if (/^[\s\uFEFF]*[=+@-]/u.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`
    return `"${text.replaceAll('"', '""')}"`
  }
  const records = [
    ['Nombre', 'Email', 'Categoría', 'Servicio', 'Fecha del clic (UTC)', 'Origen'],
    ...rows.map(row => [row.user_name, row.user_email, row.category_label, row.service_label, row.created_at, row.placement]),
  ]
  return '\uFEFFsep=;\r\n' + records.map(row => row.map(cell).join(';')).join('\r\n') + '\r\n'
}

export async function fetchAllPuntoHispanoContacts(fetchPage, pageSize = 500) {
  const rows = []
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await fetchPage(offset, offset + pageSize - 1)
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < pageSize) return rows
  }
}
