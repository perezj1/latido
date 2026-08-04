import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import { Btn, ImageUploadField, Input } from '../components/UI'
import { CreatorAvatar, CreatorProfileTabs } from '../components/CreatorCards'
import {
  CREATOR_MAX_CONTENTS,
  CREATOR_TOPICS,
  detectCreatorPlatform,
  formatCreatorHandle,
  getCreatorForUser,
  getCreatorMetrics,
  getCreatorOEmbedMetadata,
  getCreatorPlatform,
  getCreatorProfileCompleteness,
  getCreatorThumbnailUrl,
  getCreatorTopic,
  getOrderedCreatorContents,
  moveCreatorContent,
  normalizeCreatorUrl,
  removeCreatorContent,
  resetCreatorPrototype,
  saveCreatorContent,
  subscribeCreatorInteractions,
} from '../lib/creators'
import { C, PP } from '../lib/theme'
import './Creators.css'

const EMPTY_CONTENT = {
  id:'',
  title:'',
  summary:'',
  url:'',
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

function detectCreatorFormat(value, platform) {
  const url = String(value || '').toLowerCase()
  if (platform === 'tiktok') return 'reel'
  if (platform === 'instagram') return url.includes('/reel') ? 'reel' : 'publicacion'
  if (platform === 'spotify') return 'podcast'
  if (platform === 'web') return 'artículo'
  if (platform === 'facebook' || platform === 'linkedin') return 'publicacion'
  return 'video'
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

function prepareLocalThumbnail(file) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith('image/')) {
      reject(new Error('Selecciona una imagen JPG, PNG o WebP.'))
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      reject(new Error('La imagen pesa más de 10 MB. Elige una más ligera.'))
      return
    }

    const objectUrl = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 960
      canvas.height = 540
      const context = canvas.getContext('2d')
      const scale = Math.max(canvas.width / image.width, canvas.height / image.height)
      const width = image.width * scale
      const height = image.height * scale
      context.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height)
      URL.revokeObjectURL(objectUrl)
      resolve(canvas.toDataURL('image/webp', .76))
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('No se pudo leer la imagen seleccionada.'))
    }
    image.src = objectUrl
  })
}

function formatDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin fecha'
  return date.toLocaleDateString('es-CH', { day:'2-digit', month:'short', year:'numeric' })
}

export default function CreadorPanel() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [creator, setCreator] = useState(() => getCreatorForUser(user?.id))
  const [contentForm, setContentForm] = useState(EMPTY_CONTENT)
  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [contentErrors, setContentErrors] = useState({})
  const [processingThumbnail, setProcessingThumbnail] = useState(false)
  const [fetchingMetadata, setFetchingMetadata] = useState(false)
  const [metricsVersion, setMetricsVersion] = useState(0)

  const refresh = () => setCreator(getCreatorForUser(user?.id))
  const metrics = useMemo(() => getCreatorMetrics(creator), [creator, metricsVersion])
  const completeness = useMemo(() => getCreatorProfileCompleteness(creator), [creator])
  const contents = getOrderedCreatorContents(creator)
  const publishPlatform = getCreatorPlatform(contentForm.platform)
  const publishTopic = getCreatorTopic(contentForm.topic)
  const publishThumbnail = getCreatorThumbnailUrl(contentForm)
  const hasValidContentUrl = Boolean(normalizeCreatorUrl(contentForm.url))

  useEffect(() => {
    if (searchParams.get('created') === '1') {
      toast('Tu perfil ya aparece en el directorio de este navegador. Ahora añade tu primera publicación.', { id:'creator-profile-created', icon:'🎉', duration:5000 })
      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('created')
      setSearchParams(nextParams, { replace:true })
    }
  }, [searchParams, setSearchParams])

  useEffect(() => subscribeCreatorInteractions(() => setMetricsVersion(current => current + 1)), [])

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
          return next
        })
        if (metadata.title && !contentForm.title.trim()) {
          setContentErrors(current => {
            if (!current.title) return current
            const next = { ...current }
            delete next.title
            return next
          })
        }
      } catch (error) {
        if (error?.name !== 'AbortError') {
          setContentForm(current => current.thumbnail_kind === 'auto' ? { ...current, thumbnail_url:'', thumbnail_kind:'' } : current)
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

  if (!creator) {
    return (
      <div className="creators-page" style={{ display:'grid', minHeight:'78vh', placeItems:'center', padding:'28px' }}>
        <section style={{ width:'min(540px,100%)', padding:30, background:'#fff', border:`1px solid ${C.border}`, borderRadius:26, boxShadow:'0 18px 48px rgba(30,64,175,.1)', textAlign:'center' }}>
          <div style={{ display:'grid', width:70, height:70, margin:'0 auto 18px', placeItems:'center', color:'#fff', background:'linear-gradient(145deg,#2563EB,#102A5C)', borderRadius:22, fontSize:30 }}>🎙️</div>
          <span className="creator-demo-label">ESPACIO DEL CREADOR · PROTOTIPO</span>
          <h1 style={{ margin:'16px 0 8px', color:'#102A5C', fontFamily:PP, fontSize:24, letterSpacing:-.5 }}>Crea primero tu perfil público</h1>
          <p style={{ margin:'0 auto 20px', maxWidth:430, color:C.mid, fontFamily:PP, fontSize:11.5, lineHeight:1.7 }}>El alta tarda unos minutos. Puedes participar como persona, profesional, proyecto o negocio si compartes sobre Suiza en redes.</p>
          <Link className="creators-primary-action" to="/creadores/alta" state={{ from:'/creadores/mi-perfil' }}>Crear mi perfil →</Link>
          <Link to="/creadores" style={{ display:'block', marginTop:14, color:C.primary, fontFamily:PP, fontSize:10.5, fontWeight:700, textDecoration:'none' }}>Ver antes el directorio</Link>
        </section>
      </div>
    )
  }

  const startNewContent = () => {
    if (contents.length >= CREATOR_MAX_CONTENTS) {
      toast.error(`Ya estás usando los ${CREATOR_MAX_CONTENTS} espacios. Puedes editar o eliminar uno.`)
      return
    }
    setContentForm({ ...EMPTY_CONTENT, position:contents.length + 1 })
    setContentErrors({})
    setFormOpen(true)
    window.setTimeout(() => document.getElementById('creator-content-form')?.scrollIntoView({ behavior:'smooth', block:'start' }), 40)
  }

  const startEditContent = content => {
    const position = Math.max(1, contents.findIndex(item => item.id === content.id) + 1)
    setContentForm({ ...EMPTY_CONTENT, ...content, position })
    setContentErrors({})
    setFormOpen(true)
    window.setTimeout(() => document.getElementById('creator-content-form')?.scrollIntoView({ behavior:'smooth', block:'start' }), 40)
  }

  const updateContent = (key, value) => {
    setContentForm(current => {
      const next = { ...current, [key]:value }
      if (key === 'url' && value.trim()) {
        next.platform = detectCreatorPlatform(value)
        next.format = detectCreatorFormat(value, next.platform)
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

  const validateContent = status => {
    const errors = {}
    const titleLength = contentForm.title.trim().length
    const summaryLength = contentForm.summary.trim().length
    const isDraft = status === 'draft'

    if (!isDraft || contentForm.url.trim()) {
      if (!contentForm.url.trim()) errors.url = 'Añade el enlace a la publicación original.'
      else if (!normalizeCreatorUrl(contentForm.url)) errors.url = 'Introduce una dirección válida, por ejemplo https://youtube.com/watch?v=…'
    }

    if (!titleLength) errors.title = 'Escribe un título para identificar esta publicación.'
    else if (titleLength < (isDraft ? 3 : CONTENT_LIMITS.title.min)) errors.title = isDraft
      ? `El título necesita al menos 3 caracteres para guardar el borrador (llevas ${titleLength}).`
      : `El título necesita al menos ${CONTENT_LIMITS.title.min} caracteres (llevas ${titleLength}).`
    else if (titleLength > CONTENT_LIMITS.title.max) errors.title = `El título admite como máximo ${CONTENT_LIMITS.title.max} caracteres (llevas ${titleLength}).`

    if (!isDraft || summaryLength) {
      if (!summaryLength) errors.summary = 'Explica brevemente qué encontrará la persona al abrir la publicación.'
      else if (summaryLength < CONTENT_LIMITS.summary.min) errors.summary = `El resumen necesita al menos ${CONTENT_LIMITS.summary.min} caracteres (llevas ${summaryLength}).`
      else if (summaryLength > CONTENT_LIMITS.summary.max) errors.summary = `El resumen admite como máximo ${CONTENT_LIMITS.summary.max} caracteres (llevas ${summaryLength}).`
    }

    if (!contentForm.topic) errors.topic = 'Selecciona el tema principal.'

    setContentErrors(errors)
    focusFirstError(errors)
    return Object.keys(errors).length === 0
  }

  const handleContentSave = status => {
    if (!validateContent(status)) return

    setSaving(true)
    try {
      saveCreatorContent(user.id, { ...contentForm, status })
      refresh()
      setFormOpen(false)
      setContentForm(EMPTY_CONTENT)
      setContentErrors({})
      toast.success(status === 'draft' ? 'Borrador guardado' : contentForm.id ? 'Publicación actualizada' : 'Publicación añadida al perfil')
    } catch (error) {
      toast.error(error?.message || 'No se pudo guardar la publicación')
    } finally {
      setSaving(false)
    }
  }

  const handleThumbnail = async files => {
    const [file] = files
    if (!file) return
    setProcessingThumbnail(true)
    try {
      const thumbnailUrl = await prepareLocalThumbnail(file)
      setContentForm(current => ({ ...current, thumbnail_url:thumbnailUrl, thumbnail_kind:'custom' }))
      toast.success('Miniatura preparada')
    } catch (error) {
      toast.error(error?.message || 'No se pudo preparar la miniatura')
    } finally {
      setProcessingThumbnail(false)
    }
  }

  const clearThumbnail = () => setContentForm(current => ({ ...current, thumbnail_url:'', thumbnail_kind:'' }))

  const moveContent = (content, direction) => {
    moveCreatorContent(user.id, content.id, direction)
    refresh()
    toast.success(direction === 'up' ? 'Publicación movida hacia arriba' : 'Publicación movida hacia abajo')
  }

  const removeContent = content => {
    if (!window.confirm(`¿Eliminar “${content.title}”? Esta acción solo afecta al prototipo guardado en este navegador.`)) return
    removeCreatorContent(user.id, content.id)
    refresh()
    toast.success('Publicación eliminada')
  }

  const resetPrototype = () => {
    if (!window.confirm('¿Borrar tu perfil y todas sus publicaciones de prueba de este navegador?')) return
    resetCreatorPrototype(user.id)
    setCreator(null)
    toast.success('Prototipo reiniciado')
  }

  return (
    <div className="creators-page creator-dashboard-page">
      <div className="creator-studio-shell creator-dashboard-shell">
        <section className="creator-dashboard-hero">
          <span className="creator-dashboard-hero__orb creator-dashboard-hero__orb--top" />
          <span className="creator-dashboard-hero__orb creator-dashboard-hero__orb--bottom" />

          <CreatorAvatar creator={creator} size={88} />
          <h1>{creator.name}</h1>
          {creator.handle && <p className="creator-dashboard-hero__handle">{formatCreatorHandle(creator.handle)}</p>}
          <p className="creator-dashboard-hero__tagline">{creator.tagline}</p>
          <div className="creator-dashboard-hero__location">
            📍 {creator.city || creator.reach}{creator.canton ? ` · ${creator.canton}` : ''}
          </div>

          <div className="creator-dashboard-hero__stats" aria-label="Resumen del perfil de creador">
            <div><strong>{contents.length}</strong><span>🎬 Publicaciones</span></div>
            <div><strong>{metrics.profileViews}</strong><span>👁️ Visitas</span></div>
            <div><strong>{metrics.helpfulReceived}</strong><span>❤️ Me ayudó</span></div>
          </div>

          <CreatorProfileTabs active="creator" creator={creator} compact />
        </section>

        <section className="creator-dashboard-actions">
          <p>MI PERFIL DE CREADOR</p>
          <div>
            <Link to="/creadores/alta" state={{ from:'/creadores/mi-perfil' }}>
              <span>✏️</span>
              <span><strong>Editar perfil</strong><small>Foto, presentación, temas y redes sociales</small></span>
              <b>›</b>
            </Link>
            <Link to={`/creadores/${creator.slug}`}>
              <span>👁️</span>
              <span><strong>Ver perfil público</strong><small>Comprueba cómo te ve la comunidad</small></span>
              <b>›</b>
            </Link>
          </div>
        </section>

        <div className="creator-prototype-notice">
          <span>🧪</span>
          <div>
            <strong>Estás probando la experiencia sin tocar la base de datos real.</strong>
            <p>El perfil, las publicaciones y las métricas se guardan únicamente en este navegador. Puedes recorrer todo el flujo y reiniciarlo cuando termines.</p>
          </div>
        </div>

        <p className="creator-dashboard-section-label">ESTADÍSTICAS PRIVADAS</p>
        <section className="creator-studio-metrics" aria-label="Métricas del perfil">
          <div><span>Visitas al perfil</span><strong>{metrics.profileViews}</strong><small>registradas en esta prueba</small></div>
          <div><span>Impresiones</span><strong>{metrics.contentImpressions}</strong><small>veces que apareció tu selección</small></div>
          <div><span>Clics a publicaciones</span><strong>{metrics.contentClicks}</strong><small>{metrics.clickRate}% de las impresiones</small></div>
          <div><span>Me ayudó</span><strong>{metrics.helpfulReceived}</strong><small>en tu perfil y publicaciones</small></div>
          <div><span>Seguimientos</span><strong>{metrics.saved}</strong><small>solo visible en tu panel</small></div>
          <div><span>Clics a redes</span><strong>{metrics.socialClicks}</strong><small>desde tu perfil público</small></div>
        </section>

        <section className="creator-profile-completeness" aria-label="Estado del perfil">
          <div>
            <span>PERFIL {completeness.percent}% COMPLETO</span>
            <strong>{completeness.percent === 100 ? 'Tu perfil está listo para que Latido lo revise' : 'Completa tu perfil para generar más confianza'}</strong>
            <small>Los rangos de audiencia que indiques son privados y nunca se muestran en tu perfil.</small>
          </div>
          <div className="creator-profile-completeness__progress"><span style={{ width:`${completeness.percent}%` }} /></div>
          <ul>
            {completeness.checks.map(check => <li key={check.id} className={check.done ? 'is-done' : ''}>{check.done ? '✓' : '○'} {check.label}</li>)}
          </ul>
        </section>

        <section className="creator-studio-content-section">
          <div className="creators-section__heading">
            <div>
              <h2>Los 6: tu selección personal</h2>
              <p>Elige y ordena hasta seis enlaces que representen tu experiencia, trabajo, proyecto o negocio.</p>
            </div>
            <button type="button" className="creators-primary-action" onClick={startNewContent} disabled={contents.length >= CREATOR_MAX_CONTENTS}>+ Añadir publicación</button>
          </div>

          {formOpen && (
            <div id="creator-content-form" className="creator-publish-form">
              <div className="creator-publish-form__heading">
                <div>
                  <span>{contentForm.id ? 'EDITAR PUBLICACIÓN' : `NUEVA PUBLICACIÓN · ESPACIO ${contents.length + 1} DE ${CREATOR_MAX_CONTENTS}`}</span>
                  <h3>{contentForm.id ? 'Actualiza la ficha y su enlace' : 'Comparte una experiencia, información o parte de tu trabajo'}</h3>
                </div>
                <button type="button" onClick={() => setFormOpen(false)} aria-label="Cerrar formulario">×</button>
              </div>

              <div className="creator-publish-form__body">
                <section className="creator-publish-step" aria-labelledby="creator-link-step">
                  <div className="creator-publish-step__heading">
                    <span>1</span>
                    <div><strong id="creator-link-step">Pega el enlace</strong><small>Latido detectará la plataforma y la portada.</small></div>
                  </div>
                  <Input label="ENLACE DE LA PUBLICACIÓN" required type="url" error={contentErrors.url} errorKey="url" value={contentForm.url} onChange={event => updateContent('url', event.target.value)} placeholder="https://youtube.com/watch?v=…" />

                  {hasValidContentUrl && (
                    <div className="creator-publish-preview" aria-live="polite">
                      <div className="creator-publish-preview__media" style={{ '--preview-bg':publishTopic.bg }}>
                        <span>{publishTopic.emoji}</span>
                        {publishThumbnail && <img src={publishThumbnail} alt="Portada detectada" onError={event => event.currentTarget.remove()} />}
                      </div>
                      <div className="creator-publish-preview__copy">
                        <span style={{ color:publishPlatform.color, background:publishPlatform.bg }}>{publishPlatform.short} · {publishPlatform.label}</span>
                        <strong>{contentForm.title.trim() || 'Completa el título para Latido'}</strong>
                        <small>{fetchingMetadata ? 'Leyendo el enlace…' : publishThumbnail ? 'Portada preparada' : 'Añade una portada'}</small>
                      </div>
                    </div>
                  )}
                </section>

                <section className="creator-publish-step" aria-labelledby="creator-details-step">
                  <div className="creator-publish-step__heading">
                    <span>2</span>
                    <div><strong id="creator-details-step">Completa lo esencial</strong><small>Un título claro, el tema principal y un resumen útil.</small></div>
                  </div>

                  <Input label="TÍTULO PARA LATIDO" required error={contentErrors.title} errorKey="title" value={contentForm.title} onChange={event => updateContent('title', event.target.value)} placeholder="Ej. Cómo preparar la solicitud del permiso B" />
                  <p className={`creator-field-count${contentErrors.title ? ' is-error' : ''}`}>{contentForm.title.trim().length}/{CONTENT_LIMITS.title.max} caracteres · mínimo {CONTENT_LIMITS.title.min} para publicar</p>

                  <div className="creator-publish-thumbnail">
                    <ImageUploadField
                      label="IMAGEN / MINIATURA"
                      hint={publishThumbnail
                        ? (contentForm.thumbnail_kind === 'custom' ? 'Imagen seleccionada. Puedes cambiarla o quitarla.' : 'Portada detectada automáticamente. Puedes sustituirla si lo necesitas.')
                        : fetchingMetadata ? 'Buscando la portada…' : 'Para Instagram y plataformas sin portada automática, selecciona una imagen horizontal.'}
                      previewUrl={publishThumbnail}
                      uploading={processingThumbnail || fetchingMetadata}
                      onFilesSelected={handleThumbnail}
                      onRemove={contentForm.thumbnail_url ? clearThumbnail : undefined}
                      compact
                    />
                  </div>

                  <div data-error-field="topic" className={`creator-topic-selector${contentErrors.topic ? ' is-error' : ''}`}>
                    <label>TEMA PRINCIPAL *</label>
                    <div>
                      {CREATOR_TOPICS.map(topic => (
                        <button
                          key={topic.id}
                          type="button"
                          className={contentForm.topic === topic.id ? 'is-active' : ''}
                          onClick={() => updateContent('topic', topic.id)}
                          aria-pressed={contentForm.topic === topic.id}
                          style={{ '--topic-color':topic.color, '--topic-bg':topic.bg }}
                        >
                          <span>{topic.emoji}</span>{topic.label}
                        </button>
                      ))}
                    </div>
                    {contentErrors.topic && <p>{contentErrors.topic}</p>}
                  </div>

                  <Input label="RESUMEN ÚTIL" required rows={3} error={contentErrors.summary} errorKey="summary" value={contentForm.summary} onChange={event => updateContent('summary', event.target.value)} placeholder="Explica brevemente qué encontrará la persona y por qué puede ayudarle." />
                  <p className={`creator-field-count${contentErrors.summary ? ' is-error' : ''}`}>{contentForm.summary.trim().length}/{CONTENT_LIMITS.summary.max} caracteres · mínimo {CONTENT_LIMITS.summary.min} para publicar</p>
                </section>
              </div>

              <div className="creator-publish-form__explanation">
                <span>ℹ️ Latido muestra esta ficha y abre la publicación completa en tu plataforma.</span>
              </div>
              <div className="creator-publish-form__actions">
                <Btn variant="secondary" disabled={saving} onClick={() => handleContentSave('draft')}>Guardar borrador</Btn>
                <Btn disabled={saving} onClick={() => handleContentSave('published')}>{saving ? 'Guardando…' : contentForm.id ? 'Guardar cambios' : 'Publicar'}</Btn>
              </div>
            </div>
          )}

          <div className="creator-studio-list">
            {contents.map((content, index) => {
              const topic = getCreatorTopic(content.topic)
              const platform = getCreatorPlatform(content.platform)
              const contentMetrics = metrics.byContent[content.id] || { impressions:0, clicks:0, helpful:0, clickRate:0 }
              return (
                <article key={content.id} className="creator-studio-item">
                  <div className="creator-studio-item__visual" style={{ color:topic.color, background:`linear-gradient(145deg,${topic.bg},#fff)` }}>
                    <span>{topic.emoji}</span>
                    {getCreatorThumbnailUrl(content) && <img src={getCreatorThumbnailUrl(content)} alt="" onError={event => event.currentTarget.remove()} />}
                    <small>{platform.short}</small>
                    <b>#{index + 1}</b>
                  </div>
                  <div className="creator-studio-item__copy">
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6, alignItems:'center' }}>
                      <span className={`creator-studio-item__status creator-studio-item__status--${content.status}`}>{content.status === 'published' ? 'PUBLICADO' : 'BORRADOR'}</span>
                      <span className="creator-studio-item__date">{platform.label} · {formatDate(content.published_at)}</span>
                    </div>
                    <h3>{content.title}</h3>
                    <p>{content.summary}</p>
                    <span className="creator-studio-item__metrics">{contentMetrics.impressions} impresiones · {contentMetrics.clicks} clics ({contentMetrics.clickRate}%) · {contentMetrics.helpful} Me ayudó</span>
                  </div>
                  <div className="creator-studio-item__actions">
                    <button type="button" onClick={() => startEditContent(content)}>Editar</button>
                    <button type="button" className="is-danger" onClick={() => removeContent(content)}>Eliminar</button>
                    <div className="creator-studio-item__reorder" role="group" aria-label={`Cambiar posición ${index + 1} de ${contents.length}`}>
                      <button type="button" onClick={() => moveContent(content, 'up')} disabled={index === 0} aria-label="Subir publicación">↑</button>
                      <button type="button" onClick={() => moveContent(content, 'down')} disabled={index === contents.length - 1} aria-label="Bajar publicación">↓</button>
                    </div>
                  </div>
                </article>
              )
            })}
            {!contents.length && (
              <div className="creators-empty">
                <div style={{ marginBottom:8, fontSize:32 }}>🎬</div>
                <strong>Tu escaparate todavía está vacío.</strong>
                <br />Añade una publicación de cualquiera de tus redes, un podcast, un blog o la web de tu proyecto para ver cómo aparecerá.
              </div>
            )}
          </div>
        </section>

        <section className="creator-studio-how">
          <h2>Así funcionaría en producción</h2>
          <div>
            <span><b>1</b><strong>Envías</strong><small>Tu perfil o publicación queda pendiente.</small></span>
            <span><b>2</b><strong>Latido revisa</strong><small>Relación con Suiza, idioma, derechos y enlace.</small></span>
            <span><b>3</b><strong>Se distribuye</strong><small>Perfil, buscador, guías y recomendaciones.</small></span>
            <span><b>4</b><strong>Recibes visitas</strong><small>Latido envía personas a tus redes, publicaciones o web.</small></span>
          </div>
        </section>

        <div style={{ display:'flex', justifyContent:'space-between', gap:16, alignItems:'center', marginTop:26, paddingTop:18, borderTop:`1px solid ${C.border}` }}>
          <span style={{ color:C.light, fontFamily:PP, fontSize:9.5 }}>Los datos de esta prueba no se comparten ni se guardan en Supabase.</span>
          <button type="button" onClick={resetPrototype} style={{ flexShrink:0, color:C.danger, background:'transparent', border:0, fontFamily:PP, fontSize:10, fontWeight:800, cursor:'pointer' }}>Reiniciar mi prueba</button>
        </div>
      </div>
    </div>
  )
}
