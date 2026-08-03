import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  CREATOR_PLATFORMS,
  CREATOR_TOPICS,
  getAllCreators,
  getCreatorForUser,
  subscribeCreatorUpdates,
} from '../lib/creators'
import {
  CreatorAvatar,
  CreatorCard,
  CreatorContentCard,
  DemoContentModal,
} from '../components/CreatorCards'
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
    .flatMap(creator => (creator.contents || [])
      .filter(content => {
        const searchable = normalizeSearch([content.title, content.summary, creator.name, creator.handle].join(' '))
        return content.status === 'published'
          && (!query || searchable.includes(query))
          && (!topic || content.topic === topic)
          && (!platform || content.platform === platform)
          && (!canton || content.canton === canton || content.canton === 'Toda Suiza')
      })
      .map(content => ({ content, creator })))
    .sort((a, b) => new Date(b.content.published_at) - new Date(a.content.published_at))
    .slice(0, 6)
  }, [canton, filteredCreators, platform, search, topic])

  const creatorCta = ownCreator ? '/creadores/mi-perfil' : '/creadores/alta'

  return (
    <div className="creators-page">
      <header className="creators-hero">
        <div className="creators-shell creators-hero__grid">
          <div>
            <span className="creators-eyebrow">PERSONAS Y PROYECTOS · SUIZA</span>
            <h1>Descubre a quienes comparten su <em>vida, trabajo y proyectos en Suiza</em></h1>
            <p className="creators-hero__lead">
              Personas, profesionales y negocios que publican experiencias, información y proyectos en sus redes. Latido los organiza por tema y lugar y envía cada visita a la publicación original.
            </p>
            <div className="creators-hero__actions">
              <a className="creators-primary-action" href="#contenidos">Explorar publicaciones ↓</a>
              <Link className="creators-secondary-action" to={isLoggedIn ? creatorCta : `/auth?next=${encodeURIComponent('/creadores/alta')}`}>
                {ownCreator ? 'Abrir mi espacio' : 'Quiero mostrar mis redes'}
              </Link>
            </div>
          </div>

          <div className="creators-hero__sample" aria-hidden="true">
            <span className="creators-hero__float creators-hero__float--one">📍 Filtrado por cantón</span>
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
            <span className="creators-hero__float creators-hero__float--two">▶ Las visitas llegan a sus redes</span>
          </div>
        </div>
      </header>

      <main className="creators-shell">
        <div className="creators-toolbar" aria-label="Filtros de creadores">
          <input
            type="search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Buscar perfil, ciudad o tema…"
            aria-label="Buscar creadores"
          />
          <select value={topic} onChange={event => setTopic(event.target.value)} aria-label="Filtrar por tema">
            <option value="">Todos los temas</option>
            {CREATOR_TOPICS.map(item => <option key={item.id} value={item.id}>{item.emoji} {item.label}</option>)}
          </select>
          <select value={canton} onChange={event => setCanton(event.target.value)} aria-label="Filtrar por cantón">
            <option value="">Toda Suiza</option>
            {cantons.map(item => <option key={item} value={item}>Cantón {item}</option>)}
          </select>
          <select value={platform} onChange={event => setPlatform(event.target.value)} aria-label="Filtrar por plataforma">
            <option value="">Todas las plataformas</option>
            {CREATOR_PLATFORMS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </div>

        <section className="creators-section" aria-labelledby="creators-directory-title">
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
              <p>Experiencias, información y trabajo compartidos desde sus redes y páginas originales.</p>
            </div>
            <span className="creators-results-count">Actualizado recientemente</span>
          </div>
          <div className="creator-content-grid">
            {featuredContents.map(({ content, creator }) => (
              <CreatorContentCard
                key={content.id}
                content={content}
                creator={creator}
                onDemoOpen={(selectedContent, selectedCreator) => setPreview({ content:selectedContent, creator:selectedCreator })}
              />
            ))}
            {!featuredContents.length && (
              <div className="creators-empty">
                No hay publicaciones que coincidan con estos filtros.
              </div>
            )}
          </div>
        </section>

        <section className="creators-section" style={{ paddingBottom:30 }}>
          <div style={{ position:'relative', overflow:'hidden', display:'grid', gridTemplateColumns:'minmax(0,1fr) auto', gap:24, alignItems:'center', padding:'28px', color:'#fff', background:'linear-gradient(135deg,#102A5C,#2563EB)', borderRadius:26 }}>
            <div style={{ position:'relative', zIndex:1 }}>
              <span style={{ display:'block', marginBottom:7, fontSize:10, fontWeight:800, letterSpacing:1, opacity:.7 }}>PARA QUIENES COMPARTEN SOBRE SUIZA</span>
              <h2 style={{ margin:'0 0 7px', fontSize:22, lineHeight:1.25 }}>Haz que más personas descubran lo que compartes</h2>
              <p style={{ maxWidth:650, margin:0, color:'rgba(255,255,255,.78)', fontSize:11.5, lineHeight:1.7 }}>Conecta tus redes y destaca hasta seis publicaciones sobre tu experiencia, profesión, trabajo, proyecto o negocio. No necesitas dedicarte profesionalmente a crear contenido.</p>
            </div>
            <Link className="creators-secondary-action" to={isLoggedIn ? creatorCta : `/auth?next=${encodeURIComponent('/creadores/alta')}`} style={{ position:'relative', zIndex:1, whiteSpace:'nowrap' }}>
              {ownCreator ? 'Gestionar mi perfil' : 'Crear perfil de prueba'}
            </Link>
          </div>
        </section>
      </main>

      <DemoContentModal content={preview?.content} creator={preview?.creator} onClose={() => setPreview(null)} />
    </div>
  )
}
