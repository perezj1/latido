import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CANTONS, CITIES_BY_CANTON } from '../lib/constants'
import { getAllCreatorContents, getAllCreators, subscribeCreatorUpdates } from '../lib/creators'
import { isNationwideLocation } from '../lib/locationScope'
import { C, PP } from '../lib/theme'

const DEFAULT_INTERESTS = ['empleo', 'vivienda', 'servicios', 'contenido_creadores', 'creadores', 'comunidad', 'eventos']
const OVERVIEW_INTERESTS = {
  vivienda:{
    emoji:'🏠',
    href:'/tablon?cat=vivienda',
    label:'Viviendas',
    records:({ ads }) => ads.filter(item => item.cat === 'vivienda'),
  },
  empleo:{
    emoji:'💼',
    href:'/tablon?cat=empleo',
    label:'Empleos',
    records:({ ads }) => ads.filter(item => item.cat === 'empleo'),
  },
  servicios:{
    emoji:'🏪',
    href:'/comunidades?view=negocios',
    label:'Negocios',
    records:({ businesses }) => businesses,
  },
  contenido_creadores:{
    emoji:'🎬',
    href:'/comunidades?view=creadores&creatorView=contenidos',
    label:'Contenido',
    records:({ creatorContents }) => creatorContents,
  },
  creadores:{
    emoji:'🎙️',
    href:'/comunidades?view=creadores&creatorView=creadores',
    label:'Creadores',
    records:({ creators }) => creators,
  },
  eventos:{
    emoji:'🎉',
    href:'/comunidades?view=eventos',
    label:'Eventos',
    records:({ events }) => events,
  },
  comunidad:{
    emoji:'👥',
    href:'/comunidades?view=comunidades',
    label:'Grupos',
    records:({ communities }) => communities,
  },
}

function normalizePlace(value='') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function isInCanton(item={}, canton='') {
  const normalizedCanton = String(canton || '').trim().toUpperCase()
  if (!normalizedCanton) return true
  if (String(item.canton || '').trim().toUpperCase() === normalizedCanton) return true
  if (isNationwideLocation(item)) return true

  const city = normalizePlace(item.city)
  if (!city) return false
  return (CITIES_BY_CANTON[normalizedCanton] || [])
    .some(candidate => normalizePlace(candidate) === city)
}

function addCantonFilter(href='', canton='', enabled=false) {
  if (!enabled || !canton) return href
  const separator = href.includes('?') ? '&' : '?'
  return `${href}${separator}canton=${encodeURIComponent(canton)}`
}

function countEntries({
  interestIds,
  sources,
  canton,
  localOnly,
}) {
  return interestIds.map(interestId => {
    const meta = OVERVIEW_INTERESTS[interestId]
    if (!meta) return null

    const count = meta.records(sources).filter(item =>
      (!localOnly || isInCanton(item, canton))
    ).length

    return { id:interestId, count, ...meta }
  }).filter(Boolean)
}

export function buildHomePersonalizationOverview({
  ads=[],
  businesses=[],
  creatorContents=[],
  creators=[],
  events=[],
  communities=[],
  canton='',
}) {
  const sources = { ads, businesses, creatorContents, creators, events, communities }
  const localEntries = countEntries({
    interestIds:DEFAULT_INTERESTS,
    sources,
    canton,
    localOnly:Boolean(canton),
  })
  const localTotal = localEntries.reduce((sum, entry) => sum + entry.count, 0)
  if (localTotal > 0 || !canton) {
    return { entries:localEntries, total:localTotal, scope:canton ? 'local' : 'switzerland' }
  }

  const entries = countEntries({
    interestIds:DEFAULT_INTERESTS,
    sources,
    canton,
    localOnly:false,
  })
  return { entries, total:entries.reduce((sum, entry) => sum + entry.count, 0), scope:'switzerland' }
}

export default function HomePersonalizationHeader({
  ads=[],
  businesses=[],
  events=[],
  communities=[],
  canton='',
  loading=false,
}) {
  const [creatorContents, setCreatorContents] = useState(() => getAllCreatorContents())
  const [creators, setCreators] = useState(() => getAllCreators())

  useEffect(() => subscribeCreatorUpdates(() => {
    setCreatorContents(getAllCreatorContents())
    setCreators(getAllCreators())
  }), [])

  const locatedCreatorContents = useMemo(() => creatorContents.map(({ content, creator }) => ({
    ...content,
    canton:creator?.canton || '',
    city:creator?.city || '',
    location:creator?.reach || '',
  })), [creatorContents])
  const locatedCreators = useMemo(() => creators.map(creator => ({
    ...creator,
    location:creator.reach || '',
  })), [creators])

  const overview = useMemo(
    () => buildHomePersonalizationOverview({
      ads,
      businesses,
      creatorContents:locatedCreatorContents,
      creators:locatedCreators,
      events,
      communities,
      canton,
    }),
    [ads, businesses, canton, communities, events, locatedCreatorContents, locatedCreators],
  )
  const cantonName = CANTONS.find(item => item.code === canton)?.name || canton
  const locationLabel = overview.scope === 'local' && cantonName
    ? 'cerca de ti'
    : 'en Suiza'
  const showLocalResults = overview.scope === 'local' && Boolean(canton)

  return (
    <div style={{ maxWidth:1200, margin:'0 auto 14px', padding:'0 16px' }}>
      <h2 style={{ fontFamily:PP, fontWeight:800, fontSize:21, color:C.text, margin:'0 0 10px', letterSpacing:-0.25 }}>
        ❤️ Mi Latido
      </h2>
      <div style={{ marginBottom:11 }}>
        <p style={{ minWidth:0, fontFamily:PP, fontWeight:700, fontSize:14, color:C.text, margin:0 }}>
          {loading
            ? 'Buscando opciones para ti…'
            : `${overview.total} ${overview.total === 1 ? 'opción' : 'opciones'} ${locationLabel}`}
        </p>
      </div>
      <div className="mi-latido-overview-grid" aria-label="Contenido disponible por categoría">
        {overview.entries.map(entry => (
          <Link
            key={entry.id}
            to={addCantonFilter(entry.href, canton, showLocalResults)}
            className="mi-latido-overview-card"
            aria-label={`${entry.count} ${entry.label}`}
          >
            <span aria-hidden="true" className="mi-latido-overview-icon">{entry.emoji}</span>
            <strong>{loading ? '—' : entry.count}</strong>
            <span>{entry.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
