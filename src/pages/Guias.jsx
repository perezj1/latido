import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { MOCK_DOCS } from '../lib/constants'
import { getGuideById, getGuideBySlug, getGuidePath } from '../lib/seo'
import { C, PP } from '../lib/theme'
import { Card, Tag, PillFilters } from '../components/UI'
import PartnerServicesPromo, { getPartnerServiceMatch } from '../components/PartnerServicesPromo'
import { rememberRecentlyViewed } from '../lib/recentlyViewed'
import { formatGuideReviewDate } from '../components/GuideArticle'
import GuideDetailPage from '../components/GuideDetailPage'
import ResourcePackagesStrip from '../components/ResourcePackagesStrip'
import { RESOURCE_PACKAGES } from '../lib/resourcePackages'
import { normalizeSearchText } from '../lib/naturalSearch'
import './Guias.css'

export default function Guias() {
  const { isLoggedIn, user } = useAuth()
  const navigate = useNavigate()
  const { guideSlug } = useParams()
  const [searchParams] = useSearchParams()
  const [cat, setCat] = useState('')
  const [search, setSearch] = useState('')
  const openGuideId = searchParams.get('openGuide') || ''
  const routeGuide = guideSlug ? getGuideBySlug(guideSlug) : null
  const selected = routeGuide || getGuideById(openGuideId)
  const partnerService = getPartnerServiceMatch(search)

  const cats = [
    { id:'', label:'Todos' },
    { id:'permisos', label:'📄 Permisos' },
    { id:'impuestos', label:'🧾 Dinero e impuestos' },
    { id:'salud', label:'🏥 Salud' },
    { id:'banco', label:'🏦 Banco y pagos' },
    { id:'educacion', label:'🎓 Estudios' },
    { id:'trabajo', label:'💼 Trabajo' },
    { id:'vivienda', label:'🏠 Vivienda' },
  ]

  const q = normalizeSearchText(search)
  const filteredPackages = RESOURCE_PACKAGES.filter(resourcePackage => {
    const linkedGuides = resourcePackage.resources
      .map(resource => getGuideById(new URL(resource.href, 'https://latido.ch').searchParams.get('openGuide')))
      .filter(Boolean)
    const matchesCat = !cat || linkedGuides.some(guide => guide.cat === cat)
    const text = normalizeSearchText([
      resourcePackage.title, resourcePackage.description, resourcePackage.intro,
      ...resourcePackage.resources.map(resource => `${resource.title} ${resource.description}`),
      ...linkedGuides.map(guide => `${guide.title} ${guide.summary}`),
    ].join(' '))
    return matchesCat && q.split(' ').filter(Boolean).every(term => text.includes(term))
  })

  const filtered = MOCK_DOCS.filter((d) => {
    const matchesCat = !cat || d.cat === cat

    const matchesSearch =
      !q ||
      normalizeSearchText(d.title).includes(q) ||
      normalizeSearchText(d.summary).includes(q) ||
      normalizeSearchText(d.content).includes(q) ||
      normalizeSearchText(d.time).includes(q)

    return matchesCat && matchesSearch
  })

  useEffect(() => {
    if (!selected) return
    rememberRecentlyViewed({
      type:'guide',
      id:selected.id,
      label:selected.title || 'Guía',
      sub:['Guía', selected.time, selected.level].filter(Boolean).join(' · '),
      href:getGuidePath(selected),
      image:selected.img || '',
      imageFit:'cover',
      icon:selected.emoji || '📚',
    }, user?.id)
  }, [selected, user?.id])

  const openGuide = doc => {
    navigate(getGuidePath(doc))
  }

  if (selected) return <GuideDetailPage guide={selected} />

  return (
    <div className="latido-page-container latido-page-container--content" style={{ paddingTop:16, paddingBottom:100 }}>
      <header className="section-page-head">
        <h1>📚 Guías</h1>
        <p>Guías, anuncios y comunidad reunidos para cada etapa de tu vida en Suiza.</p>
      </header>

      <div style={{ position:'relative', marginBottom:12 }}>
        <span aria-hidden="true" style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', color:C.light }}>
          🔍
        </span>
        <input
          type="search"
          aria-label="Buscar guías y paquetes"
          style={{
            width:'100%',
            border:`1.5px solid ${C.border}`,
            borderRadius:13,
            padding:'11px 13px 11px 36px',
            fontSize:12,
            fontFamily:PP,
            outline:'none',
            background:'#fff',
            boxSizing:'border-box'
          }}
          placeholder="Buscar piso, permisos, trabajo, familia..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <PillFilters options={cats} value={cat} onChange={setCat} className="mb-4" />

      <section className="latido-guide-situations">
        <ResourcePackagesStrip
          tone="dark"
          packages={filteredPackages}
          heading="¿Cuál es tu situación?"
          headingAs="h2"
          showAllLink={false}
          className="latido-guide-packages"
        />
        {filteredPackages.length === 0 && <p className="latido-guide-catalog-status">No se encontraron paquetes con esa búsqueda.</p>}
      </section>

      <section aria-labelledby="individual-guides-title">
        <h2 id="individual-guides-title" className="latido-guide-catalog-heading">Guías individuales</h2>

        {!isLoggedIn && (
          <div style={{ background:'#EFF6FF', border:`1px solid ${C.primaryMid}`, borderRadius:16, padding:'14px 16px', margin:'0 0 16px', display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap' }}>
            <div>
              <p style={{ fontFamily:PP, fontWeight:700, fontSize:12, color:C.primaryDark, margin:'0 0 4px' }}>
                Información práctica para empezar
              </p>
              <p style={{ fontFamily:PP, fontSize:11, color:C.mid, margin:0, lineHeight:1.6 }}>
                Crea una cuenta gratuita para guardar contenido, publicar y acceder a toda la experiencia de la app.
              </p>
            </div>
            <Link to="/auth" style={{ fontFamily:PP, fontWeight:700, fontSize:12, background:C.primary, color:'#fff', textDecoration:'none', borderRadius:12, padding:'11px 16px', whiteSpace:'nowrap' }}>
              Crear cuenta gratis
            </Link>
          </div>
        )}

        <PartnerServicesPromo
          placement="guides"
          variant="contextual"
          serviceId={partnerService?.id}
          title={partnerService ? '' : '¿No encuentras la guía que necesitas?'}
          description="Consulta a nuestro colaborador Punto Hispano para recibir orientación y acceder a servicios especializados."
        />

        <div className="latido-guide-catalog-grid">
          {filtered.map((doc) => (
            <Card key={doc.id} onClick={() => openGuide(doc)} padding="none" style={{ overflow:'hidden' }}>
              <div style={{ position:'relative', height:150, background:C.bg }}>
                {doc.img ? (
                  <img src={doc.img} alt={doc.title} loading="lazy" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
                ) : (
                  <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:44 }}>
                    {doc.emoji}
                  </div>
                )}
                <span style={{ position:'absolute', left:12, bottom:12, width:38, height:38, borderRadius:13, background:'rgba(255,255,255,0.92)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, boxShadow:'0 8px 22px rgba(15,23,42,0.18)' }}>
                  {doc.emoji}
                </span>
                <div style={{ position:'absolute', right:12, top:12 }}>
                  <Tag
                    bg={doc.level === 'Básico' ? '#D1FAE5' : '#FEF3C7'}
                    color={doc.level === 'Básico' ? '#065F46' : '#92400E'}
                  >
                    {doc.level}
                  </Tag>
                </div>
              </div>

              <div style={{ padding:16 }}>
                <h3 style={{ fontFamily:PP, fontWeight:700, fontSize:14, color:C.text, marginBottom:6, lineHeight:1.4 }}>
                  {doc.title}
                </h3>

                <p style={{ fontFamily:PP, fontSize:12, color:C.mid, lineHeight:1.6, marginBottom:12 }}>
                  {doc.summary}
                </p>

                <div
                  style={{
                    display:'flex',
                    justifyContent:'space-between',
                    alignItems:'center',
                    borderTop:`1px solid ${C.border}`,
                    paddingTop:10
                  }}
                >
                  <span style={{ fontFamily:PP, fontSize:10, color:C.light }}>⏱ {doc.time}<br /><time dateTime={doc.reviewedAt}>Revisada {formatGuideReviewDate(doc.reviewedAt)}</time></span>
                  <Link
                    to={getGuidePath(doc)}
                    onClick={e => e.stopPropagation()}
                    style={{ fontFamily:PP, fontSize:12, fontWeight:700, color:C.primary, textDecoration:'none' }}
                  >
                    Leer →
                  </Link>
                </div>
              </div>
            </Card>
          ))}

          {filtered.length === 0 && (
            <div
              style={{
                gridColumn:'1 / -1',
                border:`1px solid ${C.border}`,
                borderRadius:20,
                padding:24,
                background:'#fff',
                textAlign:'center'
              }}
            >
              <p style={{ fontFamily:PP, fontSize:13, color:C.mid, margin:0 }}>
                No se encontraron guías con esa búsqueda.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
