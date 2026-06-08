import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getPartnerServiceUrl, trackPartnerInteraction } from '../lib/partnerAttribution'
import { C, PP } from '../lib/theme'
import PartnerServiceIcon from './PartnerServiceIcon'
import PartnerCard from './PartnerCard'

const PARTNER_LOGO = '/partners/suiza-en-espanol/logo-see.webp'
const PARTNER_CARD_SEARCH_TERMS = [
  'suiza en espanol',
  'servicios especializados',
  'vivir en suiza',
  'orientacion en espanol',
  'equipo especializado',
  'seguros',
  'prevision',
  'llegada al pais',
  'llegada',
]

const SERVICES = [
  {
    id:'seguros',
    path:'/seguromedico/',
    icon:'health',
    label:'Seguro de salud',
    color:'#2563EB',
    tint:'#EFF6FF',
    terms:['seguro medico', 'seguro salud', 'seguro de salud', 'seguros', 'salud', 'krankenkasse', 'franquicia', 'prima medica'],
  },
  {
    id:'tercer-pilar',
    path:'/formulario-tercerpilar/',
    icon:'pillar',
    label:'Tercer pilar',
    color:'#0F766E',
    tint:'#ECFDF5',
    terms:['tercer pilar', 'pilar 3', 'pilar 3a', 'jubilacion', 'pension', 'prevision'],
  },
  {
    id:'curso',
    path:'/curso/',
    icon:'course',
    label:'Curso para llegar',
    color:'#9D174D',
    tint:'#FDF2F8',
    terms:['curso', 'llegar a suiza', 'mudanza a suiza', 'emigrar a suiza', 'primeros pasos'],
  },
]

function normalize(value='') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const SEARCH_STOP_WORDS = new Set(['de', 'del', 'el', 'la', 'los', 'las', 'en', 'para', 'por', 'con', 'un', 'una', 'y', 'al'])

function getSearchTokens(value) {
  return normalize(value)
    .split(/\s+/)
    .filter(token => token.length >= 3 && !SEARCH_STOP_WORDS.has(token))
}

function matchesSearchTerms(query, terms) {
  const queryTokens = getSearchTokens(query)
  if (!queryTokens.length) return false

  const indexedTokens = getSearchTokens(terms.join(' '))
  return queryTokens.every(queryToken =>
    indexedTokens.some(indexedToken => indexedToken.startsWith(queryToken))
  )
}

function PartnerAccessLink({
  isLoggedIn,
  externalHref,
  authHref,
  children,
  ...props
}) {
  if (isLoggedIn) {
    return (
      <a
        href={externalHref}
        target="_blank"
        rel="noopener noreferrer sponsored"
        {...props}
      >
        {children}
      </a>
    )
  }

  return (
    <Link to={authHref} {...props}>
      {children}
    </Link>
  )
}

export function getPartnerServiceMatch(query='') {
  const serviceMatch = SERVICES.find(service => {
    const serviceTerms = [service.label, ...service.terms]
    return matchesSearchTerms(query, serviceTerms)
  })

  if (serviceMatch) return serviceMatch

  const matchesPartnerCard = matchesSearchTerms(query, PARTNER_CARD_SEARCH_TERMS)
  return matchesPartnerCard ? { id:'' } : null
}

function PartnerLockup({ light = false }) {
  return (
    <div className="partner-services-lockup">
      <span className="partner-services-lockup-logo">
        <img src="/favicon.svg" alt="" />
      </span>
      <span style={{ color:light ? '#fff' : '#111827' }}>Latido</span>
      <span aria-hidden="true" style={{ color:light ? 'rgba(255,255,255,0.58)' : C.light }}>×</span>
      <span className="partner-services-lockup-logo">
        <img src={PARTNER_LOGO} alt="" />
      </span>
      <span style={{ color:light ? '#fff' : C.text }}>Suiza en Español</span>
    </div>
  )
}

export default function PartnerServicesPromo({
  placement = 'app_home',
  compact = false,
  variant,
  serviceId = '',
  title = '',
  description = '',
}) {
  const { user, isLoggedIn } = useAuth()
  const mode = variant || (compact ? 'featured' : 'compact')
  const selectedService = SERVICES.find(service => service.id === serviceId) || null
  const partnerPath = `/servicios-suiza?from=${encodeURIComponent(placement)}`
  const partnerAuthPath = `/auth?next=${encodeURIComponent(partnerPath)}`
  const partnerInfoPath = isLoggedIn ? partnerPath : partnerAuthPath
  const serviceUrls = useMemo(
    () => Object.fromEntries(SERVICES.map(service => [service.id, getPartnerServiceUrl(service.path, service.id)])),
    []
  )

  const handleOpen = () => {
    trackPartnerInteraction('partner_promo_open', {
      userId:user?.id,
      placement,
      destination:partnerInfoPath,
    })
  }

  const handleServiceOpen = service => {
    trackPartnerInteraction('partner_service_click', {
      userId:user?.id,
      placement,
      service:service.id,
      destination:isLoggedIn ? service.path : partnerAuthPath,
    })
  }

  if (mode === 'public-featured') {
    return (
      <section
        aria-labelledby={`partner-promo-${placement}`}
        className="public-partner-section"
      >
        <div className="public-partner-heading">
          <span>Partners seleccionados</span>
          <h2>Más apoyo para vivir en Suiza con confianza</h2>
          <p>
            Colaboramos con equipos especializados que entienden las necesidades
            de la comunidad hispanohablante.
          </p>
        </div>

        <div className="public-partner-card">
          <span className="public-partner-orb public-partner-orb--one" aria-hidden="true" />
          <span className="public-partner-orb public-partner-orb--two" aria-hidden="true" />

          <div className="public-partner-copy">
            <div className="public-partner-lockup">
              <PartnerLockup />
            </div>
            <span className="public-partner-kicker">Partner destacado</span>
            <h3 id={`partner-promo-${placement}`}>
              Servicios especializados para tu vida en Suiza
            </h3>
            <p id={`partner-promo-description-${placement}`}>
              Orientación cercana en español sobre seguro médico, previsión y
              preparación para tu llegada al país.
            </p>

            <div className="public-partner-trust" aria-label="Ventajas del servicio">
              <span>Atención en español</span>
              <span>Sin compromiso</span>
              <span>Equipo especializado</span>
            </div>

            <Link
              to={partnerInfoPath}
              onClick={handleOpen}
              className="public-partner-cta"
              aria-describedby={`partner-promo-description-${placement}`}
            >
              Descubrir todos los servicios <span aria-hidden="true">→</span>
            </Link>
          </div>

          <div className="public-partner-services" aria-label="Servicios de Suiza en Español">
            <span className="public-partner-services-label">¿En qué pueden ayudarte?</span>
            {SERVICES.map((service, index) => (
              <PartnerAccessLink
                key={service.id}
                isLoggedIn={isLoggedIn}
                externalHref={serviceUrls[service.id]}
                authHref={partnerAuthPath}
                onClick={() => handleServiceOpen(service)}
                className="public-partner-service"
                style={{
                  '--service-color':service.color,
                  '--service-tint':service.tint,
                  '--service-delay':`${index * 120}ms`,
                }}
                aria-label={isLoggedIn ? `${service.label}. Se abre en Suiza en Español` : `${service.label}. Inicia sesión para acceder`}
              >
                <span className="public-partner-service-icon">
                  <PartnerServiceIcon type={service.icon} size={22} color={service.color} />
                </span>
                <span>
                  <strong>{service.label}</strong>
                  <small>
                    {service.id === 'seguros' && 'Compara opciones y recibe orientación'}
                    {service.id === 'tercer-pilar' && 'Planifica tu futuro y optimiza impuestos'}
                    {service.id === 'curso' && 'Prepárate antes de establecerte en el país'}
                  </small>
                </span>
                <span className="public-partner-service-arrow" aria-hidden="true">↗</span>
              </PartnerAccessLink>
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (mode === 'partner-card' || mode === 'compact') {
    return (
      <PartnerCard
        id="suiza-en-espanol"
        brand={{
          primaryLogo:'/favicon.svg',
          primaryName:'Latido',
          partnerLogo:PARTNER_LOGO,
          partnerName:'Suiza en Español',
        }}
        title="Servicios especializados para vivir en Suiza"
        description="Orientación en español con un equipo especializado en seguros, previsión y llegada al país."
        services={SERVICES.map(service => ({
          ...service,
          href:isLoggedIn ? serviceUrls[service.id] : partnerAuthPath,
          external:isLoggedIn,
        }))}
        cta={{
          href:partnerInfoPath,
          label:'Contactar',
        }}
        onServiceClick={handleServiceOpen}
        onCtaClick={handleOpen}
      />
    )
  }

  if (mode === 'contextual') {
    const contextualTitle = title || (selectedService
      ? `¿Necesitas ayuda con ${selectedService.label.toLowerCase()}?`
      : '¿No encuentras lo que necesitas?')
    const contextualDescription = description || 'Nuestro partner Suiza en Español puede orientarte y ofrecerte servicios especializados en tu idioma.'

    return (
      <aside
        aria-labelledby={`partner-promo-${placement}`}
        className={`partner-services-contextual${placement.startsWith('global_search') ? ' partner-services-contextual--search' : ''}`}
      >
        <div className="partner-services-contextual-mark" aria-hidden="true">
          <img src={PARTNER_LOGO} alt="" />
        </div>
        <div className="partner-services-contextual-copy">
          <span className="partner-services-eyebrow">Partner recomendado</span>
          <h2 id={`partner-promo-${placement}`}>{contextualTitle}</h2>
          <p>{contextualDescription}</p>
        </div>
        {selectedService ? (
          <PartnerAccessLink
            className="partner-services-contextual-cta"
            isLoggedIn={isLoggedIn}
            externalHref={serviceUrls[selectedService.id]}
            authHref={partnerAuthPath}
            onClick={() => handleServiceOpen(selectedService)}
          >
            Consultar <span aria-hidden="true">↗</span>
          </PartnerAccessLink>
        ) : (
          <Link
            className="partner-services-contextual-cta"
            to={partnerInfoPath}
            onClick={handleOpen}
          >
            Ver servicios <span aria-hidden="true">→</span>
          </Link>
        )}
      </aside>
    )
  }

  return (
    <section
      aria-labelledby={`partner-promo-${placement}`}
      className="partner-services-promo"
      style={{ maxWidth:900, margin:'0 auto', padding:'56px 24px 0' }}
    >
      <div className="partner-services-promo-card" style={{
        position:'relative',
        overflow:'hidden',
        borderRadius:24,
        padding:'32px 30px',
        background:'linear-gradient(135deg, #F8FAFF 0%, #EEF5FF 100%)',
        border:'1px solid #D8E5F7',
        boxShadow:'0 18px 48px rgba(30,64,175,0.12)',
      }}>
        <div aria-hidden="true" style={{ position:'absolute', top:0, left:0, right:0, height:5, background:'linear-gradient(90deg, #2563EB 0%, #2563EB 78%, #C8102E 78%, #C8102E 100%)' }} />
        <div aria-hidden="true" style={{ position:'absolute', width:230, height:230, borderRadius:'50%', right:-115, top:-125, background:'rgba(37,99,235,0.07)' }} />
        <div aria-hidden="true" style={{ position:'absolute', width:150, height:150, borderRadius:'50%', left:-90, bottom:-105, background:'rgba(200,16,46,0.05)' }} />

        <div className="partner-services-promo-layout" style={{ position:'relative', zIndex:1, display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', alignItems:'center', gap:28 }}>
          <div>
            <div style={{ display:'inline-flex', alignItems:'center', padding:'7px 11px', borderRadius:999, background:'#fff', border:'1px solid #D8E5F7', boxShadow:'0 5px 16px rgba(15,23,42,0.05)', marginBottom:16 }}>
              <PartnerLockup />
            </div>
            <h2 id={`partner-promo-${placement}`} style={{ fontFamily:PP, fontWeight:900, fontSize:'clamp(23px,4vw,33px)', lineHeight:1.15, letterSpacing:-0.65, color:'#102A5C', margin:'0 0 10px', maxWidth:510 }}>
              Servicios para vivir mejor en Suiza
            </h2>
            <p id={`partner-promo-description-${placement}`} style={{ fontFamily:PP, fontSize:13, lineHeight:1.7, color:C.mid, margin:0, maxWidth:540 }}>
              Orientación en español sobre seguro médico, tercer pilar y preparación para tu llegada.
            </p>
          </div>

          <div>
            <div className="partner-services-promo-options" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(105px,1fr))', gap:9, marginBottom:16 }}>
              {SERVICES.map(service => (
                <PartnerAccessLink
                  className="partner-services-promo-option"
                  key={service.id}
                  isLoggedIn={isLoggedIn}
                  externalHref={serviceUrls[service.id]}
                  authHref={partnerAuthPath}
                  onClick={() => handleServiceOpen(service)}
                  aria-label={isLoggedIn ? `${service.label}. Se abre en Suiza en Español` : `${service.label}. Inicia sesión para acceder`}
                  style={{ position:'relative', minWidth:0, background:'#fff', border:'1px solid #DCE7F5', borderRadius:14, padding:'11px 9px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:7, textAlign:'center', textDecoration:'none', boxShadow:'0 6px 18px rgba(15,23,42,0.04)', transition:'transform .18s ease, border-color .18s ease, box-shadow .18s ease' }}
                >
                  <span style={{ width:34, height:34, borderRadius:11, background:service.tint, color:service.color, display:'grid', placeItems:'center', flexShrink:0 }}>
                    <PartnerServiceIcon type={service.icon} size={19} color={service.color} />
                  </span>
                  <span style={{ fontFamily:PP, fontWeight:700, fontSize:10, lineHeight:1.3, color:C.text }}>{service.label}</span>
                  <span className="partner-services-promo-option-arrow" aria-hidden="true">↗</span>
                </PartnerAccessLink>
              ))}
            </div>
            <Link
              to={partnerInfoPath}
              onClick={handleOpen}
              className="partner-services-cta"
              aria-describedby={`partner-promo-description-${placement}`}
              style={{ width:'100%', boxSizing:'border-box', display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, minHeight:58, padding:'8px 12px 8px 22px', borderRadius:15, background:'linear-gradient(135deg, #2563EB, #1D4ED8)', color:'#fff', textDecoration:'none', fontFamily:PP, fontWeight:800, fontSize:15, boxShadow:'0 12px 28px rgba(37,99,235,0.25)', transition:'transform .18s ease, box-shadow .18s ease, background .18s ease' }}
            >
              <span style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', lineHeight:1.2 }}>
                <span>Explorar todos los servicios</span>
                <span style={{ marginTop:3, fontWeight:500, fontSize:10, color:'rgba(255,255,255,0.78)' }}>Información clara y atención en español</span>
              </span>
              <span aria-hidden="true" style={{ width:36, height:36, flexShrink:0, borderRadius:'50%', background:'rgba(255,255,255,0.17)', border:'1px solid rgba(255,255,255,0.18)', display:'grid', placeItems:'center', fontSize:19 }}>→</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
