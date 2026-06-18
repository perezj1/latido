import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { trackPartnerInteraction } from '../lib/partnerAttribution'
import './PartnerServices.css'
import './Virtus360Services.css'

const PARTNER_ID = 'virtus360'
const ASSET_PATH = '/partners/virtus360'
const BASE_URL = 'https://www.360-virtus.ch'
const CONTACT_URL = `${BASE_URL}/kontakt.html`

const SERVICES = [
  {
    id:'gestoria-privada',
    tag:'Privatkunden',
    title:'Gestoría privada',
    description:'Delegas cartas, formularios, impuestos, seguros y burocracia diaria para recuperar tiempo y claridad.',
    bullets:['Correspondencia y asesoramiento general', 'Declaración de impuestos y formularios', 'Gestión de seguros, contratos y correo diario'],
    cta:'Ver gestoría privada',
    note:'Atención personal según tu caso',
    href:`${BASE_URL}/privatkunden.html`,
    featured:true,
  },
  {
    id:'entrada-salida',
    tag:'Mudanza',
    title:'Entrada y salida de Suiza',
    description:'Planificación para llegar o salir del país con los trámites importantes bajo control.',
    bullets:['Formularios, contratos y avisos necesarios', 'Caja de pensión, impuestos y seguros', 'Redirección y organización de correspondencia'],
    cta:'Ver mudanza',
    note:'Paquetes para personas y parejas',
    href:`${BASE_URL}/privatkunden/aus-einwanderungen.html`,
  },
  {
    id:'empresas',
    tag:'Unternehmenskunden',
    title:'Contabilidad para empresas',
    description:'Soporte fiduciario y administrativo para que tu empresa funcione con orden en Suiza.',
    bullets:['Contabilidad financiera y salarial', 'IVA, cierres, nóminas y personal', 'Declaraciones fiscales y administración anual'],
    cta:'Ver empresas',
    note:'Planes mensuales o trabajo puntual',
    href:`${BASE_URL}/unternehmenskunden.html`,
  },
]

const TRUST_ITEMS = [
  ['Zúrich - Horgen', 'Equipo local con base en Horgen.'],
  ['+800 clientes', 'Experiencia acumulada con particulares y empresas.'],
  ['Multicultural', 'Acompañamiento pensado para personas internacionales.'],
  ['Banco y seguros', 'Red de apoyo para finanzas, seguros y administración.'],
]

function trackVirtus(eventType, payload = {}) {
  return trackPartnerInteraction(eventType, {
    partnerId:PARTNER_ID,
    ...payload,
  })
}

export default function Virtus360Services() {
  const { user } = useAuth()
  const location = useLocation()
  const placement = new URLSearchParams(location.search).get('from') || 'direct'

  useEffect(() => {
    trackVirtus('partner_page_view', {
      userId:user?.id,
      placement,
      destination:'/servicios-virtus360',
    })
  }, [placement, user?.id])

  useEffect(() => {
    if (!location.hash) return undefined
    const target = document.querySelector(location.hash)
    if (!target) return undefined

    const timer = window.setTimeout(() => {
      target.scrollIntoView({ behavior:'smooth', block:'start' })
    }, 80)

    return () => window.clearTimeout(timer)
  }, [location.hash])

  const trackServiceClick = service => {
    trackVirtus('partner_service_click', {
      userId:user?.id,
      placement,
      service:service.id,
      destination:service.href,
    })
  }

  const trackContactClick = action => {
    trackVirtus('partner_outbound_click', {
      userId:user?.id,
      placement,
      action,
      destination:CONTACT_URL,
    })
  }

  const trackCrossClick = destination => {
    trackVirtus('partner_cross_click', {
      userId:user?.id,
      placement,
      destination,
    })
  }

  return (
    <div className="see-landing v360-landing">
      <header className="see-cobar">
        <div className="see-cobar-lock">
          <Link className="see-cobar-brand see-cobar-latido" to="/" aria-label="Ir a Latido">
            <span className="see-cobar-latido-mark">
              <img src="/favicon.svg" alt="" />
            </span>
            <span>Latido</span>
          </Link>
          <span className="see-cobar-x" aria-hidden="true">x</span>
          <a className="see-cobar-brand v360-cobar-partner" href={BASE_URL} target="_blank" rel="noopener noreferrer">
            <img src={`${ASSET_PATH}/logo.svg`} alt="" />
            <span>Virtus360</span>
          </a>
        </div>
        <Link className="see-cobar-back" to="/">
          <span className="see-cobar-back-icon" aria-hidden="true">←</span>
          <span className="see-cobar-back-full">Volver a Latido</span>
          <span className="see-cobar-back-short">Volver</span>
        </Link>
      </header>

      <section className="see-hero v360-hero">
        <div className="see-hero-inner">
          <div className="see-hero-copy">
            <div className="see-hero-cobrand" aria-label="Latido en colaboracion con Virtus360">
              <span className="see-hero-cobrand-brand">
                <span className="see-hero-cobrand-mark see-hero-cobrand-latido">
                  <img src="/favicon.svg" alt="" />
                </span>
                <strong>Latido</strong>
              </span>
              <span className="see-hero-cobrand-x" aria-hidden="true">x</span>
              <a className="see-hero-cobrand-brand" href={BASE_URL} target="_blank" rel="noopener noreferrer">
                <span className="see-hero-cobrand-mark v360-hero-cobrand-partner">
                  <img src={`${ASSET_PATH}/logo.svg`} alt="" />
                </span>
                <strong>Virtus360</strong>
              </a>
            </div>
            <div className="see-hero-label"><span /> Gestoría para la comunidad</div>
            <h1>Menos papeleo para <em>vivir en Suiza</em> con calma</h1>
            <p>Trámites, impuestos, seguros, correspondencia, mudanzas y contabilidad con una gestoría multicultural desde Horgen.</p>
            <div className="v360-hero-actions">
              <a className="see-hero-cta" href="#servicios">Ver los servicios →</a>
              <a className="v360-hero-contact" href={CONTACT_URL} target="_blank" rel="noopener noreferrer sponsored" onClick={() => trackContactClick('hero_contact')}>
                Contactar
              </a>
            </div>
            <div className="see-hero-chips">
              <span><b>✓</b> Gestoría</span>
              <span><b>✓</b> Multicultural</span>
              <span><b>✓</b> Zúrich - Horgen</span>
            </div>
            <div className="see-press v360-trust-strip">
              <span className="see-press-label">Especialistas en</span>
              <span className="see-press-word">Administración</span>
              <span className="see-press-word">Treuhand</span>
              <span className="see-press-word">Seguros</span>
            </div>
          </div>

          <div className="see-hero-visual">
            <div className="v360-hero-panel" aria-label="Servicios principales de Virtus360">
              <div className="v360-hero-logo-card">
                <img src={`${ASSET_PATH}/logo.svg`} alt="Virtus360" />
              </div>
              <div className="v360-hero-service-list">
                <span>Impuestos y formularios</span>
                <span>Seguros y contratos</span>
                <span>Entrada y salida de Suiza</span>
                <span>Contabilidad y nóminas</span>
              </div>
              <div className="v360-hero-badge">+800 clientes</div>
            </div>
          </div>
        </div>
      </section>

      <div className="see-wrap">
        <div className="see-router">
          <span className="see-router-icon" aria-hidden="true">360</span>
          <p><b>¿No sabes por dónde empezar?</b> Si tienes cartas, formularios o impuestos, empieza por la <b>gestoría privada</b>. Si te mudas, revisa <b>entrada y salida</b>. Si tienes empresa, ve directo a <b>contabilidad</b>.</p>
        </div>
      </div>

      <section className="see-services" id="servicios">
        <div className="see-wrap">
          <div className="see-eyebrow">Los servicios</div>
          <h2>Tres formas de quitarte carga administrativa</h2>
          <p className="see-services-sub">Elige el punto que necesitas resolver ahora. Virtus360 te orienta y te ayuda a ordenar la parte administrativa de tu vida o empresa en Suiza.</p>

          <div className="see-services-grid">
            {SERVICES.map(service => (
              <article className={`see-service-card${service.featured ? ' is-featured' : ''}`} key={service.id}>
                {service.featured && <span className="see-service-ribbon">Buen punto de partida</span>}
                <span className="see-service-tag">{service.tag}</span>
                <h3>{service.title}</h3>
                <p className="see-service-description">{service.description}</p>
                <ul>
                  {service.bullets.map(item => <li key={item}>{item}</li>)}
                </ul>
                <a
                  className="see-service-cta"
                  href={service.href}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  onClick={() => trackServiceClick(service)}
                >
                  {service.cta} →
                </a>
                <span className="see-service-note">{service.note}</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="see-how">
        <div className="see-wrap">
          <h2>Cómo funciona</h2>
          <div className="see-steps">
            <div className="see-step"><div className="see-step-number">1</div><h3>Explicas tu caso</h3><p>Cartas, impuestos, mudanza, seguros o empresa. Empiezas por lo urgente.</p></div>
            <div className="see-step"><div className="see-step-number">2</div><h3>Ordenan el proceso</h3><p>Virtus360 traduce el papeleo suizo a pasos claros y gestionables.</p></div>
            <div className="see-step"><div className="see-step-number">3</div><h3>Delegas con control</h3><p>Recibes acompañamiento personal y decides el alcance del servicio.</p></div>
          </div>
        </div>
      </section>

      <section className="see-team v360-story">
        <div className="see-team-inner">
          <div className="v360-story-card">
            <img src={`${ASSET_PATH}/logo.svg`} alt="Virtus360" />
            <div>
              <strong>Gestoría hispano-suiza</strong>
              <span>Entre clientes, administración pública, fiduciarias, bancos y seguros.</span>
            </div>
          </div>
          <div>
            <h2>Una gestoria creada para reducir burocracia</h2>
            <p>Virtus360 adapta el concepto de gestoría al contexto suizo: un intermediario que ayuda a coordinar administración, fiduciaria, seguros, bancos y contabilidad.</p>
            <p>La propuesta es sencilla: menos carga administrativa para particulares y empresas, más tiempo para la vida diaria y más claridad para tomar decisiones.</p>
            <div className="see-team-signature">Virtus360 GmbH, Horgen</div>
          </div>
        </div>
      </section>

      <section className="see-trust">
        <div className="see-wrap">
          <div className="see-trust-grid">
            {TRUST_ITEMS.map(([title, copy]) => (
              <div className="see-stat v360-stat" key={title}>
                <div>{title}</div>
                <span>{copy}</span>
              </div>
            ))}
          </div>
          <p className="see-trust-line">Administración, Buchhaltung, Treuhand, bancos, seguros y atención personal para casos privados y empresariales.</p>
        </div>
      </section>

      <section className="see-faq">
        <div className="see-wrap">
          <h2>Preguntas rápidas</h2>
          <div className="see-faq-list">
            <details>
              <summary>¿Virtus360 atiende solo a empresas?</summary>
              <p>No. Tiene servicios para particulares y para empresas: desde burocracia diaria e impuestos hasta contabilidad, nóminas y administración empresarial.</p>
            </details>
            <details>
              <summary>¿Con qué trámites puede ayudarme?</summary>
              <p>Con correspondencia, formularios, declaraciones de impuestos, seguros, contratos, planificación de entrada o salida de Suiza y organización de finanzas del día a día.</p>
            </details>
            <details>
              <summary>¿Tambien gestionan mudanzas o salida de Suiza?</summary>
              <p>Sí. Su servicio de entrada y salida incluye formularios, cancelación de contratos, caja de pensión, impuestos del año de salida, seguros y redirección de correspondencia.</p>
            </details>
            <details>
              <summary>¿Como pido una consulta?</summary>
              <p>Puedes abrir el formulario de contacto de Virtus360 desde esta página. Ellos revisan tu caso y te indican el servicio o paquete adecuado.</p>
            </details>
          </div>

          <div className="see-catch">
            <h3>¿Quieres que revisen tu caso?</h3>
            <p>Cuéntales qué necesitas resolver y deja que Virtus360 te oriente con el siguiente paso.</p>
            <div>
              <a href={CONTACT_URL} target="_blank" rel="noopener noreferrer sponsored" onClick={() => trackContactClick('faq_contact')}>Contactar con Virtus360</a>
              <a href={BASE_URL} target="_blank" rel="noopener noreferrer" onClick={() => trackCrossClick('website')}>Ver la web oficial</a>
            </div>
          </div>

          <p className="see-finma">
            Latido presenta esta colaboración como información orientativa. Los servicios, precios y condiciones dependen de Virtus360 y pueden variar según el caso concreto. Para asesoramiento fiscal, financiero, legal o de seguros, consulta directamente con Virtus360 o con profesionales certificados.
          </p>
        </div>
      </section>

      <footer className="see-footer">
        <div className="see-footer-content">
          <div className="see-footer-header">
            <div className="see-footer-logo v360-footer-logo">
              <img src={`${ASSET_PATH}/logo.svg`} alt="Virtus360" />
              Virtus360
            </div>
            <p>Gestoría, administración, finanzas, seguros y contabilidad desde Horgen.</p>
          </div>
          <div className="see-footer-main">
            <ul className="see-footer-links">
              <li><a href={`${BASE_URL}/privatkunden.html`} target="_blank" rel="noopener noreferrer">Particulares</a></li>
              <li><a href={`${BASE_URL}/privatkunden/aus-einwanderungen.html`} target="_blank" rel="noopener noreferrer">Entrada y salida</a></li>
              <li><a href={`${BASE_URL}/unternehmenskunden.html`} target="_blank" rel="noopener noreferrer">Empresas</a></li>
              <li><a href={`${BASE_URL}/ueber-uns.html`} target="_blank" rel="noopener noreferrer">Sobre Virtus360</a></li>
              <li><a href={CONTACT_URL} target="_blank" rel="noopener noreferrer">Contacto</a></li>
            </ul>
            <div className="see-footer-socials">
              <a href={BASE_URL} target="_blank" rel="noopener noreferrer">360-virtus.ch</a>
              <a href="tel:+41438177700">+41 43 817 77 00</a>
              <a href="mailto:info@360-virtus.ch">info@360-virtus.ch</a>
            </div>
          </div>
          <div className="see-footer-bottom">
            <p>360 Virtus GmbH, Oberdorfstrasse 33, 8810 Horgen. Esta página forma parte de la colaboración entre Latido y Virtus360 para facilitar servicios útiles a la comunidad hispanohablante en Suiza.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
