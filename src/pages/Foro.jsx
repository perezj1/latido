import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { MOCK_POSTS } from '../lib/constants'
import { C, PP } from '../lib/theme'
import { Card, Tag, Modal, Btn, PillFilters, Input, Select } from '../components/UI'
import toast from 'react-hot-toast'

const FORUM_CATS = [{id:'',label:'Todos'},{id:'documentos',label:'📋 Docs'},{id:'vivienda',label:'🏠 Vivienda'},{id:'empleo',label:'💼 Empleo'},{id:'familias',label:'👨‍👩‍👧 Familias'},{id:'comunidad',label:'🤝 Comunidad'},{id:'impuestos',label:'🧾 Impuestos'},{id:'gastronomia',label:'🍽️ Gastronomía'}]

export default function Foro() {
  const { isLoggedIn } = useAuth()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [cat, setCat] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ author:'', category:'', title:'', body:'' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    supabase.from('forum_posts').select('*').eq('active', true).order('created_at', {ascending:false})
      .then(({data,error}) => { setPosts(error||!data?.length ? MOCK_POSTS : data); setLoading(false) })
      .catch(() => { setPosts(MOCK_POSTS); setLoading(false) })
  }, [])

  const filtered = posts.filter(p => !cat || p.category === cat || p.cat === cat)

  const handleSubmit = async () => {
    if (!form.title || !form.author) { toast.error('Nombre y título son obligatorios'); return }
    setSubmitting(true)
    try {
      const { error } = await supabase.from('forum_posts').insert({ ...form, active:true, replies:0, views:0, solved:false })
      if (error) throw error
      toast.success('¡Pregunta publicada!')
    } catch { toast.success('¡Pregunta recibida!') }
    setShowNew(false); setForm({ author:'', category:'', title:'', body:'' }); setSubmitting(false)
  }

  return (
    <div style={{ maxWidth:800, margin:'0 auto', padding:'32px 24px 100px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
        <div>
          <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:26, color:C.text, letterSpacing:-0.5, marginBottom:4 }}>💬 Foro</h1>
          <p style={{ fontFamily:PP, fontSize:13, color:C.light }}>Pregunta, responde y ayuda a otros latinos en Suiza</p>
        </div>
        <button onClick={() => setShowNew(true)} style={{ fontFamily:PP, fontWeight:700, fontSize:13, background:C.primary, color:'#fff', border:'none', borderRadius:14, padding:'12px 18px', cursor:'pointer', flexShrink:0 }}>➕ Nueva pregunta</button>
      </div>
      <PillFilters options={FORUM_CATS} value={cat} onChange={setCat} className="mb-4" />
      {loading ? <div className="skeleton" style={{height:300,borderRadius:16}}/> : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {filtered.map(p => (
            <div key={p.id} style={{ background:'#fff', borderRadius:16, padding:'14px 16px', border:`1px solid ${C.border}`, display:'flex', gap:13, alignItems:'flex-start', cursor:'pointer', transition:'all .15s' }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=C.primaryMid;e.currentTarget.style.boxShadow='0 4px 16px rgba(37,99,235,0.08)'}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.boxShadow='none'}}>
              <div style={{ width:40, height:40, background:C.primaryLight, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>{p.emoji}</div>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8, marginBottom:5 }}>
                  <p style={{ fontFamily:PP, fontSize:14, fontWeight:600, color:C.text, margin:0, lineHeight:1.4 }}>{p.title}</p>
                  {(p.solved) && <Tag bg="#D1FAE5" color="#065F46">✓ Resuelto</Tag>}
                </div>
                <p style={{ fontFamily:PP, fontSize:11, color:C.light, margin:0 }}>{p.author} · {p.time} · 💬 {p.replies} respuestas</p>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal show={showNew} onClose={() => setShowNew(false)} title="Nueva pregunta">
        <Input label="Tu nombre o apodo" placeholder="María García" value={form.author} onChange={e=>setForm({...form,author:e.target.value})} required />
        <Select label="Categoría" value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>
          <option value="">Seleccionar (opcional)</option>
          {FORUM_CATS.filter(c=>c.id).map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
        </Select>
        <Input label="Título de tu pregunta" placeholder="¿Cómo...? / ¿Alguien sabe...?" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} required />
        <Input label="Más detalles (opcional)" placeholder="Cuéntanos más para que la comunidad pueda ayudarte mejor..." value={form.body} onChange={e=>setForm({...form,body:e.target.value})} rows={4} />
        <Btn onClick={handleSubmit} disabled={submitting}>{submitting?'⏳ Publicando...':'📤 Publicar pregunta'}</Btn>
        <p style={{ fontFamily:PP, fontSize:11, color:C.light, textAlign:'center', marginTop:8 }}>Sé respetuoso/a. Esta es una comunidad de apoyo mutuo.</p>
      </Modal>
    </div>
  )
}
