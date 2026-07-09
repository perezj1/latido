import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { C, PP } from '../lib/theme'
import { EVENTO_TYPES } from '../lib/constants'
import { Btn, ProgressBar, Input, ImageUploadField, PublicationLegalNotice, StickyFormActions } from '../components/UI'
import LocationFields from '../components/LocationFields'
import OptimizedImage from '../components/OptimizedImage'
import { getStorageErrorMessage, uploadPublicationImage } from '../lib/storage'
import { normalizeExternalUrl } from '../lib/links'
import { analyzeContent, getContentFilterMessage } from '../lib/contentFilter'
import { trackPublicationCreated } from '../lib/analytics'
import { addModerationQueueItem } from '../lib/reports'
import PostPublishPushModal from '../components/PostPublishPushModal'
import { getPushStatus } from '../lib/pushNotifications'
import toast from 'react-hot-toast'

const STEPS = [
  { title:'¿Qué tipo de evento es?',     sub:'Elige la categoría que mejor lo describe' },
  { title:'Fecha, hora y precio',         sub:'¿Cuándo es y cuánto cuesta la entrada?' },
  { title:'Lugar y descripción',          sub:'Dónde se celebra y qué pueden esperar' },
  { title:'Organizador y contacto',       sub:'Último paso — ¿quién organiza y cómo contactar?' },
]

const EVENT_TYPES_FORM = EVENTO_TYPES.filter(t => t.id !== '')
const EVENT_MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']

export default function PublicarEvento() {
  const { isLoggedIn, user } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }) }, [step])
  const [loading, setLoading] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [done, setDone] = useState(false)
  const [publishedForReview, setPublishedForReview] = useState(false)
  const [pushModalOpen, setPushModalOpen] = useState(false)
  const [form, setForm] = useState({
    type:'', title:'', date:'', day:'', month:'', year:'', time:'', price:'',
    city:'', canton:'', venue:'', desc:'', img_url:'', host:'', link:'',
  })
  const [errors, setErrors] = useState({})
  const errorTextStyle = { fontFamily:PP, fontSize:10.5, color:'#DC2626', margin:'6px 2px 0', lineHeight:1.45 }
  const clearFieldError = key => setErrors(prev => {
    if (!prev[key]) return prev
    const next = { ...prev }
    delete next[key]
    return next
  })
  const s = (k, v) => {
    setForm(f => ({ ...f, [k]:v }))
    clearFieldError(k)
  }
  const setEventDate = value => {
    clearFieldError('date')
    const [, month, day] = value ? value.split('-') : []
    setForm(f => ({
      ...f,
      date:value,
      day:day || '',
      month:month ? EVENT_MONTHS[Number(month) - 1] || '' : '',
      year:value ? value.slice(0, 4) : '',
    }))
  }
  const getStepErrors = targetStep => {
    const next = {}
    if (targetStep === 0 && !form.type) next.type = 'Elige el tipo de evento.'
    if (targetStep === 1) {
      if (!form.title.trim()) next.title = 'Añade un título para el evento.'
      if (!form.date) next.date = 'Selecciona la fecha del evento.'
    }
    if (targetStep === 2 && !form.canton) next.canton = 'Selecciona el cantón del evento.'
    if (targetStep === 3 && form.link.trim() && !normalizeExternalUrl(form.link)) {
      next.link = 'Añade un link válido, por ejemplo instagram.com/usuario o @usuario.'
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
    const next = { ...getStepErrors(0), ...getStepErrors(1), ...getStepErrors(2), ...getStepErrors(3) }
    setErrors(next)
    if (Object.keys(next).length === 0) return true
    if (next.type) setStep(0)
    else if (next.title || next.date) setStep(1)
    else if (next.canton) setStep(2)
    else setStep(3)
    scrollToFirstError(next)
    return false
  }

  if (!isLoggedIn) return (
    <div style={{ maxWidth:480, margin:'0 auto', padding:'80px 24px', textAlign:'center' }}>
      <div style={{ fontSize:52, marginBottom:16 }}>🔐</div>
      <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:22, color:C.text, marginBottom:10 }}>Necesitas una cuenta</h1>
      <p style={{ fontFamily:PP, fontSize:13, color:C.mid, marginBottom:24, lineHeight:1.7 }}>
        Para publicar eventos necesitas registrarte. Es gratis, rápido y sin spam.
      </p>
      <Btn onClick={() => navigate('/auth')}>Crear cuenta gratis</Btn>
      <button onClick={() => navigate('/auth')} style={{ fontFamily:PP, fontWeight:600, fontSize:13, color:C.primary, background:'none', border:`1.5px solid ${C.primaryMid}`, borderRadius:14, padding:'12px 0', width:'100%', cursor:'pointer', marginTop:10 }}>
        Ya tengo cuenta — iniciar sesión
      </button>
    </div>
  )

  if (done) return (
    <div style={{ maxWidth:480, margin:'0 auto', padding:'80px 24px', textAlign:'center' }}>
      <div style={{ width:80, height:80, background:C.successLight, borderRadius:24, display:'flex', alignItems:'center', justifyContent:'center', fontSize:42, margin:'0 auto 20px' }}>🎉</div>
      <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:24, color:C.text, marginBottom:10 }}>{publishedForReview ? 'Evento enviado a revisión' : '¡Evento publicado!'}</h1>
      <p style={{ fontFamily:PP, fontSize:13, color:C.mid, lineHeight:1.7, marginBottom:24 }}>
        {publishedForReview
          ? 'Tu evento quedó oculto temporalmente hasta que el equipo lo revise.'
          : 'Tu evento ya está visible para la comunidad hispanohablante en Suiza.'}
      </p>
      <Btn onClick={() => navigate('/comunidades?view=eventos')}>Ver en eventos →</Btn>
      <button onClick={() => { setDone(false); setPublishedForReview(false); setErrors({}); setStep(0); setForm({ type:'', title:'', date:'', day:'', month:'', year:'', time:'', price:'', city:'', canton:'', venue:'', desc:'', img_url:'', host:'', link:'' }); }} style={{ fontFamily:PP, fontWeight:600, fontSize:12, color:C.mid, background:'none', border:'none', cursor:'pointer', width:'100%', marginTop:12, padding:'6px 0' }}>
        Publicar otro evento
      </button>
    </div>
  )

  const handleSubmit = async () => {
    if (!validateBeforePublish()) return
    if (!form.title || !form.date || !form.canton) { toast.error('Completa título, fecha y cantón'); return }
    const link = normalizeExternalUrl(form.link)
    if (form.link.trim() && !link) {
      toast.error('Añade un link válido, por ejemplo instagram.com/usuario o @usuario')
      return
    }
    const moderation = analyzeContent(form.title, form.venue, form.desc, form.host)
    if (moderation.action === 'block') {
      toast.error(getContentFilterMessage(moderation))
      return
    }

    setLoading(true)
    try {
      const eventId = globalThis.crypto?.randomUUID?.()
      const needsReview = moderation.action === 'review'
      const { error } = await supabase.from('events').insert({
        ...(eventId ? { id: eventId } : {}),
        type: form.type,
        title: form.title,
        day: form.day,
        month: form.month,
        year: form.year,
        time: form.time,
        price: form.price,
        city: form.city,
        canton: form.canton,
        venue: form.venue,
        desc: form.desc,
        img_url: form.img_url || null,
        host: form.host || user?.user_metadata?.name || 'Organizador',
        link: link || null,
        user_id: user?.id,
        active: !needsReview,
      })
      if (error) throw error
      if (needsReview && eventId) {
        await addModerationQueueItem({
          contentType: 'event',
          contentId: eventId,
          authorId: user?.id,
          reason: 'Filtro automatico',
          excerpt: [form.title, form.venue, form.desc].filter(Boolean).join('\n\n').slice(0, 700),
          matchedTerm: moderation.matchedTerm,
          metadata: { type: form.type, canton: form.canton, city: form.city },
        })
      }
      trackPublicationCreated({
        user_id:user?.id,
        contentType:'event',
        category:form.type,
        needsReview,
      })
      setPublishedForReview(needsReview)
      setDone(true)
    } catch (error) {
      console.error('Publish event failed:', error)
      const message = error?.message?.toLowerCase().includes('events')
        ? 'No pudimos publicar el evento ahora. Inténtalo de nuevo más tarde.'
        : (error?.message || 'No se pudo publicar el evento')
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const selectedType = EVENT_TYPES_FORM.find(t => t.id === form.type)

  const handleImageUpload = async files => {
    const file = files?.[0]
    if (!file) return
    setUploadingImage(true)
    try {
      const publicUrl = await uploadPublicationImage({ file, userId: user?.id, folder:'events' })
      s('img_url', publicUrl)
      toast.success('Imagen subida')
    } catch (error) {
      toast.error(getStorageErrorMessage(error))
    } finally {
      setUploadingImage(false)
    }
  }

  const requestPublish = async () => {
    if (loading) return
    if (!validateBeforePublish()) return
    let subscribed = false
    try {
      const status = await getPushStatus()
      subscribed = status.subscribed
    } catch {
      await handleSubmit()
      return
    }
    if (subscribed) {
      await handleSubmit()
    } else {
      setPushModalOpen(true)
    }
  }

  return (
    <div style={{ maxWidth:600, margin:'0 auto', padding:'32px 24px 170px' }}>
      <PostPublishPushModal
        open={pushModalOpen}
        user={user}
        userCanton={form.canton}
        onActivated={handleSubmit}
        onComplete={() => setPushModalOpen(false)}
      />
      <ProgressBar step={step} total={STEPS.length} />
      <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:22, color:C.text, marginBottom:4, letterSpacing:-0.3 }}>{STEPS[step].title}</h1>
      <p style={{ fontFamily:PP, fontSize:12, color:C.light, marginBottom:24 }}>{STEPS[step].sub}</p>

      {/* Step 0 — Event type */}
      {step === 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {EVENT_TYPES_FORM.map(t => {
            const [emoji, ...words] = t.label.split(' ')
            return (
              <button key={t.id} onClick={() => s('type', t.id)}
                style={{ background:form.type===t.id?C.primary:C.surface, borderRadius:16, padding:'15px 16px', display:'flex', alignItems:'center', gap:14, border:`2px solid ${form.type===t.id?C.primary:C.border}`, cursor:'pointer', textAlign:'left', transition:'all .15s' }}>
                <span style={{ fontSize:28, width:36, flex:'0 0 36px', textAlign:'center' }}>{emoji}</span>
                <span style={{ display:'flex', flexDirection:'column', minWidth:0 }}>
                  <span style={{ fontFamily:PP, fontWeight:800, fontSize:14, color:form.type===t.id?'#fff':C.text, marginBottom:3 }}>{words.join(' ')}</span>
                  <span style={{ fontFamily:PP, fontSize:11, color:form.type===t.id?'rgba(255,255,255,0.78)':C.light, lineHeight:1.45 }}>{t.desc}</span>
                </span>
              </button>
            )
          })}
          {errors.type && <p data-error-field="type" style={errorTextStyle}>{errors.type}</p>}
        </div>
      )}

      {/* Step 1 — Date, time, price */}
      {step === 1 && (
        <>
          <Input label="Título del evento (EN ESPAÑOL)" placeholder="Ej: Noche de salsa en Zürich" required value={form.title} onChange={e=>s('title',e.target.value)} error={errors.title} errorKey="title" />
          <div className="grid-2" style={{ gap:10 }}>
            <Input label="Fecha del evento *" type="date" required value={form.date} onChange={e=>setEventDate(e.target.value)} error={errors.date} errorKey="date" />
            <Input label="Hora de inicio" type="time" placeholder="21:00" value={form.time} onChange={e=>s('time',e.target.value)} />
          </div>
          <Input label="Precio de entrada" placeholder="Ej: Gratis · CHF 15 · CHF 10–20" value={form.price} onChange={e=>s('price',e.target.value)} />
        </>
      )}

      {/* Step 2 — Location and description */}
      {step === 2 && (
        <>
          <LocationFields
            canton={form.canton}
            city={form.city}
            onCantonChange={value => s('canton', value)}
            onCityChange={value => s('city', value)}
            cantonRequired
            cantonError={errors.canton}
          />
          <Input label="Lugar / Venue" placeholder="Ej: Rote Fabrik, Club Zukunft, Rosengarten Café" value={form.venue} onChange={e=>s('venue',e.target.value)} />
          <Input label="Descripción del evento (EN ESPAÑOL)" placeholder="Cuéntanos qué habrá, qué pueden esperar los asistentes..." rows={5} value={form.desc} onChange={e=>s('desc',e.target.value)} />
          <ImageUploadField
            label="Imagen del evento (opcional)"
            previewUrl={form.img_url}
            uploading={uploadingImage}
            onFilesSelected={handleImageUpload}
            onRemove={() => s('img_url', '')}
            hint="Puedes subir un cartel, flyer o foto del local. En móvil se abrirá también la cámara."
          />
        </>
      )}

      {/* Step 3 — Organizer and contact */}
      {step === 3 && (
        <>
          <Input label="Nombre del organizador" placeholder="Ej: Asociación Latina Zürich" value={form.host} onChange={e=>s('host',e.target.value)} />
          <Input label="Link de tickets / más info" placeholder="Ej: eventbrite.com/... o instagram.com/..." value={form.link} onChange={e=>s('link',e.target.value)} error={errors.link} errorKey="link" />

          {form.title && (
            <div style={{ background:C.bg, borderRadius:14, padding:'14px 16px', marginTop:10 }}>
              <p style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, marginBottom:10, letterSpacing:0.5 }}>VISTA PREVIA</p>
              {form.img_url && (
                <div style={{ borderRadius:12, overflow:'hidden', marginBottom:10 }}>
                  <OptimizedImage src={form.img_url} alt={form.title || 'Vista previa del evento'} width={760} height={360} resize="cover" quality={76} loading="eager" style={{ width:'100%', maxHeight:180, objectFit:'cover' }} />
                </div>
              )}
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
                {selectedType && (
                  <span style={{ fontFamily:PP, fontSize:10, fontWeight:600, padding:'3px 8px', borderRadius:20, background:'#DBEAFE', color:C.primaryDark }}>{selectedType.label}</span>
                )}
                {form.canton && (
                  <span style={{ fontFamily:PP, fontSize:10, fontWeight:600, padding:'3px 8px', borderRadius:20, background:C.primaryLight, color:C.primary }}>📍 {form.city || form.canton}</span>
                )}
                {form.day && form.month && (
                  <span style={{ fontFamily:PP, fontSize:10, fontWeight:600, padding:'3px 8px', borderRadius:20, background:'#FEF3C7', color:'#92400E' }}>📅 {form.day} {form.month}</span>
                )}
              </div>
              <p style={{ fontFamily:PP, fontWeight:700, fontSize:14, color:C.text, marginBottom:4 }}>{form.title}</p>
              {form.venue && <p style={{ fontFamily:PP, fontSize:11, color:C.mid, marginBottom:2 }}>📍 {form.venue}</p>}
              {form.time && <p style={{ fontFamily:PP, fontSize:11, color:C.mid, marginBottom:2 }}>🕒 {form.time}</p>}
              {form.price && <p style={{ fontFamily:PP, fontWeight:700, fontSize:13, color:C.primary, marginTop:4 }}>🎟 {form.price}</p>}
            </div>
          )}
          <div style={{ background:'#FFF7ED', border:'1px solid #FED7AA', borderRadius:14, padding:'14px 16px', marginTop:14 }}>
            <p style={{ fontFamily:PP, fontWeight:700, fontSize:12, color:'#9A3412', margin:'0 0 6px' }}>⚠️ Responsabilidad del publicador</p>
            <p style={{ fontFamily:PP, fontSize:11, color:'#7C2D12', lineHeight:1.7, margin:0 }}>
              Al publicar este evento confirmas que la información es verídica, que tienes autorización para anunciarlo y que eres responsable de su organización y contenido. Latido no se hace responsable de la veracidad de los datos ni de lo que ocurra en el evento.
            </p>
          </div>
          <PublicationLegalNotice kind="event" />
        </>
      )}

      <p style={{ fontFamily:PP, fontSize:11, color:C.light, textAlign:'center', marginTop:12 }}>
        Gratuito · Se publica al instante si no requiere revisión · Puedes eliminarlo desde tu perfil
      </p>
      <StickyFormActions>
        {step === 0 ? (
          <Btn onClick={() => navigate('/comunidades?view=eventos')} variant="danger" style={{ flex:'0 0 122px', border:'1.5px solid #FCA5A5' }}>← Cancelar</Btn>
        ) : (
          <Btn onClick={() => setStep(s => s - 1)} variant="secondary" style={{ flex:'0 0 122px' }}>← Atrás</Btn>
        )}
        {step < STEPS.length - 1 ? (
          <Btn onClick={() => {
            if (!validateCurrentStep()) return
            setStep(s => s + 1)
          }} style={{ flex:1 }}>
            Continuar →
          </Btn>
        ) : (
          <Btn onClick={requestPublish} disabled={loading} variant="success" style={{ flex:1 }}>
            {loading ? '⏳ Publicando...' : '🎉 Publicar evento'}
          </Btn>
        )}
      </StickyFormActions>
    </div>
  )
}
