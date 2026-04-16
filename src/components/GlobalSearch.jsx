import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { C, PP } from '../lib/theme'
import { MOCK_ADS, MOCK_COMMUNITIES, MOCK_PROVIDERS, MOCK_POSTS, AD_CATS } from '../lib/constants'

// Unified search across all content types
function searchAll(query) {
  const q = query.toLowerCase().trim()
  if (!q || q.length < 2) return []

  const results = []

  // Ads
  MOCK_ADS.filter(a =>
    a.title.toLowerCase().includes(q) ||
    a.desc?.toLowerCase().includes(q) ||
    a.canton?.toLowerCase().includes(q)
  ).slice(0, 3).forEach(a => {
    const cat = AD_CATS.find(c => c.id === a.cat)
    results.push({ type:'ad', id:a.id, icon:cat?.emoji||'📌', label:a.title, sub:`${cat?.label} · ${a.canton} · ${a.price}`, href:'/tablon', privacy:a.privacy })
  })

  // Communities
  MOCK_COMMUNITIES.filter(c =>
    c.name.toLowerCase().includes(q) ||
    c.desc?.toLowerCase().includes(q)
  ).slice(0, 2).forEach(c =>
    results.push({ type:'community', id:c.id, icon:c.emoji, label:c.name, sub:`Comunidad · ${c.city} · ${c.members} miembros`, href:'/comunidades' })
  )

  // Providers/Directorio
  MOCK_PROVIDERS.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.description?.toLowerCase().includes(q) ||
    p.services?.some(s => s.toLowerCase().includes(q))
  ).slice(0, 2).forEach(p =>
    results.push({ type:'provider', id:p.id, icon:'🎉', label:p.name, sub:`Directorio · ${p.city} · ${p.price_range}`, href:'/directorio' })
  )

  // Forum posts
  MOCK_POSTS.filter(p =>
    p.title.toLowerCase().includes(q)
  ).slice(0, 2).forEach(p =>
    results.push({ type:'post', id:p.id, icon:p.emoji, label:p.title, sub:`Foro · ${p.replies} respuestas`, href:'/foro' })
  )

  return results
}

const TYPE_COLORS = {
  ad:        { bg:'#DBEAFE', color:'#1D4ED8', label:'Tablón' },
  community: { bg:'#D1FAE5', color:'#065F46', label:'Comunidad' },
  provider:  { bg:'#FEF3C7', color:'#92400E', label:'Directorio' },
  post:      { bg:'#EDE9FE', color:'#6D28D9', label:'Foro' },
}

export default function GlobalSearch({ size = 'lg', placeholder, onClose }) {
  const [q, setQ]           = useState('')
  const [results, setResults] = useState([])
  const [focused, setFocused] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const inputRef = useRef(null)
  const navigate  = useNavigate()

  const ph = placeholder || (size === 'lg'
    ? 'Busca pisos, cuidadoras, DJ, comunidades, trámites...'
    : 'Buscar anuncios, comunidades...')

  useEffect(() => {
    const r = searchAll(q)
    setResults(r)
    setActiveIdx(-1)
  }, [q])

  const goTo = (href) => {
    navigate(href)
    setQ('')
    setFocused(false)
    onClose?.()
  }

  const handleKey = (e) => {
    if (!results.length) return
    if (e.key === 'ArrowDown')  { e.preventDefault(); setActiveIdx(i => Math.min(i+1, results.length-1)) }
    if (e.key === 'ArrowUp')    { e.preventDefault(); setActiveIdx(i => Math.max(i-1, 0)) }
    if (e.key === 'Enter' && activeIdx >= 0) goTo(results[activeIdx].href)
    if (e.key === 'Escape')     { setQ(''); setFocused(false); onClose?.() }
  }

  const showDropdown = focused && q.length >= 2

  const inputStyle = size === 'lg' ? {
    width: '100%', border: `2px solid ${focused ? C.primary : C.border}`,
    borderRadius: 18, padding: '15px 18px 15px 48px',
    fontSize: 15, fontFamily: PP, outline: 'none', background: '#fff',
    boxSizing: 'border-box', color: C.text, boxShadow: focused ? `0 0 0 4px ${C.primaryLight}` : '0 2px 12px rgba(0,0,0,0.06)',
    transition: 'all .2s',
  } : {
    width: '100%', border: `1.5px solid ${focused ? C.primary : C.border}`,
    borderRadius: 14, padding: '11px 14px 11px 36px',
    fontSize: 13, fontFamily: PP, outline: 'none', background: '#fff',
    boxSizing: 'border-box', color: C.text, transition: 'all .15s',
  }

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Input wrapper */}
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: size === 'lg' ? 16 : 12, top: '50%', transform: 'translateY(-50%)', fontSize: size === 'lg' ? 20 : 15, color: focused ? C.primary : C.light, transition: 'color .15s', pointerEvents: 'none' }}>
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
          <button onClick={() => { setQ(''); inputRef.current?.focus() }}
            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: C.border, border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: C.mid }}>
            ✕
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="fade-up" style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 8, background: '#fff', borderRadius: 16, boxShadow: '0 12px 40px rgba(0,0,0,0.15)', border: `1px solid ${C.border}`, zIndex: 200, overflow: 'hidden', maxHeight: 400, overflowY: 'auto' }}>
          {results.length === 0 ? (
            <div style={{ padding: '20px 18px', textAlign: 'center' }}>
              <p style={{ fontFamily: PP, fontSize: 13, color: C.light, margin: 0 }}>Sin resultados para "<strong style={{ color: C.text }}>{q}</strong>"</p>
              <p style={{ fontFamily: PP, fontSize: 11, color: C.light, margin: '6px 0 0' }}>Prueba con otras palabras o{' '}
                <button onClick={() => goTo('/tablon')} style={{ fontFamily: PP, fontWeight: 700, fontSize: 11, color: C.primary, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  explora el tablón
                </button>
              </p>
            </div>
          ) : (
            <>
              {results.map((r, i) => {
                const tc = TYPE_COLORS[r.type] || TYPE_COLORS.ad
                return (
                  <div key={`${r.type}-${r.id}`}
                    onClick={() => goTo(r.href)}
                    style={{ padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', background: i === activeIdx ? C.primaryLight : 'transparent', borderBottom: i < results.length - 1 ? `1px solid ${C.borderLight}` : 'none', transition: 'background .1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = C.primaryLight}
                    onMouseLeave={e => e.currentTarget.style.background = i === activeIdx ? C.primaryLight : 'transparent'}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>{r.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: PP, fontWeight: 600, fontSize: 13, color: C.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</p>
                      <p style={{ fontFamily: PP, fontSize: 10, color: C.light, margin: '2px 0 0' }}>{r.sub}</p>
                    </div>
                    <span style={{ fontFamily: PP, fontSize: 9, fontWeight: 700, background: tc.bg, color: tc.color, padding: '3px 7px', borderRadius: 10, flexShrink: 0 }}>{tc.label}</span>
                    {r.privacy === 'private' && <span style={{ fontSize: 12 }}>🔒</span>}
                  </div>
                )
              })}
              <div style={{ padding: '10px 16px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: PP, fontSize: 10, color: C.light }}>{results.length} resultado{results.length !== 1 ? 's' : ''}</span>
                <button onClick={() => goTo('/tablon')} style={{ fontFamily: PP, fontWeight: 600, fontSize: 10, color: C.primary, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  Ver todos en el tablón →
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
