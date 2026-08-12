import { useId } from 'react'
import { Link } from 'react-router-dom'
import SavedSearchButton from './SavedSearchButton'
import { Icon } from '../lib/icons'

export default function SearchRecoveryEmptyState({
  employment = false,
  savedSearchDraft,
  onExpandSearch,
  publishHref = '',
  publishLabel = '',
}) {
  const titleId = useId()
  const resolvedPublishHref = publishHref || (employment ? '/publicar-empleo?intent=busca' : '/publicar')
  const resolvedPublishLabel = publishLabel || (employment ? 'Publicar «Busco trabajo»' : 'Publicar lo que buscas')

  return (
    <section className="employment-search-empty" aria-labelledby={titleId}>
      <div className="employment-search-empty__illustration" aria-hidden="true">
        <span><Icon name={employment ? 'job' : 'search'} size={34} /></span>
        <i>⌕</i>
      </div>
      <p className="employment-search-empty__eyebrow">TU BÚSQUEDA SIGUE ACTIVA</p>
      <h2 id={titleId}>
        {employment
          ? 'Todavía no hemos encontrado empleos que coincidan exactamente contigo.'
          : 'Todavía no hemos encontrado resultados que coincidan exactamente con tu búsqueda.'}
      </h2>
      <p className="employment-search-empty__intro">
        Guarda esta búsqueda y te avisaremos cuando aparezca una coincidencia.
      </p>

      <div className="employment-search-empty__actions">
        {savedSearchDraft && (
          <SavedSearchButton
            draft={savedSearchDraft}
            idleLabel="Activar alerta"
            prominent
          />
        )}
        <button type="button" className="employment-search-empty__action employment-search-empty__action--secondary" onClick={onExpandSearch}>
          <span aria-hidden="true"><Icon name="world" size={18} /></span>
          <span>Ampliar la búsqueda</span>
        </button>
        <Link className="employment-search-empty__action employment-search-empty__action--outline" to={resolvedPublishHref}>
          <span aria-hidden="true"><Icon name="edit" size={18} /></span>
          <span>{resolvedPublishLabel}</span>
        </Link>
      </div>

      <p className="employment-search-empty__hint">
        {employment
          ? 'Al ampliar, verás ofertas de todos los cantones y de más profesiones.'
          : 'Al ampliar, quitaremos los criterios más restrictivos para mostrarte más opciones.'}
      </p>
    </section>
  )
}
