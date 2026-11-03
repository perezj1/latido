import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import './StoreOrders.css'

const STATES = { paid: 'Pagado · pendiente', gelato_ordered: 'En proceso', shipped: 'Enviado', delivered: 'Entregado', checkout_open: 'Pendiente de pago', payment_processing: 'Confirmando pago', payment_failed: 'Pago fallido', expired: 'Caducado', refunded: 'Reembolsado', failed: 'Error' }
const NEXT = { paid: 'gelato_ordered', gelato_ordered: 'shipped', shipped: 'delivered' }
const money = (amount, currency = 'chf') => new Intl.NumberFormat('es-CH', { style: 'currency', currency: currency.toUpperCase() }).format(amount / 100)
const date = value => value ? new Date(value).toLocaleString('es-CH', { timeZone: 'Europe/Zurich', dateStyle: 'medium', timeStyle: 'short' }) : '—'

function Order({ order, onSaved }) {
  const [notes, setNotes] = useState(order.internal_notes || '')
  const [tracking, setTracking] = useState(order.tracking_url || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const paid = order.payment_status === 'paid'
  const address = order.shipping_address || {}
  async function save(status) {
    setSaving(true)
    setError('')
    try {
      const { error } = await supabase.rpc('club_admin_update_order', { p_id: order.id, p_expected_status: order.status, p_status: status, p_notes: notes, p_tracking_url: tracking.trim() })
      if (error) throw error
      onSaved()
    } catch (err) {
      setError(err.message?.includes('ORDER_CHANGED') ? 'El pedido ha cambiado. Actualiza la lista antes de volver a guardarlo.' : 'No se pudo guardar. Comprueba la conexión y usa una URL https:// para el seguimiento.')
    } finally { setSaving(false) }
  }
  return <article className="store-order">
    <header><div><h3>{order.reference}</h3><small>{date(order.created_at)}</small></div><span className="store-order__status" data-state={order.status}>{STATES[order.status] || order.status}</span><strong>{money(order.total_amount, order.currency)}</strong></header>
    <div className="store-order__details">
      <div><h4>Productos</h4>{order.items.map((item, i) => <div className="store-order__item" key={`${item.sku}-${i}`}>
        <strong>{item.quantity} × {item.product_name}</strong>
        <span>{item.option_label}: {item.option}</span>
        {(item.size || item.color) && <span>{[item.size && `Talla: ${item.size}`, item.color && `Color: ${item.color}`].filter(Boolean).join(' · ')}</span>}
        <small>SKU: {item.sku}</small>
        <small>Producto Gelato: {item.gelato_product_id}<br />Variante: {item.gelato_variant_id}</small>
      </div>)}</div>
      <div><h4>Cliente y envío</h4><strong>{order.customer_name || 'Datos pendientes del pago'}</strong>
        {order.customer_email && <a href={`mailto:${order.customer_email}`}>{order.customer_email}</a>}
        {order.customer_phone && <a href={`tel:${order.customer_phone}`}>{order.customer_phone}</a>}
        <address>{[address.line1, address.line2, [address.postal_code, address.city].filter(Boolean).join(' '), address.state, address.country].filter(Boolean).map((line, i) => <div key={i}>{line}</div>)}</address>
        <p>Pago: <strong>{paid ? 'Confirmado por Stripe' : order.payment_status}</strong></p>
        <small>Confirmado: {date(order.paid_at)}<br />En proceso: {date(order.processing_at)}<br />Enviado: {date(order.shipped_at)}<br />Entregado: {date(order.delivered_at)}</small>
      </div>
      <div><h4>Gestión del pedido</h4>
        <p className={order.admin_email_sent_at ? '' : 'store-order__warning'}>Aviso al administrador: {order.admin_email_sent_at ? date(order.admin_email_sent_at) : 'Pendiente'}</p>
        <p>Confirmación al cliente: {order.customer_email_sent_at ? date(order.customer_email_sent_at) : 'Pendiente'}</p>
        {order.notification_last_error && <p role="alert" className="store-order__warning">Hay un error pendiente de notificación. Stripe reintentará el aviso.</p>}
        <label>Notas internas<textarea value={notes} onChange={e => setNotes(e.target.value)} maxLength={5000} disabled={!paid || saving} /></label>
        <label>Enlace de seguimiento (opcional)<input type="url" placeholder="https://" value={tracking} onChange={e => setTracking(e.target.value)} disabled={!paid || saving} /></label>
        {error && <p role="alert" className="store-order__warning">{error}</p>}
        {paid && <div className="store-order__actions"><button type="button" disabled={saving} onClick={() => save(order.status)}>Guardar notas</button>{NEXT[order.status] && <button type="button" className="store-order__primary" disabled={saving} onClick={() => save(NEXT[order.status])}>Marcar {STATES[NEXT[order.status]].toLowerCase()}</button>}</div>}
      </div>
    </div>
  </article>
}

export default function StoreOrders({ refreshKey = 0, onStatus }) {
  const [status, setStatus] = useState('paid')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    onStatus?.({ loading: true, error: false, updatedAt: null })
    const timer = setTimeout(async () => {
      const { data, error } = await supabase.rpc('club_admin_orders', { p_status: status, p_search: search.trim(), p_page: page })
      if (!active) return
      setLoading(false)
      if (error) {
        setError('No se pudieron cargar los pedidos. Comprueba la conexión y los permisos de administración.')
        onStatus?.({ loading: false, error: true, updatedAt: null })
      } else {
        const last = Math.max(1, Math.ceil(data.total / 25))
        if (page > last) { setPage(last); return }
        setReport(data)
        onStatus?.({ loading: false, error: false, updatedAt: data.generated_at })
      }
    }, 250)
    return () => { active = false; clearTimeout(timer) }
  }, [status, search, page, revision, refreshKey, onStatus])
  // Refresh while the section is visible; no customer data is stored locally.
  useEffect(() => {
    const timer = setInterval(() => { if (!document.hidden) setRevision(value => value + 1) }, 60000)
    return () => clearInterval(timer)
  }, [])
  return <section className="store-orders" aria-label="Pedidos de Tienda Latido">
    <div className="store-orders__filters">
      <label>Estado del pedido<select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}>
        <option value="paid">Todos los pagados</option><option value="gelato_ordered">En proceso</option><option value="shipped">Enviados</option><option value="delivered">Entregados</option><option value="all">Todos, incluidos pagos pendientes</option>
      </select></label>
      <label>Buscar pedido<input type="search" value={search} placeholder="Referencia, cliente o producto" onChange={e => { setSearch(e.target.value); setPage(1) }} /></label>
      <button type="button" onClick={() => setRevision(value => value + 1)} disabled={loading}>Actualizar pedidos</button>
    </div>
    {report && <p><strong>{report.pending} pedidos pagados pendientes de preparar</strong> · {report.total} resultados</p>}
    {error && <p role="alert">{error}</p>}
    {loading && <p role="status">Actualizando pedidos…</p>}
    {!error && report?.rows.map(order => <Order key={`${order.id}-${order.updated_at}`} order={order} onSaved={() => setRevision(value => value + 1)} />)}
    {!loading && !error && report?.rows.length === 0 && <p>No hay pedidos con estos filtros.</p>}
    {report?.total > 25 && <div className="store-orders__pagination"><button disabled={page === 1 || loading} onClick={() => setPage(value => value - 1)}>Anterior</button><span>Página {page} de {Math.ceil(report.total / 25)}</span><button disabled={page * 25 >= report.total || loading} onClick={() => setPage(value => value + 1)}>Siguiente</button></div>}
  </section>
}
