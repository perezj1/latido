import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import { Btn, ChevronLeftIcon, ImageUploadField, Input, ProgressBar, StickyFormActions } from '../components/UI'
import CreatorCelebrationModal from '../components/CreatorCelebrationModal'
import {
  CREATOR_TOPICS,
  detectCreatorFormat,
  detectCreatorPlatform,
  getCreatorDirectoryState,
  getCreatorForUser,
  getCreatorOEmbedMetadata,
  getCreatorPlatform,
  getCreatorThumbnailUrl,
  getCreatorTopic,
  getOrderedCreatorContents,
  normalizeCreatorUrl,
  resolveTikTokVideo,
  saveCreatorContent,
  subscribeCreatorUpdates,
} from '../lib/creators'
import { getStorageErrorMessage, uploadPublicationImage } from '../lib/storage'
import { analyzeContent, getContentFilterMessage } from '../lib/contentFilter'
import { addModerationQueueItem } from '../lib/reports'
import { C, PP } from '../lib/theme'

const STEPS = [
  { title:'¿Dónde está tu contenido?', sub:'Pega el enlace de tu contenido en TikTok, Instagram, YouTube u otra plataforma.' },
  { title:'Detalles',          sub:'Un título claro, el tema principal y un resumen útil.' },
  { title:'Revisa y publica',            sub:'Así se verá en tu perfil y en el resto de la app.' },
]

const LIMITS = {
  title:{ min:15, max:100 },
  summary:{ min:40, max:300 },
}

const EMPTY_FORM = {
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
  thumbnail_url:'',
  thumbnail_kind:'',
  status:'published',
}

export default function PublicarContenido() {
  const navigate = useNavigate()
  const { isLoggedIn, user } = useAuth()
  const [creator, setCreator] = useState(() => getCreatorForUser(user?.id))
  const [directoryState, setDirectoryState] = useState(getCreatorDirectoryState)
  const contents = useMemo(() => getOrderedCreatorContents(creator), [creator])

  const [step, setStep] = useState(0)
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [processingThumbnail, setProcessingThumbnail] = useState(false)
  const [fetchingMetadata, setFetchingMetadata] = useState(false)
  const [publishResult, setPublishResult] = useState(null)

  useEffect(() => {
    const sync = () => {
      setCreator(getCreatorForUser(user?.id))
      setDirectoryState(getCreatorDirectoryState())
    }
    sync()
    return subscribeCreatorUpdates(sync)
  }, [user?.id])

  useEffect(() => { window.scrollTo({ top:0, left:0, behavior:'instant' }) }, [step])

  const clearFieldError = key => setErrors(current => {
    if (!current[key]) return current
    const next = { ...current }
    delete next[key]
    return next
  })

  const s = (key, value) => {
    setForm(current => {
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
    clearFieldError(key)
  }

  // Igual que en el panel: YouTube y TikTok devuelven titulo y portada, asi que
  // se rellenan solos mientras no los hayas tocado.
  useEffect(() => {
    const platform = detectCreatorPlatform(form.url)
    if (!['youtube', 'tiktok'].includes(platform)) return undefined
    const normalizedUrl = normalizeCreatorUrl(form.url)
    if (!normalizedUrl) return undefined

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setFetchingMetadata(true)
      try {
        const metadata = await getCreatorOEmbedMetadata(normalizedUrl, { signal:controller.signal })
        if (!metadata) return
        setForm(current => {
          if (current.url !== form.url) return current
          const next = { ...current }
          if (!current.title.trim() && metadata.title) next.title = metadata.title.slice(0, LIMITS.title.max)
          if (current.thumbnail_kind !== 'custom' && metadata.thumbnail_url) {
            next.thumbnail_url = metadata.thumbnail_url
            next.thumbnail_kind = 'auto'
          }
          // Sin estos tres el video no se reproduce dentro de Latido.
          if (metadata.video_id) next.video_id = metadata.video_id
          if (metadata.resolved_url) next.resolved_url = metadata.resolved_url
          if (metadata.embed_url) next.embed_url = metadata.embed_url
          return next
        })
      } catch (error) {
        if (error?.name !== 'AbortError') {
          setForm(current => current.thumbnail_kind === 'auto' ? { ...current, thumbnail_url:'', thumbnail_kind:'' } : current)
        }
      } finally {
        if (!controller.signal.aborted) setFetchingMetadata(false)
      }
    }, 550)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [form.url])

  const getStepErrors = targetStep => {
    const next = {}
    if (targetStep === 0) {
      if (!form.url.trim()) next.url = 'Añade el enlace al contenido original.'
      else if (!normalizeCreatorUrl(form.url)) next.url = 'Introduce una dirección válida, por ejemplo https://youtube.com/watch?v=…'
    }
    if (targetStep === 1) {
      const titleLength = form.title.trim().length
      const summaryLength = form.summary.trim().length

      if (!titleLength) next.title = 'Escribe un título para identificar este contenido.'
      else if (titleLength < LIMITS.title.min) next.title = `El título necesita al menos ${LIMITS.title.min} caracteres (llevas ${titleLength}).`
      else if (titleLength > LIMITS.title.max) next.title = `El título admite como máximo ${LIMITS.title.max} caracteres (llevas ${titleLength}).`

      if (!summaryLength) next.summary = 'Explica brevemente qué encontrará la persona al abrir el contenido.'
      else if (summaryLength < LIMITS.summary.min) next.summary = `El resumen necesita al menos ${LIMITS.summary.min} caracteres (llevas ${summaryLength}).`
      else if (summaryLength > LIMITS.summary.max) next.summary = `El resumen admite como máximo ${LIMITS.summary.max} caracteres (llevas ${summaryLength}).`

      if (!form.topic) next.topic = 'Selecciona el tema principal.'
    }
    return next
  }

  const scrollToFirstError = next => {
    const firstKey = Object.keys(next)[0]
    if (!firstKey) return
    window.setTimeout(() => {
      document.querySelector(`[data-error-field="${firstKey}"]`)?.scrollIntoView({ behavior:'smooth', block:'center' })
    }, 80)
  }

  const validateCurrentStep = () => {
    const next = getStepErrors(step)
    setErrors(next)
    scrollToFirstError(next)
    return Object.keys(next).length === 0
  }

  const validateBeforePublish = () => {
    const next = { ...getStepErrors(0), ...getStepErrors(1) }
    setErrors(next)
    if (!Object.keys(next).length) return true
    setStep(next.url ? 0 : 1)
    scrollToFirstError(next)
    return false
  }

  const handleThumbnail = async files => {
    const [file] = files || []
    if (!file) return
    setProcessingThumbnail(true)
    try {
      const thumbnailUrl = await uploadPublicationImage({ file, userId:user.id, folder:'creator-content' })
      setForm(current => ({ ...current, thumbnail_url:thumbnailUrl, thumbnail_kind:'custom' }))
      toast.success('Miniatura subida')
    } catch (error) {
      toast.error(getStorageErrorMessage(error))
    } finally {
      setProcessingThumbnail(false)
    }
  }

  const handlePublish = async () => {
    if (saving) return
    if (!validateBeforePublish()) return
    const moderation = analyzeContent(form.title, form.summary, form.url)
    if (moderation.action === 'block') {
      toast.error(getContentFilterMessage(moderation))
      return
    }

    setSaving(true)
    try {
      const needsReview = moderation.action === 'review'
      let contentToSave = { ...form, position:contents.length + 1, status:'published', active:!needsReview }
      if (detectCreatorPlatform(form.url) === 'tiktok') {
        contentToSave = { ...contentToSave, ...(await resolveTikTokVideo(form.url)) }
      }
      const savedContent = await saveCreatorContent(user.id, contentToSave)
      if (needsReview && savedContent?.id) {
        await addModerationQueueItem({
          contentType:'creator_content',
          contentId:savedContent.id,
          authorId:user.id,
          reason:'Filtro automático',
          excerpt:[form.title, form.summary].filter(Boolean).join('\n\n').slice(0, 700),
          matchedTerm:moderation.matchedTerm,
          metadata:{ creator_id:creator.id, platform:contentToSave.platform, external_url:contentToSave.url },
        })
      }
      setPublishResult({ needsReview })
    } catch (error) {
      toast.error(error?.message || 'No se pudo guardar el contenido')
    } finally {
      setSaving(false)
    }
  }

  const closePublishSuccess = () => {
    setPublishResult(null)
    navigate('/creadores/mi-perfil')
  }

  const publishMoreContent = () => {
    setPublishResult(null)
    setStep(0)
    setForm({ ...EMPTY_FORM })
    setErrors({})
    setFetchingMetadata(false)
    setProcessingThumbnail(false)
  }

  if (!isLoggedIn) return (
    <div style={{ maxWidth:480, margin:'0 auto', padding:'80px 24px', textAlign:'center' }}>
      <div style={{ fontSize:52, marginBottom:16 }}>🔐</div>
      <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:22, color:C.text, marginBottom:10 }}>Necesitas una cuenta</h1>
      <p style={{ fontFamily:PP, fontSize:13, color:C.mid, marginBottom:24, lineHeight:1.7 }}>
        Para publicar contenido necesitas registrarte. Es gratis, rápido y sin spam.
      </p>
      <Btn onClick={() => navigate('/auth')}>Crear cuenta gratis</Btn>
    </div>
  )

  if (!directoryState.loaded || directoryState.loading) return (
    <div style={{ minHeight:'70vh', display:'grid', placeItems:'center', color:C.mid, fontFamily:PP }}>Cargando tu perfil…</div>
  )

  if (directoryState.error) return (
    <div style={{ maxWidth:480, margin:'0 auto', padding:'80px 24px', textAlign:'center' }}>
      <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:22, color:C.text }}>No pudimos cargar tu perfil</h1>
      <p style={{ fontFamily:PP, color:C.mid }}>Comprueba tu conexión e inténtalo de nuevo.</p>
      <Btn onClick={() => window.location.reload()}>Reintentar</Btn>
    </div>
  )

  if (!creator) return (
    <div style={{ maxWidth:480, margin:'0 auto', padding:'80px 24px', textAlign:'center' }}>
      <div style={{ fontSize:52, marginBottom:16 }}>🎙️</div>
      <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:22, color:C.text, marginBottom:10 }}>Empieza a compartir tu contenido</h1>
      <p style={{ fontFamily:PP, fontSize:13, color:C.mid, marginBottom:24, lineHeight:1.7 }}>
        Crea tu perfil de creador y reúne tus publicaciones y redes sociales en un solo lugar. Llega a más personas y haz crecer tu comunidad.
      </p>
      <Btn onClick={() => navigate('/creadores/alta', { state:{ from:'/publicar-contenido' } })}>Crear mi perfil →</Btn>
    </div>
  )

  const platform = getCreatorPlatform(form.platform)
  const topic = getCreatorTopic(form.topic)
  const previewThumbnail = getCreatorThumbnailUrl(form)

  return (
    <div style={{ maxWidth:600, margin:'0 auto', padding:'32px 24px 170px' }}>
      <ProgressBar step={step} total={STEPS.length} />
      <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:22, color:C.text, marginBottom:4, letterSpacing:-0.3 }}>{STEPS[step].title}</h1>
      <p style={{ fontFamily:PP, fontSize:12, color:C.light, marginBottom:24 }}>{STEPS[step].sub}</p>

      {step === 0 && (
        <>
          <Input
            label="Enlace del contenido"
            required
            placeholder="https://youtube.com/watch?v=…"
            value={form.url}
            onChange={event => s('url', event.target.value)}
            error={errors.url}
            errorKey="url"
          />
          {form.url.trim() && (
            <div style={{ display:'flex', alignItems:'center', gap:9, padding:'12px 14px', background:C.bgAlt, border:`1px solid ${C.border}`, borderRadius:14 }}>
              <span style={{ fontSize:18 }}>{fetchingMetadata ? '⏳' : '🔗'}</span>
              <span style={{ fontFamily:PP, fontSize:11.5, color:C.mid, lineHeight:1.5 }}>
                {fetchingMetadata
                  ? 'Leyendo los datos del contenido…'
                  : <>Detectado: <strong style={{ color:C.text }}>{platform?.label || 'Web'}</strong> · {form.format}</>}
              </span>
            </div>
          )}
        </>
      )}

      {step === 1 && (
        <>
          <Input
            label="Título para Latido"
            required
            placeholder="Ej. Cómo preparar la solicitud del permiso B"
            value={form.title}
            onChange={event => s('title', event.target.value)}
            error={errors.title}
            errorKey="title"
          />
          <p style={{ fontFamily:PP, fontSize:10.5, color:C.light, margin:'-6px 2px 16px' }}>
            {form.title.trim().length}/{LIMITS.title.max} caracteres · mínimo {LIMITS.title.min}
          </p>

          <div data-error-field="topic" style={{ marginBottom:16 }}>
            <p style={{ fontFamily:PP, fontSize:11, fontWeight:700, color:C.text, margin:'0 0 8px' }}>Tema principal *</p>
            <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
              {CREATOR_TOPICS.map(item => {
                const selected = form.topic === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => s('topic', item.id)}
                    style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'9px 13px', color:selected ? item.color : C.mid, background:selected ? item.bg : '#fff', border:`1.5px solid ${selected ? item.color : C.border}`, borderRadius:999, fontFamily:PP, fontSize:11, fontWeight:800, cursor:'pointer' }}
                  >
                    <span aria-hidden="true">{item.emoji}</span>
                    {item.label}
                  </button>
                )
              })}
            </div>
            {errors.topic && <p style={{ fontFamily:PP, fontSize:10.5, color:'#DC2626', margin:'8px 2px 0' }}>{errors.topic}</p>}
          </div>

          <Input
            label="Resumen útil"
            required
            rows={4}
            placeholder="Explica brevemente qué encontrará la persona y por qué puede ayudarle."
            value={form.summary}
            onChange={event => s('summary', event.target.value)}
            error={errors.summary}
            errorKey="summary"
          />
          <p style={{ fontFamily:PP, fontSize:10.5, color:C.light, margin:'-6px 2px 16px' }}>
            {form.summary.trim().length}/{LIMITS.summary.max} caracteres · mínimo {LIMITS.summary.min}
          </p>

          <ImageUploadField
            label="Imagen / miniatura"
            previewUrl={previewThumbnail}
            uploading={processingThumbnail}
            onFilesSelected={handleThumbnail}
            onRemove={() => setForm(current => ({ ...current, thumbnail_url:'', thumbnail_kind:'' }))}
            hint="YouTube y TikTok traen su portada automáticamente. Para Instagram y webs, elige una imagen horizontal."
          />
        </>
      )}

      {step === 2 && (
        <>
          <div style={{ background:C.bg, borderRadius:16, padding:'16px', marginBottom:14 }}>
            <p style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, margin:'0 0 12px', letterSpacing:0.5 }}>VISTA PREVIA</p>
            {previewThumbnail && (
              <div style={{ borderRadius:14, overflow:'hidden', marginBottom:12, background:'#f1f5f9' }}>
                <img src={previewThumbnail} alt={form.title} style={{ width:'100%', maxHeight:200, objectFit:'contain', display:'block' }} />
              </div>
            )}
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:9 }}>
              {topic && <span style={{ fontFamily:PP, fontSize:10, fontWeight:700, padding:'4px 9px', borderRadius:999, background:topic.bg, color:topic.color }}>{topic.emoji} {topic.label}</span>}
              {platform && <span style={{ fontFamily:PP, fontSize:10, fontWeight:700, padding:'4px 9px', borderRadius:999, background:platform.bg, color:platform.color }}>{platform.label}</span>}
            </div>
            <p style={{ fontFamily:PP, fontWeight:800, fontSize:15, color:C.text, margin:'0 0 6px', lineHeight:1.35 }}>{form.title}</p>
            <p style={{ fontFamily:PP, fontSize:12, color:C.mid, margin:0, lineHeight:1.65 }}>{form.summary}</p>
          </div>

        </>
      )}

      <p style={{ fontFamily:PP, fontSize:11, color:C.light, textAlign:'center', marginTop:14 }}>
        Gratuito · Puedes gestionar todo tu contenido y elegir hasta seis destacados
      </p>

      <StickyFormActions>
        {step === 0 ? (
          <Btn onClick={() => navigate('/creadores/mi-perfil')} variant="danger" style={{ flex:'0 0 122px', border:'1.5px solid #FCA5A5' }}>
            <ChevronLeftIcon size={16} /> Cancelar
          </Btn>
        ) : (
          <Btn onClick={() => setStep(current => current - 1)} variant="secondary" style={{ flex:'0 0 122px' }}>
            <ChevronLeftIcon size={16} /> Atrás
          </Btn>
        )}
        {step < STEPS.length - 1 ? (
          <Btn onClick={() => { if (validateCurrentStep()) setStep(current => current + 1) }} style={{ flex:1 }}>
            Continuar →
          </Btn>
        ) : (
          <Btn onClick={handlePublish} disabled={saving} variant="success" style={{ flex:1 }}>
            {saving ? '⏳ Publicando...' : '🎙️ Publicar contenido'}
          </Btn>
        )}
      </StickyFormActions>

      <CreatorCelebrationModal
        show={Boolean(publishResult)}
        onClose={closePublishSuccess}
        title={publishResult?.needsReview ? 'Contenido enviado' : 'Contenido publicado'}
        message={publishResult?.needsReview
          ? 'Tu contenido se ha enviado a revisión. Te avisaremos cuando esté visible.'
          : 'Tu contenido llegará ahora a más personas.'}
        primaryLabel="Publicar más contenido"
        onPrimary={publishMoreContent}
      />
    </div>
  )
}
