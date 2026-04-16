import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { C, PP } from '../lib/theme'
import { MOCK_ADS, MOCK_COMMUNITIES, MOCK_JOBS, MOCK_NEGOCIOS, MOCK_EVENTOS_LATINOS, AD_CATS, NEGOCIO_TYPES, EVENTO_TYPES } from '../lib/constants'

function searchAll(query) {
  const q = query.toLowerCase().trim()
  if (!q || q.length < 2) return []

  const results = []

  MOCK_ADS.filter(ad =>
    ad.title.toLowerCase().includes(q) ||
    ad.desc?.toLowerCase().includes(q) ||
    ad.canton?.toLowerCase().includes(q)
  ).slice(0, 3).forEach(ad => {
    const cat = AD_CATS.find(item => item.id === ad.cat)
    results.push({
      type:'ad',
      id:ad.id,
      icon:cat?.emoji || '📌',
      label:ad.title,
      sub:`${cat?.label} · ${ad.canton} · ${ad.price}`,
      href:'/tablon',
      privacy:ad.privacy,
    })
  })

  MOCK_JOBS.filter(job =>
    job.title.toLowerCase().includes(q) ||
    job.company?.toLowerCase().includes(q) ||
    job.city?.toLowerCase().includes(q)
  ).slice(0, 2).forEach(job => {
    results.push({
      type:'job',
      id:job.id,
      icon:job.emoji || '💼',
      label:job.title,
      sub:`${job.company} · ${job.city} · ${job.type}`,
      href:'/tablon?cat=empleo',
    })
  })

  MOCK_COMMUNITIES.filter(group =>
    group.name.toLowerCase().includes(q) ||
    group.desc?.toLowerCase().includes(q)
  ).slice(0, 2).forEach(group => {
    results.push({
      type:'community',
      id:group.id,
      icon:group.emoji,
      label:group.name,
      sub:`Comunidad · ${group.city} · ${group.members} miembros`,
      href:'/comunidades',
    })
  })

  MOCK_NEGOCIOS.filter(business =>
    business.name.toLowerCase().includes(q) ||
    business.desc?.toLowerCase().includes(q) ||
    business.city?.toLowerCase().includes(q)
  ).slice(0, 2).forEach(business => {
    results.push({
      type:'business',
      id:business.id,
      icon:business.emoji,
      label:business.name,
      sub:`${NEGOCIO_TYPES.find(type => type.id === business.type)?.label || 'Negocio'} · ${business.city}`,
      href:'/comunidades?view=negocios',
    })
  })

  MOCK_EVENTOS_LATINOS.filter(event =>
    event.title.toLowerCase().includes(q) ||
    event.desc?.toLowerCase().includes(q) ||
    event.city?.toLowerCase().includes(q) ||
    event.venue?.toLowerCase().includes(q)
  ).slice(0, 2).forEach(event => {
    results.push({
      type:'event',
      id:event.id,
      icon:event.emoji,
      label:event.title,
      sub:`${EVENTO_TYPES.find(type => type.id === event.type)?.label || 'Evento'} · ${event.city}`,
      href:'/comunidades?view=eventos',
    })
  })

  return results
}

const TYPE_COLORS = {
  ad:{ bg:'#DBEAFE', color:'#1D4ED8', label:'Tablón' },
  job:{ bg:'#E0F2FE', color:'#0369A1', label:'Empleo' },
  community:{ bg:'#D1FAE5', color:'#065F46', label:'Comunidad' },
  business:{ bg:'#FEF3C7', color:'#92400E', label:'Negocio' },
  event:{ bg:'#FCE7F3', color:'#9D174D', label:'Evento' },
}

export default function GlobalSearch({ size = 'lg', placeholder, onClose }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [focused, setFocused] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const inputRef = useRef(null)
  const navigate = useNavigate()

  const ph = placeholder || (size === 'lg'
    ? 'Busca pisos, empleos, negocios, eventos o comunidades...'
    : 'Buscar anuncios, empleos o comunidad...')

  useEffect(() => {
    setResults(searchAll(q))
    setActiveIdx(-1)
  }, [q])

  const goTo = href => {
    navigate(href)
    setQ('')
    setFocused(false)
    onClose?.()
  }

  const handleKey = e => {
    if (!results.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(idx => Math.min(idx + 1, results.length - 1))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(idx => Math.max(idx - 1, 0))
    }
    if (e.key === 'Enter' && activeIdx >= 0) goTo(results[activeIdx].href)
    if (e.key === 'Escape') {
      setQ('')
      setFocused(false)
      onClose?.()
    }
  }

  const showDropdown = focused && q.length >= 2

  const inputStyle = size === 'lg'
    ? {
        width:'100%',
        border:`2px solid ${focused ? C.primary : C.border}`,
        borderRadius:18,
        padding:'15px 18px 15px 48px',
        fontSize:15,
        fontFamily:PP,
        outline:'none',
        background:'#fff',
        boxSizing:'border-box',
        color:C.text,
        boxShadow: focused ? `0 0 0 4px ${C.primaryLight}` : '0 2px 12px rgba(0,0,0,0.06)',
        transition:'all .2s',
      }
    : {
        width:'100%',
        border:`1.5px solid ${focused ? C.primary : C.border}`,
        borderRadius:14,
        padding:'11px 14px 11px 36px',
        fontSize:13,
        fontFamily:PP,
        outline:'none',
        background:'#fff',
        boxSizing:'border-box',
        color:C.text,
        transition:'all .15s',
      }

  return (
    <div style={{ position:'relative', width:'100%' }}>
      <div style={{ position:'relative' }}>
        <span style={{ position:'absolute', left:size === 'lg' ? 16 : 12, top:'50%', transform:'translateY(-50%)', fontSize:size === 'lg' ? 20 : 15, color:focused ? C.primary : C.light, transition:'color .15s', pointerEvents:'none' }}>
          🔍
        </span>
        <input
          ref={inputRef}
          style={inputStyle}
          placeholder={ph}
          value={q}
          onChange={e => setQ(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 160)}
          onKeyDown={handleKey}
          autoComplete="off"
        />
        {q && (
          <button onClick={() => { setQ(''); inputRef.current?.focus() }} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:C.border, border:'none', borderRadius:'50%', width:20, height:20, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:C.mid }}>
            ✕
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="fade-up" style={{ position:'absolute', top:'100%', left:0, right:0, marginTop:8, background:'#fff', borderRadius:16, boxShadow:'0 12px 40px rgba(0,0,0,0.15)', border:`1px solid ${C.border}`, zIndex:200, overflow:'hidden', maxHeight:'min(400px, 60vh)', overflowY:'auto' }}>
          {results.length === 0 ? (
            <div style={{ padding:'20px 18px', textAlign:'center' }}>
              <p style={{ fontFamily:PP, fontSize:13, color:C.light, margin:0 }}>Sin resultados para <strong style={{ color:C.text }}>{q}</strong></p>
              <p style={{ fontFamily:PP, fontSize:11, color:C.light, margin:'6px 0 0' }}>
                Prueba con otras palabras o{' '}
                <button onClick={() => goTo('/tablon')} style={{ fontFamily:PP, fontWeight:700, fontSize:11, color:C.primary, background:'none', border:'none', cursor:'pointer', padding:0 }}>
                  explora el tablón
                </button>
              </p>
            </div>
          ) : (
            <>
              {results.map((result, idx) => {
                const color = TYPE_COLORS[result.type] || TYPE_COLORS.ad
                return (
                  <div
                    key={`${result.type}-${result.id}`}
                    onClick={() => goTo(result.href)}
                    style={{ padding:'11px 16px', display:'flex', alignItems:'center', gap:12, cursor:'pointer', background: idx === activeIdx ? C.primaryLight : 'transparent', borderBottom: idx < results.length - 1 ? `1px solid ${C.borderLight}` : 'none', transition:'background .1s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = C.primaryLight }}
                    onMouseLeave={e => { e.currentTarget.style.background = idx === activeIdx ? C.primaryLight : 'transparent' }}
                  >
                    <span style={{ fontSize:20, flexShrink:0 }}>{result.icon}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontFamily:PP, fontWeight:600, fontSize:13, color:C.text, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{result.label}</p>
                      <p style={{ fontFamily:PP, fontSize:10, color:C.light, margin:'2px 0 0' }}>{result.sub}</p>
                    </div>
                    <span style={{ fontFamily:PP, fontSize:9, fontWeight:700, background:color.bg, color:color.color, padding:'3px 7px', borderRadius:10, flexShrink:0 }}>{color.label}</span>
                    {result.privacy === 'private' && <span style={{ fontSize:12 }}>🔒</span>}
                  </div>
                )
              })}
              <div style={{ padding:'10px 16px', borderTop:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontFamily:PP, fontSize:10, color:C.light }}>{results.length} resultado{results.length !== 1 ? 's' : ''}</span>
                <button onClick={() => goTo('/tablon')} style={{ fontFamily:PP, fontWeight:600, fontSize:10, color:C.primary, background:'none', border:'none', cursor:'pointer', padding:0 }}>
                  Ver todo en el tablón →
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
