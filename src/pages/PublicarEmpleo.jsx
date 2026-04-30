import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { C, PP } from '../lib/theme'
import { CANTONS } from '../lib/constants'
import { Btn, ProgressBar, Input, Select, ImageUploadField } from '../components/UI'
import { getStorageErrorMessage, uploadPublicationImage } from '../lib/storage'
import { insertWithOptionalColumnsFallback, isLikelySchemaMismatchError } from '../lib/supabaseCompat'
import toast from 'react-hot-toast'

const STEPS = [
  { title:'¿En qué sector?',    sub:'Elige el área de trabajo para adaptar la oferta' },
  { title:'Datos del puesto',   sub:'Título, jornada, ubicación y salario' },
  { title:'Detalles y publicar', sub:'Último paso — idiomas, descripción y revisión final' },
]

const JOB_SECTORS = [
  { id:'hosteleria',     emoji:'👨‍🍳', label:'Hostelería & Cocina',      sub:'Camarero/a, cocinero/a, barista, ayudante de cocina…' },
  { id:'cuidados',       emoji:'❤️',  label:'Cuidados & Au pair',        sub:'Niñero/a, au pair, cuidador/a de personas mayores…' },
  { id:'limpieza',       emoji:'🧹',  label:'Limpieza & Servicios',      sub:'Limpieza doméstica, oficinas, hoteles, conserje…' },
  { id:'tecnologia',     emoji:'💻',  label:'Tecnología & IT',           sub:'Desarrollo, soporte técnico, sistemas, diseño digital…' },
  { id:'estetica',       emoji:'💇',  label:'Estética & Belleza',        sub:'Peluquería, barbería, uñas, maquillaje, estética…' },
  { id:'construccion',   emoji:'🏗️', label:'Construcción',              sub:'Albañil, electricista, fontanero, pintor, carpintero…' },
  { id:'transporte',     emoji:'🚚',  label:'Transporte & Logística',    sub:'Conductor/a, repartidor/a, almacén, mensajería…' },
  { id:'administracion', emoji:'📋',  label:'Administración',            sub:'Recepcionista, asistente, contabilidad, oficina…' },
  { id:'educacion',      emoji:'🎓',  label:'Educación & Clases',        sub:'Profesor/a, tutor/a, clases particulares, monitor/a…' },
  { id:'servicios',      emoji:'🔧',  label:'Servicios & Técnico',       sub:'Reparaciones, mantenimiento, instalaciones, jardinería…' },
  { id:'salud',          emoji:'🏥',  label:'Salud & Enfermería',        sub:'Enfermero/a, auxiliar, farmacia, fisioterapia…' },
  { id:'ventas',         emoji:'🛒',  label:'Comercio & Ventas',         sub:'Dependiente/a, cajero/a, atención al cliente, tienda…' },
]

const JOB_TYPES = [
  { id:'Full-time',  emoji:'🕐', label:'Full-time',  desc:'Jornada completa' },
  { id:'Part-time',  emoji:'🕔', label:'Part-time',  desc:'Media jornada' },
  { id:'Freelance',  emoji:'💡', label:'Freelance',  desc:'Por proyecto o autónomo' },
  { id:'Prácticas',  emoji:'🎓', label:'Prácticas',  desc:'Internship o aprendizaje' },
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

const OPTIONAL_JOB_INSERT_COLUMNS = ['sector', 'languages', 'contact_via_app', 'contact_phone', 'contact_email', 'contact_link', 'logo_url']

export default function PublicarEmpleo() {
  const { isLoggedIn, user } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }) }, [step])
  const [loading, setLoading] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [done, setDone] = useState(false)
  const [form, setForm] = useState({
    sector:'', title:'', company:'', jobType:'',
    city:'', canton:'', salaryValue:'', salaryUnit:'mes', langs:[], desc:'', logoUrl:'',
  })
  const s = (k, v) => setForm(f => ({ ...f, [k]:v }))
  const toggleLang = lang => setForm(f => ({
    ...f,
    langs: f.langs.includes(lang) ? f.langs.filter(l => l !== lang) : [...f.langs, lang],
  }))

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

  if (done) return (
    <div style={{ maxWidth:480, margin:'0 auto', padding:'80px 24px', textAlign:'center' }}>
      <div style={{ width:80, height:80, background:C.successLight, borderRadius:24, display:'flex', alignItems:'center', justifyContent:'center', fontSize:42, margin:'0 auto 20px' }}>💼</div>
      <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:24, color:C.text, marginBottom:10 }}>¡Empleo publicado!</h1>
      <p style={{ fontFamily:PP, fontSize:13, color:C.mid, lineHeight:1.7, marginBottom:24 }}>
        Tu oferta ya está visible para miles de personas en Suiza. Los candidatos te escribirán por mensaje dentro de Latido.
      </p>
      <Btn onClick={() => navigate('/tablon?cat=empleo')}>Ver empleos →</Btn>
      <button onClick={() => { setDone(false); setStep(0); setForm({ sector:'', title:'', company:'', jobType:'', city:'', canton:'', salaryValue:'', salaryUnit:'mes', langs:[], desc:'', logoUrl:'' }); }} style={{ fontFamily:PP, fontWeight:600, fontSize:12, color:C.mid, background:'none', border:'none', cursor:'pointer', width:'100%', marginTop:12, padding:'6px 0' }}>
        Publicar otra oferta
      </button>
    </div>
  )

  const handleSubmit = async () => {
    if (!form.title || !form.canton) { toast.error('Completa el título y el cantón'); return }
    setLoading(true)
    try {
      const finalSalary = getFormattedSalary() || null
      const salaryAmount = form.salaryValue
        ? Number(String(form.salaryValue).replace(',', '.'))
        : null
      const payload = {
        user_id: user?.id,
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
        active: true,
      }

      const { error } = await insertWithOptionalColumnsFallback({
        table: 'jobs',
        payload,
        optionalColumns: OPTIONAL_JOB_INSERT_COLUMNS,
      })
      if (error) throw error
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

  const selectedSector = JOB_SECTORS.find(s => s.id === form.sector)
  const selectedType = JOB_TYPES.find(t => t.id === form.jobType)

  return (
    <div style={{ maxWidth:600, margin:'0 auto', padding:'32px 24px 100px' }}>
      <ProgressBar step={step} total={STEPS.length} />
      <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:22, color:C.text, marginBottom:4, letterSpacing:-0.3 }}>{STEPS[step].title}</h1>
      <p style={{ fontFamily:PP, fontSize:12, color:C.light, marginBottom:24 }}>{STEPS[step].sub}</p>

      {/* Step 0 — Sector */}
      {step === 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:10 }}>
          {JOB_SECTORS.map(sector => (
            <button key={sector.id} onClick={() => { s('sector', sector.id); setStep(1) }}
              style={{ background:form.sector===sector.id?C.primaryLight:'#fff', borderRadius:16, padding:'16px 14px', minHeight:150, display:'flex', flexDirection:'column', alignItems:'flex-start', gap:8, border:`2px solid ${form.sector===sector.id?C.primary:C.border}`, cursor:'pointer', textAlign:'left', transition:'all .15s' }}>
              <span style={{ fontSize:28, lineHeight:1 }}>{sector.emoji}</span>
              <div>
                <p style={{ fontFamily:PP, fontWeight:800, fontSize:13, color:form.sector===sector.id?C.primary:C.text, margin:'0 0 4px', lineHeight:1.25 }}>{sector.label}</p>
                <p style={{ fontFamily:PP, fontSize:10.5, color:C.light, margin:0, lineHeight:1.45 }}>{sector.sub}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Step 1 — Título, tipo de contrato, ubicación y salario */}
      {step === 1 && (
        <>
          <Input label="Título del puesto *" placeholder="Ej: Cocinero/a, Cuidadora, Técnico IT" required value={form.title} onChange={e=>s('title',e.target.value)} />
          <Input label="Empresa o nombre del empleador (opcional)" placeholder="Ej: Restaurante El Rincón, Familia particular" value={form.company} onChange={e=>s('company',e.target.value)} />

          <p style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, letterSpacing:1, marginBottom:10 }}>TIPO DE CONTRATO</p>
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:20 }}>
            {JOB_TYPES.map(t => (
              <button key={t.id} onClick={() => s('jobType', t.id)}
                style={{ background:form.jobType===t.id?C.primaryLight:'#fff', border:`1.5px solid ${form.jobType===t.id?C.primary:C.border}`, borderRadius:14, padding:'13px 16px', cursor:'pointer', display:'flex', gap:12, alignItems:'center', textAlign:'left', transition:'all .15s' }}>
                <span style={{ fontSize:22 }}>{t.emoji}</span>
                <div>
                  <p style={{ fontFamily:PP, fontWeight:700, fontSize:13, color:form.jobType===t.id?C.primary:C.text, margin:'0 0 2px' }}>{t.label}</p>
                  <p style={{ fontFamily:PP, fontSize:11, color:C.light, margin:0 }}>{t.desc}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="grid-2" style={{ gap:10, marginBottom:4 }}>
            <Input label="Ciudad" placeholder="Zürich" value={form.city} onChange={e=>s('city',e.target.value)} />
            <Select label="Cantón *" required value={form.canton} onChange={e=>s('canton',e.target.value)}>
              <option value="">Seleccionar...</option>
              {CANTONS.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
            </Select>
          </div>

          <div style={{ marginBottom:4 }}>
            <label style={{ display:'block', fontFamily:PP, fontSize:12, fontWeight:700, color:C.text, marginBottom:8 }}>
              Salario o remuneración (opcional)
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
            label="Logo o imagen de la empresa (opcional)"
            previewUrl={form.logoUrl}
            uploading={uploadingLogo}
            onFilesSelected={handleLogoUpload}
            onRemove={() => s('logoUrl', '')}
            hint="Se mostrará en la tarjeta y detalle de la oferta."
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

          <Input label="Descripción del puesto (opcional)" placeholder="Qué hará el candidato, requisitos, experiencia necesaria, condiciones..." rows={4} value={form.desc} onChange={e=>s('desc',e.target.value)} />

          {/* Resumen antes de publicar */}
          <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:16, padding:'16px', marginBottom:4 }}>
            <p style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, letterSpacing:0.5, marginBottom:12 }}>RESUMEN DE LA OFERTA</p>
            <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
              <span style={{ fontSize:30, flexShrink:0 }}>{selectedSector?.emoji || '💼'}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ fontFamily:PP, fontWeight:800, fontSize:15, color:C.text, margin:'0 0 6px' }}>{form.title}</p>
                <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:4 }}>
                  {selectedSector && <span style={{ fontFamily:PP, fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20, background:'#DBEAFE', color:C.primaryDark }}>{selectedSector.label}</span>}
                  {selectedType && <span style={{ fontFamily:PP, fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20, background:'#D1FAE5', color:'#065F46' }}>{selectedType.label}</span>}
                  {form.canton && <span style={{ fontFamily:PP, fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20, background:C.primaryLight, color:C.primary }}>📍 {form.city || form.canton}</span>}
                </div>
                {form.company && <p style={{ fontFamily:PP, fontSize:12, color:C.mid, margin:'0 0 2px' }}>🏢 {form.company}</p>}
                {form.salaryValue && <p style={{ fontFamily:PP, fontWeight:700, fontSize:13, color:C.primary, margin:0 }}>{getFormattedSalary()}</p>}
              </div>
            </div>
          </div>

          <div style={{ background:'#FFF7ED', border:'1px solid #FED7AA', borderRadius:14, padding:'14px 16px', marginBottom:4 }}>
            <p style={{ fontFamily:PP, fontWeight:700, fontSize:12, color:'#9A3412', margin:'0 0 6px' }}>⚠️ Responsabilidad del publicador</p>
            <p style={{ fontFamily:PP, fontSize:11, color:'#7C2D12', lineHeight:1.7, margin:0 }}>
              Al publicar confirmas que la oferta es real y que tienes autorización para contratar. Latido no se hace responsable de las condiciones laborales ofrecidas.
            </p>
          </div>
        </>
      )}

      {/* Navigation */}
      <div style={{ display:'flex', gap:10, marginTop:24 }}>
        {step > 0 && (
          <Btn onClick={() => setStep(s => s - 1)} variant="secondary" style={{ flex:'0 0 100px' }}>← Atrás</Btn>
        )}
        {step === 0 ? null
          : step === 1 ? (
            <Btn onClick={() => {
              if (!form.title) { toast.error('Añade el título del puesto'); return }
              if (!form.jobType) { toast.error('Selecciona el tipo de contrato'); return }
              if (!form.canton) { toast.error('Selecciona el cantón'); return }
              setStep(2)
            }} style={{ flex:1 }}>
              Continuar →
            </Btn>
          ) : (
            <Btn onClick={handleSubmit} disabled={loading} variant="success" style={{ flex:1 }}>
              {loading ? '⏳ Publicando...' : '💼 Publicar empleo'}
            </Btn>
          )
        }
      </div>
      <p style={{ fontFamily:PP, fontSize:11, color:C.light, textAlign:'center', marginTop:12 }}>
        Gratuito · Se publica al instante · Puedes eliminarlo desde tu perfil
      </p>
    </div>
  )
}
