import { useMemo, useState } from 'react'
import { C, PP } from '../lib/theme'
import { CANTONS, getCitySuggestionItems } from '../lib/constants'

export default function LocationFields({
  canton,
  city,
  onCantonChange,
  onCityChange,
  cantonRequired=false,
  cityRequired=false,
  allowAllSwitzerland=false,
  cantonLabel='Cantón',
  cityLabel='Ciudad',
  cityPlaceholder='Nombre de la ciudad',
  hint='Empieza por la ciudad; al elegir una sugerencia completamos el cantón.',
}) {
  const [focused, setFocused] = useState(false)
  const suggestions = useMemo(
    () => getCitySuggestionItems(city ? '' : canton, city, 7),
    [canton, city]
  )
  const showSuggestions = focused && suggestions.length > 0

  return (
    <div style={{ marginBottom:10 }}>
      <div className="grid-2" style={{ gap:10 }}>
        <div style={{ position:'relative' }}>
          <label style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, letterSpacing:1, display:'block', marginBottom:6 }}>
            {cityLabel}{cityRequired && ' *'}
          </label>
          <input
            value={city}
            onChange={event => onCityChange(event.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => window.setTimeout(() => setFocused(false), 120)}
            placeholder={cityPlaceholder}
            style={{
              width:'100%',
              border:`1.5px solid ${C.border}`,
              borderRadius:12,
              padding:'11px 13px',
              fontSize:13,
              fontFamily:PP,
              outline:'none',
              background:C.surface,
              color:C.text,
              boxSizing:'border-box',
            }}
          />

          {showSuggestions && (
            <div
              style={{
                position:'absolute',
                left:0,
                right:0,
                top:'calc(100% + 6px)',
                zIndex:20,
                background:'#fff',
                border:`1px solid ${C.border}`,
                borderRadius:14,
                boxShadow:'0 12px 28px rgba(15,23,42,0.12)',
                overflow:'hidden',
              }}
            >
              {suggestions.map(item => {
                const cantonName = CANTONS.find(c => c.code === item.canton)?.name

                return (
                  <button
                    key={`${item.city}-${item.canton}`}
                    type="button"
                    onMouseDown={event => {
                      event.preventDefault()
                      onCityChange(item.city)
                      onCantonChange(item.canton)
                      setFocused(false)
                    }}
                    style={{
                      width:'100%',
                      border:'none',
                      background:'#fff',
                      padding:'10px 12px',
                      display:'flex',
                      alignItems:'center',
                      gap:8,
                      cursor:'pointer',
                      textAlign:'left',
                      fontFamily:PP,
                      color:C.text,
                    }}
                  >
                    <span style={{ color:C.primary }}>📍</span>
                    <span style={{ display:'flex', flexDirection:'column', gap:1 }}>
                      <span style={{ fontWeight:700, fontSize:12 }}>{item.city}</span>
                      <span style={{ fontSize:10, color:C.light }}>{item.canton}{cantonName ? ` — ${cantonName}` : ''}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div>
          <label style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, letterSpacing:1, display:'block', marginBottom:6 }}>
            {cantonLabel}{cantonRequired && ' *'}
          </label>
          <div style={{ position:'relative' }}>
            <select
              value={canton}
              onChange={event => onCantonChange(event.target.value)}
              style={{
                width:'100%',
                border:`1.5px solid ${C.border}`,
                borderRadius:12,
                padding:'11px 40px 11px 13px',
                fontSize:13,
                fontFamily:PP,
                outline:'none',
                background:C.surface,
                color:C.text,
                appearance:'none',
                WebkitAppearance:'none',
                MozAppearance:'none',
                cursor:'pointer',
              }}
            >
              <option value="">{allowAllSwitzerland ? 'Toda Suiza' : 'Seleccionar...'}</option>
              {CANTONS.map(item => (
                <option key={item.code} value={item.code}>
                  {item.code} — {item.name}
                </option>
              ))}
            </select>
            <span style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', color:C.light, fontSize:14, pointerEvents:'none' }}>
              ▾
            </span>
          </div>
        </div>
      </div>

      {hint && (
        <p style={{ fontFamily:PP, fontSize:10.5, color:C.light, margin:'6px 0 0', lineHeight:1.5 }}>
          {hint}
        </p>
      )}
    </div>
  )
}
