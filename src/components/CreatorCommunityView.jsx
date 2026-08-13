import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { CANTONS } from '../lib/constants'
import {
  CREATOR_PLATFORMS,
  CREATOR_TOPICS,
  getAllCreators,
  getCreatorDirectoryState,
  getCreatorForUser,
  getCreatorTopic,
  getLatestContents,
  getMostHelpfulContents,
  getOrderedCreatorContents,
  getTopHelpfulCreators,
  subscribeCreatorUpdates,
} from '../lib/creators'
import {
  CreatorAppContentCard,
  CreatorAvatar,
  CreatorFollowButton,
  CreatorProfileHelpfulButton,
  CreatorProfileHelpfulMetric,
  CreatorContentModal,
} from './CreatorCards'
import { EmptyState, Sheet, SkeletonCard } from './UI'
import { FilterButton, FilterChips, FilterResultSummary, SegmentedTabs, FILTER_PANEL_TITLE_STYLE, getFilterPanelControlStyle } from './FilterWorkspace'
import SavedSearchButton from './SavedSearchButton'
import { C, PP } from '../lib/theme'
import '../pages/Creators.css'

const CREATOR_SORT_OPTIONS = [
  { id:'newest', label:'Más recientes' },
  { id:'contents', label:'Más contenido' },
  { id:'name', label:'Nombre A–Z' },
]

export const CREATOR_VIEW_TABS = [
  { id:'contenidos', label:'Contenido' },
  { id:'creadores', label:'Creadores' },
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
  view='contenidos',
  onViewChange,
}) {
  const [showFilters, setShowFilters] = useState(false)
  const [draft, setDraft] = useState({ topic:'', platform:'', location:'' })
  const filterCount = Number(Boolean(topic)) + Number(Boolean(platform)) + Number(Boolean(location))
  const filterSavedSearchDraft = useMemo(() => {
    const cleanQuery = search.trim().length >= 2 ? search.trim() : ''
    const params = new URLSearchParams({ view:'creadores', creatorView:view })
    if (cleanQuery) params.set('q', cleanQuery)
    if (draft.topic) params.set('creatorTopic', draft.topic)
    if (draft.platform) params.set('creatorPlatform', draft.platform)
    if (draft.location) params.set('canton', draft.location)

    const section = view === 'creadores' ? 'Creadores' : 'Contenido de creadores'
    const topicLabel = CREATOR_TOPICS.find(item => item.id === draft.topic)?.label
    const subject = cleanQuery ? `“${cleanQuery}”` : topicLabel || section

    return {
      name:`${section}: ${subject}${draft.location ? ` · ${draft.location}` : ''}`.slice(0, 100),
      query:cleanQuery,
      entityKinds:[view === 'creadores' ? 'creator' : 'creator_content'],
      category:'creadores',
      canton:draft.location,
      filters:{
        creatorTopic:draft.topic,
        creatorPlatform:draft.platform,
      },
      resultPath:`/comunidades?${params.toString()}`,
    }
  }, [draft, search, view])
  const savedSearchDraft = useMemo(() => {
    const cleanQuery = search.trim().length >= 2 ? search.trim() : ''
    if (!cleanQuery && !topic && !platform && !location) return null

    const params = new URLSearchParams({ view:'creadores', creatorView:view })
    if (cleanQuery) params.set('q', cleanQuery)
    if (topic) params.set('creatorTopic', topic)
    if (platform) params.set('creatorPlatform', platform)
    if (location) params.set('canton', location)

    const section = view === 'creadores' ? 'Creadores' : 'Contenido de creadores'
    const topicLabel = CREATOR_TOPICS.find(item => item.id === topic)?.label
    const subject = cleanQuery ? `“${cleanQuery}”` : topicLabel || section
    return {
      name:`${section}: ${subject}${location ? ` · ${location}` : ''}`.slice(0, 100),
      query:cleanQuery,
      entityKinds:[view === 'creadores' ? 'creator' : 'creator_content'],
      category:'creadores',
      canton:location,
      filters:{ creatorTopic:topic, creatorPlatform:platform },
      resultPath:`/comunidades?${params.toString()}`,
    }
  }, [location, platform, search, topic, view])
  const chips = [
    topic && { key:'topic', label:CREATOR_TOPICS.find(item => item.id === topic)?.label || topic },
    platform && { key:'platform', label:getPlatformLabel(platform) },
    location && { key:'location', label:`Cantón ${location}` },
  ].filter(Boolean)

  const openFilters = () => {
    setDraft({ topic, platform, location })
    setShowFilters(true)
  }

  const clearFilter = key => {
    if (key === 'topic') onTopicChange('')
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
            onTopicChange('')
            onPlatformChange('')
            onLocationChange('')
          }}
        />
      )}

      <div className="creator-community-view-tabs">
        <SegmentedTabs
          items={CREATOR_VIEW_TABS}
          value={view}
          onChange={onViewChange}
          ariaLabel="Qué quieres ver"
          className="creator-view-tabs"
        />
      </div>

      <FilterResultSummary
        count={resultCount}
        sortLabel={CREATOR_SORT_OPTIONS.find(option => option.id === sort)?.label || 'Más recientes'}
        sortOptions={CREATOR_SORT_OPTIONS}
        sortValue={sort}
        onSortChange={onSortChange}
      />
      {savedSearchDraft && (
        <div className="saved-search-prompt saved-search-prompt--toolbar">
          <span>Avísame cuando haya nuevos resultados.</span>
          <SavedSearchButton draft={savedSearchDraft} compact />
        </div>
      )}

      <Sheet show={showFilters} onClose={() => setShowFilters(false)}>
        <form
          id="creator-filter-sheet"
          className="filter-sheet-content"
          onSubmit={event => {
            event.preventDefault()
            onTopicChange(draft.topic)
            onPlatformChange(draft.platform)
            onLocationChange(draft.location)
            setShowFilters(false)
          }}
        >
          <div className="filter-sheet-heading">
            <h2>Filtros</h2>
            <button type="button" onClick={() => setDraft({ topic:'', platform:'', location:'' })}>Restablecer</button>
          </div>
          <div className="filter-sheet-options-grid">
            <label>
              <span style={FILTER_PANEL_TITLE_STYLE}>Tema</span>
              <select className="filter-sheet-control" value={draft.topic} onChange={event => setDraft(current => ({ ...current, topic:event.target.value }))} style={getFilterPanelControlStyle(draft.topic)}>
                <option value="">Todos los temas</option>
                {CREATOR_TOPICS.map(item => <option key={item.id} value={item.id}>{item.emoji} {item.label}</option>)}
              </select>
            </label>
            <label>
              <span style={FILTER_PANEL_TITLE_STYLE}>Plataforma</span>
              <select className="filter-sheet-control" value={draft.platform} onChange={event => setDraft(current => ({ ...current, platform:event.target.value }))} style={getFilterPanelControlStyle(draft.platform)}>
                <option value="">Todas las plataformas</option>
                {CREATOR_PLATFORMS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
            <label>
              <span style={FILTER_PANEL_TITLE_STYLE}>Cantón</span>
              <select className="filter-sheet-control" value={draft.location} onChange={event => setDraft(current => ({ ...current, location:event.target.value }))} style={getFilterPanelControlStyle(draft.location)}>
                <option value="">Toda Suiza</option>
                {CANTONS.map(canton => <option key={canton.code} value={canton.code}>{canton.code} · {canton.name}</option>)}
              </select>
            </label>
          </div>
          <SavedSearchButton
            draft={filterSavedSearchDraft}
            idleLabel="Guardar esta búsqueda y avisarme"
            panel
          />
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
  view='contenidos',
  onResultCountChange,
  onClearFilters,
}) {
  const { user, isLoggedIn } = useAuth()
  const [creators, setCreators] = useState(() => getAllCreators())
  const [directoryState, setDirectoryState] = useState(getCreatorDirectoryState)
  const [preview, setPreview] = useState(null)

  useEffect(() => subscribeCreatorUpdates(() => {
    setCreators(getAllCreators())
    setDirectoryState(getCreatorDirectoryState())
  }), [])

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
      && (!location || creator.canton === location)
  }).sort((first, second) => {
    if (sort === 'name') return first.name.localeCompare(second.name, 'es')
    if (sort === 'contents') {
      const firstCount = (first.contents || []).filter(content => content.status === 'published').length
      const secondCount = (second.contents || []).filter(content => content.status === 'published').length
      return secondCount - firstCount
    }
    return new Date(second.created_at) - new Date(first.created_at)
  }), [creators, location, platform, query, sort, topic])

  const contents = useMemo(() => creators
    .flatMap(creator => getOrderedCreatorContents(creator, { publishedOnly:true })
      .filter(content =>
        content.status === 'published'
        && (!topic || content.topic === topic)
        && (!platform || content.platform === platform)
        && (!location || content.canton === location))
      .map((content, selectionIndex) => ({ content, creator, selectionIndex })))
    .filter(({ content, creator }) => !query || normalize(`${content.title} ${content.summary} ${creator.name} ${creator.handle}`).includes(query))
    .sort((a, b) => a.selectionIndex - b.selectionIndex || new Date(b.content.published_at) - new Date(a.content.published_at))
    .slice(0, 12), [creators, location, platform, query, topic])

  useEffect(() => {
    onResultCountChange?.(view === 'contenidos' ? contents.length : filteredCreators.length)
  }, [contents.length, filteredCreators.length, onResultCountChange, view])

  const creatorCta = ownCreator ? '/creadores/mi-perfil' : '/creadores/alta'
  // Solo ofrecemos "Ver todo" si hay algo que limpiar; si el directorio esta
  // vacio de verdad, el boton no llevaria a ningun sitio.
  const hasFilters = Boolean(search || topic || platform || location)

  // Con el directorio "en limpio" mandan las secciones de descubrimiento: que
  // esta ayudando, quien ayuda mas y que hay nuevo. En cuanto buscas o filtras,
  // pasan a estorbar y se muestra solo el resultado de tu busqueda.
  const browsing = !search && !platform && !location
  const showContents = view === 'contenidos'
  const showCreators = view === 'creadores'
  const helpfulContents = useMemo(
    () => browsing ? getMostHelpfulContents({ topic, limit:8 }) : [],
    [browsing, topic, creators],
  )
  const latestContents = useMemo(
    () => browsing ? getLatestContents({ topic, limit:8 }) : [],
    [browsing, topic, creators],
  )
  const topCreators = useMemo(
    () => browsing ? getTopHelpfulCreators({ topic, limit:5 }) : [],
    [browsing, topic, creators],
  )
  const activeTopic = topic ? getCreatorTopic(topic) : null

  const contentRow = (id, label, hint, entries) => entries.length > 0 && (
    <section className="creator-community-section" aria-labelledby={id}>
      <div className="creator-community-section__heading">
        <div>
          <p id={id}>{label}</p>
          <span>{hint}</span>
        </div>
        <strong>{entries.length}</strong>
      </div>
      <div className="creator-community-content no-scroll">
        <div>
          {entries.map(({ content, creator }) => (
            <CreatorAppContentCard
              key={content.id}
              content={content}
              creator={creator}
              discovery
              onContentOpen={(selectedContent, selectedCreator) => setPreview({
                content:selectedContent,
                creator:selectedCreator,
                playlist:entries,
              })}
            />
          ))}
        </div>
      </div>
    </section>
  )

  if ((!directoryState.loaded || directoryState.loading) && !creators.length) {
    return (
      <div className="creator-community-view" aria-busy="true" aria-label="Cargando Creadores">
        <div className="creator-community-list">
          {[1,2,3].map(item => <SkeletonCard key={item} variant="list" lines={1} />)}
        </div>
      </div>
    )
  }

  if (directoryState.error && !creators.length) {
    return (
      <div className="creator-community-view">
        <EmptyState
          variant="card"
          emoji="⚠️"
          title="No pudimos cargar Creadores"
          sub="Comprueba tu conexión e inténtalo de nuevo."
          action="Reintentar"
          onAction={() => window.location.reload()}
        />
      </div>
    )
  }

  return (
    <div className="creator-community-view">
      {browsing && showContents && (
        <>
          {contentRow(
            'community-creators-helpful-title',
            activeTopic ? `🔥 LO QUE MÁS AYUDA EN ${activeTopic.label.toUpperCase()}` : '🔥 CONTENIDO QUE ESTÁ AYUDANDO',
            'Lo que más gente ha marcado como útil.',
            helpfulContents,
          )}

          {contentRow(
            'community-creators-latest-title',
            'CONTENIDO RECIENTE',
            'Lo más reciente que ha publicado la comunidad.',
            latestContents,
          )}

        </>
      )}

        {browsing && showCreators && topCreators.length > 0 && (
          <section className="creator-community-section" aria-labelledby="community-top-creators-title">
            <div className="creator-community-section__heading">
              <div>
                <p id="community-top-creators-title">🏆 CREADORES QUE MÁS AYUDAN</p>
                <span>{activeTopic ? `Ranking en ${activeTopic.label}.` : 'Según los “me ayudó” de la comunidad.'}</span>
              </div>
            </div>
            <div className="creator-rank-list">
              {topCreators.map((entry, index) => (
                <Link key={entry.creator.id} to={`/creadores/${entry.creator.slug}`} className="creator-rank-row">
                  <span className="creator-rank-row__position">#{index + 1}</span>
                  <CreatorAvatar creator={entry.creator} size={38} compact />
                  <span className="creator-rank-row__body">
                    <strong>{entry.creator.name}</strong>
                    <span>{entry.creator.tagline}</span>
                  </span>
                  <span className="creator-rank-row__score">❤️ {entry.helpful}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

      {showContents && (
      <section className="creator-community-section" aria-labelledby="community-creators-content-title">
        <div className="creator-community-section__heading">
          <div>
            <p id="community-creators-content-title">CONTENIDO PARA DESCUBRIR</p>
            <span>Vídeos y contenido para descubrir sin salir de Latido.</span>
          </div>
          <strong>{contents.length}</strong>
        </div>
        {contents.length ? (
          <div className="creator-community-grid">
            {contents.map(({ content, creator }) => (
              <CreatorAppContentCard
                key={content.id}
                content={content}
                creator={creator}
                discovery
                onContentOpen={(selectedContent, selectedCreator) => setPreview({
                  content:selectedContent,
                  creator:selectedCreator,
                  playlist:contents,
                })}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            emoji="🎬"
            title={hasFilters ? 'No hay contenido con estos filtros' : 'Todavía no hay contenido'}
            sub={hasFilters
              ? 'Prueba otro tema o quita algún filtro.'
              : 'Cuando los creadores publiquen, aparecerán aquí.'}
            action={hasFilters ? 'Ver todo' : undefined}
            onAction={hasFilters ? onClearFilters : undefined}
          />
        )}
      </section>

      )}

      {showCreators && (
      <section className="creator-community-section" aria-labelledby="community-creators-profiles-title">
        <div className="creator-community-section__heading">
          <div>
            <p id="community-creators-profiles-title">PERFILES DE CREADORES</p>
            <span>Personas, profesionales y negocios que comparten sobre Suiza.</span>
          </div>
          <strong>{filteredCreators.length}</strong>
        </div>
        {filteredCreators.length ? (
          <div className="creator-community-list">
            {filteredCreators.map(creator => {
            const visibleTopics = (creator.topics || []).slice(0, 1)
            const remainingTopics = Math.max(0, (creator.topics || []).length - visibleTopics.length)
            return (
              <article key={creator.id} className="creator-community-card" style={{ '--creator-card-accent':creator.accent || C.primary }}>
                <Link to={`/creadores/${creator.slug}`} className="creator-community-card__open">
                  {/* El mismo CreatorAvatar del perfil, para que la foto se vea
                      igual en el directorio, en Inicio y en la ficha. */}
                  <span className="creator-community-card__media">
                    <CreatorAvatar creator={creator} size={84} />
                  </span>
                  <CreatorProfileHelpfulMetric creator={creator} />

                  <span className="creator-community-card__body">
                    <span className="creator-community-card__name">
                      <strong>{creator.name}</strong>
                    </span>
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
                  <CreatorProfileHelpfulButton creator={creator} />
                  <CreatorFollowButton creator={creator} />
                </span>
              </article>
            )
            })}
          </div>
        ) : (
          <EmptyState
            emoji="🎙️"
            title={hasFilters ? 'No hay creadores con estos filtros' : 'Todavía no hay creadores'}
            sub={hasFilters
              ? 'Prueba otro tema, plataforma o cantón.'
              : 'Crea el primer perfil y conecta tus redes con la comunidad.'}
            action={hasFilters ? 'Ver todo' : undefined}
            onAction={hasFilters ? onClearFilters : undefined}
          />
        )}
      </section>

      )}

      <div className="creator-community-cta">
        <span>🎙️</span>
        <h3>{ownCreator ? 'Gestiona tu perfil y tu contenido' : '¿Compartes algo sobre Suiza en redes?'}</h3>
        <p>{ownCreator ? 'Actualiza cómo te presentas y elige qué contenido mostrar.' : 'Tu experiencia, trabajo, proyecto o negocio puede interesar a la comunidad hispanohablante.'}</p>
        <Link to={isLoggedIn ? creatorCta : `/auth?next=${encodeURIComponent('/creadores/alta')}`}>
          {ownCreator ? 'Abrir mi espacio' : 'Crear mi perfil'}
        </Link>
      </div>

      <CreatorContentModal
        content={preview?.content}
        creator={preview?.creator}
        playlist={preview?.playlist}
        onClose={() => setPreview(null)}
      />
    </div>
  )
}
