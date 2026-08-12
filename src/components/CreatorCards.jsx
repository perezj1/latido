import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { BadgeCheck, Check, ChevronRight, Ellipsis, EllipsisVertical, Heart, Share2, UserRound } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useOverlayHistory } from '../hooks/useOverlayHistory'
import {
  getCreatorInteractionState,
  getCreatorVideoEmbed,
  CREATOR_VIDEO_IFRAME_PERMISSIONS,
  getCreatorPlatform,
  getCreatorThumbnailUrl,
  getCreatorTopic,
  resolveCreatorVideoEmbed,
  subscribeCreatorInteractions,
  toggleCreatorInteraction,
  trackCreatorImpression,
  trackCreatorMetric,
} from '../lib/creators'
import { C, PP } from '../lib/theme'
import { ChevronLeftIcon } from './UI'
import ReportButton from './ReportButton'

const PLAYABLE_CONTENT_PLATFORMS = new Set(['youtube', 'tiktok', 'instagram', 'spotify'])
const VIDEO_CAROUSEL_PLATFORMS = new Set(['youtube', 'tiktok', 'instagram'])

function getCreatorContentEntryKey(content, creator) {
  return `${creator?.id || creator?.slug || ''}:${content?.id || ''}`
}

function normalizeCreatorVideoPlaylist(playlist, content, creator) {
  const fallback = content && creator ? [{ content, creator }] : []
  const candidates = Array.isArray(playlist) && playlist.length ? playlist : fallback
  const uniqueEntries = []
  const seen = new Set()

  candidates.forEach(entry => {
    const normalized = entry?.content && entry?.creator
      ? { ...entry, content:entry.content, creator:entry.creator }
      : entry?.id && creator ? { content:entry, creator } : null
    if (!normalized?.content || !normalized?.creator) return
    const key = getCreatorContentEntryKey(normalized.content, normalized.creator)
    if (seen.has(key)) return
    seen.add(key)
    uniqueEntries.push(normalized)
  })

  const videos = uniqueEntries.filter(entry => VIDEO_CAROUSEL_PLATFORMS.has(entry.content.platform))
  const selectedKey = getCreatorContentEntryKey(content, creator)
  return videos.some(entry => getCreatorContentEntryKey(entry.content, entry.creator) === selectedKey)
    ? videos
    : fallback
}

function useCreatorInteraction({ action, targetType, targetId, baseCount = 0 }) {
  const { user } = useAuth()
  const actorId = user?.id || ''
  const readState = () => getCreatorInteractionState({ action, targetType, targetId, actorId, baseCount })
  const [state, setState] = useState(readState)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const sync = () => setState(readState())
    sync()
    return subscribeCreatorInteractions(sync)
  }, [action, actorId, baseCount, targetId, targetType])

  const toggle = async () => {
    if (!actorId) {
      toast('Inicia sesión para guardar esta valoración.', { icon:'🔐' })
      return state
    }
    if (busy) return state
    setBusy(true)
    try {
      const next = await toggleCreatorInteraction({ action, targetType, targetId, actorId, baseCount })
      setState(next)
      return next
    } catch (error) {
      toast.error(error?.message || 'No se pudo guardar esta valoración')
      return state
    } finally {
      setBusy(false)
    }
  }

  return { ...state, busy, toggle }
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
  const shareUrl = content.url || profileUrl
  const data = { title:content.title, text:`${content.title} · ${creator.name}`, url:shareUrl }

  try {
    if (navigator.share) await navigator.share(data)
    else {
      await navigator.clipboard.writeText(shareUrl)
      toast.success('Enlace copiado')
    }
    trackCreatorMetric(creator.id, 'content_share', content.id)
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
            title="Reportar este contenido"
            label="Reportar"
            compact
            allowOwnContent
            onOpen={() => setOpen(false)}
            metadata={{ creator_id:creator.id, creator_name:creator.name, content_title:content.title, external_url:content.url }}
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

  const handleFollow = async () => {
    if (!user?.id) {
      toast('Inicia sesión para seguir creadores y encontrarlos después en tu perfil.', { icon:'+' })
      navigate(`/auth?next=${encodeURIComponent(`/creadores/${creator.slug}`)}`)
      return
    }
    const wasFollowing = saved.active
    const next = await saved.toggle()
    if (next.active === wasFollowing) return
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
  const creatorTarget = creator?.slug ? `/creadores/${creator.slug}` : '/creadores/alta'
  const creatorState = creator ? undefined : { from:`${location.pathname}${location.search}${location.hash}` }

  return (
    <nav className={`creator-profile-tabs${compact ? ' is-compact' : ''}`} aria-label="Cambiar tipo de perfil">
      <Link
        to="/perfil"
        className={active === 'personal' ? 'is-active' : ''}
        aria-current={active === 'personal' ? 'page' : undefined}
      >
        <span aria-hidden="true">👤</span>
        <span>Perfil de Latido</span>
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

export function getCreatorInitials(creator) {
  return String(creator?.name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || '?'
}

export function CreatorAvatar({ creator, size = 72, compact = false, showVerified = true, verifiedBadgeSize = null }) {
  const initials = getCreatorInitials(creator)
  const isVerified = Boolean(creator?.verified && showVerified)
  const responsiveBadgeSize = size <= 20
    ? 10
    : size <= 32
      ? 13
      : size <= 48
        ? 15
        : Math.min(26, Math.round(size * 0.25))
  const badgeSize = verifiedBadgeSize ?? responsiveBadgeSize
  const badgeBorder = badgeSize <= 10 ? 1 : 2
  const compactBadge = badgeSize < 15

  return (
    <span
      role="img"
      aria-label={`${creator?.name || 'Creador'}${isVerified ? ', perfil verificado por Latido' : ''}`}
      style={{
        position:'relative',
        width:size,
        height:size,
        flex:`0 0 ${size}px`,
        display:'inline-grid',
        placeItems:'center',
        overflow:'visible',
      }}
    >
      <span
        aria-hidden="true"
        style={{
        display:'grid',
        width:'100%',
        height:'100%',
        borderRadius:'50%',
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
          ? <img src={creator.avatar_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center', display:'block' }} />
          : initials || '?'
        }
      </span>
      {isVerified && (
        <span
          aria-hidden="true"
          title="Perfil verificado por Latido"
          style={{
            position:'absolute',
            right:size < 49 ? -2 : -1,
            bottom:size < 49 ? 2 : Math.max(3, Math.round(size * 0.03)),
            zIndex:2,
            display:'grid',
            width:badgeSize,
            height:badgeSize,
            boxSizing:'border-box',
            color:'#fff',
            background:'#2563EB',
            border:`${badgeBorder}px solid #fff`,
            borderRadius:'50%',
            boxShadow:size < 32 ? '0 1px 4px rgba(15,23,42,.22)' : '0 3px 8px rgba(15,23,42,.24)',
            placeItems:'center',
          }}
        >
          {compactBadge
            ? <Check size={Math.max(5, badgeSize - (badgeBorder * 2))} strokeWidth={3.2} />
            : <BadgeCheck size={Math.max(9, badgeSize - (badgeBorder * 2) - 1)} strokeWidth={2.5} />}
        </span>
      )}
    </span>
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
          <CreatorAvatar creator={creator} size={84} />
        </span>
        <CreatorProfileHelpfulMetric creator={creator} />

        <span className="creator-community-card__body">
          <span className="creator-community-card__name">
            <strong>{creator.name}</strong>
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

export function CreatorContentCard({ content, creator, onContentOpen, compact = false }) {
  const navigate = useNavigate()
  const topic = getCreatorTopic(content.topic)
  const thumbnailUrl = getCreatorThumbnailUrl(content)
  const helpful = useCreatorInteraction({ action:'helpful', targetType:'content', targetId:content.id, baseCount:content.helpful_count })
  useEffect(() => {
    trackCreatorImpression(creator.id, 'content', content.id)
  }, [content.id, creator.id])
  const handleOpen = () => {
    trackCreatorMetric(creator.id, 'content_click', content.id)
    if (onContentOpen) {
      onContentOpen(content, creator)
      return
    }
    navigate(`/creadores/${creator.slug}?contenido=${encodeURIComponent(content.id)}`)
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
          <CreatorAvatar creator={creator} size={28} verifiedBadgeSize={9} />
          <span>{creator.name}</span>
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

export function CreatorAppContentCard({ content, creator, onContentOpen, discovery=false, editor=false, managementActions=null }) {
  const navigate = useNavigate()
  const topic = getCreatorTopic(content.topic)
  const platform = getCreatorPlatform(content.platform)
  const thumbnailUrl = getCreatorThumbnailUrl(content)
  // Play solo en plataformas de video o audio. Una web o un articulo abren su
  // pagina, y ponerles play prometeria una reproduccion que no ocurre.
  const isPlayable = PLAYABLE_CONTENT_PLATFORMS.has(content.platform)
  const helpful = useCreatorInteraction({ action:'helpful', targetType:'content', targetId:content.id, baseCount:content.helpful_count })
  useEffect(() => {
    if (!editor) trackCreatorImpression(creator.id, 'content', content.id)
  }, [content.id, creator.id, editor])
  const handleOpen = () => {
    if (!editor) trackCreatorMetric(creator.id, 'content_click', content.id)
    if (onContentOpen) {
      onContentOpen(content, creator)
      return
    }
    navigate(`/creadores/${creator.slug}?contenido=${encodeURIComponent(content.id)}`)
  }

  if (discovery) {
    return (
      <article className="creator-app-content-card creator-app-content-card--home">
        <button type="button" className="creator-home-content-card__main" onClick={handleOpen} aria-label={`Ver ${content.title}`}>
          <span className="creator-home-content-card__media" style={{ '--content-color':topic.color, '--content-bg':topic.bg }}>
            <span className="creator-home-content-card__emoji">{topic.emoji}</span>
            {thumbnailUrl && <img className="creator-home-content-card__thumbnail" src={thumbnailUrl} alt="" loading="lazy" decoding="async" onError={event => event.currentTarget.remove()} />}
            {isPlayable && <span className="creator-home-content-card__play" aria-hidden="true">▶</span>}
          </span>
          <span className="creator-home-content-card__copy">
            <strong>{content.title}</strong>
            <span className="creator-home-content-card__byline">
              <CreatorAvatar creator={creator} size={18} compact verifiedBadgeSize={8} />
              <span className="creator-home-content-card__identity">
                <span>{creator.name}</span>
                <span aria-hidden="true"> · </span>
                <span style={{ color:platform.color }}>{platform.label}</span>
              </span>
            </span>
          </span>
        </button>
        {managementActions || <CreatorHomeContentActions helpful={helpful} content={content} creator={creator} />}
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
          <CreatorAvatar creator={creator} size={20} verifiedBadgeSize={8} />
          <span>{creator.name}</span>
        </span>
        {managementActions || <CreatorContentActions helpful={helpful} content={content} creator={creator} onOpen={handleOpen} />}
      </div>
    </article>
  )
}

export function CreatorContentModal({ content, creator, playlist=[], onClose }) {
  const closeRef = useRef(null)
  useOverlayHistory(Boolean(content && creator), onClose)
  const playlistEntries = useMemo(
    () => normalizeCreatorVideoPlaylist(playlist, content, creator),
    [content, creator, playlist],
  )
  const [activeIndex, setActiveIndex] = useState(0)
  const activeEntry = playlistEntries[activeIndex] || playlistEntries[0] || { content, creator }
  const activeContent = activeEntry?.content
  const activeCreator = activeEntry?.creator
  const topic = getCreatorTopic(activeContent?.topic)
  const thumbnailUrl = getCreatorThumbnailUrl(activeContent)
  const directEmbed = getCreatorVideoEmbed(activeContent)
  const [resolvedEmbed, setResolvedEmbed] = useState(null)
  const [resolvingEmbed, setResolvingEmbed] = useState(false)
  const embed = directEmbed || resolvedEmbed
  const platform = getCreatorPlatform(embed?.platform || activeContent?.platform)
  const hasPrevious = activeIndex > 0
  const hasNext = activeIndex < playlistEntries.length - 1
  const hasPlaylist = playlistEntries.length > 1
  // Va antes del return temprano de abajo para no romper el orden de hooks.
  const helpful = useCreatorInteraction({
    action:'helpful',
    targetType:'content',
    targetId:activeContent?.id,
    baseCount:activeContent?.helpful_count,
  })

  const goToIndex = nextIndex => {
    if (nextIndex < 0 || nextIndex >= playlistEntries.length || nextIndex === activeIndex) return
    const nextEntry = playlistEntries[nextIndex]
    if (!nextEntry?.content || !nextEntry?.creator) return
    trackCreatorMetric(nextEntry.creator.id, 'content_click', nextEntry.content.id)
    trackCreatorImpression(nextEntry.creator.id, 'content', nextEntry.content.id)
    setActiveIndex(nextIndex)
  }

  useEffect(() => {
    if (!content || !creator) return
    const selectedKey = getCreatorContentEntryKey(content, creator)
    const selectedIndex = playlistEntries.findIndex(entry => (
      getCreatorContentEntryKey(entry.content, entry.creator) === selectedKey
    ))
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0)
  }, [content, creator, playlistEntries])

  useEffect(() => {
    setResolvedEmbed(null)
    if (!activeContent || directEmbed) {
      setResolvingEmbed(false)
      return undefined
    }

    const controller = new AbortController()
    setResolvingEmbed(true)
    resolveCreatorVideoEmbed(activeContent, { signal:controller.signal })
      .then(result => {
        if (result) setResolvedEmbed(result)
      })
      .catch(error => {
        if (error?.name !== 'AbortError') setResolvedEmbed(null)
      })
      .finally(() => {
        if (!controller.signal.aborted) setResolvingEmbed(false)
      })

    return () => controller.abort()
  }, [activeContent, directEmbed?.src])

  useEffect(() => {
    if (!content || !creator) return undefined
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = event => {
      if (event.key === 'Escape') onClose?.()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)
    closeRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [content, creator, onClose])

  useEffect(() => {
    if (!hasPlaylist) return undefined
    const navigateWithKeyboard = event => {
      if (event.key === 'ArrowDown') goToIndex(activeIndex + 1)
      if (event.key === 'ArrowUp') goToIndex(activeIndex - 1)
    }
    window.addEventListener('keydown', navigateWithKeyboard)
    return () => window.removeEventListener('keydown', navigateWithKeyboard)
  }, [activeIndex, hasPlaylist, playlistEntries])

  if (!activeContent || !activeCreator) return null

  return (
    <div className="creator-modal-backdrop latido-overlay-backdrop creator-modal-backdrop--video" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget) onClose?.()
    }}>
      <section
        className="creator-preview-modal latido-modal-panel creator-video-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${activeContent.title} en ${platform.label}`}
      >
        {resolvingEmbed ? (
          <div className="creator-video-modal__player creator-video-modal__loading" role="status">
            <span>Preparando vídeo de {platform.label}…</span>
          </div>
        ) : embed ? (
          <div className={`creator-video-modal__player${embed.vertical ? ' is-vertical' : ''} is-${embed.platform}`}>
            <iframe
              key={embed.src}
              src={embed.src}
              title={`${activeContent.title} en ${platform.label}`}
              {...CREATOR_VIDEO_IFRAME_PERMISSIONS}
              lang="es"
              referrerPolicy="strict-origin-when-cross-origin"
              scrolling="no"
            />
            {hasPlaylist && (
              <>
                <button
                  type="button"
                  className="creator-video-modal__carousel-arrow is-previous"
                  onClick={() => goToIndex(activeIndex - 1)}
                  disabled={!hasPrevious}
                  aria-label="Vídeo anterior"
                >
                  <ChevronLeftIcon size={19} />
                </button>
                <button
                  type="button"
                  className="creator-video-modal__carousel-arrow is-next"
                  onClick={() => goToIndex(activeIndex + 1)}
                  disabled={!hasNext}
                  aria-label="Vídeo siguiente"
                >
                  <ChevronRight aria-hidden="true" size={19} strokeWidth={2.2} />
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="creator-preview-modal__visual creator-video-modal__fallback" style={{ '--content-color':topic.color, '--content-bg':topic.bg }}>
            <span>{topic.emoji}</span>
            {thumbnailUrl && <img className="creator-preview-modal__thumbnail" src={thumbnailUrl} alt="" onError={event => event.currentTarget.remove()} />}
            <span className="creator-preview-modal__play">▶</span>
          </div>
        )}
        <div className="creator-video-modal__footer">
          <div className="creator-video-modal__footer-actions">
            <button
              ref={closeRef}
              type="button"
              className="creator-video-modal__back"
              onClick={onClose}
              aria-label="Volver"
            >
              <ChevronLeftIcon size={18} />
            </button>
            <button
              type="button"
              className={`creator-video-modal__helpful${helpful.active ? ' is-active' : ''}`}
              onClick={helpful.toggle}
              aria-label="Me ayudó"
              aria-pressed={helpful.active}
            >
              <HeartOutlineIcon active={helpful.active} />
              {helpful.count > 0 && <span>{helpful.count}</span>}
            </button>
            <Link
              className="creator-video-modal__profile"
              to={`/creadores/${activeCreator.slug}`}
              onClick={onClose}
              aria-label={`Ver el perfil de ${activeCreator.name} en Latido`}
            >
              <ProfileOutlineIcon />
            </Link>
            <a
              className="creator-video-modal__open"
              href={activeContent.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Ver en {platform.label}
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
