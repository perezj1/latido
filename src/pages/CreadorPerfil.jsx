import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import {
  getAllCreators,
  getCreatorBySlug,
  getCreatorPlatform,
  trackCreatorMetric,
} from '../lib/creators'
import {
  CreatorAvatar,
  CreatorCard,
  CreatorContentCard,
  CreatorTopicPill,
  DemoContentModal,
} from '../components/CreatorCards'
import { C, PP } from '../lib/theme'
import ReportButton from '../components/ReportButton'
import './Creators.css'

export default function CreadorPerfil() {
  const { creatorSlug } = useParams()
  const { user } = useAuth()
  const [creator, setCreator] = useState(() => getCreatorBySlug(creatorSlug))
  const [preview, setPreview] = useState(null)

  useEffect(() => {
    const current = getCreatorBySlug(creatorSlug)
    setCreator(current)
    if (current) trackCreatorMetric(current.id, 'profile_view')
  }, [creatorSlug])

  const relatedCreators = useMemo(() => {
    if (!creator) return []
    return getAllCreators()
      .filter(item => item.id !== creator.id && item.topics?.some(topic => creator.topics?.includes(topic)))
      .slice(0, 2)
  }, [creator])

  if (!creator || creator.status !== 'published') {
    return (
      <div className="creators-page" style={{ display:'grid', minHeight:'70vh', placeItems:'center', padding:'30px' }}>
        <div style={{ maxWidth:480, padding:28, textAlign:'center', background:'#fff', border:`1px solid ${C.border}`, borderRadius:24 }}>
          <div style={{ fontSize:44 }}>🎙️</div>
          <h1 style={{ fontFamily:PP, fontSize:22, color:C.text }}>Este perfil no está disponible</h1>
          <p style={{ fontFamily:PP, fontSize:12, lineHeight:1.7, color:C.mid }}>Puede estar todavía en borrador o haber cambiado de dirección.</p>
          <Link className="creators-primary-action" to="/creadores">Volver a creadores</Link>
        </div>
      </div>
    )
  }

  const publishedContents = (creator.contents || []).filter(content => content.status === 'published')
  const isOwner = Boolean(user?.id && creator.owner_id === user.id)

  const handleSocialClick = (event, social) => {
    if (creator.demo) {
      event.preventDefault()
      toast('En un perfil real se abriría su red social o página original.', { icon:'🧪' })
      return
    }
    trackCreatorMetric(creator.id, 'social_click', social.platform)
  }

  const handleShare = async () => {
    const url = window.location.href
    const data = { title:`${creator.name} en Latido`, text:creator.tagline, url }
    try {
      if (navigator.share) await navigator.share(data)
      else {
        await navigator.clipboard.writeText(url)
        toast.success('Enlace copiado')
      }
    } catch {}
  }

  return (
    <div className="creators-page creator-app-form-page">
      <div className="creator-public-shell" style={{ paddingTop:22 }}>
        <Link className="creator-public-back" to="/comunidades?view=creadores" style={{ display:'inline-flex', marginBottom:18, color:C.primary, fontFamily:PP, fontSize:11, fontWeight:800, textDecoration:'none' }}>← Creadores</Link>

        <section className="creator-public-profile" style={{ overflow:'hidden', background:'#fff', border:`1px solid ${C.border}`, borderRadius:24, boxShadow:'0 8px 24px rgba(15,23,42,.06)' }}>
          <div style={{ position:'relative', height:150, background:`linear-gradient(125deg, ${creator.accent || C.primary}, #102A5C)` }}>
            <div style={{ position:'absolute', width:220, height:220, right:-30, top:-80, border:'30px solid rgba(255,255,255,.09)', borderRadius:'50%' }} />
            <div style={{ position:'absolute', width:110, height:110, left:'35%', bottom:-70, border:'18px solid rgba(255,255,255,.08)', borderRadius:'50%' }} />
            <span style={{ position:'absolute', top:20, left:22, display:'inline-flex', padding:'6px 10px', color:'#fff', background:'rgba(255,255,255,.17)', border:'1px solid rgba(255,255,255,.24)', borderRadius:999, fontFamily:PP, fontWeight:800, fontSize:9, letterSpacing:.8 }}>
              CREADOR EN LATIDO
            </span>
            {creator.demo && <span style={{ position:'absolute', top:20, right:22, display:'inline-flex', padding:'6px 10px', color:'#102A5C', background:'#fff', borderRadius:999, fontFamily:PP, fontWeight:800, fontSize:9 }}>PERFIL FICTICIO · DEMO</span>}
          </div>

          <div className="creator-public-profile__body" style={{ position:'relative', display:'grid', gridTemplateColumns:'minmax(0,1fr) auto', gap:24, padding:'0 26px 26px' }}>
            <div style={{ minWidth:0 }}>
              <div style={{ transform:'translateY(-48px)', marginBottom:-34 }}>
                <CreatorAvatar creator={creator} size={100} />
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                <h1 style={{ margin:0, fontFamily:PP, fontSize:28, lineHeight:1.2, letterSpacing:-.8, color:'#102A5C' }}>{creator.name}</h1>
                {creator.verified && <span className="creator-confirmed" title="Perfil confirmado por su responsable">✓</span>}
              </div>
              <p style={{ margin:'4px 0 12px', color:C.light, fontFamily:PP, fontWeight:600, fontSize:11 }}>{creator.handle} · 📍 {creator.city || creator.reach}{creator.canton ? `, ${creator.canton}` : ''}</p>
              <p style={{ maxWidth:720, margin:'0 0 12px', color:C.text, fontFamily:PP, fontWeight:700, fontSize:14, lineHeight:1.6 }}>{creator.tagline}</p>
              <p style={{ maxWidth:780, margin:0, color:C.mid, fontFamily:PP, fontSize:11.5, lineHeight:1.75 }}>{creator.bio}</p>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:16 }}>
                {(creator.topics || []).map(topic => <CreatorTopicPill key={topic} topicId={topic} />)}
              </div>
            </div>

            <div className="creator-public-profile__socials" style={{ display:'flex', minWidth:190, paddingTop:22, flexDirection:'column', gap:8 }}>
              {(creator.socials || []).map(social => {
                const platform = getCreatorPlatform(social.platform)
                return (
                  <a
                    key={`${social.platform}-${social.url}`}
                    href={social.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    onClick={event => handleSocialClick(event, social)}
                    style={{ display:'flex', minHeight:42, padding:'0 13px', alignItems:'center', gap:9, color:platform.color, background:platform.bg, border:`1px solid ${platform.color}22`, borderRadius:12, fontFamily:PP, fontSize:10.5, fontWeight:800, textDecoration:'none' }}
                  >
                    <span style={{ minWidth:28 }}>{platform.short}</span>
                    <span>{social.label || platform.label}</span>
                    <span style={{ marginLeft:'auto' }}>↗</span>
                  </a>
                )
              })}
              <button type="button" onClick={handleShare} style={{ minHeight:42, color:C.primary, background:'#fff', border:`1px solid ${C.primaryMid}`, borderRadius:12, fontFamily:PP, fontSize:10.5, fontWeight:800, cursor:'pointer' }}>Compartir perfil</button>
              <ReportButton
                contentType="creator_profile"
                contentId={creator.id}
                ownerId={creator.owner_id}
                  title="Reportar este perfil"
                label="Reportar perfil"
                metadata={{ creator_name:creator.name, creator_slug:creator.slug, creator_handle:creator.handle, demo:Boolean(creator.demo) }}
                style={{ minHeight:42, width:'100%', fontSize:10.5 }}
              />
              {isOwner && <Link to="/creadores/mi-perfil" style={{ display:'flex', minHeight:42, alignItems:'center', justifyContent:'center', color:'#fff', background:C.text, borderRadius:12, fontFamily:PP, fontSize:10.5, fontWeight:800, textDecoration:'none' }}>Gestionar mi perfil</Link>}
            </div>
          </div>
        </section>

        <section className="creators-section" style={{ paddingTop:36 }}>
          <div className="creators-section__heading">
            <div>
              <h2>Publicaciones destacadas</h2>
              <p>Enlaces elegidos por este perfil. Cada visita se abre en la red social o página original.</p>
            </div>
            <span className="creators-results-count">{publishedContents.length} de 6 espacios utilizados</span>
          </div>
          <div className="creator-content-grid">
            {publishedContents.map(content => (
              <CreatorContentCard
                key={content.id}
                content={content}
                creator={creator}
                onDemoOpen={(selectedContent, selectedCreator) => setPreview({ content:selectedContent, creator:selectedCreator })}
              />
            ))}
            {!publishedContents.length && <div className="creators-empty">Este perfil todavía no ha añadido publicaciones.</div>}
          </div>
        </section>

        {relatedCreators.length > 0 && (
          <section className="creators-section">
            <div className="creators-section__heading">
              <div>
                <h2>También te puede interesar</h2>
                <p>Otras personas y proyectos que comparten temas parecidos.</p>
              </div>
            </div>
            <div className="creators-grid">
              {relatedCreators.map(item => <CreatorCard key={item.id} creator={item} />)}
            </div>
          </section>
        )}

        <section className="creator-public-profile__cta creator-public-section-inset" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:20, marginTop:10, padding:'22px 24px', background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:22 }}>
          <div>
            <strong style={{ display:'block', marginBottom:4, fontFamily:PP, color:'#102A5C', fontSize:14 }}>¿También compartes sobre Suiza en tus redes?</strong>
            <span style={{ fontFamily:PP, color:C.mid, fontSize:10.5 }}>Puedes mostrar experiencias, información, tu profesión, trabajo, proyecto o negocio. No hace falta ser creador profesional.</span>
          </div>
          <Link className="creators-primary-action" to="/creadores/alta" style={{ flexShrink:0 }}>Crear mi perfil</Link>
        </section>
      </div>

      <DemoContentModal content={preview?.content} creator={preview?.creator} onClose={() => setPreview(null)} />
    </div>
  )
}
