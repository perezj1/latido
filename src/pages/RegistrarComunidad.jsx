import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { C, PP } from '../lib/theme'
import { COMMUNITY_CATS, CANTONS } from '../lib/constants'
import { Btn, ProgressBar, Input, Select } from '../components/UI'
import toast from 'react-hot-toast'

const STEPS = [
  { title:'¿De qué trata tu comunidad?',  sub:'Elige la categoría que mejor la describe' },
  { title:'Nombre, plataforma y ciudad',  sub:'Los datos básicos de tu comunidad' },
  { title:'Descripción y enlace',         sub:'Cuéntanos más y añade el link de invitación' },
  { title:'Confirma y publica',           sub:'Revisa el resumen antes de enviar' },
]

const COMMUNITY_OPTIONS = COMMUNITY_CATS
  .filter(item => item.id !== 'fe')
  .map(item => item.id === 'mamas'
    ? { ...item, id:'familia', emoji:'👨‍👩‍👧', label:'Familia' }
    : item)

const PLATFORMS = [
  { id:'whatsapp',  emoji:'💬', label:'WhatsApp' },
  { id:'telegram',  emoji:'📲', label:'Telegram' },
  { id:'facebook',  emoji:'👥', label:'Facebook' },
  { id:'discord',   emoji:'🎮', label:'Discord' },
  { id:'instagram', emoji:'📸', label:'Instagram' },
  { id:'otro',      emoji:'🔗', label:'Otro' },
]

const LANGUAGES = ['Español', 'Español / Alemán', 'Español / Francés', 'Español / Italiano', 'Multilingüe']

export default function RegistrarComunidad() {
  const { isLoggedIn, user } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [form, setForm] = useState({
    cat:'', name:'', platform:'', city:'', canton:'', desc:'', contact:'', lang:'Español',
  })
  const s = (k, v) => setForm(f => ({ ...f, [k]:v }))

  if (!isLoggedIn) return (
    <div style={{ maxWidth:480, margin:'0 auto', padding:'80px 24px', textAlign:'center' }}>
      <div style={{ fontSize:52, marginBottom:16 }}>🔐</div>
      <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:22, color:C.text, marginBottom:10 }}>Necesitas una cuenta</h1>
      <p style={{ fontFamily:PP, fontSize:13, color:C.mid, marginBottom:24, lineHeight:1.7 }}>
        Para registrar tu comunidad necesitas una cuenta. Es gratis y sin spam.
      </p>
      <Btn onClick={() => navigate('/auth')}>Crear cuenta gratis</Btn>
      <button onClick={() => navigate('/auth')} style={{ fontFamily:PP, fontWeight:600, fontSize:13, color:C.primary, background:'none', border:`1.5px solid ${C.primaryMid}`, borderRadius:14, padding:'12px 0', width:'100%', cursor:'pointer', marginTop:10 }}>
        Ya tengo cuenta — iniciar sesión
      </button>
    </div>
  )

  if (done) return (
    <div style={{ maxWidth:480, margin:'0 auto', padding:'80px 24px', textAlign:'center' }}>
      <div style={{ width:80, height:80, background:C.successLight, borderRadius:24, display:'flex', alignItems:'center', justifyContent:'center', fontSize:42, margin:'0 auto 20px' }}>🤝</div>
      <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:24, color:C.text, marginBottom:10 }}>¡Comunidad publicada!</h1>
      <p style={{ fontFamily:PP, fontSize:13, color:C.mid, lineHeight:1.7, marginBottom:24 }}>
        Tu comunidad ya está visible para la comunidad latina en Suiza.
      </p>
      <Btn onClick={() => navigate('/comunidades')}>Ver comunidades →</Btn>
      <button onClick={() => { setDone(false); setStep(0); setForm({ cat:'', name:'', platform:'', city:'', canton:'', desc:'', contact:'', lang:'Español' }); }} style={{ fontFamily:PP, fontWeight:600, fontSize:12, color:C.mid, background:'none', border:'none', cursor:'pointer', width:'100%', marginTop:12, padding:'6px 0' }}>
        Registrar otra comunidad
      </button>
    </div>
  )

  const handleSubmit = async () => {
    if (!form.name || !form.contact) { toast.error('Completa el nombre y el enlace de invitación'); return }
    setLoading(true)
    try {
      const location = [form.city.trim(), form.canton].filter(Boolean).join(', ') || 'Toda Suiza'
      const description = [
        form.desc.trim(),
        selectedPlat?.label ? `Plataforma: ${selectedPlat.label}` : '',
        form.lang ? `Idioma: ${form.lang}` : '',
      ].filter(Boolean).join('\n\n')

      const { error } = await supabase.from('communities').insert({
        user_id: user?.id,
        cat: form.cat || null,
        name: form.name.trim(),
        city: location,
        emoji: selectedCat?.emoji || '🤝',
        desc: description || null,
        contact: form.contact.trim(),
        verified: false,
        members: 0,
        active: true,
      })
      if (error) throw error
      setDone(true)
    } catch (error) {
      toast.error(error?.message || 'No se pudo registrar la comunidad')
    } finally {
      setLoading(false)
    }
  }

  const selectedCat = COMMUNITY_OPTIONS.find(c => c.id === form.cat)
  const selectedPlat = PLATFORMS.find(p => p.id === form.platform)

  return (
    <div style={{ maxWidth:600, margin:'0 auto', padding:'32px 24px 100px' }}>
      <ProgressBar step={step} total={STEPS.length} />
      <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:22, color:C.text, marginBottom:4, letterSpacing:-0.3 }}>{STEPS[step].title}</h1>
      <p style={{ fontFamily:PP, fontSize:12, color:C.light, marginBottom:24 }}>{STEPS[step].sub}</p>

      {/* Step 0 — Category */}
      {step === 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:10 }}>
          {COMMUNITY_OPTIONS.map(cat => (
            <button key={cat.id} onClick={() => { s('cat', cat.id); setStep(1); }}
              style={{ background:form.cat===cat.id?C.primary:C.surface, borderRadius:16, padding:'18px 14px', display:'flex', flexDirection:'column', gap:7, border:`2px solid ${form.cat===cat.id?C.primary:C.border}`, cursor:'pointer', textAlign:'left', transition:'all .15s' }}>
              <span style={{ fontSize:26 }}>{cat.emoji}</span>
              <span style={{ fontFamily:PP, fontWeight:700, fontSize:13, color:form.cat===cat.id?'#fff':C.text }}>{cat.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Step 1 — Name, platform, city */}
      {step === 1 && (
        <>
          <Input label="Nombre de la comunidad *" placeholder="Ej: Venezolanos en Zürich" required value={form.name} onChange={e=>s('name',e.target.value)} />

          <p style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, letterSpacing:1, marginBottom:10 }}>PLATAFORMA</p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:8, marginBottom:16 }}>
            {PLATFORMS.map(p => (
              <button key={p.id} onClick={() => s('platform', p.id)}
                style={{ background:form.platform===p.id?C.primaryLight:'#fff', border:`1.5px solid ${form.platform===p.id?C.primary:C.border}`, borderRadius:12, padding:'12px 10px', cursor:'pointer', display:'flex', alignItems:'center', gap:8, transition:'all .15s' }}>
                <span style={{ fontSize:18 }}>{p.emoji}</span>
                <span style={{ fontFamily:PP, fontWeight:600, fontSize:12, color:form.platform===p.id?C.primary:C.text }}>{p.label}</span>
              </button>
            ))}
          </div>

          <div className="grid-2" style={{ gap:10 }}>
            <Input label="Ciudad" placeholder="Zürich" value={form.city} onChange={e=>s('city',e.target.value)} />
            <Select label="Cantón" value={form.canton} onChange={e=>s('canton',e.target.value)}>
              <option value="">Todo Suiza</option>
              {CANTONS.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
            </Select>
          </div>
        </>
      )}

      {/* Step 2 — Description and link */}
      {step === 2 && (
        <>
          <Input label="Descripción de la comunidad" placeholder="¿A quién está dirigida? ¿Qué hacéis juntos? ¿Cuándo os reunís?" rows={5} value={form.desc} onChange={e=>s('desc',e.target.value)} />
          <Input label="Enlace de invitación *" placeholder={
            form.platform === 'whatsapp'  ? 'https://chat.whatsapp.com/...' :
            form.platform === 'telegram'  ? 'https://t.me/...' :
            form.platform === 'facebook'  ? 'https://facebook.com/groups/...' :
            form.platform === 'discord'   ? 'https://discord.gg/...' :
            form.platform === 'instagram' ? 'https://instagram.com/...' :
            'https://...'
          } required value={form.contact} onChange={e=>s('contact',e.target.value)} />
          {form.platform && (
            <div style={{ background:'#FFFBEB', border:'1px solid #FCD34D', borderRadius:12, padding:'12px 14px', marginTop:-8, marginBottom:16 }}>
              <p style={{ fontFamily:PP, fontWeight:700, fontSize:11, color:'#92400E', margin:'0 0 6px' }}>
                {form.platform === 'whatsapp'  && '💬 ¿Cómo conseguir el enlace de WhatsApp?'}
                {form.platform === 'telegram'  && '📲 ¿Cómo conseguir el enlace de Telegram?'}
                {form.platform === 'facebook'  && '👥 ¿Cómo conseguir el enlace del grupo de Facebook?'}
                {form.platform === 'discord'   && '🎮 ¿Cómo conseguir el enlace de Discord?'}
                {form.platform === 'instagram' && '📸 ¿Cómo conseguir el enlace de Instagram?'}
                {form.platform === 'otro'      && '🔗 Añade el enlace directo a tu comunidad'}
              </p>
              <p style={{ fontFamily:PP, fontSize:11, color:'#78350F', margin:0, lineHeight:1.7 }}>
                {form.platform === 'whatsapp'  && 'Abre el grupo → toca el icono de agregar miembros → "Invitar con enlace o QR" → "Copiar enlace".'}
                {form.platform === 'telegram'  && 'Abre el grupo o canal → toca el nombre → "Añadir miembros" → "Invitar con enlace" → copia el enlace.'}
                {form.platform === 'facebook'  && 'Entra al grupo → toca los 3 puntos → "Compartir grupo" → copia el enlace de la URL.'}
                {form.platform === 'discord'   && 'Abre el servidor → haz clic derecho en un canal → "Invitar personas" → "Copia enlace".'}
                {form.platform === 'instagram' && 'Añade el enlace directo a tu perfil o cuenta de Instagram (ej: instagram.com/micomunidad).'}
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
          <p style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, marginBottom:12, letterSpacing:0.5 }}>RESUMEN DE TU COMUNIDAD</p>
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
          {form.desc && <p style={{ fontFamily:PP, fontSize:12, color:C.mid, lineHeight:1.65, marginBottom:10 }}>{form.desc}</p>}
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
            Al registrar esta comunidad confirmas que la información es verídica y que eres responsable del buen uso, contenido y gestión del grupo. Latido no se hace responsable de lo que ocurra dentro de la comunidad ni de la veracidad de los datos publicados.
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
            if (step === 0 && !form.cat) return
            if (step === 1 && !form.name) { toast.error('Añade el nombre de la comunidad'); return }
            if (step === 2 && !form.contact) { toast.error('Añade el enlace de invitación'); return }
            setStep(s => s + 1)
          }} style={{ flex:1 }}>
            Continuar →
          </Btn>
        ) : (
          <Btn onClick={handleSubmit} disabled={loading} variant="success" style={{ flex:1 }}>
            {loading ? '⏳ Registrando...' : '🤝 Registrar comunidad'}
          </Btn>
        )}
      </div>
      <p style={{ fontFamily:PP, fontSize:11, color:C.light, textAlign:'center', marginTop:12 }}>
        Gratuito · Se publica al instante · Puedes eliminarlo desde tu perfil
      </p>
    </div>
  )
}
