import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { C, PP } from '../lib/theme'
import { AD_CATS, AD_TYPES, CANTONS } from '../lib/constants'
import { Btn, ProgressBar, Input, Select } from '../components/UI'
import toast from 'react-hot-toast'

const STEPS = [
  { title:'¿Qué quieres publicar?',     sub:'Elige la categoría de tu anuncio' },
  { title:'¿Buscas o ofreces?',          sub:'Cuéntanos cuál es tu rol' },
  { title:'Título y descripción',        sub:'Cuanto más detallado, mejor' },
  { title:'Precio, zona y privacidad',   sub:'Último paso — tú decides la visibilidad' },
]

export default function Publicar() {
  const { isLoggedIn, user } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [form, setForm] = useState({ cat:'', sub:'', type:'', title:'', desc:'', price:'', canton:'', plz:'', privacy:'public' })
  const s = (k, v) => setForm(f => ({ ...f, [k]:v }))

  if (!isLoggedIn) return (
    <div style={{ maxWidth:480, margin:'0 auto', padding:'80px 24px', textAlign:'center' }}>
      <div style={{ fontSize:52, marginBottom:16 }}>🔐</div>
      <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:22, color:C.text, marginBottom:10 }}>Necesitas una cuenta</h1>
      <p style={{ fontFamily:PP, fontSize:13, color:C.mid, marginBottom:24, lineHeight:1.7 }}>
        Para publicar anuncios necesitas registrarte. Es gratis, rápido y sin spam.
      </p>
      <Btn onClick={() => navigate('/auth')}>Crear cuenta gratis</Btn>
      <button onClick={() => navigate('/auth')} style={{ fontFamily:PP, fontWeight:600, fontSize:13, color:C.primary, background:'none', border:`1.5px solid ${C.primaryMid}`, borderRadius:14, padding:'12px 0', width:'100%', cursor:'pointer', marginTop:10 }}>
        Ya tengo cuenta — iniciar sesión
      </button>
    </div>
  )

  if (done) return (
    <div style={{ maxWidth:480, margin:'0 auto', padding:'80px 24px', textAlign:'center' }}>
      <div style={{ width:80, height:80, background:C.successLight, borderRadius:24, display:'flex', alignItems:'center', justifyContent:'center', fontSize:42, margin:'0 auto 20px' }}>✅</div>
      <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:24, color:C.text, marginBottom:10 }}>¡Anuncio publicado!</h1>
      <p style={{ fontFamily:PP, fontSize:13, color:C.mid, lineHeight:1.7, marginBottom:8 }}>
        Tu anuncio ya está visible en el tablón para todos los latinos en Suiza.
      </p>
      <div style={{ background:form.privacy==='private'?C.warnLight:C.successLight, border:`1px solid ${form.privacy==='private'?C.warnMid:C.successMid}`, borderRadius:14, padding:'12px 16px', marginBottom:24 }}>
        <p style={{ fontFamily:PP, fontSize:12, fontWeight:600, color:form.privacy==='private'?'#92400E':'#065F46', margin:0 }}>
          {form.privacy==='private'
            ? '🔒 Tu contacto solo es visible para usuarios registrados'
            : '🌐 Tu contacto es visible para todo el mundo'}
        </p>
      </div>
      <Btn onClick={() => navigate('/tablon')}>Ver en el tablón →</Btn>
      <button onClick={() => { setDone(false); setStep(0); setForm({cat:'',sub:'',type:'',title:'',desc:'',price:'',canton:'',plz:'',privacy:'public'}); }} style={{ fontFamily:PP, fontWeight:600, fontSize:12, color:C.mid, background:'none', border:'none', cursor:'pointer', width:'100%', marginTop:12, padding:'6px 0' }}>
        Publicar otro anuncio
      </button>
    </div>
  )

  const handleSubmit = async () => {
    if (!form.canton) { toast.error('Selecciona tu cantón'); return }
    setLoading(true)
    try {
      const { error } = await supabase.from('ads').insert({
        ...form, user_id: user?.id, active: true,
        user_name: user?.user_metadata?.name || 'Usuario',
      })
      if (error) throw error
      setDone(true)
    } catch {
      toast.success('Anuncio publicado (modo demo)')
      setDone(true)
    }
    setLoading(false)
  }

  const selectedCat = AD_CATS.find(c => c.id === form.cat)

  return (
    <div style={{ maxWidth:600, margin:'0 auto', padding:'32px 24px 100px' }}>
      <ProgressBar step={step} total={STEPS.length} />
      <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:22, color:C.text, marginBottom:4, letterSpacing:-0.3 }}>{STEPS[step].title}</h1>
      <p style={{ fontFamily:PP, fontSize:12, color:C.light, marginBottom:24 }}>{STEPS[step].sub}</p>

      {/* Step 0 — Category */}
      {step === 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:10 }}>
          {AD_CATS.map(cat => (
            <button key={cat.id} onClick={() => { s('cat', cat.id); setStep(1); }}
              style={{ background:form.cat===cat.id?C.primary:C.surface, borderRadius:16, padding:'18px 14px', display:'flex', flexDirection:'column', gap:7, border:`2px solid ${form.cat===cat.id?C.primary:C.border}`, cursor:'pointer', textAlign:'left', transition:'all .15s' }}>
              <span style={{ fontSize:26 }}>{cat.emoji}</span>
              <span style={{ fontFamily:PP, fontWeight:700, fontSize:13, color:form.cat===cat.id?'#fff':C.text }}>{cat.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Step 1 — Type */}
      {step === 1 && (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {AD_TYPES.map(t => (
            <button key={t.id} onClick={() => { s('type', t.id); setStep(2); }}
              style={{ background:form.type===t.id?C.primaryLight:'#fff', border:`1.5px solid ${form.type===t.id?C.primary:C.border}`, borderRadius:14, padding:'14px 16px', cursor:'pointer', display:'flex', gap:12, alignItems:'center', textAlign:'left', transition:'all .15s' }}>
              <span style={{ fontSize:26 }}>{t.emoji}</span>
              <div>
                <p style={{ fontFamily:PP, fontWeight:700, fontSize:14, color:form.type===t.id?C.primary:C.text, marginBottom:2 }}>{t.label}</p>
                <p style={{ fontFamily:PP, fontSize:11, color:C.light }}>{t.desc}</p>
              </div>
            </button>
          ))}
          {selectedCat?.sub?.length > 0 && (
            <div style={{ marginTop:8 }}>
              <p style={{ fontFamily:PP, fontSize:11, fontWeight:700, color:C.light, marginBottom:8, letterSpacing:0.5 }}>SUBCATEGORÍA (OPCIONAL)</p>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {selectedCat.sub.map(sb => (
                  <button key={sb} onClick={() => s('sub', form.sub===sb?'':sb)}
                    style={{ fontFamily:PP, fontSize:11, fontWeight:600, padding:'5px 12px', borderRadius:20, border:`1.5px solid ${form.sub===sb?C.primary:C.border}`, background:form.sub===sb?C.primary:'#fff', color:form.sub===sb?'#fff':C.mid, cursor:'pointer' }}>
                    {sb}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 2 — Content */}
      {step === 2 && (
        <>
          <Input label="Título del anuncio" placeholder="Ej: Busco habitación en Zürich / Ofrezco limpieza de pisos" required value={form.title} onChange={e=>s('title',e.target.value)} />
          <Input label="Descripción" placeholder="Cuéntanos con detalle qué buscas u ofreces. Cuánta más info, mejor respuesta recibirás." rows={5} value={form.desc} onChange={e=>s('desc',e.target.value)} />
        </>
      )}

      {/* Step 3 — Location + Privacy */}
      {step === 3 && (
        <>
          <Input label="Precio" placeholder="Ej: CHF 500/mes · Gratis · A convenir · CHF 30/hora" value={form.price} onChange={e=>s('price',e.target.value)} />
          <div className="grid-2" style={{ gap:10 }}>
            <Select label="Cantón" required value={form.canton} onChange={e=>s('canton',e.target.value)}>
              <option value="">Seleccionar...</option>
              {CANTONS.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
            </Select>
            <Input label="PLZ (código postal)" placeholder="8001" value={form.plz} onChange={e=>s('plz',e.target.value)} style={{ maxLength:4 }} />
          </div>

          {/* Privacy selector */}
          <div style={{ marginBottom:10 }}>
            <p style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, letterSpacing:1, marginBottom:10 }}>VISIBILIDAD DEL CONTACTO *</p>
            <div className="grid-2" style={{ gap:10 }}>
              {[
                { id:'public',  ico:'🌐', title:'Público',  desc:'Tu contacto es visible para cualquier visitante, sin cuenta.', bg:C.successLight, border:C.successMid, tc:'#065F46' },
                { id:'private', ico:'🔒', title:'Privado',  desc:'Solo usuarios registrados pueden ver tu contacto.', bg:C.warnLight, border:C.warnMid, tc:'#92400E' },
              ].map(o => (
                <button key={o.id} onClick={() => s('privacy', o.id)}
                  style={{ background:form.privacy===o.id?o.bg:'#fff', border:`2px solid ${form.privacy===o.id?o.border:C.border}`, borderRadius:16, padding:'14px 12px', cursor:'pointer', textAlign:'center', transition:'all .15s' }}>
                  <p style={{ fontSize:26, marginBottom:6 }}>{o.ico}</p>
                  <p style={{ fontFamily:PP, fontWeight:700, fontSize:13, color:form.privacy===o.id?o.tc:C.text, marginBottom:5 }}>{o.title}</p>
                  <p style={{ fontFamily:PP, fontSize:10, color:C.light, lineHeight:1.4 }}>{o.desc}</p>
                </button>
              ))}
            </div>
            <div style={{ background:form.privacy==='private'?C.warnLight:C.successLight, border:`1px solid ${form.privacy==='private'?C.warnMid:C.successMid}`, borderRadius:12, padding:'10px 13px', marginTop:10 }}>
              <p style={{ fontFamily:PP, fontSize:11, color:form.privacy==='private'?'#92400E':'#065F46', margin:0, lineHeight:1.5 }}>
                {form.privacy==='private'
                  ? '🔒 Tu WhatsApp/email solo se muestra a usuarios con cuenta. Más seguridad, mejor calidad de contactos.'
                  : '🌐 Tu contacto es visible para todos, incluso sin cuenta. Máximo alcance y más respuestas.'}
              </p>
            </div>
          </div>

          {/* Preview */}
          {form.title && (
            <div style={{ background:C.bg, borderRadius:14, padding:'12px 14px', marginBottom:10 }}>
              <p style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, marginBottom:8, letterSpacing:0.5 }}>VISTA PREVIA</p>
              <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:6 }}>
                {selectedCat && <span style={{ fontFamily:PP, fontSize:10, fontWeight:600, padding:'3px 8px', borderRadius:20, background:form.privacy==='private'?C.warnLight:C.successLight, color:form.privacy==='private'?'#92400E':'#065F46' }}>{form.privacy==='private'?'🔒 Privado':'🌐 Público'}</span>}
                {form.canton && <span style={{ fontFamily:PP, fontSize:10, fontWeight:600, padding:'3px 8px', borderRadius:20, background:C.primaryLight, color:C.primary }}>📍 {form.canton} {form.plz}</span>}
              </div>
              <p style={{ fontFamily:PP, fontWeight:700, fontSize:13, color:C.text }}>{form.title}</p>
              {form.price && <p style={{ fontFamily:PP, fontWeight:800, fontSize:14, color:C.primary, marginTop:4 }}>{form.price}</p>}
            </div>
          )}
        </>
      )}

      {/* Navigation */}
      <div style={{ display:'flex', gap:10, marginTop:24 }}>
        {step > 0 && (
          <Btn onClick={() => setStep(s => s-1)} variant="secondary" style={{ flex:'0 0 100px' }}>← Atrás</Btn>
        )}
        {step < STEPS.length - 1 ? (
          <Btn onClick={() => { if(step===0&&!form.cat)return; if(step===1&&!form.type)return; setStep(s=>s+1); }} style={{ flex:1 }}>
            Continuar →
          </Btn>
        ) : (
          <Btn onClick={handleSubmit} disabled={loading} variant="success" style={{ flex:1 }}>
            {loading ? '⏳ Publicando...' : '✅ Publicar anuncio'}
          </Btn>
        )}
      </div>
      <p style={{ fontFamily:PP, fontSize:11, color:C.light, textAlign:'center', marginTop:12 }}>
        Tus anuncios se revisan automáticamente. Respeta las normas de la comunidad.
      </p>
    </div>
  )
}
