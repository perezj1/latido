import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import {
  getCreatorInteractionState,
  formatCreatorHandle,
  getCreatorPlatform,
  getCreatorThumbnailUrl,
  getCreatorTopic,
  subscribeCreatorInteractions,
  toggleCreatorInteraction,
  trackCreatorImpression,
  trackCreatorMetric,
} from '../lib/creators'
import { C, PP } from '../lib/theme'
import ReportButton from './ReportButton'

function useCreatorInteraction({ action, targetType, targetId, baseCount = 0 }) {
  const { user } = useAuth()
  const actorId = user?.id || ''
  const readState = () => getCreatorInteractionState({ action, targetType, targetId, actorId, baseCount })
  const [state, setState] = useState(readState)

  useEffect(() => {
    const sync = () => setState(readState())
    sync()
    return subscribeCreatorInteractions(sync)
  }, [action, actorId, baseCount, targetId, targetType])

  const toggle = () => {
    const next = toggleCreatorInteraction({ action, targetType, targetId, actorId, baseCount })
    setState(next)
    return next
  }

  return { ...state, toggle }
}

function CreatorContentMenu({ content, creator, className='' }) {
  const menuRef = useRef(null)
  const [open, setOpen] = useState(false)
  const helpful = useCreatorInteraction({ action:'helpful', targetType:'content', targetId:content.id, baseCount:content.helpful_count })

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

  const toggleHelpful = () => {
    try {
      helpful.toggle()
      setOpen(false)
    } catch {
      toast.error('No se pudo guardar esta valoración')
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
            <span aria-hidden="true">📤</span>
            <span>Compartir</span>
          </button>
          <button type="button" role="menuitem" className={helpful.active ? 'is-active' : ''} onClick={toggleHelpful}>
            <span aria-hidden="true">{helpful.active ? '❤️' : '🤍'}</span>
            <span>Me ayudó</span>
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

function CreatorHelpfulButton({ content, compact = false }) {
  const helpful = useCreatorInteraction({ action:'helpful', targetType:'content', targetId:content.id, baseCount:content.helpful_count })
  return (
    <button
      type="button"
      className={`creator-helpful-button${helpful.active ? ' is-active' : ''}${compact ? ' is-compact' : ''}`}
      onClick={event => {
        event.stopPropagation()
        helpful.toggle()
      }}
      aria-pressed={helpful.active}
    >
      <span aria-hidden="true">{helpful.active ? '❤️' : '🤍'}</span>
      <span>Me ayudó</span>
      {helpful.count > 0 && <strong>{helpful.count}</strong>}
    </button>
  )
}

export function CreatorFollowButton({ creator }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const saved = useCreatorInteraction({ action:'saved', targetType:'creator', targetId:creator.id, baseCount:creator.saved_count })

  const handleFollow = () => {
    if (!user?.id) {
      toast('Inicia sesión para seguir creadores y encontrarlos después en tu perfil.', { icon:'+' })
      navigate(`/auth?next=${encodeURIComponent(`/creadores/${creator.slug}`)}`)
      return
    }
    const next = saved.toggle()
    toast.success(next.active ? `Ahora sigues a ${creator.name}` : `Has dejado de seguir a ${creator.name}`)
  }

  return (
    <button type="button" className={`creator-follow-button${saved.active ? ' is-active' : ''}`} onClick={handleFollow} aria-pressed={saved.active}>
      <span aria-hidden="true">{saved.active ? '✓' : '+'}</span>
      <span>{saved.active ? 'Siguiendo' : 'Seguir'}</span>
    </button>
  )
}

export function CreatorProfileHelpfulButton({ creator }) {
  const helpful = useCreatorInteraction({ action:'helpful', targetType:'creator', targetId:creator.id, baseCount:creator.helpful_count })
  return (
    <button type="button" className={`creator-profile-helpful${helpful.active ? ' is-active' : ''}`} onClick={helpful.toggle} aria-pressed={helpful.active}>
      <span aria-hidden="true">{helpful.active ? '❤️' : '🤍'}</span>
      <span>Me ayudó</span>
      {helpful.count > 0 && <strong>{helpful.count}</strong>}
    </button>
  )
}

export function CreatorProfileTabs({ active = 'personal', creator = null, compact = false }) {
  const location = useLocation()
  const creatorTarget = creator ? '/creadores/mi-perfil' : '/creadores/alta'
  const creatorState = creator ? undefined : { from:`${location.pathname}${location.search}${location.hash}` }

  return (
    <nav className={`creator-profile-tabs${compact ? ' is-compact' : ''}`} aria-label="Cambiar tipo de perfil">
      <Link
        to="/perfil"
        className={active === 'personal' ? 'is-active' : ''}
        aria-current={active === 'personal' ? 'page' : undefined}
      >
        <span aria-hidden="true">👤</span>
        <span>Mi perfil</span>
      </Link>
      <Link
        to={creatorTarget}
        state={creatorState}
        className={active === 'creator' ? 'is-active' : ''}
        aria-current={active === 'creator' ? 'page' : undefined}
      >
        <span aria-hidden="true">🎙️</span>
        <span>Perfil de creador</span>
        {!creator && <small>Crear</small>}
      </Link>
    </nav>
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
      role="img"
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
        overflow:'hidden',
      }}
    >
      {creator?.avatar_url
        ? <img src={creator.avatar_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
        : initials || '?'
      }
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
        maxWidth:'100%',
        padding:compact ? '5px 8px' : '7px 11px',
        color:'#1E3A8A',
        background:'#EEF2FF',
        border:'1px solid #E0E7FF',
        borderRadius:compact ? 8 : 10,
        fontFamily:PP,
        fontWeight:700,
        fontSize:compact ? 9 : 10,
        lineHeight:1.2,
        whiteSpace:'nowrap',
      }}
    >
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
  const visibleTopics = (creator.topics || []).slice(0, 1)
  const remainingTopics = Math.max(0, (creator.topics || []).length - visibleTopics.length)

  useEffect(() => {
    trackCreatorImpression(creator.id, 'profile', creator.id)
  }, [creator.id])

  return (
    <article className="creator-community-card creator-directory-card">
      <Link className="creator-community-card__open" to={`/creadores/${creator.slug}`}>
        <span className="creator-community-card__media">
          {creator.avatar_url ? (
            <img src={creator.avatar_url} alt="" loading="lazy" decoding="async" />
          ) : (
            <span className="creator-community-card__fallback">
              <CreatorAvatar creator={creator} size={88} />
            </span>
          )}
          {creator.demo && <small>DEMO</small>}
        </span>

        <span className="creator-community-card__body">
          <span className="creator-community-card__name">
            <strong>{creator.name}</strong>
            {creator.verified && <span className="creator-community-card__verification" title="Perfil verificado por Latido" aria-label="Perfil verificado por Latido">✓</span>}
          </span>
          <span className="creator-community-card__handle">{formatCreatorHandle(creator.handle)}</span>
          <span className="creator-community-card__tagline">{creator.tagline}</span>

          <span className="creator-community-card__topics">
            {visibleTopics.map(topicId => <span key={topicId}>{getCreatorTopic(topicId).label}</span>)}
            {remainingTopics > 0 && <small>+{remainingTopics}</small>}
          </span>

          <span className="creator-community-card__location">
            📍 {creator.city || creator.reach || 'Toda Suiza'}{creator.canton ? `, ${creator.canton}` : ''}
          </span>
        </span>
      </Link>

      <span className="creator-community-card__footer">
        <span title={`${publishedCount} ${publishedCount === 1 ? 'publicación' : 'publicaciones'}`}>🎬 {publishedCount}</span>
        <CreatorFollowButton creator={creator} />
      </span>
    </article>
  )
}

export function CreatorContentCard({ content, creator, onDemoOpen, compact = false }) {
  const topic = getCreatorTopic(content.topic)
  const thumbnailUrl = getCreatorThumbnailUrl(content)
  useEffect(() => {
    trackCreatorImpression(creator.id, 'content', content.id)
  }, [content.id, creator.id])
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
        <span className="creator-content-card__emoji">{topic.emoji}</span>
        {thumbnailUrl && <img className="creator-content-card__thumbnail" src={thumbnailUrl} alt="" loading="lazy" decoding="async" onError={event => event.currentTarget.remove()} />}
        <span className="creator-content-card__platform"><CreatorPlatformBadge platformId={content.platform} /></span>
        <span className="creator-content-card__play">▶</span>
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
          <CreatorHelpfulButton content={content} compact />
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
  const helpful = useCreatorInteraction({ action:'helpful', targetType:'content', targetId:content.id, baseCount:content.helpful_count })
  useEffect(() => {
    trackCreatorImpression(creator.id, 'content', content.id)
  }, [content.id, creator.id])
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
        </span>
        <span className="creator-app-content-card__body">
          <span className="creator-app-content-card__creator">
            <CreatorAvatar creator={creator} size={20} />
            <span>{creator.name}</span>
            {creator.verified && <span className="creator-confirmed creator-confirmed--tiny">✓</span>}
          </span>
          <strong>{content.title}</strong>
          <span className="creator-app-content-card__helpful">{helpful.active ? '❤️' : '🤍'} {helpful.count} Me ayudó</span>
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
              <span>{formatCreatorHandle(creator.handle)} · {getCreatorPlatform(content.platform).label}</span>
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
