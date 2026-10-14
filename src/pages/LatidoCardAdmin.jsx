import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { CardHeader } from './LatidoCard'
import { cardRpc, cardUrl } from '../lib/latidoCard'
import { cardErrorMessage } from '../lib/latidoCardCore'
import LatidoCardQr from '../components/LatidoCardQr'
import './LatidoCard.css'

export default function LatidoCardAdmin() {
  const { isAdmin } = useAuth()
  const [user, setUser] = useState(''),
    [until, setUntil] = useState(''),
    [provider, setProvider] = useState(''),
    [status, setStatus] = useState('active'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [physical, setPhysical] = useState(null)
  const run = async (fn) => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await fn()
      setNotice('Operación completada.')
    } catch (err) {
      setError(cardErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  if (!isAdmin)
    return (
      <div className="lc-page">
        <CardHeader />
        <p>No tienes acceso a la administración de Latido Card.</p>
      </div>
    )
  return (
    <div className="lc-page">
      <CardHeader />
      <section className="lc-hero">
        <span className="lc-eyebrow">Administración · Piloto</span>
        <h1>Preparar socios y negocios.</h1>
        <p>
          Las altas de esta fase son manuales. No se realiza ningún cobro ni se activa una membresía
          desde una página de pago.
        </p>
      </section>
      {error && (
        <p className="lc-alert" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="lc-alert lc-success" role="status">
          {notice}
        </p>
      )}
      <div className="lc-grid">
        <section className="lc-panel">
          <h2>Membresía de un socio</h2>
          <form
            className="lc-form"
            onSubmit={(e) => {
              e.preventDefault()
              run(() =>
                cardRpc('lc_admin_enroll', {
                  p_user: user,
                  p_valid_until: new Date(until).toISOString(),
                  p_status: status
                })
              )
            }}
          >
            <label>
              UUID del usuario
              <input
                required
                value={user}
                onChange={(e) => {
                  setUser(e.target.value)
                  setPhysical(null)
                }}
              />
            </label>
            <label>
              Vigencia hasta
              <input
                required
                type="datetime-local"
                value={until}
                onChange={(e) => setUntil(e.target.value)}
              />
            </label>
            <label>
              Estado
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="active">Activa</option>
                <option value="paused">Pausada</option>
                <option value="cancelled">Cancelada</option>
              </select>
            </label>
            <button className="lc-button" disabled={busy}>
              Guardar membresía
            </button>
          </form>
          <div className="lc-actions">
            <button
              className="lc-button lc-button--secondary"
              disabled={busy || !user}
              onClick={() => {
                if (
                  window.confirm(
                    'Se invalidará cualquier tarjeta física anterior de este socio. ¿Emitir una nueva?'
                  )
                )
                  run(async () =>
                    setPhysical(await cardRpc('lc_admin_physical_card', { p_user: user }))
                  )
              }}
            >
              Emitir tarjeta física
            </button>
          </div>
          {physical && (
            <>
              <LatidoCardQr
                value={cardUrl(physical.token)}
                label="QR para imprimir en la tarjeta física"
              />
              <p>Socio #{physical.member_number}</p>
              <p className="lc-secret">{cardUrl(physical.token)}</p>
              <p className="lc-muted">
                Guarda el QR para impresión. El servidor conserva solo su huella, no permite
                recuperarlo después.
              </p>
            </>
          )}
        </section>
        <section className="lc-panel">
          <h2>Participación de un negocio</h2>
          <form
            className="lc-form"
            onSubmit={(e) => {
              e.preventDefault()
              run(() => cardRpc('lc_admin_business', { p_provider: provider, p_active: true }))
            }}
          >
            <label>
              UUID del negocio
              <input required value={provider} onChange={(e) => setProvider(e.target.value)} />
            </label>
            <button className="lc-button" disabled={busy}>
              Autorizar participación
            </button>
            <button
              type="button"
              className="lc-button lc-button--danger"
              disabled={busy || !provider}
              onClick={() =>
                run(() => cardRpc('lc_admin_business', { p_provider: provider, p_active: false }))
              }
            >
              Suspender participación
            </button>
          </form>
          <p className="lc-muted">
            El propietario gestiona sus ofertas desde Mi negocio. Las autorizaciones se comprueban
            en el servidor.
          </p>
        </section>
      </div>
    </div>
  )
}
