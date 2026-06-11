import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { C, PP } from '../lib/theme'
import { Btn, ProgressBar, Input, ImageUploadField, PublicationLegalNotice, SearchBeforePublishNotice, StickyFormActions } from '../components/UI'
import LocationFields from '../components/LocationFields'
import { getStorageErrorMessage, uploadPublicationImage } from '../lib/storage'
import { insertWithOptionalColumnsFallback, isLikelySchemaMismatchError } from '../lib/supabaseCompat'
import { analyzeContent, getContentFilterMessage } from '../lib/contentFilter'
import { addModerationQueueItem } from '../lib/reports'
import { JOB_INTENTS, JOB_SECTORS, JOB_TYPES } from '../lib/constants'
import PostPublishPushModal from '../components/PostPublishPushModal'
import { getPushStatus } from '../lib/pushNotifications'
import toast from 'react-hot-toast'

const STEPS = [
  { title:'¿Qué publicación de empleo es?', sub:'Elige si publicas una oferta o tu perfil buscando trabajo' },
  { title:'Datos principales', sub:'Puesto, disponibilidad, ubicación y salario' },
  { title:'Detalles y revisión', sub:'Idiomas, descripción y resumen final antes de publicar' },
]

const LANG_OPTIONS = ['Español', 'Alemán', 'Francés', 'Italiano', 'Inglés']
const SALARY_UNITS = [
  { id:'hora', label:'Por hora' },
  { id:'dia', label:'Por día' },
  { id:'semana', label:'Por semana' },
  { id:'mes', label:'Por mes' },
  { id:'ano', label:'Por año' },
  { id:'once', label:'Pago único' },
]

const OPTIONAL_JOB_INSERT_COLUMNS = ['job_intent', 'sector', 'languages', 'contact_via_app', 'contact_phone', 'contact_email', 'contact_link', 'logo_url']

const createInitialForm = () => ({
  jobIntent:'', sector:'', title:'', company:'', jobType:'',
  city:'', canton:'', salaryValue:'', salaryUnit:'mes', langs:[], desc:'', logoUrl:'',
})

export default function PublicarEmpleo() {
  const { isLoggedIn, user, isBanned, bannedReason } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }) }, [step])
  const [loading, setLoading] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [done, setDone] = useState(false)
  const [publishedForReview, setPublishedForReview] = useState(false)
  const [pushModalOpen, setPushModalOpen] = useState(false)
  const [form, setForm] = useState(createInitialForm)
  const s = (k, v) => setForm(f => ({ ...f, [k]:v }))
  const toggleLang = lang => setForm(f => ({
    ...f,
    langs: f.langs.includes(lang) ? f.langs.filter(l => l !== lang) : [...f.langs, lang],
  }))
  const selectedIntent = JOB_INTENTS.find(intent => intent.id === form.jobIntent)
  const isSeekingJob = form.jobIntent === 'busca'

  const getFormattedSalary = () => {
    const value = String(form.salaryValue || '').trim()
    if (!value) return ''

    if (form.salaryUnit === 'once') return `CHF ${value} total`
    if (form.salaryUnit === 'hora') return `CHF ${value} / hora`
    if (form.salaryUnit === 'dia') return `CHF ${value} / día`
    if (form.salaryUnit === 'semana') return `CHF ${value} / semana`
    if (form.salaryUnit === 'mes') return `CHF ${value} / mes`
    if (form.salaryUnit === 'ano') return `CHF ${value} / año`

    return `CHF ${value}`
  }

  if (!isLoggedIn) return (
    <div style={{ maxWidth:480, margin:'0 auto', padding:'80px 24px', textAlign:'center' }}>
      <div style={{ fontSize:52, marginBottom:16 }}>🔐</div>
      <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:22, color:C.text, marginBottom:10 }}>Necesitas una cuenta</h1>
      <p style={{ fontFamily:PP, fontSize:13, color:C.mid, marginBottom:24, lineHeight:1.7 }}>
        Para publicar empleos necesitas registrarte. Es gratis, rápido y sin spam.
      </p>
      <Btn onClick={() => navigate('/auth')}>Crear cuenta gratis</Btn>
      <button onClick={() => navigate('/auth')} style={{ fontFamily:PP, fontWeight:600, fontSize:13, color:C.primary, background:'none', border:`1.5px solid ${C.primaryMid}`, borderRadius:14, padding:'12px 0', width:'100%', cursor:'pointer', marginTop:10 }}>
        Ya tengo cuenta — iniciar sesión
      </button>
    </div>
  )

  if (isBanned) return (
    <div style={{ maxWidth:480, margin:'0 auto', padding:'80px 24px', textAlign:'center' }}>
      <div style={{ fontSize:52, marginBottom:16 }}>⛔</div>
      <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:22, color:C.text, marginBottom:10 }}>Cuenta suspendida</h1>
      <p style={{ fontFamily:PP, fontSize:13, color:C.mid, marginBottom:24, lineHeight:1.7 }}>
        No puedes publicar ofertas ahora.{bannedReason ? ` Motivo: ${bannedReason}` : ''}
      </p>
      <Btn variant="secondary" onClick={() => navigate('/')}>Volver al inicio</Btn>
    </div>
  )

  if (done) return (
    <div style={{ maxWidth:480, margin:'0 auto', padding:'80px 24px', textAlign:'center' }}>
      <div style={{ width:80, height:80, background:C.successLight, borderRadius:24, display:'flex', alignItems:'center', justifyContent:'center', fontSize:42, margin:'0 auto 20px' }}>💼</div>
      <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:24, color:C.text, marginBottom:10 }}>{publishedForReview ? 'Publicación enviada a revisión' : '¡Empleo publicado!'}</h1>
      <p style={{ fontFamily:PP, fontSize:13, color:C.mid, lineHeight:1.7, marginBottom:24 }}>
        {publishedForReview
          ? 'Tu publicación quedó pendiente para aprobarla desde administración antes de mostrarse.'
          : isSeekingJob
            ? 'Tu búsqueda ya está visible para la comunidad. Las personas interesadas podrán escribirte por mensaje dentro de Latido.'
            : 'Tu oferta ya está visible para miles de personas en Suiza. Los candidatos te escribirán por mensaje dentro de Latido.'}
      </p>
      <Btn onClick={() => navigate('/tablon?cat=empleo')}>Ver empleos →</Btn>
      <button onClick={() => { setDone(false); setPublishedForReview(false); setStep(0); setForm(createInitialForm()); }} style={{ fontFamily:PP, fontWeight:600, fontSize:12, color:C.mid, background:'none', border:'none', cursor:'pointer', width:'100%', marginTop:12, padding:'6px 0' }}>
        Publicar otro empleo
      </button>
    </div>
  )

  const handleSubmit = async () => {
    if (!form.jobIntent) { toast.error('Elige si buscas u ofreces empleo'); return }
    if (!form.sector) { toast.error('Elige el sector del empleo'); return }
    if (!form.title || !form.canton) { toast.error('Completa el título y el cantón'); return }
    const moderation = analyzeContent(form.title, form.company, form.desc)
    if (moderation.action === 'block') {
      toast.error(getContentFilterMessage(moderation))
      return
    }

    setLoading(true)
    try {
      const jobId = globalThis.crypto?.randomUUID?.()
      const needsReview = moderation.action === 'review'
      const finalSalary = getFormattedSalary() || null
      const salaryAmount = form.salaryValue
        ? Number(String(form.salaryValue).replace(',', '.'))
        : null
      const payload = {
        ...(jobId ? { id: jobId } : {}),
        user_id: user?.id,
        job_intent: form.jobIntent,
        sector: form.sector,
        title: form.title.trim(),
        company: form.company.trim() || null,
        type: form.jobType,
        city: form.city.trim() || form.canton,
        canton: form.canton,
        salary: finalSalary,
        salary_amount: Number.isNaN(salaryAmount) ? null : salaryAmount,
        salary_unit: form.salaryValue ? form.salaryUnit : null,
        lang: form.langs.length ? form.langs.join(' · ') : null,
        languages: form.langs.length ? form.langs : null,
        category: form.sector || null,
        emoji: selectedSector?.emoji || '💼',
        desc: form.desc.trim() || null,
        contact_via_app: true,
        contact: null,
        contact_phone: null,
        contact_email: null,
        contact_link: null,
        logo_url: form.logoUrl.trim() || null,
        active: !needsReview,
      }

      const { error } = await insertWithOptionalColumnsFallback({
        table: 'jobs',
        payload,
        optionalColumns: OPTIONAL_JOB_INSERT_COLUMNS,
      })
      if (error) throw error
      if (needsReview && jobId) {
        await addModerationQueueItem({
          contentType: 'job',
          contentId: jobId,
          authorId: user?.id,
          reason: 'Filtro automatico',
          excerpt: [form.title, form.company, form.desc].filter(Boolean).join('\n\n').slice(0, 700),
          matchedTerm: moderation.matchedTerm,
          metadata: { job_intent: form.jobIntent, sector: form.sector, type: form.jobType },
        })
      }
      setPublishedForReview(needsReview)
      setDone(true)
    } catch (error) {
      console.error('Publish job failed:', error)
      if (isLikelySchemaMismatchError(error, 'jobs')) {
        toast.error('No pudimos publicar la oferta ahora. Inténtalo de nuevo más tarde.')
      } else {
        toast.error(error?.message || 'No se pudo publicar la oferta de empleo')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleLogoUpload = async (files) => {
    const file = files[0]
    if (!file) return
    setUploadingLogo(true)
    try {
      const publicUrl = await uploadPublicationImage({ file, userId: user?.id, folder:'jobs' })
      s('logoUrl', publicUrl)
      toast.success('Imagen subida')
    } catch (error) {
      toast.error(getStorageErrorMessage(error))
    } finally {
      setUploadingLogo(false)
    }
  }

  const requestPublish = async () => {
    if (loading) return
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

  const selectedSector = JOB_SECTORS.find(s => s.id === form.sector)
  const selectedType = JOB_TYPES.find(t => t.id === form.jobType)

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

      {/* Step 0 — Intención y sector */}
      {step === 0 && (
        <>
          <p style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, letterSpacing:1, marginBottom:10 }}>TIPO DE PUBLICACIÓN</p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(210px, 1fr))', gap:10, marginBottom:18 }}>
            {JOB_INTENTS.map(intent => (
              <button key={intent.id} onClick={() => s('jobIntent', intent.id)}
                style={{ background:form.jobIntent===intent.id?C.primaryLight:'#fff', borderRadius:16, padding:'12px 14px', minHeight:78, display:'flex', alignItems:'center', gap:12, border:`2px solid ${form.jobIntent===intent.id?C.primary:C.border}`, cursor:'pointer', textAlign:'left', transition:'all .15s' }}>
                <span style={{ fontSize:26, lineHeight:1 }}>{intent.emoji}</span>
                <span style={{ display:'block' }}>
                  <span style={{ display:'block', fontFamily:PP, fontWeight:800, fontSize:13.5, color:form.jobIntent===intent.id?C.primary:C.text, margin:'0 0 3px', lineHeight:1.25 }}>{intent.label}</span>
                  <span style={{ display:'block', fontFamily:PP, fontSize:10.5, color:C.light, lineHeight:1.35 }}>{intent.desc}</span>
                </span>
              </button>
            ))}
          </div>

          {isSeekingJob && (
            <div style={{ marginBottom:18 }}>
              <SearchBeforePublishNotice
                kind="job"
                onSearch={() => navigate('/tablon?cat=empleo&jobIntent=ofrece')}
              />
            </div>
          )}

          <p style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, letterSpacing:1, marginBottom:10 }}>
            {isSeekingJob ? 'SECTOR EN EL QUE BUSCAS TRABAJO' : 'SECTOR DE LA OFERTA'}
          </p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:10 }}>
            {JOB_SECTORS.map(sector => (
              <button key={sector.id} onClick={() => s('sector', sector.id)}
                style={{ background:form.sector===sector.id?C.primaryLight:'#fff', borderRadius:16, padding:'16px 14px', minHeight:150, display:'flex', flexDirection:'column', alignItems:'flex-start', gap:8, border:`2px solid ${form.sector===sector.id?C.primary:C.border}`, cursor:'pointer', textAlign:'left', transition:'all .15s' }}>
                <span style={{ fontSize:28, lineHeight:1 }}>{sector.emoji}</span>
                <div>
                  <p style={{ fontFamily:PP, fontWeight:800, fontSize:13, color:form.sector===sector.id?C.primary:C.text, margin:'0 0 4px', lineHeight:1.25 }}>{sector.label}</p>
                  <p style={{ fontFamily:PP, fontSize:10.5, color:C.light, margin:0, lineHeight:1.45 }}>{sector.sub}</p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Step 1 — Título, tipo de contrato, ubicación y salario */}
      {step === 1 && (
        <>
          <Input
            label={isSeekingJob ? 'Puesto o trabajo que buscas (EN ESPAÑOL)' : 'Título del puesto (EN ESPAÑOL)'}
            placeholder={isSeekingJob ? 'Ej: Busco trabajo de limpieza, cocinero/a, cuidadora...' : 'Ej: Cocinero/a, Cuidadora, Técnico IT'}
            required
            value={form.title}
            onChange={e=>s('title',e.target.value)}
          />
          <Input
            label={isSeekingJob ? 'Nombre o perfil profesional (opcional)' : 'Empresa o nombre del empleador (opcional)'}
            placeholder={isSeekingJob ? 'Ej: María, cuidadora con experiencia' : 'Ej: Restaurante El Rincón, Familia particular'}
            value={form.company}
            onChange={e=>s('company',e.target.value)}
          />

          <p style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, letterSpacing:1, marginBottom:10 }}>{isSeekingJob ? 'TIPO DE CONTRATO O DISPONIBILIDAD' : 'TIPO DE CONTRATO'}</p>
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:20 }}>
            {JOB_TYPES.map(t => (
              <button key={t.id} onClick={() => s('jobType', t.id)}
                style={{ background:form.jobType===t.id?C.primaryLight:'#fff', border:`1.5px solid ${form.jobType===t.id?C.primary:C.border}`, borderRadius:14, padding:'13px 16px', cursor:'pointer', display:'flex', gap:12, alignItems:'center', textAlign:'left', transition:'all .15s' }}>
                <span style={{ fontSize:22 }}>{t.emoji}</span>
                <div>
                  <p style={{ fontFamily:PP, fontWeight:700, fontSize:13, color:form.jobType===t.id?C.primary:C.text, margin:'0 0 2px' }}>{t.label}</p>
                  <p style={{ fontFamily:PP, fontSize:11, color:C.light, margin:0 }}>{isSeekingJob ? t.seekingDesc : t.desc}</p>
                </div>
              </button>
            ))}
          </div>

          <LocationFields
            canton={form.canton}
            city={form.city}
            onCantonChange={value => s('canton', value)}
            onCityChange={value => s('city', value)}
            cantonRequired
          />

          <div style={{ marginBottom:4 }}>
            <label style={{ display:'block', fontFamily:PP, fontSize:12, fontWeight:700, color:C.text, marginBottom:8 }}>
              {isSeekingJob ? 'Salario deseado (opcional)' : 'Salario o remuneración (opcional)'}
            </label>
            <div style={{ display:'flex', gap:8, alignItems:'stretch' }}>
              <div style={{ display:'flex', border:`1.5px solid ${C.border}`, borderRadius:14, overflow:'hidden', flex:1, background:'#fff' }}>
                <div style={{ padding:'13px 14px', background:C.primaryLight, color:C.primary, fontWeight:800, fontSize:12, whiteSpace:'nowrap', display:'flex', alignItems:'center' }}>
                  CHF
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Ej: 4200"
                  value={form.salaryValue}
                  onChange={e => s('salaryValue', e.target.value.replace(/[^0-9.,]/g, ''))}
                  style={{ flex:1, border:'none', outline:'none', background:'transparent', padding:'13px 14px', fontFamily:PP, fontSize:13, color:C.text }}
                />
              </div>
              <select
                value={form.salaryUnit}
                onChange={e => s('salaryUnit', e.target.value)}
                style={{ border:`1.5px solid ${C.border}`, borderRadius:14, padding:'0 12px', fontFamily:PP, fontSize:12, color:C.text, background:'#fff', cursor:'pointer', minWidth:100 }}
              >
                {SALARY_UNITS.map(unit => <option key={unit.id} value={unit.id}>{unit.label}</option>)}
              </select>
            </div>
            {form.salaryValue && (
              <p style={{ fontFamily:PP, fontSize:11, color:C.primary, margin:'8px 0 0', background:C.primaryLight, padding:'8px 12px', borderRadius:10 }}>
                Se mostrará como: <strong>{getFormattedSalary()}</strong>
              </p>
            )}
          </div>
        </>
      )}

      {/* Step 2 — Logo, idiomas, descripción, resumen y publicar */}
      {step === 2 && (
        <>
          <ImageUploadField
            label={isSeekingJob ? 'Foto o imagen de perfil (opcional)' : 'Logo o imagen de la empresa (opcional)'}
            previewUrl={form.logoUrl}
            uploading={uploadingLogo}
            onFilesSelected={handleLogoUpload}
            onRemove={() => s('logoUrl', '')}
            hint={isSeekingJob ? 'Se mostrará en la tarjeta y detalle de tu búsqueda.' : 'Se mostrará en la tarjeta y detalle de la oferta.'}
          />

          <p style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, letterSpacing:1, marginBottom:10 }}>IDIOMAS REQUERIDOS (OPCIONAL)</p>
          <div style={{ display:'flex', flexWrap:'wrap', gap:7, marginBottom:20 }}>
            {LANG_OPTIONS.map(lang => (
              <button key={lang} onClick={() => toggleLang(lang)}
                style={{ fontFamily:PP, fontSize:11, fontWeight:600, padding:'7px 14px', borderRadius:20, border:`1.5px solid ${form.langs.includes(lang)?C.primary:C.border}`, background:form.langs.includes(lang)?C.primary:'#fff', color:form.langs.includes(lang)?'#fff':C.mid, cursor:'pointer', transition:'all .12s' }}>
                {lang}
              </button>
            ))}
          </div>

          <Input
            label={isSeekingJob ? 'Descripción de tu perfil (EN ESPAÑOL)' : 'Descripción del puesto (EN ESPAÑOL)'}
            placeholder={isSeekingJob ? 'Cuenta tu experiencia, disponibilidad, permisos, idiomas y el tipo de trabajo que buscas...' : 'Qué hará el candidato, requisitos, experiencia necesaria, condiciones...'}
            rows={4}
            value={form.desc}
            onChange={e=>s('desc',e.target.value)}
          />

          {/* Resumen antes de publicar */}
          <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:16, padding:'16px', marginBottom:4 }}>
            <p style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, letterSpacing:0.5, marginBottom:12 }}>RESUMEN DEL EMPLEO</p>
            <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
              <span style={{ fontSize:30, flexShrink:0 }}>{selectedSector?.emoji || '💼'}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ fontFamily:PP, fontWeight:800, fontSize:15, color:C.text, margin:'0 0 6px' }}>{form.title}</p>
                <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:4 }}>
                  {selectedIntent && <span style={{ fontFamily:PP, fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20, background:isSeekingJob?'#FEF3C7':'#E0F2FE', color:isSeekingJob?'#92400E':'#0369A1' }}>{selectedIntent.emoji} {selectedIntent.label}</span>}
                  {selectedSector && <span style={{ fontFamily:PP, fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20, background:'#DBEAFE', color:C.primaryDark }}>{selectedSector.label}</span>}
                  {selectedType && <span style={{ fontFamily:PP, fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20, background:'#D1FAE5', color:'#065F46' }}>{selectedType.label}</span>}
                  {form.canton && <span style={{ fontFamily:PP, fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20, background:C.primaryLight, color:C.primary }}>📍 {form.city || form.canton}</span>}
                </div>
                {form.company && <p style={{ fontFamily:PP, fontSize:12, color:C.mid, margin:'0 0 2px' }}>{isSeekingJob ? '👤' : '🏢'} {form.company}</p>}
                {form.salaryValue && <p style={{ fontFamily:PP, fontWeight:700, fontSize:13, color:C.primary, margin:0 }}>{getFormattedSalary()}</p>}
              </div>
            </div>
          </div>

          <div style={{ background:'#FFF7ED', border:'1px solid #FED7AA', borderRadius:14, padding:'14px 16px', marginBottom:4 }}>
            <p style={{ fontFamily:PP, fontWeight:700, fontSize:12, color:'#9A3412', margin:'0 0 6px' }}>⚠️ Responsabilidad del publicador</p>
            <p style={{ fontFamily:PP, fontSize:11, color:'#7C2D12', lineHeight:1.7, margin:0 }}>
              {isSeekingJob
                ? 'Al publicar confirmas que la información sobre tu perfil y disponibilidad es real. Latido no se hace responsable de los acuerdos laborales entre usuarios.'
                : 'Al publicar confirmas que la oferta es real y que tienes autorización para contratar. Latido no se hace responsable de las condiciones laborales ofrecidas.'}
            </p>
          </div>
          <PublicationLegalNotice kind="job" />
        </>
      )}

      <p style={{ fontFamily:PP, fontSize:11, color:C.light, textAlign:'center', marginTop:12 }}>
        Empleo está separado de los anuncios normales para distinguir ofertas de trabajo y perfiles disponibles.
      </p>
      <StickyFormActions>
        {step === 0 ? (
          <Btn onClick={() => navigate('/tablon?cat=empleo')} variant="danger" style={{ flex:'0 0 122px', border:'1.5px solid #FCA5A5' }}>← Cancelar</Btn>
        ) : (
          <Btn onClick={() => setStep(s => s - 1)} variant="secondary" style={{ flex:'0 0 122px' }}>← Atrás</Btn>
        )}
        {step === 0 ? (
          <Btn onClick={() => {
            if (!form.jobIntent) { toast.error('Elige si buscas u ofreces empleo'); return }
            if (!form.sector) { toast.error('Elige el sector del empleo'); return }
            setStep(1)
          }} style={{ flex:1 }}>
            Continuar →
          </Btn>
        ) : step === 1 ? (
          <Btn onClick={() => {
            if (!form.title) { toast.error('Añade el título del puesto'); return }
            if (!form.jobType) { toast.error('Selecciona el tipo de contrato'); return }
            if (!form.canton) { toast.error('Selecciona el cantón'); return }
            setStep(2)
          }} style={{ flex:1 }}>
            Continuar →
          </Btn>
        ) : (
          <Btn onClick={requestPublish} disabled={loading} variant="success" style={{ flex:1 }}>
            {loading ? '⏳ Publicando...' : isSeekingJob ? '🔎 Publicar búsqueda' : '💼 Publicar oferta'}
          </Btn>
        )}
      </StickyFormActions>
    </div>
  )
}
