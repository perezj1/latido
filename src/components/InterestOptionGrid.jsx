import { C, PP, getLatidoCategoryTheme } from '../lib/theme'
import { Icon, InterfaceIcon } from '../lib/icons'

export default function InterestOptionGrid({
  options=[],
  selectedIds=[],
  onToggle,
  maxSelected=3,
  style,
}) {
  const selected = new Set(selectedIds)
  const selectionFull = selected.size >= maxSelected

  return (
    <div className="interest-option-grid" style={style}>
      {options.map(option => {
        const active = selected.has(option.id)
        const unavailable = !active && selectionFull
        const theme = getLatidoCategoryTheme(option.tone || option.id)

        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            aria-disabled={unavailable}
            onClick={() => onToggle?.(option.id)}
            style={{
              width:'100%',
              minHeight:62,
              display:'grid',
              gridTemplateColumns:'34px minmax(0, 1fr) 18px',
              alignItems:'center',
              gap:8,
              padding:'9px 10px',
              fontFamily:PP,
              textAlign:'left',
              color:active ? theme.ink : C.mid,
              // En reposo la fila es neutra y el color lo lleva el icono; el
              // tinte de seccion queda reservado para marcar la seleccion.
              background:active ? theme.soft : C.surface,
              border:`1.5px solid ${active ? theme.color : C.border}`,
              borderRadius:15,
              cursor:unavailable ? 'not-allowed' : 'pointer',
              opacity:unavailable ? 0.52 : 1,
              boxShadow:active
                ? '0 5px 14px rgba(15,23,42,0.09)'
                : '0 2px 6px rgba(15,23,42,0.025)',
              transition:'border-color .16s ease, background .16s ease, box-shadow .16s ease, transform .16s ease',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width:34,
                height:34,
                display:'flex',
                alignItems:'center',
                justifyContent:'center',
                borderRadius:10,
                background:active ? 'rgba(255,255,255,.82)' : theme.soft,
                border:`1px solid ${theme.border}`,
                color:theme.ink,
              }}
            >
              {option.icon
                ? <Icon name={option.icon} size={17} />
                : <InterfaceIcon emoji={option.emoji} size={17} />}
            </span>
            <span style={{ minWidth:0, fontSize:11, fontWeight:700, lineHeight:1.25, overflowWrap:'normal', wordBreak:'normal' }}>
              {option.label}
            </span>
            <span
              aria-hidden="true"
              style={{
                width:18,
                height:18,
                display:'flex',
                alignItems:'center',
                justifyContent:'center',
                borderRadius:'50%',
                border:`1.5px solid ${active ? theme.color : theme.border}`,
                background:active ? theme.color : '#fff',
                color:'#fff',
                lineHeight:1,
                boxSizing:'border-box',
              }}
            >
              {active ? <Icon name="check" size={11} /> : null}
            </span>
          </button>
        )
      })}
    </div>
  )
}
