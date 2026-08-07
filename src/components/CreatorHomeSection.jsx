import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CreatorAppContentCard, CreatorContentModal, getCreatorInitials } from './CreatorCards'
import { getAllCreators, getOrderedCreatorContents } from '../lib/creators'
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

function CreatorProfileMiniCard({ creator }) {
  const place = creator.city || creator.reach

  return (
    <Link to={`/creadores/${creator.slug}`} className="creator-home-profile-card">
      <span className="creator-home-profile-card__media">
        {creator.avatar_url ? (
          <img src={creator.avatar_url} alt="" loading="lazy" decoding="async" />
        ) : (
          <span
            className="creator-home-profile-card__fallback"
            style={{ '--creator-card-accent':creator.accent || C.primary }}
            aria-hidden="true"
          >
            {getCreatorInitials(creator)}
          </span>
        )}
        {creator.demo && <small>DEMO</small>}
      </span>
      <span className="creator-home-profile-card__copy">
        <strong>{creator.name}</strong>
        <span className="creator-home-profile-card__tagline">{creator.tagline}</span>
        {place && <span className="creator-home-profile-card__place">📍 {place}</span>}
      </span>
    </Link>
  )
}

export default function CreatorHomeSection() {
  const [preview, setPreview] = useState(null)
  const creators = useMemo(() => getAllCreators(), [])

  const featured = useMemo(() => creators
    .flatMap(creator => getOrderedCreatorContents(creator, { publishedOnly:true })
      .map((content, selectionIndex) => ({ content, creator, selectionIndex })))
    .sort((a, b) => a.selectionIndex - b.selectionIndex || new Date(b.content.published_at) - new Date(a.content.published_at))
    .slice(0, 6), [creators])

  const featuredCreators = useMemo(() => [...creators]
    .sort((first, second) => new Date(second.created_at) - new Date(first.created_at))
    .slice(0, 8), [creators])

  if (!featured.length && !featuredCreators.length) return null

  return (
    <>
      {featured.length > 0 && (
        <section style={{ padding:'40px 0 0' }} aria-labelledby="home-creator-contents-title">
          <SectionHeading
            id="home-creator-contents-title"
            title="🎬 Publicaciones"
            subtitle="Experiencias, consejos, trabajo y proyectos compartidos en español desde Suiza."
            to="/comunidades?view=creadores"
          />
          <div className="creator-home-scroll no-scroll">
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
            to="/comunidades?view=creadores"
          />
          <div className="creator-home-scroll no-scroll">
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
