import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { PUNTO_HISPANO_SERVICES, fetchAllPuntoHispanoContacts, puntoHispanoContactsCsv } from '../../lib/puntoHispanoServices'
import './PuntoHispanoContacts.css'

const PAGE_SIZE = 50
const COLUMNS = 'id,user_name,user_email,category_label,service_label,created_at,placement'
const displayDate = value => new Date(value).toLocaleString('es-CH', { timeZone:'Europe/Zurich' })

export default function PuntoHispanoContacts() {
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [category, setCategory] = useState('')
  const [from, setFrom] = useState('')
  const [through, setThrough] = useState('')
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const exportingRef = useRef(false)
  const invalidDates = from && through && from > through

  function query({ count = false, cutoff } = {}) {
    let result = supabase.from('punto_hispano_contacts')
      .select(COLUMNS, count ? { count:'exact' } : {})
      .order('created_at', { ascending:false }).order('id', { ascending:false })
    if (category) result = result.eq('category_id', category)
    if (from) result = result.gte('created_at', `${from}T00:00:00.000Z`)
    if (through) {
      const end = new Date(`${through}T00:00:00.000Z`)
      end.setUTCDate(end.getUTCDate() + 1)
      result = result.lt('created_at', end.toISOString())
    }
    if (cutoff) result = result.lte('created_at', cutoff)
    return result
  }

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    if (invalidDates) {
      setRows([])
      setTotal(0)
      setLoading(false)
      return () => { active = false }
    }
    async function load() {
      try {
        const result = await query({ count:true }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
        if (!active) return
        if (result.error) throw result.error
        setRows(result.data || [])
        setTotal(result.count || 0)
      } catch {
        if (!active) return
        setRows([])
        setTotal(0)
        setError('No se pudieron cargar los contactos. Comprueba la conexión y que se haya aplicado punto_hispano_contacts.sql en Supabase.')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [page, category, from, through, revision])

  async function exportCsv() {
    if (exportingRef.current || invalidDates) return
    exportingRef.current = true
    setExporting(true)
    setError('')
    try {
      // Freeze the upper date boundary so incoming clicks don't shift pages.
      const cutoff = new Date().toISOString()
      const all = await fetchAllPuntoHispanoContacts((start, end) => query({ cutoff }).range(start, end))
      const url = URL.createObjectURL(new Blob([puntoHispanoContactsCsv(all)], { type:'text/csv;charset=utf-8;' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `punto-hispano-contactos-${cutoff.slice(0, 10)}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      setError('No se pudo completar la exportación. Vuelve a intentarlo; no se ha descargado un archivo parcial.')
    } finally {
      exportingRef.current = false
      setExporting(false)
    }
  }

  const changeFilter = setter => event => { setter(event.target.value); setPage(0) }

  return (
    <section className="ph-admin" aria-labelledby="ph-admin-title">
      <div className="ph-admin-heading">
        <div><h2 id="ph-admin-title">Contactos de Punto Hispano</h2><p>Seguimiento de clics en «Contactar por WhatsApp». No confirma el envío del mensaje.</p></div>
        <button type="button" onClick={exportCsv} disabled={loading || exporting || !total || Boolean(invalidDates)}>{exporting ? 'Exportando…' : 'Exportar para Excel (CSV)'}</button>
      </div>
      <div className="ph-admin-filters">
        <label>Categoría<select value={category} onChange={changeFilter(setCategory)} disabled={exporting}><option value="">Todas</option>{PUNTO_HISPANO_SERVICES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label>Desde (UTC)<input type="date" value={from} onChange={changeFilter(setFrom)} disabled={exporting} /></label>
        <label>Hasta (UTC)<input type="date" value={through} onChange={changeFilter(setThrough)} disabled={exporting} /></label>
        <button type="button" onClick={() => setRevision(value => value + 1)} disabled={loading || exporting}>Actualizar</button>
      </div>
      {invalidDates && <p role="alert">La fecha de inicio debe ser anterior o igual a la fecha final.</p>}
      {error && <p className="ph-admin-error" role="alert">{error}</p>}
      <p aria-live="polite">{loading ? 'Cargando contactos…' : `${total} clics registrados · La exportación incluye todos los resultados filtrados.`}</p>
      <div className="ph-admin-table" role="region" aria-label="Contactos registrados" tabIndex={0}>
        <table>
          <thead><tr>{['Nombre', 'Email', 'Categoría', 'Servicio', 'Fecha del clic (Suiza)'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
          <tbody>{!loading && rows.map(row => <tr key={row.id}><td>{row.user_name}</td><td>{row.user_email}</td><td>{row.category_label}</td><td>{row.service_label}</td><td>{displayDate(row.created_at)}</td></tr>)}</tbody>
        </table>
        {!loading && !error && !rows.length && <p>No hay contactos en este periodo.</p>}
      </div>
      <div className="ph-admin-pagination">
        <button type="button" disabled={!page || loading || exporting} onClick={() => setPage(value => value - 1)}>Anterior</button>
        <span>Página {page + 1} de {Math.max(1, Math.ceil(total / PAGE_SIZE))}</span>
        <button type="button" disabled={(page + 1) * PAGE_SIZE >= total || loading || exporting} onClick={() => setPage(value => value + 1)}>Siguiente</button>
      </div>
    </section>
  )
}
