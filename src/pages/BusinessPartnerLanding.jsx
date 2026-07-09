import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { normalizeExternalUrl } from '../lib/links'
import { getNegocioTypeMeta } from '../lib/constants'
import { getIdFromSlug } from '../lib/seo'
import { getBusinessPartnerAnalyticsId, hasActiveBusinessLanding } from '../lib/businessPartners'
import { trackPartnerInteraction } from '../lib/partnerAttribution'
import './PartnerServices.css'

const FALLBACK_LOGO = '/favicon.svg'

function cleanText(value = '', fallback = '') {
  const text = String(value || '').trim()
  return text || fallback
}

function getPhoneDigits(value = '') {
  const digits = String(value || '').replace(/[^\d]/g, '')
  if (!digits) return ''
  if (digits.startsWith('00')) return digits.slice(2)
  if (digits.startsWith('0')) return `41${digits.slice(1)}`
  return digits
}

function getPhoneDisplay(value = '') {
  const digits = getPhoneDigits(value)
  if (!digits) return ''
  if (digits.startsWith('41') && digits.length >= 11) {
    return `+41 ${digits.slice(2, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9, 11)}`.trim()
  }
  return String(value || `+${digits}`).trim()
}

function getUrlDisplay(value = '') {
  try {
    const url = new URL(normalizeExternalUrl(value) || value)
    return `${url.hostname.replace(/^www\./, '')}${url.pathname === '/' ? '' : url.pathname}`.replace(/\/$/, '')
  } catch {
    return String(value || '').replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '')
  }
}

function getInstagramUrl(value = '') {
  const text = String(value || '').trim()
  if (!text) return ''
  return normalizeExternalUrl(text) || `https://instagram.com/${text.replace(/^@/, '')}`
}

function normalizeServices(value) {
  if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean)
  return String(value || '').split(',').map(item => item.trim()).filter(Boolean)
}

function buildActions(provider = {}) {
  const actions = []
  const phoneDigits = getPhoneDigits(provider.whatsapp)
  const phoneDisplay = getPhoneDisplay(provider.whatsapp)
  const email = String(provider.email || '').trim()
  const website = normalizeExternalUrl(provider.website)
  const instagram = getInstagramUrl(provider.instagram)
  const custom = normalizeExternalUrl(provider.partner_cta_url)

  if (phoneDigits) {
    actions.push({ id:'whatsapp', label:'WhatsApp', value:phoneDisplay, href:`https://wa.me/${phoneDigits}`, external:true })
    actions.push({ id:'phone', label:'Llamar', value:phoneDisplay, href:`tel:+${phoneDigits}`, external:false })
  }
  if (email) actions.push({ id:'email', label:'Email', value:email, href:`mailto:${email}`, external:false })
  if (website) actions.push({ id:'website', label:'Web', value:getUrlDisplay(website), href:website, external:true })
  if (instagram) {
    const instagramLabel = String(provider.instagram || '').startsWith('@')
      ? provider.instagram
      : `@${String(provider.instagram || '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/$/, '')}`
    actions.push({ id:'instagram', label:'Instagram', value:instagramLabel, href:instagram, external:true })
  }
  if (custom && !actions.some(action => action.href === custom)) {
    actions.push({
      id:'custom',
      label:cleanText(provider.partner_cta_label, 'Contactar'),
      value:getUrlDisplay(custom),
      href:custom,
      external:true,
    })
  }

  return actions
}

function trackBusinessLanding(eventType, provider, payload = {}) {
  if (!provider?.id) return Promise.resolve()
  return trackPartnerInteraction(eventType, {
    partnerId:getBusinessPartnerAnalyticsId(provider.id),
    ...payload,
  })
}

function LoadingLanding() {
  return (
    <div className="see-landing">
      <div className="bpl-loading">
        <img src="/favicon.svg" alt="" />
        <p>Cargando colaboración</p>
      </div>
    </div>
  )
}

function UnavailableLanding() {
  return (
    <div className="see-landing">
      <header className="see-cobar">
        <Link className="see-cobar-brand see-cobar-latido" to="/" aria-label="Ir a Latido">
          <span className="see-cobar-latido-mark"><img src="/favicon.svg" alt="" /></span>
          <span>Latido</span>
        </Link>
        <Link className="see-cobar-back" to="/">
          <span className="see-cobar-back-icon" aria-hidden="true">←</span>
          <span className="see-cobar-back-full">Volver a Latido</span>
          <span className="see-cobar-back-short">Volver</span>
        </Link>
      </header>
      <main className="bpl-empty">
        <img src="/favicon.svg" alt="" />
        <h1>Landing no disponible</h1>
        <p>Esta colaboración todavía no está activa o ha finalizado.</p>
        <Link to="/comunidades?view=negocios">Ver negocios en Latido</Link>
      </main>
    </div>
  )
}

export default function BusinessPartnerLanding() {
  const { businessSlug = '' } = useParams()
  const { user } = useAuth()
  const location = useLocation()
  const [provider, setProvider] = useState(null)
  const [loading, setLoading] = useState(true)

  const providerId = getIdFromSlug(businessSlug)
  const placement = new URLSearchParams(location.search).get('from') || 'direct'

  useEffect(() => {
    let active = true

    const loadProvider = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('providers')
        .select(`
          id,
          name,
          category,
          city,
          canton,
          description,
          services,
          website,
          whatsapp,
          instagram,
          email,
          photo_url,
          active,
          partner_logo_url,
          partner_card_title,
          partner_card_description,
          partner_cta_label,
          partner_cta_url,
          partner_landing_enabled,
          partner_landing_starts_at,
          partner_landing_ends_at,
          partner_landing_published_at
        `)
        .eq('id', providerId)
        .maybeSingle()

      if (!active) return
      if (error) {
        console.warn('Could not load business landing:', error.message)
        setProvider(null)
      } else {
        setProvider(data || null)
      }
      setLoading(false)
    }

    if (providerId) loadProvider()
    else setLoading(false)

    return () => {
      active = false
    }
  }, [providerId])

  const services = useMemo(() => normalizeServices(provider?.services), [provider?.services])
  const actions = useMemo(() => buildActions(provider || {}), [provider])
  const primaryAction = actions[0] || null
  const logoUrl = cleanText(provider?.partner_logo_url, cleanText(provider?.photo_url, FALLBACK_LOGO))
  const category = getNegocioTypeMeta(provider?.category)?.label || 'Negocio'
  const locationLabel = [provider?.city, provider?.canton].filter(Boolean).join(' · ') || 'Suiza'
  const title = cleanText(provider?.partner_card_title, cleanText(provider?.name, 'Negocio colaborador'))
  const description = cleanText(
    provider?.partner_card_description,
    cleanText(provider?.description, `Servicios de ${category.toLowerCase()} para la comunidad hispanohablante en Suiza.`),
  )

  useEffect(() => {
    if (!provider || !hasActiveBusinessLanding(provider)) return
    trackBusinessLanding('partner_page_view', provider, {
      userId:user?.id,
      placement,
      destination:location.pathname,
    })
  }, [location.pathname, placement, provider, user?.id])

  const trackAction = action => {
    trackBusinessLanding('partner_outbound_click', provider, {
      userId:user?.id,
      placement,
      action:action.id,
      destination:action.href,
    })
  }

  if (loading) return <LoadingLanding />
  if (!provider?.active || !hasActiveBusinessLanding(provider)) return <UnavailableLanding />

  return (
    <div className="see-landing bpl-landing">
      <header className="see-cobar">
        <div className="see-cobar-lock">
          <Link className="see-cobar-brand see-cobar-latido" to="/" aria-label="Ir a Latido">
            <span className="see-cobar-latido-mark">
              <img src="/favicon.svg" alt="" />
            </span>
            <span>Latido</span>
          </Link>
          <span className="see-cobar-x" aria-hidden="true">x</span>
          <span className="see-cobar-brand bpl-cobar-partner">
            <img src={logoUrl} alt="" />
            <span>{provider.name}</span>
          </span>
        </div>
        <Link className="see-cobar-back" to="/">
          <span className="see-cobar-back-icon" aria-hidden="true">←</span>
          <span className="see-cobar-back-full">Volver a Latido</span>
          <span className="see-cobar-back-short">Volver</span>
        </Link>
      </header>

      <section className="see-hero bpl-hero">
        <div className="see-hero-inner">
          <div className="see-hero-copy">
            <div className="see-hero-cobrand" aria-label={`Latido en colaboración con ${provider.name}`}>
              <span className="see-hero-cobrand-brand">
                <span className="see-hero-cobrand-mark see-hero-cobrand-latido">
                  <img src="/favicon.svg" alt="" />
                </span>
                <strong>Latido</strong>
              </span>
              <span className="see-hero-cobrand-x" aria-hidden="true">x</span>
              <span className="see-hero-cobrand-brand">
                <span className="see-hero-cobrand-mark bpl-hero-cobrand-partner">
                  <img src={logoUrl} alt="" />
                </span>
                <strong>{provider.name}</strong>
              </span>
            </div>
            <div className="see-hero-label"><span /> Colaborador de Latido</div>
            <h1>{title}</h1>
            <p>{description}</p>
            <div className="bpl-hero-actions">
              <a className="see-hero-cta" href="#contacto">Contactar →</a>
              {primaryAction && (
                <a
                  className="bpl-hero-contact"
                  href={primaryAction.href}
                  target={primaryAction.external ? '_blank' : undefined}
                  rel={primaryAction.external ? 'noopener noreferrer sponsored' : undefined}
                  onClick={() => trackAction(primaryAction)}
                >
                  {primaryAction.label}
                </a>
              )}
            </div>
            <div className="see-hero-chips">
              <span><b>✓</b> {category}</span>
              <span><b>✓</b> {locationLabel}</span>
              {services.slice(0, 2).map(service => <span key={service}><b>✓</b> {service}</span>)}
            </div>
          </div>

          <div className="see-hero-visual">
            <div className="bpl-hero-panel">
              <div className="bpl-logo-card">
                <img src={logoUrl} alt={provider.name} />
              </div>
              <div className="bpl-hero-list">
                <span>{category}</span>
                <span>{locationLabel}</span>
                {services.slice(0, 4).map(service => <span key={service}>{service}</span>)}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="see-services" id="servicios">
        <div className="see-wrap">
          <div className="see-eyebrow">Servicios</div>
          <h2>Qué ofrece {provider.name}</h2>
          <p className="see-services-sub">Una ficha clara para entender rápido si este negocio encaja con lo que necesitas.</p>
          <div className="see-services-grid bpl-services-grid">
            {(services.length ? services : [category, 'Atención en español', 'Contacto directo']).slice(0, 3).map((service, index) => (
              <article className={`see-service-card${index === 0 ? ' is-featured' : ''}`} key={service}>
                {index === 0 && <span className="see-service-ribbon">Destacado</span>}
                <span className="see-service-tag">{category}</span>
                <h3>{service}</h3>
                <p className="see-service-description">{index === 0 ? description : `Consulta directamente con ${provider.name} para confirmar disponibilidad, condiciones y próximos pasos.`}</p>
                <a className="see-service-cta" href="#contacto">Pedir información →</a>
                <span className="see-service-note">{locationLabel}</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="see-how">
        <div className="see-wrap">
          <h2>Cómo funciona</h2>
          <div className="see-steps">
            <div className="see-step"><div className="see-step-number">1</div><h3>Revisas la ficha</h3><p>Compruebas servicios, zona y datos principales sin salir de Latido.</p></div>
            <div className="see-step"><div className="see-step-number">2</div><h3>Contactas directo</h3><p>Usas WhatsApp, llamada, email o web según los datos del negocio.</p></div>
            <div className="see-step"><div className="see-step-number">3</div><h3>Acuerdas con la empresa</h3><p>Latido facilita el contacto; las condiciones se cierran directamente con el negocio.</p></div>
          </div>
        </div>
      </section>

      <section className="see-faq" id="contacto">
        <div className="see-wrap">
          <h2>Contacto</h2>
          <div className="bpl-contact-grid">
            {actions.map(action => (
              <a
                key={action.id}
                className="bpl-contact-card"
                href={action.href}
                target={action.external ? '_blank' : undefined}
                rel={action.external ? 'noopener noreferrer sponsored' : undefined}
                onClick={() => trackAction(action)}
              >
                <span>{action.label}</span>
                <strong>{action.value}</strong>
              </a>
            ))}
          </div>
          <div className="see-catch">
            <h3>¿Quieres contactar con {provider.name}?</h3>
            <p>Usa el canal que prefieras. Latido solo facilita la presentación y el acceso a la información.</p>
            <div>
              {primaryAction && (
                <a
                  href={primaryAction.href}
                  target={primaryAction.external ? '_blank' : undefined}
                  rel={primaryAction.external ? 'noopener noreferrer sponsored' : undefined}
                  onClick={() => trackAction(primaryAction)}
                >
                  {primaryAction.label}
                </a>
              )}
              <Link to="/comunidades?view=negocios">Ver más negocios</Link>
            </div>
          </div>
          <p className="see-finma">
            Latido presenta esta colaboración como información orientativa. Los servicios, precios, disponibilidad y condiciones dependen de {provider.name}. Confirma siempre los detalles directamente con el negocio.
          </p>
        </div>
      </section>

      <footer className="see-footer">
        <div className="see-footer-content">
          <div className="see-footer-header">
            <div className="see-footer-logo bpl-footer-logo">
              <img src={logoUrl} alt="" />
              {provider.name}
            </div>
            <p>Colaboración Latido x {provider.name} para la comunidad hispanohablante en Suiza.</p>
          </div>
          <div className="see-footer-bottom">
            <p>{[category, locationLabel, provider.email, getPhoneDisplay(provider.whatsapp)].filter(Boolean).join(' · ')}</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
