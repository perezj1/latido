import { useEffect, useRef, useState } from 'react'
import { C, PP } from '../lib/theme'
import FavoriteButton from './FavoriteButton'
import ReportButton from './ReportButton'
import ShareButton from './ShareButton'

const MENU_ITEM_STYLE = {
  width:'100%',
  minHeight:50,
  border:'none',
  borderRadius:14,
  background:'#fff',
  color:C.text,
  padding:'12px 13px',
  display:'flex',
  alignItems:'center',
  justifyContent:'flex-start',
  gap:11,
  fontFamily:PP,
  fontSize:13,
  fontWeight:700,
  lineHeight:1.25,
  textAlign:'left',
  cursor:'pointer',
  boxShadow:'none',
  boxSizing:'border-box',
}

function MenuIcon({ children, active=false, danger=false }) {
  const color = danger ? '#DC2626' : active ? C.primary : C.mid
  const background = danger ? '#FEF2F2' : active ? C.primaryLight : C.bg

  return (
    <span
      aria-hidden="true"
      style={{
        width:32,
        height:32,
        borderRadius:'50%',
        display:'inline-flex',
        alignItems:'center',
        justifyContent:'center',
        flexShrink:0,
        background,
        color,
        fontFamily:PP,
        fontSize:16,
        fontWeight:800,
        lineHeight:1,
      }}
    >
      {children}
    </span>
  )
}

export default function DetailActionBar({
  primaryLabel='',
  primaryHref='',
  primaryExternal=false,
  primaryColor=C.primary,
  onPrimaryClick,
  onMenuOpen,
  expandedContent=null,
  share=null,
  favorite=null,
  like=null,
  report=null,
  maxWidth=760,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const rootRef = useRef(null)
  const hasMenu = !!(share || favorite || like || report)

  useEffect(() => {
    if (!menuOpen) return undefined

    const closeOnOutsidePress = event => {
      if (!rootRef.current?.contains(event.target)) setMenuOpen(false)
    }
    const closeOnEscape = event => {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsidePress)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [menuOpen])

  if (!primaryLabel && !hasMenu && !expandedContent) return null

  const handlePrimaryClick = event => {
    setMenuOpen(false)
    onPrimaryClick?.(event)
  }

  const primaryStyle = {
    flex:1,
    minWidth:0,
    minHeight:52,
    border:'none',
    borderRadius:16,
    background:primaryColor,
    color:'#fff',
    padding:'13px 20px',
    display:'flex',
    alignItems:'center',
    justifyContent:'center',
    boxSizing:'border-box',
    fontFamily:PP,
    fontWeight:800,
    fontSize:14,
    lineHeight:1.2,
    textAlign:'center',
    textDecoration:'none',
    cursor:'pointer',
    boxShadow:'0 12px 26px rgba(37,99,235,0.2)',
  }

  return (
    <div
      style={{
        position:'fixed',
        left:0,
        right:0,
        bottom:0,
        zIndex:96,
        paddingLeft:'env(safe-area-inset-left)',
        paddingRight:'env(safe-area-inset-right)',
        pointerEvents:'none',
      }}
    >
      <div
        ref={rootRef}
        style={{
          position:'relative',
          width:'100%',
          maxWidth,
          margin:'0 auto',
          pointerEvents:'auto',
          boxShadow:'0 -16px 38px rgba(15,23,42,0.12)',
        }}
      >
        {hasMenu && (
          <div
            role="menu"
            aria-label="Más opciones"
            className={menuOpen ? 'fade-up' : ''}
            style={{
              display:menuOpen ? 'block' : 'none',
              position:'absolute',
              right:16,
              bottom:'calc(100% + 10px)',
              width:'min(330px, calc(100vw - 32px))',
              background:'#fff',
              border:`1px solid ${C.border}`,
              borderRadius:22,
              padding:10,
              boxShadow:'0 24px 60px rgba(15,23,42,0.2)',
              boxSizing:'border-box',
            }}
          >
            <p style={{ fontFamily:PP, fontWeight:800, fontSize:14, color:C.text, margin:'3px 5px 8px' }}>
              Más opciones
            </p>
            <div style={{ display:'flex', flexDirection:'column' }}>
              {share && (
                <ShareButton
                  {...share}
                  ariaLabel={share.ariaLabel || 'Enviar'}
                  label="Enviar"
                  icon={<MenuIcon>📤</MenuIcon>}
                  style={MENU_ITEM_STYLE}
                />
              )}
              {share && (favorite || like || report) && (
                <span aria-hidden="true" style={{ height:1, background:C.borderLight, margin:'0 10px', display:'block' }} />
              )}
              {favorite && (
                <FavoriteButton
                  isFav={favorite.isFav}
                  onClick={favorite.onClick}
                  label={favorite.isFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                  icon={<MenuIcon active={favorite.isFav}>{favorite.isFav ? '❤️' : '🤍'}</MenuIcon>}
                  style={MENU_ITEM_STYLE}
                />
              )}
              {favorite && (like || report) && (
                <span aria-hidden="true" style={{ height:1, background:C.borderLight, margin:'0 10px', display:'block' }} />
              )}
              {like && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={like.onClick}
                  disabled={like.loading}
                  style={{
                    ...MENU_ITEM_STYLE,
                    color:like.active ? C.primary : C.text,
                    opacity:like.loading ? 0.65 : 1,
                    cursor:like.loading ? 'wait' : 'pointer',
                  }}
                >
                  <MenuIcon active={like.active}>👍</MenuIcon>
                  <span style={{ minWidth:0, flex:1 }}>
                    <span style={{ display:'block' }}>{like.label || 'Me gusta'}</span>
                    {like.hint && <span style={{ display:'block', fontSize:10, fontWeight:500, color:C.light, marginTop:2 }}>{like.hint}</span>}
                  </span>
                </button>
              )}
              {like && report && (
                <span aria-hidden="true" style={{ height:1, background:C.borderLight, margin:'0 10px', display:'block' }} />
              )}
              {report && (
                <ReportButton
                  {...report}
                  label="Reportar"
                  icon={<MenuIcon danger>❗</MenuIcon>}
                  style={{ ...MENU_ITEM_STYLE, color:'#DC2626' }}
                />
              )}
            </div>
          </div>
        )}

        {expandedContent && (
          <div style={{ background:C.bg, borderTop:`1px solid ${C.border}`, padding:'10px 16px', maxHeight:'60vh', overflowY:'auto' }}>
            {expandedContent}
          </div>
        )}

        <div
          style={{
            display:'flex',
            alignItems:'center',
            gap:10,
            background:'#fff',
            borderTop:`1px solid ${C.border}`,
            padding:'12px 16px calc(12px + env(safe-area-inset-bottom))',
          }}
        >
          {primaryLabel && (primaryHref ? (
            <a
              href={primaryHref}
              target={primaryExternal ? '_blank' : undefined}
              rel={primaryExternal ? 'noreferrer' : undefined}
              onClick={handlePrimaryClick}
              style={primaryStyle}
            >
              {primaryLabel}
            </a>
          ) : (
            <button type="button" onClick={handlePrimaryClick} style={primaryStyle}>
              {primaryLabel}
            </button>
          ))}

          {hasMenu && (
            <button
              type="button"
              onClick={() => {
                const next = !menuOpen
                if (next) onMenuOpen?.()
                setMenuOpen(next)
              }}
              aria-label="Más opciones"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              style={{
                width:54,
                height:54,
                borderRadius:'50%',
                border:`1.5px solid ${menuOpen ? C.primary : C.primaryMid}`,
                background:menuOpen ? '#EFF6FF' : '#fff',
                color:C.primary,
                display:'flex',
                alignItems:'center',
                justifyContent:'center',
                flexShrink:0,
                padding:0,
                cursor:'pointer',
                boxShadow:menuOpen
                  ? '0 12px 28px rgba(37,99,235,0.3)'
                  : '0 10px 24px rgba(37,99,235,0.14)',
                transform:menuOpen ? 'scale(0.97)' : 'scale(1)',
                transition:'background .16s ease, border-color .16s ease, box-shadow .16s ease, transform .16s ease',
              }}
            >
              <span aria-hidden="true" style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
                {[0, 1, 2].map(dot => (
                  <span key={dot} style={{ width:4, height:4, borderRadius:'50%', background:C.primary, display:'block' }} />
                ))}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
