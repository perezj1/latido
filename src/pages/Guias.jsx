import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { MOCK_DOCS } from '../lib/constants'
import { getGuideById, getGuideBySlug, getGuidePath } from '../lib/seo'
import { C, PP } from '../lib/theme'
import { Card, Tag, Modal, Btn, InfoBanner, PillFilters } from '../components/UI'
import PartnerServicesPromo, { getPartnerServiceMatch } from '../components/PartnerServicesPromo'

export default function Guias() {
  const { isLoggedIn } = useAuth()
  const navigate = useNavigate()
  const { guideSlug } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const [cat, setCat] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const openGuideId = searchParams.get('openGuide') || ''
  const routeGuide = guideSlug ? getGuideBySlug(guideSlug) : null
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

  const filtered = MOCK_DOCS.filter((d) => {
    const matchesCat = !cat || d.cat === cat

    const q = search.trim().toLowerCase()
    const matchesSearch =
      !q ||
      d.title.toLowerCase().includes(q) ||
      d.summary.toLowerCase().includes(q) ||
      d.content.toLowerCase().includes(q) ||
      d.time.toLowerCase().includes(q)

    return matchesCat && matchesSearch
  })

  useEffect(() => {
    if (routeGuide) {
      setSelected(routeGuide)
      return
    }

    if (!openGuideId) {
      setSelected(null)
      return
    }

    const doc = getGuideById(openGuideId)
    if (doc) setSelected(doc)
  }, [openGuideId, routeGuide])

  const openGuide = doc => {
    navigate(getGuidePath(doc))
  }

  const closeGuide = () => {
    setSelected(null)

    if (routeGuide) {
      navigate('/guias', { replace:true })
      return
    }

    if (!openGuideId) return

    const next = new URLSearchParams(searchParams)
    next.delete('openGuide')
    setSearchParams(next, { replace:true })
  }

  return (
    <div style={{ maxWidth:1000, margin:'0 auto', padding:'32px 24px 100px' }}>
      <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:26, color:C.text, marginBottom:6, letterSpacing:0 }}>
        📚 Guías
      </h1>

      <p style={{ fontFamily:PP, fontSize:13, color:C.light, marginBottom:18 }}>
        Permisos, trabajo, vivienda, salud y dinero explicados en español.
      </p>

      <div style={{ position:'relative', marginBottom:12 }}>
        <span style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', color:C.light }}>
          🔍
        </span>
        <input
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
          placeholder="Buscar permiso, seguro, banco, trabajo o vivienda..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <PillFilters options={cats} value={cat} onChange={setCat} className="mb-4" />

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
        description="Consulta a nuestro colaborador Suiza en Español para recibir orientación y acceder a servicios especializados."
      />

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:12 }}>
        {filtered.map((doc) => (
          <Card key={doc.id} onClick={() => openGuide(doc)} style={{ padding:0, overflow:'hidden' }}>
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
                <span style={{ fontFamily:PP, fontSize:11, color:C.light }}>⏱ {doc.time}</span>
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

      <Modal show={!!selected} onClose={closeGuide} title={selected?.title || ''} syncHistory={false}>
        {selected && (
          <>
            {selected.img && (
              <img
                src={selected.img}
                alt={selected.title}
                style={{ width:'100%', height:210, objectFit:'cover', borderRadius:18, marginBottom:14, display:'block' }}
              />
            )}

            <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:14 }}>
              <Tag
                bg={selected.level === 'Básico' ? '#D1FAE5' : '#FEF3C7'}
                color={selected.level === 'Básico' ? '#065F46' : '#92400E'}
              >
                {selected.level}
              </Tag>
              <Tag bg={C.primaryLight} color={C.primary}>⏱ {selected.time}</Tag>
            </div>

            <div
              style={{
                fontFamily:PP,
                fontSize:13,
                lineHeight:1.9,
                color:C.mid,
                whiteSpace:'pre-line',
                marginBottom:16
              }}
            >
              {selected.content}
            </div>

            <InfoBanner
              emoji="⚠️"
              title="Aviso"
              text="Esta guía es orientativa. Para casos específicos consulta la administración cantonal o un asesor certificado."
            />

            <Btn onClick={closeGuide}>Entendido</Btn>
          </>
        )}
      </Modal>
    </div>
  )
}
