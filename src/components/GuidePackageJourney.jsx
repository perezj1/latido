import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Check } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { usePackageProgress } from '../hooks/usePackageProgress'
import { getResourcePackagePath, normalizePackageCanton } from '../lib/resourcePackages'
import { getGuideJourney, getPackageSteps } from '../lib/packageSteps'
import './GuidePackageJourney.css'

// Recorrido de una guía dentro de sus paquetes: de dónde viene la persona
// (?paquete=) y a qué paquetes pertenece.
export function useGuideJourney(guide) {
  const [searchParams] = useSearchParams()
  return getGuideJourney(guide?.id, searchParams.get('paquete') || '')
}

// Final de la guía: siguiente paso del paquete y paquetes que la incluyen.
export default function GuidePackageJourney({ journey }) {
  const navigate = useNavigate()
  const { userCanton } = useAuth()
  const { isDone, setStepDone } = usePackageProgress()
  if (!journey?.active) return null

  const { resourcePackage, resource, index } = journey.active
  const packagePath = getResourcePackagePath(resourcePackage)
  const steps = getPackageSteps(resourcePackage, normalizePackageCanton(userCanton))
  const next = steps[index + 1] || null
  const done = isDone(resourcePackage.slug, resource.id)

  const completeAndContinue = () => {
    setStepDone(resourcePackage.slug, resource.id, true)
    navigate(next ? next.path : packagePath)
  }

  return (
    <section className="gj" aria-labelledby="gj-title">
      <div className="gj-next">
        <p className="gj-next__eyebrow">
          <span aria-hidden="true">{resourcePackage.emoji}</span>
          {resourcePackage.title} · Paso {index + 1} de {steps.length}
        </p>
        <h2 id="gj-title">{next ? 'Siguiente paso' : 'Último paso del paquete'}</h2>

        {next ? (
          <Link className="gj-next__step" to={next.path}>
            <span className="gj-next__emoji" aria-hidden="true">{next.resource.emoji}</span>
            <span className="gj-next__text">
              <small>Paso {next.index + 1} · {next.kind}</small>
              <strong>{next.resource.title}</strong>
            </span>
            <ArrowRight size={18} strokeWidth={2.4} aria-hidden="true" />
          </Link>
        ) : (
          <p className="gj-next__last">Con esta guía terminas los pasos de {resourcePackage.title.toLowerCase()}.</p>
        )}

        <div className="gj-next__actions">
          {done ? (
            <>
              <span className="gj-done"><Check size={16} strokeWidth={3} aria-hidden="true" /> Paso hecho</span>
              <Link className="gj-primary" to={next ? next.path : packagePath}>
                {next ? 'Ir al siguiente paso' : 'Volver al paquete'}
                <ArrowRight size={16} strokeWidth={2.4} aria-hidden="true" />
              </Link>
            </>
          ) : (
            <button type="button" className="gj-primary" onClick={completeAndContinue}>
              <Check size={16} strokeWidth={3} aria-hidden="true" />
              {next ? 'Hecho, siguiente paso' : 'Marcar como hecho'}
            </button>
          )}
          <Link className="gj-secondary" to={packagePath}>Ver todos los pasos</Link>
        </div>
      </div>

      <div className="gj-member">
        <h3>Esta guía forma parte de</h3>
        <div className="gj-chips">
          {journey.memberships.map(membership => (
            <Link key={membership.resourcePackage.slug} className="gj-chip" to={getResourcePackagePath(membership.resourcePackage)}>
              <span aria-hidden="true">{membership.resourcePackage.emoji}</span>
              {membership.resourcePackage.title}
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
