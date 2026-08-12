import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CreatorAppContentCard, CreatorAvatar, CreatorContentModal } from './CreatorCards'
import { getAllCreators, getOrderedCreatorContents, subscribeCreatorUpdates } from '../lib/creators'
import { C, PP } from '../lib/theme'
import '../pages/Creators.css'

function SectionHeading({ id, title, subtitle, to }) {
  return (
    <div style={{ maxWidth:1200, margin:'0 auto 14px', padding:'0 16px', display:'grid', gridTemplateColumns:'minmax(0,1fr) auto', gap:'3px 16px', alignItems:'center' }}>
      <h2 id={id} style={{ margin:0, color:C.text, fontFamily:PP, fontWeight:800, fontSize:20 }}>{title}</h2>
      <Link to={to} style={{ color:C.primary, fontFamily:PP, fontSize:11, fontWeight:700, textDecoration:'none', whiteSpace:'nowrap' }}>Ver todo →</Link>
      <p style={{ gridColumn:'1 / -1', margin:0, color:C.mid, fontFamily:PP, fontSize:11, lineHeight:1.5 }}>{subtitle}</p>
    </div>
  )
}

// Reutiliza las clases del directorio para que la tarjeta sea la misma en las
// dos superficies; aqui solo se omiten los botones, que no caben en el carrusel.
function CreatorProfileMiniCard({ creator }) {
  const place = `${creator.city || creator.reach}${creator.canton ? `, ${creator.canton}` : ''}`

  return (
    <article className="creator-community-card" style={{ '--creator-card-accent':creator.accent || C.primary }}>
      <Link to={`/creadores/${creator.slug}`} className="creator-community-card__open">
        <span className="creator-community-card__media">
          <CreatorAvatar creator={creator} size={84} />
        </span>
        <span className="creator-community-card__body">
          <span className="creator-community-card__name">
            <strong>{creator.name}</strong>
          </span>
          <span className="creator-community-card__tagline">{creator.tagline}</span>
          <span className="creator-community-card__location" title={place}>📍 {place}</span>
        </span>
      </Link>
    </article>
  )
}

export default function CreatorHomeSection() {
  const [preview, setPreview] = useState(null)
  const [creators, setCreators] = useState(() => getAllCreators())
  const contentScrollRef = useRef(null)
  const creatorsScrollRef = useRef(null)

  useEffect(() => subscribeCreatorUpdates(() => setCreators(getAllCreators())), [])

  const featured = useMemo(() => creators
    .flatMap(creator => getOrderedCreatorContents(creator, { publishedOnly:true })
      .map((content, selectionIndex) => ({ content, creator, selectionIndex })))
    .sort((a, b) => a.selectionIndex - b.selectionIndex || new Date(b.content.published_at) - new Date(a.content.published_at))
    .slice(0, 6), [creators])

  const featuredCreators = useMemo(() => [...creators]
    .sort((first, second) => new Date(second.created_at) - new Date(first.created_at))
    .slice(0, 8), [creators])

  const firstContentId = featured[0]?.content.id
  const firstCreatorId = featuredCreators[0]?.id

  useEffect(() => {
    const resetToStart = () => {
      if (contentScrollRef.current) contentScrollRef.current.scrollLeft = 0
      if (creatorsScrollRef.current) creatorsScrollRef.current.scrollLeft = 0
    }
    const resetAfterRestore = () => window.requestAnimationFrame(resetToStart)

    resetToStart()
    const frame = window.requestAnimationFrame(resetToStart)
    const timeout = window.setTimeout(resetToStart, 120)
    window.addEventListener('pageshow', resetAfterRestore)

    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timeout)
      window.removeEventListener('pageshow', resetAfterRestore)
    }
  }, [firstContentId, firstCreatorId])

  if (!featured.length && !featuredCreators.length) return null

  return (
    <>
      {featured.length > 0 && (
        <section style={{ padding:'40px 0 0' }} aria-labelledby="home-creator-contents-title">
          <SectionHeading
            id="home-creator-contents-title"
            title="🎬 Contenido"
            subtitle="Experiencias, consejos, trabajo y proyectos compartidos en español desde Suiza."
            to="/comunidades?view=creadores&creatorView=contenidos"
          />
          <div ref={contentScrollRef} className="creator-home-scroll no-scroll">
            <div className="creator-home-scroll__track">
              {featured.map(({ content, creator }) => (
                <div key={content.id} className="creator-home-scroll__item">
                  <CreatorAppContentCard
                    content={content}
                    creator={creator}
                    discovery
                    onContentOpen={(selectedContent, selectedCreator) => setPreview({
                      content:selectedContent,
                      creator:selectedCreator,
                      playlist:featured,
                    })}
                  />
                </div>
              ))}
            </div>
          </div>
          <CreatorContentModal
            content={preview?.content}
            creator={preview?.creator}
            playlist={preview?.playlist}
            onClose={() => setPreview(null)}
          />
        </section>
      )}

      {featuredCreators.length > 0 && (
        <section style={{ padding:'40px 0 0' }} aria-labelledby="home-creators-title">
          <SectionHeading
            id="home-creators-title"
            title="🎙️ Creadores"
            subtitle="Personas, profesionales y negocios que cuentan Suiza en español."
            to="/comunidades?view=creadores&creatorView=creadores"
          />
          <div ref={creatorsScrollRef} className="creator-home-scroll no-scroll">
            <div className="creator-home-scroll__track">
              {featuredCreators.map(creator => (
                <div key={creator.id} className="creator-home-scroll__item">
                  <CreatorProfileMiniCard creator={creator} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  )
}
