import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  CREATOR_PLATFORMS,
  CREATOR_TOPICS,
  getAllCreators,
  getCreatorForUser,
  getOrderedCreatorContents,
  subscribeCreatorUpdates,
} from '../lib/creators'
import {
  CreatorAvatar,
  CreatorCard,
  CreatorContentCard,
  CreatorContentModal,
} from '../components/CreatorCards'
import { FilterButton, FILTER_PANEL_TITLE_STYLE } from '../components/FilterWorkspace'
import { Sheet } from '../components/UI'
import './Creators.css'

function normalizeSearch(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export default function Creadores() {
  const { user, isLoggedIn } = useAuth()
  const [creators, setCreators] = useState(() => getAllCreators())
  const [search, setSearch] = useState('')
  const [topic, setTopic] = useState('')
  const [canton, setCanton] = useState('')
  const [platform, setPlatform] = useState('')
  const [preview, setPreview] = useState(null)
  const [showFilters, setShowFilters] = useState(false)
  const [draftFilters, setDraftFilters] = useState({ topic:'', canton:'', platform:'' })

  useEffect(() => subscribeCreatorUpdates(() => setCreators(getAllCreators())), [])

  const ownCreator = getCreatorForUser(user?.id)
  const cantons = useMemo(() => (
    [...new Set(creators.map(creator => creator.canton).filter(Boolean))].sort()
  ), [creators])

  const filteredCreators = useMemo(() => {
    const query = normalizeSearch(search)
    return creators.filter(creator => {
      const searchable = normalizeSearch([
        creator.name,
        creator.handle,
        creator.tagline,
        creator.bio,
        creator.city,
        creator.canton,
        creator.reach,
        ...(creator.contents || []).flatMap(content => [content.title, content.summary]),
      ].join(' '))
      const hasPlatform = !platform || (creator.socials || []).some(social => social.platform === platform)
      return (!query || searchable.includes(query))
        && (!topic || (creator.topics || []).includes(topic))
        && (!canton || creator.canton === canton)
        && hasPlatform
    })
  }, [canton, creators, platform, search, topic])

  const featuredContents = useMemo(() => {
    const query = normalizeSearch(search)
    return filteredCreators
      .flatMap(creator => getOrderedCreatorContents(creator, { publishedOnly:true })
      .filter(content => {
        const searchable = normalizeSearch([content.title, content.summary, creator.name, creator.handle].join(' '))
        return content.status === 'published'
          && (!query || searchable.includes(query))
          && (!topic || content.topic === topic)
          && (!platform || content.platform === platform)
          && (!canton || content.canton === canton || content.canton === 'Toda Suiza')
      })
      .map((content, selectionIndex) => ({ content, creator, selectionIndex })))
    .sort((a, b) => a.selectionIndex - b.selectionIndex || new Date(b.content.published_at) - new Date(a.content.published_at))
    .slice(0, 6)
  }, [canton, filteredCreators, platform, search, topic])

  const creatorCta = ownCreator ? '/creadores/mi-perfil' : '/creadores/alta'
  const activeFilterCount = Number(Boolean(topic)) + Number(Boolean(canton)) + Number(Boolean(platform))
  const openFilters = () => {
    setDraftFilters({ topic, canton, platform })
    setShowFilters(true)
  }

  return (
    <div className="creators-page">
      <header className="creators-hero">
        <div className="creators-shell creators-hero__grid">
          <div>
            <span className="creators-eyebrow">PARA CREADORES</span>
            <h1>Haz que más personas descubran <em>lo que compartes sobre Suiza</em></h1>
            <p className="creators-hero__lead">
              Crea gratis tu perfil de creador en Latido, conecta tus redes y elige hasta seis publicaciones para presentarte. Cada visita abre el contenido original en tu plataforma.
            </p>
            <div className="creators-hero__benefits" aria-label="Ventajas para creadores">
              <span>✓ Perfil gratuito</span>
              <span>✓ Tus 6 destacados</span>
              <span>✓ Visitas a tus redes</span>
            </div>
            <div className="creators-hero__actions">
              <Link className="creators-primary-action" to={isLoggedIn ? creatorCta : `/auth?next=${encodeURIComponent('/creadores/alta')}`}>
                {ownCreator ? 'Gestionar mi perfil' : 'Crear mi perfil'}
              </Link>
              <a className="creators-secondary-action" href="#perfiles">Explorar perfiles</a>
            </div>
          </div>

          <div className="creators-hero__sample" aria-hidden="true">
            <span className="creators-hero__float creators-hero__float--one">✓ Perfil gratuito en Latido</span>
            <div className="creators-hero__phone">
              <div className="creators-hero__phone-screen">
                <span>LATIDO · CREADORES</span>
                <div className="creators-hero__phone-card">
                  <CreatorAvatar creator={creators[0]} size={56} />
                  <strong>{creators[0]?.name || 'Un perfil para descubrir'}</strong>
                  <small>{creators[0]?.tagline || 'Experiencias, información y proyectos desde Suiza.'}</small>
                </div>
              </div>
            </div>
            <span className="creators-hero__float creators-hero__float--two">↗ Visitas directas a tus redes</span>
          </div>
        </div>
      </header>

      <main className="creators-shell">
        <div className="creators-toolbar" aria-label="Filtros de creadores">
          <div className="creators-toolbar__search">
            <span aria-hidden="true">🔍</span>
            <input
              type="search"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Buscar perfil, ciudad o tema…"
              aria-label="Buscar creadores"
            />
            {search && <button type="button" onClick={() => setSearch('')} aria-label="Limpiar búsqueda">×</button>}
          </div>
          <FilterButton count={activeFilterCount} open={showFilters} onClick={openFilters} controls="creators-filter-sheet" />
        </div>

        <Sheet show={showFilters} onClose={() => setShowFilters(false)}>
          <form
            id="creators-filter-sheet"
            className="filter-sheet-content"
            onSubmit={event => {
              event.preventDefault()
              setTopic(draftFilters.topic)
              setCanton(draftFilters.canton)
              setPlatform(draftFilters.platform)
              setShowFilters(false)
            }}
          >
            <div className="filter-sheet-heading">
              <h2>Filtros</h2>
              <button type="button" onClick={() => setDraftFilters({ topic:'', canton:'', platform:'' })}>Restablecer</button>
            </div>
            <div className="filter-sheet-options-grid">
              <label>
                <span style={FILTER_PANEL_TITLE_STYLE}>Tema</span>
                <select className="filter-sheet-control" value={draftFilters.topic} onChange={event => setDraftFilters(current => ({ ...current, topic:event.target.value }))}>
                  <option value="">Todos los temas</option>
                  {CREATOR_TOPICS.map(item => <option key={item.id} value={item.id}>{item.emoji} {item.label}</option>)}
                </select>
              </label>
              <label>
                <span style={FILTER_PANEL_TITLE_STYLE}>Cantón</span>
                <select className="filter-sheet-control" value={draftFilters.canton} onChange={event => setDraftFilters(current => ({ ...current, canton:event.target.value }))}>
                  <option value="">Toda Suiza</option>
                  {cantons.map(item => <option key={item} value={item}>Cantón {item}</option>)}
                </select>
              </label>
              <label>
                <span style={FILTER_PANEL_TITLE_STYLE}>Plataforma</span>
                <select className="filter-sheet-control" value={draftFilters.platform} onChange={event => setDraftFilters(current => ({ ...current, platform:event.target.value }))}>
                  <option value="">Todas las plataformas</option>
                  {CREATOR_PLATFORMS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </label>
            </div>
            <button type="submit" className="filter-show-results filter-sheet-submit">Mostrar resultados</button>
          </form>
        </Sheet>

        <section id="perfiles" className="creators-section" aria-labelledby="creators-directory-title">
          <div className="creators-section__heading">
            <div>
              <h2 id="creators-directory-title">Perfiles para seguir</h2>
              <p>Personas, profesionales, proyectos y negocios que comparten sobre Suiza en español.</p>
            </div>
            <span className="creators-results-count">{filteredCreators.length} {filteredCreators.length === 1 ? 'perfil' : 'perfiles'}</span>
          </div>
          <div className="creators-grid">
            {filteredCreators.map(creator => <CreatorCard key={creator.id} creator={creator} />)}
            {!filteredCreators.length && (
              <div className="creators-empty">
                <strong>No encontramos perfiles con esos filtros.</strong>
                <br />Prueba otro tema, plataforma o ubicación.
              </div>
            )}
          </div>
        </section>

        <section id="contenidos" className="creators-section" aria-labelledby="creators-content-title">
          <div className="creators-section__heading">
            <div>
              <h2 id="creators-content-title">Publicaciones para descubrir</h2>
              <p>Información, experiencias y opiniones compartidas desde sus redes y páginas originales.</p>
            </div>
            <span className="creators-results-count">Actualizado recientemente</span>
          </div>
          <div className="creator-content-grid">
            {featuredContents.map(({ content, creator }) => (
              <CreatorContentCard
                key={content.id}
                content={content}
                creator={creator}
                onContentOpen={(selectedContent, selectedCreator) => setPreview({
                  content:selectedContent,
                  creator:selectedCreator,
                  playlist:featuredContents,
                })}
              />
            ))}
            {!featuredContents.length && (
              <div className="creators-empty">
                No hay publicaciones que coincidan con estos filtros.
              </div>
            )}
          </div>
        </section>

        <section className="creators-section creator-directory-cta-section">
          <div className="creator-directory-cta">
            <div className="creator-directory-cta__copy">
              <span>PARA QUIENES COMPARTEN SOBRE SUIZA</span>
              <h2>Haz que más personas descubran lo que compartes</h2>
              <p>Conecta tus redes y destaca hasta seis publicaciones sobre tu experiencia, profesión, trabajo, proyecto o negocio. No necesitas dedicarte profesionalmente a crear contenido.</p>
            </div>
            <Link className="creators-secondary-action creator-directory-cta__button" to={isLoggedIn ? creatorCta : `/auth?next=${encodeURIComponent('/creadores/alta')}`}>
              {ownCreator ? 'Gestionar mi perfil' : 'Crear mi perfil'}
            </Link>
          </div>
        </section>
      </main>

      <CreatorContentModal
        content={preview?.content}
        creator={preview?.creator}
        playlist={preview?.playlist}
        onClose={() => setPreview(null)}
      />
    </div>
  )
}
