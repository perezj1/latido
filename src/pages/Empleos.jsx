import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { MOCK_JOBS, CANTONS } from '../lib/constants'
import { C, PP } from '../lib/theme'
import { Tag, Btn, Modal, PillFilters } from '../components/UI'

export default function Empleos() {
  const [jobs, setJobs] = useState([])
  const [type, setType] = useState('')
  const [selected, setSelected] = useState(null)
  const typeOpts = [{id:'',label:'Todos'},{id:'Full-time',label:'Full-time'},{id:'Part-time',label:'Part-time'}]
  useEffect(() => {
    supabase.from('jobs').select('*').eq('active',true).order('created_at',{ascending:false})
      .then(({data,error})=>{ setJobs(error||!data?.length ? MOCK_JOBS : data) })
      .catch(()=>setJobs(MOCK_JOBS))
  },[])
  const filtered = jobs.filter(j => !type || j.type===type)
  return (
    <div style={{ maxWidth:900, margin:'0 auto', padding:'32px 24px 100px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
        <div>
          <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:26, color:C.text, letterSpacing:-0.5, marginBottom:4 }}>💼 Empleos para latinos</h1>
          <p style={{ fontFamily:PP, fontSize:13, color:C.light }}>Trabajo en empresas y familias que valoran tu idioma y cultura</p>
        </div>
        <a href="mailto:hola@latido.ch?subject=Quiero publicar empleo" style={{ fontFamily:PP, fontWeight:700, fontSize:12, background:C.primary, color:'#fff', textDecoration:'none', borderRadius:13, padding:'11px 16px', flexShrink:0 }}>+ Publicar oferta</a>
      </div>
      <PillFilters options={typeOpts} value={type} onChange={setType} className="mb-4" />
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {filtered.map(j => (
          <div key={j.id} style={{ background:'#fff', borderRadius:14, border:`1px solid ${C.border}`, padding:'15px 17px', display:'flex', alignItems:'center', gap:14, cursor:'pointer', transition:'all .15s' }}
            onClick={() => setSelected(j)}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=C.primaryMid;e.currentTarget.style.boxShadow=`0 4px 16px rgba(37,99,235,0.08)`}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.boxShadow='none'}}>
            <div style={{ width:52, height:52, background:C.primaryLight, borderRadius:16, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0 }}>{j.emoji}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3, flexWrap:'wrap' }}>
                <h3 style={{ fontFamily:PP, fontWeight:700, fontSize:15, color:C.text, margin:0 }}>{j.title}</h3>
                <Tag bg={j.type==='Full-time'?C.primaryLight:'#D1FAE5'} color={j.type==='Full-time'?C.primary:'#065F46'}>{j.type}</Tag>
              </div>
              <p style={{ fontFamily:PP, fontSize:12, color:C.light, margin:0 }}>{j.company} · 📍 {j.city}</p>
              <p style={{ fontFamily:PP, fontSize:13, fontWeight:700, color:'#059669', margin:'4px 0 0' }}>{j.salary}</p>
            </div>
            <span style={{ fontFamily:PP, fontSize:13, fontWeight:700, color:C.primary, flexShrink:0 }}>Ver →</span>
          </div>
        ))}
      </div>
      <Modal show={!!selected} onClose={()=>setSelected(null)} title={selected?.title||''}>
        {selected && <>
          <div className="grid-2" style={{ gap:10, marginBottom:16 }}>
            {[['📍 Ciudad',selected.city],['💰 Salario',selected.salary],['⏰ Tipo',selected.type],['🗣️ Idioma',selected.lang]].map(([k,v])=>v&&(
              <div key={k} style={{ background:C.bg, borderRadius:12, padding:'10px 12px' }}>
                <p style={{ fontFamily:PP, fontSize:10, color:C.light, margin:'0 0 2px' }}>{k}</p>
                <p style={{ fontFamily:PP, fontSize:13, fontWeight:700, color:C.text, margin:0 }}>{v}</p>
              </div>
            ))}
          </div>
          <Btn onClick={()=>setSelected(null)}>📩 Contactar empresa</Btn>
        </>}
      </Modal>
    </div>
  )
}
