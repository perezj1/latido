import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { CardHeader } from './LatidoCard'
import { cardRpc, cardUrl } from '../lib/latidoCard'
import { cardErrorMessage } from '../lib/latidoCardCore'
import LatidoCardQr from '../components/LatidoCardQr'
import LatidoCardPhysicalAdmin from '../components/LatidoCardPhysicalAdmin'
import './LatidoCard.css'

export default function LatidoCardAdmin() {
  const { isAdmin } = useAuth()
  const [overview, setOverview] = useState({ stats: {}, members: [], businesses: [] }),
    [search, setSearch] = useState('')
  const loadOverview = useCallback(async () => {
    if (!isAdmin) return
    try {
      setOverview(await cardRpc('lc_admin_overview', { p_search: search }))
      setError('')
    } catch (err) {
      setError(cardErrorMessage(err))
    }
  }, [isAdmin, search])
  useEffect(() => {
    if (isAdmin) loadOverview()
  }, [isAdmin])
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
      await loadOverview()
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
        <h1>Latido administra cada tarjeta.</h1>
        <p>
          Gestiona socios, negocios, solicitudes de tarjeta física y entrega. Las altas del piloto
          son manuales y no realizan cobros.
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
        {[
          ['Socios activos', overview.stats.active_members],
          ['Solicitudes nuevas', overview.stats.pending_requests],
          ['Tarjetas en curso', overview.stats.in_progress],
          ['Emails pendientes', overview.stats.email_pending],
          ['Emails fallidos', overview.stats.email_failed]
        ].map(([label, value]) => (
          <div className="lc-panel" key={label}>
            <span className="lc-eyebrow">{label}</span>
            <h2>{value ?? '—'}</h2>
          </div>
        ))}
      </div>
      <form
        className="lc-form lc-panel"
        onSubmit={(e) => {
          e.preventDefault()
          loadOverview()
        }}
      >
        <label>
          Buscar socio por nombre o email
          <input value={search} onChange={(e) => setSearch(e.target.value)} maxLength={120} />
        </label>
        <button className="lc-button lc-button--secondary">Buscar socios</button>
        <label>
          Seleccionar usuario
          <select
            value={overview.members.some((m) => m.id === user) ? user : ''}
            onChange={(e) => {
              const found = overview.members.find((m) => m.id === e.target.value)
              setUser(e.target.value)
              setPhysical(null)
              if (found?.valid_until) {
                const date = new Date(found.valid_until)
                setUntil(
                  new Date(date.getTime() - date.getTimezoneOffset() * 60000)
                    .toISOString()
                    .slice(0, 16)
                )
              }
              setStatus(found?.status || 'active')
            }}
          >
            <option value="">Seleccionar…</option>
            {overview.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name || m.email} · {m.email}
                {m.member_number ? ` · Socio #${m.member_number}` : ' · Sin membresía'}
              </option>
            ))}
          </select>
        </label>
      </form>
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
          <div className="lc-form">
            <label>
              Seleccionar negocio
              <select
                value={overview.businesses.some((b) => b.id === provider) ? provider : ''}
                onChange={(e) => setProvider(e.target.value)}
              >
                <option value="">Seleccionar…</option>
                {overview.businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} · {b.participating ? 'Participante' : 'Pendiente'}
                  </option>
                ))}
              </select>
            </label>
          </div>
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
      <LatidoCardPhysicalAdmin onChange={loadOverview} />
      {!!overview.audit?.length && (
        <details className="lc-panel lc-spaced">
          <summary>Registro de administración Latido</summary>
          <ul className="lc-history">
            {overview.audit.map((event, index) => (
              <li key={index}>
                {{
                  latido_card_memberships: 'Membresía',
                  latido_card_businesses: 'Participación de negocio',
                  latido_card_credentials: 'Tarjeta física'
                }[event.entity_type] || 'Registro'}{' '}
                · {event.action === 'INSERT' ? 'Alta' : 'Actualización'}
                <small>
                  {new Date(event.created_at).toLocaleString('es-CH', {
                    timeZone: 'Europe/Zurich'
                  })}{' '}
                  · {event.actor_name}
                </small>
                <span className="lc-muted">Referencia {event.entity_id}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
