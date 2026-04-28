import { useEffect, useMemo, useState } from 'react'
import { C, PP } from '../lib/theme'
import {
  buildEventfrogEmbedUrl,
  EVENTFROG_EMBED_KEY,
  EVENTFROG_FILTERS,
  fetchEventfrogEvents,
  getEventfrogRange,
  toISODate,
} from '../lib/eventfrog'

const RANGE_OPTIONS = [
  { id:'today', label:'Hoy' },
  { id:'week', label:'7 días' },
  { id:'month', label:'30 días' },
  { id:'custom', label:'Elegir fecha' },
]

const LIST_MAX_HEIGHT = {
  compact: 314,
  regular: 410,
}

const ALL_CANTONS = 'all'
const CANTON_NAMES = {
  AG: 'Aargau',
  AI: 'Appenzell Innerrhoden',
  AR: 'Appenzell Ausserrhoden',
  BE: 'Bern',
  BL: 'Basel-Landschaft',
  BS: 'Basel-Stadt',
  FR: 'Fribourg',
  GE: 'Ginebra',
  GL: 'Glarus',
  GR: 'Graubünden',
  JU: 'Jura',
  LU: 'Luzern',
  NE: 'Neuchâtel',
  NW: 'Nidwalden',
  OW: 'Obwalden',
  SG: 'St. Gallen',
  SH: 'Schaffhausen',
  SO: 'Solothurn',
  SZ: 'Schwyz',
  TG: 'Thurgau',
  TI: 'Ticino',
  UR: 'Uri',
  VD: 'Vaud',
  VS: 'Valais',
  ZG: 'Zug',
  ZH: 'Zürich',
}

function getInitialVisibleCount(layout, compact) {
  if (layout === 'carousel') return 12
  return compact ? 6 : 8
}

function getVisibleStep(layout, compact) {
  if (layout === 'carousel') return 8
  return compact ? 6 : 8
}

function FilterRow({ children }) {
  return (
    <div
      style={{
        display:'grid',
        gridTemplateColumns:'repeat(3, minmax(0, 1fr))',
        gap:8,
        width:'100%',
        maxWidth:456,
        alignItems:'center',
      }}
    >
      {children}
    </div>
  )
}

function PillSelect({ value, onChange, options, ariaLabel, disabled = false }) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={event => onChange(event.target.value)}
      disabled={disabled}
      style={{
        width:'100%',
        minWidth:0,
        boxSizing:'border-box',
        fontFamily:PP,
        fontSize:11,
        fontWeight:700,
        color:C.primary,
        border:`1.5px solid ${C.primaryMid}`,
        borderRadius:999,
        background:C.primaryLight,
        padding:'9px 12px',
        outline:'none',
        cursor:disabled ? 'not-allowed' : 'pointer',
        opacity:disabled ? 0.58 : 1,
      }}
    >
      {options.map(option => (
        <option key={option.id} value={option.id}>{option.label}</option>
      ))}
    </select>
  )
}

function formatRangeLabel(from, to) {
  const fmt = new Intl.DateTimeFormat('es-CH', { day:'2-digit', month:'short' })
  const fromDate = new Date(`${from}T00:00:00`)
  const toDate = new Date(`${to}T00:00:00`)
  if (from === to) return fmt.format(fromDate)
  return `${fmt.format(fromDate)} - ${fmt.format(toDate)}`
}

function formatGroupDate(date) {
  return new Intl.DateTimeFormat('es-CH', {
    weekday:'short',
    day:'2-digit',
    month:'short',
  }).format(date)
}

function groupByDate(events) {
  return events.reduce((groups, event) => {
    const key = event.date ? toISODate(event.date) : 'sin-fecha'
    const label = event.date ? formatGroupDate(event.date) : 'Sin fecha'
    const current = groups.get(key) || { key, label, events:[] }
    current.events.push(event)
    groups.set(key, current)
    return groups
  }, new Map())
}

function normalizeCanton(value = '') {
  return String(value || '').trim().toUpperCase()
}

function dedupeEvents(events) {
  const seen = new Set()

  return events.filter((event, index) => {
    const key = event?.id || event?.sourceId || `${event?.title || 'event'}-${index}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function getCantonOptions(events) {
  const cantons = [...new Set(events.map(event => normalizeCanton(event.canton)).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'es'))

  return [
    { id:ALL_CANTONS, label:'Cantón' },
    ...cantons.map(canton => ({
      id:canton,
      label:CANTON_NAMES[canton] ? `${CANTON_NAMES[canton]} (${canton})` : canton,
    })),
  ]
}

function EventCard({ event, compact }) {
  return (
    <a
      href={event.link}
      target="_blank"
      rel="noreferrer"
      style={{
        display:'flex',
        gap:12,
        background:'#fff',
        border:`1px solid ${C.border}`,
        borderRadius:16,
        padding:compact ? 10 : 12,
        textDecoration:'none',
        color:'inherit',
        overflow:'hidden',
      }}
    >
      {event.img ? (
        <img
          src={event.img}
          alt={event.title}
          loading="lazy"
          style={{
            width:compact ? 74 : 92,
            height:compact ? 74 : 92,
            borderRadius:13,
            objectFit:'cover',
            flexShrink:0,
            background:C.bg,
          }}
        />
      ) : (
        <div
          style={{
            width:compact ? 74 : 92,
            height:compact ? 74 : 92,
            borderRadius:13,
            background:C.primaryLight,
            color:C.primary,
            display:'grid',
            placeItems:'center',
            fontSize:28,
            flexShrink:0,
          }}
        >
          🎉
        </div>
      )}

      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:5, flexWrap:'wrap' }}>
          <span style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.primary, background:C.primaryLight, borderRadius:999, padding:'3px 8px' }}>
            {event.day} {event.month}
          </span>
          {event.time && (
            <span style={{ fontFamily:PP, fontSize:10, color:C.light }}>
              {event.time}
            </span>
          )}
          {event.soldOut && (
            <span style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:'#991B1B', background:'#FEE2E2', borderRadius:999, padding:'3px 8px' }}>
              Agotado
            </span>
          )}
        </div>

        <p style={{ fontFamily:PP, fontWeight:800, fontSize:compact ? 12 : 14, color:C.text, lineHeight:1.3, margin:'0 0 4px', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
          {event.title}
        </p>
        <p style={{ fontFamily:PP, fontSize:11, color:C.mid, margin:'0 0 5px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
          📍 {event.locationShortLabel || event.locationLabel || event.city}
        </p>
        <p style={{ fontFamily:PP, fontSize:11, color:C.primary, fontWeight:700, margin:0 }}>
          {event.price}
        </p>
      </div>
    </a>
  )
}

function CarouselEventCard({ event }) {
  return (
    <a
      href={event.link}
      target="_blank"
      rel="noreferrer"
      style={{ textDecoration:'none', flexShrink:0, width:168, display:'block' }}
    >
      <div style={{ background:'#fff', borderRadius:16, border:`1px solid ${C.border}`, overflow:'hidden', height:'100%', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ height:120, background:C.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:42, position:'relative' }}>
          {event.img ? (
            <img
              src={event.img}
              alt={event.title}
              loading="lazy"
              style={{ width:'100%', height:'100%', objectFit:'cover', position:'absolute', inset:0 }}
            />
          ) : (
            <span>🎉</span>
          )}
          <span style={{ position:'absolute', top:8, left:8, fontFamily:PP, fontSize:9, fontWeight:800, background:'rgba(255,255,255,0.94)', color:C.primary, padding:'3px 7px', borderRadius:999 }}>
            {event.day} {event.month}
          </span>
          {event.soldOut && (
            <span style={{ position:'absolute', top:8, right:8, fontFamily:PP, fontSize:9, fontWeight:800, background:'#FEE2E2', color:'#991B1B', padding:'3px 7px', borderRadius:999 }}>
              Agotado
            </span>
          )}
        </div>
        <div style={{ padding:'10px 10px 12px' }}>
          <p style={{ fontFamily:PP, fontWeight:700, fontSize:12, color:C.text, margin:'0 0 4px', lineHeight:1.35, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden', minHeight:'2.7em' }}>
            {event.title}
          </p>
          <p style={{ fontFamily:PP, fontSize:10, color:C.light, margin:'0 0 5px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
            📍 {event.locationShortLabel || event.locationLabel || event.city}
          </p>
          <p style={{ fontFamily:PP, fontWeight:800, fontSize:12, color:C.primary, margin:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
            {event.price}
          </p>
        </div>
      </div>
    </a>
  )
}

export default function EventfrogCalendar({ compact = false, maxEvents = 60, showEmbedFallback = true, layout = 'list' }) {
  const initialVisibleCount = getInitialVisibleCount(layout, compact)
  const visibleStep = getVisibleStep(layout, compact)
  const [rangeKey, setRangeKey] = useState(compact ? 'week' : 'month')
  const [customDate, setCustomDate] = useState(() => toISODate(new Date()))
  const [filterId, setFilterId] = useState('latino')
  const [cantonFilter, setCantonFilter] = useState(ALL_CANTONS)
  const [events, setEvents] = useState([])
  const [visibleCount, setVisibleCount] = useState(initialVisibleCount)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const range = useMemo(() => getEventfrogRange(rangeKey, customDate), [customDate, rangeKey])
  const uniqueEvents = useMemo(() => dedupeEvents(events), [events])
  const cantonOptions = useMemo(() => getCantonOptions(uniqueEvents), [uniqueEvents])
  const filteredEvents = useMemo(() => {
    if (cantonFilter === ALL_CANTONS) return uniqueEvents
    return uniqueEvents.filter(event => normalizeCanton(event.canton) === cantonFilter)
  }, [cantonFilter, uniqueEvents])
  const visibleEvents = useMemo(() => filteredEvents.slice(0, visibleCount), [filteredEvents, visibleCount])
  const grouped = useMemo(() => Array.from(groupByDate(visibleEvents).values()), [visibleEvents])
  const hasEmbedFallback = showEmbedFallback && EVENTFROG_EMBED_KEY
  const listMaxHeight = compact ? LIST_MAX_HEIGHT.compact : LIST_MAX_HEIGHT.regular
  const embedUrl = useMemo(
    () => buildEventfrogEmbedUrl({ term:filterId, from:range.from, to:range.to }),
    [filterId, range.from, range.to]
  )

  function showNextVisibleBlock() {
    setVisibleCount(count => Math.min(filteredEvents.length, count + visibleStep))
  }

  function handleListScroll(event) {
    if (visibleCount >= filteredEvents.length) return

    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget
    if (scrollHeight - scrollTop - clientHeight < 120) {
      showNextVisibleBlock()
    }
  }

  function handleCarouselScroll(event) {
    if (visibleCount >= filteredEvents.length) return

    const { scrollLeft, scrollWidth, clientWidth } = event.currentTarget
    if (scrollWidth - scrollLeft - clientWidth < 180) {
      showNextVisibleBlock()
    }
  }

  function handleCantonFilterChange(value) {
    setCantonFilter(value)
    setVisibleCount(initialVisibleCount)
  }

  useEffect(() => {
    if (cantonFilter === ALL_CANTONS) return
    if (cantonOptions.some(option => option.id === cantonFilter)) return
    setCantonFilter(ALL_CANTONS)
  }, [cantonFilter, cantonOptions])

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    async function loadEvents() {
      setLoading(true)
      setError('')
      setEvents([])
      setVisibleCount(initialVisibleCount)
      try {
        const nextEvents = await fetchEventfrogEvents({
          from:range.from,
          to:range.to,
          filterId,
          signal:controller.signal,
          limit:maxEvents,
          onProgress: partialEvents => {
            if (!active || controller.signal.aborted) return
            setEvents(partialEvents)
          },
        })
        if (active && !controller.signal.aborted) setEvents(nextEvents)
      } catch (err) {
        if (err.name !== 'AbortError') {
          setEvents([])
          const isRateLimited = /429|too many requests/i.test(err.message || '')
          setError(
            err.message === 'Missing Eventfrog API key'
              ? 'Falta configurar EVENTFROG_API_KEY en Vercel.'
              : isRateLimited
                ? 'Eventfrog está limitando las peticiones. Vuelve a probar en unos minutos.'
              : 'No se pudo cargar la API de Eventfrog.'
          )
        }
      } finally {
        if (active && !controller.signal.aborted) setLoading(false)
      }
    }

    loadEvents()
    return () => {
      active = false
      controller.abort()
    }
  }, [filterId, initialVisibleCount, maxEvents, range.from, range.to])

  if (layout === 'carousel') {
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        <div style={{ maxWidth:980, margin:'0 auto', width:'100%', padding:'10px 16px 0' }}>
          <div style={{ paddingBottom:8 }}>
            <FilterRow>
            <PillSelect
              ariaLabel="Rango de fechas"
              value={rangeKey}
              onChange={setRangeKey}
              options={RANGE_OPTIONS}
            />
            <PillSelect
              ariaLabel="Filtro de eventos"
              value={filterId}
              onChange={setFilterId}
              options={EVENTFROG_FILTERS}
            />
            <PillSelect
              ariaLabel="Filtrar por cantón"
              value={cantonFilter}
              onChange={handleCantonFilterChange}
              options={cantonOptions}
              disabled={cantonOptions.length <= 1}
            />
            </FilterRow>
          </div>

          {rangeKey === 'custom' && (
            <input
              type="date"
              value={customDate}
              onChange={event => setCustomDate(event.target.value)}
              style={{
                width:'100%',
                maxWidth:220,
                fontFamily:PP,
                fontSize:12,
                color:C.text,
                border:`1.5px solid ${C.border}`,
                borderRadius:13,
                padding:'10px 12px',
                outline:'none',
                margin:'0 0 8px',
              }}
            />
          )}

          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, marginTop:4 }}>
            <p style={{ fontFamily:PP, fontWeight:800, fontSize:13, color:C.text, margin:0 }}>
              {formatRangeLabel(range.from, range.to)}
            </p>
          </div>
        </div>

        {filteredEvents.length > 0 ? (
          <div className="no-scroll" onScroll={handleCarouselScroll} style={{ overflowX:'auto', WebkitOverflowScrolling:'touch', padding:'4px 16px 16px' }}>
            <div style={{ display:'flex', gap:12, width:'max-content' }}>
              {visibleEvents.map(event => (
                <CarouselEventCard key={event.id} event={event} />
              ))}
              {loading && [1, 2].map(item => (
                <div key={`loading-${item}`} className="skeleton" style={{ flexShrink:0, width:168, height:226, borderRadius:16 }} />
              ))}
            </div>
          </div>
        ) : loading && events.length === 0 ? (
          <div className="no-scroll" style={{ overflowX:'auto', WebkitOverflowScrolling:'touch', padding:'4px 16px 16px' }}>
            <div style={{ display:'flex', gap:12, width:'max-content' }}>
              {[1, 2, 3, 4].map(item => (
                <div key={item} className="skeleton" style={{ flexShrink:0, width:168, height:226, borderRadius:16 }} />
              ))}
            </div>
          </div>
        ) : (
          <div style={{ maxWidth:980, margin:'0 auto', width:'100%', padding:'0 16px' }}>
            <div style={{ background:'#fff', border:`1px solid ${C.border}`, borderRadius:16, padding:'18px 14px', textAlign:'center' }}>
              <p style={{ fontFamily:PP, fontWeight:700, fontSize:13, color:C.text, margin:'0 0 4px' }}>
                No encontramos eventos para este filtro.
              </p>
              <p style={{ fontFamily:PP, fontSize:11, color:C.light, margin:0 }}>
                Prueba otro rango, cambia el filtro o el cantón.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div style={{ maxWidth:980, margin:'0 auto', width:'100%', padding:'0 16px' }}>
            <p style={{ fontFamily:PP, fontSize:11, color:'#991B1B', margin:0 }}>
              {error}
            </p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <div
        style={{
          background:'#fff',
          border:`1px solid ${C.border}`,
          borderRadius:20,
          padding:compact ? 12 : 14,
        }}
      >
        <div style={{ marginBottom:12 }}>
          <FilterRow>
          <PillSelect
            ariaLabel="Rango de fechas"
            value={rangeKey}
            onChange={setRangeKey}
            options={RANGE_OPTIONS}
          />
          <PillSelect
            ariaLabel="Filtro de eventos"
            value={filterId}
            onChange={setFilterId}
            options={EVENTFROG_FILTERS}
          />
          <PillSelect
            ariaLabel="Filtrar por cantón"
            value={cantonFilter}
            onChange={handleCantonFilterChange}
            options={cantonOptions}
            disabled={cantonOptions.length <= 1}
          />
          </FilterRow>
        </div>

        {rangeKey === 'custom' && (
          <input
            type="date"
            value={customDate}
            onChange={event => setCustomDate(event.target.value)}
            style={{
              width:'100%',
              fontFamily:PP,
              fontSize:12,
              color:C.text,
              border:`1.5px solid ${C.border}`,
              borderRadius:13,
              padding:'10px 12px',
              outline:'none',
              marginBottom:12,
            }}
          />
        )}

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, marginBottom:compact ? 8 : 12 }}>
          <p style={{ fontFamily:PP, fontWeight:800, fontSize:compact ? 13 : 15, color:C.text, margin:0 }}>
            {formatRangeLabel(range.from, range.to)}
          </p>
        </div>

        {filteredEvents.length > 0 ? (
          <div
            onScroll={handleListScroll}
            style={{
              maxHeight:listMaxHeight,
              overflowY:'auto',
              overflowX:'hidden',
              paddingRight:4,
              marginRight:-4,
              overscrollBehavior:'contain',
              WebkitOverflowScrolling:'touch',
            }}
          >
            <div style={{ display:'flex', flexDirection:'column', gap:compact ? 10 : 14 }}>
              {grouped.map(group => (
                <div key={group.key}>
                  <p
                    style={{
                      fontFamily:PP,
                      fontSize:compact ? 10 : 11,
                      fontWeight:800,
                      color:C.light,
                      letterSpacing:1,
                      textTransform:'uppercase',
                      margin:compact ? '0 0 7px 2px' : '0 0 8px',
                    }}
                  >
                    {group.label}
                  </p>
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {group.events.map(event => (
                      <EventCard key={event.id} event={event} compact={compact} />
                    ))}
                  </div>
                </div>
              ))}

              {loading && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {[1, 2].map(item => (
                    <div key={item} className="skeleton" style={{ height:compact ? 96 : 116, borderRadius:16 }} />
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : loading && events.length === 0 ? (
          <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:listMaxHeight, overflow:'hidden' }}>
            {[1, 2, 3].map(item => (
              <div key={item} className="skeleton" style={{ height:compact ? 96 : 116, borderRadius:16 }} />
            ))}
          </div>
        ) : (
          <div style={{ background:C.bg, borderRadius:16, padding:'18px 14px', textAlign:'center' }}>
            <p style={{ fontFamily:PP, fontWeight:700, fontSize:13, color:C.text, margin:'0 0 4px' }}>
              No encontramos eventos para este filtro.
            </p>
            <p style={{ fontFamily:PP, fontSize:11, color:C.light, margin:0 }}>
              {hasEmbedFallback
                ? 'Prueba otro rango o mira el calendario completo abajo.'
                : 'Prueba otro rango, cambia el filtro o el cantón.'}
            </p>
          </div>
        )}
      </div>

      {hasEmbedFallback && (error || events.length === 0 || !compact) && (
        <div style={{ borderRadius:20, border:`1px solid ${C.border}`, height:compact ? 360 : 420, overflow:'hidden', background:'#fff' }}>
          <iframe
            title="Calendario Eventfrog"
            width="100%"
            height={compact ? '360' : '420'}
            style={{ border:'none', display:'block', height:compact ? 360 : 420 }}
            src={embedUrl}
            loading="lazy"
            allow="fullscreen"
            scrolling="auto"
          />
        </div>
      )}

      {error && !hasEmbedFallback && (
        <p style={{ fontFamily:PP, fontSize:11, color:'#991B1B', margin:0 }}>
          {error}
        </p>
      )}
    </div>
  )
}
