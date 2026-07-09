import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { PP } from '../lib/theme'
import '../styles/latido-workcheck.css'
import {
  AGENCY_CANDIDATE_STATUSES,
  LABOR_SECTORS,
  TEMPORARY_AGENCIES,
  exportCandidatesCsv,
  formatLaborDate,
  getAgencyBySlug,
  getCandidateContact,
  getPortalCandidates,
  getProfileMobility,
  updatePortalCandidate,
} from '../lib/laborProfile'

function includesText(value, query) {
  return String(value || '').toLowerCase().includes(query)
}

function getCandidateName(candidate) {
  return candidate.candidate?.name || candidate.profileSnapshot?.candidateName || 'Candidato'
}

function getCandidateInitials(candidate) {
  return getCandidateName(candidate)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'LA'
}

function getForm(candidate) {
  return candidate.profileSnapshot?.form || {}
}

function getAnalysis(candidate) {
  return candidate.profileSnapshot?.analysis || {}
}

const TASK_SCORE = {
  seen:1,
  helped:2,
  guided:3,
  alone:4,
}

function getWorkKnowledge(candidate) {
  const form = getForm(candidate)
  let scoreCount = 0
  let scoreTotal = 0
  let readyCount = 0

  for (const value of Object.values(form.tasks || {})) {
    const score = TASK_SCORE[value] ?? 0
    if (score <= 0) continue
    scoreCount += 1
    scoreTotal += score
    if (score >= 3) readyCount += 1
  }

  const average = scoreCount
    ? scoreTotal / scoreCount
    : 0
  const analysis = getAnalysis(candidate)
  const fallbackReady = analysis.canDo?.length || 0
  const effectiveReady = Math.max(readyCount, fallbackReady)
  const technicalStrong = Number(analysis.technicalStrongCount || 0)
  const technicalWeak = Number(analysis.technicalWeakCount || 0)
  const technicalDanger = Number(analysis.technicalDangerCount || 0)
  const technicalDetail = technicalStrong
    ? ` · ${technicalStrong} técnica(s) fuertes`
    : ''

  if (!scoreCount && !fallbackReady && !technicalStrong && !technicalWeak && !technicalDanger) {
    return { label:'No demostrado', detail:'Sin tareas listas', score:0 }
  }
  if (technicalDanger >= 2) {
    return { label:'Bajo', detail:`${effectiveReady} tareas listas${technicalDetail}`, score:1 }
  }
  if ((effectiveReady >= 10 || average >= 3.35 || technicalStrong >= 2) && technicalDanger === 0) {
    return { label:'Alto', detail:`${effectiveReady} tareas listas${technicalDetail}`, score:3 }
  }
  if (effectiveReady >= 5 || average >= 2.4 || technicalStrong >= 1) {
    return { label:'Medio', detail:`${effectiveReady} tareas listas${technicalDetail}`, score:2 }
  }
  return { label:'Bajo', detail:`${effectiveReady} tareas listas${technicalDetail}`, score:1 }
}

function getSafetyKnowledge(candidate) {
  const analysis = getAnalysis(candidate)
  const dangerCount = Number(analysis.safetyDangerCount ?? analysis.dangerCount ?? 0)
  const strongCount = Number(analysis.safetyStrongCount ?? analysis.strongCount ?? 0)
  const weakCount = Number(analysis.safetyWeakCount ?? analysis.weakCount ?? 0)
  const strengths = analysis.strengths || []

  if (analysis.key === 'notRecommended' || dangerCount >= 2) return { label:'Baja', score:1 }
  if (dangerCount === 1 || weakCount > 1) return { label:'Media', score:2 }
  if (
    strongCount >= 6 ||
    strengths.some(item => String(item).toLowerCase().includes('seguridad') || String(item).toLowerCase().includes('criterio'))
  ) return { label:'Alta', score:3 }
  return { label:'Media', score:2 }
}

function getRecommendationTone(analysis = {}) {
  const status = String(analysis.status || '').toLowerCase()
  const profile = String(analysis.profile || '').toLowerCase()
  if (
    analysis.key === 'notRecommended' ||
    analysis.key === 'notReadyLegal' ||
    status.includes('no recomendable') ||
    status.includes('no enviable') ||
    profile.includes('no recomendable')
  ) return 'danger'
  if (
    analysis.key === 'notDemonstrated' ||
    analysis.key === 'officialUnproven' ||
    status.includes('reservas') ||
    status.includes('supervision') ||
    status.includes('supervisión') ||
    status.includes('no suficientemente')
  ) return 'warning'
  return 'success'
}

function getAvailabilityTone(value = '') {
  const text = String(value || '').toLowerCase()
  if (text.includes('inmediatamente')) return 'success'
  if (text.includes('semana')) return 'warning'
  return 'muted'
}

function getToneClass(tone) {
  return tone ? `portal-tone portal-tone--${tone}` : ''
}

function CandidateMobileCard({ candidate, onOpen, onUpdated }) {
  const form = getForm(candidate)
  const analysis = getAnalysis(candidate)
  const workKnowledge = getWorkKnowledge(candidate)
  const safetyKnowledge = getSafetyKnowledge(candidate)
  const recommendationTone = getRecommendationTone(analysis)
  const availabilityTone = getAvailabilityTone(form.start)
  const contact = candidate.candidate || {}
  const phoneClean = String(contact.phone || '').replace(/[^\d+]/g, '')

  const changeStatus = value => {
    updatePortalCandidate(candidate.id, { status:value })
    onUpdated()
  }

  return (
    <article className="portal-mobile-card">
      <div className="portal-mobile-card-head">
        <div className="portal-mobile-avatar" aria-hidden="true">{getCandidateInitials(candidate)}</div>
        <div>
          <button type="button" onClick={() => onOpen(candidate.id)}>{getCandidateName(candidate)}</button>
          <p>{LABOR_SECTORS[candidate.sector]?.label || candidate.sector} - {form.city || 'Sin ciudad'}</p>
        </div>
        <span className="portal-pill">{candidate.status || 'Nuevo'}</span>
      </div>
      <div className="portal-mobile-main">
        <div><span>Perfil</span><strong>{analysis.profile || '-'}</strong></div>
        <div><span>Valoración</span><strong className={getToneClass(recommendationTone)}>{analysis.status || '-'}</strong></div>
        <div><span>Trabajo</span><strong>{workKnowledge.label}</strong><small>{workKnowledge.detail}</small></div>
        <div><span>Seguridad</span><strong>{safetyKnowledge.label}</strong></div>
        <div><span>Disponible</span><strong className={getToneClass(availabilityTone)}>{form.start || '-'}</strong></div>
        <div><span>Coche</span><strong>{form.transport === 'Coche propio' ? 'Sí' : '-'}</strong></div>
      </div>
      <label className="portal-mobile-status">
        Estado
        <select value={candidate.status || 'Nuevo'} onChange={event => changeStatus(event.target.value)}>
          {AGENCY_CANDIDATE_STATUSES.map(status => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
      </label>
      <div className="portal-mobile-actions">
        <button type="button" onClick={() => onOpen(candidate.id)}>Ver ficha</button>
        {phoneClean && <a href={`https://wa.me/${phoneClean.replace(/^\+/, '')}`} target="_blank" rel="noreferrer">WhatsApp</a>}
        {phoneClean && <a href={`tel:${phoneClean}`}>Llamar</a>}
      </div>
    </article>
  )
}

function CandidateDetail({ candidate, onUpdated, detailRef, onClose = null, inModal = false }) {
  const [note, setNote] = useState(candidate.internalNote || '')
  useEffect(() => {
    setNote(candidate?.internalNote || '')
  }, [candidate?.id, candidate?.internalNote])

  if (!candidate) {
    return (
      <aside className="portal-detail" ref={detailRef}>
        <h2>Elige candidato</h2>
        <p>Abre la ficha con datos y contacto.</p>
      </aside>
    )
  }

  const form = getForm(candidate)
  const analysis = getAnalysis(candidate)
  const workKnowledge = getWorkKnowledge(candidate)
  const safetyKnowledge = getSafetyKnowledge(candidate)
  const recommendationTone = getRecommendationTone(analysis)
  const availabilityTone = getAvailabilityTone(form.start)
  const contact = candidate.candidate || {}
  const phoneClean = String(contact.phone || '').replace(/[^\d+]/g, '')

  const saveNote = () => {
    updatePortalCandidate(candidate.id, { internalNote:note })
    onUpdated()
  }

  const changeStatus = value => {
    updatePortalCandidate(candidate.id, { status:value })
    onUpdated()
  }

  return (
    <aside className={`portal-detail${inModal ? ' portal-detail--modal' : ''}`} ref={detailRef}>
      <div className="portal-detail-head">
        <div>
          <p className="portal-eyebrow">Ficha individual</p>
          <h2>{getCandidateName(candidate)}</h2>
          <p>{LABOR_SECTORS[candidate.sector]?.label || candidate.sector} - {analysis.profile || 'Sin clasificar'}</p>
        </div>
        <div className="portal-detail-actions">
          <select value={candidate.status || 'Nuevo'} onChange={event => changeStatus(event.target.value)}>
            {AGENCY_CANDIDATE_STATUSES.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Cerrar ficha">Cerrar</button>
          )}
        </div>
      </div>

      <div className="portal-facts">
        <div><span>Valoración</span><strong className={getToneClass(recommendationTone)}>{analysis.status || '-'}</strong></div>
        <div><span>Trabajo</span><strong>{workKnowledge.label}</strong><small>{workKnowledge.detail}</small></div>
        <div><span>Seguridad</span><strong>{safetyKnowledge.label}</strong></div>
        <div><span>Disponible</span><strong className={getToneClass(availabilityTone)}>{form.start || '-'}</strong></div>
        <div><span>Porcentaje</span><strong>{form.workload || '-'}</strong></div>
        <div><span>Horarios</span><strong>{(form.shifts || []).join(', ') || '-'}</strong></div>
        <div><span>Permiso</span><strong>{[form.permitType, form.permitValidity].filter(Boolean).join(' - ') || form.legal || '-'}</strong></div>
        <div><span>Coche</span><strong>{form.transport === 'Coche propio' ? 'Sí' : 'No confirmado'}</strong></div>
        <div><span>Ubicación</span><strong>{[form.location, form.city].filter(Boolean).join(' - ') || '-'}</strong></div>
        <div><span>Movilidad</span><strong>{getProfileMobility(form)}</strong></div>
        <div><span>Físico</span><strong>{[form.physicalLoad, form.weatherWork].filter(Boolean).join(' - ') || '-'}</strong></div>
        <div><span>Alemán</span><strong>{form.german || '-'}</strong></div>
        <div><span>Suiza</span><strong>{form.swissExperience || '-'}</strong></div>
        <div><span>Certificados</span><strong>{(form.certificates || []).join(', ') || '-'}</strong></div>
        <div><span>Referencias</span><strong>{[form.references, form.referencePermission].filter(Boolean).join(' - ') || '-'}</strong></div>
        <div><span>Salario</span><strong>{form.salaryExpectation || '-'}</strong></div>
        <div><span>Retrasos</span><strong>{form.reliability || '-'}</strong></div>
        <div><span>Último empleo</span><strong>{form.lastJobReason || '-'}</strong></div>
        <div><span>Actualizado</span><strong>{formatLaborDate(candidate.profileSnapshot?.updatedAt || candidate.sentAt)}</strong></div>
      </div>

      <div className={`portal-recommendation portal-recommendation--${recommendationTone}`}>
        <strong>Valoración Latido</strong>
        <p>{analysis.recommendation || 'Sin recomendación todavía.'}</p>
      </div>

      <div className="portal-contact-actions">
        {phoneClean && <a href={`https://wa.me/${phoneClean.replace(/^\+/, '')}`} target="_blank" rel="noreferrer">WhatsApp</a>}
        {phoneClean && <a href={`tel:${phoneClean}`}>Llamar</a>}
        {contact.email && <a href={`mailto:${contact.email}`}>Email</a>}
      </div>

      <div className="portal-lists">
        <section>
          <h3>Tareas</h3>
          {(analysis.canDo?.length ? analysis.canDo : ['Pendiente de completar']).slice(0, 10).map(item => <span key={item}>{item}</span>)}
        </section>
        <section>
          <h3>Pendiente</h3>
          {(analysis.notDemonstrated?.length ? analysis.notDemonstrated : ['Sin pendientes']).slice(0, 10).map(item => <span key={item}>{item}</span>)}
        </section>
        <section>
          <h3>Fortalezas</h3>
          {(analysis.strengths?.length ? analysis.strengths : ['Completar más datos']).map(item => <span key={item}>{item}</span>)}
        </section>
        <section>
          <h3>Riesgos</h3>
          {(analysis.risks?.length ? analysis.risks : ['Sin riesgos destacados']).map(item => <span key={item}>{item}</span>)}
        </section>
      </div>

      <label className="portal-note">
        <span>Nota interna</span>
        <textarea value={note} onChange={event => setNote(event.target.value)} placeholder="Ej.: llamar por la tarde" />
      </label>
      <button className="portal-save-note" type="button" onClick={saveNote}>Guardar nota</button>
    </aside>
  )
}

export default function PortalTemporera() {
  const { agencySlug = 'aha-personal' } = useParams()
  const [version, setVersion] = useState(0)
  const [selectedId, setSelectedId] = useState('')
  const [modalCandidateId, setModalCandidateId] = useState('')
  const detailRef = useRef(null)
  const [filters, setFilters] = useState({
    search:'',
    sector:'all',
    profile:'all',
    valuation:'all',
    status:'all',
    availability:'all',
    car:'all',
    swiss:'all',
    german:'all',
  })

  const agency = getAgencyBySlug(agencySlug) || TEMPORARY_AGENCIES[0]
  const candidates = useMemo(
    () => getPortalCandidates({ agencySlug:agency.slug, includeVisible:true, includeDemo:true }),
    [agency.slug, version],
  )

  const profileOptions = useMemo(() => {
    const values = new Set(candidates.map(item => getAnalysis(item).profile).filter(Boolean))
    return Array.from(values)
  }, [candidates])
  const valuationOptions = useMemo(() => {
    const values = new Set(candidates.map(item => getAnalysis(item).status).filter(Boolean))
    return Array.from(values)
  }, [candidates])

  const filtered = useMemo(() => {
    const query = filters.search.trim().toLowerCase()
    return candidates.filter(candidate => {
      const form = getForm(candidate)
      const analysis = getAnalysis(candidate)
      const workKnowledge = getWorkKnowledge(candidate)
      const safetyKnowledge = getSafetyKnowledge(candidate)
      const name = getCandidateName(candidate)
      if (query && ![
        name,
        form.city,
        form.role,
        form.permitType,
        form.permitValidity,
        form.workload,
        (form.shifts || []).join(' '),
        form.physicalLoad,
        form.weatherWork,
        form.salaryExpectation,
        (form.certificates || []).join(' '),
        analysis.profile,
        analysis.status,
        workKnowledge.label,
        safetyKnowledge.label,
        getCandidateContact(candidate.candidate),
      ].some(value => includesText(value, query))) return false
      if (filters.sector !== 'all' && candidate.sector !== filters.sector) return false
      if (filters.profile !== 'all' && analysis.profile !== filters.profile) return false
      if (filters.valuation !== 'all' && analysis.status !== filters.valuation) return false
      if (filters.status !== 'all' && candidate.status !== filters.status) return false
      if (filters.availability === 'immediate' && form.start !== 'Inmediatamente') return false
      if (filters.car === 'yes' && form.transport !== 'Coche propio') return false
      if (filters.swiss === 'yes' && form.swissExperience !== 'Si' && form.swissExperience !== 'Sí') return false
      if (filters.german === 'basic' && ['Nada', '', undefined].includes(form.german)) return false
      return true
    })
  }, [candidates, filters])

  const selected = filtered.find(item => item.id === selectedId) || filtered[0] || null
  const modalCandidate = filtered.find(item => item.id === modalCandidateId) || null

  const stats = {
    total:candidates.length,
    week:candidates.filter(item => Date.now() - new Date(item.sentAt || 0).getTime() < 7 * 24 * 60 * 60 * 1000).length,
    construction:candidates.filter(item => item.sector === 'construction').length,
    ready:candidates.filter(item => ['Apto', 'Apto con reservas'].includes(getAnalysis(item).status)).length,
    immediate:candidates.filter(item => getForm(item).start === 'Inmediatamente').length,
    car:candidates.filter(item => getForm(item).transport === 'Coche propio').length,
  }

  const setFilter = (key, value) => setFilters(current => ({ ...current, [key]:value }))
  const refresh = () => setVersion(current => current + 1)
  const openCandidate = id => {
    setSelectedId(id)
    setModalCandidateId(id)
  }

  useEffect(() => {
    if (!modalCandidateId) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [modalCandidateId])

  return (
    <main className="portal-page" style={{ fontFamily:PP }}>
      <style>{`
        .portal-page {
          min-height: 100vh;
          background: #eef4ff;
          color: #0f172a;
          padding: 22px 24px 112px;
        }
        .portal-shell {
          max-width: 1280px;
          margin: 0 auto;
        }
        .portal-top {
          position: relative;
          overflow: hidden;
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 16px;
          align-items: center;
          justify-items: center;
          text-align: center;
          background: linear-gradient(160deg, #1e40af 0%, #2563eb 58%, #60a5fa 100%);
          border: 0;
          border-radius: 28px;
          padding: 26px 24px;
          box-shadow: 0 22px 48px rgba(37,99,235,.24);
          margin-bottom: 18px;
          color: #fff;
        }
        .portal-top::after {
          content: '';
          position: absolute;
          inset: 0 0 0 auto;
          width: 48%;
          background: linear-gradient(135deg, rgba(255,255,255,.13), rgba(255,255,255,0));
          clip-path: polygon(22% 0, 100% 0, 100% 100%, 0 100%);
          pointer-events: none;
        }
        .portal-top > * {
          position: relative;
          z-index: 1;
        }
        .portal-eyebrow {
          display: inline-flex;
          align-items: center;
          min-height: 26px;
          margin: 0 0 12px;
          padding: 0 10px;
          border-radius: 999px;
          background: rgba(255,255,255,.15);
          border: 1px solid rgba(255,255,255,.22);
          color: rgba(255,255,255,.92);
          font-size: 10.5px;
          font-weight: 900;
          letter-spacing: .7px;
          text-transform: uppercase;
        }
        .portal-top h1 {
          margin: 0;
          color: #fff;
          font-size: clamp(32px, 5.6vw, 50px);
          line-height: 1.08;
          letter-spacing: 0;
        }
        .portal-top p,
        .portal-detail p {
          margin: 8px 0 0;
          color: #64748b;
          font-size: 13px;
          line-height: 1.6;
        }
        .portal-top p {
          max-width: 560px;
          color: rgba(255,255,255,.86);
          font-size: 14px;
          line-height: 1.55;
          margin-left: auto;
          margin-right: auto;
        }
        .portal-top-meta {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 8px;
          margin-top: 14px;
        }
        .portal-top-meta span {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-height: 28px;
          padding: 0 9px;
          border-radius: 999px;
          background: rgba(255,255,255,.14);
          border: 1px solid rgba(255,255,255,.24);
          color: #fff;
          font-size: 10.5px;
          font-weight: 800;
          white-space: nowrap;
        }
        .portal-top-meta strong {
          font-size: 13px;
          line-height: 1;
        }
        .portal-top-actions {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 9px;
          width: min(430px, 100%);
          min-width: 0;
        }
        .portal-top-actions a,
        .portal-top-actions button {
          min-height: 38px;
          border: 1.5px solid rgba(255,255,255,.32);
          border-radius: 999px;
          background: rgba(255,255,255,.16);
          color: #fff;
          font: 900 11.5px ${PP};
          padding: 0 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          cursor: pointer;
          box-shadow: 0 10px 24px rgba(30,64,175,.12);
        }
        .portal-top-actions a:first-child {
          background: #fff;
          border-color: #fff;
          color: #2563eb;
        }
        .portal-top-actions a.secondary {
          background: rgba(255,255,255,.16);
          color: #fff;
        }
        .portal-save-note {
          min-height: 44px;
          border: 1.5px solid #bfdbfe;
          border-radius: 16px;
          background: #2563eb;
          color: #fff;
          font: 900 12px ${PP};
          padding: 0 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          cursor: pointer;
        }
        .portal-filters,
        .portal-table-card,
        .portal-detail {
          background: #fff;
          border: 1px solid #d8e3f3;
          border-radius: 22px;
          box-shadow: 0 12px 32px rgba(30,64,175,.06);
        }
        .portal-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(340px, 420px);
          gap: 16px;
          align-items: start;
        }
        .portal-filters {
          grid-column: 1 / -1;
          background: transparent;
          border: 0;
          border-radius: 0;
          box-shadow: none;
          padding: 0;
          margin: 4px 0 0;
        }
        .portal-layout .portal-filters {
          display: none;
        }
        .portal-top .portal-filters {
          display: block;
        }
        .portal-searchbar {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 9px;
          align-items: end;
          width: min(620px, 100%);
          max-width: none;
          margin: 0 auto;
        }
        .portal-searchbar label {
          position: relative;
          display: block;
          color: rgba(255,255,255,.88);
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .7px;
          text-transform: uppercase;
        }
        .portal-searchbar label > span {
          position: absolute;
          left: 16px;
          top: 50%;
          z-index: 1;
          padding: 0;
          font-size: 0;
          line-height: 1;
          transform: translateY(-50%);
          pointer-events: none;
        }
        .portal-searchbar label > span::before {
          content: '🔎';
          font-size: 17px;
          line-height: 1;
        }
        .portal-searchbar input {
          width: 100%;
          min-height: 48px;
          border: 1.5px solid rgba(255,255,255,.62);
          border-radius: 16px;
          background: #fff;
          color: #0f172a;
          font: 700 13px ${PP};
          padding: 0 14px 0 46px;
          box-sizing: border-box;
          box-shadow: 0 10px 24px rgba(30,64,175,.16);
        }
        .portal-searchbar input::placeholder {
          color: #9ca3af;
          font-weight: 700;
        }
        .portal-searchbar button {
          min-height: 48px;
          border: 1.5px solid rgba(255,255,255,.32);
          border-radius: 999px;
          background: rgba(255,255,255,.18);
          color: #fff;
          font: 900 11.5px ${PP};
          padding: 0 14px;
          cursor: pointer;
          box-shadow: 0 10px 24px rgba(30,64,175,.14);
        }
        .portal-filter-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
          width: min(760px, 100%);
          margin: 12px auto 0;
        }
        .portal-filter-grid label {
          display: grid;
          gap: 5px;
          color: rgba(255,255,255,.88);
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .7px;
          text-transform: uppercase;
        }
        .portal-filter-grid input,
        .portal-filter-grid select,
        .portal-detail select,
        .portal-note textarea {
          width: 100%;
          border: 1.5px solid #d8e3f3;
          border-radius: 14px;
          background: #fff;
          color: #0f172a;
          font: 800 13px ${PP};
          box-sizing: border-box;
        }
        .portal-filter-grid input,
        .portal-filter-grid select,
        .portal-detail select {
          min-height: 42px;
          padding: 0 11px;
        }
        .portal-table-card {
          overflow: hidden;
        }
        .portal-mobile-list {
          display: none;
        }
        .portal-table {
          width: 100%;
          border-collapse: collapse;
        }
        .portal-table th,
        .portal-table td {
          padding: 12px 10px;
          border-bottom: 1px solid #e2eaf4;
          text-align: left;
          vertical-align: top;
          font-size: 12px;
        }
        .portal-table th {
          color: #64748b;
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          background: #f8fbff;
        }
        .portal-table button {
          border: 0;
          background: transparent;
          color: #2563eb;
          font: 900 12px ${PP};
          cursor: pointer;
          padding: 0;
          text-align: left;
        }
        .portal-table p {
          margin: 3px 0 0;
          color: #64748b;
          font-size: 11px;
          line-height: 1.4;
        }
        .portal-knowledge-cell strong {
          display: block;
          color: #0f172a;
          font-size: 12px;
          line-height: 1.35;
          overflow-wrap: anywhere;
        }
        .portal-knowledge-cell p {
          margin-top: 4px;
        }
        .portal-pill {
          display: inline-flex;
          align-items: center;
          min-height: 26px;
          border-radius: 999px;
          padding: 0 9px;
          background: #eff6ff;
          color: #1d4ed8;
          font-size: 10px;
          font-weight: 900;
          white-space: nowrap;
        }
        .portal-detail {
          position: sticky;
          top: 82px;
          padding: 18px;
        }
        .portal-detail-head {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 10px;
          align-items: start;
        }
        .portal-detail-actions {
          display: flex;
          gap: 8px;
          align-items: start;
        }
        .portal-detail-actions button {
          min-height: 48px;
          border: 1.5px solid #bfdbfe;
          border-radius: 16px;
          background: #fff;
          color: #2563eb;
          font: 900 12px ${PP};
          padding: 0 13px;
          cursor: pointer;
        }
        .portal-detail h2 {
          margin: 0;
          font-size: 24px;
          line-height: 1.1;
        }
        .portal-facts {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin: 14px 0;
        }
        .portal-facts div {
          background: #f8fbff;
          border: 1px solid #d8e3f3;
          border-radius: 16px;
          padding: 12px;
          min-width: 0;
        }
        .portal-facts span {
          display: block;
          color: #64748b;
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .portal-facts strong {
          display: block;
          font-size: 12px;
          line-height: 1.35;
          overflow-wrap: anywhere;
        }
        .portal-facts small,
        .portal-mobile-main small {
          display: block;
          color: #64748b;
          font-size: 10.5px;
          font-weight: 800;
          line-height: 1.35;
          margin-top: 4px;
        }
        .portal-recommendation {
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 16px;
          padding: 12px;
        }
        .portal-recommendation--success {
          background: #ecfdf5;
          border-color: #99f6e4;
        }
        .portal-recommendation--warning {
          background: #fff7ed;
          border-color: #fed7aa;
        }
        .portal-recommendation--danger {
          background: #fef2f2;
          border-color: #fecaca;
        }
        .portal-recommendation strong {
          display: block;
          color: #1e3a8a;
          font-size: 12px;
        }
        .portal-recommendation--success strong,
        .portal-recommendation--success p {
          color: #0f766e;
        }
        .portal-recommendation--warning strong,
        .portal-recommendation--warning p {
          color: #b45309;
        }
        .portal-recommendation--danger strong,
        .portal-recommendation--danger p {
          color: #b91c1c;
        }
        .portal-contact-actions {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          margin: 12px 0;
        }
        .portal-contact-actions a {
          min-height: 42px;
          border-radius: 13px;
          background: #2563eb;
          color: #fff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          font-size: 12px;
          font-weight: 900;
        }
        .portal-lists {
          display: grid;
          gap: 10px;
        }
        .portal-lists section {
          border-top: 1px solid #e2eaf4;
          padding-top: 10px;
        }
        .portal-lists h3 {
          margin: 0 0 8px;
          font-size: 13px;
        }
        .portal-lists span {
          display: inline-flex;
          margin: 0 6px 6px 0;
          border-radius: 999px;
          padding: 7px 9px;
          background: #f8fbff;
          border: 1px solid #dce8f6;
          color: #334155;
          font-size: 11px;
          font-weight: 800;
          line-height: 1.25;
        }
        .portal-note {
          display: grid;
          gap: 7px;
          margin-top: 12px;
          color: #64748b;
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
        }
        .portal-note textarea {
          min-height: 90px;
          padding: 12px;
          resize: vertical;
          text-transform: none;
        }
        .portal-save-note {
          width: 100%;
          margin-top: 8px;
        }
        .portal-mobile-card,
        .portal-mobile-empty {
          background: #fff;
          border: 1px solid #d8e3f3;
          border-radius: 22px;
          box-shadow: 0 12px 30px rgba(30,64,175,.06);
        }
        .portal-mobile-card {
          padding: 13px;
        }
        .portal-mobile-empty {
          padding: 16px;
          color: #64748b;
          font-size: 13px;
          font-weight: 800;
        }
        .portal-mobile-card-head {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 10px;
          align-items: start;
          margin-bottom: 11px;
        }
        .portal-mobile-card-head button {
          border: 0;
          background: transparent;
          color: #0f172a;
          font: 900 16px ${PP};
          line-height: 1.22;
          text-align: left;
          padding: 0;
          cursor: pointer;
        }
        .portal-mobile-card-head p {
          margin: 4px 0 0;
          color: #64748b;
          font-size: 12px;
          line-height: 1.45;
        }
        .portal-mobile-main {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }
        .portal-mobile-main div {
          background: #f8fbff;
          border: 1px solid #d8e3f3;
          border-radius: 16px;
          padding: 12px;
          min-width: 0;
        }
        .portal-mobile-main span,
        .portal-mobile-status {
          color: #64748b;
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
        }
        .portal-mobile-main span {
          display: block;
          margin-bottom: 4px;
        }
        .portal-mobile-main strong {
          display: block;
          color: #0f172a;
          font-size: 12px;
          line-height: 1.35;
          overflow-wrap: anywhere;
        }
        .portal-mobile-status {
          display: grid;
          gap: 6px;
          margin-top: 10px;
        }
        .portal-mobile-status select {
          width: 100%;
          min-height: 44px;
          border: 1.5px solid #d8e3f3;
          border-radius: 16px;
          background: #fff;
          color: #0f172a;
          font: 800 12px ${PP};
          padding: 0 10px;
          box-sizing: border-box;
        }
        .portal-mobile-actions {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          margin-top: 10px;
        }
        .portal-mobile-actions a,
        .portal-mobile-actions button {
          min-height: 48px;
          border: 1.5px solid #bfdbfe;
          border-radius: 16px;
          background: #2563eb;
          color: #fff;
          font: 900 12px ${PP};
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          padding: 0 8px;
          text-align: center;
        }
        .portal-modal {
          position: fixed;
          inset: 0;
          z-index: 220;
          display: grid;
          place-items: center;
          padding: 18px;
        }
        .portal-modal-backdrop {
          position: absolute;
          inset: 0;
          background: rgba(15, 23, 42, .42);
        }
        .portal-modal-panel {
          position: relative;
          width: min(920px, 100%);
          max-height: min(860px, calc(100vh - 36px));
          overflow: auto;
          border-radius: 22px;
          box-shadow: 0 24px 70px rgba(15, 23, 42, .28);
          background: #fff;
        }
        .portal-detail--modal {
          position: static;
          box-shadow: none;
          border: 0;
          border-radius: 22px;
        }
        .portal-detail--modal .portal-facts {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        @media (max-width: 980px) {
          .portal-top,
          .portal-layout,
          .portal-detail-head {
            grid-template-columns: 1fr;
          }
          .portal-top-actions {
            min-width: 0;
            width: 100%;
          }
          .portal-top-actions a,
          .portal-top-actions button {
            width: auto;
          }
          .portal-detail {
            position: static;
          }
          .portal-filter-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 900px) {
          .portal-layout > .portal-detail {
            display: none;
          }
          .portal-table-card {
            display: none;
          }
          .portal-mobile-list {
            display: grid;
            gap: 10px;
          }
        }
        @media (max-width: 680px) {
          .portal-page { padding: 12px 20px 104px; }
          .portal-top {
            margin: -12px -20px 20px;
            padding: 30px 20px 18px;
            border-radius: 0 0 28px 28px;
          }
          .portal-top::after {
            width: 72%;
          }
          .portal-top h1 {
            font-size: 32px;
          }
          .portal-top p {
            font-size: 13px;
          }
          .portal-top-meta {
            display: flex;
            flex-wrap: nowrap;
            overflow-x: auto;
            justify-content: flex-start;
            width: 100%;
            padding-bottom: 2px;
            -webkit-overflow-scrolling: touch;
          }
          .portal-top-meta span {
            justify-content: center;
            flex: 0 0 auto;
            min-width: 0;
            padding: 0 8px;
            font-size: 10px;
          }
          .portal-top-meta strong {
            font-size: 14px;
          }
          .portal-top-actions {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 8px;
            width: 100%;
          }
          .portal-top-actions a,
          .portal-top-actions button {
            width: auto;
            min-height: 38px;
            padding: 0 8px;
            font-size: 10px;
            text-align: center;
          }
          .portal-filters,
          .portal-detail {
            border-radius: 20px;
          }
          .portal-searchbar {
            grid-template-columns: minmax(0, 1fr) auto;
            width: 100%;
          }
          .portal-searchbar input {
            min-height: 46px;
            border-radius: 15px;
            font-size: 13px;
          }
          .portal-searchbar button {
            min-height: 46px;
            padding: 0 12px;
          }
          .portal-filter-grid {
            display: none;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .portal-filter-grid--open {
            display: grid;
          }
          .portal-filter-grid input,
          .portal-filter-grid select {
            min-height: 42px;
            font-size: 12.5px;
          }
          .portal-facts {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .portal-contact-actions,
          .portal-mobile-actions {
            grid-template-columns: 1fr;
          }
          .portal-detail h2 {
            font-size: 22px;
          }
          .portal-modal {
            padding: 0;
            place-items: stretch;
          }
          .portal-modal-panel {
            width: 100%;
            max-height: 100vh;
            border-radius: 0;
          }
          .portal-detail--modal {
            display: block;
            min-height: 100vh;
            border-radius: 0;
            padding: 14px;
          }
          .portal-detail--modal .portal-detail-head {
            grid-template-columns: 1fr;
          }
          .portal-detail-actions {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            width: 100%;
          }
          .portal-detail-actions select {
            min-width: 0;
          }
          .portal-detail-actions button {
            min-width: 86px;
          }
        }
      `}</style>

      <div className="portal-shell">
        <section className="portal-top">
          <div className="portal-top-main">
            <img className="portal-top-logo" src="/favicon.svg" alt="Latido" />
            <div>
              <h1>{agency.name}</h1>
              <p>Portal · Perfil laboral</p>
            </div>
            <button className="portal-csv-button" type="button" onClick={() => exportCandidatesCsv(filtered)}>↓ CSV</button>
          </div>
          <div className="portal-top-meta" aria-label="Resumen rapido">
            <span><strong>{stats.total}</strong> candidatos</span>
            <span><strong>{stats.week}</strong> esta semana</span>
            <span><strong>{stats.immediate}</strong> inmediatos</span>
          </div>
          <div className="portal-searchbar">
            <label>
              <span>Buscar</span>
              <input value={filters.search} onChange={event => setFilter('search', event.target.value)} placeholder="Nombre, ciudad, perfil..." />
            </label>
          </div>
        </section>

        <section className="portal-filter-strip" aria-label="Filtros del portal">
          <label className="portal-filter-pill">
            <span>🏗 Sector ·</span>
            <select value={filters.sector} onChange={event => setFilter('sector', event.target.value)}>
              <option value="all">Todos</option>
              {Object.values(LABOR_SECTORS).map(sector => <option key={sector.id} value={sector.id}>{sector.label}</option>)}
            </select>
          </label>
          <label className="portal-filter-pill">
            <span>👷 Perfil ·</span>
            <select value={filters.profile} onChange={event => setFilter('profile', event.target.value)}>
              <option value="all">Todos</option>
              {profileOptions.map(profile => <option key={profile} value={profile}>{profile}</option>)}
            </select>
          </label>
          <label className="portal-filter-pill">
            <span>Valoración ·</span>
            <select value={filters.valuation} onChange={event => setFilter('valuation', event.target.value)}>
              <option value="all">Todas</option>
              {valuationOptions.map(valuation => <option key={valuation} value={valuation}>{valuation}</option>)}
            </select>
          </label>
          <label className="portal-filter-pill">
            <span>Estado ·</span>
            <select value={filters.status} onChange={event => setFilter('status', event.target.value)}>
              <option value="all">Todos</option>
              {AGENCY_CANDIDATE_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
          <label className="portal-filter-pill">
            <span>Disponible ·</span>
            <select value={filters.availability} onChange={event => setFilter('availability', event.target.value)}>
              <option value="all">Todas</option>
              <option value="immediate">Inmediata</option>
            </select>
          </label>
          <label className="portal-filter-pill">
            <span>Coche ·</span>
            <select value={filters.car} onChange={event => setFilter('car', event.target.value)}>
              <option value="all">Todos</option>
              <option value="yes">Con coche</option>
            </select>
          </label>
          <label className="portal-filter-pill">
            <span>Suiza ·</span>
            <select value={filters.swiss} onChange={event => setFilter('swiss', event.target.value)}>
              <option value="all">Todos</option>
              <option value="yes">Con experiencia</option>
            </select>
          </label>
          <label className="portal-filter-pill">
            <span>Alemán ·</span>
            <select value={filters.german} onChange={event => setFilter('german', event.target.value)}>
              <option value="all">Todos</option>
              <option value="basic">Básico o más</option>
            </select>
          </label>
        </section>

        <div className="portal-layout">
          <div>
            <section className="portal-table-card">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Sector</th>
                    <th>Perfil</th>
                    <th>Valoración</th>
                    <th>Trabajo</th>
                    <th>Seguridad</th>
                    <th>Disponible</th>
                    <th>Coche</th>
                    <th>Ubicación</th>
                    <th>Estado</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(candidate => {
                    const form = getForm(candidate)
                    const analysis = getAnalysis(candidate)
                    const workKnowledge = getWorkKnowledge(candidate)
                    const safetyKnowledge = getSafetyKnowledge(candidate)
                    return (
                      <tr key={candidate.id}>
                        <td>
                          <button type="button" onClick={() => openCandidate(candidate.id)}>{getCandidateName(candidate)}</button>
                          <p>{getCandidateContact(candidate.candidate)}</p>
                        </td>
                        <td>{LABOR_SECTORS[candidate.sector]?.label || candidate.sector}</td>
                        <td>{analysis.profile || '-'}</td>
                        <td>{analysis.status || '-'}</td>
                        <td className="portal-knowledge-cell">
                          <strong>Conocimiento del trabajo - {workKnowledge.label}</strong>
                          <p>{workKnowledge.detail}</p>
                        </td>
                        <td className="portal-knowledge-cell">
                          <strong>{safetyKnowledge.label}</strong>
                        </td>
                        <td>{form.start || '-'}</td>
                        <td>{form.transport === 'Coche propio' ? 'Sí' : '-'}</td>
                        <td>{[form.location, form.city].filter(Boolean).join(' - ') || '-'}</td>
                        <td><span className="portal-pill">{candidate.status || 'Nuevo'}</span></td>
                        <td><button type="button" onClick={() => openCandidate(candidate.id)}>Ver</button></td>
                      </tr>
                    )
                  })}
                  {!filtered.length && (
                    <tr>
                      <td colSpan="11">No hay candidatos con esos filtros.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>

            <section className="portal-mobile-list" aria-label="Candidatos">
              {filtered.map(candidate => (
                <CandidateMobileCard
                  key={candidate.id}
                  candidate={candidate}
                  onOpen={openCandidate}
                  onUpdated={refresh}
                />
              ))}
              {!filtered.length && (
                <div className="portal-mobile-empty">No hay candidatos con esos filtros.</div>
              )}
            </section>
          </div>

          <CandidateDetail candidate={selected} onUpdated={refresh} detailRef={detailRef} />
        </div>

        {modalCandidate && (
          <div className="portal-modal" role="dialog" aria-modal="true" aria-label={`Ficha de ${getCandidateName(modalCandidate)}`}>
            <div className="portal-modal-backdrop" onClick={() => setModalCandidateId('')} />
            <div className="portal-modal-panel">
              <CandidateDetail
                candidate={modalCandidate}
                onUpdated={refresh}
                onClose={() => setModalCandidateId('')}
                inModal
              />
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
