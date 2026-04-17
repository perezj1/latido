import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { C, PP } from '../lib/theme'
import { CANTONS } from '../lib/constants'
import { Btn, ProgressBar, Input, Select } from '../components/UI'
import toast from 'react-hot-toast'

const STEPS = [
  { title:'¿Qué tipo de trabajo es?',     sub:'Elige el sector de la oferta' },
  { title:'Título y tipo de contrato',    sub:'¿Cómo se llama el puesto y qué jornada ofreces?' },
  { title:'Ubicación, salario y detalle', sub:'Dónde es, cuánto paga y qué buscas en un candidato' },
  { title:'Contacto y publicación',       sub:'Cómo deben aplicar — último paso' },
]

const JOB_SECTORS = [
  { id:'hosteleria',     emoji:'👨‍🍳', label:'Hostelería & Cocina' },
  { id:'cuidados',       emoji:'👶', label:'Cuidados & Au pair' },
  { id:'limpieza',       emoji:'🧹', label:'Limpieza & Hogar' },
  { id:'tecnologia',     emoji:'💻', label:'Tecnología & IT' },
  { id:'estetica',       emoji:'💇', label:'Estética & Belleza' },
  { id:'construccion',   emoji:'🏗️', label:'Construcción' },
  { id:'transporte',     emoji:'🚚', label:'Transporte & Logística' },
  { id:'administracion', emoji:'📋', label:'Administración' },
  { id:'educacion',      emoji:'🎓', label:'Educación & Clases' },
  { id:'servicios',      emoji:'🔧', label:'Servicios & Técnico' },
  { id:'salud',          emoji:'🏥', label:'Salud & Enfermería' },
  { id:'ventas',         emoji:'🛒', label:'Comercio & Ventas' },
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

export default function PublicarEmpleo() {
  const { isLoggedIn, user } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [form, setForm] = useState({
    sector:'', title:'', company:'', jobType:'',
    city:'', canton:'', salaryValue:'', salaryUnit:'mes', langs:[], desc:'',
    contactPhone:'', contactEmail:'', contactLink:'',
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
        Tu oferta ya está visible para miles de latinos en Suiza.
      </p>
      <Btn onClick={() => navigate('/tablon?cat=empleo')}>Ver empleos →</Btn>
      <button onClick={() => { setDone(false); setStep(0); setForm({ sector:'', title:'', company:'', jobType:'', city:'', canton:'', salaryValue:'', salaryUnit:'mes', langs:[], desc:'', contactPhone:'', contactEmail:'', contactLink:'' }); }} style={{ fontFamily:PP, fontWeight:600, fontSize:12, color:C.mid, background:'none', border:'none', cursor:'pointer', width:'100%', marginTop:12, padding:'6px 0' }}>
        Publicar otra oferta
      </button>
    </div>
  )

  const handleSubmit = async () => {
    if (!form.title || !form.canton) { toast.error('Completa el título y el cantón'); return }
    if (!form.contactPhone && !form.contactEmail && !form.contactLink) {
      toast.error('Añade al menos un método de contacto'); return
    }
    setLoading(true)
    try {
      const finalSalary = getFormattedSalary() || null
      const salaryAmount = form.salaryValue
        ? Number(String(form.salaryValue).replace(',', '.'))
        : null
      const { error } = await supabase.from('jobs').insert({
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
        contact: form.contactEmail.trim() || form.contactLink.trim() || null,
        contact_phone: form.contactPhone.trim() || null,
        contact_email: form.contactEmail.trim() || null,
        contact_link: form.contactLink.trim() || null,
        active: true,
      })
      if (error) throw error
      setDone(true)
    } catch (error) {
      toast.error(error?.message || 'No se pudo publicar la oferta de empleo')
    } finally {
      setLoading(false)
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
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(155px,1fr))', gap:10 }}>
          {JOB_SECTORS.map(sector => (
            <button key={sector.id} onClick={() => s('sector', sector.id)}
              style={{ background:form.sector===sector.id?C.primary:C.surface, borderRadius:16, padding:'16px 14px', display:'flex', flexDirection:'column', gap:7, border:`2px solid ${form.sector===sector.id?C.primary:C.border}`, cursor:'pointer', textAlign:'left', transition:'all .15s' }}>
                <span style={{ fontSize:24 }}>{sector.emoji}</span>
                <span style={{ fontFamily:PP, fontWeight:700, fontSize:12, color:form.sector===sector.id?'#fff':C.text, lineHeight:1.3 }}>{sector.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Step 1 — Title, company, job type */}
      {step === 1 && (
        <>
          <Input label="Título del puesto *" placeholder="Ej: Cocinero/a, Cuidadora, Técnico IT" required value={form.title} onChange={e=>s('title',e.target.value)} />
          <Input label="Empresa o nombre del empleador" placeholder="Ej: Restaurante El Rincón, Familia particular" value={form.company} onChange={e=>s('company',e.target.value)} />

          <p style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, letterSpacing:1, marginBottom:10 }}>TIPO DE CONTRATO</p>
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
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
        </>
      )}

      {/* Step 2 — Location, salary, languages, description */}
      {step === 2 && (
        <>
          <div className="grid-2" style={{ gap:10 }}>
            <Input label="Ciudad" placeholder="Zürich" value={form.city} onChange={e=>s('city',e.target.value)} />
            <Select label="Cantón *" required value={form.canton} onChange={e=>s('canton',e.target.value)}>
              <option value="">Seleccionar...</option>
              {CANTONS.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
            </Select>
          </div>

          <div style={{ marginBottom:16 }}>
            <label style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, letterSpacing:1, display:'block', marginBottom:6 }}>
              Salario o remuneración
            </label>

            <div style={{ display:'flex', border:`1.5px solid ${C.border}`, borderRadius:12, overflow:'hidden', background:'#fff' }}>
              <input
                type="text"
                inputMode="decimal"
                placeholder="Ej: 4200"
                value={form.salaryValue}
                onChange={e => s('salaryValue', e.target.value)}
                style={{ flex:1, border:'none', outline:'none', background:'transparent', padding:'13px 14px', fontFamily:PP, fontSize:13, color:C.text }}
              />
              <div style={{ padding:'13px 14px', borderLeft:`1px solid ${C.border}`, fontFamily:PP, fontSize:12, fontWeight:800, color:C.primary, background:C.primaryLight, whiteSpace:'nowrap' }}>
                CHF
              </div>
            </div>

            <div style={{ marginTop:10 }}>
              <Select label="Frecuencia del salario" value={form.salaryUnit} onChange={e => s('salaryUnit', e.target.value)}>
                {SALARY_UNITS.map(unit => (
                  <option key={unit.id} value={unit.id}>
                    {unit.label}
                  </option>
                ))}
              </Select>
            </div>

            {form.salaryValue && (
              <div style={{ marginTop:10, background:C.primaryLight, border:`1px solid ${C.primaryMid}`, borderRadius:12, padding:'10px 12px' }}>
                <p style={{ fontFamily:PP, fontSize:11, color:C.primary, margin:0 }}>
                  Se mostrará como: <strong>{getFormattedSalary()}</strong>
                </p>
              </div>
            )}
          </div>

          <p style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, letterSpacing:1, marginBottom:10 }}>IDIOMAS REQUERIDOS</p>
          <div style={{ display:'flex', flexWrap:'wrap', gap:7, marginBottom:16 }}>
            {LANG_OPTIONS.map(lang => (
              <button key={lang} onClick={() => toggleLang(lang)}
                style={{ fontFamily:PP, fontSize:11, fontWeight:600, padding:'7px 14px', borderRadius:20, border:`1.5px solid ${form.langs.includes(lang)?C.primary:C.border}`, background:form.langs.includes(lang)?C.primary:'#fff', color:form.langs.includes(lang)?'#fff':C.mid, cursor:'pointer', transition:'all .12s' }}>
                {lang}
              </button>
            ))}
          </div>

          <Input label="Descripción del puesto" placeholder="Qué hará el candidato, requisitos, experiencia necesaria, condiciones..." rows={5} value={form.desc} onChange={e=>s('desc',e.target.value)} />
        </>
      )}

      {/* Step 3 — Contact + disclaimer */}
      {step === 3 && (
        <>
          <p style={{ fontFamily:PP, fontSize:12, color:C.mid, marginBottom:16, lineHeight:1.7 }}>
            Añade al menos un método de contacto para que los candidatos puedan aplicar.
          </p>
          <Input label="WhatsApp" placeholder="+41 79 123 45 67" value={form.contactPhone} onChange={e=>s('contactPhone',e.target.value)} />
          <Input label="Email de contacto" placeholder="trabajo@miempresa.ch" value={form.contactEmail} onChange={e=>s('contactEmail',e.target.value)} />
          <Input label="Link de aplicación" placeholder="Ej: linkedin.com/jobs/... o formulario propio" value={form.contactLink} onChange={e=>s('contactLink',e.target.value)} />

          {form.title && (
            <div style={{ background:C.bg, borderRadius:14, padding:'14px 16px', marginTop:6, marginBottom:14 }}>
              <p style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, marginBottom:10, letterSpacing:0.5 }}>VISTA PREVIA</p>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
                  {selectedSector && <span style={{ fontFamily:PP, fontSize:10, fontWeight:600, padding:'3px 8px', borderRadius:20, background:'#DBEAFE', color:C.primaryDark }}>{selectedSector.emoji} {selectedSector.label}</span>}
                  {selectedType && <span style={{ fontFamily:PP, fontSize:10, fontWeight:600, padding:'3px 8px', borderRadius:20, background:'#D1FAE5', color:'#065F46' }}>{selectedType.label}</span>}
                  {form.canton && <span style={{ fontFamily:PP, fontSize:10, fontWeight:600, padding:'3px 8px', borderRadius:20, background:C.primaryLight, color:C.primary }}>📍 {form.city || form.canton}</span>}
                </div>
                <p style={{ fontFamily:PP, fontWeight:800, fontSize:15, color:C.text, marginBottom:4 }}>{form.title}</p>
                {form.company && <p style={{ fontFamily:PP, fontSize:12, color:C.mid, marginBottom:4 }}>🏢 {form.company}</p>}
                {form.salaryValue && <p style={{ fontFamily:PP, fontWeight:700, fontSize:13, color:C.primary }}>💰 {getFormattedSalary()}</p>}
                {form.langs.length > 0 && <p style={{ fontFamily:PP, fontSize:11, color:C.light, marginTop:4 }}>🗣 {form.langs.join(' · ')}</p>}
              </div>
            )}

          <div style={{ background:'#FFF7ED', border:'1px solid #FED7AA', borderRadius:14, padding:'14px 16px' }}>
            <p style={{ fontFamily:PP, fontWeight:700, fontSize:12, color:'#9A3412', margin:'0 0 6px' }}>⚠️ Responsabilidad del publicador</p>
            <p style={{ fontFamily:PP, fontSize:11, color:'#7C2D12', lineHeight:1.7, margin:0 }}>
              Al publicar esta oferta confirmas que es real, que tienes autorización para contratar y que eres responsable del proceso de selección. Latido no se hace responsable de la veracidad de los datos ni de las condiciones laborales ofrecidas.
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
            if (step === 0 && !form.sector) { toast.error('Selecciona el sector'); return }
            if (step === 1 && !form.title) { toast.error('Añade el título del puesto'); return }
            if (step === 1 && !form.jobType) { toast.error('Selecciona el tipo de contrato'); return }
            if (step === 2 && !form.canton) { toast.error('Selecciona el cantón'); return }
            setStep(s => s + 1)
          }} style={{ flex:1 }}>
            Continuar →
          </Btn>
        ) : (
          <Btn onClick={handleSubmit} disabled={loading} variant="success" style={{ flex:1 }}>
            {loading ? '⏳ Publicando...' : '💼 Publicar empleo'}
          </Btn>
        )}
      </div>
      <p style={{ fontFamily:PP, fontSize:11, color:C.light, textAlign:'center', marginTop:12 }}>
        Gratuito · Se publica al instante · Puedes eliminarlo desde tu perfil
      </p>
    </div>
  )
}
