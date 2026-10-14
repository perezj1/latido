export const PHYSICAL_STATUS_LABELS = Object.freeze({
  requested: 'Solicitada',
  approved: 'Aprobada',
  printing: 'En impresión',
  ready: 'Preparada',
  shipped: 'Enviada',
  delivered: 'Entregada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada'
})
export const OPEN_PHYSICAL_STATUSES = ['requested', 'approved', 'printing', 'ready', 'shipped']
export const PHYSICAL_EVENT_LABELS = {
  requested: 'Solicitud recibida',
  cancelled: 'Solicitud cancelada',
  status_changed: 'Cambio de estado',
  card_issued: 'Tarjeta emitida',
  card_reissued: 'Tarjeta reemitida',
  details_updated: 'Notas actualizadas'
}
export function physicalNextStatuses(request) {
  if (request.status === 'requested') return ['approved', 'rejected', 'cancelled']
  if (request.status === 'approved') return ['rejected', 'cancelled']
  if (request.status === 'printing') return ['ready', 'cancelled']
  if (request.status === 'ready')
    return [request.fulfillment === 'shipping' ? 'shipped' : 'delivered', 'cancelled']
  if (request.status === 'shipped') return ['delivered', 'cancelled']
  return []
}
