import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Ellipsis, Pencil, Star, Trash2 } from 'lucide-react'
import { ChevronLeftIcon } from '../components/UI'
import { useAuth } from '../hooks/useAuth'
import {
  CREATOR_FEATURED_CONTENTS,
  getAllCreators,
  getCreatorBySlug,
  getCreatorFeaturedContentIds,
  getCreatorDirectoryState,
  getCreatorForUser,
  getCreatorMetrics,
  formatCreatorHandle,
  getCreatorHelpfulCount,
  getCreatorHelpRank,
  getCreatorContentsNewestFirst,
  getFeaturedCreatorContents,
  getCreatorPlatform,
  removeCreatorContent,
  setCreatorContentFeatured,
  subscribeCreatorUpdates,
  trackCreatorMetric,
} from '../lib/creators'
import {
  CreatorAvatar,
  CreatorAppContentCard,
  CreatorCard,
  CreatorFollowButton,
  CreatorProfileHelpfulButton,
  CreatorTopicPill,
  CreatorContentModal,
} from '../components/CreatorCards'
import { C, PP } from '../lib/theme'
import { Icon } from '../lib/icons'
import ReportButton from '../components/ReportButton'
import './Creators.css'

const creatorMetricFormatter = new Intl.NumberFormat('es-CH', {
  notation:'compact',
  maximumFractionDigits:1,
})

function CreatorOwnerContentControls({
  content,
  metrics,
  featured,
  featureDisabled,
  onEdit,
  onToggleFeatured,
  onRemove,
}) {
  const menuRef = useRef(null)
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

  const helpful = Math.max(0, Number(metrics?.helpful) || 0)
  const runAction = action => {
    setOpen(false)
    action()
  }

  return (
    <div className="creator-card-management-actions">
      {content.active === false && <span className="creator-card-management-actions__review">En revisión</span>}
      <div className="creator-owner-content-metrics" aria-label={`${helpful} personas indicaron que este contenido les ayudó`}>
        <span title={`${helpful.toLocaleString('es-CH')} Me ayudó`}>
          <Icon name="favoriteActive" size={14} color="#E11D48" />
          <strong>{creatorMetricFormatter.format(helpful)}</strong>
          <small>Me ayudó</small>
        </span>
      </div>
      <div ref={menuRef} className="creator-content-menu creator-owner-content-menu">
        <button
          type="button"
          className="creator-content-menu__trigger is-inline"
          onClick={() => setOpen(current => !current)}
          aria-label="Gestionar contenido"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <Ellipsis size={19} strokeWidth={2.2} aria-hidden="true" />
        </button>
        <div className={`creator-content-menu__popover${open ? ' is-open' : ''}`} role="menu" aria-hidden={!open}>
          <button type="button" role="menuitem" onClick={() => runAction(onEdit)}>
            <span><Pencil size={15} strokeWidth={2} aria-hidden="true" /></span>
            <span>Editar</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className={featured ? 'is-featured' : ''}
            onClick={() => runAction(onToggleFeatured)}
            disabled={featureDisabled}
          >
            <span><Star size={15} strokeWidth={2} fill={featured ? 'currentColor' : 'none'} aria-hidden="true" /></span>
            <span>{featured ? 'Quitar de destacados' : 'Destacar'}</span>
          </button>
          <span className="creator-content-menu__divider" role="separator" />
          <button type="button" role="menuitem" className="is-danger" onClick={() => runAction(onRemove)}>
            <span><Trash2 size={15} strokeWidth={2.2} aria-hidden="true" /></span>
            <span>Borrar</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function CreatorNetworkIcon({ platformId }) {
  if (platformId === 'youtube') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="6" width="19" height="12" rx="4" fill="currentColor" /><path d="m10 9 5 3-5 3Z" fill="#fff" /></svg>
  }
  if (platformId === 'instagram') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="4.5" width="15" height="15" rx="4.5" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="12" r="3.4" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="17.1" cy="6.9" r="1.1" fill="currentColor" /></svg>
  }
  if (platformId === 'facebook') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.6 21v-7h2.7l.4-3h-3.1V9.1c0-.9.3-1.5 1.6-1.5H17V4.9c-.5-.1-1.4-.2-2.4-.2-2.5 0-4.2 1.5-4.2 4.3v2H7.6v3h2.8v7Z" fill="currentColor" /></svg>
  }
  if (platformId === 'tiktok') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.4 4.2c.5 2.2 1.7 3.6 4 4.1v3.1a8.4 8.4 0 0 1-4-1.2v5.3a5.7 5.7 0 1 1-5.7-5.7h.8V13a2.6 2.6 0 1 0 1.7 2.5V4.2Z" fill="currentColor" /></svg>
  }
  if (platformId === 'linkedin') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="9.5" width="3.3" height="10.5" rx=".6" fill="currentColor" /><circle cx="5.65" cy="5.8" r="1.9" fill="currentColor" /><path d="M10 9.5h3.2v1.4c.8-1.1 2-1.8 3.6-1.8 3 0 3.7 2 3.7 4.7V20h-3.3v-5.5c0-1.3 0-2.9-1.8-2.9s-2.1 1.4-2.1 2.8V20H10Z" fill="currentColor" /></svg>
  }
  if (platformId === 'spotify') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9.2c4.7-1.4 10.3-.9 14.1 1.2M6.1 13c3.9-1.1 8.7-.7 11.9 1M7.1 16.6c3.2-.8 7-.5 9.6.8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M4.5 12h15M12 4c2.3 2.2 3.5 4.9 3.5 8S14.3 17.8 12 20c-2.3-2.2-3.5-4.9-3.5-8S9.7 6.2 12 4Z" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
}

export default function CreadorPerfil() {
  const { creatorSlug } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedContentId = searchParams.get('contenido')
  const { user } = useAuth()
  const [creator, setCreator] = useState(() => getCreatorBySlug(creatorSlug))
  const [directoryState, setDirectoryState] = useState(getCreatorDirectoryState)
  const [preview, setPreview] = useState(null)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const profileMenuRef = useRef(null)

  useEffect(() => {
    const sync = () => {
      setCreator(getCreatorBySlug(creatorSlug))
      setDirectoryState(getCreatorDirectoryState())
    }
    sync()
    return subscribeCreatorUpdates(sync)
  }, [creatorSlug])

  useEffect(() => {
    if (creator?.id && creator.owner_id !== user?.id) trackCreatorMetric(creator.id, 'profile_view')
  }, [creator?.id, creator?.owner_id, user?.id])

  useEffect(() => {
    if (!creator || !requestedContentId) return
    const contents = getCreatorContentsNewestFirst(creator, { publishedOnly:true })
    const content = contents.find(item => String(item.id) === requestedContentId)
    if (content) setPreview({
      content,
      creator,
      playlist:contents.map(item => ({ content:item, creator })),
    })
  }, [creator, requestedContentId])

  useEffect(() => {
    if (!profileMenuOpen) return undefined
    const closeOutside = event => {
      if (!profileMenuRef.current?.contains(event.target)) setProfileMenuOpen(false)
    }
    const closeOnEscape = event => {
      if (event.key === 'Escape') setProfileMenuOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [profileMenuOpen])

  const relatedCreators = useMemo(() => {
    if (!creator) return []
    return getAllCreators()
      .filter(item => item.id !== creator.id && item.topics?.some(topic => creator.topics?.includes(topic)))
      .slice(0, 2)
  }, [creator])

  if (!directoryState.loaded || directoryState.loading) {
    return <div className="creators-page" style={{ minHeight:'70vh', display:'grid', placeItems:'center', color:C.mid, fontFamily:PP }}>Cargando perfil…</div>
  }

  if (!creator || creator.status !== 'published' || creator.active === false) {
    return (
      <div className="creators-page" style={{ display:'grid', minHeight:'70vh', placeItems:'center', padding:'30px' }}>
        <div style={{ maxWidth:480, padding:28, textAlign:'center', background:'#fff', border:`1px solid ${C.border}`, borderRadius:24 }}>
          <div style={{ display:'flex', justifyContent:'center', color:C.light }}><Icon name="creator" size={42} /></div>
          <h1 style={{ fontFamily:PP, fontSize:22, color:C.text }}>Este perfil no está disponible</h1>
          <p style={{ fontFamily:PP, fontSize:12, lineHeight:1.7, color:C.mid }}>Puede estar todavía en borrador o haber cambiado de dirección.</p>
          <Link className="creators-primary-action" to="/creadores">Volver a creadores</Link>
        </div>
      </div>
    )
  }

  const publishedContents = getCreatorContentsNewestFirst(creator, { publishedOnly:true })
  const featuredContents = getFeaturedCreatorContents(creator)
  const featuredContentIds = getCreatorFeaturedContentIds(creator)
  const featuredContentIdSet = new Set(featuredContentIds)
  const helpfulCount = getCreatorHelpfulCount(creator)
  const helpRank = getCreatorHelpRank(creator)
  const viewerCreator = getCreatorForUser(user?.id)
  const isOwner = Boolean(user?.id && creator.owner_id === user.id)
  const creatorMetrics = getCreatorMetrics(creator)

  const handleSocialClick = (_event, social) => {
    trackCreatorMetric(creator.id, 'social_click', social.platform)
  }

  const handleShare = async () => {
    const url = window.location.href
    const data = { title:`${creator.name} en Latido`, text:creator.tagline, url }
    try {
      if (navigator.share) await navigator.share(data)
      else {
        await navigator.clipboard.writeText(url)
        toast.success('Enlace copiado')
      }
    } catch {}
  }

  const closePreview = () => {
    setPreview(null)
    if (!requestedContentId) return
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('contenido')
    setSearchParams(nextParams, { replace:true })
  }

  const toggleFeaturedContent = async content => {
    const currentlyFeatured = featuredContentIdSet.has(String(content.id))
    try {
      await setCreatorContentFeatured(user.id, content.id, !currentlyFeatured)
      setCreator(getCreatorBySlug(creatorSlug))
      toast.success(currentlyFeatured ? 'Contenido retirado de destacados' : 'Contenido añadido a destacados')
    } catch (error) {
      toast.error(error?.message || 'No se pudo cambiar la selección')
    }
  }

  const removeContent = async content => {
    if (!window.confirm(`¿Eliminar “${content.title}”?`)) return
    try {
      await removeCreatorContent(user.id, content.id)
      setCreator(getCreatorBySlug(creatorSlug))
      toast.success('Contenido eliminado')
    } catch (error) {
      toast.error(error?.message || 'No se pudo eliminar el contenido')
    }
  }

  const managementActions = content => {
    const featured = featuredContentIdSet.has(String(content.id))
    return (
      <CreatorOwnerContentControls
        content={content}
        metrics={creatorMetrics.byContent[content.id]}
        featured={featured}
        featureDisabled={content.active === false || (!featured && featuredContentIds.length >= CREATOR_FEATURED_CONTENTS)}
        onEdit={() => navigate(`/creadores/mi-perfil?editContent=${encodeURIComponent(content.id)}`)}
        onToggleFeatured={() => toggleFeaturedContent(content)}
        onRemove={() => removeContent(content)}
      />
    )
  }

  const renderContentCard = (content, contents) => (
    <CreatorAppContentCard
      key={content.id}
      content={content}
      creator={creator}
      discovery
      editor={isOwner}
      managementActions={isOwner ? managementActions(content) : null}
      onContentOpen={(selectedContent, selectedCreator) => setPreview({
        content:selectedContent,
        creator:selectedCreator,
        playlist:contents.map(item => ({ content:item, creator })),
      })}
    />
  )

  return (
    <div className="creators-page creator-app-form-page">
      <div className="creator-public-shell" style={{ paddingTop:22 }}>
        <section className="creator-social-profile" style={{ '--creator-accent':creator.accent || C.primary }}>
          <div className="creator-social-profile__topbar">
            <Link to="/comunidades?view=creadores" aria-label="Volver a Creadores"><ChevronLeftIcon size={20} /></Link>
            <div>
              <strong>{formatCreatorHandle(creator.handle) || creator.name}</strong>
              <span>Perfil en Latido</span>
            </div>
            {!isOwner && (
              <div ref={profileMenuRef} className="creator-profile-menu">
                <button type="button" className="creator-profile-menu__trigger" onClick={() => setProfileMenuOpen(current => !current)} aria-label="Más opciones del perfil" aria-haspopup="menu" aria-expanded={profileMenuOpen}><Icon name="more" size={18} /></button>
                <div className={`creator-profile-menu__popover${profileMenuOpen ? ' is-open' : ''}`} role="menu" aria-hidden={!profileMenuOpen}>
                  <ReportButton
                    contentType="creator_profile"
                    contentId={creator.id}
                    ownerId={creator.owner_id}
                    title="Reportar este perfil"
                    label="Reportar perfil"
                    compact
                    onOpen={() => setProfileMenuOpen(false)}
                    metadata={{ creator_name:creator.name, creator_slug:creator.slug, creator_handle:creator.handle }}
                    style={{ width:'100%', justifyContent:'flex-start', padding:'9px 10px', color:'#DC2626', background:'transparent', border:'none', borderRadius:9, fontSize:10.5 }}
                  />
                </div>
              </div>
            )}
            {isOwner && <span className="creator-social-profile__menu-spacer" />}
          </div>

          <div className="creator-social-profile__identity">
            <div className="creator-social-profile__avatar"><CreatorAvatar creator={creator} size={98} showVerified /></div>
            <div className="creator-social-profile__name">
              <h1>{creator.name}</h1>
            </div>
            <p className="creator-social-profile__location">{formatCreatorHandle(creator.handle)} · <Icon name="location" size={12} /> {creator.city || creator.reach}{creator.canton ? `, ${creator.canton}` : ''}</p>
            <strong className="creator-social-profile__tagline">{creator.tagline}</strong>
            <p className="creator-social-profile__bio">{creator.bio}</p>

            <div className="creator-social-profile__topics">
              {(creator.topics || []).map(topic => <CreatorTopicPill key={topic} topicId={topic} />)}
            </div>

            {/* Lo que mide de verdad a un creador en Latido: a cuánta gente ha
                ayudado y qué puesto ocupa por ello. */}
            <div className="creator-social-profile__impact">
              <span
                className="creator-impact-help"
                title={`${helpfulCount} ${helpfulCount === 1 ? 'persona ayudada' : 'personas ayudadas'}`}
              >
                <span aria-hidden="true"><Icon name="favoriteActive" size={15} color="#E11D48" /></span>
                <strong>{helpfulCount.toLocaleString('es-CH')}</strong>
              </span>
              {helpRank > 0 && (
                <span className="creator-impact-rank" title="Puesto en Creadores que más ayudan">
                  <span aria-hidden="true"><Icon name="trophy" size={15} /></span>
                  <strong>#{helpRank}</strong>
                </span>
              )}
            </div>

            <div className="creator-social-profile__stats" aria-label="Datos del perfil">
              <span><strong>{publishedContents.length}</strong><small>Contenidos</small></span>
              <span><strong>{creator.topics?.length || 0}</strong><small>Temas</small></span>
              <span><strong>{creator.socials?.length || 0}</strong><small>Redes</small></span>
            </div>

            <div className={`creator-social-profile__main-action${isOwner ? ' is-owner' : ''}`}>
              {!isOwner ? <CreatorFollowButton creator={creator} /> : <Link className="creator-owner-add-content" to="/publicar-contenido"><span aria-hidden="true"><Icon name="add" size={15} /></span> Añadir contenido</Link>}
              {isOwner && <Link className="creator-owner-edit-profile" to="/creadores/mi-perfil"><span aria-hidden="true"><Icon name="edit" size={15} /></span> Editar mi perfil</Link>}
              {!isOwner && <CreatorProfileHelpfulButton creator={creator} />}
              <button type="button" className="creator-profile-share" onClick={handleShare}><span aria-hidden="true"><Icon name="share" size={15} /></span><span>Compartir</span></button>
            </div>

            {(creator.socials || []).length > 0 && (
              <section className="creator-social-profile__networks" aria-labelledby="creator-profile-networks-title">
                <h2 id="creator-profile-networks-title">Redes</h2>
                <div className="creator-social-profile__network-list">
                  {(creator.socials || []).map(social => {
                    const platform = getCreatorPlatform(social.platform)
                    return (
                      <a
                        key={`${social.platform}-${social.url}`}
                        href={social.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        onClick={event => handleSocialClick(event, social)}
                        className="creator-network-link"
                        style={{ '--social-color':platform.color, '--social-bg':platform.bg }}
                        aria-label={`Abrir ${social.label || platform.label}`}
                      >
                        <span className={`creator-network-link__icon is-${platform.id}`}>
                          <CreatorNetworkIcon platformId={platform.id} />
                        </span>
                        <span>{social.label || platform.label}</span>
                      </a>
                    )
                  })}
                </div>
              </section>
            )}
          </div>
        </section>

        <section className="creators-section creator-profile-content-section creator-profile-featured-section">
          <div className="creators-section__heading">
            <div>
              <h2>Destacados</h2>
              <p>La selección personal de {creator.name}.</p>
            </div>
            <span className="creators-results-count">{featuredContents.length} destacados</span>
          </div>
          {featuredContents.length ? (
            <div className="creator-community-content creator-profile-featured-carousel no-scroll">
              <div>
                {featuredContents.map(content => renderContentCard(content, featuredContents))}
              </div>
            </div>
          ) : (
            <div className="creators-empty">Este perfil todavía no ha añadido contenido.</div>
          )}
        </section>

        {/* Los destacados son una seleccion, no un limite: aqui esta todo lo publicado,
            en rejilla y sin desplazamiento lateral. */}
        {publishedContents.length > 0 && (
          <section className="creators-section creator-profile-content-section creator-profile-all-section">
            <div className="creators-section__heading">
              <div>
                <h2>Todos</h2>
                <p>Todo el contenido de {creator.name} en Latido.</p>
              </div>
              <span className="creators-results-count">{publishedContents.length} en total</span>
            </div>
            <div className="creator-profile-six-grid">
              {publishedContents.map(content => renderContentCard(content, publishedContents))}
            </div>
          </section>
        )}

        {relatedCreators.length > 0 && (
          <section className="creators-section">
            <div className="creators-section__heading">
              <div>
                <h2>También te puede interesar</h2>
                <p>Otras personas y proyectos que comparten temas parecidos.</p>
              </div>
            </div>
            <div className="creators-grid">
              {relatedCreators.map(item => <CreatorCard key={item.id} creator={item} />)}
            </div>
          </section>
        )}

        {!viewerCreator && (
          <section className="creator-public-profile__cta creator-public-section-inset" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:20, marginTop:10, padding:'22px 24px', background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:22 }}>
            <div>
              <strong style={{ display:'block', marginBottom:4, fontFamily:PP, color:'#102A5C', fontSize:14 }}>¿También compartes sobre Suiza en tus redes?</strong>
              <span style={{ fontFamily:PP, color:C.mid, fontSize:10.5 }}>Puedes mostrar experiencias, información, tu profesión, trabajo, proyecto o negocio. No hace falta ser creador profesional.</span>
            </div>
            <Link className="creators-primary-action" to="/creadores/alta" style={{ flexShrink:0 }}>Crear mi perfil</Link>
          </section>
        )}
      </div>

      <CreatorContentModal
        content={preview?.content}
        creator={preview?.creator}
        playlist={preview?.playlist}
        onClose={closePreview}
      />
    </div>
  )
}
