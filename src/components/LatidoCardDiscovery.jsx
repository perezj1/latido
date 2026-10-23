import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, MapPin, Search } from 'lucide-react'
import LatidoCardBusinessImage from './LatidoCardBusinessImage'
import { businessBenefit } from '../lib/latidoCardExperience'
import { groupCardResultsByCity } from '../lib/latidoCardLocation'
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

export function CardNearbyResults({ nearby, other, id, noun, renderList, expanded: controlledExpanded, onExpandedChange }) {
  const [localExpanded, setLocalExpanded] = useState({})
  const expanded = controlledExpanded ?? localExpanded
  const setExpanded = onExpandedChange || setLocalExpanded
  const businesses = noun === 'negocios'
  return [
    {
      key: 'nearby',
      items: nearby,
      title: businesses ? 'Más negocios cercanos' : 'Más ofertas cercanas'
    },
    { key: 'other', items: other, title: businesses ? 'Más negocios' : 'Más ofertas' }
  ].map(({ key, items, title }) => {
    if (!items.length) return null
    const listId = `${id}-${key}`
    return (
      <section className="lc-nearby-results" key={key} aria-labelledby={`${listId}-title`}>
        <h3 id={`${listId}-title`}>{title}</h3>
        {renderList(expanded[key] ? items : items.slice(0, CARD_PREVIEW_LIMIT), listId)}
        <CardListLimit
          total={items.length}
          expanded={Boolean(expanded[key])}
          onToggle={() => setExpanded((current) => ({ ...current, [key]: !current[key] }))}
          controls={listId}
          noun={noun}
        />
      </section>
    )
  })
}

export default function LatidoCardDiscovery({
  businesses,
  offers = [],
  error,
  query = '',
  city = '',
  category = ''
}) {
  const [expanded, setExpanded] = useState(false)
  useEffect(() => setExpanded(false), [query, city, category])
  const businessesWithOffers = new Set(offers.map((offer) => offer.provider_id))
  const filtered = businesses.filter(
    (business) =>
      businessesWithOffers.has(business.id) &&
      (!category ||
        business.category === category ||
        offers.some((o) => o.provider_id === business.id && o.category === category)) &&
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
  const { local: matches, nearby, other } = groupCardResultsByCity(filtered, city)
  const shown = expanded ? matches : matches.slice(0, CARD_PREVIEW_LIMIT)
  const renderBusinesses = (items, id) => (
    <ul className="lc-discovery-businesses" id={id}>
      {items.map((business) => {
        const available = offers.filter((offer) => offer.provider_id === business.id)
        const badge = businessBenefit(available)
        return (
          <li key={business.id}>
            <Link
              className="lc-directory-entry"
              to={`/card/negocio/${business.id}`}
              aria-label={`Ver descuentos de ${business.name}${business.city ? ` · ${business.city}` : ''}`}
            >
              <LatidoCardBusinessImage business={business} offers={available} small />
              <span className="lc-discovery-business-info">
                <strong>{business.name}</strong>
                {business.city && (
                  <span className="lc-directory-city">
                    <MapPin size={13} aria-hidden="true" />
                    {business.city}
                  </span>
                )}
                <span className="lc-discovery-business-cta">
                  <span className="lc-directory-benefit">{badge}</span>
                  <span>{`${available.length} ${available.length === 1 ? 'oferta' : 'ofertas'}`}</span>
                </span>
              </span>
              <ChevronRight size={18} aria-hidden="true" />
            </Link>
          </li>
        )
      })}
    </ul>
  )
  return (
    <section
      className="lc-discovery"
      id="lc-participating-businesses"
      aria-labelledby="lc-businesses-title"
    >
      <h2 id="lc-businesses-title">Negocios participantes</h2>
      {error ? (
        <p className="lc-alert" role="alert">
          {error}
        </p>
      ) : (
        <>
          {renderBusinesses(shown, 'lc-business-directory')}
          {!matches.length && (
            <p className="lc-centered lc-muted">
              {city
                ? `No encontramos negocios en ${city} con esos filtros.`
                : query.trim()
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
          <CardNearbyResults
            key={JSON.stringify([query, city, category])}
            nearby={nearby}
            other={other}
            id="lc-business-directory"
            noun="negocios"
            renderList={renderBusinesses}
          />
        </>
      )}
    </section>
  )
}
