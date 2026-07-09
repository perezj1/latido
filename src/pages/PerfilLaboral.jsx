import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { PP } from '../lib/theme'
import {
  LABOR_SECTORS,
  LABOR_STATUS_META,
  LABOR_VISIBILITY,
  TEMPORARY_AGENCIES,
  deleteLaborProfile,
  formatLaborDate,
  getLaborProfiles,
  getLaborSubmissions,
  getProfileMobility,
  submitLaborProfile,
  updateLaborProfileVisibility,
} from '../lib/laborProfile'

function statusLabel(status) {
  return LABOR_STATUS_META[status]?.label || status || 'Incompleto'
}

function compactStatusLabel(status) {
  if (status === 'sent') return 'Enviado'
  if (status === 'ready') return 'Listo'
  return statusLabel(status)
}

function getInitials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'LA'
  return parts.slice(0, 2).map(part => part[0]?.toUpperCase()).join('')
}

function getRatingTone(status = '') {
  const text = String(status).toLowerCase()
  if (text.includes('apto') && !text.includes('reserva')) return 'success'
  if (text.includes('reserva') || text.includes('supervisi') || text.includes('no recomendable')) return 'warning'
  if (text.includes('no enviable')) return 'danger'
  return 'muted'
}

function ProfileCard({ profile, user, onChanged }) {
  const [agencySlug, setAgencySlug] = useState(TEMPORARY_AGENCIES[0]?.slug || '')
  const [message, setMessage] = useState('')
  const [notice, setNotice] = useState('')
  const form = profile.form || {}
  const analysis = profile.analysis || {}
  const sectorLabel = LABOR_SECTORS[profile.sector]?.label || profile.sector
  const ratingTone = getRatingTone(analysis.status)

  const send = () => {
    submitLaborProfile({ profile, agencySlug, user, message })
    setNotice('Perfil enviado. Ya aparece en el portal de la temporera.')
    setMessage('')
    onChanged()
  }

  const changeVisibility = value => {
    updateLaborProfileVisibility({ profileId:profile.id, visibility:value })
    onChanged()
  }

  const remove = () => {
    deleteLaborProfile(profile.id)
    onChanged()
  }

  return (
    <>
      <article className="labor-card">
        <div className="labor-card-head">
          <p className="labor-card-kicker">Perfil laboral · {sectorLabel}</p>
          <span className={`labor-status labor-status--${LABOR_STATUS_META[profile.status]?.tone || 'muted'}`}>
            {compactStatusLabel(profile.status)}
          </span>
        </div>

        <span className={`labor-rating labor-rating--${ratingTone}`}>
          <span />
          {analysis.status || 'Perfil sin valorar'}
        </span>

        <p className="labor-recommendation">
          {analysis.recommendation || 'Completa el formulario para generar una recomendación clara.'}
        </p>

        <div className="labor-facts">
          <div><span>Actualizado</span><strong>{formatLaborDate(profile.updatedAt)}</strong></div>
          <div><span>Disponible</span><strong className="labor-good">{form.start || '-'}</strong></div>
          <div><span>Coche</span><strong>{form.transport === 'Coche propio' ? 'Sí' : 'No confirmado'}</strong></div>
          <div><span>Zonas</span><strong>{getProfileMobility(form)}</strong></div>
        </div>

        <div className="labor-card-actions">
          <Link to={`/workcheck-construccion?edit=${profile.id}`}>Editar perfil</Link>
          <Link to={`/temporeras/${agencySlug}`}>Ver como temporera</Link>
        </div>
      </article>

      <section className="labor-panel">
        <h2>Visibilidad</h2>
        <div className="labor-visibility-options">
          {Object.values(LABOR_VISIBILITY).map(option => (
            <button
              key={option.id}
              type="button"
              className={profile.visibility === option.id ? 'labor-radio-card active' : 'labor-radio-card'}
              onClick={() => changeVisibility(option.id)}
            >
              <span aria-hidden="true" />
              <b>{option.label}</b>
              <small>{option.description}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="labor-panel labor-send-box">
        <h2>Enviar a una temporera</h2>
        <label className="labor-field">
          <span>Empresa temporera</span>
          <select value={agencySlug} onChange={event => setAgencySlug(event.target.value)}>
            {TEMPORARY_AGENCIES.map(agency => (
              <option key={agency.slug} value={agency.slug}>{agency.name}</option>
            ))}
          </select>
        </label>
        <label className="labor-field">
          <span>Mensaje · opcional</span>
          <textarea
            value={message}
            onChange={event => setMessage(event.target.value)}
            maxLength={220}
            placeholder="Ej.: puedo empezar esta semana, coche propio."
          />
        </label>
        <button className="labor-send-button" type="button" onClick={send}>Enviar perfil</button>
        {notice && <p className="labor-success">{notice}</p>}
      </section>

      <button className="labor-delete-button" type="button" onClick={remove}>Eliminar perfil</button>
    </>
  )
}

export default function PerfilLaboral() {
  const { user } = useAuth()
  const [version, setVersion] = useState(0)
  const refresh = () => setVersion(current => current + 1)

  useEffect(() => {
    const handler = () => refresh()
    window.addEventListener('latido:labor-profile-updated', handler)
    return () => window.removeEventListener('latido:labor-profile-updated', handler)
  }, [])

  const profiles = useMemo(() => getLaborProfiles({ user }), [user, version])
  const submissions = useMemo(() => getLaborSubmissions({ user, includeDemo:false }), [user, version])
  const hasProfile = profiles.length > 0

  return (
    <main className="labor-page" style={{ fontFamily:PP }}>
      <style>{`
        .labor-page {
          min-height: 100vh;
          background: #eef4ff;
          color: #0f172a;
          padding: 18px 24px 112px;
        }
        .labor-shell {
          max-width: 1060px;
          margin: 0 auto;
        }
        .labor-hero {
          position: relative;
          overflow: hidden;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 20px;
          align-items: start;
          background: linear-gradient(160deg, #1e40af 0%, #2563eb 58%, #60a5fa 100%);
          border: 0;
          border-radius: 28px;
          padding: 28px;
          box-shadow: 0 22px 48px rgba(37,99,235,.24);
          margin-bottom: 18px;
          color: #fff;
        }
        .labor-hero::after {
          content: '';
          position: absolute;
          inset: 0 0 0 auto;
          width: 48%;
          background: linear-gradient(135deg, rgba(255,255,255,.13), rgba(255,255,255,0));
          clip-path: polygon(22% 0, 100% 0, 100% 100%, 0 100%);
          pointer-events: none;
        }
        .labor-hero > * {
          position: relative;
          z-index: 1;
        }
        .labor-eyebrow {
          display: inline-flex;
          align-items: center;
          min-height: 28px;
          margin: 0 0 12px;
          padding: 0 11px;
          border-radius: 999px;
          background: rgba(255,255,255,.15);
          border: 1px solid rgba(255,255,255,.22);
          color: rgba(255,255,255,.92);
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .7px;
          text-transform: uppercase;
        }
        .labor-hero h1,
        .labor-card h2 {
          margin: 0;
          letter-spacing: 0;
          line-height: 1.12;
        }
        .labor-hero h1 {
          color: #fff;
          font-size: clamp(34px, 6vw, 54px);
        }
        .labor-card h2 {
          color: #0f172a;
          font-size: 23px;
        }
        .labor-hero p,
        .labor-card p {
          margin: 9px 0 0;
          color: #64748b;
          font-size: 13px;
          line-height: 1.65;
        }
        .labor-hero p {
          max-width: 620px;
          color: rgba(255,255,255,.86);
          font-size: 15px;
          line-height: 1.55;
        }
        .labor-hero-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 16px;
        }
        .labor-hero-meta span {
          display: inline-flex;
          align-items: center;
          min-height: 30px;
          padding: 0 10px;
          border-radius: 999px;
          background: rgba(255,255,255,.14);
          border: 1px solid rgba(255,255,255,.24);
          color: #fff;
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
        }
        .labor-hero-actions,
        .labor-empty-grid,
        .labor-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .labor-hero-actions a,
        .labor-empty-card a,
        .labor-actions a,
        .labor-actions button,
        .labor-send-grid button {
          min-height: 46px;
          border: 1.5px solid #bfdbfe;
          border-radius: 14px;
          padding: 0 16px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #2563eb;
          color: #fff;
          font: 900 13px ${PP};
          text-decoration: none;
          cursor: pointer;
        }
        .labor-actions button {
          background: #fff;
          color: #dc2626;
          border-color: #fecaca;
        }
        .labor-hero-actions a {
          border-color: rgba(255,255,255,.32);
          border-radius: 999px;
          background: rgba(255,255,255,.16);
          color: #fff;
          box-shadow: 0 10px 24px rgba(30,64,175,.12);
        }
        .labor-hero-actions a:first-child {
          background: #fff;
          border-color: #fff;
          color: #2563eb;
        }
        .labor-empty-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .labor-empty-card,
        .labor-card,
        .labor-submissions {
          background: #fff;
          border: 1px solid #dce8f6;
          border-radius: 20px;
          padding: 16px;
          box-shadow: 0 14px 34px rgba(30,64,175,.07);
        }
        .labor-empty-card h2 {
          margin: 0 0 8px;
          font-size: 20px;
          line-height: 1.18;
        }
        .labor-empty-card p {
          margin: 0 0 14px;
          color: #64748b;
          font-size: 13px;
          line-height: 1.65;
        }
        .labor-card-top {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 12px;
          align-items: start;
        }
        .labor-status {
          border-radius: 999px;
          padding: 8px 11px;
          font-size: 11px;
          font-weight: 900;
          white-space: nowrap;
        }
        .labor-status--success { background: #ecfdf5; color: #0f766e; }
        .labor-status--warning { background: #fffbeb; color: #b45309; }
        .labor-status--danger { background: #fef2f2; color: #dc2626; }
        .labor-status--muted { background: #f1f5f9; color: #475569; }
        .labor-facts {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
          margin: 14px 0;
        }
        .labor-facts div {
          background: #f8fbff;
          border: 1px solid #dce8f6;
          border-radius: 14px;
          padding: 11px;
          min-width: 0;
        }
        .labor-facts span {
          display: block;
          color: #64748b;
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          margin-bottom: 5px;
        }
        .labor-facts strong {
          display: block;
          color: #0f172a;
          font-size: 12px;
          line-height: 1.35;
          overflow-wrap: anywhere;
        }
        .labor-visibility,
        .labor-send-box,
        .labor-sent-list,
        .labor-submissions {
          border-top: 1px solid #e2eaf4;
          padding-top: 14px;
          margin-top: 14px;
        }
        .labor-visibility > strong,
        .labor-send-box > strong,
        .labor-sent-list > strong,
        .labor-submissions > strong {
          display: block;
          font-size: 13px;
          margin-bottom: 10px;
        }
        .labor-visibility div {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }
        .labor-visibility button {
          min-height: 46px;
          border-radius: 14px;
          border: 1.5px solid #dce8f6;
          background: #f8fbff;
          color: #334155;
          font: 900 12px ${PP};
          cursor: pointer;
        }
        .labor-visibility button.active {
          border-color: #2563eb;
          background: #eff6ff;
          color: #1d4ed8;
        }
        .labor-send-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 8px;
        }
        .labor-send-grid select,
        .labor-send-box textarea {
          width: 100%;
          border: 1.5px solid #dce8f6;
          border-radius: 14px;
          background: #f8fbff;
          color: #0f172a;
          font: 700 13px ${PP};
          box-sizing: border-box;
        }
        .labor-send-grid select {
          min-height: 46px;
          padding: 0 12px;
        }
        .labor-send-box textarea {
          min-height: 84px;
          padding: 12px;
          resize: vertical;
          margin-top: 8px;
        }
        .labor-success {
          background: #ecfdf5;
          color: #0f766e;
          border: 1px solid #99f6e4;
          border-radius: 14px;
          padding: 10px 12px;
          font-weight: 800;
        }
        .labor-sent-list {
          display: grid;
          gap: 7px;
        }
        .labor-sent-list span {
          color: #475569;
          font-size: 12px;
          line-height: 1.45;
        }
        .labor-submissions {
          margin-top: 14px;
        }
        .labor-submission-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 10px;
          padding: 12px 0;
          border-top: 1px solid #e2eaf4;
        }
        .labor-submission-row:first-of-type {
          border-top: 0;
        }
        .labor-submission-row p {
          margin: 2px 0 0;
          color: #64748b;
          font-size: 12px;
        }
        @media (max-width: 720px) {
          .labor-page { padding: 12px 20px 104px; }
          .labor-hero,
          .labor-card-top,
          .labor-send-grid,
          .labor-submission-row {
            grid-template-columns: 1fr;
          }
          .labor-hero {
            margin: -12px -20px 20px;
            padding: 34px 20px 22px;
            border-radius: 0 0 28px 28px;
          }
          .labor-hero::after {
            width: 72%;
          }
          .labor-hero h1 {
            font-size: 38px;
          }
          .labor-hero p {
            font-size: 14px;
          }
          .labor-hero-meta {
            flex-wrap: nowrap;
            overflow-x: auto;
            padding-bottom: 2px;
            -webkit-overflow-scrolling: touch;
          }
          .labor-hero-meta span {
            flex: 0 0 auto;
            font-size: 10px;
          }
          .labor-empty-grid,
          .labor-facts,
          .labor-visibility div {
            grid-template-columns: 1fr;
          }
          .labor-hero-actions a,
          .labor-empty-card a,
          .labor-actions a,
          .labor-actions button,
          .labor-send-grid button {
            width: 100%;
          }
        }

        /* Final Latido mobile profile layout */
        .labor-page {
          min-height: 100dvh;
          background: #f7f7f5;
          color: #16171c;
          padding: 0 0 calc(82px + env(safe-area-inset-bottom));
        }
        .labor-shell {
          width: min(500px, 100%);
          max-width: 500px;
          margin: 0 auto;
          background: #f7f7f5;
        }
        .labor-hero {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin: 0;
          padding: 22px 24px 24px;
          border-radius: 0;
          background: #4a76ef;
          box-shadow: none;
          color: #fff;
        }
        .labor-hero::after {
          display: none;
        }
        .labor-hero-head {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          gap: 12px;
          align-items: center;
        }
        .labor-hero-logo {
          width: 38px;
          height: 38px;
          padding: 6px;
          border-radius: 10px;
          background: #fff;
        }
        .labor-hero h1 {
          margin: 0;
          color: #fff;
          font-size: 21px;
          font-weight: 800;
          line-height: 1.05;
        }
        .labor-hero p {
          margin: 3px 0 0;
          color: rgba(255,255,255,.82);
          font-size: 13px;
          font-weight: 500;
          line-height: 1.25;
        }
        .labor-mode {
          min-height: 29px;
          padding: 7px 12px;
          border-radius: 999px;
          background: rgba(255,255,255,.16);
          color: #fff;
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }
        .labor-hero-stats {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }
        .labor-hero-stats span {
          min-height: 68px;
          padding: 12px 14px;
          border-radius: 11px;
          background: rgba(255,255,255,.14);
          color: rgba(255,255,255,.82);
          font-size: 13px;
          font-weight: 500;
        }
        .labor-hero-stats strong {
          display: block;
          margin-bottom: 3px;
          color: #fff;
          font-size: 25px;
          font-weight: 800;
          line-height: 1;
        }
        .labor-hero-actions {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }
        .labor-hero-actions a {
          min-height: 54px;
          padding: 0 12px;
          border: 0;
          border-radius: 13px;
          background: rgba(255,255,255,.16);
          color: #fff;
          box-shadow: none;
          font-size: 16px;
          font-weight: 800;
        }
        .labor-hero-actions a:first-child {
          background: #fff;
          color: #4a76ef;
        }
        .labor-empty-grid {
          display: grid;
          gap: 14px;
          padding: 20px 24px 0;
        }
        .labor-empty-card,
        .labor-card,
        .labor-panel {
          margin: 20px 24px 0;
          padding: 20px;
          border: 1px solid #ecece9;
          border-radius: 18px;
          background: #fff;
          box-shadow: none;
        }
        .labor-empty-card {
          margin: 0;
        }
        .labor-card-head {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 12px;
          align-items: center;
        }
        .labor-card-kicker {
          margin: 0;
          color: #70737c;
          font-size: 13px;
          font-weight: 800;
          line-height: 1.2;
          text-transform: uppercase;
        }
        .labor-status {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 29px;
          padding: 0 13px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 800;
        }
        .labor-status--success { background: #eaf8ef; color: #128255; }
        .labor-status--warning { background: #fff4dc; color: #b56b00; }
        .labor-status--danger { background: #fff0f0; color: #d04545; }
        .labor-status--muted { background: #eef3fe; color: #4a76ef; }
        .labor-rating {
          display: inline-flex;
          align-items: center;
          width: fit-content;
          max-width: 100%;
          gap: 8px;
          margin-top: 14px;
          padding: 8px 14px;
          border-radius: 999px;
          font-size: 14px;
          font-weight: 800;
          line-height: 1.2;
        }
        .labor-rating > span {
          width: 9px;
          height: 9px;
          border-radius: 999px;
          background: currentColor;
          flex: 0 0 auto;
        }
        .labor-rating--success { border: 1px solid #c9e8d4; background: #effaf3; color: #128255; }
        .labor-rating--warning { border: 1px solid #f7dca0; background: #fff8e8; color: #b56b00; }
        .labor-rating--danger { border: 1px solid #ffd1d1; background: #fff1f1; color: #d04545; }
        .labor-rating--muted { border: 1px solid #d9e4fc; background: #eef3fe; color: #4a76ef; }
        .labor-recommendation {
          margin: 13px 0 18px;
          color: #70737c;
          font-size: 15.5px;
          line-height: 1.45;
        }
        .labor-facts {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0;
          margin: 0;
          overflow: hidden;
          border-top: 1px solid #ecece9;
          border-bottom: 1px solid #ecece9;
        }
        .labor-facts div {
          min-height: 64px;
          padding: 12px 20px;
          border: 0;
          border-right: 1px solid #ecece9;
          border-bottom: 1px solid #ecece9;
          border-radius: 0;
          background: #fff;
        }
        .labor-facts div:nth-child(2n) {
          border-right: 0;
        }
        .labor-facts div:nth-last-child(-n + 2) {
          border-bottom: 0;
        }
        .labor-facts span {
          display: block;
          margin: 0 0 4px;
          color: #9a9da6;
          font-size: 12px;
          font-weight: 800;
          line-height: 1.15;
          text-transform: uppercase;
        }
        .labor-facts strong {
          display: block;
          color: #16171c;
          font-size: 15px;
          font-weight: 800;
          line-height: 1.2;
          overflow-wrap: anywhere;
        }
        .labor-good {
          color: #128255 !important;
        }
        .labor-card-actions {
          display: grid;
          grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
          gap: 10px;
          margin-top: 16px;
        }
        .labor-card-actions a,
        .labor-send-button,
        .labor-delete-button,
        .labor-empty-card a {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 50px;
          padding: 0 14px;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 800;
          text-decoration: none;
          cursor: pointer;
        }
        .labor-card-actions a:first-child,
        .labor-send-button,
        .labor-empty-card a {
          border: 0;
          background: #4a76ef;
          color: #fff;
        }
        .labor-card-actions a:last-child {
          border: 1px solid #ecece9;
          background: #fff;
          color: #16171c;
        }
        .labor-panel h2,
        .labor-empty-card h2 {
          margin: 0 0 16px;
          color: #16171c;
          font-size: 19px;
          font-weight: 800;
          line-height: 1.2;
        }
        .labor-empty-card p {
          margin: 0 0 14px;
          color: #70737c;
          font-size: 14px;
          line-height: 1.45;
        }
        .labor-visibility-options {
          display: grid;
          gap: 14px;
        }
        .labor-radio-card {
          display: grid;
          grid-template-columns: 26px minmax(0, 1fr);
          gap: 12px;
          align-items: center;
          min-height: 78px;
          padding: 15px 16px;
          border: 1px solid #ecece9;
          border-radius: 13px;
          background: #f7f7f5;
          color: #16171c;
          text-align: left;
          cursor: pointer;
        }
        .labor-radio-card > span {
          grid-row: 1 / span 2;
          width: 24px;
          height: 24px;
          border: 1px solid #d5d5d1;
          border-radius: 999px;
          background: #fff;
        }
        .labor-radio-card b {
          display: block;
          font-size: 17px;
          font-weight: 800;
          line-height: 1.2;
        }
        .labor-radio-card small {
          display: block;
          margin-top: 3px;
          color: #70737c;
          font-size: 14px;
          line-height: 1.25;
        }
        .labor-radio-card.active {
          border-color: #4a76ef;
          background: #eef3fe;
        }
        .labor-radio-card.active > span {
          border: 2px solid #4a76ef;
          box-shadow: inset 0 0 0 6px #fff;
          background: #4a76ef;
        }
        .labor-send-box {
          display: grid;
          gap: 16px;
        }
        .labor-field {
          display: grid;
          gap: 8px;
        }
        .labor-field > span {
          color: #70737c;
          font-size: 13px;
          font-weight: 800;
          text-transform: uppercase;
        }
        .labor-field select,
        .labor-field textarea {
          width: 100%;
          border: 1px solid #ecece9;
          border-radius: 13px;
          background: #f7f7f5;
          color: #16171c;
          font: 500 18px ${PP};
          box-sizing: border-box;
        }
        .labor-field select {
          min-height: 58px;
          padding: 0 18px;
        }
        .labor-field textarea {
          min-height: 88px;
          padding: 18px;
          resize: vertical;
        }
        .labor-field textarea::placeholder {
          color: #9a9da6;
        }
        .labor-send-button {
          width: 100%;
          border: 0;
          background: #4a76ef;
          color: #fff;
        }
        .labor-success {
          margin: 0;
          border: 1px solid #c9e8d4;
          border-radius: 12px;
          background: #effaf3;
          color: #128255;
          padding: 10px 12px;
          font-size: 13px;
          font-weight: 800;
        }
        .labor-submissions {
          display: grid;
          gap: 0;
        }
        .labor-submission-row {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          gap: 14px;
          align-items: center;
          padding: 0;
          border: 0;
        }
        .labor-submission-avatar {
          width: 50px;
          height: 50px;
          display: grid;
          place-items: center;
          border-radius: 13px;
          background: #eef3fe;
          color: #4a76ef;
          font-size: 15px;
          font-weight: 800;
        }
        .labor-submission-row b {
          display: block;
          color: #16171c;
          font-size: 16px;
          font-weight: 800;
          line-height: 1.2;
        }
        .labor-submission-row p {
          margin: 2px 0 0;
          color: #70737c;
          font-size: 14px;
          line-height: 1.25;
        }
        .labor-delete-button {
          width: calc(100% - 48px);
          margin: 20px 24px 0;
          border: 1px solid #ffd1d1;
          background: #fff;
          color: #d04545;
        }
        @media (max-width: 420px) {
          .labor-hero {
            padding: 20px 20px 22px;
          }
          .labor-empty-grid {
            padding-inline: 18px;
          }
          .labor-empty-card,
          .labor-card,
          .labor-panel {
            margin-inline: 18px;
            padding: 18px;
          }
          .labor-delete-button {
            width: calc(100% - 36px);
            margin-inline: 18px;
          }
          .labor-hero h1 {
            font-size: 20px;
          }
          .labor-mode {
            font-size: 11px;
            padding-inline: 10px;
          }
          .labor-facts div {
            padding-inline: 14px;
          }
          .labor-card-actions a,
          .labor-send-button,
          .labor-delete-button {
            font-size: 15px;
          }
        }

        /* Extra compact pass */
        .labor-page {
          padding-bottom: calc(72px + env(safe-area-inset-bottom));
        }
        .labor-hero {
          gap: 11px;
          padding: 16px 18px 18px;
        }
        .labor-hero-head {
          gap: 9px;
        }
        .labor-hero-logo {
          width: 31px;
          height: 31px;
          padding: 5px;
          border-radius: 9px;
        }
        .labor-hero h1 {
          font-size: 18px;
        }
        .labor-hero p {
          font-size: 11.5px;
        }
        .labor-mode {
          min-height: 25px;
          padding: 5px 10px;
          font-size: 10.5px;
        }
        .labor-hero-stats {
          gap: 8px;
        }
        .labor-hero-stats span {
          min-height: 52px;
          padding: 10px 12px;
          border-radius: 10px;
          font-size: 11.5px;
        }
        .labor-hero-stats strong {
          font-size: 21px;
        }
        .labor-hero-actions {
          gap: 8px;
        }
        .labor-hero-actions a {
          min-height: 43px;
          border-radius: 11px;
          font-size: 13.5px;
        }
        .labor-empty-grid {
          gap: 11px;
          padding: 15px 16px 0;
        }
        .labor-empty-card,
        .labor-card,
        .labor-panel {
          margin: 15px 16px 0;
          padding: 14px;
          border-radius: 14px;
        }
        .labor-empty-card {
          margin: 0;
        }
        .labor-card-head {
          gap: 9px;
        }
        .labor-card-kicker {
          font-size: 11px;
        }
        .labor-status {
          min-height: 24px;
          padding: 0 10px;
          font-size: 10.5px;
        }
        .labor-rating {
          gap: 6px;
          margin-top: 10px;
          padding: 6px 11px;
          font-size: 12.5px;
        }
        .labor-rating > span {
          width: 7px;
          height: 7px;
        }
        .labor-recommendation {
          margin: 10px 0 13px;
          font-size: 13px;
          line-height: 1.35;
        }
        .labor-facts div {
          min-height: 50px;
          padding: 9px 12px;
        }
        .labor-facts span {
          margin-bottom: 3px;
          font-size: 10px;
        }
        .labor-facts strong {
          font-size: 13px;
        }
        .labor-card-actions {
          gap: 8px;
          margin-top: 12px;
        }
        .labor-card-actions a,
        .labor-send-button,
        .labor-delete-button,
        .labor-empty-card a {
          min-height: 41px;
          border-radius: 10px;
          font-size: 13px;
        }
        .labor-panel h2,
        .labor-empty-card h2 {
          margin-bottom: 12px;
          font-size: 16px;
        }
        .labor-empty-card p {
          font-size: 12.5px;
          line-height: 1.35;
        }
        .labor-visibility-options {
          gap: 10px;
        }
        .labor-radio-card {
          grid-template-columns: 21px minmax(0, 1fr);
          gap: 10px;
          min-height: 61px;
          padding: 10px 12px;
          border-radius: 11px;
        }
        .labor-radio-card > span {
          width: 19px;
          height: 19px;
        }
        .labor-radio-card b {
          font-size: 14px;
        }
        .labor-radio-card small {
          font-size: 12px;
        }
        .labor-send-box {
          gap: 12px;
        }
        .labor-field {
          gap: 6px;
        }
        .labor-field > span {
          font-size: 11px;
        }
        .labor-field select,
        .labor-field textarea {
          border-radius: 11px;
          font-size: 14px;
        }
        .labor-field select {
          min-height: 44px;
          padding: 0 13px;
        }
        .labor-field textarea {
          min-height: 72px;
          padding: 13px;
        }
        .labor-submission-row {
          gap: 10px;
        }
        .labor-submission-avatar {
          width: 40px;
          height: 40px;
          border-radius: 11px;
          font-size: 12.5px;
        }
        .labor-submission-row b {
          font-size: 14px;
        }
        .labor-submission-row p {
          font-size: 12px;
        }
        .labor-delete-button {
          width: calc(100% - 32px);
          margin: 15px 16px 0;
        }
        @media (max-width: 420px) {
          .labor-hero {
            padding: 15px 16px 17px;
          }
          .labor-empty-grid {
            padding-inline: 14px;
          }
          .labor-empty-card,
          .labor-card,
          .labor-panel {
            margin-inline: 14px;
            padding: 13px;
          }
          .labor-delete-button {
            width: calc(100% - 28px);
            margin-inline: 14px;
          }
          .labor-hero h1 {
            font-size: 17px;
          }
        }
      `}</style>

      <div className="labor-shell">
        <section className="labor-hero">
          <div className="labor-hero-head">
            <img className="labor-hero-logo" src="/favicon.svg" alt="Latido" />
            <div>
              <h1>Mi Perfil Laboral</h1>
              <p>Guárdalo y envíalo sin rellenarlo otra vez</p>
            </div>
            <span className="labor-mode">{user ? 'Cuenta activa' : 'Modo prueba'}</span>
          </div>
          <div className="labor-hero-stats">
            <span><strong>{profiles.length}</strong> Perfil guardado</span>
            <span><strong>{submissions.length}</strong> Enviado a temporeras</span>
          </div>
          <div className="labor-hero-actions">
            <Link to="/workcheck-construccion">+ Crear perfil</Link>
            <Link to="/temporeras/aha-personal">Temporeras</Link>
          </div>
        </section>

        {!hasProfile && (
          <section className="labor-empty-grid">
            <article className="labor-empty-card">
              <h2>Publicar anuncio normal</h2>
              <p>Sirve para decir rapidamente que buscas trabajo en Latido. Es simple y visible para la comunidad.</p>
              <Link to="/publicar-empleo">Publicar anuncio</Link>
            </article>
            <article className="labor-empty-card">
              <h2>Crear Perfil Laboral</h2>
              <p>Sirve para mostrar disponibilidad, movilidad, tareas reales, seguridad y recomendación para temporeras.</p>
              <Link to="/workcheck-construccion">Crear Perfil Laboral</Link>
            </article>
          </section>
        )}

        {profiles.map(profile => (
          <ProfileCard
            key={profile.id}
            profile={profile}
            user={user}
            onChanged={refresh}
          />
        ))}

        {submissions.length > 0 && (
          <section className="labor-panel labor-submissions">
            <h2>Empresas a las que enviaste tu perfil</h2>
            {submissions.map(item => (
              <div className="labor-submission-row" key={item.id}>
                <span className="labor-submission-avatar">{getInitials(item.agencyName)}</span>
                <div>
                  <b>{item.agencyName}</b>
                  <p>{formatLaborDate(item.sentAt)} · {LABOR_SECTORS[item.sector]?.label || item.sector}</p>
                </div>
                <span className="labor-status labor-status--muted">{item.status}</span>
              </div>
            ))}
          </section>
        )}
      </div>
    </main>
  )
}
