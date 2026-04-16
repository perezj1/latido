import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { C, PP } from '../lib/theme'
import { EVENTO_TYPES, CANTONS } from '../lib/constants'
import { Btn, ProgressBar, Input, Select } from '../components/UI'
import toast from 'react-hot-toast'

const STEPS = [
  { title:'¿Qué tipo de evento es?',     sub:'Elige la categoría que mejor lo describe' },
  { title:'Fecha, hora y precio',         sub:'¿Cuándo es y cuánto cuesta la entrada?' },
  { title:'Lugar y descripción',          sub:'Dónde se celebra y qué pueden esperar' },
  { title:'Organizador y contacto',       sub:'Último paso — ¿quién organiza y cómo contactar?' },
]

const EVENT_TYPES_FORM = EVENTO_TYPES.filter(t => t.id !== '')

export default function PublicarEvento() {
  const { isLoggedIn, user } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [form, setForm] = useState({
    type:'', title:'', day:'', month:'', year:'', time:'', price:'',
    city:'', canton:'', venue:'', desc:'', host:'', link:'',
  })
  const s = (k, v) => setForm(f => ({ ...f, [k]:v }))

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
      <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:24, color:C.text, marginBottom:10 }}>¡Evento publicado!</h1>
      <p style={{ fontFamily:PP, fontSize:13, color:C.mid, lineHeight:1.7, marginBottom:24 }}>
        Tu evento ya está visible para la comunidad latina en Suiza.
      </p>
      <Btn onClick={() => navigate('/comunidades?view=eventos')}>Ver en eventos →</Btn>
      <button onClick={() => { setDone(false); setStep(0); setForm({ type:'', title:'', day:'', month:'', year:'', time:'', price:'', city:'', canton:'', venue:'', desc:'', host:'', link:'' }); }} style={{ fontFamily:PP, fontWeight:600, fontSize:12, color:C.mid, background:'none', border:'none', cursor:'pointer', width:'100%', marginTop:12, padding:'6px 0' }}>
        Publicar otro evento
      </button>
    </div>
  )

  const handleSubmit = async () => {
    if (!form.title || !form.canton) { toast.error('Completa el título y el cantón'); return }
    setLoading(true)
    try {
      const { error } = await supabase.from('events').insert({
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
        host: form.host || user?.user_metadata?.name || 'Organizador',
        link: form.link,
        user_id: user?.id,
        active: true,
      })
      if (error) throw error
      setDone(true)
    } catch (error) {
      const message = error?.message?.toLowerCase().includes('events')
        ? 'Tu proyecto de Supabase todavía no tiene la tabla events. Antes de publicar eventos hay que crearla.'
        : (error?.message || 'No se pudo publicar el evento')
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const selectedType = EVENT_TYPES_FORM.find(t => t.id === form.type)

  return (
    <div style={{ maxWidth:600, margin:'0 auto', padding:'32px 24px 100px' }}>
      <ProgressBar step={step} total={STEPS.length} />
      <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:22, color:C.text, marginBottom:4, letterSpacing:-0.3 }}>{STEPS[step].title}</h1>
      <p style={{ fontFamily:PP, fontSize:12, color:C.light, marginBottom:24 }}>{STEPS[step].sub}</p>

      {/* Step 0 — Event type */}
      {step === 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:10 }}>
          {EVENT_TYPES_FORM.map(t => {
            const [emoji, ...words] = t.label.split(' ')
            return (
              <button key={t.id} onClick={() => { s('type', t.id); setStep(1); }}
                style={{ background:form.type===t.id?C.primary:C.surface, borderRadius:16, padding:'18px 14px', display:'flex', flexDirection:'column', gap:7, border:`2px solid ${form.type===t.id?C.primary:C.border}`, cursor:'pointer', textAlign:'left', transition:'all .15s' }}>
                <span style={{ fontSize:26 }}>{emoji}</span>
                <span style={{ fontFamily:PP, fontWeight:700, fontSize:13, color:form.type===t.id?'#fff':C.text }}>{words.join(' ')}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Step 1 — Date, time, price */}
      {step === 1 && (
        <>
          <Input label="Título del evento *" placeholder="Ej: Noche de salsa en Zürich" required value={form.title} onChange={e=>s('title',e.target.value)} />
          <div className="grid-2" style={{ gap:10 }}>
            <Input label="Día" placeholder="18" value={form.day} onChange={e=>s('day',e.target.value)} />
            <Input label="Mes" placeholder="MAY" value={form.month} onChange={e=>s('month',e.target.value.toUpperCase())} />
          </div>
          <Input label="Año" placeholder="2025" value={form.year} onChange={e=>s('year',e.target.value)} />
          <Input label="Hora de inicio" placeholder="21:00" value={form.time} onChange={e=>s('time',e.target.value)} />
          <Input label="Precio de entrada" placeholder="Ej: Gratis · CHF 15 · CHF 10–20" value={form.price} onChange={e=>s('price',e.target.value)} />
        </>
      )}

      {/* Step 2 — Location and description */}
      {step === 2 && (
        <>
          <div className="grid-2" style={{ gap:10 }}>
            <Input label="Ciudad" placeholder="Zürich" value={form.city} onChange={e=>s('city',e.target.value)} />
            <Select label="Cantón *" required value={form.canton} onChange={e=>s('canton',e.target.value)}>
              <option value="">Seleccionar...</option>
              {CANTONS.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
            </Select>
          </div>
          <Input label="Lugar / Venue" placeholder="Ej: Rote Fabrik, Club Zukunft, Rosengarten Café" value={form.venue} onChange={e=>s('venue',e.target.value)} />
          <Input label="Descripción del evento" placeholder="Cuéntanos qué habrá, qué pueden esperar los asistentes..." rows={5} value={form.desc} onChange={e=>s('desc',e.target.value)} />
        </>
      )}

      {/* Step 3 — Organizer and contact */}
      {step === 3 && (
        <>
          <Input label="Nombre del organizador" placeholder="Ej: Asociación Latina Zürich" value={form.host} onChange={e=>s('host',e.target.value)} />
          <Input label="Link de tickets / más info" placeholder="Ej: eventbrite.com/... o instagram.com/..." value={form.link} onChange={e=>s('link',e.target.value)} />

          {form.title && (
            <div style={{ background:C.bg, borderRadius:14, padding:'14px 16px', marginTop:10 }}>
              <p style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, marginBottom:10, letterSpacing:0.5 }}>VISTA PREVIA</p>
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
        </>
      )}

      {/* Navigation */}
      <div style={{ display:'flex', gap:10, marginTop:24 }}>
        {step > 0 && (
          <Btn onClick={() => setStep(s => s - 1)} variant="secondary" style={{ flex:'0 0 100px' }}>← Atrás</Btn>
        )}
        {step < STEPS.length - 1 ? (
          <Btn onClick={() => { if (step === 0 && !form.type) return; if (step === 1 && !form.title) { toast.error('Añade un título'); return; } setStep(s => s + 1); }} style={{ flex:1 }}>
            Continuar →
          </Btn>
        ) : (
          <Btn onClick={handleSubmit} disabled={loading} variant="success" style={{ flex:1 }}>
            {loading ? '⏳ Publicando...' : '🎉 Publicar evento'}
          </Btn>
        )}
      </div>
      <p style={{ fontFamily:PP, fontSize:11, color:C.light, textAlign:'center', marginTop:12 }}>
        Gratuito · Se publica al instante · Puedes eliminarlo desde tu perfil
      </p>
    </div>
  )
}
