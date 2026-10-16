import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Search } from 'lucide-react'
import { DiscountBusinessPhoto } from './LatidoDiscountCard'
import './LatidoCardDiscovery.css'

export const CARD_PREVIEW_LIMIT = 10

const normalizeSearch = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')

export function matchesCardSearch(values, query) {
  const text = normalizeSearch(values.join(' '))
  return normalizeSearch(query)
    .trim()
    .split(/\s+/)
    .every((word) => text.includes(word))
}

export function CardSearch({ label, placeholder, value, onChange }) {
  return (
    <div className="lc-discovery-search">
      <Search size={18} aria-hidden="true" />
      <input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

export function CardListLimit({ total, expanded, onToggle, controls, noun }) {
  if (!total) return null
  return (
    <div className="lc-discovery-limit">
      <p role="status">
        Mostrando {expanded ? total : Math.min(total, CARD_PREVIEW_LIMIT)} de {total}{' '}
        {total === 1 ? noun.slice(0, -1) : noun}
      </p>
      {total > CARD_PREVIEW_LIMIT && (
        <button
          type="button"
          className="lc-button lc-button--secondary"
          aria-controls={controls}
          aria-expanded={expanded}
          onClick={onToggle}
        >
          {expanded ? 'Mostrar menos' : `Mostrar todos (${total})`}
        </button>
      )}
    </div>
  )
}

export default function LatidoCardDiscovery({ businesses, error }) {
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(false)
  const matches = businesses.filter((business) =>
    matchesCardSearch([business.name, business.city], query)
  )
  const shown = expanded ? matches : matches.slice(0, CARD_PREVIEW_LIMIT)
  return (
    <section
      className="lc-discovery"
      id="lc-participating-businesses"
      aria-labelledby="lc-businesses-title"
    >
      <h2 id="lc-businesses-title">Negocios participantes</h2>
      <p className="lc-discovery-description">
        Descubre los negocios con descuentos para la comunidad hispanohablante.
      </p>
      <CardSearch
        label="Buscar negocios"
        placeholder="Nombre del negocio o ciudad"
        value={query}
        onChange={(value) => {
          setQuery(value)
          setExpanded(false)
        }}
      />
      {error ? (
        <p className="lc-alert" role="alert">
          {error}
        </p>
      ) : (
        <>
          <ul className="lc-discovery-businesses" id="lc-business-directory">
            {shown.map((business) => (
              <li key={business.id}>
                <Link
                  to={`/card/negocio/${business.id}`}
                  aria-label={`Ver descuentos de ${business.name}${business.city ? ` · ${business.city}` : ''}`}
                >
                  <DiscountBusinessPhoto
                    offer={{ business_name: business.name, business_photo_url: business.photo_url }}
                    small
                  />
                  <span className="lc-discovery-business-info">
                    <strong>{business.name}</strong>
                    {business.city && <span>{business.city}</span>}
                    <span className="lc-discovery-business-cta">Ver descuentos</span>
                  </span>
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
          {!matches.length && (
            <p className="lc-centered lc-muted">
              {query.trim()
                ? 'No encontramos negocios con esa búsqueda.'
                : 'Todavía no hay negocios participantes.'}
            </p>
          )}
          <CardListLimit
            total={matches.length}
            expanded={expanded}
            onToggle={() => setExpanded((value) => !value)}
            controls="lc-business-directory"
            noun="negocios"
          />
        </>
      )}
    </section>
  )
}
