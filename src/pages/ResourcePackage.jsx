import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { ArrowRight, Check, CloudCheck, MapPin, Share2 } from 'lucide-react'
import { BackButton } from '../components/UI'
import { useAuth } from '../hooks/useAuth'
import { usePackageProgress } from '../hooks/usePackageProgress'
import ShareButton, { buildShareUrl } from '../components/ShareButton'
import ResourcePackagesStrip from '../components/ResourcePackagesStrip'
import { CANTONS } from '../lib/constants'
import { getResourcePackage, getResourcePackagePath, normalizePackageCanton } from '../lib/resourcePackages'
import { getPackageSteps } from '../lib/packageSteps'
import NotFound from './NotFound'
import './ResourcePackage.css'

// Paquete de ayuda: una situación contada como recorrido de pasos que se
// pueden marcar. Las guías se abren con el paquete como contexto.
export default function ResourcePackage() {
  const { packageSlug } = useParams()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { userCanton, isLoggedIn } = useAuth()
  const { isDone, completedIn, setStepDone, savedInProfile } = usePackageProgress()
  const resourcePackage = getResourcePackage(packageSlug)
  const titleRef = useRef(null)
  const [compactHeader, setCompactHeader] = useState(false)

  useEffect(() => {
    setCompactHeader(false)
    const title = titleRef.current
    if (!title) return
    const observer = new IntersectionObserver(([entry]) => {
      setCompactHeader(!entry.isIntersecting && entry.boundingClientRect.bottom <= 0)
    })
    observer.observe(title)
    return () => observer.disconnect()
  }, [packageSlug])

  const canton = searchParams.has('canton')
    ? normalizePackageCanton(searchParams.get('canton'))
    : normalizePackageCanton(userCanton)

  if (!resourcePackage) return <NotFound />

  const { slug } = resourcePackage
  const steps = getPackageSteps(resourcePackage, canton)
  const total = steps.length
  const done = completedIn(slug, steps.map(step => step.id))
  const completed = total > 0 && done === total
  const nextIndex = steps.findIndex(step => !isDone(slug, step.id))
  const hasLocalSteps = steps.some(step => step.resource.local)
  const shareUrl = buildShareUrl(getResourcePackagePath(resourcePackage), { canton:canton || 'all' })
  const loginPath = `/auth?next=${encodeURIComponent(`${location.pathname}${location.search}`)}`

  return (
    <div className="latido-page-container rp-page">
      {compactHeader && createPortal(
        <div className="rp-compactbar" data-detail-header="compact">
          <div className="latido-page-container rp-compactbar__content">
            <BackButton to="/guias" />
            <p className="rp-compactbar__title" title={resourcePackage.title}>{resourcePackage.title}</p>
            <ShareButton
              title={`${resourcePackage.title} · Latido`}
              text={resourcePackage.description}
              url={shareUrl}
              icon={<Share2 size={20} />}
              ariaLabel="Compartir paquete"
              style={{ width:40, height:40, color:'#0F172A', boxShadow:'0 1px 4px rgba(15,23,42,0.2)' }}
            />
          </div>
        </div>, document.body,
      )}
      <div className="rp-topbar">
        <BackButton to="/guias" style={{ boxShadow:'none' }} />
        <ShareButton
          title={`${resourcePackage.title} · Latido`}
          text={resourcePackage.description}
          url={shareUrl}
          icon={<Share2 size={20} />}
          ariaLabel="Compartir paquete"
          style={{ width:44, height:44, color:'#0F172A', boxShadow:'none' }}
        />
      </div>

      <header className="rp-hero">
        <p className="rp-hero__eyebrow">Paquete de ayuda · {total} pasos</p>
        <div className="rp-hero__title" ref={titleRef}>
          <span className="rp-hero__emoji" aria-hidden="true">{resourcePackage.emoji}</span>
          <h1>{resourcePackage.title}</h1>
        </div>
        <p className="rp-hero__intro">{resourcePackage.intro}</p>
        <div className="rp-hero__share">
          <ShareButton
            title={`${resourcePackage.title} · Latido`}
            text={resourcePackage.description}
            url={shareUrl}
            icon={<Share2 size={16} />}
            label="Compartir paquete"
            ariaLabel="Compartir paquete"
            style={{ width:'100%', height:'auto', minHeight:44, padding:'10px 16px', gap:8, borderRadius:12, color:'#2563EB', fontFamily:'inherit', fontSize:13, fontWeight:700, boxShadow:'none' }}
          />
        </div>

        {completed ? <div className="rp-complete" role="status">
          <span aria-hidden="true">🎉</span>
          <h2>¡Paquete completado!</h2>
          <p>{slug === 'acabo-de-llegar'
            ? 'Ya tienes lo básico para empezar en Suiza. ¿Conoces a alguien que acaba de llegar?'
            : 'Has completado los pasos de este paquete. Compártelo con alguien a quien pueda ayudarle.'}</p>
          <ShareButton
            title={`${resourcePackage.title} · Latido`}
            text={resourcePackage.description}
            url={shareUrl}
            icon={null}
            label="Compartir paquete"
            ariaLabel="Compartir paquete completado"
            style={{ width:'100%', height:'auto', minHeight:48, marginTop:18, padding:'12px 16px', border:0, borderRadius:14, background:'#2563EB', color:'#fff', fontFamily:'inherit', fontSize:14, fontWeight:700, boxShadow:'none' }}
          />
        </div> : <div className="rp-progress" aria-live="polite">
          <div className="rp-progress__head">
            <strong>{done === 0 ? 'Empieza por el primer paso' : `Llevas ${done} de ${total}`}</strong>
            {done > 0 && <span>¡Vas bien!</span>}
          </div>
          <div
            className="rp-progress__bar"
            role="progressbar"
            aria-label="Progreso del paquete"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={done}
            style={{ '--rp-step-count':total }}
          >
            {steps.map(step => <span key={step.id} className={`rp-progress__segment${isDone(slug, step.id) ? ' is-done' : ''}`} />)}
          </div>
          <p className="rp-progress__note">
            <CloudCheck size={14} aria-hidden="true" />
            <span>{savedInProfile
              ? 'Tu progreso se guarda en tu perfil.'
              : <>Tu progreso se guarda en este dispositivo. <Link to={loginPath}>Inicia sesión</Link> para guardarlo en tu perfil.</>}</span>
          </p>
        </div>}
      </header>

      <section className="rp-steps" aria-labelledby="rp-steps-title">
        <div className="rp-steps__header">
          <h2 id="rp-steps-title">Paso a paso</h2>
          {hasLocalSteps && (
            <label className="rp-zone">
              <MapPin size={15} aria-hidden="true" />
              <select
                value={canton}
                aria-label="Zona para anuncios, eventos, grupos y negocios"
                onChange={event => {
                  const next = new URLSearchParams(searchParams)
                  // Un valor vacío explícito anula el cantón del perfil.
                  next.set('canton', event.target.value)
                  setSearchParams(next, { replace:true })
                }}
              >
                <option value="">Toda Suiza</option>
                {CANTONS.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}
              </select>
            </label>
          )}
        </div>
        {done === 0 && <p className="rp-steps__intro">Abre un paso y márcalo cuando lo tengas.</p>}
        <ol className="rp-timeline">
          {steps.map(step => {
            const stepDone = isDone(slug, step.id)
            const current = step.index === nextIndex
            const { resource, guide } = step
            return (
              <li key={step.id} className={`rp-step${stepDone ? ' is-done' : ''}${current ? ' is-current' : ''}`}>
                <div className="rp-step__card">
                  <span className="rp-step__count" aria-label={`Paso ${step.index + 1} de ${total}`}>{step.index + 1}/{total}</span>
                  <div className="rp-step__head">
                    <span className="rp-step__emoji" aria-hidden="true">{resource.emoji}</span>
                    <div className="rp-step__titles">
                      <span className="rp-step__kind">
                        {step.kind}{guide?.time ? ` · ${guide.time}` : ''}
                        {stepDone && <em className="is-done">Hecho</em>}
                      </span>
                      <h3>{resource.title}</h3>
                    </div>
                  </div>
                  <p>{resource.description}</p>
                  <div className="rp-step__actions">
                    <Link className="rp-step__cta" to={step.path}>
                      <span>{resource.action}</span>
                      <ArrowRight size={15} strokeWidth={2.4} aria-hidden="true" />
                    </Link>
                    <button
                      type="button"
                      className="rp-step__toggle"
                      aria-pressed={stepDone}
                      aria-label={stepDone ? `Marcar "${resource.title}" como pendiente` : `Marcar "${resource.title}" como hecho`}
                      onClick={() => setStepDone(slug, step.id)}
                    >
                      <span className="rp-step__check" aria-hidden="true">
                        {stepDone && <Check size={14} strokeWidth={2.6} />}
                      </span>
                      Hecho
                    </button>
                  </div>
                  {resource.requiresAccount && !isLoggedIn && <span className="rp-step__note">Necesitas una cuenta gratuita</span>}
                </div>
              </li>
            )
          })}
        </ol>

      </section>

      <footer className="rp-more">
        <ResourcePackagesStrip
          tone="dark"
          excludeSlug={slug}
          heading="¿Necesitas algo más?"
          headingAs="h2"
        />
      </footer>
    </div>
  )
}
