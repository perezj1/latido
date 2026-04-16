import { useState } from 'react'
import { C, PP } from '../lib/theme'
import { MOCK_CAREGIVERS, MOCK_FAMILY_GROUPS } from '../lib/constants'
import { Card, Tag, Btn, SegmentedTabs, InfoBanner } from '../components/UI'

const TABS = [
  {id:'cuidadoras',label:'👩 Cuidadoras'},
  {id:'grupos',label:'🤝 Grupos'},
  {id:'recursos',label:'📚 Recursos'},
]

export default function Familias() {
  const [tab, setTab] = useState('cuidadoras')
  const RECURSOS = [
    {emoji:'🎓',title:'Guarderías (Kitas) en Suiza',desc:'Cómo acceder, costos y listas de espera.'},
    {emoji:'📝',title:'Reagrupación familiar',desc:'Requisitos y trámites para traer a tu familia.'},
    {emoji:'🏥',title:'Maternidad en Suiza',desc:'Baja laboral, derechos y ayudas económicas.'},
    {emoji:'🍼',title:'Kinderzulage (subsidio hijos)',desc:'Suiza paga CHF mensuales por cada hijo.'},
    {emoji:'🏫',title:'Escuelas bilingües español',desc:'Lista por cantón con programa bilingüe.'},
    {emoji:'⚖️',title:'Derechos del niño inmigrante',desc:'Tus hijos tienen derechos en Suiza.'},
  ]
  return (
    <div style={{ maxWidth:1000, margin:'0 auto', padding:'32px 24px 100px' }}>
      <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:26, color:C.text, marginBottom:6, letterSpacing:-0.5 }}>👨‍👩‍👧 Para familias latinas</h1>
      <p style={{ fontFamily:PP, fontSize:13, color:C.light, marginBottom:20 }}>Cuidadoras, grupos de madres, recursos y apoyo para familias en Suiza</p>
      <SegmentedTabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === 'cuidadoras' && (
        <>
          <InfoBanner emoji="ℹ️" title="Cuidadoras de la comunidad" text="Verifica siempre referencias antes de contratar. Las marcadas con ✓ han sido revisadas." bg={C.primaryLight} border={C.primaryMid} color={C.primaryDark} />
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:12 }}>
            {MOCK_CAREGIVERS.map(c => (
              <Card key={c.id}>
                <div style={{ display:'flex', gap:14, alignItems:'flex-start', marginBottom:12 }}>
                  <div style={{ width:52, height:52, background:C.primaryMid, borderRadius:16, display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, flexShrink:0 }}>{c.emoji}</div>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ fontFamily:PP, fontWeight:700, fontSize:15, color:C.text }}>{c.name}</span>
                      {c.verified && <Tag bg="#D1FAE5" color="#065F46">✓</Tag>}
                    </div>
                    <p style={{ fontFamily:PP, fontSize:11, color:C.light, margin:'2px 0 0' }}>{c.type} · 📍 {c.city}</p>
                  </div>
                </div>
                <p style={{ fontFamily:PP, fontSize:12, color:C.mid, lineHeight:1.6, marginBottom:12 }}>{c.desc}</p>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
                  {[['Edades',c.ages,'#DBEAFE','#1D4ED8'],['Precio',c.price,'#D1FAE5','#065F46']].map(([k,v,bg,tc])=>(
                    <div key={k} style={{ background:bg, borderRadius:12, padding:'8px 10px' }}>
                      <div style={{ fontFamily:PP, fontSize:9, color:C.mid, marginBottom:2 }}>{k}</div>
                      <div style={{ fontFamily:PP, fontSize:13, fontWeight:700, color:tc }}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:12 }}>
                  {c.langs?.map(l => <Tag key={l}>{l}</Tag>)}
                </div>
                <Btn>Contactar</Btn>
              </Card>
            ))}
          </div>
        </>
      )}
      {tab === 'grupos' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:12 }}>
          {MOCK_FAMILY_GROUPS.map(g => (
            <Card key={g.id}>
              <div style={{ display:'flex', gap:14, alignItems:'center', marginBottom:10 }}>
                <span style={{ fontSize:36 }}>{g.emoji}</span>
                <div>
                  <h3 style={{ fontFamily:PP, fontWeight:700, fontSize:15, color:C.text, lineHeight:1.3 }}>{g.name}</h3>
                  <p style={{ fontFamily:PP, fontSize:11, color:C.light }}>📍 {g.city} · 👥 {g.members}</p>
                </div>
              </div>
              <p style={{ fontFamily:PP, fontSize:12, color:C.mid, lineHeight:1.6, marginBottom:14 }}>{g.desc}</p>
              <a href={g.contact} target="_blank" rel="noreferrer" style={{ fontFamily:PP, fontWeight:700, fontSize:12, background:C.primary, color:'#fff', textDecoration:'none', padding:'11px 0', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                {g.contact?.includes('t.me')?'📲 Telegram':'💬 WhatsApp'}
              </a>
            </Card>
          ))}
        </div>
      )}
      {tab === 'recursos' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(250px,1fr))', gap:12 }}>
          {RECURSOS.map(r => (
            <Card key={r.title}>
              <span style={{ fontSize:32, display:'block', marginBottom:10 }}>{r.emoji}</span>
              <h3 style={{ fontFamily:PP, fontWeight:700, fontSize:14, color:C.text, marginBottom:6 }}>{r.title}</h3>
              <p style={{ fontFamily:PP, fontSize:12, color:C.mid, lineHeight:1.6 }}>{r.desc}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
