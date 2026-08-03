import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import { Btn, ImageUploadField, Input, Select } from '../components/UI'
import { CreatorAvatar, CreatorTopicPill } from '../components/CreatorCards'
import { CANTONS } from '../lib/constants'
import {
  CREATOR_MAX_CONTENTS,
  CREATOR_PLATFORMS,
  CREATOR_TOPICS,
  detectCreatorPlatform,
  getCreatorForUser,
  getCreatorMetrics,
  getCreatorPlatform,
  getCreatorThumbnailUrl,
  getCreatorTopic,
  normalizeCreatorUrl,
  removeCreatorContent,
  resetCreatorPrototype,
  saveCreatorContent,
  setCreatorContentStatus,
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
  status:'published',
}

const CONTENT_LIMITS = {
  title:{ min:15, max:100 },
  summary:{ min:40, max:300 },
  duration:{ max:20 },
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
  const [searchParams] = useSearchParams()
  const [creator, setCreator] = useState(() => getCreatorForUser(user?.id))
  const [contentForm, setContentForm] = useState(EMPTY_CONTENT)
  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [contentErrors, setContentErrors] = useState({})
  const [processingThumbnail, setProcessingThumbnail] = useState(false)

  const refresh = () => setCreator(getCreatorForUser(user?.id))
  const metrics = useMemo(() => getCreatorMetrics(creator), [creator])
  const contents = creator?.contents || []

  useEffect(() => {
    if (searchParams.get('created') === '1') {
      toast('Tu perfil ya aparece en el directorio de este navegador. Ahora añade tu primera publicación.', { icon:'🎉', duration:5000 })
    }
  }, [searchParams])

  if (!creator) {
    return (
      <div className="creators-page" style={{ display:'grid', minHeight:'78vh', placeItems:'center', padding:'28px' }}>
        <section style={{ width:'min(540px,100%)', padding:30, background:'#fff', border:`1px solid ${C.border}`, borderRadius:26, boxShadow:'0 18px 48px rgba(30,64,175,.1)', textAlign:'center' }}>
          <div style={{ display:'grid', width:70, height:70, margin:'0 auto 18px', placeItems:'center', color:'#fff', background:'linear-gradient(145deg,#2563EB,#102A5C)', borderRadius:22, fontSize:30 }}>🎙️</div>
          <span className="creator-demo-label">ESPACIO DEL CREADOR · PROTOTIPO</span>
          <h1 style={{ margin:'16px 0 8px', color:'#102A5C', fontFamily:PP, fontSize:24, letterSpacing:-.5 }}>Crea primero tu perfil público</h1>
          <p style={{ margin:'0 auto 20px', maxWidth:430, color:C.mid, fontFamily:PP, fontSize:11.5, lineHeight:1.7 }}>El alta tarda unos minutos. Puedes participar como persona, profesional, proyecto o negocio si compartes sobre Suiza en redes.</p>
          <Link className="creators-primary-action" to="/creadores/alta">Crear mi perfil →</Link>
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
    setContentForm(EMPTY_CONTENT)
    setContentErrors({})
    setFormOpen(true)
    window.setTimeout(() => document.getElementById('creator-content-form')?.scrollIntoView({ behavior:'smooth', block:'start' }), 40)
  }

  const startEditContent = content => {
    setContentForm({ ...EMPTY_CONTENT, ...content })
    setContentErrors({})
    setFormOpen(true)
    window.setTimeout(() => document.getElementById('creator-content-form')?.scrollIntoView({ behavior:'smooth', block:'start' }), 40)
  }

  const updateContent = (key, value) => {
    setContentForm(current => {
      const next = { ...current, [key]:value }
      if (key === 'url' && value.trim()) next.platform = detectCreatorPlatform(value)
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
    const durationLength = contentForm.duration.trim().length
    const isDraft = status === 'draft'

    if (!titleLength) errors.title = 'Escribe un título para identificar esta publicación.'
    else if (titleLength < (isDraft ? 3 : CONTENT_LIMITS.title.min)) errors.title = isDraft
      ? `El título necesita al menos 3 caracteres para guardar el borrador (llevas ${titleLength}).`
      : `El título necesita al menos ${CONTENT_LIMITS.title.min} caracteres (llevas ${titleLength}).`
    else if (titleLength > CONTENT_LIMITS.title.max) errors.title = `El título admite como máximo ${CONTENT_LIMITS.title.max} caracteres (llevas ${titleLength}).`

    if (!isDraft || contentForm.url.trim()) {
      if (!contentForm.url.trim()) errors.url = 'Añade el enlace a la publicación original.'
      else if (!normalizeCreatorUrl(contentForm.url)) errors.url = 'Introduce una dirección válida, por ejemplo https://youtube.com/watch?v=…'
    }

    if (!isDraft || summaryLength) {
      if (!summaryLength) errors.summary = 'Explica brevemente qué encontrará la persona al abrir la publicación.'
      else if (summaryLength < CONTENT_LIMITS.summary.min) errors.summary = `El resumen necesita al menos ${CONTENT_LIMITS.summary.min} caracteres (llevas ${summaryLength}).`
      else if (summaryLength > CONTENT_LIMITS.summary.max) errors.summary = `El resumen admite como máximo ${CONTENT_LIMITS.summary.max} caracteres (llevas ${summaryLength}).`
    }

    if (!contentForm.platform) errors.platform = 'Selecciona la plataforma donde está publicado.'
    if (!contentForm.topic) errors.topic = 'Selecciona el tema principal.'
    if (!contentForm.format) errors.format = 'Selecciona el formato de la publicación.'
    if (durationLength > CONTENT_LIMITS.duration.max) errors.duration = `La duración admite como máximo ${CONTENT_LIMITS.duration.max} caracteres (llevas ${durationLength}).`

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
      updateContent('thumbnail_url', thumbnailUrl)
      toast.success('Miniatura preparada')
    } catch (error) {
      toast.error(error?.message || 'No se pudo preparar la miniatura')
    } finally {
      setProcessingThumbnail(false)
    }
  }

  const toggleStatus = content => {
    const nextStatus = content.status === 'published' ? 'draft' : 'published'
    setCreatorContentStatus(user.id, content.id, nextStatus)
    refresh()
    toast.success(nextStatus === 'published' ? 'Publicación visible en el perfil' : 'Publicación movida a borrador')
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
    <div className="creators-page creator-app-form-page">
      <div className="creator-studio-shell" style={{ paddingTop:28 }}>
        <div className="creator-studio-heading">
          <div>
            <span className="creators-eyebrow">MI PERFIL EN LATIDO · PRUEBA LOCAL</span>
            <h1>Hola, {creator.name}</h1>
            <p>Gestiona cómo te presentas y qué publicaciones de tus redes quieres mostrar a la comunidad.</p>
          </div>
          <div className="creator-studio-heading__actions">
            <Link className="creators-secondary-action" to={`/creadores/${creator.slug}`}>Ver perfil público ↗</Link>
            <Link className="creators-primary-action" to="/creadores/alta">Editar perfil</Link>
          </div>
        </div>

        <div className="creator-prototype-notice">
          <span>🧪</span>
          <div>
            <strong>Estás probando la experiencia sin tocar la base de datos real.</strong>
            <p>El perfil, las publicaciones y las métricas se guardan únicamente en este navegador. Puedes recorrer todo el flujo y reiniciarlo cuando termines.</p>
          </div>
        </div>

        <section className="creator-studio-profile">
          <CreatorAvatar creator={creator} size={78} />
          <div style={{ minWidth:0 }}>
            <div style={{ display:'flex', gap:7, alignItems:'center', flexWrap:'wrap' }}>
              <h2>{creator.name}</h2>
              <span className="creator-studio-status">VISIBLE EN LA PRUEBA</span>
            </div>
            <p>{creator.tagline}</p>
            <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginTop:9 }}>
              {creator.topics.map(topic => <CreatorTopicPill key={topic} topicId={topic} compact />)}
            </div>
          </div>
          <div className="creator-studio-profile__meta">
            <span>📍 {creator.city || creator.reach}{creator.canton ? ` · ${creator.canton}` : ''}</span>
            <span>🔗 {creator.socials.length} redes o canales conectados</span>
          </div>
        </section>

        <section className="creator-studio-metrics" aria-label="Métricas del perfil">
          <div><span>Visitas al perfil</span><strong>{metrics.profileViews}</strong><small>registradas en esta prueba</small></div>
          <div><span>Clics a publicaciones</span><strong>{metrics.contentClicks}</strong><small>hacia tus enlaces originales</small></div>
          <div><span>Clics a redes</span><strong>{metrics.socialClicks}</strong><small>desde tu perfil público</small></div>
          <div><span>Espacios usados</span><strong>{contents.length}/{CREATOR_MAX_CONTENTS}</strong><small>publicados y borradores</small></div>
        </section>

        <section className="creator-studio-content-section">
          <div className="creators-section__heading">
            <div>
              <h2>Tus publicaciones destacadas</h2>
              <p>Elige hasta seis enlaces que representen tu experiencia, trabajo, proyecto o negocio.</p>
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

              <div className="creator-publish-form__grid">
                <div className="creator-publish-form__main">
                  <Input label="TÍTULO PARA LATIDO" required error={contentErrors.title} errorKey="title" value={contentForm.title} onChange={event => updateContent('title', event.target.value)} placeholder="Ej. Cómo preparar la solicitud del permiso B" />
                  <p className={`creator-field-count${contentErrors.title ? ' is-error' : ''}`}>{contentForm.title.trim().length}/{CONTENT_LIMITS.title.max} caracteres · mínimo {CONTENT_LIMITS.title.min} para publicar</p>
                  <Input label="ENLACE ORIGINAL" required type="url" error={contentErrors.url} errorKey="url" value={contentForm.url} onChange={event => updateContent('url', event.target.value)} placeholder="https://youtube.com/watch?v=…" />
                  <ImageUploadField
                    label="MINIATURA"
                    hint={getCreatorThumbnailUrl(contentForm)
                      ? (contentForm.thumbnail_url ? 'Imagen personalizada. Puedes cambiarla o quitarla.' : 'Miniatura detectada automáticamente desde YouTube. También puedes subir otra imagen.')
                      : 'YouTube se detecta automáticamente. Para las demás redes, podcasts o webs, sube una imagen horizontal.'}
                    previewUrl={getCreatorThumbnailUrl(contentForm)}
                    uploading={processingThumbnail}
                    onFilesSelected={handleThumbnail}
                    onRemove={contentForm.thumbnail_url ? () => updateContent('thumbnail_url', '') : undefined}
                  />
                  <Input label="RESUMEN ÚTIL" required rows={4} error={contentErrors.summary} errorKey="summary" value={contentForm.summary} onChange={event => updateContent('summary', event.target.value)} placeholder="Explica en pocas palabras qué encontrará la persona y por qué puede ayudarle." />
                  <p className={`creator-field-count${contentErrors.summary ? ' is-error' : ''}`}>{contentForm.summary.trim().length}/{CONTENT_LIMITS.summary.max} caracteres · mínimo {CONTENT_LIMITS.summary.min} para publicar</p>
                </div>
                <div>
                  <Select label="PLATAFORMA DETECTADA" error={contentErrors.platform} errorKey="platform" value={contentForm.platform} onChange={event => updateContent('platform', event.target.value)}>
                    {CREATOR_PLATFORMS.map(platform => <option key={platform.id} value={platform.id}>{platform.label}</option>)}
                  </Select>
                  <Select label="TEMA" error={contentErrors.topic} errorKey="topic" value={contentForm.topic} onChange={event => updateContent('topic', event.target.value)}>
                    {CREATOR_TOPICS.map(topic => <option key={topic.id} value={topic.id}>{topic.emoji} {topic.label}</option>)}
                  </Select>
                  <Select label="FORMATO" error={contentErrors.format} errorKey="format" value={contentForm.format} onChange={event => updateContent('format', event.target.value)}>
                    <option value="video">Vídeo</option>
                    <option value="reel">Reel / vídeo corto</option>
                    <option value="publicacion">Publicación / foto</option>
                    <option value="carrusel">Carrusel</option>
                    <option value="podcast">Podcast</option>
                    <option value="artículo">Artículo</option>
                  </Select>
                  <Select label="UBICACIÓN" value={contentForm.canton} onChange={event => updateContent('canton', event.target.value)}>
                    <option value="Toda Suiza">Toda Suiza</option>
                    {CANTONS.map(canton => <option key={canton.code} value={canton.code}>{canton.code} · {canton.name}</option>)}
                  </Select>
                  <Input label="DURACIÓN / LECTURA" error={contentErrors.duration} errorKey="duration" value={contentForm.duration} onChange={event => updateContent('duration', event.target.value)} placeholder="Ej. 8 min" />
                </div>
              </div>

              <div className="creator-publish-form__explanation">
                <strong>¿Qué publica Latido?</strong>
                <span>Solo esta ficha, tu resumen, la miniatura y el enlace. La publicación completa continúa alojada en tu red social, canal o web.</span>
              </div>
              <div className="creator-publish-form__actions">
                <Btn variant="secondary" disabled={saving} onClick={() => handleContentSave('draft')}>Guardar borrador</Btn>
                <Btn disabled={saving} onClick={() => handleContentSave('published')}>{saving ? 'Guardando…' : 'Publicar en mi perfil'}</Btn>
              </div>
            </div>
          )}

          <div className="creator-studio-list">
            {contents.map(content => {
              const topic = getCreatorTopic(content.topic)
              const platform = getCreatorPlatform(content.platform)
              return (
                <article key={content.id} className="creator-studio-item">
                  <div className="creator-studio-item__visual" style={{ color:topic.color, background:`linear-gradient(145deg,${topic.bg},#fff)` }}>
                    <span>{topic.emoji}</span>
                    {getCreatorThumbnailUrl(content) && <img src={getCreatorThumbnailUrl(content)} alt="" onError={event => event.currentTarget.remove()} />}
                    <small>{platform.short}</small>
                  </div>
                  <div className="creator-studio-item__copy">
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6, alignItems:'center' }}>
                      <span className={`creator-studio-item__status creator-studio-item__status--${content.status}`}>{content.status === 'published' ? 'PUBLICADO' : 'BORRADOR'}</span>
                      <span className="creator-studio-item__date">{platform.label} · {formatDate(content.published_at)}</span>
                    </div>
                    <h3>{content.title}</h3>
                    <p>{content.summary}</p>
                  </div>
                  <div className="creator-studio-item__actions">
                    <button type="button" onClick={() => startEditContent(content)}>Editar</button>
                    <button type="button" onClick={() => toggleStatus(content)}>{content.status === 'published' ? 'Pasar a borrador' : 'Publicar'}</button>
                    <button type="button" className="is-danger" onClick={() => removeContent(content)}>Eliminar</button>
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
