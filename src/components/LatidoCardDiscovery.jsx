import { useEffect, useState } from 'react'
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
  if (total <= CARD_PREVIEW_LIMIT) return null
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

export default function LatidoCardDiscovery({
  businesses,
  offers = [],
  error,
  query = '',
  city = ''
}) {
  const [expanded, setExpanded] = useState(false)
  useEffect(() => setExpanded(false), [query, city])
  const matches = businesses.filter(
    (business) =>
      (!city || business.city === city) &&
      matchesCardSearch(
        [
          business.name,
          business.city,
          ...offers
            .filter((offer) => offer.provider_id === business.id)
            .flatMap((offer) => [offer.title, offer.description])
        ],
        query
      )
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
      {error ? (
        <p className="lc-alert" role="alert">
          {error}
        </p>
      ) : (
        <>
          <ul className="lc-discovery-businesses" id="lc-business-directory">
            {shown.map((business) => {
              const available = offers.filter((offer) => offer.provider_id === business.id)
              const best = Math.max(
                0,
                ...available
                  .filter((offer) => offer.benefit_type === 'percent')
                  .map((offer) => Number(offer.benefit_value))
              )
              const Entry = available.length ? Link : 'div'
              return (
                <li key={business.id}>
                  <Entry
                    className="lc-directory-entry"
                    {...(available.length
                      ? {
                          to: `/card/negocio/${business.id}`,
                          'aria-label': `Ver descuentos de ${business.name}${business.city ? ` · ${business.city}` : ''}`
                        }
                      : {})}
                  >
                    <DiscountBusinessPhoto
                      offer={{
                        business_name: business.name,
                        business_photo_url: business.photo_url
                      }}
                      small
                    />
                    <span className="lc-discovery-business-info">
                      <strong>{business.name}</strong>
                      {business.city && <span>{business.city}</span>}
                      <span className="lc-discovery-business-cta">
                        {available.length
                          ? `${available.length} ${available.length === 1 ? 'descuento' : 'descuentos'}${best ? ` · hasta ${best} %` : ''}`
                          : 'Próximamente'}
                      </span>
                    </span>
                    {available.length > 0 && <ArrowRight size={18} aria-hidden="true" />}
                  </Entry>
                </li>
              )
            })}
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
