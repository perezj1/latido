import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { C, PP } from '../lib/theme'
import { COMMUNITY_CATS } from '../lib/constants'
import { Btn, ProgressBar, Input, ImageUploadField, PublicationLegalNotice, StickyFormActions } from '../components/UI'
import LocationFields from '../components/LocationFields'
import { uploadPublicationImage } from '../lib/storage'
import { analyzeContent, getContentFilterMessage } from '../lib/contentFilter'
import { trackPublicationCreated } from '../lib/analytics'
import { addModerationQueueItem } from '../lib/reports'
import PostPublishPushModal from '../components/PostPublishPushModal'
import { getPushStatus } from '../lib/pushNotifications'
import toast from 'react-hot-toast'

const STEPS = [
  { title:'¿De qué trata tu grupo?',  sub:'Elige la categoría que mejor lo describe' },
  { title:'Nombre, plataforma y ubicación', sub:'Indica si es para toda Suiza o una ciudad concreta' },
  { title:'Descripción y enlace',         sub:'Cuéntanos más y añade el link de invitación' },
  { title:'Confirma y publica',           sub:'Revisa el resumen antes de enviar' },
]

const COMMUNITY_OPTIONS = COMMUNITY_CATS
  .filter(item => item.id !== 'fe')
  .map(item => item.id === 'mamas'
    ? { ...item, id:'familia', emoji:'👨‍👩‍👧', label:'Familia', desc:'Familias, crianza, apoyo y planes con niños' }
    : item)

const PLATFORMS = [
  { id:'whatsapp',  emoji:'💬', label:'WhatsApp' },
  { id:'telegram',  emoji:'📲', label:'Telegram' },
  { id:'facebook',  emoji:'👥', label:'Facebook' },
  { id:'discord',   emoji:'🎮', label:'Discord' },
  { id:'instagram', emoji:'📸', label:'Instagram' },
  { id:'web',       emoji:'🌐', label:'Web' },
  { id:'otro',      emoji:'🔗', label:'Otro' },
]

const LANGUAGES = ['Español', 'Español / Alemán', 'Español / Francés', 'Español / Italiano', 'Multilingüe']

export default function RegistrarComunidad() {
  const { isLoggedIn, user } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }) }, [step])
  const [loading, setLoading] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [done, setDone] = useState(false)
  const [publishedForReview, setPublishedForReview] = useState(false)
  const [pushModalOpen, setPushModalOpen] = useState(false)
  const [form, setForm] = useState({
    cat:'', name:'', platform:'', city:'', canton:'', desc:'', contact:'', lang:'Español', photo_url:'',
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
  const getStepErrors = targetStep => {
    const next = {}
    if (targetStep === 0 && !form.cat) next.cat = 'Elige la categoría del grupo.'
    if (targetStep === 1) {
      if (!form.name.trim()) next.name = 'Añade el nombre del grupo.'
      if (!form.platform) next.platform = 'Elige la plataforma del grupo.'
    }
    if (targetStep === 2 && !form.contact.trim()) next.contact = 'Añade el enlace de invitación.'
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
    const next = { ...getStepErrors(0), ...getStepErrors(1), ...getStepErrors(2) }
    setErrors(next)
    if (Object.keys(next).length === 0) return true
    if (next.cat) setStep(0)
    else if (next.name || next.platform) setStep(1)
    else setStep(2)
    scrollToFirstError(next)
    return false
  }

  if (!isLoggedIn) return (
    <div style={{ maxWidth:480, margin:'0 auto', padding:'80px 24px', textAlign:'center' }}>
      <div style={{ fontSize:52, marginBottom:16 }}>🔐</div>
      <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:22, color:C.text, marginBottom:10 }}>Necesitas una cuenta</h1>
      <p style={{ fontFamily:PP, fontSize:13, color:C.mid, marginBottom:24, lineHeight:1.7 }}>
        Para registrar tu grupo necesitas una cuenta. Es gratis y sin spam.
      </p>
      <Btn onClick={() => navigate('/auth')}>Crear cuenta gratis</Btn>
      <button onClick={() => navigate('/auth')} style={{ fontFamily:PP, fontWeight:600, fontSize:13, color:C.primary, background:'none', border:`1.5px solid ${C.primaryMid}`, borderRadius:14, padding:'12px 0', width:'100%', cursor:'pointer', marginTop:10 }}>
        Ya tengo cuenta — iniciar sesión
      </button>
    </div>
  )

  if (done) return (
    <div style={{ maxWidth:480, margin:'0 auto', padding:'80px 24px', textAlign:'center' }}>
      <div style={{ width:80, height:80, background:C.successLight, borderRadius:24, display:'flex', alignItems:'center', justifyContent:'center', fontSize:42, margin:'0 auto 20px' }}>👥</div>
      <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:24, color:C.text, marginBottom:10 }}>{publishedForReview ? 'Grupo enviado a revisión' : '¡Grupo publicado!'}</h1>
      <p style={{ fontFamily:PP, fontSize:13, color:C.mid, lineHeight:1.7, marginBottom:24 }}>
        {publishedForReview
          ? 'Tu grupo quedó oculto temporalmente hasta que el equipo lo revise.'
          : 'Tu grupo ya está visible para la comunidad hispanohablante en Suiza.'}
      </p>
      <Btn onClick={() => navigate('/comunidades')}>Ver grupos →</Btn>
      <button onClick={() => { setDone(false); setPublishedForReview(false); setErrors({}); setStep(0); setForm({ cat:'', name:'', platform:'', city:'', canton:'', desc:'', contact:'', lang:'Español', photo_url:'' }); }} style={{ fontFamily:PP, fontWeight:600, fontSize:12, color:C.mid, background:'none', border:'none', cursor:'pointer', width:'100%', marginTop:12, padding:'6px 0' }}>
        Registrar otro grupo
      </button>
    </div>
  )

  const handleSubmit = async () => {
    if (!validateBeforePublish()) return
    if (!form.name || !form.contact) { toast.error('Completa el nombre y el enlace de invitación'); return }
    const moderation = analyzeContent(form.name, form.desc, form.contact)
    if (moderation.action === 'block') {
      toast.error(getContentFilterMessage(moderation))
      return
    }
    setLoading(true)
    try {
      const communityId = globalThis.crypto?.randomUUID?.()
      const needsReview = moderation.action === 'review'
      const location = [form.city.trim(), form.canton].filter(Boolean).join(', ') || 'Toda Suiza'
      const description = [
        form.desc.trim(),
        selectedPlat?.label ? `Plataforma: ${selectedPlat.label}` : '',
        form.lang ? `Idioma: ${form.lang}` : '',
      ].filter(Boolean).join('\n\n')

      const { error } = await supabase.from('communities').insert({
        ...(communityId ? { id: communityId } : {}),
        user_id: user?.id,
        cat: form.cat || null,
        name: form.name.trim(),
        city: location,
        emoji: selectedCat?.emoji || '👥',
        desc: description || null,
        contact: form.contact.trim(),
        photo_url: form.photo_url || null,
        verified: false,
        members: 0,
        active: !needsReview,
      })
      if (error) throw error
      if (needsReview && communityId) {
        await addModerationQueueItem({
          contentType: 'community',
          contentId: communityId,
          authorId: user?.id,
          reason: 'Filtro automatico',
          excerpt: [form.name, form.desc, form.contact].filter(Boolean).join('\n\n').slice(0, 700),
          matchedTerm: moderation.matchedTerm,
          metadata: { cat: form.cat, platform: form.platform, canton: form.canton },
        })
      }
      trackPublicationCreated({
        user_id:user?.id,
        contentType:'community',
        category:form.cat,
        channel:form.platform,
        needsReview,
      })
      setPublishedForReview(needsReview)
      setDone(true)
    } catch (error) {
      toast.error(error?.message || 'No se pudo registrar el grupo')
    } finally {
      setLoading(false)
    }
  }

  const handlePhotoUpload = async (file) => {
    setUploadingPhoto(true)
    try {
      const publicUrl = await uploadPublicationImage({ file, userId: user?.id, folder:'communities' })
      s('photo_url', publicUrl)
      toast.success('Foto subida')
    } catch {
      toast.error('No se pudo subir la foto')
    } finally {
      setUploadingPhoto(false)
    }
  }

  const selectedCat = COMMUNITY_OPTIONS.find(c => c.id === form.cat)
  const selectedPlat = PLATFORMS.find(p => p.id === form.platform)

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

      {/* Step 0 — Category */}
      {step === 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {COMMUNITY_OPTIONS.map(cat => (
            <button key={cat.id} onClick={() => s('cat', cat.id)}
              style={{ background:form.cat===cat.id?C.primary:C.surface, borderRadius:16, padding:'15px 16px', display:'flex', alignItems:'center', gap:14, border:`2px solid ${form.cat===cat.id?C.primary:C.border}`, cursor:'pointer', textAlign:'left', transition:'all .15s' }}>
              <span style={{ fontSize:28, width:36, flex:'0 0 36px', textAlign:'center' }}>{cat.emoji}</span>
              <span style={{ display:'flex', flexDirection:'column', minWidth:0 }}>
                <span style={{ fontFamily:PP, fontWeight:800, fontSize:14, color:form.cat===cat.id?'#fff':C.text, marginBottom:3 }}>{cat.label}</span>
                <span style={{ fontFamily:PP, fontSize:11, color:form.cat===cat.id?'rgba(255,255,255,0.78)':C.light, lineHeight:1.45 }}>{cat.desc}</span>
              </span>
            </button>
          ))}
          {errors.cat && <p data-error-field="cat" style={errorTextStyle}>{errors.cat}</p>}
        </div>
      )}

      {/* Step 1 — Name, platform, city */}
      {step === 1 && (
        <>
          <Input label="Nombre del grupo *" placeholder="Ej: Venezolanos en Zürich" required value={form.name} onChange={e=>s('name',e.target.value)} error={errors.name} errorKey="name" />

          <p style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, letterSpacing:1, marginBottom:10 }}>PLATAFORMA</p>
          <div data-error-field="platform" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:8, marginBottom:errors.platform ? 6 : 16 }}>
            {PLATFORMS.map(p => (
              <button key={p.id} onClick={() => s('platform', p.id)}
                style={{ background:form.platform===p.id?C.primaryLight:'#fff', border:`1.5px solid ${form.platform===p.id?C.primary:C.border}`, borderRadius:12, padding:'12px 10px', cursor:'pointer', display:'flex', alignItems:'center', gap:8, transition:'all .15s' }}>
                <span style={{ fontSize:18 }}>{p.emoji}</span>
                <span style={{ fontFamily:PP, fontWeight:600, fontSize:12, color:form.platform===p.id?C.primary:C.text }}>{p.label}</span>
              </button>
            ))}
          </div>
          {errors.platform && <p style={{ ...errorTextStyle, marginBottom:16 }}>{errors.platform}</p>}

          <LocationFields
            canton={form.canton}
            city={form.city}
            onCantonChange={value => s('canton', value)}
            onCityChange={value => s('city', value)}
            allowAllSwitzerland
            hint="Deja “Toda Suiza” si el grupo no depende de una ciudad concreta."
          />
        </>
      )}

      {/* Step 2 — Description and link */}
      {step === 2 && (
        <>
          <ImageUploadField
            label="Foto de portada (opcional)"
            previewUrl={form.photo_url}
            uploading={uploadingPhoto}
            onFilesSelected={files => handlePhotoUpload(files?.[0])}
            onRemove={() => s('photo_url', '')}
          />
          <Input label="Descripción del grupo (EN ESPAÑOL)" placeholder="¿A quién está dirigido? ¿Qué hacéis juntos? ¿Cuándo os reunís?" rows={5} value={form.desc} onChange={e=>s('desc',e.target.value)} />
          <Input label={form.platform === 'web' ? 'URL de la web *' : 'Enlace de invitación *'} placeholder={
            form.platform === 'whatsapp'  ? 'https://chat.whatsapp.com/...' :
            form.platform === 'telegram'  ? 'https://t.me/...' :
            form.platform === 'facebook'  ? 'https://facebook.com/groups/...' :
            form.platform === 'discord'   ? 'https://discord.gg/...' :
            form.platform === 'instagram' ? 'https://instagram.com/...' :
            form.platform === 'web'       ? 'https://www.tuweb.ch' :
            'https://...'
          } required value={form.contact} onChange={e=>s('contact',e.target.value)} error={errors.contact} errorKey="contact" />
          {form.platform && form.platform !== 'web' && (
            <div style={{ background:'#FFFBEB', border:'1px solid #FCD34D', borderRadius:12, padding:'12px 14px', marginTop:-8, marginBottom:16 }}>
              <p style={{ fontFamily:PP, fontWeight:700, fontSize:11, color:'#92400E', margin:'0 0 6px' }}>
                {form.platform === 'whatsapp'  && '💬 ¿Cómo conseguir el enlace de WhatsApp?'}
                {form.platform === 'telegram'  && '📲 ¿Cómo conseguir el enlace de Telegram?'}
                {form.platform === 'facebook'  && '👥 ¿Cómo conseguir el enlace del grupo de Facebook?'}
                {form.platform === 'discord'   && '🎮 ¿Cómo conseguir el enlace de Discord?'}
                {form.platform === 'instagram' && '📸 ¿Cómo conseguir el enlace de Instagram?'}
                {form.platform === 'otro'      && '🔗 Añade el enlace directo a tu grupo'}
              </p>
              <p style={{ fontFamily:PP, fontSize:11, color:'#78350F', margin:0, lineHeight:1.7 }}>
                {form.platform === 'whatsapp'  && 'Abre el grupo → toca el icono de agregar miembros → "Invitar con enlace o QR" → "Copiar enlace".'}
                {form.platform === 'telegram'  && 'Abre el grupo o canal → toca el nombre → "Añadir miembros" → "Invitar con enlace" → copia el enlace.'}
                {form.platform === 'facebook'  && 'Entra al grupo → toca los 3 puntos → "Compartir grupo" → copia el enlace de la URL.'}
                {form.platform === 'discord'   && 'Abre el servidor → haz clic derecho en un canal → "Invitar personas" → "Copia enlace".'}
                {form.platform === 'instagram' && 'Añade el enlace directo a tu perfil o cuenta de Instagram (ej: instagram.com/migrupo).'}
                {form.platform === 'otro'      && 'Copia y pega el enlace directo donde la gente pueda unirse o contactaros.'}
              </p>
            </div>
          )}

          <div style={{ marginBottom:16 }}>
            <p style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, letterSpacing:1, marginBottom:10 }}>IDIOMA PRINCIPAL</p>
            <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
              {LANGUAGES.map(lang => (
                <button key={lang} onClick={() => s('lang', lang)}
                  style={{ fontFamily:PP, fontSize:11, fontWeight:600, padding:'7px 14px', borderRadius:20, border:`1.5px solid ${form.lang===lang?C.primary:C.border}`, background:form.lang===lang?C.primary:'#fff', color:form.lang===lang?'#fff':C.mid, cursor:'pointer', transition:'all .12s' }}>
                  {lang}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Step 3 — Preview */}
      {step === 3 && (
        <>
        <div style={{ background:C.bg, borderRadius:16, padding:'16px 18px' }}>
          <p style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, marginBottom:12, letterSpacing:0.5 }}>RESUMEN DE TU GRUPO</p>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
            {selectedCat && (
              <span style={{ fontFamily:PP, fontSize:10, fontWeight:600, padding:'3px 8px', borderRadius:20, background:'#D1FAE5', color:'#065F46' }}>{selectedCat.emoji} {selectedCat.label}</span>
            )}
            {selectedPlat && (
              <span style={{ fontFamily:PP, fontSize:10, fontWeight:600, padding:'3px 8px', borderRadius:20, background:C.primaryLight, color:C.primary }}>{selectedPlat.emoji} {selectedPlat.label}</span>
            )}
            {(form.city || form.canton) && (
              <span style={{ fontFamily:PP, fontSize:10, fontWeight:600, padding:'3px 8px', borderRadius:20, background:C.bg, color:C.mid }}>📍 {form.city || form.canton}</span>
            )}
          </div>
          <p style={{ fontFamily:PP, fontWeight:800, fontSize:17, color:C.text, marginBottom:6 }}>{form.name || '—'}</p>
          {form.desc && <p style={{ fontFamily:PP, fontSize:12, color:C.mid, lineHeight:1.65, marginBottom:10, whiteSpace:'pre-line' }}>{form.desc}</p>}
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
            {form.lang && <span style={{ fontFamily:PP, fontSize:11, color:C.mid }}>🗣 {form.lang}</span>}
            {form.contact && (
              <span style={{ fontFamily:PP, fontSize:10, color:C.light, wordBreak:'break-all' }}>🔗 {form.contact.length > 40 ? form.contact.slice(0, 40) + '…' : form.contact}</span>
            )}
          </div>
        </div>
        <div style={{ background:'#FFF7ED', border:'1px solid #FED7AA', borderRadius:14, padding:'14px 16px', marginTop:14 }}>
          <p style={{ fontFamily:PP, fontWeight:700, fontSize:12, color:'#9A3412', margin:'0 0 6px' }}>⚠️ Responsabilidad del publicador</p>
          <p style={{ fontFamily:PP, fontSize:11, color:'#7C2D12', lineHeight:1.7, margin:0 }}>
            Al registrar este grupo confirmas que la información es verídica y que eres responsable del buen uso, contenido y gestión del grupo. Latido no se hace responsable de lo que ocurra dentro del grupo ni de la veracidad de los datos publicados.
          </p>
        </div>
        <PublicationLegalNotice kind="community" />
        </>
      )}

      <p style={{ fontFamily:PP, fontSize:11, color:C.light, textAlign:'center', marginTop:12 }}>
        Gratuito · Se publica al instante si no requiere revisión · Puedes eliminarlo desde tu perfil
      </p>
      <StickyFormActions>
        {step === 0 ? (
          <Btn onClick={() => navigate('/comunidades')} variant="danger" style={{ flex:'0 0 122px', border:'1.5px solid #FCA5A5' }}>← Cancelar</Btn>
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
            {loading ? '⏳ Registrando...' : '👥 Registrar grupo'}
          </Btn>
        )}
      </StickyFormActions>
    </div>
  )
}
