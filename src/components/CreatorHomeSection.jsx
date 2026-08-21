import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CreatorAppContentCard, CreatorAvatar, CreatorContentModal } from './CreatorCards'
import { getAllCreators, getOrderedCreatorContents, subscribeCreatorUpdates } from '../lib/creators'
import { BUSINESS_ROTATION_INTERVAL_MS } from '../lib/businessPromotion'
import { rotateItemsWithRecentFirst } from '../lib/rotation'
import { C, PP } from '../lib/theme'
import { useTimedRotationBucket } from '../hooks/useTimedRotationBucket'
import '../pages/Creators.css'

function SectionHeading({ id, title, subtitle, to }) {
  return (
    <div className="latido-page-container" style={{ marginBottom:14, display:'grid', gridTemplateColumns:'minmax(0,1fr) auto', gap:'3px 16px', alignItems:'center' }}>
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
  const rotationOffset = useTimedRotationBucket(BUSINESS_ROTATION_INTERVAL_MS)
  const [freshnessNow, setFreshnessNow] = useState(() => Date.now())

  useEffect(() => subscribeCreatorUpdates(() => {
    setCreators(getAllCreators())
    setFreshnessNow(Date.now())
  }), [])

  useEffect(() => {
    const now = Math.max(Date.now(), freshnessNow)
    const expirationTimes = creators.flatMap(creator => [
      new Date(creator.created_at || 0).getTime() + BUSINESS_ROTATION_INTERVAL_MS,
      ...(creator.contents || []).map(content => (
        new Date(content.published_at || content.created_at || 0).getTime() + BUSINESS_ROTATION_INTERVAL_MS
      )),
    ])
    const nextExpiration = Math.min(...expirationTimes.filter(timestamp => (
      Number.isFinite(timestamp) && timestamp > now
    )))

    if (!Number.isFinite(nextExpiration)) return undefined

    const timeoutId = window.setTimeout(
      () => setFreshnessNow(Date.now()),
      Math.min(nextExpiration - now + 25, 2_147_483_647),
    )

    return () => window.clearTimeout(timeoutId)
  }, [creators, freshnessNow])

  const featured = useMemo(() => rotateItemsWithRecentFirst(
    creators
      .flatMap(creator => getOrderedCreatorContents(creator, { publishedOnly:true })
        .map((content, selectionIndex) => ({ content, creator, selectionIndex })))
      .sort((a, b) => a.selectionIndex - b.selectionIndex || new Date(b.content.published_at) - new Date(a.content.published_at)),
    rotationOffset,
    BUSINESS_ROTATION_INTERVAL_MS,
    item => item.content.published_at || item.content.created_at,
    freshnessNow,
  ).slice(0, 6), [creators, freshnessNow, rotationOffset])

  const featuredCreators = useMemo(() => rotateItemsWithRecentFirst(
    [...creators].sort((first, second) => new Date(second.created_at) - new Date(first.created_at)),
    rotationOffset,
    BUSINESS_ROTATION_INTERVAL_MS,
    creator => creator.created_at,
    freshnessNow,
  ).slice(0, 8), [creators, freshnessNow, rotationOffset])

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
