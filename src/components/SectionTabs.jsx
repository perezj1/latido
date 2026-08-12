import { useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { EXPLORE_SECTIONS, getActiveSection } from '../lib/sections'
import { Icon, getSectionIconName } from '../lib/icons'

// Atajo entre secciones dentro de una lista, para no tener que volver a
// Explorar solo para cambiar de sitio. Explorar sigue siendo el mapa completo.
export default function SectionTabs() {
  const { pathname, search } = useLocation()
  const active = getActiveSection(pathname, search)
  const containerRef = useRef(null)
  const activeRef = useRef(null)

  // La fila se desplaza, asi que centramos la seccion activa al entrar. Movemos
  // solo el scroll del contenedor para no arrastrar la pagina.
  useEffect(() => {
    const container = containerRef.current
    const node = activeRef.current
    if (!container || !node) return

    const target = node.offsetLeft - (container.clientWidth - node.clientWidth) / 2
    container.scrollLeft = Math.max(0, target)
  }, [active])

  return (
    <nav ref={containerRef} className="latido-section-tabs no-scroll" aria-label="Secciones de Latido">
      {EXPLORE_SECTIONS.map(section => {
        const isActive = active === section.id
        return (
          <Link
            key={section.id}
            ref={isActive ? activeRef : undefined}
            to={section.to}
            className={`latido-section-tab${isActive ? ' is-active' : ''}`}
            style={{
              '--section-color':section.color,
              '--section-ink':section.ink,
              '--section-soft':section.soft,
              '--section-border':section.border,
            }}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon name={getSectionIconName(section.id)} size={16} color={section.ink} strokeWidth={1.8} />
            <span>{section.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
