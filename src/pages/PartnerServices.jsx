import { useEffect, useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  getPartnerServiceUrl,
  trackPartnerInteraction,
} from '../lib/partnerAttribution'
import './PartnerServices.css'

const ASSET_PATH = '/partners/suiza-en-espanol'

const SERVICES = [
  {
    id:'seguros',
    tag:'Seguro de salud',
    title:'Compara tu Krankenkasse',
    description:'El seguro de salud es obligatorio y elegir bien te puede ahorrar cientos de francos al año.',
    bullets:['Comparativa personalizada gratis', 'Un asesor te explica en español', 'Sin coste y sin compromiso'],
    cta:'Que me orienten →',
    note:'Gratis, sin compromiso',
    path:'/seguromedico/',
  },
  {
    id:'tercer-pilar',
    tag:'Jubilación · 3a',
    title:'Tu tercer pilar',
    description:'El pilar 3a es ahorrar para tu jubilación y pagar menos impuestos cada año.',
    bullets:['Desgrava tu aportación cada año', 'Asesor regulado FINMA, en español', 'Te orienta, decides tú'],
    cta:'Quiero entenderlo →',
    note:'Gratis, sin compromiso',
    path:'/formulario-tercerpilar/',
    featured:true,
  },
  {
    id:'curso',
    tag:'Formación',
    title:'Curso Destino Suiza',
    description:'Todo lo que necesitas para aterrizar en Suiza paso a paso, sin perderte.',
    bullets:['Permisos, seguros, banca y vivienda', 'Cómo buscar trabajo de verdad', 'La guía para recién llegados'],
    cta:'Ver el curso →',
    note:'Formación completa',
    path:'/curso/',
  },
]

const FOOTER_LINKS = [
  ['Herramientas', '/herramientas/'],
  ['Cantones', '/cantones/'],
  ['Empleo', '/empleo/'],
  ['Glosario', '/glosario/'],
  ['Noticias', '/noticias/'],
  ['Guías', '/guias/'],
  ['Curso', '/curso/'],
  ['eSIM suiza', '/esimexclusiva/'],
  ['Quiénes somos', '/sobre-nosotros/'],
  ['Empresa', '/empresas/'],
  ['Para marcas', '/empresas/media-kit/'],
  ['Privacidad', '/politica-de-privacidad/'],
]

function partnerUrl(path) {
  return new URL(path, 'https://suizaespanol.com').toString()
}

export default function PartnerServices() {
  const { user } = useAuth()
  const location = useLocation()
  const placement = new URLSearchParams(location.search).get('from') || 'direct'
  const serviceUrls = useMemo(
    () => Object.fromEntries(SERVICES.map(service => [service.id, getPartnerServiceUrl(service.path, service.id)])),
    [location.search]
  )

  useEffect(() => {
    trackPartnerInteraction('partner_page_view', {
      userId:user?.id,
      placement,
      destination:'/servicios-suiza',
    })
  }, [placement, user?.id])

  const trackServiceClick = service => {
    trackPartnerInteraction('partner_service_click', {
      userId:user?.id,
      placement,
      service:service.id,
      destination:service.path,
    })
  }

  const trackCrossClick = destination => {
    trackPartnerInteraction('partner_cross_click', {
      userId:user?.id,
      placement,
      destination,
    })
  }

  return (
    <div className="see-landing">
      <header className="see-cobar">
        <div className="see-cobar-lock">
          <Link className="see-cobar-brand see-cobar-latido" to="/" aria-label="Ir a Latido">
            <span className="see-cobar-latido-mark">
              <img src="/favicon.svg" alt="" />
            </span>
            <span>Latido</span>
          </Link>
          <span className="see-cobar-context">Servicios para la comunidad</span>
        </div>
        <Link className="see-cobar-back" to="/">
          <span className="see-cobar-back-icon" aria-hidden="true">←</span>
          <span className="see-cobar-back-full">Volver a Latido</span>
          <span className="see-cobar-back-short">Volver</span>
        </Link>
      </header>

      <section className="see-hero">
        <div className="see-hero-inner">
          <div className="see-hero-copy">
            <div className="see-hero-cobrand" aria-label="Latido en colaboración con Suiza en Español">
              <span className="see-hero-cobrand-brand">
                <span className="see-hero-cobrand-mark see-hero-cobrand-latido">
                  <img src="/favicon.svg" alt="" />
                </span>
                <strong>Latido</strong>
              </span>
              <span className="see-hero-cobrand-x" aria-hidden="true">×</span>
              <a className="see-hero-cobrand-brand" href="https://suizaespanol.com" target="_blank" rel="noopener noreferrer">
                <span className="see-hero-cobrand-mark see-hero-cobrand-partner">
                  <img src={`${ASSET_PATH}/logo-see.webp`} alt="" width="900" height="776" />
                </span>
                <strong>Suiza en Español</strong>
              </a>
            </div>
            <div className="see-hero-label"><span /> Servicios para la comunidad</div>
            <h1>Lo que necesitas para <em>vivir en Suiza</em>, en español</h1>
            <p>Seguro de salud, tu jubilación y la formación para aterrizar. Te orientamos sin compromiso, con asesores que hablan tu idioma.</p>
            <a className="see-hero-cta" href="#servicios">Ver los servicios →</a>
            <div className="see-hero-chips">
              <span><b>✓</b> Orientación gratis</span>
              <span><b>✓</b> En español</span>
              <span><b>✓</b> Sin compromiso</span>
            </div>
            <div className="see-press">
              <span className="see-press-label">En prensa</span>
              <span className="see-press-word see-larazon">La Razón</span>
              <span className="see-press-word see-as">as</span>
              <span className="see-press-word">HUFFPOST</span>
            </div>
          </div>

          <div className="see-hero-visual">
            <div className="see-hero-photo-card">
              <span className="see-hero-caption">Dani, cofundador</span>
              <img
                className="see-hero-photo"
                src={`${ASSET_PATH}/dani-founder.jpg`}
                alt="Dani Paniagua, cofundador de Suiza en Español"
                width="800"
                height="1067"
              />
              <div className="see-hero-badge">
                <img src={`${ASSET_PATH}/logo-see.webp`} alt="" />
                Suiza en Español
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="see-wrap">
        <div className="see-router">
          <span className="see-router-icon" aria-hidden="true">🧭</span>
          <p><b>¿No sabes por dónde empezar?</b> Si acabas de llegar, empieza por el <b>seguro de salud</b> o el <b>curso</b>. Si ya trabajas aquí, mira el <b>tercer pilar</b> para ahorrar en impuestos.</p>
        </div>
      </div>

      <section className="see-services" id="servicios">
        <div className="see-wrap">
          <div className="see-eyebrow">Los servicios</div>
          <h2>Tres formas de empezar bien</h2>
          <p className="see-services-sub">Elige lo que necesitas ahora. Te atendemos en español y sin compromiso.</p>

          <div className="see-services-grid">
            {SERVICES.map(service => (
              <article className={`see-service-card${service.featured ? ' is-featured' : ''}`} key={service.id}>
                {service.featured && <span className="see-service-ribbon">El más recomendado</span>}
                <span className="see-service-tag">{service.tag}</span>
                <h3>{service.title}</h3>
                <p className="see-service-description">{service.description}</p>
                <ul>
                  {service.bullets.map(item => <li key={item}>{item}</li>)}
                </ul>
                <a
                  className="see-service-cta"
                  href={serviceUrls[service.id]}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  onClick={() => trackServiceClick(service)}
                >
                  {service.cta}
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
            <div className="see-step"><div className="see-step-number">1</div><h3>Eliges el servicio</h3><p>El que necesitas ahora. Sin rellenar nada de más.</p></div>
            <div className="see-step"><div className="see-step-number">2</div><h3>Te atendemos en español</h3><p>Un asesor de confianza te orienta sin compromiso.</p></div>
            <div className="see-step"><div className="see-step-number">3</div><h3>Decides tú</h3><p>Con la información clara. Sin presión y sin coste.</p></div>
          </div>
        </div>
      </section>

      <section className="see-team">
        <div className="see-team-inner">
          <div className="see-team-photos">
            <img src={`${ASSET_PATH}/dani-founder.jpg`} alt="Dani Paniagua, cofundador de Suiza en Español" width="800" height="1067" loading="lazy" />
            <img src={`${ASSET_PATH}/bruno-founder.jpg`} alt="Bruno Flores, cofundador de Suiza en Español" width="800" height="1067" loading="lazy" />
          </div>
          <div>
            <h2>No somos una agencia. Somos el equipo que ya vivió lo que tú vives.</h2>
            <p>Suiza en Español nació porque nosotros mismos llegamos sin saber nada del sistema: elegimos mal el cantón, no entendíamos las cartas de impuestos y tardamos años en descubrir dinero que teníamos derecho a recuperar.</p>
            <p>Eso no va a pasarte a ti. Por eso te conectamos solo con asesores de confianza que te atienden en tu idioma, sin compromiso.</p>
            <div className="see-team-signature">Dani y Bruno, cofundadores</div>
          </div>
        </div>
      </section>

      <section className="see-trust">
        <div className="see-wrap">
          <div className="see-trust-grid">
            <div className="see-stat"><div>160K</div><span>Instagram</span></div>
            <div className="see-stat"><div>166K</div><span>TikTok</span></div>
            <div className="see-stat"><div>3,7M</div><span>Views al mes</span></div>
            <div className="see-stat"><div>#1</div><span>Comunidad sobre Suiza</span></div>
          </div>
          <p className="see-trust-line">La mayor comunidad hispanohablante sobre integración y éxito en Suiza.</p>
        </div>
      </section>

      <section className="see-reels">
        <div className="see-wrap">
          <h2>Así explicamos Suiza cada día</h2>
          <p className="see-reels-sub">Lo que compartimos con la comunidad, en español y sin tecnicismos.</p>
          <div className="see-reels-grid">
            <img src={`${ASSET_PATH}/reel-trabajos.jpg`} alt="Contenido de Suiza en Español sobre trabajos en Suiza" width="400" height="400" loading="lazy" />
            <img src={`${ASSET_PATH}/reel-franco.jpg`} alt="Contenido de Suiza en Español sobre el franco suizo" width="400" height="400" loading="lazy" />
            <img src={`${ASSET_PATH}/reel-gasolina.jpg`} alt="Contenido de Suiza en Español sobre el coste de vida" width="400" height="400" loading="lazy" />
            <img src={`${ASSET_PATH}/reel-costumbres.jpg`} alt="Contenido de Suiza en Español sobre costumbres suizas" width="400" height="400" loading="lazy" />
          </div>
        </div>
      </section>

      <section className="see-faq">
        <div className="see-wrap">
          <h2>Preguntas rápidas</h2>
          <div className="see-faq-list">
            <details>
              <summary>¿Cuánto cuesta?</summary>
              <p>La orientación de seguro de salud y tercer pilar es gratis y sin compromiso. Lo único de pago es el curso Destino Suiza, con un precio único.</p>
            </details>
            <details>
              <summary>¿Quién me va a atender?</summary>
              <p>Asesores certificados y, en el caso del tercer pilar, regulados por la FINMA. Todos te atienden en español, de forma personal e independiente.</p>
            </details>
            <details>
              <summary>¿Me van a presionar para contratar algo?</summary>
              <p>No. Te orientamos para que entiendas tus opciones y decidas tú con calma. No vendemos ni recomendamos productos concretos.</p>
            </details>
            <details>
              <summary>¿Por qué me fío?</summary>
              <p>Somos Suiza en Español, la mayor comunidad hispanohablante sobre vivir en Suiza, con más de 300.000 personas siguiéndonos. Llevamos años ayudando a la comunidad a integrarse aquí.</p>
            </details>
          </div>

          <div className="see-catch">
            <h3>¿No es tu momento?</h3>
            <p>Sigue aprendiendo a moverte en Suiza con nosotros. Cero spam, solo cosas útiles.</p>
            <div>
              <a href="https://instagram.com/suiza.en.espanol" target="_blank" rel="noopener noreferrer" onClick={() => trackCrossClick('instagram')}>Síguenos en Instagram</a>
              <a href={partnerUrl('/newsletter/')} target="_blank" rel="noopener noreferrer" onClick={() => trackCrossClick('newsletter')}>Recibir la guía gratis</a>
            </div>
          </div>

          <p className="see-finma">
            Suiza en Español ofrece información orientativa de carácter general y no constituye asesoramiento financiero, fiscal ni legal. No vendemos ni recomendamos productos: para seguros y tercer pilar te conectamos con asesores certificados que te atienden de forma personal e independiente, sin compromiso de contratación. Los importes de ahorro son estimaciones orientativas; los resultados varían según tu situación y cantón.
          </p>
        </div>
      </section>

      <footer className="see-footer">
        <div className="see-footer-content">
          <div className="see-footer-header">
            <div className="see-footer-logo">
              <img src={`${ASSET_PATH}/logo-see.webp`} alt="Suiza en Español" width="900" height="776" />
              Suiza en Español
            </div>
            <p>La mayor comunidad hispanohablante sobre integración y éxito en Suiza</p>
          </div>
          <div className="see-footer-main">
            <ul className="see-footer-links">
              {FOOTER_LINKS.map(([label, path]) => (
                <li key={path}><a href={partnerUrl(path)} target="_blank" rel="noopener noreferrer">{label}</a></li>
              ))}
            </ul>
            <div className="see-footer-socials">
              <a href="https://instagram.com/suiza.en.espanol" target="_blank" rel="noopener noreferrer">Instagram</a>
              <a href="https://tiktok.com/@suiza.en.espanol" target="_blank" rel="noopener noreferrer">TikTok</a>
              <a href="https://www.youtube.com/@Suiza.en.Espa%C3%B1ol" target="_blank" rel="noopener noreferrer">YouTube</a>
              <a href="mailto:info@suizaespanol.com">Email</a>
            </div>
          </div>
          <div className="see-footer-bottom">
            <p>Suiza en Español ofrece información orientativa de carácter general. No constituye asesoramiento financiero, fiscal ni legal. Para decisiones sobre productos de seguros o tercer pilar, trabajamos con asesores certificados que te atenderán personalmente y de forma independiente. Los rangos de ahorro indicados son estimaciones orientativas basadas en casos reales; los resultados individuales varían según la situación de cada persona y el cantón de residencia.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
