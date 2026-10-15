const STATUS = {
  requested: 'Solicitada',
  approved: 'Aprobada',
  printing: 'En impresión',
  ready: 'Preparada',
  shipped: 'Enviada',
  delivered: 'Entregada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada'
}
const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
export function buildPhysicalCardEmail(job, appUrl = 'https://www.latido.ch') {
  const ref = String(job.payload.reference || 'Tarjeta Latido'),
    status = STATUS[job.payload.status] || 'Actualizada'
  const admin = job.audience === 'admin',
    url = `${appUrl.replace(/\/+$/, '')}${admin ? '/card/admin' : '/card'}`
  const title = admin
    ? 'Nueva solicitud de tarjeta física'
    : job.payload.status === 'requested'
      ? 'Hemos recibido tu solicitud de Tarjeta Latido'
      : 'Tu tarjeta física tiene una actualización'
  const message = admin
    ? 'Hay una nueva solicitud pendiente. Abre la administración de Latido para revisar los datos de entrega y preparar la tarjeta.'
    : 'Consulta en Latido los detalles de preparación y entrega de tu tarjeta.'
  return {
    subject: `${title} · ${ref}`,
    text: [title, ref, `Estado: ${status}`, message, url].join('\n\n'),
    html: `<!doctype html><html lang="es"><body style="font-family:Arial,sans-serif;color:#17243a;padding:24px"><h1 style="font-size:24px">${escapeHtml(title)}</h1><p>${escapeHtml(ref)} · ${escapeHtml(status)}</p><p>${escapeHtml(message)}</p><p><a href="${escapeHtml(url)}">${admin ? 'Abrir administración Latido' : 'Ver mi solicitud'}</a></p><p style="color:#64758d;font-size:12px">Este aviso corresponde a una solicitud de tarjeta física. Los datos de entrega se consultan dentro de Latido.</p></body></html>`
  }
}
