import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { PP } from '../lib/theme'
import {
  LABOR_SECTORS,
  TEMPORARY_AGENCIES,
  formatLaborDate,
  getAgencyBySlug,
  getLatestLaborProfile,
  getProfileMobility,
  submitLaborProfile,
} from '../lib/laborProfile'

export default function TemporeraPublica() {
  const { agencySlug = 'aha-personal' } = useParams()
  const { user } = useAuth()
  const [version, setVersion] = useState(0)
  const [sent, setSent] = useState('')
  const [message, setMessage] = useState('')
  const agency = getAgencyBySlug(agencySlug)
  const profile = useMemo(() => getLatestLaborProfile({ user, sector:'construction' }), [user, version])

  if (!agency) {
    return (
      <main className="temp-page" style={{ fontFamily:PP }}>
        <div className="temp-shell">
          <h1>Temporera no encontrada</h1>
          <Link to="/temporeras/aha-personal">Abrir temporera demo</Link>
        </div>
      </main>
    )
  }

  const acceptsConstruction = agency.sectors.includes('construction')
  const canSendProfile = profile && acceptsConstruction
  const otherAgencies = TEMPORARY_AGENCIES.filter(item => item.slug !== agency.slug)

  const sendProfile = () => {
    if (!canSendProfile) return
    submitLaborProfile({ profile, agencySlug:agency.slug, user, message })
    setSent(`Tu Perfil Laboral ha sido enviado a ${agency.name}.`)
    setMessage('')
    setVersion(current => current + 1)
  }

  return (
    <main className="temp-page" style={{ fontFamily:PP }}>
      <style>{`
        .temp-page {
          min-height: 100vh;
          background: #eef4ff;
          color: #0f172a;
          padding: 22px 24px 112px;
        }
        .temp-shell {
          max-width: 920px;
          margin: 0 auto;
        }
        .temp-hero,
        .temp-panel,
        .temp-profile {
          background: #fff;
          border: 1px solid #d8e3f3;
          border-radius: 22px;
          box-shadow: 0 16px 38px rgba(30,64,175,.08);
        }
        .temp-hero {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 250px;
          gap: 22px;
          align-items: stretch;
          background: transparent;
          border: 0;
          border-radius: 0;
          box-shadow: none;
          padding: 0;
          margin-bottom: 24px;
        }
        .temp-eyebrow {
          margin: 0 0 8px;
          color: #2563eb;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .7px;
          text-transform: uppercase;
        }
        .temp-hero h1 {
          margin: 0;
          font-size: clamp(30px, 5vw, 46px);
          line-height: 1.05;
          letter-spacing: 0;
        }
        .temp-hero p,
        .temp-panel p,
        .temp-profile p {
          color: #6f7f9d;
          font-size: 15px;
          line-height: 1.7;
        }
        .temp-meta {
          display: grid;
          gap: 8px;
          align-content: start;
          background: transparent;
          border: 0;
          border-radius: 0;
          padding: 0;
        }
        .temp-meta div {
          display: grid;
          gap: 2px;
          background: #fff;
          border: 1px solid #d8e3f3;
          border-radius: 16px;
          padding: 12px;
        }
        .temp-meta span {
          color: #8a9bb8;
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
        }
        .temp-meta strong {
          color: #1e3a8a;
          font-size: 13px;
          line-height: 1.35;
        }
        .temp-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 18px;
        }
        .temp-actions a,
        .temp-actions button,
        .temp-profile button,
        .temp-panel a {
          min-height: 56px;
          border: 1.5px solid #bfdbfe;
          border-radius: 16px;
          padding: 0 18px;
          background: #2563eb;
          color: #fff;
          font: 900 14px ${PP};
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .temp-actions a.secondary,
        .temp-panel a.secondary {
          background: #fff;
          color: #2563eb;
        }
        .temp-grid {
          display: grid;
          grid-template-columns: 1.08fr .92fr;
          gap: 16px;
        }
        .temp-panel,
        .temp-profile {
          padding: 20px;
        }
        .temp-panel h2,
        .temp-profile h2 {
          margin: 0 0 8px;
          font-size: 22px;
          line-height: 1.16;
        }
        .temp-steps {
          display: grid;
          gap: 9px;
          margin-top: 14px;
        }
        .temp-step {
          display: grid;
          grid-template-columns: 34px minmax(0, 1fr);
          gap: 10px;
          align-items: start;
          background: #f8fbff;
          border: 1px solid #d8e3f3;
          border-radius: 16px;
          padding: 12px;
        }
        .temp-step span {
          width: 34px;
          height: 34px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          background: #2563eb;
          color: #fff;
          font-weight: 900;
        }
        .temp-step strong {
          display: block;
          margin-bottom: 3px;
        }
        .temp-profile-card {
          background: #fff;
          border: 1px solid #d8e3f3;
          border-radius: 16px;
          padding: 14px;
          margin: 14px 0;
        }
        .temp-profile-card h3 {
          margin: 0 0 6px;
          font-size: 18px;
        }
        .temp-facts {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin-top: 10px;
        }
        .temp-facts div {
          background: #f8fbff;
          border: 1px solid #d8e3f3;
          border-radius: 14px;
          padding: 12px;
        }
        .temp-facts span {
          display: block;
          color: #8a9bb8;
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .temp-facts strong {
          display: block;
          font-size: 12px;
          line-height: 1.35;
        }
        .temp-profile textarea {
          width: 100%;
          min-height: 96px;
          border: 1.5px solid #d8e3f3;
          border-radius: 16px;
          padding: 14px 16px;
          box-sizing: border-box;
          font: 700 15px ${PP};
          background: #fff;
          resize: vertical;
          margin-bottom: 9px;
        }
        .temp-success {
          background: #ecfdf5;
          border: 1px solid #99f6e4;
          color: #0f766e;
          border-radius: 14px;
          padding: 11px 12px;
          font-size: 12px;
          font-weight: 900;
          line-height: 1.45;
        }
        .temp-warning {
          background: #fffbeb;
          border: 1px solid #fde68a;
          color: #92400e;
          border-radius: 14px;
          padding: 11px 12px;
          font-size: 12px;
          font-weight: 800;
          line-height: 1.5;
        }
        @media (max-width: 760px) {
          .temp-page { padding: 12px 20px 104px; }
          .temp-hero,
          .temp-grid {
            grid-template-columns: 1fr;
          }
          .temp-hero,
          .temp-panel,
          .temp-profile {
            border-radius: 20px;
            padding: 18px;
          }
          .temp-hero {
            border-radius: 0;
            padding: 0;
          }
          .temp-actions a,
          .temp-actions button,
          .temp-panel a,
          .temp-profile button {
            width: 100%;
          }
          .temp-facts {
            grid-template-columns: 1fr;
          }
        }

        /* Latido mobile agency landing */
        .temp-page {
          min-height: 100dvh;
          padding: 0 0 calc(82px + env(safe-area-inset-bottom));
          background: #f7f7f5;
          color: #16171c;
        }
        .temp-shell {
          width: min(500px, 100%);
          max-width: 500px;
          margin: 0 auto;
          background: #f7f7f5;
        }
        .temp-hero {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin: 0;
          padding: 24px 22px 28px;
          border: 0;
          border-radius: 0;
          background: #4a76ef;
          color: #fff;
          box-shadow: none;
        }
        .temp-hero-main {
          display: grid;
          gap: 14px;
        }
        .temp-hero-brand {
          display: flex;
          align-items: center;
          gap: 11px;
          color: rgba(255,255,255,.86);
          font-size: 13px;
          font-weight: 800;
          text-transform: uppercase;
        }
        .temp-hero-brand img {
          width: 34px;
          height: 34px;
          padding: 5px;
          border-radius: 10px;
          background: #fff;
        }
        .temp-hero h1 {
          margin: 6px 0 0;
          color: #fff;
          font-size: 27px;
          font-weight: 800;
          line-height: 1.1;
        }
        .temp-hero p {
          margin: 0;
          color: rgba(255,255,255,.86);
          font-size: 15px;
          font-weight: 500;
          line-height: 1.45;
        }
        .temp-main-cta,
        .temp-hero-actions a,
        .temp-profile-actions button,
        .temp-profile-actions a,
        .temp-profile > a {
          min-height: 56px;
          border: 0;
          border-radius: 14px;
          padding: 0 16px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font: 800 16px ${PP};
          text-decoration: none;
          cursor: pointer;
        }
        .temp-main-cta {
          width: 100%;
          margin-top: 4px;
          background: #fff;
          color: #4a76ef;
        }
        .temp-main-cta:disabled,
        .temp-profile-actions button:disabled {
          opacity: .58;
          cursor: not-allowed;
        }
        .temp-hero-actions {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }
        .temp-hero-actions a {
          min-height: 51px;
          border-radius: 12px;
          background: rgba(255,255,255,.16);
          color: #fff;
          text-align: center;
        }
        .temp-meta {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0;
          margin-top: 6px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,.12);
          border-radius: 14px;
          background: rgba(255,255,255,.12);
        }
        .temp-meta div {
          min-height: 64px;
          padding: 12px 16px;
          border: 0;
          border-right: 1px solid rgba(37,99,235,.22);
          border-bottom: 1px solid rgba(37,99,235,.22);
          border-radius: 0;
          background: rgba(255,255,255,.12);
        }
        .temp-meta div:nth-child(2n) {
          border-right: 0;
        }
        .temp-meta div:nth-last-child(-n + 2) {
          border-bottom: 0;
        }
        .temp-meta span {
          display: block;
          margin-bottom: 4px;
          color: rgba(255,255,255,.68);
          font-size: 11.5px;
          font-weight: 800;
          text-transform: uppercase;
        }
        .temp-meta strong {
          color: #fff;
          font-size: 14.5px;
          font-weight: 800;
          line-height: 1.25;
          overflow-wrap: anywhere;
        }
        .temp-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
          padding: 20px 22px 0;
        }
        .temp-panel,
        .temp-profile {
          padding: 20px;
          border: 1px solid #ecece9;
          border-radius: 18px;
          background: #fff;
          box-shadow: none;
        }
        .temp-panel h2,
        .temp-profile h2,
        .temp-profile-card h2 {
          margin: 0 0 9px;
          color: #16171c;
          font-size: 20px;
          font-weight: 800;
          line-height: 1.15;
        }
        .temp-panel p,
        .temp-profile p,
        .temp-profile-card p {
          margin: 0;
          color: #70737c;
          font-size: 14.5px;
          line-height: 1.45;
        }
        .temp-steps {
          display: grid;
          gap: 15px;
          margin-top: 18px;
        }
        .temp-step {
          display: grid;
          grid-template-columns: 32px minmax(0, 1fr);
          gap: 15px;
          padding: 0;
          border: 0;
          border-radius: 0;
          background: transparent;
        }
        .temp-step span {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          background: #eef3fe;
          color: #4a76ef;
          font-size: 15px;
          font-weight: 800;
        }
        .temp-step strong {
          display: block;
          margin: 0 0 3px;
          color: #16171c;
          font-size: 16px;
          font-weight: 800;
          line-height: 1.2;
        }
        .temp-step p {
          color: #70737c;
          font-size: 14px;
          line-height: 1.35;
        }
        .temp-profile {
          display: grid;
          gap: 14px;
        }
        .temp-profile-head {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 10px;
          align-items: center;
        }
        .temp-eyebrow {
          margin: 0;
          color: #70737c;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: .02em;
          text-transform: uppercase;
        }
        .temp-profile-head span {
          min-height: 27px;
          padding: 6px 13px;
          border-radius: 999px;
          background: #eaf8ef;
          color: #128255;
          font-size: 12.5px;
          font-weight: 800;
          white-space: nowrap;
        }
        .temp-profile-card {
          margin: 0;
          padding: 0;
          border: 0;
          border-radius: 0;
          background: transparent;
        }
        .temp-profile-card h2 {
          font-size: 21px;
        }
        .temp-facts {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0;
          margin: 16px -20px 0;
          border-top: 1px solid #ecece9;
          border-bottom: 1px solid #ecece9;
        }
        .temp-facts div {
          min-height: 64px;
          padding: 12px 20px;
          border: 0;
          border-right: 1px solid #ecece9;
          border-bottom: 1px solid #ecece9;
          border-radius: 0;
          background: #fff;
        }
        .temp-facts div:nth-child(2n) {
          border-right: 0;
        }
        .temp-facts div:nth-last-child(-n + 2) {
          border-bottom: 0;
        }
        .temp-facts span {
          display: block;
          margin-bottom: 4px;
          color: #9a9da6;
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
        }
        .temp-facts strong {
          display: block;
          color: #16171c;
          font-size: 15px;
          font-weight: 800;
          line-height: 1.2;
        }
        .temp-good {
          color: #128255 !important;
        }
        .temp-profile textarea {
          width: 100%;
          min-height: 86px;
          margin: 0;
          padding: 18px;
          border: 1px solid #ecece9;
          border-radius: 13px;
          background: #f7f7f5;
          color: #16171c;
          font: 500 16px ${PP};
          resize: vertical;
        }
        .temp-profile textarea::placeholder {
          color: #9a9da6;
        }
        .temp-profile-actions {
          display: grid;
          grid-template-columns: minmax(0, 1.25fr) minmax(0, .9fr);
          gap: 10px;
        }
        .temp-profile-actions button {
          background: #4a76ef;
          color: #fff;
        }
        .temp-profile-actions a {
          border: 1px solid #ecece9;
          background: #fff;
          color: #16171c;
          text-align: center;
        }
        .temp-profile > a {
          width: 100%;
          background: #4a76ef;
          color: #fff;
        }
        .temp-success,
        .temp-warning {
          margin: 0;
          border-radius: 12px;
          padding: 11px 12px;
          font-size: 12.5px;
          line-height: 1.35;
        }
        .temp-other-agencies {
          margin: 20px 22px 0 !important;
        }
        .temp-agency-list {
          display: grid;
        }
        .temp-agency-list a {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 12px;
          align-items: center;
          min-height: auto;
          padding: 12px 0;
          border: 0;
          border-bottom: 1px solid #ecece9;
          border-radius: 0;
          background: transparent;
          color: #16171c;
          font: inherit;
          text-decoration: none;
        }
        .temp-agency-list a:last-child {
          border-bottom: 0;
          padding-bottom: 0;
        }
        .temp-agency-list strong {
          display: block;
          font-size: 15px;
          font-weight: 800;
          line-height: 1.2;
        }
        .temp-agency-list small {
          display: block;
          margin-top: 2px;
          color: #70737c;
          font-size: 13px;
          line-height: 1.25;
        }
        .temp-agency-list b {
          color: #9a9da6;
          font-size: 28px;
          font-weight: 400;
          line-height: 1;
        }
        @media (max-width: 420px) {
          .temp-hero {
            padding: 22px 20px 27px;
          }
          .temp-grid {
            padding: 20px 20px 0;
          }
          .temp-other-agencies {
            margin-inline: 20px !important;
          }
          .temp-hero h1 {
            font-size: 26px;
          }
          .temp-main-cta,
          .temp-hero-actions a,
          .temp-profile-actions button,
          .temp-profile-actions a {
            font-size: 15.5px;
          }
        }

        /* Compact pass requested */
        .temp-page {
          padding-bottom: calc(72px + env(safe-area-inset-bottom));
        }
        .temp-hero {
          gap: 8px;
          padding: 17px 16px 20px;
        }
        .temp-hero-main {
          gap: 10px;
        }
        .temp-hero-brand {
          gap: 8px;
          font-size: 11px;
        }
        .temp-hero-brand img {
          width: 28px;
          height: 28px;
          padding: 4px;
          border-radius: 8px;
        }
        .temp-hero h1 {
          margin-top: 4px;
          font-size: 22px;
          line-height: 1.08;
        }
        .temp-hero p {
          font-size: 12.5px;
          line-height: 1.35;
        }
        .temp-main-cta,
        .temp-hero-actions a,
        .temp-profile-actions button,
        .temp-profile-actions a,
        .temp-profile > a {
          min-height: 43px;
          border-radius: 11px;
          padding: 0 12px;
          font-size: 13px;
        }
        .temp-hero-actions {
          gap: 8px;
        }
        .temp-hero-actions a {
          min-height: 40px;
        }
        .temp-meta {
          margin-top: 4px;
          border-radius: 11px;
        }
        .temp-meta div {
          min-height: 50px;
          padding: 9px 12px;
        }
        .temp-meta span {
          margin-bottom: 3px;
          font-size: 9.5px;
        }
        .temp-meta strong {
          font-size: 12px;
        }
        .temp-grid {
          gap: 14px;
          padding: 15px 16px 0;
        }
        .temp-panel,
        .temp-profile {
          padding: 14px;
          border-radius: 14px;
        }
        .temp-panel h2,
        .temp-profile h2,
        .temp-profile-card h2 {
          margin-bottom: 7px;
          font-size: 17px;
        }
        .temp-panel p,
        .temp-profile p,
        .temp-profile-card p {
          font-size: 12.5px;
          line-height: 1.35;
        }
        .temp-steps {
          gap: 11px;
          margin-top: 13px;
        }
        .temp-step {
          grid-template-columns: 26px minmax(0, 1fr);
          gap: 10px;
        }
        .temp-step span {
          width: 26px;
          height: 26px;
          border-radius: 8px;
          font-size: 12.5px;
        }
        .temp-step strong {
          font-size: 14px;
        }
        .temp-step p {
          font-size: 12px;
        }
        .temp-profile {
          gap: 11px;
        }
        .temp-eyebrow {
          font-size: 11px;
        }
        .temp-profile-head span {
          min-height: 23px;
          padding: 5px 10px;
          font-size: 10.5px;
        }
        .temp-profile-card h2 {
          font-size: 18px;
        }
        .temp-facts {
          margin: 12px -14px 0;
        }
        .temp-facts div {
          min-height: 50px;
          padding: 9px 14px;
        }
        .temp-facts span {
          margin-bottom: 3px;
          font-size: 10px;
        }
        .temp-facts strong {
          font-size: 13px;
        }
        .temp-profile textarea {
          min-height: 70px;
          padding: 12px;
          border-radius: 11px;
          font-size: 13px;
        }
        .temp-profile-actions {
          gap: 8px;
        }
        .temp-success,
        .temp-warning {
          padding: 9px 10px;
          border-radius: 10px;
          font-size: 11.5px;
        }
        .temp-other-agencies {
          margin: 15px 16px 0 !important;
        }
        .temp-agency-list a {
          gap: 9px;
          padding: 9px 0;
        }
        .temp-agency-list strong {
          font-size: 13px;
        }
        .temp-agency-list small {
          font-size: 11.5px;
        }
        .temp-agency-list b {
          font-size: 22px;
        }
        @media (max-width: 420px) {
          .temp-hero {
            padding: 16px 14px 19px;
          }
          .temp-grid {
            padding: 14px 14px 0;
          }
          .temp-other-agencies {
            margin-inline: 14px !important;
          }
          .temp-hero h1 {
            font-size: 21px;
          }
        }
      `}</style>

      <div className="temp-shell">
        <section className="temp-hero">
          <div className="temp-hero-main">
            <div className="temp-hero-brand">
              <img src="/favicon.svg" alt="Latido" />
              <span>Perfil Laboral Latido</span>
            </div>
            <h1>Trabaja con {agency.name}</h1>
            <p>{agency.description}</p>
            <button className="temp-main-cta" type="button" onClick={sendProfile} disabled={!canSendProfile}>
              Enviar mi perfil
            </button>
            <div className="temp-hero-actions">
              <Link to={`/workcheck-construccion?agency=${agency.slug}`}>
                Crear Perfil Laboral
              </Link>
              <Link to={`/portal-temporera/${agency.slug}`}>
                Ver portal temporera
              </Link>
            </div>
          </div>
          <aside className="temp-meta">
            <div><span>Temporera</span><strong>{agency.name}</strong></div>
            <div><span>Ciudad</span><strong>{agency.city}</strong></div>
            <div><span>Sectores</span><strong>{agency.sectors.map(sector => LABOR_SECTORS[sector]?.label || sector).join(', ')}</strong></div>
            <div><span>Contacto</span><strong>{agency.contact}</strong></div>
          </aside>
        </section>

        <div className="temp-grid">
          <section className="temp-panel">
            <h2>Cómo funciona para candidatos</h2>
            <p>
              Latido no promete contratación. Prepara tu información declarada para que la temporera pueda valorar mejor si encajas.
            </p>
            <div className="temp-steps">
              <div className="temp-step"><span>1</span><div><strong>Creas o actualizas tu perfil</strong><p>Disponibilidad, movilidad, experiencia, tareas y seguridad.</p></div></div>
              <div className="temp-step"><span>2</span><div><strong>Autorizas el envío</strong><p>Solo se comparte con esta temporera cuando tú lo confirmas.</p></div></div>
              <div className="temp-step"><span>3</span><div><strong>La temporera lo revisa</strong><p>Puede filtrar, contactar y cambiar el estado de la candidatura.</p></div></div>
            </div>
          </section>

          <section className="temp-profile">
            {!profile && (
              <>
                <h2>Tu Perfil Laboral</h2>
                <p>Todavía no tienes un Perfil Laboral de construcción guardado en este navegador.</p>
                <Link to={`/workcheck-construccion?agency=${agency.slug}`}>Crear perfil para {agency.name}</Link>
              </>
            )}

                {profile && (
              <>
                {!acceptsConstruction && (
                  <p className="temp-warning">
                    Tienes perfil de construcción, pero esta temporera no busca construcción ahora. Puedes crear otro sector cuando esté disponible.
                  </p>
                )}
                <div className="temp-profile-head">
                  <p className="temp-eyebrow">Tu perfil laboral</p>
                  <span>{profile.analysis?.completion || 0}% completado</span>
                </div>
                <div className="temp-profile-card">
                  <h2>{profile.analysis?.profile || profile.form?.role || 'Perfil guardado'}</h2>
                  <p>
                    Tu resumen está preparado para enviarlo. La temporera verá la ficha filtrada completa cuando confirmes el envío.
                  </p>
                  <div className="temp-facts">
                    <div><span>Actualizado</span><strong>{formatLaborDate(profile.updatedAt)}</strong></div>
                    <div><span>Disponible</span><strong className="temp-good">{profile.form?.start || '-'}</strong></div>
                    <div><span>Movilidad</span><strong>{getProfileMobility(profile.form)}</strong></div>
                    <div><span>Alemán</span><strong>{profile.form?.german || '-'}</strong></div>
                  </div>
                </div>
                <textarea
                  value={message}
                  onChange={event => setMessage(event.target.value)}
                  maxLength={220}
                  placeholder="Mensaje opcional antes de enviar"
                />
                <div className="temp-profile-actions">
                  <button type="button" onClick={sendProfile} disabled={!canSendProfile}>
                    Enviar Perfil Laboral
                  </button>
                  <Link to={`/workcheck-construccion?edit=${profile.id}&agency=${agency.slug}`}>
                    Actualizar antes
                  </Link>
                </div>
              </>
            )}

            {sent && <p className="temp-success">{sent}</p>}
          </section>
        </div>

        <section className="temp-panel temp-other-agencies" style={{ marginTop:14 }}>
          <h2>Otras temporeras demo</h2>
          <div className="temp-agency-list">
            {otherAgencies.map(item => (
              <Link key={item.slug} to={`/temporeras/${item.slug}`}>
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.sectors.map(sector => LABOR_SECTORS[sector]?.label || sector).join(', ')} · {item.city}</small>
                </span>
                <b aria-hidden="true">›</b>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
