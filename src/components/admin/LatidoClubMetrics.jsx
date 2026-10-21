import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { cardRpc } from '../../lib/latidoCard'
import { CARD_MEMBERS_ENABLED } from '../../lib/latidoCardLaunch'
import './LatidoClubMetrics.css'

const LISTS = { businesses: 'Negocios', members: 'Miembros', offers: 'Ofertas', uses: 'Historial de usos' }
const STATES = {
  members: { active: 'Activa', paused: 'Pausada', expired: 'Vencida', cancelled: 'Cancelada', scheduled: 'Programada' },
  businesses: { active: 'Participante', without_offers: 'Sin ofertas vigentes', suspended: 'Suspendido', inactive: 'Retirado', unpublished: 'Sin publicar', archived: 'Archivado' },
  offers: { published: 'Publicada', paused: 'Pausada', expired: 'Vencida', scheduled: 'Programada', archived: 'Archivada', business_unavailable: 'Negocio no disponible' },
  uses: { used: 'Registrado', reversed: 'Anulado' },
}
const SERIES = { members: 'Nuevos miembros', offers: 'Ofertas creadas', uses: 'Usos registrados' }
const TYPES = { percent: 'Descuento %', fixed: 'Cantidad fija', gift: 'Regalo', service: 'Otro beneficio', two_for_one: '2x1 o similar' }
const number = value => new Intl.NumberFormat('es-CH').format(value ?? 0)
const date = value => {
  if (!value || value === 'infinity') return 'Sin fecha'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString('es-CH', { timeZone: 'Europe/Zurich' })
}
function Status({ kind, value }) {
  return <span className="club-admin-status" data-state={value}>{STATES[kind][value] || value}</span>
}

export default function LatidoClubMetrics({ refreshKey = 0, onStatus }) {
  const [days, setDays] = useState(30)
  const [kind, setKind] = useState('businesses')
  const [status, setStatus] = useState('all')
  const [draftSearch, setDraftSearch] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [excludeTests, setExcludeTests] = useState(true)
  const [series, setSeries] = useState('uses')
  const [revision, setRevision] = useState(0)
  const [reportState, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const requestKey = JSON.stringify([days, kind, status, search, page, excludeTests, refreshKey, revision])
  const report = reportState?.key === requestKey ? reportState.data : null
  useEffect(() => {
    const timer = setTimeout(() => { setSearch(draftSearch.trim()); setPage(1) }, 300)
    return () => clearTimeout(timer)
  }, [draftSearch])
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setLoading(true)
    setError('')
    setReport(null)
    onStatus?.({ loading: true, error: false, updatedAt: null })
    cardRpc('lc_admin_metrics', {
      p_days: days, p_kind: kind, p_status: status, p_search: search,
      p_page: page, p_page_size: 25, p_exclude_tests: excludeTests,
    }, { signal: controller.signal }).then(data => {
      if (!active) return
      if (!data?.stats || !Array.isArray(data.records?.rows) || !Array.isArray(data.daily)) throw new Error('INVALID_REPORT')
      const lastPage = Math.max(1, Math.ceil(data.records.total / data.records.page_size))
      if (page > lastPage) { setPage(lastPage); return }
      setReport({ key: requestKey, data })
      setLoading(false)
      onStatus?.({ loading: false, error: false, updatedAt: data.generated_at })
    }).catch(err => {
      if (!active) return
      const missing = ['PGRST202', '42883'].includes(err.code)
      setError(missing
        ? 'Falta instalar el informe de Latido Club. Ejecuta supabase/latido_club_admin_metrics.sql en el SQL Editor de Supabase y pulsa Reintentar.'
        : err.code === '42501' || err.message === 'FORBIDDEN'
          ? 'Tu cuenta no tiene permiso de administración de Latido Club en Supabase.'
          : 'No se pudieron cargar las métricas de Latido Club. Comprueba la conexión y vuelve a intentarlo.')
      setLoading(false)
      onStatus?.({ loading: false, error: true, updatedAt: null })
    })
    return () => { active = false; controller.abort() }
  }, [days, kind, status, search, page, excludeTests, refreshKey, revision, requestKey, onStatus])

  const stats = report?.stats
  const change = setter => event => { setter(event.target.value); setPage(1) }
  const selectKind = value => { setKind(value); setStatus('all'); setPage(1) }
  const max = Math.max(1, ...(report?.daily || []).map(day => Number(day[series]) || 0))
  const pages = report ? Math.max(1, Math.ceil(report.records.total / report.records.page_size)) : 1

  return <section className="club-admin" aria-label="Métricas de Latido Club" aria-busy={loading}>
    <div className="adm-surface club-admin-controls">
      <div>
        <h2>Resumen de Latido Club</h2>
        <p>{CARD_MEMBERS_ENABLED ? 'Experiencia de miembros habilitada.' : 'Fase actual: captación de negocios. El acceso de miembros sigue cerrado.'}</p>
      </div>
      <label>Actividad del periodo
        <select value={days} onChange={event => { setDays(Number(event.target.value)); setPage(1) }}>
          {[7, 30, 90].map(value => <option key={value} value={value}>Últimos {value} días</option>)}
        </select>
      </label>
      <label className="club-admin-checkbox"><input type="checkbox" checked={excludeTests} onChange={event => { setExcludeTests(event.target.checked); setPage(1) }} />Excluir datos [TEST]</label>
    </div>
    {loading && <p role="status">Cargando métricas de Latido Club…</p>}
    {error && <div className="adm-surface club-admin-error" role="alert"><p>{error}</p><button type="button" onClick={() => setRevision(value => value + 1)}>Reintentar</button></div>}
    {stats && <>
      <div className="club-admin-kpis">
        {[
          ['Miembros activos', stats.members_active, `${number(stats.members_total)} membresías registradas`],
          ['Ofertas publicadas', stats.offers_published, 'Vigentes en negocios publicados y participantes'],
          ['Negocios con ofertas', stats.businesses_with_offers, `${number(stats.businesses_participating)} participantes`],
          [`Usos en ${days} días`, stats.uses_period, `${number(stats.uses_total)} usos históricos sin anular`],
          ['Personas que usaron ofertas', stats.using_members_period, `Miembros únicos en ${days} días`],
          ['Reservas vigentes', stats.claims_active, 'Reservas pendientes de usar y sin caducar'],
        ].map(([label, value, hint]) => <article className="adm-surface club-admin-kpi" key={label}>
          <h3>{label}</h3><strong>{number(value)}</strong><p>{hint}</p>
        </article>)}
      </div>
      <div className="club-admin-summary">
        <div className="adm-surface">
          <h3>Miembros y negocios</h3>
          <dl>
            <div><dt>Nuevos miembros en {days} días</dt><dd>{number(stats.members_new)}</dd></div>
            <div><dt>Membresías pausadas</dt><dd>{number(stats.members_paused)}</dd></div>
            <div><dt>Membresías vencidas</dt><dd>{number(stats.members_expired)}</dd></div>
            <div><dt>Membresías canceladas</dt><dd>{number(stats.members_cancelled)}</dd></div>
            <div><dt>Negocios inscritos sin archivar</dt><dd>{number(stats.businesses_total)}</dd></div>
            <div><dt>Participantes sin ofertas vigentes</dt><dd>{number(stats.businesses_without_offers)}</dd></div>
            <div><dt>Negocios suspendidos</dt><dd>{number(stats.businesses_suspended)}</dd></div>
          </dl>
        </div>
        <div className="adm-surface">
          <h3>Estado de las ofertas</h3>
          <dl>
            <div><dt>Ofertas sin archivar</dt><dd>{number(stats.offers_total)}</dd></div>
            <div><dt>Pausadas</dt><dd>{number(stats.offers_paused)}</dd></div>
            <div><dt>Vencidas</dt><dd>{number(stats.offers_expired)}</dd></div>
            <div><dt>Programadas</dt><dd>{number(stats.offers_scheduled)}</dd></div>
            <div><dt>Negocio no disponible</dt><dd>{number(stats.offers_unavailable)}</dd></div>
            <div><dt>Versiones archivadas</dt><dd>{number(stats.offers_archived)}</dd></div>
            <div><dt>Usos anulados históricos</dt><dd>{number(stats.uses_reversed)}</dd></div>
          </dl>
        </div>
      </div>
      <div className="adm-surface club-admin-evolution">
        <div className="club-admin-section-heading"><h3>Evolución en {days} días</h3>
          <label>Indicador<select value={series} onChange={event => setSeries(event.target.value)}>{Object.entries(SERIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
        <div className="club-admin-chart" role="img" aria-label={`${SERIES[series]} por día; ${number(report.daily.reduce((sum, day) => sum + Number(day[series]), 0))} en el periodo`}>
          {report.daily.map(day => <div key={day.day} title={`${date(`${day.day}T12:00:00Z`)}: ${number(day[series])}`}>
            <span style={{ height: `${(Number(day[series]) / max) * 100}%` }} />
          </div>)}
        </div>
        <div className="club-admin-chart-dates"><span>{date(report.period.from)}</span><span>{date(report.period.until)}</span></div>
        <p>Altas, ofertas creadas (incluidas nuevas versiones) y usos sin anular. Fechas de Suiza.</p>
      </div>
    </>}
    <div className="adm-surface club-admin-records">
      <div className="club-admin-list-picker" aria-label="Listados de Latido Club">
        {Object.entries(LISTS).map(([value, label]) => <button key={value} type="button" aria-pressed={kind === value} onClick={() => selectKind(value)}>{label}</button>)}
      </div>
      <div className="club-admin-filters">
        <label>Buscar en {LISTS[kind].toLowerCase()}<input type="search" value={draftSearch} maxLength={100} onChange={event => setDraftSearch(event.target.value)} placeholder="Nombre, negocio u oferta" /></label>
        <label>Estado<select aria-label="Estado" value={status} onChange={change(setStatus)}><option value="all">Todos (incluye historial)</option>{Object.entries(STATES[kind]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>
      {report && <>
        <p className="club-admin-record-count" aria-live="polite">{number(report.records.total)} registros · {kind === 'uses' ? `Usos de los últimos ${days} días` : 'Listado completo, sin limitar al periodo'}</p>
        <div className="club-admin-table-scroll" role="region" aria-label={`Listado de ${LISTS[kind].toLowerCase()}`} tabIndex={0}>
          <table>
            <thead><tr>{(kind === 'members' ? ['Miembro', 'Número', 'Estado', 'Vigencia', 'Alta']
              : kind === 'businesses' ? ['Negocio', 'Estado', 'Ofertas publicadas', 'Sin archivar', 'Usos']
                : kind === 'offers' ? ['Oferta', 'Estado', 'Tipo', 'Usos', 'Válida hasta']
                  : ['Oferta', 'Miembro', 'Estado', 'Fecha']).map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
            <tbody>{report.records.rows.map(row => <tr key={row.id}>
              <td><strong>{kind === 'members' || kind === 'businesses' ? row.name || row.email || 'Sin nombre' : row.title}</strong>
                <small>{kind === 'members' ? row.email : kind === 'businesses' ? row.city : row.business_name}</small>
                {kind === 'businesses' && row.status !== 'archived' && <Link to={`/card/negocios?negocio=${row.id}`}>Ver negocio</Link>}
              </td>
              {kind === 'members' ? <><td>#{row.member_number}</td><td><Status kind={kind} value={row.status} /></td><td>{date(row.valid_until)}</td><td>{date(row.created_at)}</td></>
                : kind === 'businesses' ? <><td><Status kind={kind} value={row.status} /></td><td>{number(row.published_offers)}</td><td>{number(row.offers)}</td><td>{number(row.uses)}</td></>
                  : kind === 'offers' ? <><td><Status kind={kind} value={row.status} /></td><td>{TYPES[row.benefit_type] || row.benefit_type}</td><td>{number(row.uses)}</td><td>{date(row.ends_at)}</td></>
                    : <><td>{row.member_name || 'Sin nombre'}</td><td><Status kind={kind} value={row.status} /></td><td>{date(row.redeemed_at)}</td></>}
            </tr>)}</tbody>
          </table>
          {!report.records.rows.length && <p className="club-admin-empty">No hay registros con estos filtros.</p>}
        </div>
        <div className="club-admin-pagination"><button type="button" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Anterior</button><span>Página {page} de {pages}</span><button type="button" disabled={page >= pages} onClick={() => setPage(value => value + 1)}>Siguiente</button></div>
      </>}
    </div>
    <p className="club-admin-note">Las cifras de estado muestran la situación actual; el periodo solo filtra actividad y usos. Las versiones archivadas se conservan como historial. {excludeTests && 'Se excluyen los nombres o títulos que empiezan por [TEST].'} Este panel solo consulta datos.</p>
  </section>
}
