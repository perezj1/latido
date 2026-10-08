import { Link } from 'react-router-dom'
import { Check, ChevronRight } from 'lucide-react'
import { usePackageProgress } from '../hooks/usePackageProgress'
import { RESOURCE_PACKAGES, getResourcePackagePath } from '../lib/resourcePackages'

export default function ResourcePackagesStrip({
  tone='light',
  excludeSlug='',
  packages=RESOURCE_PACKAGES.filter(resourcePackage => resourcePackage.featured),
  heading='¿Por dónde quieres empezar?',
  headingAs:Heading='p',
  showAllLink=true,
  className='',
}) {
  const { completedIn } = usePackageProgress()

  return (
    <nav className={`latido-resource-packages latido-resource-packages--${tone} ${className}`} aria-label="Paquetes de recursos de Latido">
      <div className="latido-resource-packages__heading">
        <Heading className="latido-resource-packages__label">{heading}</Heading>
        {showAllLink && <Link className="latido-resource-packages__all" to="/guias">Ver todos<ChevronRight size={14} aria-hidden="true" /></Link>}
      </div>
      <div className="latido-resource-packages__items">
        {packages.filter(resourcePackage => resourcePackage.slug !== excludeSlug).map(resourcePackage => {
          const total = resourcePackage.resources.length
          const done = completedIn(resourcePackage.slug, resourcePackage.resources.map(resource => resource.id))
          const complete = total > 0 && done === total
          const started = done > 0
          const progressLabel = complete ? 'completado' : `${done} de ${total} pasos hechos`
          return (
            <Link
              key={resourcePackage.slug}
              className={`latido-resource-packages__link${started ? ' is-started' : ''}${complete ? ' is-complete' : ''}`}
              to={getResourcePackagePath(resourcePackage)}
              aria-label={started ? `${resourcePackage.title}, ${progressLabel}` : undefined}
            >
              {/* El anillo del emoji se completa con el progreso del paquete. */}
              <span
                className="latido-resource-packages__emoji"
                style={started ? { '--package-progress':`${Math.round((done / total) * 100)}%` } : undefined}
                aria-hidden="true"
              >
                {resourcePackage.emoji}
              </span>
              <span className="latido-resource-packages__title">{resourcePackage.title}</span>
              {started && (
                <span className="latido-resource-packages__progress" aria-hidden="true">
                  {complete ? <Check size={12} strokeWidth={3.2} /> : `${done}/${total}`}
                </span>
              )}
              <ChevronRight className="latido-resource-packages__arrow" size={16} strokeWidth={2.4} aria-hidden="true" />
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
