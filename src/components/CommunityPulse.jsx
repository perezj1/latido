import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import HorizontalDragScroller from './HorizontalDragScroller'
import { supabase } from '../lib/supabase'
import { C, PP } from '../lib/theme'
import {
  CANTONS,
  COMMUNITY_CATS,
  JOB_SECTORS,
  getAdDisplayCat,
  getAdDisplayEmoji,
  getJobCategoryEmoji,
  getNegocioTypeMeta,
} from '../lib/constants'
import { isPublicationOpen } from '../lib/publicationLifecycle'
import { isLikelySchemaMismatchError } from '../lib/supabaseCompat'
import { getAdPath, getEventPath, getBusinessPath, getJobPath } from '../lib/seo'

/* ─────────────────────────────────────────────────────────────
   Pulso de la comunidad: lo último que ha pasado de verdad en
   Latido — anuncios, empleos, negocios, creadores, contenidos,
   eventos y grupos — en una tira que se desliza.

   Reglas que impiden que esta sección se vuelva en contra:
   1. Solo contenido público y abierto (nunca anuncios privados).
   2. Solo de los últimos WINDOW_DAYS días.
   3. Si no llega a MIN_ITEMS, la sección no se muestra. Un feed
      real pero viejo confirma el miedo del visitante ("¿estará
      vacía esta app?"), así que es mejor no enseñarlo.
   4. Sin nombres completos, sin teléfono, sin email, sin
      descripciones: solo el titular, que ya es público.
   5. La hora se calcula desde la fecha real, nunca se escribe.
   ───────────────────────────────────────────────────────────── */

const WINDOW_DAYS = 30
const MIN_ITEMS = 4
const MAX_ITEMS = 12
// Tope por tipo: si las doce tarjetas fueran del mismo sitio, la tira dejaría
// de contar que Latido se mueve por todos lados. Con 2 por tipo entran las
// siete clases de novedad. Todo lo que se muestra sigue siendo real.
const MAX_PER_KIND = 2
const REFRESH_LABELS_MS = 60 * 1000
const CARD_BACKGROUND = 'linear-gradient(180deg, #F8FAFF 0%, #EEF5FF 100%)'

// Una etiqueta por tipo de novedad: la tarjeta dice qué es, no qué pide.
const KIND = {
  listing:   { label: 'Anuncio',   bg: '#DBEAFE', color: '#1D4ED8' },
  job:       { label: 'Empleo',    bg: '#D1FAE5', color: '#065F46' },
  provider:  { label: 'Negocio',   bg: '#CCFBF1', color: '#0F766E' },
  creator:   { label: 'Creador',   bg: '#EDE9FE', color: '#6D28D9' },
  content:   { label: 'Contenido', bg: '#E0E7FF', color: '#4338CA' },
  event:     { label: 'Evento',    bg: '#FCE7F3', color: '#9D174D' },
  community: { label: 'Grupo',     bg: '#FEF3C7', color: '#92400E' },
}

const RELATIVE_FORMATTER = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })

function timeAgo(value) {
  const then = new Date(value).getTime()
  if (!Number.isFinite(then)) return ''

  const minutes = Math.round((then - Date.now()) / 60000)
  if (Math.abs(minutes) < 1) return 'ahora mismo'
  if (Math.abs(minutes) < 60) return RELATIVE_FORMATTER.format(minutes, 'minute')

  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return RELATIVE_FORMATTER.format(hours, 'hour')

  const days = Math.round(hours / 24)
  if (days === -2) return 'hace 2 días'
  return RELATIVE_FORMATTER.format(days, 'day')
}

function cantonLabel(code) {
  const clean = String(code || '').trim()
  if (!clean) return ''
  return CANTONS.find(canton => canton.code === clean)?.name || clean
}

// En las solicitudes de empleo el campo "company" guarda el nombre de la
// persona que busca trabajo, así que jamás se muestra: se usa el sector.
function jobSectorLabel(job) {
  const raw = String(job.sector || job.category || '').trim()
  const match = JOB_SECTORS.find(sector => sector.id === raw || sector.label === raw)
  return `${getJobCategoryEmoji(job)} ${match?.label || 'Empleo'}`
}

function communityCatLabel(community) {
  const match = COMMUNITY_CATS.find(cat => cat.id === community.cat)
  return `${match?.emoji || community.emoji || '👥'} ${match?.label || 'Grupo'}`
}

function placeLabel(...candidates) {
  for (const candidate of candidates) {
    const clean = String(candidate || '').trim()
    if (clean && clean.toLowerCase() !== 'toda suiza') return cantonLabel(clean)
  }
  return ''
}

/* ── Fuentes ──────────────────────────────────────────────────
   Cada fuente declara qué tabla lee, con qué columnas, cómo se
   filtra y cómo se convierte en tarjeta. Añadir un tipo nuevo al
   pulso es añadir una entrada más aquí.
   ───────────────────────────────────────────────────────────── */
const SOURCES = [
  {
    id: 'listing',
    table: 'listings',
    columns: 'id,title,cat,sub,type,canton,price,privacy,active,lifecycle_status,expires_at,created_at',
    safeColumns: 'id,title,cat,sub,type,canton,price,privacy,active,created_at',
    limit: 20,
    apply: query => query
      .or('active.is.null,active.eq.true')
      .or('privacy.is.null,privacy.eq.public'),
    keep: row => isPublicationOpen(row),
    map: row => ({
      to: getAdPath(row),
      title: row.title,
      category: `${getAdDisplayEmoji(row)} ${getAdDisplayCat(row)?.label || 'Anuncio'}`,
      place: placeLabel(row.canton),
      extra: row.price || '',
      at: row.created_at,
    }),
  },
  {
    id: 'job',
    table: 'jobs',
    columns: 'id,title,sector,category,city,canton,salary,active,lifecycle_status,expires_at,created_at',
    safeColumns: 'id,title,sector,category,city,canton,salary,active,created_at',
    limit: 12,
    apply: query => query.or('active.is.null,active.eq.true'),
    keep: row => isPublicationOpen(row),
    map: row => ({
      to: getJobPath(row),
      title: row.title,
      category: jobSectorLabel(row),
      place: placeLabel(row.canton, row.city),
      extra: row.salary || '',
      at: row.created_at,
    }),
  },
  {
    id: 'provider',
    table: 'providers',
    columns: 'id,name,category,city,canton,photo_url,verified,active,created_at',
    safeColumns: 'id,name,category,city,canton,active,created_at',
    limit: 8,
    apply: query => query.eq('active', true),
    map: row => ({
      to: getBusinessPath(row),
      title: row.name,
      category: getNegocioTypeMeta(row.category)?.label || '🏪 Negocio',
      place: placeLabel(row.city, row.canton),
      at: row.created_at,
    }),
  },
  {
    id: 'creator',
    table: 'creator_profiles',
    columns: 'id,slug,name,tagline,city,canton,status,review_status,active,created_at',
    safeColumns: 'id,slug,name,tagline,city,canton,active,created_at',
    limit: 8,
    apply: query => query.eq('active', true),
    keep: row => row.status !== 'draft' && row.review_status !== 'rejected',
    map: row => ({
      to: `/creadores/${row.slug}`,
      title: row.name,
      category: row.tagline ? `🎙️ ${row.tagline}` : '🎙️ Comparte sobre Suiza',
      place: placeLabel(row.city, row.canton),
      at: row.created_at,
    }),
  },
  {
    id: 'content',
    table: 'creator_contents',
    columns: 'id,title,topic,canton,platform,status,active,published_at,creator:creator_profiles(slug,name,status,active)',
    safeColumns: 'id,title,topic,canton,platform,active,published_at',
    dateColumn: 'published_at',
    limit: 10,
    apply: query => query.eq('active', true),
    keep: row => row.status !== 'draft' && row.creator?.status !== 'draft' && row.creator?.active !== false,
    map: row => ({
      to: row.creator?.slug ? `/creadores/${row.creator.slug}` : '/creadores',
      title: row.title,
      category: `▶️ ${row.creator?.name || 'Creadores'}`,
      place: placeLabel(row.canton),
      at: row.published_at,
    }),
  },
  {
    id: 'event',
    table: 'events',
    columns: 'id,title,type,emoji,city,canton,price,active,created_at',
    safeColumns: 'id,title,type,emoji,city,canton,active,created_at',
    limit: 8,
    apply: query => query.eq('active', true),
    map: row => ({
      to: getEventPath(row),
      title: row.title,
      category: `${row.emoji || '🎉'} ${row.type || 'Evento'}`,
      place: placeLabel(row.city, row.canton),
      extra: row.price || '',
      at: row.created_at,
    }),
  },
  {
    id: 'community',
    table: 'communities',
    columns: 'id,name,cat,emoji,city,members,active,created_at',
    safeColumns: 'id,name,cat,emoji,city,active,created_at',
    limit: 8,
    apply: query => query.eq('active', true),
    map: row => ({
      to: '/comunidades?view=comunidades',
      title: row.name,
      category: communityCatLabel(row),
      place: placeLabel(row.city),
      at: row.created_at,
    }),
  },
]

// Algunas columnas llegan de migraciones posteriores. Si el proyecto aún no las
// tiene, se reintenta con el juego mínimo en vez de dejar la sección muda.
async function fetchSource(source, since) {
  const dateColumn = source.dateColumn || 'created_at'

  const run = selection => source.apply(
    supabase.from(source.table).select(selection)
  )
    .gte(dateColumn, since)
    .order(dateColumn, { ascending: false })
    .limit(source.limit)

  let result = await run(source.columns)
  if (result.error && isLikelySchemaMismatchError(result.error, source.table)) {
    result = await run(source.safeColumns)
  }
  if (result.error) return []

  return (result.data || [])
    .filter(row => (source.keep ? source.keep(row) : true))
    .map(row => ({
      ...source.map(row),
      key: `${source.id}-${row.id}`,
      kind: source.id,
      tone: KIND[source.id],
    }))
    .filter(card => card.title && card.at)
}

function titleFingerprint(title = '') {
  return String(title)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function balanceByKind(list) {
  const picked = []
  const overflow = []
  const used = new Map()
  // Un negocio recién dado de alta suele publicar también su anuncio: sin esto
  // salen dos tarjetas casi idénticas seguidas y parece relleno.
  const seenTitles = new Set()

  for (const item of list) {
    const fingerprint = titleFingerprint(item.title)
    if (fingerprint && seenTitles.has(fingerprint)) continue
    if (fingerprint) seenTitles.add(fingerprint)

    const count = used.get(item.kind) || 0
    if (count >= MAX_PER_KIND) {
      overflow.push(item)
      continue
    }
    used.set(item.kind, count + 1)
    picked.push(item)
    if (picked.length === MAX_ITEMS) break
  }

  // Si no hay variedad suficiente, se completa con lo más reciente.
  for (const item of overflow) {
    if (picked.length >= MAX_ITEMS) break
    picked.push(item)
  }

  return picked.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))
}

export default function CommunityPulse() {
  const [items, setItems] = useState([])
  const [labelTick, setLabelTick] = useState(0)
  const scrollerRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    const since = new Date(Date.now() - WINDOW_DAYS * 86400000).toISOString()

    Promise.all(SOURCES.map(source => fetchSource(source, since).catch(() => [])))
      .then(groups => {
        if (cancelled) return
        const merged = groups
          .flat()
          .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))
        setItems(balanceByKind(merged))
      })
      .catch(() => {
        // Sin datos no hay sección: la landing sigue sin este bloque.
        if (!cancelled) setItems([])
      })

    return () => { cancelled = true }
  }, [])

  // Mantiene honestas las etiquetas de tiempo durante una visita larga.
  useEffect(() => {
    if (!items.length) return undefined
    const timer = setInterval(() => setLabelTick(tick => tick + 1), REFRESH_LABELS_MS)
    return () => clearInterval(timer)
  }, [items.length])

  useEffect(() => {
    if (!items.length || !scrollerRef.current) return
    scrollerRef.current.scrollLeft = 0
  }, [items])

  const cards = useMemo(
    () => items.map(item => ({ ...item, ago: timeAgo(item.at) })),
    // labelTick fuerza el recálculo de la hora relativa cada minuto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, labelTick]
  )

  if (cards.length < MIN_ITEMS) return null

  return (
    <section style={{ paddingTop: 52 }} aria-labelledby="landing-pulse-title">
      <div className="latido-page-container" style={{ maxWidth: 900, textAlign: 'center' }}>
        <p style={{
          fontFamily: PP,
          fontSize: 11,
          fontWeight: 700,
          color: C.primary,
          letterSpacing: 2,
          textTransform: 'uppercase',
          margin: '0 0 10px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span className="latido-pulse-dot" aria-hidden="true" />
          Ahora mismo en Latido
        </p>
        <h2
          id="landing-pulse-title"
          style={{ fontFamily: PP, fontWeight: 800, fontSize: 'clamp(20px,4vw,30px)', color: C.text, margin: '0 0 8px', letterSpacing: -0.5 }}
        >
          Lo último de la comunidad
        </h2>
        <p style={{ fontFamily: PP, fontSize: 13.5, color: C.mid, maxWidth: 460, margin: '0 auto', lineHeight: 1.65 }}>
          Anuncios, empleos, negocios y creadores reales de estos días. Se actualiza solo.
        </p>
      </div>

      <HorizontalDragScroller
        ref={scrollerRef}
        className="no-scroll"
        label="Últimas publicaciones de la comunidad"
        style={{
          display: 'flex',
          gap: 10,
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          scrollSnapType: 'none',
          maxWidth: 960,
          width: '100%',
          margin: '18px auto 0',
          paddingTop: 2,
          paddingRight: 'max(var(--latido-page-gutter), env(safe-area-inset-right))',
          paddingBottom: 6,
          paddingLeft: 'max(var(--latido-page-gutter), env(safe-area-inset-left))',
          scrollPaddingInline: 'var(--latido-page-gutter)',
          boxSizing: 'border-box',
        }}
      >
        {cards.map(card => (
          <Link
            key={card.key}
            to={card.to}
            className="latido-card-hover"
            style={{
              flex: '0 0 auto',
              width: 212,
              scrollSnapAlign: 'start',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              background: CARD_BACKGROUND,
              border: `1px solid ${C.border}`,
              borderRadius: 16,
              padding: '13px 14px',
              textDecoration: 'none',
              minWidth: 0,
            }}
          >
            <span style={{
              alignSelf: 'flex-start',
              fontFamily: PP,
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: 0.2,
              color: card.tone.color,
              background: card.tone.bg,
              borderRadius: 999,
              padding: '3px 9px',
              whiteSpace: 'nowrap',
            }}>
              {card.tone.label}
            </span>

            <p style={{
              fontFamily: PP,
              fontWeight: 700,
              fontSize: 13,
              color: C.text,
              margin: 0,
              lineHeight: 1.38,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              minHeight: 36,
            }}>
              {card.title}
            </p>

            <p style={{
              fontFamily: PP,
              fontSize: 10.5,
              color: C.mid,
              margin: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {card.category}
            </p>

            <p style={{
              fontFamily: PP,
              fontSize: 10,
              color: C.light,
              margin: 'auto 0 0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {card.place ? `📍 ${card.place} · ` : ''}{card.ago}
              {card.extra ? ` · ${card.extra}` : ''}
            </p>
          </Link>
        ))}
      </HorizontalDragScroller>

      <div className="latido-page-container" style={{ maxWidth: 900, textAlign: 'center', paddingTop: 6 }}>
        <Link
          to="/tablon"
          style={{
            fontFamily: PP,
            fontWeight: 600,
            fontSize: 12.5,
            color: C.primary,
            textDecoration: 'none',
            display: 'inline-block',
          }}
          aria-label="Ver todas las publicaciones"
        >
          Ver todo →
        </Link>
      </div>
    </section>
  )
}
