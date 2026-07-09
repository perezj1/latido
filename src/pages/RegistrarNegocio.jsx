import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { C, PP } from '../lib/theme'
import { VISIBLE_NEGOCIO_TYPES } from '../lib/constants'
import { Btn, ProgressBar, Input, ImageUploadField, Modal, PublicationLegalNotice, StickyFormActions } from '../components/UI'
import LocationFields from '../components/LocationFields'
import { calculateBusinessVerification } from '../lib/businessVerification'
import { insertWithOptionalColumnsFallback } from '../lib/supabaseCompat'
import { MAX_PUBLICATION_IMAGES, getStorageErrorMessage, uploadPublicationImage, uploadPublicationImages } from '../lib/storage'
import { analyzeContent, getContentFilterMessage } from '../lib/contentFilter'
import { trackPublicationCreated } from '../lib/analytics'
import { addModerationQueueItem } from '../lib/reports'
import PostPublishPushModal from '../components/PostPublishPushModal'
import { getPushStatus } from '../lib/pushNotifications'
import { BUSINESS_PROMOTION_PLAN_DETAIL_LIST, PAID_BUSINESS_FEATURES_VISIBLE } from '../lib/businessPromotion'
import toast from 'react-hot-toast'

const STEPS = [
  { title:'¿Qué tipo de negocio es?',     sub:'Elige la categoría que mejor lo describe' },
  { title:'Nombre y ubicación',           sub:'Primero el cantón; después te sugerimos ciudades' },
  { title:'Contacto y servicios',         sub:'Cómo pueden contactarte y qué ofreces' },
  { title:'Confirma y publica',           sub:'Revisa el resumen antes de enviar' },
]

const NEGOCIO_TYPES_FORM = VISIBLE_NEGOCIO_TYPES.filter(t => t.id !== '')
const PROFESSIONAL_CONFETTI_EMBED_URL = 'https://lottie.host/embed/6a54f360-7100-4a5c-a6ae-a5f2287488d8/lR9bbFp6Qg.json'
const PROFESSIONAL_PLAN_OPTIONS = BUSINESS_PROMOTION_PLAN_DETAIL_LIST
const LANDING_PAGE_MONTHLY_PRICE = 49

export default function RegistrarNegocio() {
  const { isLoggedIn, user } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }) }, [step])
  const [loading, setLoading] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [uploadingGallery, setUploadingGallery] = useState(false)
  const [done, setDone] = useState(false)
  const [publishedForReview, setPublishedForReview] = useState(false)
  const [pushModalOpen, setPushModalOpen] = useState(false)
  const [professionalUnlockOpen, setProfessionalUnlockOpen] = useState(false)
  const [professionalOptionsOpen, setProfessionalOptionsOpen] = useState(false)
  const [professionalOptionsActive, setProfessionalOptionsActive] = useState(false)
  const [selectedProfessionalPlan, setSelectedProfessionalPlan] = useState('')
  const [landingPageSelected, setLandingPageSelected] = useState(false)
  const [form, setForm] = useState({
    type:'', name:'', city:'', canton:'', desc:'', phone:'', email:'', instagram:'', website:'', services:'', photo_url:'', gallery:[],
  })
  const [errors, setErrors] = useState({})
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const websitePattern = /^(https?:\/\/)?[^\s@]+\.[^\s@]{2,}(\/.*)?$/i
  const premiumEmailRequired = selectedProfessionalPlan === 'premium'
  const premiumEmailMessage = 'El email es obligatorio para activar Premium y recibir alertas.'
  const hasContactInfo = () => [form.phone, form.email, form.instagram].some(value => value.trim())
  const errorTextStyle = { fontFamily:PP, fontSize:10.5, color:'#DC2626', margin:'6px 2px 0', lineHeight:1.45 }

  const clearFieldError = key => {
    const relatedKeys = ['phone', 'email', 'instagram'].includes(key)
      ? ['phone', 'email', 'instagram']
      : [key]
    setErrors(prev => {
      let changed = false
      const next = { ...prev }
      relatedKeys.forEach(item => {
        if (next[item]) {
          delete next[item]
          changed = true
        }
      })
      return changed ? next : prev
    })
  }

  const s = (k, v) => {
    setForm(f => ({ ...f, [k]:v }))
    clearFieldError(k)
  }

  const getStepErrors = targetStep => {
    const next = {}
    if (targetStep === 0 && !form.type) {
      next.type = 'Elige el tipo de negocio.'
    }
    if (targetStep === 1) {
      if (!form.name.trim()) next.name = 'Añade el nombre del negocio.'
      if (!form.canton) next.canton = 'Selecciona el cantón del negocio.'
    }
    if (targetStep === 2) {
      const email = form.email.trim()
      if (!hasContactInfo()) {
        const message = 'Añade al menos un contacto: teléfono, email o Instagram.'
        next.phone = message
        next.email = message
        next.instagram = message
      }
      if (premiumEmailRequired && !email) {
        next.email = premiumEmailMessage
      }
      if (email && !emailPattern.test(email)) {
        next.email = 'Introduce un email válido.'
      }
      if (form.website.trim() && !websitePattern.test(form.website.trim())) {
        next.website = 'Introduce una web válida, por ejemplo minegocio.ch.'
      }
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

  const getPublishErrors = () => {
    const next = {
      ...getStepErrors(0),
      ...getStepErrors(1),
      ...getStepErrors(2),
    }
    return next
  }

  const stepForErrors = next => {
    if (next.type) return 0
    if (next.name || next.city || next.canton) return 1
    if (next.phone || next.email || next.instagram || next.website || next.services) return 2
    return step
  }

  const validateBeforePublish = () => {
    const next = getPublishErrors()
    setErrors(next)
    const valid = Object.keys(next).length === 0
    if (!valid) {
      setStep(stepForErrors(next))
      scrollToFirstError(next)
    }
    return valid
  }

  if (!isLoggedIn) return (
    <div style={{ maxWidth:480, margin:'0 auto', padding:'80px 24px', textAlign:'center' }}>
      <div style={{ fontSize:52, marginBottom:16 }}>🔐</div>
      <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:22, color:C.text, marginBottom:10 }}>Necesitas una cuenta</h1>
      <p style={{ fontFamily:PP, fontSize:13, color:C.mid, marginBottom:24, lineHeight:1.7 }}>
        Para registrar tu negocio necesitas una cuenta. Es gratis y sin spam.
      </p>
      <Btn onClick={() => navigate('/auth')}>Crear cuenta gratis</Btn>
      <button onClick={() => navigate('/auth')} style={{ fontFamily:PP, fontWeight:600, fontSize:13, color:C.primary, background:'none', border:`1.5px solid ${C.primaryMid}`, borderRadius:14, padding:'12px 0', width:'100%', cursor:'pointer', marginTop:10 }}>
        Ya tengo cuenta — iniciar sesión
      </button>
    </div>
  )

  if (done) return (
    <div style={{ maxWidth:480, margin:'0 auto', padding:'80px 24px', textAlign:'center' }}>
      <Modal
        show={professionalUnlockOpen}
        onClose={() => setProfessionalUnlockOpen(false)}
        title="Profesional desbloqueado"
        syncHistory={false}
      >
        <div style={{ position:'relative', overflow:'hidden', textAlign:'center', padding:'10px 0 2px' }}>
          <div
            aria-hidden="true"
            style={{
              position:'absolute',
              top:-34,
              left:'50%',
              width:340,
              height:210,
              transform:'translateX(-50%)',
              pointerEvents:'none',
              opacity:.95,
              zIndex:0,
            }}
          >
            <iframe
              title="Confeti profesional"
              src={PROFESSIONAL_CONFETTI_EMBED_URL}
              style={{
                width:'100%',
                height:'100%',
                border:0,
                display:'block',
                pointerEvents:'none',
              }}
            />
          </div>
          <div style={{ width:76, height:76, borderRadius:24, background:C.primaryLight, display:'flex', alignItems:'center', justifyContent:'center', fontSize:38, margin:'8px auto 22px', position:'relative', zIndex:1 }}>
            ✨
          </div>
          <h2 style={{ fontFamily:PP, fontWeight:900, fontSize:21, color:C.text, margin:'0 0 9px', position:'relative', zIndex:1 }}>
            Enhorabuena
          </h2>
          <p style={{ fontFamily:PP, fontSize:13, color:C.mid, lineHeight:1.65, margin:'0 0 18px', position:'relative', zIndex:1 }}>
            Has desbloqueado la sección Profesional. Ahora podrás aprovechar las ventajas profesionales para tu negocio en el perfil.
          </p>
          <button
            type="button"
            onClick={() => navigate('/perfil?seccion=profesional')}
            style={{ width:'100%', border:'none', borderRadius:14, padding:'12px 16px', background:C.primary, color:'#fff', fontFamily:PP, fontWeight:800, fontSize:13, cursor:'pointer', position:'relative', zIndex:1 }}
          >
            Ver ventajas
          </button>
        </div>
      </Modal>
      <div style={{ width:80, height:80, background:C.successLight, borderRadius:24, display:'flex', alignItems:'center', justifyContent:'center', fontSize:42, margin:'0 auto 20px' }}>🏪</div>
      <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:24, color:C.text, marginBottom:10 }}>{publishedForReview ? 'Negocio enviado a revisión' : '¡Negocio publicado!'}</h1>
      <p style={{ fontFamily:PP, fontSize:13, color:C.mid, lineHeight:1.7, marginBottom:24 }}>
        {publishedForReview
          ? 'Tu negocio quedó oculto temporalmente hasta que el equipo lo revise.'
          : 'Tu negocio ya está visible para la comunidad hispanohablante en Suiza.'}
      </p>
      <Btn onClick={() => navigate('/comunidades?view=negocios')}>Ver negocios →</Btn>
      <button onClick={() => { setDone(false); setPublishedForReview(false); setProfessionalUnlockOpen(false); setProfessionalOptionsOpen(false); setProfessionalOptionsActive(false); setSelectedProfessionalPlan(''); setLandingPageSelected(false); setErrors({}); setStep(0); setForm({ type:'', name:'', city:'', canton:'', desc:'', phone:'', email:'', instagram:'', website:'', services:'', photo_url:'', gallery:[] }); }} style={{ fontFamily:PP, fontWeight:600, fontSize:12, color:C.mid, background:'none', border:'none', cursor:'pointer', width:'100%', marginTop:12, padding:'6px 0' }}>
        Registrar otro negocio
      </button>
    </div>
  )

  const handleSubmit = async () => {
    if (!validateBeforePublish()) return
    if (!form.name || !form.canton) { toast.error('Completa el nombre y el cantón'); return }
    const hasContact = [form.phone, form.email, form.instagram].some(value => value.trim())
    if (!hasContact) { toast.error('Añade al menos un método de contacto'); return }
    const moderation = analyzeContent(form.name, form.desc, form.services, form.website)
    if (moderation.action === 'block') {
      toast.error(getContentFilterMessage(moderation))
      return
    }
    setLoading(true)
    try {
      const needsReview = moderation.action === 'review'
      const servicesList = form.services.split(',').map(s => s.trim()).filter(Boolean).slice(0, 3)
      const galleryLimit = Math.max(MAX_PUBLICATION_IMAGES - (form.photo_url ? 1 : 0), 0)
      const galleryPhotos = form.gallery
        .filter(url => url && url !== form.photo_url)
        .slice(0, galleryLimit)
      const existingRes = await supabase
        .from('providers')
        .select('id,name,city,canton,whatsapp,email,website')
        .limit(500)
      const verification = calculateBusinessVerification({
        category: form.type,
        name: form.name,
        city: form.city,
        canton: form.canton,
        description: form.desc,
        phone: form.phone,
        whatsapp: form.phone,
        email: form.email,
        website: form.website,
        photo_url: form.photo_url,
        gallery: form.gallery,
      }, { existingBusinesses: existingRes.data || [] })

      const payload = {
        user_id: user?.id,
        category: form.type,
        name: form.name.trim(),
        city: form.city.trim() || null,
        canton: form.canton,
        description: form.desc.trim() || null,
        whatsapp: form.phone.trim() || null,
        email: form.email.trim() || null,
        instagram: form.instagram.trim() || null,
        website: form.website.trim() || null,
        photo_url: form.photo_url.trim() || null,
        services: servicesList.length ? servicesList : null,
        languages: ['Español'],
        verified: false,
        featured: false,
        active: !needsReview,
        verification_status: verification.status,
        verification_score: verification.score,
        verified_at: null,
        verified_by: null,
        verification_notes: null,
      }

      const { data, error } = await insertWithOptionalColumnsFallback({
        table: 'providers',
        payload,
        optionalColumns: ['verification_status', 'verification_score', 'verified_at', 'verified_by', 'verification_notes'],
        select: 'id',
        single: true,
      })
      if (error) throw error

      if (needsReview && data?.id) {
        await addModerationQueueItem({
          contentType: 'provider',
          contentId: data.id,
          authorId: user?.id,
          reason: 'Filtro automatico',
          excerpt: [form.name, form.desc, form.services].filter(Boolean).join('\n\n').slice(0, 700),
          matchedTerm: moderation.matchedTerm,
          metadata: { category: form.type, canton: form.canton, city: form.city },
        })
      }

      if (galleryPhotos.length && data?.id) {
        const { error: photosError } = await supabase.from('provider_photos').insert(
          galleryPhotos.map((url, index) => ({
            provider_id: data.id,
            url,
            sort_order: index + 1,
          }))
        )
        if (photosError) {
          console.error('Business extra photos failed:', photosError)
          toast.error('El negocio se publicó, pero algunas fotos extra no se pudieron guardar.')
        }
      }

      trackPublicationCreated({
        user_id:user?.id,
        contentType:'business',
        category:form.type,
        needsReview,
      })

      if (PAID_BUSINESS_FEATURES_VISIBLE && selectedProfessionalPlan && !needsReview && data?.id) {
        const checkoutBody = {
          providerId:data.id,
          planKey:selectedProfessionalPlan,
          landingPageEnabled:landingPageSelected,
        }
        const { data: checkout, error: checkoutError } = await supabase.functions
          .invoke('create_business_promotion_checkout', { body:checkoutBody })

        if (checkoutError || !checkout?.url) {
          console.error('Business promotion checkout failed:', checkoutError || checkout)
          toast.error('El negocio se publicó, pero no pudimos abrir el pago. Puedes activarlo desde tu perfil.')
          setPublishedForReview(false)
          setProfessionalUnlockOpen(true)
          setDone(true)
          return
        }

        window.location.assign(checkout.url)
        return
      }

      if (PAID_BUSINESS_FEATURES_VISIBLE && selectedProfessionalPlan && needsReview) {
        toast('El negocio se enviará a revisión antes de poder activar el plan o la landing.', { icon:'ℹ️' })
      }
      setPublishedForReview(needsReview)
      setProfessionalUnlockOpen(PAID_BUSINESS_FEATURES_VISIBLE)
      setDone(true)
    } catch (error) {
      console.error('Register business failed:', error)
      const message = String(error?.message || '')
      if (message.toLowerCase().includes('website')) {
        toast.error('No pudimos registrar el negocio ahora. Inténtalo de nuevo más tarde.')
      } else {
        toast.error(message || 'No se pudo registrar el negocio')
      }
    } finally {
      setLoading(false)
    }
  }

  const selectedType = NEGOCIO_TYPES_FORM.find(t => t.id === form.type)
  const selectedPlanOption = PAID_BUSINESS_FEATURES_VISIBLE
    ? PROFESSIONAL_PLAN_OPTIONS.find(plan => plan.key === selectedProfessionalPlan)
    : null
  const paidLandingPageSelected = PAID_BUSINESS_FEATURES_VISIBLE && selectedPlanOption && landingPageSelected
  const professionalTotal = (selectedPlanOption?.monthlyPrice || 0) + (paidLandingPageSelected ? LANDING_PAGE_MONTHLY_PRICE : 0)
  const hasPaidSelection = PAID_BUSINESS_FEATURES_VISIBLE && Boolean(selectedPlanOption)

  const toggleLandingPageExtra = () => {
    if (!selectedPlanOption) {
      toast('Elige primero un plan profesional.', { icon:'ℹ️' })
      return
    }
    setLandingPageSelected(selected => !selected)
  }

  const handleCoverUpload = async files => {
    const file = files?.[0]
    if (!file) return
    const currentImages = new Set([form.photo_url, ...form.gallery].filter(Boolean))
    if (!form.photo_url && currentImages.size >= MAX_PUBLICATION_IMAGES) {
      toast.error(`Puedes subir un máximo de ${MAX_PUBLICATION_IMAGES} imágenes por publicación.`)
      return
    }
    setUploadingCover(true)
    try {
      const publicUrl = await uploadPublicationImage({ file, userId: user?.id, folder:'providers' })
      setForm(prev => ({
        ...prev,
        photo_url:publicUrl,
        gallery:Array.from(new Set(prev.gallery.filter(url => url && url !== publicUrl)))
          .slice(0, MAX_PUBLICATION_IMAGES - 1),
      }))
      toast.success('Portada subida')
    } catch (error) {
      toast.error(getStorageErrorMessage(error))
    } finally {
      setUploadingCover(false)
    }
  }

  const handleGalleryUpload = async files => {
    if (!files?.length) return
    const currentImages = new Set([form.photo_url, ...form.gallery].filter(Boolean))
    const remainingSlots = MAX_PUBLICATION_IMAGES - currentImages.size
    if (remainingSlots <= 0) {
      toast.error(`Puedes subir un máximo de ${MAX_PUBLICATION_IMAGES} imágenes por publicación.`)
      return
    }
    const selectedFiles = Array.from(files).slice(0, remainingSlots)
    setUploadingGallery(true)
    try {
      const uploadedUrls = await uploadPublicationImages({ files:selectedFiles, userId: user?.id, folder:'providers' })
      setForm(prev => ({
        ...prev,
        gallery:Array.from(new Set([...prev.gallery, ...uploadedUrls]))
          .slice(0, Math.max(MAX_PUBLICATION_IMAGES - (prev.photo_url ? 1 : 0), 0)),
      }))
      toast.success(
        files.length > selectedFiles.length
          ? `${uploadedUrls.length} foto(s) añadida(s). Máximo ${MAX_PUBLICATION_IMAGES} por publicación.`
          : `${uploadedUrls.length} foto(s) añadida(s)`
      )
    } catch (error) {
      toast.error(getStorageErrorMessage(error))
    } finally {
      setUploadingGallery(false)
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

      {/* Step 0 — Business type */}
      {step === 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {NEGOCIO_TYPES_FORM.map(t => {
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
          {errors.type && (
            <p data-error-field="type" style={errorTextStyle}>
              {errors.type}
            </p>
          )}
        </div>
      )}

      {/* Step 1 — Name, location, description */}
      {step === 1 && (
        <>
          <Input label="Nombre del negocio *" placeholder="Ej: El Rincón Colombiano" required value={form.name} onChange={e=>s('name',e.target.value)} error={errors.name} errorKey="name" />
          <LocationFields
            canton={form.canton}
            city={form.city}
            onCantonChange={value => s('canton', value)}
            onCityChange={value => s('city', value)}
            cantonRequired
            cantonError={errors.canton}
            cityError={errors.city}
          />
          <Input label="Descripción (EN ESPAÑOL)" placeholder="Cuéntanos qué ofrece tu negocio, qué os hace especiales..." rows={5} value={form.desc} onChange={e=>s('desc',e.target.value)} />
        </>
      )}

      {/* Step 2 — Contact and services */}
      {step === 2 && (
        <>
          <Input label="Teléfono / WhatsApp" placeholder="079 123 45 67 o +41 79 123 45 67" value={form.phone} onChange={e=>s('phone',e.target.value)} error={errors.phone} errorKey="phone" />
          <Input label={premiumEmailRequired ? 'Email *' : 'Email'} type="email" placeholder="hola@minegocio.ch" value={form.email} onChange={e=>s('email',e.target.value)} error={errors.email} errorKey="email" />
          <Input label="Instagram" placeholder="@minegocio_zh" value={form.instagram} onChange={e=>s('instagram',e.target.value)} error={errors.instagram} errorKey="instagram" />
          <Input label="Web (opcional)" type="url" placeholder="minegocio.ch" value={form.website} onChange={e=>s('website',e.target.value)} error={errors.website} errorKey="website" />
          <p style={{ fontFamily:PP, fontSize:11, color:C.light, marginTop:-4, marginBottom:12, lineHeight:1.6 }}>
            Añade al menos un contacto: teléfono, email o Instagram. La web es opcional y se mostrará en tu perfil.{premiumEmailRequired ? ' Para Premium el email es obligatorio porque las alertas se envían ahí.' : ''}
          </p>
          <Input label="Los 3 servicios principales que ofrece tu empresa" placeholder="Ej: Arepas, Menú casero, Delivery (separados por coma)" value={form.services} onChange={e=>s('services',e.target.value)} error={errors.services} errorKey="services" />
          <p style={{ fontFamily:PP, fontSize:11, color:C.light, marginTop:-8, marginBottom:12, lineHeight:1.6 }}>
            Estos tres servicios ayudan a que la comunidad entienda rápido qué ofrece tu negocio.
          </p>
          <ImageUploadField
            label="Foto de portada (opcional)"
            previewUrl={form.photo_url}
            uploading={uploadingCover}
            onFilesSelected={handleCoverUpload}
            onRemove={() => s('photo_url', '')}
            hint="Esta será la imagen principal del negocio dentro de la página Comunidad."
          />
          <ImageUploadField
            label="Más fotos (opcional)"
            previewUrls={form.gallery}
            uploading={uploadingGallery}
            multiple
            maxImages={MAX_PUBLICATION_IMAGES}
            currentImageCount={new Set([form.photo_url, ...form.gallery].filter(Boolean)).size}
            onFilesSelected={handleGalleryUpload}
            onRemoveAt={index => setForm(prev => ({ ...prev, gallery:prev.gallery.filter((_, itemIndex) => itemIndex !== index) }))}
            hint={`Puedes añadir hasta ${MAX_PUBLICATION_IMAGES} imágenes en total, contando la portada.`}
          />
        </>
      )}

      {/* Step 3 — Preview */}
      {step === 3 && (
        <>
        <div style={{ background:C.bg, borderRadius:16, padding:'16px 18px' }}>
          <p style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, marginBottom:12, letterSpacing:0.5 }}>RESUMEN DE TU NEGOCIO</p>
          {form.photo_url && (
            <div style={{ borderRadius:14, overflow:'hidden', marginBottom:12 }}>
              <img src={form.photo_url} alt={form.name || 'Vista previa del negocio'} style={{ width:'100%', maxHeight:190, objectFit:'contain', background:'#fff' }} />
            </div>
          )}
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
            {selectedType && (
              <span style={{ fontFamily:PP, fontSize:10, fontWeight:600, padding:'3px 8px', borderRadius:20, background:'#DBEAFE', color:C.primaryDark }}>{selectedType.label}</span>
            )}
            {form.canton && (
              <span style={{ fontFamily:PP, fontSize:10, fontWeight:600, padding:'3px 8px', borderRadius:20, background:C.primaryLight, color:C.primary }}>📍 {form.city || form.canton}</span>
            )}
          </div>
          <p style={{ fontFamily:PP, fontWeight:800, fontSize:17, color:C.text, marginBottom:6 }}>{form.name || '—'}</p>
          {form.desc && <p style={{ fontFamily:PP, fontSize:12, color:C.mid, lineHeight:1.65, marginBottom:form.website ? 8 : 10, whiteSpace:'pre-line' }}>{form.desc}</p>}
          {form.website && <p style={{ fontFamily:PP, fontSize:11, color:C.primary, margin:'0 0 10px' }}>🌐 {form.website}</p>}
          {form.services && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:10 }}>
              {form.services.split(',').map(s => s.trim()).filter(Boolean).slice(0,3).map(sv => (
                <span key={sv} style={{ fontFamily:PP, fontSize:11, fontWeight:600, background:C.primaryLight, color:C.primary, padding:'5px 11px', borderRadius:10 }}>{sv}</span>
              ))}
            </div>
          )}
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {form.phone && <span style={{ fontFamily:PP, fontSize:11, color:C.mid }}>💬 {form.phone}</span>}
            {form.email && <span style={{ fontFamily:PP, fontSize:11, color:C.mid }}>✉️ {form.email}</span>}
            {form.instagram && <span style={{ fontFamily:PP, fontSize:11, color:C.mid }}>📸 {form.instagram}</span>}
            {form.website && <span style={{ fontFamily:PP, fontSize:11, color:C.mid }}>🌐 {form.website}</span>}
            {form.gallery.length > 0 && <span style={{ fontFamily:PP, fontSize:11, color:C.mid }}>📷 {form.gallery.length} foto(s) extra</span>}
          </div>
        </div>
        {PAID_BUSINESS_FEATURES_VISIBLE && (
        <div style={{ marginTop:16 }}>
          <p style={{ fontFamily:PP, fontSize:10, fontWeight:800, color:C.light, letterSpacing:.7, margin:'0 2px 8px' }}>EXTRAS</p>
        <section style={{ marginTop:0, border:`1.5px solid ${professionalOptionsActive ? C.primary : C.border}`, borderRadius:16, background:'#fff', overflow:'hidden' }}>
          <div style={{ padding:'12px 14px 12px 16px', display:'flex', alignItems:'center', gap:12 }}>
          <button
            type="button"
            aria-expanded={professionalOptionsOpen}
            onClick={() => {
              if (!professionalOptionsActive) setProfessionalOptionsActive(true)
              setProfessionalOptionsOpen(open => professionalOptionsActive ? !open : true)
            }}
            style={{ flex:1, minWidth:0, padding:0, border:'none', background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', gap:12, textAlign:'left' }}
          >
            <span style={{ display:'flex', alignItems:'center', gap:11 }}>
              <span style={{ width:34, height:34, borderRadius:11, background:C.primaryLight, display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:17 }}>🚀</span>
              <span>
                <span style={{ display:'block', fontFamily:PP, fontWeight:800, fontSize:13, color:C.text }}>Potenciar tu negocio</span>
                <span style={{ display:'block', fontFamily:PP, fontSize:11, color:C.light, marginTop:2 }}>
                  {selectedPlanOption
                    ? `${selectedPlanOption.label}${paidLandingPageSelected ? ' + Landing' : ''} · CHF ${professionalTotal}/mes`
                    : professionalOptionsActive
                      ? 'Elige un plan para activarlo'
                      : 'Opcional · elige un plan cuando quieras'}
                </span>
              </span>
            </span>
          </button>
          <button
            type="button"
            role="switch"
            aria-checked={professionalOptionsActive}
            aria-label={professionalOptionsActive ? 'Desactivar potenciar tu negocio' : 'Activar potenciar tu negocio'}
            onClick={() => {
              if (professionalOptionsActive) {
                setProfessionalOptionsActive(false)
                setSelectedProfessionalPlan('')
                setLandingPageSelected(false)
                setProfessionalOptionsOpen(false)
              } else {
                setProfessionalOptionsActive(true)
                setProfessionalOptionsOpen(true)
              }
            }}
            style={{ width:46, height:28, flex:'0 0 46px', padding:3, border:'none', borderRadius:999, background:professionalOptionsActive ? C.primary : '#CBD5E1', cursor:'pointer', transition:'background .18s ease' }}
          >
            <span style={{ width:22, height:22, borderRadius:'50%', background:'#fff', display:'block', transform:professionalOptionsActive ? 'translateX(18px)' : 'translateX(0)', transition:'transform .18s ease', boxShadow:'0 1px 3px rgba(15,23,42,.2)' }} />
          </button>
          </div>

          {professionalOptionsOpen && (
            <div style={{ borderTop:`1px solid ${C.border}`, padding:'0 14px 16px' }}>
              <p style={{ fontFamily:PP, fontSize:12, color:C.mid, lineHeight:1.6, margin:'14px 2px 12px' }}>
                Elige un plan para dar más visibilidad a tu empresa. El cobro se realizará de forma segura en Stripe después de publicar.
              </p>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {PROFESSIONAL_PLAN_OPTIONS.map(plan => {
                  const selected = selectedProfessionalPlan === plan.key
                  return (
                    <div
                      key={plan.key}
                      style={{ border:`1.5px solid ${selected ? plan.color : C.border}`, borderRadius:13, padding:'12px', background:selected ? plan.soft : '#fff', display:'flex', flexDirection:'column', gap:selected ? 10 : 0, position:'relative' }}
                    >
                      {selected && (
                        <span style={{ position:'absolute', top:-10, right:16, fontFamily:PP, fontWeight:900, fontSize:9, letterSpacing:.5, color:plan.color, background:selected ? plan.soft : '#fff', border:`1px solid ${plan.color}`, borderRadius:999, padding:'4px 8px', lineHeight:1 }}>
                          SELECCIONADO
                        </span>
                      )}
                      <div style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
                        <button
                          type="button"
                          onClick={() => setSelectedProfessionalPlan(plan.key)}
                          style={{ flex:1, minWidth:0, border:'none', background:'transparent', padding:0, cursor:'pointer', textAlign:'left', display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}
                        >
                          <span style={{ minWidth:0 }}>
                            <span style={{ display:'block', fontFamily:PP, fontWeight:800, fontSize:12, color:C.text }}>{plan.label}</span>
                            <span style={{ display:'block', fontFamily:PP, fontSize:10.5, color:C.mid, lineHeight:1.45, marginTop:3 }}>{plan.description}</span>
                          </span>
                          <span style={{ flex:'0 0 auto', fontFamily:PP, fontWeight:900, fontSize:12, color:plan.color }}>CHF {plan.monthlyPrice}<small style={{ fontSize:9, fontWeight:700 }}> /mes</small></span>
                        </button>
                      </div>
                      {selected && (
                        <div style={{ width:'100%', borderTop:`1px solid ${plan.color}33`, paddingTop:10 }}>
                          <p style={{ fontFamily:PP, fontWeight:800, fontSize:10.5, color:plan.color, margin:'0 0 8px' }}>
                            Incluye:
                          </p>
                          <div style={{ display:'grid', gap:7 }}>
                            {plan.benefits.map(benefit => (
                              <div key={benefit} style={{ display:'flex', alignItems:'flex-start', gap:7 }}>
                                <span style={{ width:17, height:17, flex:'0 0 17px', borderRadius:999, background:'#fff', color:plan.color, display:'inline-flex', alignItems:'center', justifyContent:'center', fontFamily:PP, fontWeight:900, fontSize:10, marginTop:1 }}>
                                  ✓
                                </span>
                                <span style={{ fontFamily:PP, fontSize:10.7, color:C.mid, lineHeight:1.45 }}>
                                  {benefit}
                                </span>
                              </div>
                            ))}
                          </div>
                          {plan.key === 'premium' && (
                            <p style={{ fontFamily:PP, fontSize:10.5, color:'#9A3412', background:'#FFF7ED', border:'1px solid #FED7AA', borderRadius:10, padding:'8px 9px', margin:'10px 0 0', lineHeight:1.45 }}>
                              Premium incluye alertas de clientes. Necesitamos un email válido del negocio para enviarlas.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <button
                type="button"
                onClick={() => { setProfessionalOptionsActive(false); setSelectedProfessionalPlan(''); setLandingPageSelected(false); setProfessionalOptionsOpen(false) }}
                style={{ width:'100%', border:'none', background:'transparent', cursor:'pointer', padding:'12px 4px 0', color:C.mid, fontFamily:PP, fontWeight:700, fontSize:11 }}
              >
                Continuar solo con el perfil gratuito
              </button>
            </div>
          )}
        </section>
        <div style={{ marginTop:12 }}>
          <div style={{ width:'100%', padding:'12px 14px 12px 16px', border:`1.5px solid ${landingPageSelected ? C.primary : C.border}`, borderRadius:16, background:landingPageSelected ? C.primaryLight : '#fff', display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ width:34, height:34, flex:'0 0 34px', borderRadius:11, background:'#ECFEFF', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:17 }}>📣</span>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
                <button
                  type="button"
                  onClick={toggleLandingPageExtra}
                  style={{ flex:1, minWidth:0, padding:0, border:'none', background:'transparent', cursor:'pointer', textAlign:'left', fontFamily:PP, fontWeight:800, fontSize:13, color:C.text }}
                >
                  Landing page en Latido
                </button>
                <button
                  type="button"
                  role="switch"
                  aria-checked={landingPageSelected}
                  aria-label={landingPageSelected ? 'Desactivar landing page en Latido' : 'Activar landing page en Latido'}
                  onClick={toggleLandingPageExtra}
                  style={{ width:46, height:28, flex:'0 0 46px', padding:3, border:'none', borderRadius:999, background:landingPageSelected ? C.primary : '#CBD5E1', cursor:'pointer', transition:'background .18s ease' }}
                >
                  <span style={{ width:22, height:22, borderRadius:'50%', background:'#fff', display:'block', transform:landingPageSelected ? 'translateX(18px)' : 'translateX(0)', transition:'transform .18s ease', boxShadow:'0 1px 3px rgba(15,23,42,.2)' }} />
                </button>
              </div>
              <button
                type="button"
                onClick={toggleLandingPageExtra}
                style={{ width:'100%', marginTop:4, padding:0, border:'none', background:'transparent', cursor:'pointer', display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:18, textAlign:'left' }}
              >
                <span style={{ minWidth:0, fontFamily:PP, fontSize:11, color:C.light, lineHeight:1.45 }}>Crea una página dedicada Latido x Negocio con tus servicios, zona y botones de contacto.</span>
                <span style={{ flex:'0 0 auto', marginTop:22, marginLeft:8, fontFamily:PP, fontWeight:900, fontSize:12, color:'#0F9F8E', whiteSpace:'nowrap' }}>CHF 49<small style={{ fontSize:9, fontWeight:700 }}> /mes</small></span>
              </button>
            </div>
          </div>
          {hasPaidSelection && (
            <div style={{ marginTop:12, borderRadius:12, background:C.bg, padding:'12px', display:'grid', gap:8 }}>
              {selectedPlanOption && (
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
                  <span style={{ fontFamily:PP, fontSize:11, color:C.mid }}>{selectedPlanOption.label}</span>
                  <span style={{ fontFamily:PP, fontWeight:800, fontSize:12, color:C.text, whiteSpace:'nowrap' }}>CHF {selectedPlanOption.monthlyPrice}<small style={{ fontSize:9, color:C.light }}> /mes</small></span>
                </div>
              )}
              {paidLandingPageSelected && (
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
                  <span style={{ fontFamily:PP, fontSize:11, color:C.mid }}>Landing page en Latido</span>
                  <span style={{ fontFamily:PP, fontWeight:800, fontSize:12, color:C.text, whiteSpace:'nowrap' }}>CHF {LANDING_PAGE_MONTHLY_PRICE}<small style={{ fontSize:9, color:C.light }}> /mes</small></span>
                </div>
              )}
              <div style={{ height:1, background:C.border, margin:'2px 0' }} />
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
                <span style={{ fontFamily:PP, fontSize:11, fontWeight:800, color:C.text }}>Total mensual</span>
                <span style={{ fontFamily:PP, fontWeight:900, fontSize:16, color:C.text, whiteSpace:'nowrap' }}>CHF {professionalTotal}<small style={{ fontSize:10, color:C.light }}> /mes</small></span>
              </div>
            </div>
          )}
        </div>
        </div>
        )}
        <div style={{ background:'#FFF7ED', border:'1px solid #FED7AA', borderRadius:14, padding:'14px 16px', marginTop:14 }}>
          <p style={{ fontFamily:PP, fontWeight:700, fontSize:12, color:'#9A3412', margin:'0 0 6px' }}>⚠️ Responsabilidad del publicador</p>
          <p style={{ fontFamily:PP, fontSize:11, color:'#7C2D12', lineHeight:1.7, margin:0 }}>
            Al registrar este negocio confirmas que la información publicada es verídica, que tienes autorización para representarlo y que eres responsable del contenido y la atención al cliente. Latido no se hace responsable de la veracidad de los datos ni de los servicios prestados.
          </p>
        </div>
        <PublicationLegalNotice kind="business" />
        </>
      )}

      <p style={{ fontFamily:PP, fontSize:11, color:C.light, textAlign:'center', marginTop:12 }}>
        {hasPaidSelection
          ? `Total elegido: CHF ${professionalTotal}/mes · El pago se procesa de forma segura en Stripe.`
          : 'Gratuito · Se publica al instante si no requiere revisión · Puedes eliminarlo desde tu perfil'}
      </p>
      <StickyFormActions>
        {step === 0 ? (
          <Btn onClick={() => navigate('/comunidades?view=negocios')} variant="danger" style={{ flex:'0 0 122px', border:'1.5px solid #FCA5A5' }}>← Cancelar</Btn>
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
            {loading
              ? '⏳ Registrando...'
              : hasPaidSelection
                ? '💳 Publicar y pagar'
                : '🏪 Registrar negocio'}
          </Btn>
        )}
      </StickyFormActions>
    </div>
  )
}
