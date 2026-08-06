import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Ellipsis, EllipsisVertical, Heart, Share2, UserRound } from 'lucide-react'
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

function ProfileOutlineIcon() {
  return <UserRound aria-hidden="true" size={17} strokeWidth={1.8} />
}

function HeartOutlineIcon({ active=false }) {
  return <Heart aria-hidden="true" size={18} strokeWidth={1.8} fill={active ? 'currentColor' : 'none'} />
}

function ShareOutlineIcon() {
  return <Share2 aria-hidden="true" size={18} strokeWidth={1.8} />
}

async function shareCreatorContent(content, creator) {
  const profileUrl = `${window.location.origin}/creadores/${creator.slug}`
  const shareUrl = content.demo ? profileUrl : content.url || profileUrl
  const data = { title:content.title, text:`${content.title} · ${creator.name}`, url:shareUrl }

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

function CreatorContentActions({ helpful, content, creator, onOpen }) {
  const toggleHelpful = () => {
    try {
      helpful.toggle()
    } catch {
      toast.error('No se pudo guardar esta valoración')
    }
  }

  return (
    <div className="creator-content-actions">
      <button type="button" className={`creator-content-actions__helpful${helpful.active ? ' is-active' : ''}`} onClick={toggleHelpful} aria-label="Me ayudó" aria-pressed={helpful.active}>
        <HeartOutlineIcon active={helpful.active} />
        {helpful.count > 0 && <span>{helpful.count}</span>}
      </button>
      <button type="button" className="creator-content-actions__share" onClick={() => shareCreatorContent(content, creator)} aria-label="Compartir">
        <ShareOutlineIcon />
      </button>
      <button type="button" className="creator-content-actions__open" onClick={onOpen} aria-label={`Abrir ${content.title}`}>
        VER
      </button>
    </div>
  )
}

function CreatorContentMenu({ content, creator, className='', inline=false }) {
  const menuRef = useRef(null)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

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

  return (
    <div ref={menuRef} className={`creator-content-menu${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        className={`creator-content-menu__trigger${inline ? ' is-inline' : ''}`}
        onClick={() => setOpen(current => !current)}
        aria-label="Más opciones"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {inline
          ? <Ellipsis aria-hidden="true" size={19} strokeWidth={2} />
          : <EllipsisVertical aria-hidden="true" size={19} strokeWidth={2} />}
      </button>
      <div className={`creator-content-menu__popover${open ? ' is-open' : ''}`} role="menu" aria-hidden={!open}>
          <button type="button" role="menuitem" onClick={() => {
            setOpen(false)
            navigate(`/creadores/${creator.slug}`)
          }}>
            <span><ProfileOutlineIcon /></span>
            <span>Ver perfil</span>
          </button>
          <span className="creator-content-menu__divider" role="separator" />
          <ReportButton
            contentType="creator_content"
            contentId={content.id}
            ownerId={creator.owner_id}
            title="Reportar esta publicación"
            label="Reportar"
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

function CreatorHomeContentActions({ helpful, content, creator }) {
  const toggleHelpful = () => {
    try {
      helpful.toggle()
    } catch {
      toast.error('No se pudo guardar esta valoración')
    }
  }

  return (
    <div className="creator-home-content-actions">
      <button type="button" className={`creator-home-content-actions__helpful${helpful.active ? ' is-active' : ''}`} onClick={toggleHelpful} aria-label="Me ayudó" aria-pressed={helpful.active}>
        <HeartOutlineIcon active={helpful.active} />
        {helpful.count > 0 && <span>{helpful.count}</span>}
      </button>
      <button type="button" onClick={() => shareCreatorContent(content, creator)} aria-label="Compartir">
        <ShareOutlineIcon />
      </button>
      <CreatorContentMenu content={content} creator={creator} className="creator-content-menu--home" inline />
    </div>
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

export function CreatorProfileHelpfulMetric({ creator }) {
  const helpful = useCreatorInteraction({ action:'helpful', targetType:'creator', targetId:creator.id, baseCount:creator.helpful_count })
  return (
    <span className="creator-community-card__helpful-metric">
      <span aria-hidden="true">{helpful.active ? '❤️' : '🤍'}</span>
      <span>{helpful.count} Me ayudó</span>
    </span>
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

export function CreatorAvatar({ creator, size = 72, compact = false }) {
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
        border:compact ? '1.5px solid #fff' : '3px solid #fff',
        boxShadow:compact ? '0 2px 6px rgba(15,23,42,.14)' : '0 8px 22px rgba(15,23,42,.16)',
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
    <span style={{ display:'inline-flex', alignItems:'center', padding:'5px 8px', borderRadius:999, background:platform.bg, color:platform.color, fontFamily:PP, fontWeight:800, fontSize:9, lineHeight:1 }}>
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
        <CreatorProfileHelpfulMetric creator={creator} />

        <span className="creator-community-card__body">
          <span className="creator-community-card__name">
            <strong>{creator.name}</strong>
            {creator.verified && <span className="creator-community-card__verification" title="Perfil verificado por Latido" aria-label="Perfil verificado por Latido">✓</span>}
          </span>
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
        <CreatorProfileHelpfulButton creator={creator} />
        <CreatorFollowButton creator={creator} />
      </span>
    </article>
  )
}

export function CreatorContentCard({ content, creator, onDemoOpen, compact = false }) {
  const topic = getCreatorTopic(content.topic)
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
      </button>

      <div className="creator-content-card__body">
        <h3>{content.title}</h3>
        <div className="creator-content-card__creator">
          <CreatorAvatar creator={creator} size={28} />
          <span>{creator.name}</span>
          {creator.verified && <span className="creator-confirmed creator-confirmed--small">✓</span>}
        </div>
        {!compact && <p>{content.summary}</p>}
        <div className="creator-content-card__footer">
          <CreatorTopicPill topicId={content.topic} compact />
          <span>{formatDate(content.published_at)}</span>
        </div>
        <CreatorContentActions helpful={helpful} content={content} creator={creator} onOpen={handleOpen} />
      </div>
    </article>
  )
}

export function CreatorAppContentCard({ content, creator, onDemoOpen, discovery=false }) {
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

  if (discovery) {
    return (
      <article className="creator-app-content-card creator-app-content-card--home">
        <button type="button" className="creator-home-content-card__main" onClick={handleOpen} aria-label={`Ver ${content.title}`}>
          <span className="creator-home-content-card__media" style={{ '--content-color':topic.color, '--content-bg':topic.bg }}>
            <span className="creator-home-content-card__emoji">{topic.emoji}</span>
            {thumbnailUrl && <img className="creator-home-content-card__thumbnail" src={thumbnailUrl} alt="" loading="lazy" decoding="async" onError={event => event.currentTarget.remove()} />}
            {content.duration && <span className="creator-home-content-card__duration">{content.duration}</span>}
          </span>
          <span className="creator-home-content-card__copy">
            <strong>{content.title}</strong>
            <span className="creator-home-content-card__byline">
              <CreatorAvatar creator={creator} size={18} compact />
              <span className="creator-home-content-card__identity">
                <span>{creator.name}</span>
                <span aria-hidden="true"> · </span>
                <span style={{ color:platform.color }}>{platform.label}</span>
              </span>
            </span>
          </span>
        </button>
        <CreatorHomeContentActions helpful={helpful} content={content} creator={creator} />
      </article>
    )
  }

  return (
    <article className="creator-app-content-card">
      <CreatorContentMenu content={content} creator={creator} className="creator-content-menu--app" />
      <button type="button" className="creator-app-content-card__media" style={{ '--content-color':topic.color, '--content-bg':topic.bg }} onClick={handleOpen} aria-label={`Ver ${content.title}`}>
          <span className="creator-app-content-card__emoji">{topic.emoji}</span>
          {thumbnailUrl && <img className="creator-app-content-card__thumbnail" src={thumbnailUrl} alt="" loading="lazy" decoding="async" onError={event => event.currentTarget.remove()} />}
          <span className="creator-app-content-card__platform"><CreatorPlatformBadge platformId={content.platform} /></span>
      </button>
      <div className="creator-app-content-card__body">
        <strong>{content.title}</strong>
        <span className="creator-app-content-card__creator">
          <CreatorAvatar creator={creator} size={20} />
          <span>{creator.name}</span>
          {creator.verified && <span className="creator-confirmed creator-confirmed--tiny">✓</span>}
        </span>
        <CreatorContentActions helpful={helpful} content={content} creator={creator} onOpen={handleOpen} />
      </div>
    </article>
  )
}

export function DemoContentModal({ content, creator, onClose }) {
  if (!content || !creator) return null
  const topic = getCreatorTopic(content.topic)
  const thumbnailUrl = getCreatorThumbnailUrl(content)

  return (
    <div className="creator-modal-backdrop latido-overlay-backdrop" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget) onClose?.()
    }}>
      <section className="creator-preview-modal latido-modal-panel" role="dialog" aria-modal="true" aria-labelledby="creator-preview-title">
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
