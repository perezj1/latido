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
  { id:'custom', label:'Fecha' },
]

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
          📍 {event.city} · {event.organizer}
        </p>
        <p style={{ fontFamily:PP, fontSize:11, color:C.primary, fontWeight:700, margin:0 }}>
          {event.price}
        </p>
      </div>
    </a>
  )
}

export default function EventfrogCalendar({ compact = false, maxEvents = 18, showEmbedFallback = true }) {
  const [rangeKey, setRangeKey] = useState(compact ? 'week' : 'month')
  const [customDate, setCustomDate] = useState(() => toISODate(new Date()))
  const [filterId, setFilterId] = useState('latino')
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const range = useMemo(() => getEventfrogRange(rangeKey, customDate), [customDate, rangeKey])
  const grouped = useMemo(() => Array.from(groupByDate(events).values()), [events])
  const embedUrl = useMemo(
    () => buildEventfrogEmbedUrl({ term:filterId, from:range.from, to:range.to }),
    [filterId, range.from, range.to]
  )

  useEffect(() => {
    const controller = new AbortController()

    async function loadEvents() {
      setLoading(true)
      setError('')
      try {
        const nextEvents = await fetchEventfrogEvents({
          from:range.from,
          to:range.to,
          filterId,
          signal:controller.signal,
          limit:maxEvents,
        })
        setEvents(nextEvents)
      } catch (err) {
        if (err.name !== 'AbortError') {
          setEvents([])
          setError('No se pudo cargar la API de Eventfrog.')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    loadEvents()
    return () => controller.abort()
  }, [filterId, maxEvents, range.from, range.to])

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
        <div style={{ display:'flex', gap:8, alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', marginBottom:12 }}>
          <div className="no-scroll" style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:2 }}>
            {RANGE_OPTIONS.map(option => {
              const active = rangeKey === option.id
              return (
                <button
                  key={option.id}
                  onClick={() => setRangeKey(option.id)}
                  style={{
                    fontFamily:PP,
                    fontSize:10,
                    fontWeight:700,
                    borderRadius:999,
                    border:`1.5px solid ${active ? C.primary : C.border}`,
                    background:active ? C.primary : '#fff',
                    color:active ? '#fff' : C.mid,
                    padding:'7px 12px',
                    cursor:'pointer',
                    whiteSpace:'nowrap',
                  }}
                >
                  {option.label}
                </button>
              )
            })}
          </div>

          <select
            value={filterId}
            onChange={event => setFilterId(event.target.value)}
            style={{
              fontFamily:PP,
              fontSize:11,
              fontWeight:700,
              color:C.primary,
              border:`1.5px solid ${C.primaryMid}`,
              borderRadius:12,
              background:C.primaryLight,
              padding:'8px 10px',
              outline:'none',
              cursor:'pointer',
            }}
          >
            {EVENTFROG_FILTERS.map(option => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
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
          <span style={{ fontFamily:PP, fontSize:10, color:C.light, whiteSpace:'nowrap' }}>
            Eventfrog
          </span>
        </div>

        {loading ? (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {[1, 2, 3].map(item => (
              <div key={item} className="skeleton" style={{ height:compact ? 96 : 116, borderRadius:16 }} />
            ))}
          </div>
        ) : events.length > 0 ? (
          <div style={{ display:'flex', flexDirection:'column', gap:compact ? 10 : 14 }}>
            {grouped.map(group => (
              <div key={group.key}>
                {!compact && (
                  <p style={{ fontFamily:PP, fontSize:11, fontWeight:800, color:C.light, letterSpacing:1, textTransform:'uppercase', margin:'0 0 8px' }}>
                    {group.label}
                  </p>
                )}
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {group.events.map(event => (
                    <EventCard key={event.id} event={event} compact={compact} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ background:C.bg, borderRadius:16, padding:'18px 14px', textAlign:'center' }}>
            <p style={{ fontFamily:PP, fontWeight:700, fontSize:13, color:C.text, margin:'0 0 4px' }}>
              No encontramos eventos para este filtro.
            </p>
            <p style={{ fontFamily:PP, fontSize:11, color:C.light, margin:0 }}>
              Prueba otro rango o mira el calendario completo abajo.
            </p>
          </div>
        )}
      </div>

      {showEmbedFallback && EVENTFROG_EMBED_KEY && (error || events.length === 0 || !compact) && (
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

      {error && !EVENTFROG_EMBED_KEY && (
        <p style={{ fontFamily:PP, fontSize:11, color:'#991B1B', margin:0 }}>
          {error}
        </p>
      )}
    </div>
  )
}
