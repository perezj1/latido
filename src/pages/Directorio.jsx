import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { MOCK_PROVIDERS, MOCK_REVIEWS, MOCK_PROVIDER_PHOTOS, EVENT_CATS, PRICE_RANGES, CANTONS } from '../lib/constants'
import { C, PP, CAT_COLORS } from '../lib/theme'
import { Tag, Btn, PillFilters, Modal, InfoBanner } from '../components/UI'
import { Stars, ReviewCard, ReviewForm, PhotoGallery } from '../components/UI'
import toast from 'react-hot-toast'

// ── Provider card (grid) ────────────────────────────────────────
function ProvCard({ p, onClick }) {
  const cat = EVENT_CATS.find(c => c.id === (p.cat || p.category))
  const pr  = PRICE_RANGES.find(r => r.id === p.price_range)

  // avg rating from mock reviews
  const provReviews = MOCK_REVIEWS[p.id] || []
  const avgRating   = provReviews.length
    ? +(provReviews.reduce((s,r) => s + r.stars, 0) / provReviews.length).toFixed(1)
    : null

  return (
    <div onClick={onClick} style={{ background:'#fff', borderRadius:20, border:`1px solid ${C.border}`, overflow:'hidden', cursor:'pointer', transition:'all .2s' }}
      onMouseEnter={e=>{ e.currentTarget.style.boxShadow=`0 8px 28px rgba(37,99,235,0.12)`; e.currentTarget.style.transform='translateY(-3px)' }}
      onMouseLeave={e=>{ e.currentTarget.style.boxShadow='none'; e.currentTarget.style.transform='translateY(0)' }}>
      {/* Cover photo */}
      <div style={{ position:'relative', height:160, overflow:'hidden', background:C.primaryLight }}>
        {p.photo_url
          ? <img src={p.photo_url} alt={p.name} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
          : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:48 }}>{cat?.emoji}</div>
        }
        <div style={{ position:'absolute', top:10, left:10, display:'flex', gap:5 }}>
          {p.featured && <Tag bg={C.primary} color="#fff">⭐ Destacado</Tag>}
          {p.verified && <Tag bg="rgba(255,255,255,0.95)" color="#065F46">✓</Tag>}
        </div>
        {/* Photo count badge */}
        {MOCK_PROVIDER_PHOTOS[p.id]?.length > 0 && (
          <span style={{ position:'absolute', bottom:10, left:10, fontFamily:PP, fontSize:9, fontWeight:600, background:'rgba(0,0,0,0.5)', color:'#fff', padding:'3px 8px', borderRadius:10 }}>
            📷 {(MOCK_PROVIDER_PHOTOS[p.id].length + 1)} fotos
          </span>
        )}
        {pr && (
          <span style={{ position:'absolute', bottom:10, right:10, fontFamily:PP, fontSize:10, fontWeight:600, background:'rgba(255,255,255,0.92)', color:C.mid, padding:'3px 9px', borderRadius:10 }}>
            {pr.label}
          </span>
        )}
      </div>

      {/* Content */}
      <div style={{ padding:'14px 16px 16px' }}>
        {cat && <Tag bg="#DBEAFE" color={C.primaryDark} style={{ marginBottom:8 }}>{cat.emoji} {cat.label}</Tag>}
        <h3 style={{ fontFamily:PP, fontWeight:700, fontSize:15, color:C.text, marginBottom:4, lineHeight:1.3 }}>{p.name}</h3>

        {/* Rating row */}
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
          {avgRating !== null ? (
            <>
              <Stars rating={avgRating} size={13} showNumber count={provReviews.length} />
            </>
          ) : (
            <span style={{ fontFamily:PP, fontSize:10, color:C.light }}>Sin reseñas aún</span>
          )}
          <span style={{ fontFamily:PP, fontSize:10, color:C.light }}>· 📍 {p.city || p.canton}</span>
        </div>

        <p style={{ fontFamily:PP, fontSize:12, color:C.mid, lineHeight:1.55, marginBottom:12, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{p.description}</p>
        {p.services?.length > 0 && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:12 }}>
            {p.services.slice(0,3).map(s => <Tag key={s} bg={C.primaryLight} color={C.primary}>{s}</Tag>)}
          </div>
        )}
        <div style={{ display:'flex', gap:8 }}>
          <div style={{ fontFamily:PP, fontWeight:700, fontSize:12, background:C.primary, color:'#fff', padding:'10px 0', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', flex:1 }}>Ver perfil →</div>
          {p.whatsapp && (
            <a href={`https://wa.me/${p.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}
              style={{ width:40, height:40, background:'#D1FAE5', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, textDecoration:'none' }}>💬</a>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Provider detail modal ───────────────────────────────────────
function ProviderDetail({ p, onClose }) {
  const { isLoggedIn, displayName } = useAuth()
  const cat         = EVENT_CATS.find(c => c.id === (p.cat || p.category))
  const photos      = MOCK_PROVIDER_PHOTOS[p.id] || []
  const [reviews, setReviews]       = useState(MOCK_REVIEWS[p.id] || [])
  const [showReviewForm, setForm]   = useState(false)
  const [tab, setTab]               = useState('info') // 'info' | 'fotos' | 'resenas'

  const avgRating = reviews.length
    ? +(reviews.reduce((s,r) => s + r.stars, 0) / reviews.length).toFixed(1)
    : null

  const handleAddReview = (rev) => {
    setReviews(prev => [{ id:`new-${Date.now()}`, ...rev, author: isLoggedIn ? displayName : rev.name }, ...prev])
    setForm(false)
    toast.success('¡Reseña publicada!')
  }

  return (
    <div className="fade-in" style={{ position:'fixed', inset:0, zIndex:90, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.5)', backdropFilter:'blur(3px)' }} onClick={onClose}/>
      <div className="fade-up" style={{ position:'relative', background:'#fff', borderRadius:'24px 24px 0 0', width:'100%', maxWidth:680, maxHeight:'92vh', overflowY:'auto', display:'flex', flexDirection:'column' }}>

        {/* Sticky header */}
        <div style={{ position:'sticky', top:0, background:'#fff', borderBottom:`1px solid ${C.border}`, padding:'14px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', zIndex:10, borderRadius:'24px 24px 0 0' }}>
          <div>
            <p style={{ fontFamily:PP, fontWeight:800, fontSize:17, color:C.text, margin:'0 0 2px' }}>{p.name}</p>
            {avgRating && <Stars rating={avgRating} size={12} showNumber count={reviews.length} />}
          </div>
          <button onClick={onClose} style={{ width:32, height:32, borderRadius:'50%', background:C.bg, border:'none', cursor:'pointer', fontSize:14, color:C.mid }}>✕</button>
        </div>

        {/* Tab bar */}
        <div style={{ display:'flex', borderBottom:`1px solid ${C.border}`, background:'#fff' }}>
          {[
            { id:'info',   label:'ℹ️ Info' },
            { id:'fotos',  label:`📷 Fotos (${photos.length + 1})` },
            { id:'resenas',label:`⭐ Reseñas (${reviews.length})` },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ flex:1, fontFamily:PP, fontWeight:600, fontSize:12, padding:'12px 0', background:'none', border:'none', borderBottom:`3px solid ${tab===t.id?C.primary:'transparent'}`, cursor:'pointer', color:tab===t.id?C.primary:C.mid, transition:'all .15s' }}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ padding:'16px 20px 28px', flex:1 }}>

          {/* ── INFO TAB ── */}
          {tab === 'info' && (
            <>
              {/* Cover photo small */}
              {p.photo_url && (
                <div style={{ borderRadius:16, overflow:'hidden', height:180, marginBottom:14 }}>
                  <img src={p.photo_url} alt={p.name} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                </div>
              )}

              {/* Badges */}
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
                {cat && <Tag bg="#DBEAFE" color={C.primaryDark}>{cat.emoji} {cat.label}</Tag>}
                {p.verified && <Tag bg="#D1FAE5" color="#065F46">✓ Verificado</Tag>}
                {p.featured && <Tag bg="#FEF3C7" color="#92400E">⭐ Destacado</Tag>}
                {p.price_range && <Tag bg={C.bg} color={C.mid}>{PRICE_RANGES.find(r=>r.id===p.price_range)?.label}</Tag>}
                <Tag bg={C.bg} color={C.mid}>📍 {p.city || p.canton}</Tag>
              </div>

              <p style={{ fontFamily:PP, fontSize:13, color:C.mid, lineHeight:1.75, marginBottom:14 }}>{p.description}</p>

              {/* Services */}
              {p.services?.length > 0 && (
                <div style={{ marginBottom:16 }}>
                  <p style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, letterSpacing:1, marginBottom:8 }}>SERVICIOS</p>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                    {p.services.map(s => <span key={s} style={{ fontFamily:PP, fontSize:12, fontWeight:600, background:C.primaryLight, color:C.primary, padding:'7px 14px', borderRadius:10 }}>{s}</span>)}
                  </div>
                </div>
              )}

              {/* Contact */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
                {p.whatsapp && (
                  <a href={`https://wa.me/${p.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                    style={{ fontFamily:PP, fontWeight:700, fontSize:13, background:'#25D366', color:'#fff', textDecoration:'none', padding:'13px 0', borderRadius:13, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                    💬 WhatsApp
                  </a>
                )}
                {p.email && (
                  <a href={`mailto:${p.email}`}
                    style={{ fontFamily:PP, fontWeight:700, fontSize:13, background:C.primary, color:'#fff', textDecoration:'none', padding:'13px 0', borderRadius:13, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                    📧 Email
                  </a>
                )}
              </div>

              {/* Instagram */}
              {p.instagram && (
                <a href={`https://instagram.com/${p.instagram.replace('@','')}`} target="_blank" rel="noreferrer"
                  style={{ fontFamily:PP, fontSize:12, fontWeight:600, color:C.primary, display:'flex', alignItems:'center', gap:6, textDecoration:'none', marginBottom:14 }}>
                  <span style={{ fontSize:18 }}>📸</span> {p.instagram}
                </a>
              )}

              {/* Shortcut to reviews */}
              {reviews.length > 0 && (
                <button onClick={() => setTab('resenas')} style={{ width:'100%', background:C.bg, border:`1px solid ${C.border}`, borderRadius:13, padding:'11px 14px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <Stars rating={avgRating} size={14} />
                    <span style={{ fontFamily:PP, fontSize:12, fontWeight:600, color:C.text }}>{avgRating} de 5</span>
                  </div>
                  <span style={{ fontFamily:PP, fontSize:11, color:C.primary, fontWeight:600 }}>Ver {reviews.length} reseñas →</span>
                </button>
              )}
            </>
          )}

          {/* ── FOTOS TAB ── */}
          {tab === 'fotos' && (
            <>
              <PhotoGallery photos={photos} mainPhoto={p.photo_url} />
              <p style={{ fontFamily:PP, fontSize:11, color:C.light, textAlign:'center' }}>
                {photos.length + 1} foto{photos.length + 1 !== 1 ? 's' : ''} · Toca las miniaturas para navegar
              </p>
            </>
          )}

          {/* ── RESEÑAS TAB ── */}
          {tab === 'resenas' && (
            <>
              {/* Summary bar */}
              {reviews.length > 0 && (
                <div style={{ background:C.bg, borderRadius:16, padding:'16px', marginBottom:16, display:'flex', gap:20, alignItems:'center' }}>
                  <div style={{ textAlign:'center' }}>
                    <p style={{ fontFamily:PP, fontWeight:900, fontSize:36, color:C.text, margin:'0 0 4px', letterSpacing:-1 }}>{avgRating}</p>
                    <Stars rating={avgRating} size={16} />
                    <p style={{ fontFamily:PP, fontSize:11, color:C.light, margin:'4px 0 0' }}>{reviews.length} reseña{reviews.length!==1?'s':''}</p>
                  </div>
                  {/* Star breakdown */}
                  <div style={{ flex:1 }}>
                    {[5,4,3,2,1].map(s => {
                      const count = reviews.filter(r => r.stars === s).length
                      const pct   = reviews.length ? Math.round(count / reviews.length * 100) : 0
                      return (
                        <div key={s} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                          <span style={{ fontFamily:PP, fontSize:10, color:C.mid, width:8 }}>{s}</span>
                          <span style={{ fontSize:10, color:'#F59E0B' }}>★</span>
                          <div style={{ flex:1, height:6, background:C.border, borderRadius:3, overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${pct}%`, background:'#F59E0B', borderRadius:3, transition:'width .4s' }}/>
                          </div>
                          <span style={{ fontFamily:PP, fontSize:10, color:C.light, width:24, textAlign:'right' }}>{count}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Write review CTA */}
              {!showReviewForm ? (
                <button onClick={() => setForm(true)} style={{ width:'100%', background:C.primaryLight, border:`1.5px dashed ${C.primary}`, borderRadius:14, padding:'12px 0', fontFamily:PP, fontWeight:700, fontSize:13, color:C.primary, cursor:'pointer', marginBottom:14 }}>
                  ✍️ Escribir una reseña
                </button>
              ) : (
                <ReviewForm onSubmit={handleAddReview} onCancel={() => setForm(false)} />
              )}

              {/* Review list */}
              {reviews.length === 0 ? (
                <div style={{ textAlign:'center', padding:'32px 0' }}>
                  <p style={{ fontSize:40, marginBottom:10 }}>⭐</p>
                  <p style={{ fontFamily:PP, fontWeight:700, fontSize:15, color:C.text, marginBottom:5 }}>Sin reseñas todavía</p>
                  <p style={{ fontFamily:PP, fontSize:12, color:C.light }}>¡Sé el primero en dejar una reseña!</p>
                </div>
              ) : (
                reviews.map(r => <ReviewCard key={r.id} review={r} />)
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────
export default function Directorio() {
  const [providers, setProviders] = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [cat, setCat]             = useState('')
  const [selected, setSelected]   = useState(null)
  const [showRegister, setShowRegister] = useState(false)
  const [regForm, setRegForm]     = useState({ name:'', cat:'', city:'', desc:'', whatsapp:'', email:'' })

  const catOptions = [{ id:'', label:'Todos' }, ...EVENT_CATS.map(c => ({ id:c.id, label:`${c.emoji} ${c.label}` }))]

  useEffect(() => {
    let q = supabase.from('providers').select('*').eq('active', true).order('featured', { ascending:false })
    if (cat) q = q.eq('category', cat)
    q.then(({ data, error }) => {
      setProviders(error || !data?.length ? MOCK_PROVIDERS.filter(p => !cat || (p.cat||p.category)===cat) : data)
      setLoading(false)
    }).catch(() => { setProviders(MOCK_PROVIDERS.filter(p => !cat || (p.cat||p.category)===cat)); setLoading(false) })
  }, [cat])

  const filtered = providers.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))

  const handleRegSubmit = async () => {
    if (!regForm.name || !regForm.city) { toast.error('Nombre y ciudad son obligatorios'); return }
    try {
      await supabase.from('providers').insert({ ...regForm, category:regForm.cat, active:false, featured:false, verified:false })
      toast.success('¡Solicitud enviada! Te avisamos en 24–48h')
      setShowRegister(false)
    } catch { toast.success('¡Solicitud recibida! (modo demo)'); setShowRegister(false) }
  }

  return (
    <div style={{ maxWidth:1200, margin:'0 auto', padding:'32px 24px 100px' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:26, color:C.text, letterSpacing:-0.5, marginBottom:4 }}>🎉 Directorio de eventos</h1>
          <p style={{ fontFamily:PP, fontSize:13, color:C.light }}>Proveedores latinos · Fotos reales · Reseñas de la comunidad</p>
        </div>
        <button onClick={() => setShowRegister(true)} style={{ fontFamily:PP, fontWeight:700, fontSize:12, background:C.primary, color:'#fff', border:'none', borderRadius:13, padding:'11px 18px', cursor:'pointer', flexShrink:0 }}>
          + Registrar negocio gratis
        </button>
      </div>

      {/* Search */}
      <div style={{ position:'relative', marginBottom:12 }}>
        <span style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', color:C.light }}>🔍</span>
        <input style={{ width:'100%', border:`1.5px solid ${C.border}`, borderRadius:13, padding:'11px 13px 11px 36px', fontSize:12, fontFamily:PP, outline:'none', background:'#fff', boxSizing:'border-box' }}
          placeholder="Buscar por nombre o servicio..." value={search} onChange={e => setSearch(e.target.value)}/>
      </div>

      <PillFilters options={catOptions} value={cat} onChange={setCat} className="mb-4" />

      {/* Grid */}
      {loading ? (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:16 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height:320, borderRadius:20 }}/>)}
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:16 }}>
          {filtered.map(p => <ProvCard key={p.id} p={p} onClick={() => setSelected(p)} />)}
        </div>
      )}

      {/* Provider detail */}
      {selected && <ProviderDetail p={selected} onClose={() => setSelected(null)} />}

      {/* Register modal */}
      <Modal show={showRegister} onClose={() => setShowRegister(false)} title="Registrar negocio gratis">
        <InfoBanner emoji="✨" title="Sin comisiones" text="Gratis para siempre. Los clientes te contactan directamente." bg="#ECFDF5" border="#6EE7B7" color="#065F46" />
        <div style={{ marginBottom:10 }}>
          <label style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, letterSpacing:1, display:'block', marginBottom:6 }}>NOMBRE DEL NEGOCIO *</label>
          <input style={{ width:'100%', border:`1.5px solid ${C.border}`, borderRadius:12, padding:'11px 13px', fontSize:13, fontFamily:PP, outline:'none', background:'#fff', boxSizing:'border-box', marginBottom:10 }} placeholder="DJ Sebastián / Foto & Film Latino..." value={regForm.name} onChange={e=>setRegForm({...regForm,name:e.target.value})}/>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
          <div>
            <label style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, letterSpacing:1, display:'block', marginBottom:6 }}>CATEGORÍA</label>
            <select style={{ width:'100%', border:`1.5px solid ${C.border}`, borderRadius:12, padding:'11px 13px', fontSize:12, fontFamily:PP, outline:'none', background:'#fff' }} value={regForm.cat} onChange={e=>setRegForm({...regForm,cat:e.target.value})}>
              <option value="">Seleccionar...</option>
              {EVENT_CATS.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, letterSpacing:1, display:'block', marginBottom:6 }}>CIUDAD *</label>
            <input style={{ width:'100%', border:`1.5px solid ${C.border}`, borderRadius:12, padding:'11px 13px', fontSize:12, fontFamily:PP, outline:'none', background:'#fff', boxSizing:'border-box' }} placeholder="Zürich, Ginebra..." value={regForm.city} onChange={e=>setRegForm({...regForm,city:e.target.value})}/>
          </div>
        </div>
        <div style={{ marginBottom:10 }}>
          <label style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, letterSpacing:1, display:'block', marginBottom:6 }}>DESCRIPCIÓN</label>
          <textarea style={{ width:'100%', border:`1.5px solid ${C.border}`, borderRadius:12, padding:'11px 13px', fontSize:12, fontFamily:PP, outline:'none', background:'#fff', resize:'none', minHeight:80, boxSizing:'border-box', marginBottom:10 }} placeholder="Qué ofreces, especialidades, experiencia..." value={regForm.desc} onChange={e=>setRegForm({...regForm,desc:e.target.value})}/>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
          {[['💬 WhatsApp','whatsapp','+41 XX XXX XX XX'],['📧 Email','email','tu@negocio.ch']].map(([l,k,ph]) => (
            <div key={k}>
              <label style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, letterSpacing:1, display:'block', marginBottom:6 }}>{l}</label>
              <input style={{ width:'100%', border:`1.5px solid ${C.border}`, borderRadius:12, padding:'11px 13px', fontSize:12, fontFamily:PP, outline:'none', background:'#fff', boxSizing:'border-box' }} placeholder={ph} value={regForm[k]} onChange={e=>setRegForm({...regForm,[k]:e.target.value})}/>
            </div>
          ))}
        </div>
        <Btn onClick={handleRegSubmit}>🚀 Enviar solicitud gratis</Btn>
      </Modal>
    </div>
  )
}
