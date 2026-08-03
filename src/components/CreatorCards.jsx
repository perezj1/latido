import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  getCreatorPlatform,
  getCreatorThumbnailUrl,
  getCreatorTopic,
  trackCreatorMetric,
} from '../lib/creators'
import { C, PP } from '../lib/theme'
import ReportButton from './ReportButton'

const CREATOR_LIKES_KEY = 'latido_creator_content_likes_v1'
const CREATOR_LIKES_EVENT = 'latido:creator-likes-updated'

function readCreatorLikes() {
  if (typeof window === 'undefined') return []
  try {
    const stored = JSON.parse(window.localStorage.getItem(CREATOR_LIKES_KEY) || '[]')
    return Array.isArray(stored) ? stored.map(String) : []
  } catch {
    return []
  }
}

function CreatorContentMenu({ content, creator, className='' }) {
  const menuRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [liked, setLiked] = useState(() => readCreatorLikes().includes(String(content.id)))

  useEffect(() => {
    const syncLike = () => setLiked(readCreatorLikes().includes(String(content.id)))
    window.addEventListener('storage', syncLike)
    window.addEventListener(CREATOR_LIKES_EVENT, syncLike)
    return () => {
      window.removeEventListener('storage', syncLike)
      window.removeEventListener(CREATOR_LIKES_EVENT, syncLike)
    }
  }, [content.id])

  useEffect(() => {
    if (!open) return undefined
    const closeOutside = event => {
      if (!menuRef.current?.contains(event.target)) setOpen(false)
    }
    const closeOnEscape = event => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const toggleLike = () => {
    const contentId = String(content.id)
    const current = readCreatorLikes()
    const next = current.includes(contentId)
      ? current.filter(id => id !== contentId)
      : [...current, contentId]
    try {
      window.localStorage.setItem(CREATOR_LIKES_KEY, JSON.stringify(next))
      window.dispatchEvent(new CustomEvent(CREATOR_LIKES_EVENT))
      setOpen(false)
    } catch {
      toast.error('No se pudo guardar el Me gusta')
    }
  }

  const shareContent = async () => {
    const profileUrl = `${window.location.origin}/creadores/${creator.slug}`
    const shareUrl = content.demo ? profileUrl : content.url || profileUrl
    const data = {
      title:content.title,
      text:`${content.title} · ${creator.name}`,
      url:shareUrl,
    }
    setOpen(false)
    try {
      if (navigator.share) await navigator.share(data)
      else {
        await navigator.clipboard.writeText(shareUrl)
        toast.success('Enlace copiado')
      }
    } catch (error) {
      if (error?.name !== 'AbortError') toast.error('No se pudo compartir el contenido')
    }
  }

  return (
    <div ref={menuRef} className={`creator-content-menu${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        className="creator-content-menu__trigger"
        onClick={() => setOpen(current => !current)}
        aria-label="Más opciones"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span aria-hidden="true">⋮</span>
      </button>
      <div className={`creator-content-menu__popover${open ? ' is-open' : ''}`} role="menu" aria-hidden={!open}>
          <button type="button" role="menuitem" onClick={shareContent}>
            <span aria-hidden="true">↗</span>
            <span>Compartir</span>
          </button>
          <button type="button" role="menuitem" className={liked ? 'is-active' : ''} onClick={toggleLike}>
            <span aria-hidden="true">{liked ? '♥' : '♡'}</span>
            <span>{liked ? 'Te gusta' : 'Me gusta'}</span>
          </button>
          <span className="creator-content-menu__divider" role="separator" />
          <ReportButton
            contentType="creator_content"
            contentId={content.id}
            ownerId={creator.owner_id}
            title="Reportar esta publicación"
            label="Reportar"
            icon={<span aria-hidden="true">!</span>}
            compact
            allowOwnContent
            onOpen={() => setOpen(false)}
            metadata={{ creator_id:creator.id, creator_name:creator.name, content_title:content.title, external_url:content.url, demo:Boolean(content.demo) }}
            style={{ width:'100%', justifyContent:'flex-start', padding:'9px 10px', color:'#DC2626', background:'transparent', border:'none', borderRadius:9, fontSize:10.5 }}
          />
      </div>
    </div>
  )
}

export function CreatorAvatar({ creator, size = 72 }) {
  const initials = String(creator?.name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('')

  return (
    <div
      aria-label={creator?.name || 'Creador'}
      style={{
        width:size,
        height:size,
        flex:`0 0 ${size}px`,
        borderRadius:'50%',
        display:'grid',
        placeItems:'center',
        color:'#fff',
        fontFamily:PP,
        fontWeight:900,
        fontSize:size * 0.3,
        letterSpacing:-1,
        background:`linear-gradient(145deg, ${creator?.accent || C.primary}, #0F172A)`,
        border:'3px solid #fff',
        boxShadow:'0 8px 22px rgba(15,23,42,.16)',
      }}
    >
      {initials || '?'}
    </div>
  )
}

export function CreatorTopicPill({ topicId, compact = false }) {
  const topic = getCreatorTopic(topicId)
  return (
    <span
      style={{
        display:'inline-flex',
        alignItems:'center',
        gap:5,
        maxWidth:'100%',
        padding:compact ? '4px 8px' : '6px 10px',
        borderRadius:999,
        background:topic.bg,
        color:topic.color,
        fontFamily:PP,
        fontWeight:700,
        fontSize:compact ? 9 : 10,
        lineHeight:1.2,
        whiteSpace:'nowrap',
      }}
    >
      <span>{topic.emoji}</span>
      <span style={{ overflow:'hidden', textOverflow:'ellipsis' }}>{topic.label}</span>
    </span>
  )
}

export function CreatorPlatformBadge({ platformId }) {
  const platform = getCreatorPlatform(platformId)
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'5px 8px', borderRadius:999, background:platform.bg, color:platform.color, fontFamily:PP, fontWeight:800, fontSize:9, lineHeight:1 }}>
      <span>{platform.short}</span>
      <span>{platform.label}</span>
    </span>
  )
}

function formatDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('es-CH', { day:'numeric', month:'short', year:'numeric' })
}

export function CreatorCard({ creator }) {
  const publishedCount = (creator.contents || []).filter(content => content.status === 'published').length

  return (
    <Link className="creator-profile-card" to={`/creadores/${creator.slug}`}>
      <div className="creator-profile-card__top" style={{ '--creator-accent':creator.accent || C.primary }}>
        <CreatorAvatar creator={creator} size={70} />
        <div className="creator-profile-card__identity">
          <div style={{ display:'flex', alignItems:'center', gap:6, minWidth:0 }}>
            <h3>{creator.name}</h3>
            {creator.verified && <span className="creator-confirmed" title="Perfil confirmado por su responsable">✓</span>}
          </div>
          <p>{creator.handle}</p>
        </div>
        <span className="creator-profile-card__arrow" aria-hidden="true">→</span>
      </div>

      <p className="creator-profile-card__tagline">{creator.tagline}</p>

      <div className="creator-profile-card__topics">
        {(creator.topics || []).slice(0, 3).map(topic => <CreatorTopicPill key={topic} topicId={topic} compact />)}
      </div>

      <div className="creator-profile-card__meta">
        <span>📍 {creator.city || creator.reach || 'Toda Suiza'}{creator.canton ? ` · ${creator.canton}` : ''}</span>
        <span>{publishedCount} {publishedCount === 1 ? 'publicación' : 'publicaciones'}</span>
      </div>
    </Link>
  )
}

export function CreatorContentCard({ content, creator, onDemoOpen, compact = false }) {
  const topic = getCreatorTopic(content.topic)
  const thumbnailUrl = getCreatorThumbnailUrl(content)
  const handleOpen = () => {
    if (content.demo) {
      onDemoOpen?.(content, creator)
      return
    }

    trackCreatorMetric(creator.id, 'content_click', content.id)
    window.open(content.url, '_blank', 'noopener,noreferrer')
  }

  return (
    <article className={`creator-content-card${compact ? ' creator-content-card--compact' : ''}`}>
      <CreatorContentMenu content={content} creator={creator} className="creator-content-menu--full" />
      <button
        type="button"
        className="creator-content-card__media"
        style={{ '--content-color':topic.color, '--content-bg':topic.bg }}
        onClick={handleOpen}
        aria-label={`Ver ${content.title}`}
      >
        <span className="creator-content-card__orb creator-content-card__orb--one" />
        <span className="creator-content-card__orb creator-content-card__orb--two" />
        <span className="creator-content-card__emoji">{topic.emoji}</span>
        {thumbnailUrl && <img className="creator-content-card__thumbnail" src={thumbnailUrl} alt="" loading="lazy" decoding="async" onError={event => event.currentTarget.remove()} />}
        <span className="creator-content-card__platform"><CreatorPlatformBadge platformId={content.platform} /></span>
        <span className="creator-content-card__play">▶</span>
        <span className="creator-content-card__duration">{content.duration || content.format}</span>
      </button>

      <div className="creator-content-card__body">
        <div className="creator-content-card__creator">
          <CreatorAvatar creator={creator} size={28} />
          <span>{creator.name}</span>
          {creator.verified && <span className="creator-confirmed creator-confirmed--small">✓</span>}
        </div>
        <h3>{content.title}</h3>
        {!compact && <p>{content.summary}</p>}
        <div className="creator-content-card__footer">
          <CreatorTopicPill topicId={content.topic} compact />
          <span>{formatDate(content.published_at)}</span>
        </div>
        <button type="button" className="creator-content-card__cta" onClick={handleOpen}>
          {content.demo ? 'Probar vista previa' : `Abrir en ${getCreatorPlatform(content.platform).label}`} →
        </button>
      </div>
    </article>
  )
}

export function CreatorAppContentCard({ content, creator, onDemoOpen }) {
  const topic = getCreatorTopic(content.topic)
  const platform = getCreatorPlatform(content.platform)
  const thumbnailUrl = getCreatorThumbnailUrl(content)
  const handleOpen = () => {
    if (content.demo) {
      onDemoOpen?.(content, creator)
      return
    }
    trackCreatorMetric(creator.id, 'content_click', content.id)
    window.open(content.url, '_blank', 'noopener,noreferrer')
  }

  return (
    <article className="creator-app-content-card">
      <CreatorContentMenu content={content} creator={creator} className="creator-content-menu--app" />
      <button type="button" className="creator-app-content-card__open" onClick={handleOpen} aria-label={`Ver ${content.title}`}>
        <span className="creator-app-content-card__media" style={{ '--content-color':topic.color, '--content-bg':topic.bg }}>
          <span className="creator-app-content-card__emoji">{topic.emoji}</span>
          {thumbnailUrl && <img className="creator-app-content-card__thumbnail" src={thumbnailUrl} alt="" loading="lazy" decoding="async" onError={event => event.currentTarget.remove()} />}
          <span className="creator-app-content-card__platform" style={{ color:platform.color, background:platform.bg }}>{platform.short}</span>
          <span className="creator-app-content-card__play">▶</span>
          <span className="creator-app-content-card__duration">{content.duration || content.format}</span>
        </span>
        <span className="creator-app-content-card__body">
          <span className="creator-app-content-card__creator">
            <CreatorAvatar creator={creator} size={20} />
            <span>{creator.name}</span>
            {creator.verified && <span className="creator-confirmed creator-confirmed--tiny">✓</span>}
          </span>
          <strong>{content.title}</strong>
        </span>
      </button>
    </article>
  )
}

export function DemoContentModal({ content, creator, onClose }) {
  if (!content || !creator) return null
  const topic = getCreatorTopic(content.topic)
  const thumbnailUrl = getCreatorThumbnailUrl(content)

  return (
    <div className="creator-modal-backdrop" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget) onClose?.()
    }}>
      <section className="creator-preview-modal" role="dialog" aria-modal="true" aria-labelledby="creator-preview-title">
        <button className="creator-modal-close" type="button" onClick={onClose} aria-label="Cerrar">×</button>
        <div className="creator-preview-modal__visual" style={{ '--content-color':topic.color, '--content-bg':topic.bg }}>
          <span>{topic.emoji}</span>
          {thumbnailUrl && <img className="creator-preview-modal__thumbnail" src={thumbnailUrl} alt="" onError={event => event.currentTarget.remove()} />}
          <span className="creator-preview-modal__play">▶</span>
        </div>
        <div className="creator-preview-modal__body">
          <span className="creator-demo-label">DEMOSTRACIÓN INTERACTIVA</span>
          <h2 id="creator-preview-title">{content.title}</h2>
          <p>{content.summary}</p>
          <div className="creator-preview-modal__byline">
            <CreatorAvatar creator={creator} size={42} />
            <div>
              <strong>{creator.name}</strong>
              <span>{creator.handle} · {getCreatorPlatform(content.platform).label}</span>
            </div>
          </div>
          <div className="creator-preview-modal__notice">
            Esta ficha simula una publicación externa. Cuando una persona, profesional o negocio añada un enlace real, este botón abrirá la publicación original y Latido medirá la visita enviada.
          </div>
          <div className="creator-preview-modal__actions">
            <Link to={`/creadores/${creator.slug}`} onClick={onClose}>Ver perfil completo</Link>
            <button type="button" onClick={onClose}>Cerrar prueba</button>
          </div>
        </div>
      </section>
    </div>
  )
}
