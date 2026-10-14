import { useCallback, useEffect, useRef, useState } from 'react'
import { cardRpc } from '../lib/latidoCard'
import { cardErrorMessage } from '../lib/latidoCardCore'
import { OPEN_PHYSICAL_STATUSES, PHYSICAL_STATUS_LABELS } from '../lib/latidoCardPhysical'

export default function LatidoCardPhysicalRequest({ active, displayName }) {
  const [data, setData] = useState({ issued_before: false, requests: [] }),
    [showForm, setShowForm] = useState(false)
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false)
  const [details, setDetails] = useState({
    fulfillment: 'shipping',
    recipient_name: displayName,
    address_line1: '',
    address_line2: '',
    postal_code: '',
    city: ''
  })
  const requestRef = useRef(null)
  const load = useCallback(async () => {
    try {
      setData(await cardRpc('lc_member_physical_requests'))
      setLoaded(true)
    } catch (err) {
      setError(cardErrorMessage(err))
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])
  const open = data.requests.find((r) => OPEN_PHYSICAL_STATUSES.includes(r.status))
  const set = (key, value) => setDetails((prev) => ({ ...prev, [key]: value }))
  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    requestRef.current ||= crypto.randomUUID()
    try {
      await cardRpc('lc_request_physical_card', {
        p_request_id: requestRef.current,
        p_details: details,
        p_kind: data.issued_before ? 'replacement' : 'initial'
      })
      requestRef.current = null
      setShowForm(false)
      await load()
    } catch (err) {
      setError(cardErrorMessage(err))
      await load()
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="lc-panel lc-spaced">
      <h2>Mi tarjeta física</h2>
      <p>Latido recibe tu solicitud y prepara tu tarjeta. Puedes consultar aquí cada paso.</p>
      <button className="lc-button lc-button--secondary" disabled={busy} onClick={load}>
        Actualizar estado
      </button>
      {error && (
        <p className="lc-alert" role="alert">
          {error}
        </p>
      )}
      {loaded && active && !open && !showForm && (
        <button className="lc-button lc-button--secondary" onClick={() => setShowForm(true)}>
          {data.issued_before ? 'Solicitar reposición' : 'Solicitar tarjeta física'}
        </button>
      )}
      {showForm && !open && (
        <form className="lc-form" onSubmit={submit}>
          <label>
            Entrega
            <select
              value={details.fulfillment}
              onChange={(e) => set('fulfillment', e.target.value)}
            >
              <option value="shipping">Envío a domicilio en Suiza</option>
              <option value="pickup">Recogida coordinada con Latido</option>
            </select>
          </label>
          <label>
            Nombre para la entrega
            <input
              required
              minLength={2}
              maxLength={120}
              value={details.recipient_name}
              onChange={(e) => set('recipient_name', e.target.value)}
            />
          </label>
          {details.fulfillment === 'shipping' && (
            <>
              <label>
                Calle y número
                <input
                  required
                  minLength={3}
                  maxLength={180}
                  autoComplete="address-line1"
                  value={details.address_line1}
                  onChange={(e) => set('address_line1', e.target.value)}
                />
              </label>
              <label>
                Piso o información adicional (opcional)
                <input
                  maxLength={180}
                  autoComplete="address-line2"
                  value={details.address_line2}
                  onChange={(e) => set('address_line2', e.target.value)}
                />
              </label>
              <label>
                Código postal
                <input
                  required
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  maxLength={4}
                  autoComplete="postal-code"
                  value={details.postal_code}
                  onChange={(e) => set('postal_code', e.target.value)}
                />
              </label>
              <label>
                Localidad
                <input
                  required
                  minLength={2}
                  maxLength={100}
                  autoComplete="address-level2"
                  value={details.city}
                  onChange={(e) => set('city', e.target.value)}
                />
              </label>
            </>
          )}
          <p className="lc-muted">
            Los datos de entrega se guardan para gestionar tu tarjeta y solo los consulta Latido.
            Esta solicitud no realiza ningún cobro; Latido confirmará las condiciones antes de
            prepararla.
          </p>
          <button className="lc-button" disabled={busy || !active}>
            {busy ? 'Enviando solicitud…' : 'Enviar solicitud a Latido'}
          </button>
          {!requestRef.current && (
            <button
              type="button"
              className="lc-button lc-button--secondary"
              disabled={busy}
              onClick={() => setShowForm(false)}
            >
              Volver
            </button>
          )}
        </form>
      )}
      <ul className="lc-history">
        {data.requests.map((r) => (
          <li key={r.id}>
            <strong>
              {r.reference} · {PHYSICAL_STATUS_LABELS[r.status]}
            </strong>
            <small>
              {r.kind === 'replacement' ? 'Reposición' : 'Primera tarjeta'} ·{' '}
              {r.fulfillment === 'shipping' ? 'Envío a domicilio' : 'Recogida'}
            </small>
            <p>
              {r.recipient_name}
              {r.fulfillment === 'shipping' && (
                <>
                  <br />
                  {r.address_line1}
                  {r.address_line2 && <> · {r.address_line2}</>}
                  <br />
                  {r.postal_code} {r.city}, Suiza
                </>
              )}
            </p>
            {r.public_note && <p>{r.public_note}</p>}
            {r.tracking_url && (
              <a
                className="lc-button lc-button--secondary"
                href={r.tracking_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Seguimiento del envío
              </a>
            )}
            {['requested', 'approved'].includes(r.status) && (
              <button
                className="lc-button lc-button--secondary"
                disabled={busy}
                onClick={async () => {
                  if (!window.confirm('¿Cancelar esta solicitud de tarjeta física?')) return
                  setBusy(true)
                  setError('')
                  try {
                    await cardRpc('lc_cancel_physical_request', { p_request: r.id })
                    await load()
                  } catch (err) {
                    setError(cardErrorMessage(err))
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                Cancelar solicitud
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
