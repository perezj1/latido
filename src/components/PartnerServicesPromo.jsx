import { useState } from 'react'
import { Link } from 'react-router-dom'
import { C, PP } from '../lib/theme'
import PartnerServiceIcon from './PartnerServiceIcon'
import PartnerCard from './PartnerCard'
import PuntoHispanoContactModal from './PuntoHispanoContactModal'

import { PUNTO_HISPANO_LOGO as PARTNER_LOGO } from '../lib/puntoHispano'
const PARTNER_CARD_SEARCH_TERMS = [
  'punto hispano',
  'asesoria',
  'alquiler de viviendas',
  'alquiler de vehiculos',
  'soluciones digitales',
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
    id:'alquiler',
    icon:'key',
    label:'Alquiler',
    color:'#2563EB',
    tint:'#EFF6FF',
    terms:['alquiler', 'alquilar', 'vehiculos', 'coches'],
  },
  {
    id:'gestoria',
    icon:'documents',
    label:'Gestoría',
    color:'#0F766E',
    tint:'#ECFDF5',
    terms:['gestoria', 'administracion', 'tramites', 'desempleo', 'rav', 'cv', 'documentacion', 'traducciones', 'asesoria legal', 'permisos'],
  },
  {
    id:'vivienda',
    icon:'home',
    label:'Vivienda',
    color:'#9D174D',
    tint:'#FDF2F8',
    terms:['vivienda', 'viviendas', 'pisos', 'apartamentos', 'inmobiliaria'],
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
      <span className="partner-services-lockup-latido" style={{ color:light ? '#fff' : undefined }}>Latido</span>
      <span aria-hidden="true" style={{ color:light ? 'rgba(255,255,255,0.58)' : C.light }}>×</span>
      <span className="partner-services-lockup-logo">
        <img src={PARTNER_LOGO} alt="" />
      </span>
      <span style={{ color:light ? '#fff' : C.text }}>Punto Hispano</span>
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
  const [contactOpen, setContactOpen] = useState(false)
  const [contactCategory, setContactCategory] = useState('')
  const mode = variant || (compact ? 'featured' : 'compact')
  const selectedService = SERVICES.find(service => service.id === serviceId) || null
  const partnerPath = `/servicios-suiza?from=${encodeURIComponent(placement)}&action=cta`
  const serviceUrls = Object.fromEntries(SERVICES.map(service => [
    service.id, `${partnerPath}&category=${encodeURIComponent(service.id)}`,
  ]))
  const openContact = (category = '') => {
    setContactCategory(category)
    setContactOpen(true)
  }
  const contactModal = (
    <PuntoHispanoContactModal
      open={contactOpen}
      placement={placement}
      initialCategory={contactCategory}
      onClose={() => setContactOpen(false)}
    />
  )

  if (mode === 'public-featured') {
    return (
      <><PartnerCard
        id={`punto-hispano-${placement}`}
        className="public-partner-tile"
        brand={{
          partnerLogo:PARTNER_LOGO,
          partnerName:'Punto Hispano',
        }}
        title="Servicios especializados para vivir en Suiza"
        description="Punto Hispano te ayuda con gestoría, asesoría, seguros e idiomas en Suiza, con atención en español."
        services={SERVICES.map(service => ({
          ...service,
          href:serviceUrls[service.id],
          external:false,
        }))}
        cta={{ label:'Contactar', button:true }}
        onCtaClick={() => openContact()}
      />{contactModal}</>
    )
  }

  if (mode === 'partner-card' || mode === 'compact') {
    return (
      <><PartnerCard
        id="punto-hispano"
        brand={{
          partnerLogo:PARTNER_LOGO,
          partnerName:'Punto Hispano',
        }}
        title="Servicios especializados para vivir en Suiza"
        description="Punto Hispano te ayuda con gestoría, asesoría, seguros e idiomas en Suiza, con atención en español."
        services={SERVICES.map(service => ({
          ...service,
          href:serviceUrls[service.id],
          external:false,
        }))}
        cta={{ label:'Contactar', button:true }}
        onCtaClick={() => openContact()}
      />{contactModal}</>
    )
  }

  if (mode === 'contextual') {
    const contextualTitle = title || (selectedService
      ? `¿Necesitas ayuda con ${selectedService.label.toLowerCase()}?`
      : '¿No encuentras lo que necesitas?')
    const contextualDescription = description || 'Nuestro colaborador Punto Hispano puede orientarte y ofrecerte servicios especializados en tu idioma.'

    return (
      <><aside
        aria-labelledby={`partner-promo-${placement}`}
        className={`partner-services-contextual${placement.startsWith('global_search') ? ' partner-services-contextual--search' : ''}`}
      >
        <div className="partner-services-contextual-mark" aria-hidden="true">
          <img src={PARTNER_LOGO} alt="" />
        </div>
        <div className="partner-services-contextual-copy">
          <span className="partner-services-eyebrow">Partner premium recomendado</span>
          <h2 id={`partner-promo-${placement}`}>{contextualTitle}</h2>
          <p>{contextualDescription}</p>
        </div>
        <button
          type="button"
          className="partner-services-contextual-cta"
          onClick={() => openContact(selectedService?.id || '')}
          style={{ border:0, cursor:'pointer' }}
        >
          Contactar <span aria-hidden="true">→</span>
        </button>
      </aside>{contactModal}</>
    )
  }

  return (
    <section
      aria-labelledby={`partner-promo-${placement}`}
      className="partner-services-promo latido-page-container"
      style={{ maxWidth:900, paddingTop:56 }}
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
              Atención en español de Punto Hispano para tus trámites, seguros, asesoría y formación en idiomas.
            </p>
          </div>

          <div>
            <div className="partner-services-promo-options" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(105px,1fr))', gap:9, marginBottom:16 }}>
              {SERVICES.map(service => (
                <Link
                  className="partner-services-promo-option"
                  key={service.id}
                  to={serviceUrls[service.id]}
                  aria-label={`${service.label}. Elegir servicio de Punto Hispano`}
                  style={{ position:'relative', minWidth:0, background:'#fff', border:'1px solid #DCE7F5', borderRadius:14, padding:'11px 9px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:7, textAlign:'center', textDecoration:'none', boxShadow:'0 6px 18px rgba(15,23,42,0.04)', transition:'transform .18s ease, border-color .18s ease, box-shadow .18s ease' }}
                >
                  <span style={{ width:34, height:34, borderRadius:11, background:service.tint, color:service.color, display:'grid', placeItems:'center', flexShrink:0 }}>
                    <PartnerServiceIcon type={service.icon} size={19} color={service.color} />
                  </span>
                  <span style={{ fontFamily:PP, fontWeight:700, fontSize:10, lineHeight:1.3, color:C.text }}>{service.label}</span>
                  <span className="partner-services-promo-option-arrow" aria-hidden="true">↗</span>
                </Link>
              ))}
            </div>
            <button
              type="button"
              onClick={() => openContact()}
              className="partner-services-cta"
              aria-describedby={`partner-promo-description-${placement}`}
              style={{ width:'100%', boxSizing:'border-box', display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, minHeight:58, padding:'8px 12px 8px 22px', border:0, borderRadius:15, background:'linear-gradient(135deg, #2563EB, #1D4ED8)', color:'#fff', textDecoration:'none', fontFamily:PP, fontWeight:800, fontSize:15, boxShadow:'0 12px 28px rgba(37,99,235,0.25)', transition:'transform .18s ease, box-shadow .18s ease, background .18s ease', cursor:'pointer' }}
            >
              <span style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', lineHeight:1.2 }}>
                <span>Contactar</span>
                <span style={{ marginTop:3, fontWeight:500, fontSize:10, color:'rgba(255,255,255,0.78)' }}>Información clara y atención en español</span>
              </span>
              <span aria-hidden="true" style={{ width:36, height:36, flexShrink:0, borderRadius:'50%', background:'rgba(255,255,255,0.17)', border:'1px solid rgba(255,255,255,0.18)', display:'grid', placeItems:'center', fontSize:19 }}>→</span>
            </button>
          </div>
        </div>
      </div>
      {contactModal}
    </section>
  )
}
