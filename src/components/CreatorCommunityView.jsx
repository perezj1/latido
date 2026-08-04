import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { CANTONS } from '../lib/constants'
import {
  CREATOR_PLATFORMS,
  CREATOR_TOPICS,
  formatCreatorHandle,
  getAllCreators,
  getCreatorForUser,
  getOrderedCreatorContents,
  subscribeCreatorUpdates,
} from '../lib/creators'
import {
  CreatorAppContentCard,
  CreatorAvatar,
  CreatorFollowButton,
  DemoContentModal,
} from './CreatorCards'
import { Sheet } from './UI'
import { FilterButton, FilterChips, FilterResultSummary, FILTER_PANEL_TITLE_STYLE } from './FilterWorkspace'
import { C, PP } from '../lib/theme'
import '../pages/Creators.css'

const CREATOR_SORT_OPTIONS = [
  { id:'newest', label:'Más recientes' },
  { id:'contents', label:'Más publicaciones' },
  { id:'name', label:'Nombre A–Z' },
]

function normalize(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function CreatorCommunityToolbar({
  search,
  onSearchChange,
  topic,
  onTopicChange,
  platform,
  onPlatformChange,
  location,
  onLocationChange,
  sort,
  onSortChange,
  resultCount=0,
}) {
  const [showFilters, setShowFilters] = useState(false)
  const [draft, setDraft] = useState({ platform:'', location:'' })
  const filterCount = Number(Boolean(platform)) + Number(Boolean(location))
  const chips = [
    platform && { key:'platform', label:getPlatformLabel(platform) },
    location && { key:'location', label:`Cantón ${location}` },
  ].filter(Boolean)

  const openFilters = () => {
    setDraft({ platform, location })
    setShowFilters(true)
  }

  const clearFilter = key => {
    if (key === 'platform') onPlatformChange('')
    if (key === 'location') onLocationChange('')
  }

  return (
    <div className="creator-community-toolbar segmented-content-transition">
      <div className="creator-community-toolbar__row">
        <div className="creator-community-search">
          <span aria-hidden="true">🔍</span>
          <input
            type="search"
            value={search}
            onChange={event => onSearchChange(event.target.value)}
            placeholder="Buscar perfil, tema o ciudad..."
            aria-label="Buscar creadores"
          />
          {search && <button type="button" onClick={() => onSearchChange('')} aria-label="Limpiar búsqueda">×</button>}
        </div>
        <FilterButton count={filterCount} open={showFilters} onClick={openFilters} controls="creator-filter-sheet" />
      </div>

      {chips.length > 0 && (
        <FilterChips
          items={chips}
          onRemove={clearFilter}
          onClear={() => {
            onPlatformChange('')
            onLocationChange('')
          }}
        />
      )}

      <div className="creator-community-topics no-scroll" aria-label="Temas de creadores">
        <button type="button" className={!topic ? 'is-active' : ''} onClick={() => onTopicChange('')}>Todos</button>
        {CREATOR_TOPICS.map(item => (
          <button key={item.id} type="button" className={topic === item.id ? 'is-active' : ''} onClick={() => onTopicChange(topic === item.id ? '' : item.id)}>
            {item.emoji} {item.label}
          </button>
        ))}
      </div>

      <FilterResultSummary
        count={resultCount}
        sortLabel={CREATOR_SORT_OPTIONS.find(option => option.id === sort)?.label || 'Más recientes'}
        sortOptions={CREATOR_SORT_OPTIONS}
        sortValue={sort}
        onSortChange={onSortChange}
      />

      <Sheet show={showFilters} onClose={() => setShowFilters(false)}>
        <form
          id="creator-filter-sheet"
          className="filter-sheet-content"
          onSubmit={event => {
            event.preventDefault()
            onPlatformChange(draft.platform)
            onLocationChange(draft.location)
            setShowFilters(false)
          }}
        >
          <div className="filter-sheet-heading">
            <h2>Filtros</h2>
            <button type="button" onClick={() => setDraft({ platform:'', location:'' })}>Restablecer</button>
          </div>
          <div className="filter-sheet-options-grid">
            <label>
              <span style={FILTER_PANEL_TITLE_STYLE}>Plataforma</span>
              <select className="filter-sheet-control" value={draft.platform} onChange={event => setDraft(current => ({ ...current, platform:event.target.value }))}>
                <option value="">Todas las plataformas</option>
                {CREATOR_PLATFORMS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
            <label>
              <span style={FILTER_PANEL_TITLE_STYLE}>Cantón</span>
              <select className="filter-sheet-control" value={draft.location} onChange={event => setDraft(current => ({ ...current, location:event.target.value }))}>
                <option value="">Toda Suiza</option>
                {CANTONS.map(canton => <option key={canton.code} value={canton.code}>{canton.code} · {canton.name}</option>)}
              </select>
            </label>
          </div>
          <button type="submit" className="filter-show-results filter-sheet-submit">Mostrar resultados</button>
        </form>
      </Sheet>
    </div>
  )
}

function getPlatformLabel(platformId) {
  return CREATOR_PLATFORMS.find(item => item.id === platformId)?.label || platformId
}

export default function CreatorCommunityView({
  search='',
  topic='',
  platform='',
  location='',
  sort='newest',
  onResultCountChange,
}) {
  const { user, isLoggedIn } = useAuth()
  const [creators, setCreators] = useState(() => getAllCreators())
  const [preview, setPreview] = useState(null)

  useEffect(() => subscribeCreatorUpdates(() => setCreators(getAllCreators())), [])

  const ownCreator = getCreatorForUser(user?.id)
  const query = normalize(search)
  const filteredCreators = useMemo(() => creators.filter(creator => {
    const publishedContents = (creator.contents || []).filter(content => content.status === 'published')
    const searchable = normalize([
      creator.name,
      creator.handle,
      creator.tagline,
      creator.bio,
      creator.city,
      creator.canton,
      creator.reach,
      ...(creator.contents || []).flatMap(content => [content.title, content.summary]),
    ].join(' '))
    return (!query || searchable.includes(query))
      && (!topic || creator.topics?.includes(topic))
      && (!platform || publishedContents.some(content => content.platform === platform) || creator.socials?.some(social => social.platform === platform))
      && (!location || creator.canton === location || publishedContents.some(content => content.canton === location || content.canton === 'Toda Suiza'))
  }).sort((first, second) => {
    if (sort === 'name') return first.name.localeCompare(second.name, 'es')
    if (sort === 'contents') {
      const firstCount = (first.contents || []).filter(content => content.status === 'published').length
      const secondCount = (second.contents || []).filter(content => content.status === 'published').length
      return secondCount - firstCount
    }
    return new Date(second.created_at) - new Date(first.created_at)
  }), [creators, location, platform, query, sort, topic])

  const contents = useMemo(() => filteredCreators
    .flatMap(creator => getOrderedCreatorContents(creator, { publishedOnly:true })
      .filter(content =>
        content.status === 'published'
        && (!topic || content.topic === topic)
        && (!platform || content.platform === platform)
        && (!location || content.canton === location || content.canton === 'Toda Suiza'))
      .map((content, selectionIndex) => ({ content, creator, selectionIndex })))
    .filter(({ content, creator }) => !query || normalize(`${content.title} ${content.summary} ${creator.name} ${creator.handle}`).includes(query))
    .sort((a, b) => a.selectionIndex - b.selectionIndex || new Date(b.content.published_at) - new Date(a.content.published_at))
    .slice(0, 12), [filteredCreators, location, platform, query, topic])

  useEffect(() => {
    onResultCountChange?.(filteredCreators.length)
  }, [filteredCreators.length, onResultCountChange])

  const creatorCta = ownCreator ? '/creadores/mi-perfil' : '/creadores/alta'

  return (
    <div className="creator-community-view">
      <section className="creator-community-section" aria-labelledby="community-creators-content-title">
        <div className="creator-community-section__heading">
          <div>
            <p>PUBLICACIONES PARA DESCUBRIR</p>
            <span>Experiencias, información y proyectos en sus redes originales.</span>
          </div>
          <strong>{contents.length}</strong>
        </div>
        {contents.length ? (
          <div className="creator-community-content no-scroll">
            <div>
              {contents.map(({ content, creator }) => (
                <CreatorAppContentCard
                  key={content.id}
                  content={content}
                  creator={creator}
                  onDemoOpen={(selectedContent, selectedCreator) => setPreview({ content:selectedContent, creator:selectedCreator })}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="creator-community-empty">No hay publicaciones que coincidan con esta búsqueda.</div>
        )}
      </section>

      <section className="creator-community-section" aria-labelledby="community-creators-profiles-title">
        <div className="creator-community-section__heading">
          <div>
            <p id="community-creators-profiles-title">PERFILES PARA SEGUIR</p>
            <span>Personas, profesionales y negocios que comparten sobre Suiza.</span>
          </div>
          <strong>{filteredCreators.length}</strong>
        </div>
        <div className="creator-community-list">
          {filteredCreators.map(creator => {
            const publishedCount = (creator.contents || []).filter(content => content.status === 'published').length
            const visibleTopics = (creator.topics || []).slice(0, 1)
            const remainingTopics = Math.max(0, (creator.topics || []).length - visibleTopics.length)
            return (
              <article key={creator.id} className="creator-community-card">
                <Link to={`/creadores/${creator.slug}`} className="creator-community-card__open">
                  <span className="creator-community-card__media">
                    {creator.avatar_url ? (
                      <img src={creator.avatar_url} alt="" loading="lazy" decoding="async" />
                    ) : (
                      <span className="creator-community-card__fallback">
                        <CreatorAvatar creator={creator} size={88} />
                      </span>
                    )}
                    {creator.demo && <small>DEMO</small>}
                  </span>

                  <span className="creator-community-card__body">
                    <span className="creator-community-card__name">
                      <strong>{creator.name}</strong>
                      {creator.verified && (
                        <span className="creator-community-card__verification" title="Perfil verificado por Latido" aria-label="Perfil verificado por Latido">✓</span>
                      )}
                    </span>
                    <span className="creator-community-card__handle">{formatCreatorHandle(creator.handle)}</span>
                    <span className="creator-community-card__tagline">{creator.tagline}</span>

                    <span className="creator-community-card__topics">
                      {visibleTopics.map(topicId => {
                        const topic = CREATOR_TOPICS.find(item => item.id === topicId)
                        return topic ? <span key={topicId}>{topic.label}</span> : null
                      })}
                      {remainingTopics > 0 && <small>+{remainingTopics}</small>}
                    </span>

                    <span className="creator-community-card__location" title={`${creator.city || creator.reach}${creator.canton ? `, ${creator.canton}` : ''}`}>
                      📍 {creator.city || creator.reach}{creator.canton ? `, ${creator.canton}` : ''}
                    </span>
                  </span>
                </Link>

                <span className="creator-community-card__footer">
                  <span title={`${publishedCount} ${publishedCount === 1 ? 'publicación' : 'publicaciones'}`}>
                    🎬 {publishedCount}
                  </span>
                  <CreatorFollowButton creator={creator} />
                </span>
              </article>
            )
          })}
          {!filteredCreators.length && (
            <div className="creator-community-empty">No encontramos perfiles con estos filtros.</div>
          )}
        </div>
      </section>

      <div className="creator-community-cta">
        <span>🎙️</span>
        <h3>{ownCreator ? 'Gestiona tu perfil y tus publicaciones' : '¿Compartes algo sobre Suiza en redes?'}</h3>
        <p>{ownCreator ? 'Actualiza cómo te presentas y elige qué publicaciones mostrar.' : 'Tu experiencia, trabajo, proyecto o negocio puede interesar a la comunidad hispanohablante.'}</p>
        <Link to={isLoggedIn ? creatorCta : `/auth?next=${encodeURIComponent('/creadores/alta')}`}>
          {ownCreator ? 'Abrir mi espacio' : 'Crear mi perfil'}
        </Link>
      </div>

      <div className="creator-community-note">
        <strong>Cómo funciona</strong>
        <span>Latido muestra una ficha y envía las visitas a la red social, canal o web donde se publicó originalmente.</span>
      </div>

      <DemoContentModal content={preview?.content} creator={preview?.creator} onClose={() => setPreview(null)} />
    </div>
  )
}
