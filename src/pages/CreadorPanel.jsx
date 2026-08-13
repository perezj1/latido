import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Check, ChevronDown, ChevronRight, ChevronUp, Trash2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { Btn, ChevronLeftIcon, EmptyState, IconButton, ImageUploadField, Input } from '../components/UI'
import {
  CreatorAppContentCard,
  CreatorAvatar,
  CreatorContentModal,
  CreatorTopicPill,
} from '../components/CreatorCards'
import {
  CREATOR_FEATURED_CONTENTS,
  CREATOR_TOPICS,
  detectCreatorFormat,
  detectCreatorPlatform,
  formatCreatorHandle,
  getCreatorContentsNewestFirst,
  getCreatorFeaturedContentIds,
  getCreatorDirectoryState,
  getCreatorForUser,
  getCreatorOEmbedMetadata,
  getCreatorPlatform,
  getCreatorProfileCompleteness,
  getCreatorThumbnailUrl,
  getCreatorTopic,
  getFeaturedCreatorContents,
  normalizeCreatorUrl,
  removeCreatorContent,
  resolveTikTokVideo,
  saveCreatorContent,
  setCreatorContentFeatured,
  subscribeCreatorUpdates,
} from '../lib/creators'
import { getStorageErrorMessage, uploadPublicationImage } from '../lib/storage'
import { analyzeContent, getContentFilterMessage } from '../lib/contentFilter'
import { addModerationQueueItem } from '../lib/reports'
import { C, PP } from '../lib/theme'
import './Creators.css'

const EMPTY_CONTENT = {
  id:'',
  title:'',
  summary:'',
  url:'',
  video_id:'',
  resolved_url:'',
  embed_url:'',
  platform:'youtube',
  format:'video',
  topic:'tramites',
  canton:'Toda Suiza',
  duration:'',
  thumbnail_url:'',
  thumbnail_kind:'',
  position:1,
  status:'published',
}

const CONTENT_LIMITS = {
  title:{ min:15, max:100 },
  summary:{ min:40, max:300 },
}

function focusFirstError(errors) {
  const firstKey = Object.keys(errors)[0]
  if (!firstKey) return
  window.setTimeout(() => {
    const field = document.querySelector(`[data-error-field="${firstKey}"]`)
    field?.scrollIntoView({ behavior:'smooth', block:'center' })
    field?.querySelector('input,textarea,select,button')?.focus({ preventScroll:true })
  }, 40)
}

export default function CreadorPanel() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [creator, setCreator] = useState(() => getCreatorForUser(user?.id))
  const [directoryState, setDirectoryState] = useState(getCreatorDirectoryState)
  const [contentForm, setContentForm] = useState(EMPTY_CONTENT)
  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [contentErrors, setContentErrors] = useState({})
  const [processingThumbnail, setProcessingThumbnail] = useState(false)
  const [fetchingMetadata, setFetchingMetadata] = useState(false)
  const [preview, setPreview] = useState(null)
  const [completedChecksOpen, setCompletedChecksOpen] = useState(false)

  const refresh = () => setCreator(getCreatorForUser(user?.id))
  const publishedContents = getCreatorContentsNewestFirst(creator).filter(content => content.status === 'published')
  const featuredContents = getFeaturedCreatorContents(creator)
  const featuredContentIds = getCreatorFeaturedContentIds(creator)
  const featuredContentIdSet = new Set(featuredContentIds)
  const completeness = getCreatorProfileCompleteness(creator)
  const completedProfileChecks = completeness.checks.filter(check => check.done)
  const pendingProfileChecks = completeness.checks.filter(check => !check.done)
  const publishPlatform = getCreatorPlatform(contentForm.platform)
  const publishTopic = getCreatorTopic(contentForm.topic)
  const publishThumbnail = getCreatorThumbnailUrl(contentForm)
  const hasValidContentUrl = Boolean(normalizeCreatorUrl(contentForm.url))

  useEffect(() => {
    const sync = () => {
      setCreator(getCreatorForUser(user?.id))
      setDirectoryState(getCreatorDirectoryState())
    }
    sync()
    return subscribeCreatorUpdates(sync)
  }, [user?.id])

  useEffect(() => {
    if (searchParams.get('created') !== '1') return
    toast('Tu perfil ya aparece en el directorio. Ahora añade tu primer contenido.', {
      id:'creator-profile-created',
      icon:'🎉',
      duration:5000,
    })
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('created')
    setSearchParams(nextParams, { replace:true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    const contentId = searchParams.get('editContent')
    if (!creator || !contentId) return

    const content = getCreatorContentsNewestFirst(creator).find(item => String(item.id) === contentId)
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('editContent')
    setSearchParams(nextParams, { replace:true })

    if (!content) {
      toast.error('No se encontró el contenido que quieres editar')
      return
    }

    setContentForm({ ...EMPTY_CONTENT, ...content, position:content.sort_order || 1 })
    setContentErrors({})
    setFormOpen(true)
  }, [creator, searchParams, setSearchParams])

  useEffect(() => {
    const platform = detectCreatorPlatform(contentForm.url)
    if (!formOpen || !['youtube', 'tiktok'].includes(platform)) return undefined
    const normalizedUrl = normalizeCreatorUrl(contentForm.url)
    if (!normalizedUrl) return undefined

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setFetchingMetadata(true)
      try {
        const metadata = await getCreatorOEmbedMetadata(normalizedUrl, { signal:controller.signal })
        if (!metadata) return
        setContentForm(current => {
          if (current.url !== contentForm.url) return current
          const next = { ...current }
          if (!current.title.trim() && metadata.title) next.title = metadata.title.slice(0, CONTENT_LIMITS.title.max)
          if (current.thumbnail_kind !== 'custom' && metadata.thumbnail_url) {
            next.thumbnail_url = metadata.thumbnail_url
            next.thumbnail_kind = 'auto'
          }
          if (metadata.video_id) next.video_id = metadata.video_id
          if (metadata.resolved_url) next.resolved_url = metadata.resolved_url
          if (metadata.embed_url) next.embed_url = metadata.embed_url
          return next
        })
      } catch (error) {
        if (error?.name !== 'AbortError') {
          setContentForm(current => current.thumbnail_kind === 'auto'
            ? { ...current, thumbnail_url:'', thumbnail_kind:'' }
            : current)
        }
      } finally {
        if (!controller.signal.aborted) setFetchingMetadata(false)
      }
    }, 550)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [contentForm.url, formOpen])

  useEffect(() => {
    if (!formOpen) return undefined
    const previousOverflow = document.body.style.overflow
    const handleKeyDown = event => {
      if (event.key === 'Escape' && !saving) setFormOpen(false)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [formOpen, saving])

  if (!directoryState.loaded || directoryState.loading) {
    return <div className="creators-page" style={{ minHeight:'70vh', display:'grid', placeItems:'center', color:C.mid, fontFamily:PP }}>Cargando tu perfil…</div>
  }

  if (directoryState.error) {
    return (
      <div className="creators-page" style={{ display:'grid', minHeight:'70vh', placeItems:'center', padding:28 }}>
        <section style={{ width:'min(540px,100%)', padding:30, background:'#fff', border:`1px solid ${C.border}`, borderRadius:26, textAlign:'center' }}>
          <h1 style={{ margin:'0 0 8px', color:C.text, fontFamily:PP, fontSize:22 }}>No pudimos cargar tu perfil</h1>
          <p style={{ color:C.mid, fontFamily:PP, fontSize:12, lineHeight:1.7 }}>Comprueba tu conexión e inténtalo de nuevo.</p>
          <Btn onClick={() => window.location.reload()}>Reintentar</Btn>
        </section>
      </div>
    )
  }

  if (!creator) {
    return (
      <div className="creators-page" style={{ display:'grid', minHeight:'78vh', placeItems:'center', padding:28 }}>
        <section style={{ width:'min(540px,100%)', padding:30, background:'#fff', border:`1px solid ${C.border}`, borderRadius:26, textAlign:'center' }}>
          <div style={{ fontSize:44 }}>🎙️</div>
          <h1 style={{ margin:'14px 0 8px', color:C.text, fontFamily:PP, fontSize:22 }}>Crea primero tu perfil público</h1>
          <p style={{ margin:'0 auto 20px', maxWidth:430, color:C.mid, fontFamily:PP, fontSize:11.5, lineHeight:1.7 }}>Después podrás editar cada zona y gestionar tu contenido desde una vista igual a tu perfil.</p>
          <Link className="creators-primary-action" to="/creadores/alta" state={{ from:'/creadores/mi-perfil' }}>Crear mi perfil →</Link>
        </section>
      </div>
    )
  }

  const startEditContent = content => {
    setContentForm({ ...EMPTY_CONTENT, ...content, position:content.sort_order || 1 })
    setContentErrors({})
    setFormOpen(true)
  }

  const updateContent = (key, value) => {
    setContentForm(current => {
      const next = { ...current, [key]:value }
      if (key === 'url' && value.trim()) {
        next.platform = detectCreatorPlatform(value)
        next.format = detectCreatorFormat(value, next.platform)
        next.video_id = ''
        next.resolved_url = ''
        next.embed_url = ''
        if (current.thumbnail_kind === 'auto') {
          next.thumbnail_url = ''
          next.thumbnail_kind = ''
        }
      }
      return next
    })
    setContentErrors(current => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  const validateContent = () => {
    const errors = {}
    const titleLength = contentForm.title.trim().length
    const summaryLength = contentForm.summary.trim().length
    if (!contentForm.url.trim()) errors.url = 'Añade el enlace al contenido original.'
    else if (!normalizeCreatorUrl(contentForm.url)) errors.url = 'Introduce una dirección válida que empiece por https://'
    if (titleLength < CONTENT_LIMITS.title.min) errors.title = `El título necesita al menos ${CONTENT_LIMITS.title.min} caracteres.`
    else if (titleLength > CONTENT_LIMITS.title.max) errors.title = `El título admite como máximo ${CONTENT_LIMITS.title.max} caracteres.`
    if (summaryLength < CONTENT_LIMITS.summary.min) errors.summary = `El resumen necesita al menos ${CONTENT_LIMITS.summary.min} caracteres.`
    else if (summaryLength > CONTENT_LIMITS.summary.max) errors.summary = `El resumen admite como máximo ${CONTENT_LIMITS.summary.max} caracteres.`
    if (!contentForm.topic) errors.topic = 'Selecciona el tema principal.'
    setContentErrors(errors)
    focusFirstError(errors)
    return Object.keys(errors).length === 0
  }

  const handleContentSave = async () => {
    if (!validateContent()) return
    const moderation = analyzeContent(contentForm.title, contentForm.summary, contentForm.url)
    if (moderation.action === 'block') {
      toast.error(getContentFilterMessage(moderation))
      return
    }
    setSaving(true)
    try {
      const needsReview = moderation.action === 'review' || contentForm.active === false
      let contentToSave = { ...contentForm, status:'published', active:!needsReview }
      if (detectCreatorPlatform(contentForm.url) === 'tiktok' && !contentForm.video_id) {
        contentToSave = { ...contentToSave, ...(await resolveTikTokVideo(contentForm.url)) }
      }
      const savedContent = await saveCreatorContent(user.id, contentToSave)
      if (needsReview && savedContent?.id) {
        await addModerationQueueItem({
          contentType:'creator_content',
          contentId:savedContent.id,
          authorId:user.id,
          reason:'Filtro automático',
          excerpt:[contentForm.title, contentForm.summary].filter(Boolean).join('\n\n').slice(0, 700),
          matchedTerm:moderation.matchedTerm,
          metadata:{ creator_id:creator.id, platform:contentToSave.platform, external_url:contentToSave.url },
        })
      }
      refresh()
      setFormOpen(false)
      setContentForm(EMPTY_CONTENT)
      toast.success(needsReview ? 'Contenido enviado a revisión' : 'Contenido actualizado')
    } catch (error) {
      toast.error(error?.message || 'No se pudo guardar el contenido')
    } finally {
      setSaving(false)
    }
  }

  const handleThumbnail = async files => {
    const [file] = files || []
    if (!file) return
    setProcessingThumbnail(true)
    try {
      const thumbnailUrl = await uploadPublicationImage({ file, userId:user.id, folder:'creator-content' })
      setContentForm(current => ({ ...current, thumbnail_url:thumbnailUrl, thumbnail_kind:'custom' }))
      toast.success('Miniatura subida')
    } catch (error) {
      toast.error(getStorageErrorMessage(error))
    } finally {
      setProcessingThumbnail(false)
    }
  }

  const toggleFeaturedContent = async content => {
    const currentlyFeatured = featuredContentIdSet.has(String(content.id))
    try {
      await setCreatorContentFeatured(user.id, content.id, !currentlyFeatured)
      refresh()
      toast.success(currentlyFeatured ? 'Contenido retirado de destacados' : 'Contenido añadido a destacados')
    } catch (error) {
      toast.error(error?.message || 'No se pudo cambiar la selección')
    }
  }

  const removeContent = async content => {
    if (!window.confirm(`¿Eliminar “${content.title}”?`)) return
    try {
      await removeCreatorContent(user.id, content.id)
      refresh()
      toast.success('Contenido eliminado')
    } catch (error) {
      toast.error(error?.message || 'No se pudo eliminar el contenido')
    }
  }

  const managementActions = content => {
    const featured = featuredContentIdSet.has(String(content.id))
    return (
      <div className="creator-card-management-actions">
        {content.active === false && <span style={{ color:C.warn, fontSize:9, fontWeight:800 }}>En revisión</span>}
        <button
          type="button"
          className={featured ? 'is-featured' : ''}
          onClick={() => toggleFeaturedContent(content)}
          disabled={content.active === false || (!featured && featuredContentIds.length >= CREATOR_FEATURED_CONTENTS)}
          aria-label={featured ? 'Quitar de destacados' : 'Destacar contenido'}
          aria-pressed={featured}
          title={featured ? 'Quitar de destacados' : 'Destacar'}
        >
          <span aria-hidden="true">{featured ? '★' : '☆'}</span>
          <small>{featured ? 'Destacada' : 'Destacar'}</small>
        </button>
        <button type="button" onClick={() => startEditContent(content)} aria-label="Editar contenido" title="Editar">
          <span aria-hidden="true">✎</span>
        </button>
        <button type="button" className="is-danger" onClick={() => removeContent(content)} aria-label="Eliminar contenido" title="Eliminar">
          <Trash2 size={16} strokeWidth={2.4} aria-hidden="true" />
        </button>
      </div>
    )
  }

  const renderContentCard = (content, contents) => (
    <CreatorAppContentCard
      key={content.id}
      content={content}
      creator={creator}
      discovery
      editor
      managementActions={managementActions(content)}
      onContentOpen={(selectedContent, selectedCreator) => setPreview({
        content:selectedContent,
        creator:selectedCreator,
        playlist:contents.map(item => ({ content:item, creator })),
      })}
    />
  )

  return (
    <div className="creators-page creator-app-form-page creator-profile-editor-page">
      <div className="creator-public-shell creator-profile-editor-shell">
        <section className="creator-social-profile creator-social-profile--editor" style={{ '--creator-accent':creator.accent || C.primary }}>
          <div className="creator-social-profile__topbar">
            <Link to="/perfil" aria-label="Volver a Mi perfil"><ChevronLeftIcon size={20} /></Link>
            <div>
              <strong>{formatCreatorHandle(creator.handle) || creator.name}</strong>
              <span>Editor del perfil</span>
            </div>
            <span aria-hidden="true" />
          </div>

          {creator.active === false && (
            <p style={{ margin:'12px 20px 0', padding:'10px 12px', color:C.warn, background:C.warnLight, border:`1px solid ${C.warnMid}`, borderRadius:12, fontFamily:PP, fontSize:10.5, lineHeight:1.55 }}>
              Tu perfil está en revisión y todavía no es visible públicamente.
            </p>
          )}

          <div className="creator-social-profile__identity">
            <Link className="creator-inline-edit-button creator-inline-edit-button--identity" to="/creadores/alta?section=info">✎ Editar</Link>
            <div className="creator-social-profile__avatar"><CreatorAvatar creator={creator} size={98} /></div>
            <div className="creator-social-profile__name"><h1>{creator.name}</h1></div>
            <p className="creator-social-profile__location">{formatCreatorHandle(creator.handle)} · 📍 {creator.city || creator.reach}{creator.canton ? `, ${creator.canton}` : ''}</p>
            <strong className="creator-social-profile__tagline">{creator.tagline}</strong>
            <p className="creator-social-profile__bio">{creator.bio}</p>

            <div className="creator-editor-block-heading">
              <strong>Temas</strong>
              <Link to="/creadores/alta?section=topics">✎ Editar</Link>
            </div>
            <div className="creator-social-profile__topics">
              {(creator.topics || []).map(topic => <CreatorTopicPill key={topic} topicId={topic} />)}
            </div>

            <div className="creator-social-profile__stats" aria-label="Datos del perfil">
              <span><strong>{publishedContents.length}</strong><small>Contenidos</small></span>
              <span><strong>{creator.topics?.length || 0}</strong><small>Temas</small></span>
              <span><strong>{creator.socials?.length || 0}</strong><small>Redes</small></span>
            </div>

            <div className="creator-editor-main-actions">
              <button type="button" onClick={() => navigate('/publicar-contenido')}>＋ Añadir contenido</button>
            </div>

            <section className="creator-social-profile__networks" aria-labelledby="creator-editor-networks-title">
              <div className="creator-editor-block-heading">
                <h2 id="creator-editor-networks-title">Redes</h2>
                <Link to="/creadores/alta?section=networks">✎ Editar</Link>
              </div>
              <div className="creator-social-profile__network-list">
                {(creator.socials || []).map(social => {
                  const platform = getCreatorPlatform(social.platform)
                  return (
                    <a key={`${social.platform}-${social.url}`} href={social.url} target="_blank" rel="noreferrer noopener" className="creator-network-link" style={{ '--social-color':platform.color, '--social-bg':platform.bg }}>
                      <span className="creator-editor-network-symbol" aria-hidden="true">↗</span>
                      <span>{social.label || platform.label}</span>
                    </a>
                  )
                })}
              </div>
            </section>
          </div>
        </section>

        <section className="creator-profile-completeness" aria-labelledby="creator-profile-completeness-title">
          <header className="creator-profile-completeness__heading">
            <h2 id="creator-profile-completeness-title">Completa tu perfil</h2>
            <strong>{completedProfileChecks.length} de {completeness.checks.length}</strong>
          </header>
          <div
            className="creator-profile-completeness__progress"
            role="progressbar"
            aria-label="Progreso del perfil"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={completeness.percent}
          >
            {completeness.checks.map(check => <span key={check.id} className={check.done ? 'is-done' : ''} />)}
          </div>
          <div className="creator-profile-completeness__actions">
            {pendingProfileChecks.map(check => (
              <Link key={check.id} to={check.to}>
                <span className="creator-profile-completeness__status" aria-hidden="true">
                </span>
                <span>
                  <strong>{check.label}</strong>
                  <small>{check.detail}</small>
                </span>
                <ChevronRight size={17} aria-hidden="true" />
              </Link>
            ))}
            {completedProfileChecks.length > 0 && (
              <button
                type="button"
                className="creator-profile-completeness__completed-toggle"
                onClick={() => setCompletedChecksOpen(open => !open)}
                aria-expanded={completedChecksOpen}
                aria-controls="creator-profile-completed-checks"
              >
                <Check size={17} strokeWidth={2.6} aria-hidden="true" />
                <span>{completedProfileChecks.length} completado{completedProfileChecks.length === 1 ? '' : 's'}</span>
                {completedChecksOpen
                  ? <ChevronUp size={16} aria-hidden="true" />
                  : <ChevronDown size={16} aria-hidden="true" />}
              </button>
            )}
            {completedChecksOpen && completedProfileChecks.length > 0 && (
              <div id="creator-profile-completed-checks" className="creator-profile-completeness__completed-list">
                {completedProfileChecks.map(check => (
                  <Link key={check.id} to={check.to} className="is-done">
                    <span className="creator-profile-completeness__status" aria-hidden="true">
                      <Check size={17} strokeWidth={2.6} />
                    </span>
                    <span><strong>{check.label}</strong></span>
                    <ChevronRight size={17} aria-hidden="true" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="creators-section creator-profile-content-section creator-profile-featured-section creator-editor-content-section">
          <div className="creators-section__heading">
            <div><h2>Destacados</h2><p>El último contenido que destaques aparecerá primero.</p></div>
            <span className="creators-results-count">{featuredContents.length}/{CREATOR_FEATURED_CONTENTS}</span>
          </div>
          {featuredContents.length ? (
            <div className="creator-community-content creator-profile-featured-carousel no-scroll">
              <div>
                {featuredContents.map(content => renderContentCard(content, featuredContents))}
              </div>
            </div>
          ) : <EmptyState className="creators-empty" variant="card" emoji="⭐" text="Marca un contenido como destacado desde la sección Todos." />}
        </section>

        <section className="creators-section creator-profile-content-section creator-profile-all-section creator-editor-content-section">
          <div className="creators-section__heading">
            <div><h2>Todos</h2><p>El contenido añadido más recientemente aparece primero.</p></div>
            <span className="creators-results-count">{publishedContents.length} en total</span>
          </div>
          {publishedContents.length ? (
            <div className="creator-profile-six-grid">
              {publishedContents.map(content => <div key={content.id} className="creator-editor-grid-item">{renderContentCard(content, publishedContents)}</div>)}
            </div>
          ) : (
            <button type="button" className="creator-editor-empty-content" onClick={() => navigate('/publicar-contenido')}>＋ Añadir mi primer contenido</button>
          )}
        </section>

        {formOpen && (
          <div className="creator-editor-modal">
            <section
              id="creator-content-form"
              className="creator-publish-form creator-editor-publication-form"
              role="dialog"
              aria-modal="true"
              aria-labelledby="creator-editor-publication-title"
            >
              <div className="creator-publish-form__heading">
                <div><span>EDITAR CONTENIDO</span><h3 id="creator-editor-publication-title">Actualiza el vídeo o su información</h3></div>
                <IconButton size="sm" onClick={() => setFormOpen(false)} disabled={saving} label="Cerrar formulario">×</IconButton>
              </div>
              <div className="creator-publish-form__body">
                <Input label="ENLACE DEL CONTENIDO" required type="url" error={contentErrors.url} errorKey="url" value={contentForm.url} onChange={event => updateContent('url', event.target.value)} placeholder="https://youtube.com/watch?v=…" />
                {hasValidContentUrl && (
                  <div className="creator-publish-preview" aria-live="polite">
                    <div className="creator-publish-preview__media" style={{ '--preview-bg':publishTopic.bg }}>
                      <span>{publishTopic.emoji}</span>
                      {publishThumbnail && <img src={publishThumbnail} alt="Portada" onError={event => event.currentTarget.remove()} />}
                    </div>
                    <div className="creator-publish-preview__copy">
                      <span style={{ color:publishPlatform.color, background:publishPlatform.bg }}>{publishPlatform.label}</span>
                      <strong>{contentForm.title.trim() || 'Título del contenido'}</strong>
                      <small>{fetchingMetadata ? 'Leyendo el enlace…' : 'Vista previa preparada'}</small>
                    </div>
                  </div>
                )}
                <Input label="TÍTULO PARA LATIDO" required error={contentErrors.title} errorKey="title" value={contentForm.title} onChange={event => updateContent('title', event.target.value)} />
                <div data-error-field="topic" className={`creator-topic-selector${contentErrors.topic ? ' is-error' : ''}`}>
                  <label>TEMA PRINCIPAL *</label>
                  <div>
                    {CREATOR_TOPICS.map(topic => (
                      <button key={topic.id} type="button" className={contentForm.topic === topic.id ? 'is-active' : ''} onClick={() => updateContent('topic', topic.id)} aria-pressed={contentForm.topic === topic.id} style={{ '--topic-color':topic.color, '--topic-bg':topic.bg }}>
                        <span>{topic.emoji}</span>{topic.label}
                      </button>
                    ))}
                  </div>
                  {contentErrors.topic && <p>{contentErrors.topic}</p>}
                </div>
                <Input label="RESUMEN ÚTIL" required rows={3} error={contentErrors.summary} errorKey="summary" value={contentForm.summary} onChange={event => updateContent('summary', event.target.value)} />
                <ImageUploadField label="IMAGEN / MINIATURA" previewUrl={publishThumbnail} uploading={processingThumbnail || fetchingMetadata} onFilesSelected={handleThumbnail} onRemove={contentForm.thumbnail_url ? () => setContentForm(current => ({ ...current, thumbnail_url:'', thumbnail_kind:'' })) : undefined} compact />
              </div>
              <div className="creator-publish-form__actions">
                <Btn variant="secondary" disabled={saving} onClick={() => setFormOpen(false)}>Cancelar</Btn>
                <Btn loading={saving} onClick={handleContentSave}>Guardar cambios</Btn>
              </div>
            </section>
          </div>
        )}
      </div>
      <CreatorContentModal
        content={preview?.content}
        creator={preview?.creator}
        playlist={preview?.playlist}
        onClose={() => setPreview(null)}
      />
    </div>
  )
}
