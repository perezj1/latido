import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CreatorAppContentCard, DemoContentModal } from './CreatorCards'
import { getAllCreators } from '../lib/creators'
import { C, PP } from '../lib/theme'
import '../pages/Creators.css'

export default function CreatorHomeSection() {
  const [preview, setPreview] = useState(null)
  const featured = useMemo(() => getAllCreators()
    .flatMap(creator => (creator.contents || [])
      .filter(content => content.status === 'published')
      .map(content => ({ content, creator })))
    .sort((a, b) => new Date(b.content.published_at) - new Date(a.content.published_at))
    .slice(0, 6), [])

  if (!featured.length) return null

  return (
    <section style={{ padding:'40px 0 0' }} aria-labelledby="home-creators-title">
      <div style={{ maxWidth:1200, margin:'0 auto 14px', padding:'0 16px', display:'grid', gridTemplateColumns:'minmax(0,1fr) auto', gap:'3px 16px', alignItems:'center' }}>
        <h2 id="home-creators-title" style={{ margin:0, color:C.text, fontFamily:PP, fontWeight:800, fontSize:20 }}>🎙️ Creadores sobre Suiza</h2>
        <Link to="/comunidades?view=creadores" style={{ color:C.primary, fontFamily:PP, fontSize:11, fontWeight:700, textDecoration:'none', whiteSpace:'nowrap' }}>Ver todo →</Link>
        <p style={{ gridColumn:'1 / -1', margin:0, color:C.mid, fontFamily:PP, fontSize:11, lineHeight:1.5 }}>Experiencias, consejos, trabajo y proyectos compartidos en español desde Suiza.</p>
      </div>
      <div className="creator-home-scroll no-scroll">
        <div className="creator-home-scroll__track">
          {featured.map(({ content, creator }) => (
            <div key={content.id} className="creator-home-scroll__item">
              <CreatorAppContentCard
                content={content}
                creator={creator}
                onDemoOpen={(selectedContent, selectedCreator) => setPreview({ content:selectedContent, creator:selectedCreator })}
              />
            </div>
          ))}
        </div>
      </div>
      <DemoContentModal content={preview?.content} creator={preview?.creator} onClose={() => setPreview(null)} />
    </section>
  )
}
