import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { FOLLOWUP_REASONS } from '../../lib/conversationFollowups'
import './ConversationFollowUpReport.css'

const LABELS = { pending: 'Sin confirmar', not_yet: 'En proceso', yes: 'Conseguido', no: 'No conseguido' }
const date = value => value ? new Date(value).toLocaleString('es-ES', { timeZone: 'Europe/Zurich', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

export default function ConversationFollowUpReport({ initiallyOpen = false, refreshKey = 0, onStatus }) {
  const [open, setOpen] = useState(initiallyOpen)
  const [outcome, setOutcome] = useState('all')
  const [page, setPage] = useState(1)
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    if (!open) return undefined
    let active = true
    setReport(null); setError('')
    onStatus?.({ loading: true, error: false, updatedAt: null })
    async function load() {
      try {
        const { data, error } = await supabase.rpc('cf_admin_report', { p_outcome: outcome, p_page: page })
        if (error) throw error
        if (active) { setReport(data); onStatus?.({ loading: false, error: false, updatedAt: Date.now() }) }
      } catch {
        if (active) { setError('No se han podido cargar los seguimientos. Vuelve a intentarlo con «Actualizar resultados».'); onStatus?.({ loading: false, error: true, updatedAt: null }) }
      }
    }
    void load()
    return () => { active = false }
  }, [open, outcome, page, revision, refreshKey, onStatus])
  return <section className="adm-surface followup-report" aria-label="Resultados de las consultas">
    <h2>Resultados de las consultas</h2>
    <p className="followup-report__intro">La primera pregunta llega 7 días después del primer mensaje. «Sí» y «No» cierran el seguimiento; «En proceso» programa otra pregunta en 7 días.</p>
    {!initiallyOpen && <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open}>{open ? 'Ocultar resultados' : 'Ver resultados de las consultas'}</button>}
    {open && <>
      {report?.summary && <div className="followup-report__summary" aria-label="Resumen del seguimiento">{[['total', 'Consultas'], ['yes', 'Conseguidas'], ['not_yet', 'En proceso'], ['no', 'No conseguidas'], ['pending', 'Sin confirmar']].map(([key, label]) => <div key={key} className={`followup-report__metric followup-report__metric--${key}`}><span>{label}</span><strong>{report.summary[key] ?? 0}</strong></div>)}</div>}
      <div className="followup-report__filters"><label>Resultado<select aria-label="Resultado" value={outcome} onChange={e => { setOutcome(e.target.value); setPage(1) }}><option value="all">Todos</option>{Object.entries(LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}<option value="test">Solo pruebas</option></select></label><button type="button" onClick={() => setRevision(value => value + 1)}>Actualizar resultados</button></div>
      {error && <p role="alert" className="followup-report__error">{error}</p>}
      {!report && !error && <p role="status">Cargando resultados…</p>}
      {report && <>
        <p className="followup-report__count">{report.total} {outcome === 'test' ? 'consultas de prueba' : 'consultas'}{outcome !== 'test' && report.test_count > 0 ? ' · Las pruebas no cuentan en los resultados.' : ''}</p>
        {report.rows.length === 0 && <div className="followup-report__empty">{outcome === 'all' ? 'Todavía no hay consultas en seguimiento. Se añadirán al iniciar nuevas conversaciones sobre anuncios o servicios.' : 'No hay consultas con este resultado.'}</div>}
        {report.rows.map(row => <article key={row.id} className={`followup-report__row followup-report__row--${row.outcome}`}>
          <div className="followup-report__person"><strong>{row.name || 'Usuario'} · {LABELS[row.outcome]}</strong>{row.is_test && <span className="followup-report__test">Prueba</span>}</div>
          <p className="followup-report__title">{row.title}</p><p className="followup-report__contact">Contacto: {row.owner_name || 'Sin nombre'}{row.email && !row.is_test && <> · <a href={`mailto:${row.email}`}>{row.email}</a></>}</p>
          <dl className="followup-report__dates"><div><dt>Primer mensaje</dt><dd>{date(row.first_message_at)}</dd></div><div><dt>{row.answered_at ? 'Última respuesta' : 'Primera pregunta'}</dt><dd>{date(row.answered_at || row.due_at)}</dd></div>{row.outcome === 'not_yet' && <div><dt>Próxima pregunta</dt><dd>{date(row.due_at)}</dd></div>}</dl>
          {row.no_reason && <p>Motivo: {FOLLOWUP_REASONS[row.no_reason]}</p>}
          <p className="followup-report__source">{row.answered_at ? `Confirmado por el usuario desde ${row.last_channel === 'email' ? 'el correo' : 'el chat'}` : row.email_sent_at || row.push_sent_at ? 'Aviso enviado · Pendiente de respuesta' : 'Todavía no ha respondido'}</p>
          {row.delivery_error && <p className="followup-report__error">No se pudo entregar un aviso. El envío se volverá a intentar.</p>}
          {row.history?.length > 0 && <details className="followup-report__history"><summary>Historial de respuestas ({row.history.length})</summary><ol>{row.history.map(item => <li key={item.round}><strong>{LABELS[item.answer]}</strong> · {item.channel === 'email' ? 'Correo' : 'Chat'} · {date(item.answered_at)}{item.reason && <> · {FOLLOWUP_REASONS[item.reason]}</>}</li>)}</ol></details>}
        </article>)}
        {report.total > 25 && <nav className="followup-report__pagination" aria-label="Páginas de seguimiento"><button type="button" disabled={page === 1} onClick={() => setPage(value => value - 1)}>Anterior</button><span>Página {page}</span><button type="button" disabled={page * 25 >= report.total} onClick={() => setPage(value => value + 1)}>Siguiente</button></nav>}
      </>}
    </>}
  </section>
}
