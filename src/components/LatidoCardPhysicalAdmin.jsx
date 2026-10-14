import { useCallback, useEffect, useRef, useState } from 'react'
import { cardRpc, cardUrl } from '../lib/latidoCard'
import { cardErrorMessage } from '../lib/latidoCardCore'
import {
  PHYSICAL_STATUS_LABELS,
  PHYSICAL_EVENT_LABELS,
  physicalNextStatuses
} from '../lib/latidoCardPhysical'
import LatidoCardQr from './LatidoCardQr'

function RequestRow({ request, onAction, busy }) {
  const [publicNote, setPublicNote] = useState(request.public_note),
    [internalNote, setInternalNote] = useState(request.internal_note),
    [tracking, setTracking] = useState(request.tracking_url)
  const update = (status) =>
    onAction(() =>
      cardRpc('lc_admin_update_physical_request', {
        p_request: request.id,
        p_expected_version: request.version,
        p_status: status,
        p_public_note: publicNote,
        p_internal_note: internalNote,
        p_tracking_url: tracking
      })
    )
  return (
    <article className="lc-panel">
      <span className="lc-badge">{PHYSICAL_STATUS_LABELS[request.status]}</span>
      <h3>
        {request.reference} · {request.recipient_name}
      </h3>
      <p className="lc-muted">
        Socio #{request.member_number} · {request.contact_email} ·{' '}
        {request.kind === 'replacement' ? 'Reposición' : 'Primera tarjeta'}
      </p>
      <details>
        <summary>Entrega, notas e historial</summary>
        <p>
          {request.fulfillment === 'pickup' ? (
            'Recogida coordinada'
          ) : (
            <>
              {request.address_line1}
              <br />
              {request.address_line2 && (
                <>
                  {request.address_line2}
                  <br />
                </>
              )}
              {request.postal_code} {request.city}, Suiza
            </>
          )}
        </p>
        <div className="lc-form">
          <label>
            Mensaje visible para el socio
            <textarea
              maxLength={1000}
              value={publicNote}
              onChange={(e) => setPublicNote(e.target.value)}
            />
          </label>
          <label>
            Nota interna de Latido
            <textarea
              maxLength={2000}
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
            />
          </label>
          {request.fulfillment === 'shipping' && (
            <label>
              Enlace de seguimiento (HTTPS)
              <input
                type="url"
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
                placeholder="https://…"
              />
            </label>
          )}
          <button
            className="lc-button lc-button--secondary"
            disabled={busy}
            onClick={() => update(request.status)}
          >
            Guardar notas
          </button>
        </div>
        <ul className="lc-history">
          {request.events.map((e, i) => (
            <li key={i}>
              {PHYSICAL_EVENT_LABELS[e.action] || 'Actualización'} ·{' '}
              {PHYSICAL_STATUS_LABELS[e.to_status]}
              <small>
                {new Date(e.created_at).toLocaleString('es-CH', { timeZone: 'Europe/Zurich' })} ·{' '}
                {e.actor_name || 'Sistema'}
              </small>
            </li>
          ))}
        </ul>
        <p className="lc-muted">
          Avisos email: {request.emails.filter((e) => e.status === 'sent').length} enviados ·{' '}
          {request.emails.filter((e) => ['pending', 'sending'].includes(e.status)).length}{' '}
          pendientes.
        </p>
        {request.emails
          .filter((e) => e.status === 'failed')
          .map((e) => (
            <button
              key={e.id}
              className="lc-button lc-button--secondary"
              disabled={busy}
              onClick={() =>
                onAction(() => cardRpc('lc_admin_retry_physical_email', { p_id: e.id }))
              }
            >
              Reintentar aviso fallido ({e.audience === 'admin' ? 'Latido' : 'socio'})
            </button>
          ))}
      </details>
      <div className="lc-actions">
        {physicalNextStatuses(request).map((status) => (
          <button
            key={status}
            className={`lc-button ${['cancelled', 'rejected'].includes(status) ? 'lc-button--danger' : 'lc-button--secondary'}`}
            disabled={busy}
            onClick={() => update(status)}
          >
            {PHYSICAL_STATUS_LABELS[status]}
          </button>
        ))}
        {['approved', 'printing', 'ready'].includes(request.status) && (
          <button
            className="lc-button"
            disabled={busy}
            onClick={() => {
              if (
                !window.confirm(
                  request.credential_id
                    ? 'Se invalidará el QR emitido anteriormente para esta solicitud. ¿Reemitirlo?'
                    : 'Se emitirá la tarjeta y la solicitud pasará a impresión. ¿Continuar?'
                )
              )
                return
              onAction(
                () =>
                  cardRpc('lc_admin_issue_request_card', {
                    p_request: request.id,
                    p_expected_version: request.version,
                    p_reissue: !!request.credential_id
                  }),
                true
              )
            }}
          >
            {request.credential_id ? 'Reemitir QR de impresión' : 'Emitir QR y pasar a impresión'}
          </button>
        )}
      </div>
    </article>
  )
}
export default function LatidoCardPhysicalAdmin({ onChange }) {
  const [filter, setFilter] = useState('open'),
    [requests, setRequests] = useState([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [physical, setPhysical] = useState(null),
    [loading, setLoading] = useState(true)
  const filterRef = useRef(filter),
    loadSequence = useRef(0)
  filterRef.current = filter
  const load = useCallback(async () => {
    const selectedFilter = filterRef.current,
      sequence = ++loadSequence.current
    try {
      const result = await cardRpc('lc_admin_physical_queue', { p_status: selectedFilter })
      if (sequence === loadSequence.current && selectedFilter === filterRef.current) {
        setRequests(result)
        setError('')
      }
    } catch (err) {
      if (sequence === loadSequence.current) setError(cardErrorMessage(err))
    } finally {
      if (sequence === loadSequence.current) setLoading(false)
    }
  }, [])
  useEffect(() => {
    load()
  }, [load, filter])
  const run = async (fn, issue = false) => {
    setBusy(true)
    setError('')
    try {
      const result = await fn()
      if (issue) setPhysical(result)
      await load()
      onChange?.()
    } catch (err) {
      setError(cardErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="lc-spaced" id="solicitudes">
      <div className="lc-top">
        <div>
          <span className="lc-eyebrow">Operaciones Latido</span>
          <h2>Solicitudes de tarjeta física</h2>
        </div>
        <button className="lc-button lc-button--secondary" disabled={busy} onClick={load}>
          Actualizar solicitudes
        </button>
      </div>
      <p>
        La solicitud guardada es el registro principal. Los avisos de email se procesan por separado
        y no sustituyen esta bandeja.
      </p>
      <div className="lc-form">
        <label>
          Estado de solicitudes
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="open">Pendientes y en curso</option>
            <option value="all">Todas (100 más recientes)</option>
            {Object.entries(PHYSICAL_STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <p className="lc-alert" role="alert">
          {error}
        </p>
      )}
      {loading && <p role="status">Cargando solicitudes…</p>}
      {physical && (
        <div className="lc-panel lc-spaced">
          <h3>QR de impresión · {physical.reference}</h3>
          <LatidoCardQr
            value={cardUrl(physical.token)}
            label="QR de impresión de la solicitud"
            downloadName={`${physical.reference}.png`}
          />
          <p>Socio #{physical.member_number}</p>
          <p className="lc-muted">
            Descarga el QR antes de cerrar. Si se pierde, reemítelo expresamente: el anterior
            quedará bloqueado.
          </p>
          <button className="lc-button lc-button--secondary" onClick={() => setPhysical(null)}>
            Cerrar QR
          </button>
        </div>
      )}
      <div className="lc-grid lc-spaced">
        {requests.map((r) => (
          <RequestRow key={`${r.id}:${r.version}`} request={r} onAction={run} busy={busy} />
        ))}
      </div>
      {!loading && !requests.length && <p>No hay solicitudes en este estado.</p>}
    </section>
  )
}
