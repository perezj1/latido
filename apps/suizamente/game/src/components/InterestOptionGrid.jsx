import { C, PP } from '../lib/theme'

export default function InterestOptionGrid({
  options=[],
  selectedIds=[],
  onToggle,
  maxSelected=3,
  compact=false,
  style,
}) {
  const selected = new Set(selectedIds)
  const selectionFull = selected.size >= maxSelected

  return (
    <div className="interest-option-grid" style={style}>
      {options.map(option => {
        const active = selected.has(option.id)
        const unavailable = !active && selectionFull

        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            aria-disabled={unavailable}
            onClick={() => onToggle?.(option.id)}
            style={{
              width:'100%',
              minHeight:compact ? 46 : 62,
              display:'grid',
              gridTemplateColumns:`${compact ? 28 : 34}px minmax(0, 1fr) 18px`,
              alignItems:'center',
              gap:compact ? 6 : 8,
              padding:compact ? '6px 8px' : '9px 10px',
              fontFamily:PP,
              textAlign:'left',
              color:active ? C.primaryDark : C.mid,
              background:active ? C.primaryLight : '#F8FAFC',
              border:`1.5px solid ${active ? C.primary : C.border}`,
              borderRadius:15,
              cursor:unavailable ? 'not-allowed' : 'pointer',
              opacity:unavailable ? 0.52 : 1,
              boxShadow:active
                ? '0 5px 14px rgba(37,99,235,0.12)'
                : '0 2px 6px rgba(15,23,42,0.025)',
              transition:'border-color .16s ease, background .16s ease, box-shadow .16s ease, transform .16s ease',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width:compact ? 28 : 34,
                height:compact ? 28 : 34,
                display:'flex',
                alignItems:'center',
                justifyContent:'center',
                borderRadius:compact ? 8 : 10,
                background:active ? '#DBEAFE' : '#EEF2F7',
                fontSize:compact ? 14 : 16,
              }}
            >
              {option.emoji}
            </span>
            <span style={{ minWidth:0, fontSize:compact ? 9.5 : 11, fontWeight:700, lineHeight:1.2, overflowWrap:'normal', wordBreak:'normal' }}>
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
                border:`1.5px solid ${active ? C.primary : C.primaryMid}`,
                background:active ? C.primary : '#fff',
                color:'#fff',
                fontSize:11,
                fontWeight:900,
                lineHeight:1,
                boxSizing:'border-box',
              }}
            >
              {active ? '✓' : ''}
            </span>
          </button>
        )
      })}
    </div>
  )
}
