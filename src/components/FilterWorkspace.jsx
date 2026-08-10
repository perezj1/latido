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
  filterLabel='',
  filterOptions=[],
  filterValue='',
  filterAriaLabel='Filtrar resultados',
  onFilterChange,
  sortLabel='',
  sortOptions=[],
  sortValue='',
  onSortChange,
  action=null,
}) {
  const [openMenu, setOpenMenu] = useState('')
  const menusRef = useRef(null)
  const resultText = `${count} ${count === 1 ? 'resultado' : 'resultados'}`

  useEffect(() => {
    if (!openMenu) return undefined

    const closeOnOutsideClick = event => {
      if (!menusRef.current?.contains(event.target)) setOpenMenu('')
    }
    const closeOnEscape = event => {
      if (event.key === 'Escape') setOpenMenu('')
    }

    document.addEventListener('pointerdown', closeOnOutsideClick)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [openMenu])

  const selectSort = value => {
    onSortChange?.(value)
    setOpenMenu('')
  }

  const selectFilter = value => {
    onFilterChange?.(value)
    setOpenMenu('')
  }

  return (
    <div className="filter-result-summary" aria-live="polite">
      <span>{resultText}</span>
      <div className="filter-result-actions" ref={menusRef}>
        {action}
        {filterLabel && filterOptions.length > 0 && (
          <div className="filter-sort-wrap">
            <button
              type="button"
              className="filter-result-sort filter-result-filter"
              onClick={() => setOpenMenu(current => current === 'filter' ? '' : 'filter')}
              aria-haspopup="menu"
              aria-expanded={openMenu === 'filter'}
            >
              <svg className="filter-result-control-icon" aria-hidden="true" viewBox="0 0 20 20" width="16" height="16">
                <path d="M4 6h12M6.5 10h7M8.5 14h3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                <circle cx="8" cy="6" r="1.4" fill="#fff" stroke="currentColor" strokeWidth="1.4" />
                <circle cx="11.5" cy="10" r="1.4" fill="#fff" stroke="currentColor" strokeWidth="1.4" />
                <circle cx="10" cy="14" r="1.4" fill="#fff" stroke="currentColor" strokeWidth="1.4" />
              </svg>
              <span>{filterLabel}</span>
            </button>
            {openMenu === 'filter' && (
              <div className="filter-sort-menu" role="menu" aria-label={filterAriaLabel}>
                {filterOptions.map(option => {
                  const isActive = option.id === filterValue
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={isActive}
                      className={`filter-sort-option${isActive ? ' is-active' : ''}`}
                      onClick={() => selectFilter(option.id)}
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
        {sortLabel && sortOptions.length > 0 && (
          <div className="filter-sort-wrap">
            <button
              type="button"
              className="filter-result-sort"
              onClick={() => setOpenMenu(current => current === 'sort' ? '' : 'sort')}
              aria-haspopup="menu"
              aria-expanded={openMenu === 'sort'}
            >
              <span aria-hidden="true">⇅</span>
              <span>{sortLabel}</span>
              <svg className="filter-result-chevron" aria-hidden="true" viewBox="0 0 10 6" width="10" height="6">
                <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {openMenu === 'sort' && (
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

const FILTER_PANEL_CONTROL_STYLE = {
  width:'100%',
  minHeight:56,
  boxSizing:'border-box',
  border:`1.5px solid ${C.border}`,
  borderRadius:14,
  padding:'12px 16px',
  background:'#fff',
  fontFamily:PP,
  fontSize:12,
  fontWeight:600,
  outline:'none',
}

export function getFilterPanelControlStyle(value, defaultValue='') {
  return {
    ...FILTER_PANEL_CONTROL_STYLE,
    color:String(value ?? '') === String(defaultValue ?? '') ? C.light : C.text,
  }
}
