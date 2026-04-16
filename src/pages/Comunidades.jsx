import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { MOCK_COMMUNITIES, COMMUNITY_CATS } from '../lib/constants'
import { C, PP } from '../lib/theme'
import { Card, Tag, PillFilters, EmptyState } from '../components/UI'

export default function Comunidades() {
  const [communities, setCommunities] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState('')

  useEffect(() => {
    supabase.from('communities').select('*').eq('active', true).order('members', {ascending:false})
      .then(({data,error}) => { setCommunities(error||!data?.length ? MOCK_COMMUNITIES : data); setLoading(false) })
      .catch(() => { setCommunities(MOCK_COMMUNITIES); setLoading(false) })
  }, [])

  const catOptions = [{id:'',label:'Todas'}, ...COMMUNITY_CATS.map(c=>({id:c.id,label:`${c.emoji} ${c.label}`}))]
  const filtered = communities.filter(c => (!cat||c.cat===cat) && (!search||c.name.toLowerCase().includes(search.toLowerCase())))

  return (
    <div style={{ maxWidth:1000, margin:'0 auto', padding:'32px 24px 100px' }}>
      <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:26, color:C.text, marginBottom:6, letterSpacing:-0.5 }}>🤝 Comunidades en Suiza</h1>
      <p style={{ fontFamily:PP, fontSize:13, color:C.light, marginBottom:20 }}>Grupos activos de latinos organizados por ciudad, país, afición e interés</p>
      <div style={{ position:'relative', marginBottom:12 }}>
        <span style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', color:C.light }}>🔍</span>
        <input style={{ width:'100%', border:`1.5px solid ${C.border}`, borderRadius:13, padding:'11px 13px 11px 36px', fontSize:12, fontFamily:PP, outline:'none', background:'#fff', boxSizing:'border-box' }} placeholder="Buscar comunidad..." value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>
      <PillFilters options={catOptions} value={cat} onChange={setCat} className="mb-4" />
      {loading ? <div className="skeleton" style={{height:200,borderRadius:20}}/> : filtered.length===0 ? <EmptyState emoji="😕" title="Sin resultados" action="Ver todas" onAction={()=>{setCat('');setSearch('')}}/> : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:12 }}>
          {filtered.map(c => (
            <Card key={c.id}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                <span style={{ fontSize:36 }}>{c.emoji}</span>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
                  {c.verified && <Tag bg="#D1FAE5" color="#065F46">✓ Verificado</Tag>}
                  <span style={{ fontFamily:PP, fontSize:10, color:C.light }}>📍 {c.city}</span>
                </div>
              </div>
              <h3 style={{ fontFamily:PP, fontWeight:700, fontSize:15, color:C.text, marginBottom:5, lineHeight:1.3 }}>{c.name}</h3>
              <p style={{ fontFamily:PP, fontSize:11, color:C.light, marginBottom:8 }}>👥 {c.members} miembros</p>
              <p style={{ fontFamily:PP, fontSize:12, color:C.mid, lineHeight:1.6, marginBottom:14 }}>{c.desc}</p>
              <a href={c.contact} target="_blank" rel="noreferrer" style={{ fontFamily:PP, fontWeight:700, fontSize:12, background:C.primary, color:'#fff', textDecoration:'none', padding:'10px 0', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                {c.contact?.includes('t.me')?'📲 Telegram':'💬 WhatsApp'}
              </a>
            </Card>
          ))}
        </div>
      )}
      <div style={{ marginTop:28, border:`2px dashed ${C.border}`, borderRadius:20, padding:24, textAlign:'center', background:C.primaryLight }}>
        <h3 style={{ fontFamily:PP, fontWeight:700, fontSize:17, color:C.text, marginBottom:8 }}>➕ ¿Tienes una comunidad latina?</h3>
        <p style={{ fontFamily:PP, fontSize:12, color:C.mid, marginBottom:14 }}>Regístrala aquí y llega a más latinos en Suiza. Gratis.</p>
        <a href="mailto:hola@latinosuiza.ch?subject=Registrar comunidad" style={{ fontFamily:PP, fontWeight:700, fontSize:13, background:C.primary, color:'#fff', textDecoration:'none', padding:'12px 24px', borderRadius:14, display:'inline-flex' }}>Registrar comunidad</a>
      </div>
    </div>
  )
}
