import { useEffect, useId, useState } from 'react'
import { C, PP } from '../lib/theme'
import { AD_CATS as BASE_AD_CATS, normalizeAdCat } from '../lib/constants'
import { useOverlayHistory } from '../hooks/useOverlayHistory'

// ── Button ─────────────────────────────────────────────────────
export function Btn({ children, onClick, variant='primary', size='md', disabled=false, style={}, className='' }) {
  const sizes = { sm:'10px 16px', md:'12px 20px', lg:'14px 24px' }
  const variants = {
    primary:   { background:C.primary,      color:'#fff',    border:'none' },
    secondary: { background:C.bg,           color:C.primary, border:`1.5px solid ${C.border}` },
    ghost:     { background:'transparent',  color:C.primary, border:`1.5px solid ${C.primary}` },
    danger:    { background:C.dangerLight,  color:C.danger,  border:'none' },
    success:   { background:C.successLight, color:C.success, border:'none' },
    white:     { background:'#fff',         color:C.primary, border:'none' },
    dark:      { background:C.text,         color:'#fff',    border:'none' },
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={className}
      style={{
        fontFamily: PP, fontWeight:700, fontSize:13, borderRadius:14,
        cursor: disabled?'not-allowed':'pointer',
        padding: sizes[size], display:'flex', alignItems:'center',
        justifyContent:'center', gap:6, width:'100%', letterSpacing:0.2,
        opacity: disabled ? 0.55 : 1, transition:'all .15s',
        ...variants[variant], ...style,
      }}
    >
      {children}
    </button>
  )
}

// ── Card ───────────────────────────────────────────────────────
export function Card({ children, onClick, style={} }) {
  return (
    <div
      onClick={onClick}
      style={{
        background:C.surface, borderRadius:20, padding:16, marginBottom:10,
        boxShadow:'0 2px 12px rgba(0,0,0,0.05)', border:`1px solid ${C.border}`,
        cursor: onClick?'pointer':'default', transition: onClick?'all .2s':'none',
        ...style,
      }}
      onMouseEnter={e => { if(onClick){ e.currentTarget.style.boxShadow='0 6px 24px rgba(37,99,235,0.1)'; e.currentTarget.style.transform='translateY(-1px)' }}}
      onMouseLeave={e => { if(onClick){ e.currentTarget.style.boxShadow='0 2px 12px rgba(0,0,0,0.05)'; e.currentTarget.style.transform='translateY(0)' }}}
    >
      {children}
    </div>
  )
}

// ── Tag / Pill ─────────────────────────────────────────────────
export function Tag({ children, bg=C.primaryLight, color=C.primary, size=10 }) {
  return (
    <span style={{ fontFamily:PP, fontSize:size, fontWeight:600, padding:'3px 8px', borderRadius:20, background:bg, color, whiteSpace:'nowrap', flexShrink:0 }}>
      {children}
    </span>
  )
}

// ── Avatar ─────────────────────────────────────────────────────
export function Avatar({ name='?', size=32, src }) {
  const colors = ['#3B82F6','#8B5CF6','#EC4899','#10B981','#F59E0B','#EF4444']
  const bg = colors[(name?.charCodeAt(0) || 0) % colors.length]
  if (src) return <img src={src} style={{ width:size, height:size, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} alt={name} />
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', background:bg, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontFamily:PP, fontWeight:700, fontSize:size*0.38, flexShrink:0 }}>
      {name?.[0]?.toUpperCase() || '?'}
    </div>
  )
}

// ── Privacy badge ──────────────────────────────────────────────
export function PrivacyTag({ privacy }) {
  return null
}

// ── Input ──────────────────────────────────────────────────────
export function Input({ label, placeholder, value, onChange, type='text', rows, required, style={} }) {
  const base = {
    width:'100%', border:`1.5px solid ${C.border}`, borderRadius:12,
    padding:'11px 13px', fontSize:13, fontFamily:PP, outline:'none',
    background:C.surface, color:C.text, boxSizing:'border-box',
    marginBottom: label ? 0 : 10,
  }
  return (
    <div style={{ marginBottom: 10 }}>
      {label && <label style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, letterSpacing:1, display:'block', marginBottom:6 }}>{label}{required&&' *'}</label>}
      {rows
        ? <textarea style={{ ...base, resize:'none', minHeight: rows*24, ...style }} placeholder={placeholder} value={value} onChange={onChange} rows={rows} />
        : <input    style={{ ...base, ...style }} type={type} placeholder={placeholder} value={value} onChange={onChange} />
      }
    </div>
  )
}

// ── Select ─────────────────────────────────────────────────────
export function Select({ label, value, onChange, children, required }) {
  return (
    <div style={{ marginBottom:10 }}>
      {label && <label style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, letterSpacing:1, display:'block', marginBottom:6 }}>{label}{required&&' *'}</label>}
      <div style={{ position:'relative' }}>
        <select
          value={value} onChange={onChange}
          style={{ width:'100%', border:`1.5px solid ${C.border}`, borderRadius:12, padding:'11px 40px 11px 13px', fontSize:13, fontFamily:PP, outline:'none', background:C.surface, color:C.text, appearance:'none', WebkitAppearance:'none', MozAppearance:'none', cursor:'pointer' }}
        >
          {children}
        </select>
        <span
          style={{
            position:'absolute',
            right:14,
            top:'50%',
            transform:'translateY(-50%)',
            color:C.light,
            fontSize:14,
            pointerEvents:'none',
          }}
        >
          ▾
        </span>
      </div>
    </div>
  )
}

// ── Bottom Sheet ───────────────────────────────────────────────
export function ImageUploadField({
  label,
  hint,
  previewUrl='',
  previewUrls=[],
  uploading=false,
  multiple=false,
  onFilesSelected,
  onRemove,
  onRemoveAt,
}) {
  const deviceId = useId()
  const cameraId = useId()
  const previews = previewUrls.length ? previewUrls : (previewUrl ? [previewUrl] : [])

  const handleFiles = event => {
    const files = Array.from(event.target.files || [])
    if (files.length) onFilesSelected?.(files)
    event.target.value = ''
  }

  return (
    <div style={{ marginBottom:12 }}>
      {label && <label style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, letterSpacing:1, display:'block', marginBottom:6 }}>{label}</label>}

      {previews.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns: multiple ? 'repeat(auto-fill,minmax(88px,1fr))' : '1fr', gap:8, marginBottom:10 }}>
          {previews.map((url, index) => (
            <div key={`${url}-${index}`} style={{ position:'relative', borderRadius:14, overflow:'hidden', border:`1px solid ${C.border}`, background:C.bg, minHeight: multiple ? 88 : 180 }}>
              <img src={url} alt="Vista previa" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
              {(multiple ? onRemoveAt : onRemove) && (
                <button
                  type="button"
                  onClick={() => multiple ? onRemoveAt?.(index) : onRemove?.()}
                  style={{ position:'absolute', top:8, right:8, width:28, height:28, borderRadius:'50%', border:'none', background:'rgba(15,23,42,0.72)', color:'#fff', cursor:'pointer', fontSize:13 }}
                >
                  X
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ border:`1.5px dashed ${uploading ? C.primary : C.border}`, borderRadius:16, padding:'14px 14px 12px', background:uploading ? C.primaryLight : '#fff' }}>
        <p style={{ fontFamily:PP, fontWeight:700, fontSize:13, color:C.text, margin:'0 0 4px' }}>
          {uploading ? 'Subiendo imagen...' : multiple ? 'Añade fotos desde tu dispositivo o la cámara' : 'Añade una imagen desde tu dispositivo o la cámara'}
        </p>
        <p style={{ fontFamily:PP, fontSize:11, color:C.light, margin:'0 0 12px', lineHeight:1.6 }}>
          {hint || (multiple ? 'En móvil puedes abrir la cámara o seleccionar varias fotos de la galería.' : 'En móvil puedes tomar una foto al momento o elegir una desde la galería.')}
        </p>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,minmax(0,1fr))', gap:8 }}>
          <label htmlFor={deviceId} style={{ fontFamily:PP, fontWeight:700, fontSize:12, background:C.primary, color:'#fff', borderRadius:12, padding:'11px 12px', textAlign:'center', cursor:uploading ? 'not-allowed' : 'pointer', opacity:uploading ? 0.6 : 1 }}>
            🖼 Desde dispositivo
          </label>
          <label htmlFor={cameraId} style={{ fontFamily:PP, fontWeight:700, fontSize:12, background:C.bg, color:C.primary, border:`1.5px solid ${C.primaryMid}`, borderRadius:12, padding:'11px 12px', textAlign:'center', cursor:uploading ? 'not-allowed' : 'pointer', opacity:uploading ? 0.6 : 1 }}>
            📷 Usar cámara
          </label>
        </div>

        <input id={deviceId} type="file" accept="image/*" multiple={multiple} onChange={handleFiles} disabled={uploading} style={{ display:'none' }} />
        <input id={cameraId} type="file" accept="image/*" capture="environment" onChange={handleFiles} disabled={uploading} style={{ display:'none' }} />
      </div>
    </div>
  )
}

export function Sheet({ show, onClose, title, children, syncHistory=true }) {
  useOverlayHistory(show, onClose, syncHistory)

  useEffect(() => {
    if (!show) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [show])

  if (!show) return null
  return (
    <div className="fade-in" style={{ position:'fixed', inset:0, zIndex:80, display:'flex', flexDirection:'column', justifyContent:'flex-end' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.4)' }} onClick={onClose} />
      <div className="fade-up" onClick={e => e.stopPropagation()}
        style={{ position:'relative', background:C.surface, borderRadius:'24px 24px 0 0', padding:'4px 20px 40px', maxHeight:'88vh', overflowY:'auto' }}>
        <div style={{ width:36, height:4, background:C.border, borderRadius:4, margin:'12px auto 16px' }} />
        {title && <p style={{ fontFamily:PP, fontWeight:800, fontSize:17, color:C.text, marginBottom:14 }}>{title}</p>}
        {children}
      </div>
    </div>
  )
}

// ── Modal (centered) ───────────────────────────────────────────
export function Modal({ show, onClose, title, children, syncHistory=true }) {
  useOverlayHistory(show, onClose, syncHistory)

  useEffect(() => {
    if (!show) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [show])

  if (!show) return null
  return (
    <div className="fade-in" style={{ position:'fixed', inset:0, zIndex:80, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.45)', backdropFilter:'blur(4px)' }} onClick={onClose} />
      <div className="fade-up" style={{ position:'relative', background:C.surface, borderRadius:24, width:'100%', maxWidth:560, maxHeight:'85vh', overflowY:'auto', boxShadow:'0 24px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ position:'sticky', top:0, background:C.surface, borderBottom:`1px solid ${C.border}`, padding:'16px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', borderRadius:'24px 24px 0 0' }}>
          <p style={{ fontFamily:PP, fontWeight:800, fontSize:17, color:C.text, margin:0 }}>{title}</p>
          <button onClick={onClose} style={{ width:32, height:32, borderRadius:'50%', background:C.bg, border:'none', cursor:'pointer', fontSize:14, color:C.mid }}>✕</button>
        </div>
        <div style={{ padding:20 }}>{children}</div>
      </div>
    </div>
  )
}

// ── Progress steps ─────────────────────────────────────────────
export function ProgressBar({ step, total }) {
  return (
    <div style={{ marginBottom:20 }}>
      <div style={{ display:'flex', gap:4, marginBottom:6 }}>
        {Array.from({length:total}).map((_,i) => (
          <div key={i} style={{ flex:1, height:4, borderRadius:4, background: i<=step ? C.primary : C.border, transition:'background .3s' }} />
        ))}
      </div>
      <p style={{ fontFamily:PP, fontSize:11, color:C.light, margin:0 }}>Paso {step+1} de {total}</p>
    </div>
  )
}

// ── Pill filter row ────────────────────────────────────────────
export function PillFilters({ options, value, onChange, className='' }) {
  return (
    <div className={`no-scroll ${className}`} style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:2 }}>
      {options.map(o => {
        const active = value === o.id
        return (
          <button key={o.id} onClick={() => onChange(active ? '' : o.id)} style={{
            fontFamily:PP, fontSize:10, fontWeight:600, padding:'5px 12px', borderRadius:20,
            border:`1.5px solid ${active ? C.primary : C.border}`,
            background: active ? C.primary : C.surface,
            color: active ? '#fff' : C.mid, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0,
          }}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Segmented tabs ─────────────────────────────────────────────
export function SegmentedTabs({ tabs, value, onChange }) {
  return (
    <div style={{ display:'flex', gap:3, background:C.border, borderRadius:14, padding:4, marginBottom:16 }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{
          flex:1, fontFamily:PP, fontSize:10, fontWeight:700, padding:'8px 4px', borderRadius:10,
          border:'none', cursor:'pointer',
          background: value===t.id ? '#fff' : 'transparent',
          color: value===t.id ? C.primary : C.mid,
          boxShadow: value===t.id ? '0 1px 6px rgba(0,0,0,0.1)' : 'none', transition:'all .2s',
        }}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ── Info banner ────────────────────────────────────────────────
export function InfoBanner({ emoji, title, text, bg=C.warnLight, border=C.warnMid, color='#92400E' }) {
  return (
    <div style={{ background:bg, border:`1px solid ${border}`, borderRadius:16, padding:'10px 13px', marginBottom:14, display:'flex', gap:10, alignItems:'flex-start' }}>
      <span style={{ fontSize:18, flexShrink:0 }}>{emoji}</span>
      <div>
        {title && <p style={{ fontFamily:PP, fontWeight:700, fontSize:12, color, margin:'0 0 2px' }}>{title}</p>}
        <p style={{ fontFamily:PP, fontSize:11, color, margin:0, lineHeight:1.55, opacity:.9 }}>{text}</p>
      </div>
    </div>
  )
}

// ── Empty state ────────────────────────────────────────────────
export function EmptyState({ emoji='😕', title, sub, action, onAction }) {
  return (
    <div style={{ textAlign:'center', padding:'48px 20px' }}>
      <div style={{ fontSize:52, marginBottom:14 }}>{emoji}</div>
      <h3 style={{ fontFamily:PP, fontWeight:800, fontSize:18, color:C.text, marginBottom:6 }}>{title}</h3>
      {sub && <p style={{ fontFamily:PP, fontSize:12, color:C.light, marginBottom:18 }}>{sub}</p>}
      {action && <Btn onClick={onAction} style={{ width:'auto', margin:'0 auto', padding:'10px 24px' }}>{action}</Btn>}
    </div>
  )
}

// ── Ad Card ────────────────────────────────────────────────────
export function AdCard({ ad, onClick, compact=false, onRevealContact }) {
  const { AD_CATS, CAT_COLORS_MAP } = (() => {
    const cats = [...BASE_AD_CATS, {id:'regalo',emoji:'🎁',label:'Regalo'}]
    const map = {vivienda:{bg:'#DBEAFE',tc:'#1D4ED8'},cuidados:{bg:'#FCE7F3',tc:'#9D174D'},documentos:{bg:'#EDE9FE',tc:'#6D28D9'},venta:{bg:'#FEF3C7',tc:'#92400E'},servicios:{bg:'#CCFBF1',tc:'#0F766E'},empleo:{bg:'#DBEAFE',tc:'#1D4ED8'},regalo:{bg:'#FEE2E2',tc:'#B91C1C'}}
    return { AD_CATS: cats, CAT_COLORS_MAP: map }
  })()
  const normalizedCat = normalizeAdCat(ad.cat)
  const cat = AD_CATS.find(c => c.id === normalizedCat)
  const cc  = CAT_COLORS_MAP[normalizedCat] || { bg:C.primaryLight, tc:C.primary }
  const typeMap = { busca:['🔍 Busca','#FEF3C7','#92400E'], ofrece:['✨ Ofrece','#D1FAE5','#065F46'], vende:['🏷️ Vende','#DBEAFE','#1D4ED8'], regala:['🎁 Regala','#FCE7F3','#9D174D'] }
  const [tl, tbg, ttc] = typeMap[ad.type] || ['•', C.bg, C.mid]

  if (compact) return (
    <div onClick={onClick} style={{ background:C.surface, borderRadius:13, border:`1px solid ${C.border}`, padding:'10px 12px', display:'flex', gap:10, alignItems:'flex-start', cursor:'pointer', transition:'all .15s' }}>
      <div style={{ width:36, height:36, background:cc.bg, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, flexShrink:0 }}>{cat?.emoji}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ fontFamily:PP, fontWeight:600, fontSize:12, color:C.text, lineHeight:1.3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:3 }}>{ad.title}</p>
        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
          <PrivacyTag privacy={ad.privacy}/>
          <Tag bg={cc.bg} color={cc.tc}>{cat?.emoji} {cat?.label}</Tag>
          <span style={{ fontFamily:PP, fontSize:9, color:C.light }}>📍 {ad.canton} · {ad.ts}</span>
        </div>
      </div>
      <span style={{ fontFamily:PP, fontSize:11, fontWeight:800, color:C.primary, flexShrink:0 }}>{ad.price}</span>
    </div>
  )

  return (
    <div onClick={onClick} style={{ background:C.surface, borderRadius:16, border:`1px solid ${C.border}`, overflow:'hidden', cursor:'pointer', transition:'all .2s' }}>
      {ad.img && <img src={ad.img} alt={ad.title} style={{ width:'100%', height:160, objectFit:'cover' }} />}
      <div style={{ padding:'12px 14px 14px' }}>
        <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:7 }}>
          <Tag bg={cc.bg} color={cc.tc}>{cat?.emoji} {cat?.label}</Tag>
          <PrivacyTag privacy={ad.privacy}/>
          {ad.verified && <Tag bg="#D1FAE5" color="#065F46">✓</Tag>}
        </div>
        <p style={{ fontFamily:PP, fontWeight:700, fontSize:13, color:C.text, lineHeight:1.35, marginBottom:4 }}>{ad.title}</p>
        <p style={{ fontFamily:PP, fontSize:11, color:C.mid, lineHeight:1.5, marginBottom:8, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{ad.desc}</p>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ display:'flex', gap:5, alignItems:'center' }}>
            <Avatar name={ad.user} size={20} />
            <span style={{ fontFamily:PP, fontSize:9, color:C.light }}>{ad.user} · {ad.ts} · {ad.canton} {ad.plz}</span>
          </div>
          <span style={{ fontFamily:PP, fontSize:12, fontWeight:800, color:C.primary }}>{ad.price}</span>
        </div>
      </div>
    </div>
  )
}



// ── Star Rating ────────────────────────────────────────────────
export function Stars({ rating, size = 14, showNumber = false, count }) {
  const full  = Math.floor(rating)
  const half  = rating % 1 >= 0.5
  const empty = 5 - full - (half ? 1 : 0)
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:2 }}>
      {Array(full).fill(0).map((_,i)  => <span key={`f${i}`} style={{ color:'#F59E0B', fontSize:size }}>★</span>)}
      {half                             && <span style={{ color:'#F59E0B', fontSize:size }}>½</span>}
      {Array(empty).fill(0).map((_,i) => <span key={`e${i}`} style={{ color:'#D1D5DB', fontSize:size }}>★</span>)}
      {showNumber && <span style={{ fontFamily:"'Poppins',sans-serif", fontSize:size-2, color:'#475569', marginLeft:3 }}>{rating.toFixed(1)}{count !== undefined && ` (${count})`}</span>}
    </span>
  )
}

// ── Review Card ────────────────────────────────────────────────
export function ReviewCard({ review }) {
  const colors = ['#3B82F6','#8B5CF6','#EC4899','#10B981','#F59E0B','#EF4444']
  const bg = colors[(review.author?.charCodeAt(0) || 0) % colors.length]
  return (
    <div style={{ background:'#FAFAFA', borderRadius:14, padding:'13px 15px', border:'1px solid #E2EAF4', marginBottom:10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
        <div style={{ display:'flex', gap:9, alignItems:'center' }}>
          <div style={{ width:34, height:34, borderRadius:'50%', background:bg, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontFamily:"'Poppins',sans-serif", fontWeight:700, fontSize:13, flexShrink:0 }}>
            {review.author?.[0]?.toUpperCase()}
          </div>
          <div>
            <p style={{ fontFamily:"'Poppins',sans-serif", fontWeight:600, fontSize:12, color:'#0F172A', margin:0 }}>{review.author}</p>
            <p style={{ fontFamily:"'Poppins',sans-serif", fontSize:10, color:'#94A3B8', margin:0 }}>📍 Cantón {review.canton} · {review.date}</p>
          </div>
        </div>
        <Stars rating={review.stars} size={12} />
      </div>
      <p style={{ fontFamily:"'Poppins',sans-serif", fontSize:12, color:'#475569', lineHeight:1.65, margin:0 }}>{review.text}</p>
    </div>
  )
}

// ── Photo Gallery ──────────────────────────────────────────────
export function PhotoGallery({ photos = [], mainPhoto }) {
  const [active, setActive] = useState(0)
  const all = mainPhoto ? [mainPhoto, ...photos.filter(p => p !== mainPhoto)] : photos
  if (!all.length) return null
  return (
    <div style={{ marginBottom:16 }}>
      {/* Main image */}
      <div className="photo-main" style={{ position:'relative', borderRadius:16, overflow:'hidden', marginBottom:8, background:'#fff', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <img src={all[active]} alt="foto" style={{ width:'100%', height:'auto', maxHeight:'100%', objectFit:'contain', display:'block', transition:'opacity .2s' }} />
        {all.length > 1 && (
          <>
            <button onClick={() => setActive(a => (a-1+all.length)%all.length)}
              style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', background:'rgba(0,0,0,0.45)', color:'#fff', border:'none', borderRadius:'50%', width:32, height:32, cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>‹</button>
            <button onClick={() => setActive(a => (a+1)%all.length)}
              style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'rgba(0,0,0,0.45)', color:'#fff', border:'none', borderRadius:'50%', width:32, height:32, cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>›</button>
            <span style={{ position:'absolute', bottom:10, right:12, fontFamily:"'Poppins',sans-serif", fontSize:10, fontWeight:600, background:'rgba(0,0,0,0.5)', color:'#fff', padding:'3px 8px', borderRadius:10 }}>
              {active+1} / {all.length}
            </span>
          </>
        )}
      </div>
      {/* Thumbnails */}
      {all.length > 1 && (
        <div style={{ display:'flex', gap:6, overflowX:'auto' }} className="no-scroll">
          {all.map((src, i) => (
            <img key={i} src={src} alt="" onClick={() => setActive(i)}
              style={{ width:60, height:44, objectFit:'contain', background:'#fff', borderRadius:9, flexShrink:0, cursor:'pointer', border:`2px solid ${i===active?'#2563EB':'transparent'}`, opacity: i===active?1:0.65, transition:'all .15s' }} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Write Review Form ──────────────────────────────────────────
export function ReviewForm({ onSubmit, onCancel }) {
  const [stars, setStars]   = useState(0)
  const [hover, setHover]   = useState(0)
  const [text, setText]     = useState('')
  const [name, setName]     = useState('')
  const [canton, setCanton] = useState('')

  const canSubmit = stars > 0 && text.trim().length > 10 && name.trim()

  return (
    <div style={{ background:'#F8FAFF', borderRadius:16, padding:'16px', border:'1px solid #E2EAF4', marginBottom:16 }}>
      <p style={{ fontFamily:"'Poppins',sans-serif", fontWeight:700, fontSize:14, color:'#0F172A', marginBottom:14 }}>✍️ Escribir reseña</p>

      {/* Star picker */}
      <div style={{ marginBottom:12 }}>
        <p style={{ fontFamily:"'Poppins',sans-serif", fontSize:10, fontWeight:700, color:'#94A3B8', letterSpacing:1, marginBottom:8 }}>TU VALORACIÓN *</p>
        <div style={{ display:'flex', gap:4 }}>
          {[1,2,3,4,5].map(n => (
            <button key={n} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} onClick={() => setStars(n)}
              style={{ background:'none', border:'none', cursor:'pointer', fontSize:28, color: n<=(hover||stars)?'#F59E0B':'#D1D5DB', transition:'color .1s', padding:'0 2px' }}>★</button>
          ))}
          {(hover||stars) > 0 && <span style={{ fontFamily:"'Poppins',sans-serif", fontSize:12, color:'#F59E0B', marginLeft:6, alignSelf:'center', fontWeight:600 }}>
            {['','Muy malo','Malo','Regular','Bueno','Excelente'][hover||stars]}
          </span>}
        </div>
      </div>

      {/* Name + canton */}
      <div className="grid-2" style={{ gap:8, marginBottom:8 }}>
        <div>
          <p style={{ fontFamily:"'Poppins',sans-serif", fontSize:10, fontWeight:700, color:'#94A3B8', letterSpacing:1, marginBottom:5 }}>TU NOMBRE *</p>
          <input style={{ width:'100%', border:'1.5px solid #E2EAF4', borderRadius:10, padding:'9px 12px', fontSize:12, fontFamily:"'Poppins',sans-serif", outline:'none', background:'#fff', boxSizing:'border-box' }}
            placeholder="María G." value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <p style={{ fontFamily:"'Poppins',sans-serif", fontSize:10, fontWeight:700, color:'#94A3B8', letterSpacing:1, marginBottom:5 }}>CANTÓN</p>
          <input style={{ width:'100%', border:'1.5px solid #E2EAF4', borderRadius:10, padding:'9px 12px', fontSize:12, fontFamily:"'Poppins',sans-serif", outline:'none', background:'#fff', boxSizing:'border-box' }}
            placeholder="ZH" maxLength={2} value={canton} onChange={e => setCanton(e.target.value.toUpperCase())} />
        </div>
      </div>

      {/* Text */}
      <div style={{ marginBottom:12 }}>
        <p style={{ fontFamily:"'Poppins',sans-serif", fontSize:10, fontWeight:700, color:'#94A3B8', letterSpacing:1, marginBottom:5 }}>TU RESEÑA *</p>
        <textarea style={{ width:'100%', border:'1.5px solid #E2EAF4', borderRadius:10, padding:'9px 12px', fontSize:12, fontFamily:"'Poppins',sans-serif", outline:'none', background:'#fff', resize:'none', minHeight:80, boxSizing:'border-box' }}
          placeholder="Cuéntanos cómo fue tu experiencia con este proveedor..." value={text} onChange={e => setText(e.target.value)} />
        <p style={{ fontFamily:"'Poppins',sans-serif", fontSize:9, color:'#94A3B8', margin:'3px 0 0' }}>{text.length} / mínimo 10 caracteres</p>
      </div>

      <div style={{ display:'flex', gap:8 }}>
        <button onClick={() => onSubmit({ stars, text, name, canton, date:'Ahora mismo' })} disabled={!canSubmit}
          style={{ fontFamily:"'Poppins',sans-serif", fontWeight:700, fontSize:12, background: canSubmit?'#2563EB':'#E2EAF4', color: canSubmit?'#fff':'#94A3B8', border:'none', borderRadius:11, padding:'10px 0', flex:1, cursor: canSubmit?'pointer':'not-allowed', transition:'all .15s' }}>
          Publicar reseña
        </button>
        <button onClick={onCancel}
          style={{ fontFamily:"'Poppins',sans-serif", fontWeight:600, fontSize:12, background:'transparent', color:'#94A3B8', border:'1.5px solid #E2EAF4', borderRadius:11, padding:'10px 16px', cursor:'pointer' }}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
