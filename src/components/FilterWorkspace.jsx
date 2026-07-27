import { useEffect, useRef, useState } from 'react'
import { C, PP } from '../lib/theme'

export function FilterIcon({ size=18 }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7h10" />
      <path d="M18 7h2" />
      <circle cx="16" cy="7" r="2" />
      <path d="M4 17h2" />
      <path d="M10 17h10" />
      <circle cx="8" cy="17" r="2" />
      <path d="M4 12h4" />
      <path d="M12 12h8" />
      <circle cx="10" cy="12" r="2" />
    </svg>
  )
}

export function FilterButton({ count=0, open=false, onClick, label='Filtros', controls }) {
  return (
    <button
      type="button"
      className={`filter-launch-button${count ? ' is-active' : ''}${open ? ' is-open' : ''}`}
      onClick={onClick}
      aria-label={`${open ? 'Cerrar' : 'Abrir'} ${label.toLowerCase()}${count ? `, ${count} activos` : ''}`}
      aria-expanded={open}
      aria-controls={controls}
    >
      <FilterIcon />
      <span className="filter-launch-label">{label}</span>
      {count > 0 && <strong className="filter-launch-count">{count}</strong>}
    </button>
  )
}

export function SegmentedTabs({
  items=[],
  value='',
  onChange,
  showEmoji=false,
  ariaLabel='Opciones',
  className='',
}) {
  if (items.length < 2) return null

  const activeIndex = Math.max(0, items.findIndex(item => item.id === value))

  return (
    <div
      className={`joined-segmented-tabs${items.length > 2 ? ' is-compact' : ''}${className ? ` ${className}` : ''}`}
      role="tablist"
      aria-label={ariaLabel}
      style={{
        '--segment-count':items.length,
        '--active-segment':activeIndex,
      }}
    >
      <span className="joined-segmented-tabs__indicator" aria-hidden="true" />
      {items.map(item => {
        const active = value === item.id
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={active ? 'is-active' : ''}
            onClick={() => onChange?.(item.id)}
          >
            {showEmoji && item.emoji && <span aria-hidden="true" className="joined-segmented-tabs__emoji">{item.emoji}</span>}
            <span className="joined-segmented-tabs__label">{item.shortLabel || item.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function FilterChips({ items=[], onRemove, onClear, clearLabel='Limpiar todo' }) {
  if (!items.length) return null

  return (
    <div className="filter-chip-row" aria-label="Filtros seleccionados">
      {items.map(item => (
        <button
          key={item.key}
          type="button"
          className="filter-chip"
          onClick={() => onRemove?.(item.key)}
          aria-label={`Quitar filtro ${item.label}`}
        >
          <span>{item.label}</span>
          <span aria-hidden="true">×</span>
        </button>
      ))}
      <button type="button" className="filter-clear-all" onClick={onClear}>
        {clearLabel}
      </button>
    </div>
  )
}

export function FilterResultSummary({
  count=0,
  sortLabel='',
  sortOptions=[],
  sortValue='',
  onSortChange,
}) {
  const [showSortMenu, setShowSortMenu] = useState(false)
  const sortMenuRef = useRef(null)
  const resultText = `${count} ${count === 1 ? 'resultado' : 'resultados'}`

  useEffect(() => {
    if (!showSortMenu) return undefined

    const closeOnOutsideClick = event => {
      if (!sortMenuRef.current?.contains(event.target)) setShowSortMenu(false)
    }
    const closeOnEscape = event => {
      if (event.key === 'Escape') setShowSortMenu(false)
    }

    document.addEventListener('pointerdown', closeOnOutsideClick)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [showSortMenu])

  const selectSort = value => {
    onSortChange?.(value)
    setShowSortMenu(false)
  }

  return (
    <div className="filter-result-summary" aria-live="polite">
      <span>{resultText}</span>
      {sortLabel && sortOptions.length > 0 && (
        <div className="filter-sort-wrap" ref={sortMenuRef}>
          <button
            type="button"
            className="filter-result-sort"
            onClick={() => setShowSortMenu(current => !current)}
            aria-haspopup="menu"
            aria-expanded={showSortMenu}
          >
            <span aria-hidden="true">⇅</span>
            <span>{sortLabel}</span>
          </button>
          {showSortMenu && (
            <div className="filter-sort-menu" role="menu" aria-label="Ordenar resultados">
              {sortOptions.map(option => {
                const isActive = option.id === sortValue
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={isActive}
                    className={`filter-sort-option${isActive ? ' is-active' : ''}`}
                    onClick={() => selectSort(option.id)}
                  >
                    <span>{option.label}</span>
                    {isActive && <span className="filter-sort-option-check" aria-hidden="true">✓</span>}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export const FILTER_PANEL_TITLE_STYLE = {
  display:'block',
  fontFamily:PP,
  fontSize:11,
  fontWeight:700,
  color:C.text,
  margin:'0 0 7px',
}
