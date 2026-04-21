import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { C, PP } from '../lib/theme'
import { NEGOCIO_TYPES, CANTONS } from '../lib/constants'
import { Btn, ProgressBar, Input, Select, ImageUploadField } from '../components/UI'
import { getStorageErrorMessage, uploadPublicationImage, uploadPublicationImages } from '../lib/storage'
import toast from 'react-hot-toast'

const STEPS = [
  { title:'¿Qué tipo de negocio es?',    sub:'Elige la categoría que mejor lo describe' },
  { title:'Nombre, ciudad y descripción', sub:'La información básica de tu negocio' },
  { title:'Contacto y servicios',         sub:'Cómo pueden contactarte y qué ofreces' },
  { title:'Confirma y publica',           sub:'Revisa el resumen antes de enviar' },
]

const NEGOCIO_TYPES_FORM = NEGOCIO_TYPES.filter(t => t.id !== '')

export default function RegistrarNegocio() {
  const { isLoggedIn, user } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }) }, [step])
  const [loading, setLoading] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [uploadingGallery, setUploadingGallery] = useState(false)
  const [done, setDone] = useState(false)
  const [form, setForm] = useState({
    type:'', name:'', city:'', canton:'', desc:'', phone:'', email:'', instagram:'', website:'', services:'', photo_url:'', gallery:[],
  })
  const s = (k, v) => setForm(f => ({ ...f, [k]:v }))

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
      <div style={{ width:80, height:80, background:C.successLight, borderRadius:24, display:'flex', alignItems:'center', justifyContent:'center', fontSize:42, margin:'0 auto 20px' }}>🏪</div>
      <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:24, color:C.text, marginBottom:10 }}>¡Negocio publicado!</h1>
      <p style={{ fontFamily:PP, fontSize:13, color:C.mid, lineHeight:1.7, marginBottom:24 }}>
        Tu negocio ya está visible para la comunidad latina en Suiza.
      </p>
      <Btn onClick={() => navigate('/comunidades?view=negocios')}>Ver negocios →</Btn>
      <button onClick={() => { setDone(false); setStep(0); setForm({ type:'', name:'', city:'', canton:'', desc:'', phone:'', email:'', instagram:'', website:'', services:'', photo_url:'', gallery:[] }); }} style={{ fontFamily:PP, fontWeight:600, fontSize:12, color:C.mid, background:'none', border:'none', cursor:'pointer', width:'100%', marginTop:12, padding:'6px 0' }}>
        Registrar otro negocio
      </button>
    </div>
  )

  const handleSubmit = async () => {
    if (!form.name || !form.canton) { toast.error('Completa el nombre y el cantón'); return }
    const hasContact = [form.phone, form.email, form.instagram].some(value => value.trim())
    if (!hasContact) { toast.error('Añade al menos un método de contacto'); return }
    setLoading(true)
    const servicesList = form.services.split(',').map(s => s.trim()).filter(Boolean).slice(0, 6)
    const galleryPhotos = form.gallery.filter(url => url && url !== form.photo_url)
    try {
      const { data, error } = await supabase.from('providers').insert({
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
        active: true,
      }).select('id').single()
      if (error) throw error

      if (galleryPhotos.length && data?.id) {
        const { error: photosError } = await supabase.from('provider_photos').insert(
          galleryPhotos.map((url, index) => ({
            provider_id: data.id,
            url,
            sort_order: index + 1,
          }))
        )
        if (photosError) {
          toast.error('El negocio se publicó, pero algunas fotos extra no se pudieron guardar')
        }
      }

      setDone(true)
    } catch (error) {
      const message = String(error?.message || '')
      if (message.toLowerCase().includes('website')) {
        toast.error('Falta actualizar Supabase para negocios. Ejecuta publications_schema_v4.sql.')
      } else {
        toast.error(message || 'No se pudo registrar el negocio')
      }
    } finally {
      setLoading(false)
    }
  }

  const selectedType = NEGOCIO_TYPES_FORM.find(t => t.id === form.type)

  const handleCoverUpload = async files => {
    const file = files?.[0]
    if (!file) return
    setUploadingCover(true)
    try {
      const publicUrl = await uploadPublicationImage({ file, userId: user?.id, folder:'providers' })
      s('photo_url', publicUrl)
      toast.success('Portada subida')
    } catch (error) {
      toast.error(getStorageErrorMessage(error))
    } finally {
      setUploadingCover(false)
    }
  }

  const handleGalleryUpload = async files => {
    if (!files?.length) return
    setUploadingGallery(true)
    try {
      const uploadedUrls = await uploadPublicationImages({ files, userId: user?.id, folder:'providers' })
      setForm(prev => ({ ...prev, gallery:[...prev.gallery, ...uploadedUrls] }))
      toast.success(`${uploadedUrls.length} foto(s) añadida(s)`)
    } catch (error) {
      toast.error(getStorageErrorMessage(error))
    } finally {
      setUploadingGallery(false)
    }
  }

  return (
    <div style={{ maxWidth:600, margin:'0 auto', padding:'32px 24px 100px' }}>
      <ProgressBar step={step} total={STEPS.length} />
      <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:22, color:C.text, marginBottom:4, letterSpacing:-0.3 }}>{STEPS[step].title}</h1>
      <p style={{ fontFamily:PP, fontSize:12, color:C.light, marginBottom:24 }}>{STEPS[step].sub}</p>

      {/* Step 0 — Business type */}
      {step === 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:10 }}>
          {NEGOCIO_TYPES_FORM.map(t => {
            const [emoji, ...words] = t.label.split(' ')
            return (
              <button key={t.id} onClick={() => s('type', t.id)}
                style={{ background:form.type===t.id?C.primary:C.surface, borderRadius:16, padding:'18px 14px', display:'flex', flexDirection:'column', gap:7, border:`2px solid ${form.type===t.id?C.primary:C.border}`, cursor:'pointer', textAlign:'left', transition:'all .15s' }}>
                <span style={{ fontSize:26 }}>{emoji}</span>
                <span style={{ fontFamily:PP, fontWeight:700, fontSize:13, color:form.type===t.id?'#fff':C.text }}>{words.join(' ')}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Step 1 — Name, location, description */}
      {step === 1 && (
        <>
          <Input label="Nombre del negocio *" placeholder="Ej: El Rincón Colombiano" required value={form.name} onChange={e=>s('name',e.target.value)} />
          <div className="grid-2" style={{ gap:10 }}>
            <Input label="Ciudad" placeholder="Zürich" value={form.city} onChange={e=>s('city',e.target.value)} />
            <Select label="Cantón *" required value={form.canton} onChange={e=>s('canton',e.target.value)}>
              <option value="">Seleccionar...</option>
              {CANTONS.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
            </Select>
          </div>
          <Input label="Descripción" placeholder="Cuéntanos qué ofrece tu negocio, qué os hace especiales..." rows={5} value={form.desc} onChange={e=>s('desc',e.target.value)} />
        </>
      )}

      {/* Step 2 — Contact and services */}
      {step === 2 && (
        <>
          <Input label="Teléfono / WhatsApp" placeholder="+41 79 123 45 67" value={form.phone} onChange={e=>s('phone',e.target.value)} />
          <Input label="Email" type="email" placeholder="hola@minegocio.ch" value={form.email} onChange={e=>s('email',e.target.value)} />
          <Input label="Instagram" placeholder="@minegocio_zh" value={form.instagram} onChange={e=>s('instagram',e.target.value)} />
          <Input label="Web (opcional)" type="url" placeholder="minegocio.ch" value={form.website} onChange={e=>s('website',e.target.value)} />
          <p style={{ fontFamily:PP, fontSize:11, color:C.light, marginTop:-4, marginBottom:12, lineHeight:1.6 }}>
            Añade al menos un contacto: teléfono, email o Instagram. La web es opcional y se mostrará en tu perfil.
          </p>
          <Input label="Servicios principales" placeholder="Ej: Arepas, Menú casero, Delivery (separados por coma)" value={form.services} onChange={e=>s('services',e.target.value)} />
          <p style={{ fontFamily:PP, fontSize:11, color:C.light, marginTop:-8, marginBottom:12, lineHeight:1.6 }}>
            Lista tus servicios o productos principales separados por coma. Máximo 6.
          </p>
          <ImageUploadField
            label="Foto de portada (opcional)"
            previewUrl={form.photo_url}
            uploading={uploadingCover}
            onFilesSelected={handleCoverUpload}
            onRemove={() => s('photo_url', '')}
            hint="Esta será la imagen principal del negocio dentro de comunidad."
          />
          <ImageUploadField
            label="Más fotos (opcional)"
            previewUrls={form.gallery}
            uploading={uploadingGallery}
            multiple
            onFilesSelected={handleGalleryUpload}
            onRemoveAt={index => setForm(prev => ({ ...prev, gallery:prev.gallery.filter((_, itemIndex) => itemIndex !== index) }))}
            hint="Puedes añadir varias fotos del local, platos, productos o ambiente."
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
              <img src={form.photo_url} alt={form.name || 'Vista previa del negocio'} style={{ width:'100%', maxHeight:190, objectFit:'cover' }} />
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
          {form.desc && <p style={{ fontFamily:PP, fontSize:12, color:C.mid, lineHeight:1.65, marginBottom:form.website ? 8 : 10 }}>{form.desc}</p>}
          {form.website && <p style={{ fontFamily:PP, fontSize:11, color:C.primary, margin:'0 0 10px' }}>🌐 {form.website}</p>}
          {form.services && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:10 }}>
              {form.services.split(',').map(s => s.trim()).filter(Boolean).slice(0,6).map(sv => (
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
        <div style={{ background:'#FFF7ED', border:'1px solid #FED7AA', borderRadius:14, padding:'14px 16px', marginTop:14 }}>
          <p style={{ fontFamily:PP, fontWeight:700, fontSize:12, color:'#9A3412', margin:'0 0 6px' }}>⚠️ Responsabilidad del publicador</p>
          <p style={{ fontFamily:PP, fontSize:11, color:'#7C2D12', lineHeight:1.7, margin:0 }}>
            Al registrar este negocio confirmas que la información publicada es verídica, que tienes autorización para representarlo y que eres responsable del contenido y la atención al cliente. Latido no se hace responsable de la veracidad de los datos ni de los servicios prestados.
          </p>
        </div>
        </>
      )}

      {/* Navigation */}
      <div style={{ display:'flex', gap:10, marginTop:24 }}>
        {step > 0 && (
          <Btn onClick={() => setStep(s => s - 1)} variant="secondary" style={{ flex:'0 0 100px' }}>← Atrás</Btn>
        )}
        {step < STEPS.length - 1 ? (
          <Btn onClick={() => {
            if (step === 0 && !form.type) { toast.error('Selecciona el tipo de negocio'); return }
            if (step === 1 && !form.name) { toast.error('Añade el nombre del negocio'); return }
            setStep(s => s + 1)
          }} style={{ flex:1 }}>
            Continuar →
          </Btn>
        ) : (
          <Btn onClick={handleSubmit} disabled={loading} variant="success" style={{ flex:1 }}>
            {loading ? '⏳ Registrando...' : '🏪 Registrar negocio'}
          </Btn>
        )}
      </div>
      <p style={{ fontFamily:PP, fontSize:11, color:C.light, textAlign:'center', marginTop:12 }}>
        Gratuito · Se publica al instante · Puedes eliminarlo desde tu perfil
      </p>
    </div>
  )
}
