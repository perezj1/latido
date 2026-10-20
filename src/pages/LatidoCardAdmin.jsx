import { useEffect, useState } from 'react'
import { cardRpc } from '../lib/latidoCard'
import { cardErrorMessage } from '../lib/latidoCardCore'
import { CardHeader, cardDate } from './LatidoCard'
import './LatidoCard.css'

export default function LatidoCardAdmin() {
  const [overview, setOverview] = useState({ members: [], businesses: [], stats: {}, audit: [] })
  const [search, setSearch] = useState(''),
    [user, setUser] = useState(''),
    [provider, setProvider] = useState('')
  const [until, setUntil] = useState(''),
    [status, setStatus] = useState('active')
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('')
  const load = async () => setOverview(await cardRpc('lc_admin_overview', { p_search: search }))
  useEffect(() => {
    load().catch((err) => setError(cardErrorMessage(err)))
  }, [])
  const run = async (action) => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await action()
      await load()
      setNotice('Cambios guardados.')
    } catch (err) {
      setError(cardErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="lc-page">
      <CardHeader />
      <section className="lc-hero">
        <span className="lc-eyebrow">Administración Latido</span>
        <h1>Socios, negocios y descuentos.</h1>
        <p>
          Gestiona las membresías y retira los negocios que incumplan las normas. Las altas del
          piloto son manuales y no realizan cobros.
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
          ['Socios activos', 'active_members'],
          ['Negocios activos', 'active_businesses'],
          ['Descuentos vigentes', 'active_offers'],
          ['Usos registrados', 'uses']
        ].map(([label, key]) => (
          <section className="lc-panel" key={key}>
            <span className="lc-eyebrow">{label}</span>
            <h2>{overview.stats[key] ?? '—'}</h2>
          </section>
        ))}
      </div>
      <form
        className="lc-form lc-panel lc-spaced"
        onSubmit={(e) => {
          e.preventDefault()
          run(load)
        }}
      >
        <label>
          Buscar socio por nombre o email
          <input value={search} onChange={(e) => setSearch(e.target.value)} maxLength={100} />
        </label>
        <button className="lc-button lc-button--secondary" disabled={busy}>
          Buscar socios
        </button>
        <label>
          Seleccionar usuario
          <select
            value={user}
            onChange={(e) => {
              setUser(e.target.value)
              const member = overview.members.find((m) => m.user_id === e.target.value)
              setStatus(member?.status || 'active')
              const date = member?.valid_until ? new Date(member.valid_until) : null
              setUntil(
                date
                  ? new Date(date.getTime() - date.getTimezoneOffset() * 60000)
                      .toISOString()
                      .slice(0, 16)
                  : ''
              )
            }}
          >
            <option value="">Seleccionar…</option>
            {overview.members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.name || m.email} · {m.email}
                {m.member_number ? ` · Socio #${m.member_number}` : ' · Sin membresía'}
              </option>
            ))}
          </select>
        </label>
      </form>
      <div className="lc-grid lc-spaced">
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
              <input required value={user} onChange={(e) => setUser(e.target.value)} />
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
        </section>
        <section className="lc-panel">
          <h2>Participación de un negocio</h2>
          <div className="lc-form">
            <label>
              Seleccionar negocio
              <select value={provider} onChange={(e) => setProvider(e.target.value)}>
                <option value="">Seleccionar…</option>
                {overview.businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} · {b.active ? 'Participante' : 'Retirado'}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <form
            className="lc-form lc-spaced"
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
              Restablecer participación
            </button>
            <button
              type="button"
              className="lc-button lc-button--danger"
              disabled={busy || !provider}
              onClick={() =>
                run(() => cardRpc('lc_admin_business', { p_provider: provider, p_active: false }))
              }
            >
              Retirar del programa
            </button>
          </form>
          <p className="lc-muted">
            Al retirarlo, sus descuentos y validaciones dejan de estar disponibles. Su QR público
            conserva la misma dirección.
          </p>
        </section>
      </div>
      <details className="lc-panel lc-spaced">
        <summary>Registro de administración Latido</summary>
        <ul className="lc-history">
          {overview.audit.map((event) => (
            <li key={event.id}>
              <strong>
                {{
                  latido_card_memberships: 'Membresía',
                  latido_card_businesses: 'Participación de negocio',
                  latido_card_redemptions: 'Anulación de uso'
                }[event.entity_type] || 'Registro histórico'}
              </strong>
              <small>
                {cardDate(event.created_at)} · {event.actor_name} · {event.action}
              </small>
              <span className="lc-muted">Referencia {event.entity_id}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  )
}
