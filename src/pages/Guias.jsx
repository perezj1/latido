import { useState } from 'react'
import { MOCK_DOCS } from '../lib/constants'
import { C, PP } from '../lib/theme'
import { Card, Tag, Modal, Btn, InfoBanner, PillFilters } from '../components/UI'

export default function Guias() {
  const [cat, setCat] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)

  const cats = [
    { id:'', label:'Todos' },
    { id:'permisos', label:'📄 Permisos' },
    { id:'impuestos', label:'🧾 Impuestos' },
    { id:'salud', label:'🏥 Salud' },
    { id:'banco', label:'🏦 Banco' },
    { id:'educacion', label:'🎓 Educación' },
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

  return (
    <div style={{ maxWidth:1000, margin:'0 auto', padding:'32px 24px 100px' }}>
      <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:26, color:C.text, marginBottom:6, letterSpacing:-0.5 }}>
        📚 Guías para vivir en Suiza
      </h1>

      <p style={{ fontFamily:PP, fontSize:13, color:C.light, marginBottom:18 }}>
        Trámites, seguros, bancos y derechos — en español
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
          placeholder="Buscar guía, trámite o palabra clave..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <PillFilters options={cats} value={cat} onChange={setCat} className="mb-4" />

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:12 }}>
        {filtered.map((doc) => (
          <Card key={doc.id} onClick={() => setSelected(doc)}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
              <span style={{ fontSize:32 }}>{doc.emoji}</span>
              <Tag
                bg={doc.level === 'Básico' ? '#D1FAE5' : '#FEF3C7'}
                color={doc.level === 'Básico' ? '#065F46' : '#92400E'}
              >
                {doc.level}
              </Tag>
            </div>

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
              <span style={{ fontFamily:PP, fontSize:12, fontWeight:700, color:C.primary }}>Leer →</span>
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

      <Modal show={!!selected} onClose={() => setSelected(null)} title={selected?.title || ''}>
        {selected && (
          <>
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

            <Btn onClick={() => setSelected(null)}>Entendido</Btn>
          </>
        )}
      </Modal>
    </div>
  )
}