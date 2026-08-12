import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CANTONS, CITIES_BY_CANTON } from '../lib/constants'
import { getAllCreatorContents, getAllCreators, subscribeCreatorUpdates } from '../lib/creators'
import { isNationwideLocation } from '../lib/locationScope'
import { C, PP, getLatidoCategoryTheme } from '../lib/theme'
import { Icon } from '../lib/icons'

const DEFAULT_INTERESTS = ['empleo', 'vivienda', 'servicios', 'contenido_creadores', 'creadores', 'comunidad', 'eventos']
const OVERVIEW_INTERESTS = {
  vivienda:{
    tone:'vivienda',
    icon:'housing',
    href:'/tablon?cat=vivienda',
    label:'Viviendas',
    records:({ ads }) => ads.filter(item => item.cat === 'vivienda'),
  },
  empleo:{
    tone:'empleo',
    icon:'job',
    href:'/tablon?cat=empleo',
    label:'Empleos',
    records:({ ads }) => ads.filter(item => item.cat === 'empleo'),
  },
  servicios:{
    tone:'negocios',
    icon:'business',
    href:'/comunidades?view=negocios',
    label:'Negocios',
    records:({ businesses }) => businesses,
  },
  contenido_creadores:{
    tone:'contenido',
    icon:'movie',
    href:'/comunidades?view=creadores&creatorView=contenidos',
    label:'Contenido',
    unfiltered:true,
    records:({ creatorContents }) => creatorContents,
  },
  creadores:{
    tone:'creadores',
    icon:'creator',
    href:'/comunidades?view=creadores&creatorView=creadores',
    label:'Creadores',
    unfiltered:true,
    records:({ creators }) => creators,
  },
  eventos:{
    tone:'eventos',
    icon:'event',
    href:'/comunidades?view=eventos',
    label:'Eventos',
    records:({ events }) => events,
  },
  comunidad:{
    tone:'grupos',
    icon:'group',
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

    const showGlobalTotal = Boolean(meta.unfiltered)
    const count = meta.records(sources).filter(item =>
      (!localOnly || showGlobalTotal || isInCanton(item, canton))
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
    canton:content.canton || creator?.canton || '',
    city:content.city || creator?.city || '',
    location:content.location || content.reach || creator?.reach || '',
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
      <h2 style={{ display:'flex', alignItems:'center', gap:8, fontFamily:PP, fontWeight:800, fontSize:21, color:C.text, margin:'0 0 10px', letterSpacing:-0.25 }}>
        <Icon name="favoriteActive" size={22} color="#F43F5E" /> Mi Latido
      </h2>
      <div style={{ marginBottom:11 }}>
        <p style={{ minWidth:0, fontFamily:PP, fontWeight:700, fontSize:14, color:C.text, margin:0 }}>
          {loading
            ? 'Buscando opciones para ti…'
            : `${overview.total} ${overview.total === 1 ? 'opción' : 'opciones'} ${locationLabel}`}
        </p>
      </div>
      <div className="mi-latido-overview-grid" aria-label="Contenido disponible por categoría">
        {overview.entries.map(entry => {
          const theme = getLatidoCategoryTheme(entry.tone || entry.id)
          return (
          <Link
            key={entry.id}
            to={entry.unfiltered ? entry.href : addCantonFilter(entry.href, canton, showLocalResults)}
            className="mi-latido-overview-card"
            style={{
              '--overview-color':theme.color,
              '--overview-ink':theme.ink,
              '--overview-soft':theme.soft,
              '--overview-border':theme.border,
            }}
            aria-label={`${entry.count} ${entry.label}`}
          >
            <span aria-hidden="true" className="mi-latido-overview-icon"><Icon name={entry.icon} size={25} strokeWidth={1.75} /></span>
            <strong>{loading ? '—' : entry.count}</strong>
            <span>{entry.label}</span>
          </Link>
          )
        })}
      </div>
    </div>
  )
}
