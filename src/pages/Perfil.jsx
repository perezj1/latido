import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { C, PP } from '../lib/theme'
import { Avatar, Btn, EmptyState, InfoBanner, Input, Modal, Select, Sheet, Tag } from '../components/UI'
import { AD_CATS, AD_TYPES, CANTONS, COMMUNITY_CATS, EVENTO_TYPES, NEGOCIO_TYPES } from '../lib/constants'
import toast from 'react-hot-toast'

const PUBLICATION_TABS = [
  { id:'all', label:'Todo' },
  { id:'ad', label:'📌 Tablón' },
  { id:'job', label:'💼 Empleos' },
  { id:'event', label:'🎉 Eventos' },
  { id:'business', label:'🏪 Negocios' },
  { id:'community', label:'🤝 Comunidades' },
]

const JOB_TYPES = ['Full-time', 'Part-time', 'Freelance', 'Prácticas']

const COMMUNITY_OPTIONS = COMMUNITY_CATS
  .filter(item => item.id !== 'fe')
  .map(item => item.id === 'mamas'
    ? { ...item, id:'familia', emoji:'👨‍👩‍👧', label:'Familia' }
    : item)

function normalizeCommunityCategory(value='') {
  if (value === 'mamas') return 'familia'
  if (value === 'fe') return ''
  return value
}

const KIND_META = {
  ad: { label:'Anuncio', icon:'📌', table:'ads' },
  job: { label:'Empleo', icon:'💼', table:'jobs' },
  event: { label:'Evento', icon:'🎉', table:'events' },
  business: { label:'Negocio', icon:'🏪', table:'providers' },
  community: { label:'Comunidad', icon:'🤝', table:'communities' },
}

function splitList(value) {
  return value.split(',').map(item => item.trim()).filter(Boolean)
}

function formatDate(value) {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin fecha'
  return date.toLocaleDateString('es-ES', { day:'numeric', month:'short', year:'numeric' })
}

function normalizePublication(kind, row) {
  if (kind === 'ad') {
    const cat = AD_CATS.find(item => item.id === row.cat)
    const type = AD_TYPES.find(item => item.id === row.type)
    return {
      id: row.id,
      kind,
      icon: cat?.emoji || KIND_META[kind].icon,
      title: row.title,
      summary: `${type?.label || 'Anuncio'}${row.price ? ` · ${row.price}` : ''}`,
      meta: [row.canton, row.plz, row.privacy === 'private' ? 'Privado' : 'Público'].filter(Boolean).join(' · '),
      active: !!row.active,
      createdAt: row.created_at,
      raw: row,
    }
  }

  if (kind === 'job') {
    return {
      id: row.id,
      kind,
      icon: row.emoji || KIND_META[kind].icon,
      title: row.title,
      summary: [row.company, row.type].filter(Boolean).join(' · ') || 'Oferta de empleo',
      meta: [row.city || row.canton, row.salary].filter(Boolean).join(' · '),
      active: !!row.active,
      createdAt: row.created_at,
      raw: row,
    }
  }

  if (kind === 'event') {
    const type = EVENTO_TYPES.find(item => item.id === row.type)
    return {
      id: row.id,
      kind,
      icon: row.emoji || type?.label?.split(' ')[0] || KIND_META[kind].icon,
      title: row.title,
      summary: [type?.label?.replace(/^[^\s]+\s/, ''), row.venue].filter(Boolean).join(' · ') || 'Evento',
      meta: [row.city || row.canton, [row.day, row.month, row.time].filter(Boolean).join(' ')].filter(Boolean).join(' · '),
      active: !!row.active,
      createdAt: row.created_at,
      raw: row,
    }
  }

  if (kind === 'business') {
    const type = NEGOCIO_TYPES.find(item => item.id === row.category)
    return {
      id: row.id,
      kind,
      icon: type?.label?.split(' ')[0] || KIND_META[kind].icon,
      title: row.name,
      summary: [type?.label?.replace(/^[^\s]+\s/, ''), row.city || row.canton].filter(Boolean).join(' · ') || 'Negocio',
      meta: [row.featured ? 'Destacado' : null, row.verified ? 'Verificado' : null].filter(Boolean).join(' · '),
      active: !!row.active,
      createdAt: row.created_at,
      raw: row,
    }
  }

  const category = COMMUNITY_OPTIONS.find(item => item.id === normalizeCommunityCategory(row.cat))
  return {
    id: row.id,
    kind,
    icon: row.emoji || category?.emoji || KIND_META[kind].icon,
    title: (row.name || '').replace(/Mam[aá]s Latinas/gi, 'Familias Latinas'),
    summary: [category?.label, row.city].filter(Boolean).join(' · ') || 'Comunidad',
    meta: row.contact || '',
    active: !!row.active,
    createdAt: row.created_at,
    raw: row,
  }
}

function buildEditorForm(item) {
  const row = item.raw

  if (item.kind === 'ad') {
    return {
      cat: normalizeCommunityCategory(row.cat) || '',
      sub: row.sub || '',
      type: row.type || '',
      title: row.title || '',
      desc: row.desc || '',
      price: row.price || '',
      canton: row.canton || '',
      plz: row.plz || '',
      privacy: row.privacy || 'public',
      contactPhone: row.contact_phone || '',
      contactEmail: row.contact_email || '',
    }
  }

  if (item.kind === 'job') {
    return {
      sector: row.sector || row.category || '',
      title: row.title || '',
      company: row.company || '',
      type: row.type || '',
      city: row.city || '',
      canton: row.canton || '',
      salary: row.salary || '',
      langs: Array.isArray(row.languages) ? row.languages.join(', ') : (row.lang || ''),
      desc: row.desc || '',
      contactPhone: row.contact_phone || '',
      contactEmail: row.contact_email || '',
      contactLink: row.contact_link || '',
    }
  }

  if (item.kind === 'event') {
    return {
      type: row.type || '',
      title: row.title || '',
      day: row.day || '',
      month: row.month || '',
      year: row.year || '',
      time: row.time || '',
      price: row.price || '',
      city: row.city || '',
      canton: row.canton || '',
      venue: row.venue || '',
      desc: row.desc || '',
      host: row.host || '',
      link: row.link || '',
    }
  }

  if (item.kind === 'business') {
    return {
      category: row.category || '',
      name: row.name || '',
      city: row.city || '',
      canton: row.canton || '',
      description: row.description || '',
      whatsapp: row.whatsapp || '',
      email: row.email || '',
      instagram: row.instagram || '',
      website: row.website || '',
      services: Array.isArray(row.services) ? row.services.join(', ') : '',
    }
  }

  return {
    cat: row.cat || '',
    name: row.name || '',
    city: row.city || '',
    desc: row.desc || '',
    contact: row.contact || '',
  }
}

export default function Perfil() {
  const { isLoggedIn, displayName, userCanton, user, signOut } = useAuth()
  const navigate = useNavigate()
  const [manageOpen, setManageOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('all')
  const [publications, setPublications] = useState([])
  const [loadingPublications, setLoadingPublications] = useState(false)
  const [issues, setIssues] = useState([])
  const [deletingKey, setDeletingKey] = useState('')
  const [editorItem, setEditorItem] = useState(null)
  const [editorForm, setEditorForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [actionItem, setActionItem] = useState(null)

  const loadPublications = async () => {
    if (!user?.id) return

    setLoadingPublications(true)

    try {
      const results = await Promise.allSettled([
        supabase.from('ads').select('*').eq('user_id', user.id).order('created_at', { ascending:false }),
        supabase.from('jobs').select('*').eq('user_id', user.id).order('created_at', { ascending:false }),
        supabase.from('events').select('*').eq('user_id', user.id).order('created_at', { ascending:false }),
        supabase.from('providers').select('*').eq('user_id', user.id).order('created_at', { ascending:false }),
        supabase.from('communities').select('*').eq('user_id', user.id).order('created_at', { ascending:false }),
      ])

      const nextIssues = []
      const nextPublications = []
      const mapping = [
        { kind:'ad', result:results[0], issue:'anuncios' },
        { kind:'job', result:results[1], issue:'empleos' },
        { kind:'event', result:results[2], issue:'eventos' },
        { kind:'business', result:results[3], issue:'negocios' },
        { kind:'community', result:results[4], issue:'comunidades' },
      ]

      mapping.forEach(({ kind, result, issue }) => {
        if (result.status === 'rejected') {
          nextIssues.push(`No se pudieron cargar tus ${issue}.`)
          return
        }

        if (result.value.error) {
          nextIssues.push(`Falta ajustar Supabase para ${issue}. Ejecuta publications_schema_v4.sql.`)
          return
        }

        ;(result.value.data || []).forEach(row => nextPublications.push(normalizePublication(kind, row)))
      })

      nextPublications.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      setPublications(nextPublications)
      setIssues(nextIssues)
    } finally {
      setLoadingPublications(false)
    }
  }

  useEffect(() => {
    if (!isLoggedIn || !user?.id) return
    loadPublications()
  }, [isLoggedIn, user?.id])

  const counts = useMemo(() => {
    const total = publications.length
    const active = publications.filter(item => item.active).length
    const inactive = total - active
    return { total, active, inactive }
  }, [publications])

  const filteredPublications = useMemo(() => {
    if (activeTab === 'all') return publications
    return publications.filter(item => item.kind === activeTab)
  }, [activeTab, publications])

  const activeFilter = PUBLICATION_TABS.find(item => item.id === activeTab)

  const handleSignOut = async () => {
    await signOut()
    toast.success('Sesión cerrada')
    navigate('/')
  }

  const openEditor = item => {
    setEditorItem(item)
    setEditorForm(buildEditorForm(item))
  }

  const closeEditor = () => {
    setEditorItem(null)
    setEditorForm({})
    setSaving(false)
  }

  const updateEditorField = (key, value) => {
    setEditorForm(prev => ({ ...prev, [key]: value }))
  }

  const handleDeletePublication = async item => {
    const confirmed = window.confirm(`¿Seguro que quieres borrar esta publicación?\n\n${item.title}`)
    if (!confirmed) return

    const table = KIND_META[item.kind].table
    const deleteKey = `${item.kind}-${item.id}`
    setDeletingKey(deleteKey)

    try {
      const { error } = await supabase.from(table).delete().eq('id', item.id).eq('user_id', user.id)
      if (error) throw error
      setPublications(prev => prev.filter(entry => !(entry.kind === item.kind && entry.id === item.id)))
      if (editorItem?.kind === item.kind && editorItem?.id === item.id) closeEditor()
      if (actionItem?.kind === item.kind && actionItem?.id === item.id) setActionItem(null)
      toast.success(`${KIND_META[item.kind].label} eliminada`)
    } catch (error) {
      toast.error(error?.message || 'No se pudo eliminar la publicación')
    } finally {
      setDeletingKey('')
    }
  }

  const handleSavePublication = async () => {
    if (!editorItem) return

    const item = editorItem
    const table = KIND_META[item.kind].table
    let payload = {}

    if (item.kind === 'ad') {
      payload = {
        cat: editorForm.cat || null,
        sub: editorForm.sub?.trim() || null,
        type: editorForm.type || null,
        title: editorForm.title?.trim(),
        desc: editorForm.desc?.trim() || null,
        price: editorForm.price?.trim() || null,
        canton: editorForm.canton || null,
        plz: editorForm.plz?.trim() || null,
        privacy: editorForm.privacy || 'public',
        contact_phone: editorForm.contactPhone?.trim() || null,
        contact_email: editorForm.contactEmail?.trim() || null,
        updated_at: new Date().toISOString(),
      }
      if (!payload.title || !payload.type) {
        toast.error('Completa al menos el título y el tipo del anuncio')
        return
      }
    }

    if (item.kind === 'job') {
      const languages = splitList(editorForm.langs || '')
      payload = {
        sector: editorForm.sector?.trim() || null,
        category: editorForm.sector?.trim() || null,
        title: editorForm.title?.trim(),
        company: editorForm.company?.trim() || null,
        type: editorForm.type || null,
        city: editorForm.city?.trim() || null,
        canton: editorForm.canton || null,
        salary: editorForm.salary?.trim() || null,
        lang: languages.length ? languages.join(' · ') : null,
        languages: languages.length ? languages : null,
        desc: editorForm.desc?.trim() || null,
        contact_phone: editorForm.contactPhone?.trim() || null,
        contact_email: editorForm.contactEmail?.trim() || null,
        contact_link: editorForm.contactLink?.trim() || null,
        contact: editorForm.contactEmail?.trim() || editorForm.contactLink?.trim() || null,
        updated_at: new Date().toISOString(),
      }
      if (!payload.title || !payload.canton) {
        toast.error('Completa al menos el título y el cantón del empleo')
        return
      }
    }

    if (item.kind === 'event') {
      payload = {
        type: editorForm.type || null,
        title: editorForm.title?.trim(),
        day: editorForm.day?.trim() || null,
        month: editorForm.month?.trim() || null,
        year: editorForm.year?.trim() || null,
        time: editorForm.time?.trim() || null,
        price: editorForm.price?.trim() || null,
        city: editorForm.city?.trim() || null,
        canton: editorForm.canton || null,
        venue: editorForm.venue?.trim() || null,
        desc: editorForm.desc?.trim() || null,
        host: editorForm.host?.trim() || null,
        link: editorForm.link?.trim() || null,
        updated_at: new Date().toISOString(),
      }
      if (!payload.title || !payload.canton) {
        toast.error('Completa al menos el título y el cantón del evento')
        return
      }
    }

    if (item.kind === 'business') {
      const services = splitList(editorForm.services || '')
      payload = {
        category: editorForm.category || null,
        name: editorForm.name?.trim(),
        city: editorForm.city?.trim() || null,
        canton: editorForm.canton || null,
        description: editorForm.description?.trim() || null,
        whatsapp: editorForm.whatsapp?.trim() || null,
        email: editorForm.email?.trim() || null,
        instagram: editorForm.instagram?.trim() || null,
        website: editorForm.website?.trim() || null,
        services: services.length ? services : null,
        updated_at: new Date().toISOString(),
      }
      if (!payload.name || !payload.canton) {
        toast.error('Completa al menos el nombre y el cantón del negocio')
        return
      }
      if (![payload.whatsapp, payload.email, payload.instagram].some(Boolean)) {
        toast.error('Añade al menos un método de contacto para el negocio')
        return
      }
    }

    if (item.kind === 'community') {
      const category = COMMUNITY_OPTIONS.find(entry => entry.id === normalizeCommunityCategory(editorForm.cat))
      payload = {
        cat: editorForm.cat || null,
        name: editorForm.name?.trim(),
        city: editorForm.city?.trim() || null,
        desc: editorForm.desc?.trim() || null,
        contact: editorForm.contact?.trim() || null,
        emoji: category?.emoji || item.raw.emoji || '🤝',
        updated_at: new Date().toISOString(),
      }
      if (!payload.name || !payload.contact) {
        toast.error('Completa al menos el nombre y el enlace de la comunidad')
        return
      }
    }

    setSaving(true)
    try {
      const { error } = await supabase.from(table).update(payload).eq('id', item.id).eq('user_id', user.id)
      if (error) throw error
      await loadPublications()
      toast.success('Cambios guardados')
      closeEditor()
    } catch (error) {
      const message = String(error?.message || '')
      if (message.toLowerCase().includes('website')) {
        toast.error('Falta actualizar Supabase para negocios. Ejecuta publications_schema_v4.sql.')
      } else {
        toast.error(message || 'No se pudieron guardar los cambios')
      }
      setSaving(false)
    }
  }

  const menu = [
    { icon:'📌', label:'Mis publicaciones', sub:'Editar o borrar lo que ya has publicado', action:() => { setManageOpen(true); loadPublications() } },
    { icon:'🔖', label:'Guardados', sub:'Anuncios que has marcado para luego', disabled:true },
    { icon:'💬', label:'Mensajes', sub:'Conversaciones con otros usuarios', disabled:true },
    { icon:'🔔', label:'Alertas de zona', sub:'Nuevos anuncios en tu cantón y PLZ', disabled:true },
    { icon:'⚙️', label:'Configuración', sub:'Cantón, idiomas, contraseña, privacidad', disabled:true },
  ]

  if (!isLoggedIn) return (
    <div style={{ maxWidth:440, margin:'80px auto', padding:'0 24px', textAlign:'center' }}>
      <div style={{ fontSize:52, marginBottom:16 }}>👤</div>
      <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:22, color:C.text, marginBottom:10 }}>Tu perfil</h1>
      <p style={{ fontFamily:PP, fontSize:13, color:C.mid, marginBottom:24, lineHeight:1.7 }}>
        Inicia sesión para gestionar tus anuncios, mensajes y configuración.
      </p>
      <Btn onClick={() => navigate('/auth')}>Iniciar sesión</Btn>
      <button onClick={() => navigate('/auth')} style={{ fontFamily:PP, fontWeight:600, fontSize:13, color:C.primary, background:'none', border:`1.5px solid ${C.primaryMid}`, borderRadius:14, padding:'12px 0', width:'100%', cursor:'pointer', marginTop:10 }}>
        Crear cuenta gratis
      </button>
    </div>
  )

  return (
    <div style={{ maxWidth:600, margin:'0 auto', padding:'32px 24px 100px' }}>
      <div style={{ background:'linear-gradient(135deg,#1D4ED8,#2563EB)', borderRadius:24, padding:'24px 20px 28px', marginBottom:20, position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-20, right:-20, width:80, height:80, borderRadius:'50%', background:'rgba(255,255,255,0.06)' }}/>
        <div style={{ display:'flex', gap:16, alignItems:'center', marginBottom:18 }}>
          <Avatar name={displayName} size={64} />
          <div>
            <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:22, color:'#fff', marginBottom:4, letterSpacing:-0.3 }}>{displayName}</h1>
            <p style={{ fontFamily:PP, fontSize:12, color:'rgba(255,255,255,0.7)', margin:0 }}>{user?.email}</p>
            {userCanton && <p style={{ fontFamily:PP, fontSize:12, color:'rgba(255,255,255,0.7)', margin:'2px 0 0' }}>📍 Cantón {userCanton}</p>}
          </div>
        </div>
        <div style={{ display:'flex', gap:20, padding:'14px 0 0', borderTop:'1px solid rgba(255,255,255,0.15)' }}>
          {[['Publicaciones', counts.total], ['Activas', counts.active], ['Ocultas', counts.inactive]].map(([label, value]) => (
            <div key={label} style={{ textAlign:'center' }}>
              <p style={{ fontFamily:PP, fontWeight:700, fontSize:18, color:'#fff', margin:'0 0 2px' }}>{value}</p>
              <p style={{ fontFamily:PP, fontSize:10, color:'rgba(255,255,255,0.65)', margin:0 }}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background:C.primaryLight, border:`1.5px solid ${C.primaryMid}`, borderRadius:16, padding:'14px 16px', marginBottom:20, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <p style={{ fontFamily:PP, fontWeight:700, fontSize:13, color:C.primaryDark, marginBottom:2 }}>Plan gratuito</p>
          <p style={{ fontFamily:PP, fontSize:11, color:C.primary, margin:0 }}>{counts.active} publicaciones activas · Gestión desde tu perfil</p>
        </div>
        <span style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.primary, background:'#fff', padding:'5px 10px', borderRadius:10, border:`1px solid ${C.primaryMid}` }}>
          Ver Premium
        </span>
      </div>

      {menu.map(item => {
        const content = (
          <div style={{ background:'#fff', border:`1px solid ${C.border}`, borderRadius:14, padding:'13px 15px', display:'flex', gap:12, alignItems:'center', marginBottom:8, cursor:item.disabled ? 'not-allowed' : 'pointer', transition:'all .15s', opacity:item.disabled ? 0.7 : 1 }}>
            <div style={{ width:42, height:42, background:C.bg, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>{item.icon}</div>
            <div style={{ flex:1 }}>
              <p style={{ fontFamily:PP, fontWeight:600, fontSize:13, color:C.text, marginBottom:1 }}>{item.label}</p>
              <p style={{ fontFamily:PP, fontSize:11, color:C.light, margin:0 }}>{item.sub}</p>
            </div>
            <span style={{ color:C.light, fontSize:16 }}>›</span>
          </div>
        )

        if (item.disabled) return <div key={item.label}>{content}</div>

        return (
          <button key={item.label} onClick={item.action} style={{ width:'100%', background:'none', border:'none', padding:0, textAlign:'left' }}>
            {content}
          </button>
        )
      })}

      <button onClick={handleSignOut} style={{ fontFamily:PP, fontWeight:600, fontSize:13, color:'#EF4444', background:'#FEF2F2', border:'none', borderRadius:14, padding:'13px 0', width:'100%', cursor:'pointer', marginTop:8 }}>
        Cerrar sesión
      </button>

      <Modal show={manageOpen} onClose={() => setManageOpen(false)} title="Mis publicaciones">
        {issues.length > 0 && (
          <InfoBanner emoji="🧩" title="Falta completar Supabase" text={issues[0]} bg={C.warnLight} border={C.warnMid} color="#92400E" />
        )}
        <div style={{ display:'flex', gap:12, alignItems:'flex-end', marginBottom:16 }}>
          <div style={{ flex:1 }}>
            <Select label="Filtrar publicaciones" value={activeTab} onChange={event => setActiveTab(event.target.value)}>
              {PUBLICATION_TABS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
            </Select>
          </div>
          <div style={{ minWidth:82, textAlign:'right', paddingBottom:10 }}>
            <p style={{ fontFamily:PP, fontSize:10, color:C.light, margin:'0 0 3px' }}>Mostrando</p>
            <p style={{ fontFamily:PP, fontWeight:800, fontSize:20, color:C.text, margin:0 }}>{filteredPublications.length}</p>
          </div>
        </div>
        <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:14, padding:'10px 12px', marginBottom:14 }}>
          <p style={{ fontFamily:PP, fontWeight:700, fontSize:12, color:C.text, margin:'0 0 3px' }}>{activeFilter?.label || 'Todo'}</p>
          <p style={{ fontFamily:PP, fontSize:11, color:C.light, margin:0 }}>Abre el menú `⋯` de cada tarjeta para editar o borrar sin recargar el panel.</p>
        </div>

        {loadingPublications ? (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {[1,2,3].map(index => <div key={index} className="skeleton" style={{ height:92, borderRadius:16 }} />)}
          </div>
        ) : filteredPublications.length === 0 ? (
          <EmptyState emoji="🗂️" title="Todavía no tienes publicaciones aquí" sub="Cuando publiques anuncios, empleos, eventos, negocios o comunidades, podrás gestionarlos desde este panel." />
        ) : (
          filteredPublications.map(item => {
            const deleteKey = `${item.kind}-${item.id}`
            return (
              <div key={deleteKey} style={{ background:'#fff', border:`1px solid ${C.border}`, borderRadius:16, padding:'14px 15px', marginBottom:10 }}>
                <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                  {item.raw?.img_url ? (
                    <div style={{ width:42, height:42, borderRadius:12, overflow:'hidden', flexShrink:0 }}>
                      <img src={item.raw.img_url} alt={item.title} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    </div>
                  ) : (
                    <div style={{ width:42, height:42, borderRadius:12, background:C.primaryLight, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>
                      {item.icon}
                    </div>
                  )}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:6 }}>
                      <Tag bg="#DBEAFE" color={C.primaryDark}>{KIND_META[item.kind].label}</Tag>
                      <Tag bg={item.active ? '#D1FAE5' : '#E5E7EB'} color={item.active ? '#065F46' : '#475569'}>
                        {item.active ? 'Activa' : 'Oculta'}
                      </Tag>
                    </div>
                    <p style={{ fontFamily:PP, fontWeight:700, fontSize:14, color:C.text, margin:'0 0 4px', lineHeight:1.35, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.title}</p>
                    {item.summary && (
                      <p style={{ fontFamily:PP, fontSize:12, color:C.mid, margin:'0 0 3px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {item.summary}
                      </p>
                    )}
                    <div style={{ display:'flex', alignItems:'center', gap:4, minWidth:0 }}>
                      {item.meta && (
                        <span style={{ fontFamily:PP, fontSize:10, color:C.light, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {item.meta}
                        </span>
                      )}
                      <span style={{ fontFamily:PP, fontSize:10, color:C.light, flexShrink:0 }}>
                        {item.meta ? '· ' : ''}{formatDate(item.createdAt)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setActionItem(item)}
                    style={{
                      width:36,
                      height:36,
                      borderRadius:12,
                      border:`1px solid ${C.border}`,
                      background:C.bg,
                      color:C.mid,
                      fontSize:18,
                      cursor:'pointer',
                      flexShrink:0,
                    }}
                    aria-label={`Gestionar ${item.title}`}
                  >
                    ⋯
                  </button>
                </div>
                {deletingKey === deleteKey && (
                  <p style={{ fontFamily:PP, fontSize:11, color:C.light, margin:'10px 0 0', paddingTop:10, borderTop:`1px solid ${C.border}` }}>
                    Borrando publicación...
                  </p>
                )}
              </div>
            )
          })
        )}
      </Modal>

      <Sheet show={!!actionItem} onClose={() => setActionItem(null)} title={actionItem ? actionItem.title : 'Acciones'}>
        {actionItem && (
          <>
            <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:16, padding:'12px 14px', marginBottom:14 }}>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:6 }}>
                <Tag bg="#DBEAFE" color={C.primaryDark}>{KIND_META[actionItem.kind].label}</Tag>
                <Tag bg={actionItem.active ? '#D1FAE5' : '#E5E7EB'} color={actionItem.active ? '#065F46' : '#475569'}>
                  {actionItem.active ? 'Activa' : 'Oculta'}
                </Tag>
              </div>
              <p style={{ fontFamily:PP, fontWeight:700, fontSize:14, color:C.text, margin:'0 0 4px', lineHeight:1.35 }}>{actionItem.title}</p>
              <p style={{ fontFamily:PP, fontSize:11, color:C.light, margin:0 }}>{formatDate(actionItem.createdAt)}</p>
            </div>
            <Btn onClick={() => { openEditor(actionItem); setActionItem(null) }} style={{ marginBottom:10 }}>
              ✏️ Editar publicación
            </Btn>
            <button
              onClick={() => handleDeletePublication(actionItem)}
              style={{
                width:'100%',
                fontFamily:PP,
                fontWeight:700,
                fontSize:13,
                background:'#FEF2F2',
                color:'#DC2626',
                border:'none',
                borderRadius:14,
                padding:'12px 16px',
                cursor:'pointer',
                marginBottom:8,
              }}
            >
              🗑️ Borrar publicación
            </button>
            <button
              onClick={() => setActionItem(null)}
              style={{
                width:'100%',
                fontFamily:PP,
                fontWeight:600,
                fontSize:12,
                color:C.mid,
                background:'transparent',
                border:`1.5px solid ${C.border}`,
                borderRadius:14,
                padding:'11px 16px',
                cursor:'pointer',
              }}
            >
              Cancelar
            </button>
          </>
        )}
      </Sheet>

      <Modal show={!!editorItem} onClose={closeEditor} title={editorItem ? `Editar ${KIND_META[editorItem.kind].label.toLowerCase()}` : 'Editar'}>
        {editorItem?.kind === 'ad' && (
          <>
            <Select label="Categoría" value={editorForm.cat || ''} onChange={event => updateEditorField('cat', event.target.value)}>
              <option value="">Seleccionar...</option>
              {AD_CATS.map(item => <option key={item.id} value={item.id}>{item.emoji} {item.label}</option>)}
            </Select>
            <Select label="Tipo" value={editorForm.type || ''} onChange={event => updateEditorField('type', event.target.value)}>
              <option value="">Seleccionar...</option>
              {AD_TYPES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
            </Select>
            <Input label="Título" value={editorForm.title || ''} onChange={event => updateEditorField('title', event.target.value)} />
            <Input label="Descripción" rows={4} value={editorForm.desc || ''} onChange={event => updateEditorField('desc', event.target.value)} />
            <Input label="Precio" value={editorForm.price || ''} onChange={event => updateEditorField('price', event.target.value)} />
            <div className="grid-2" style={{ gap:10 }}>
              <Select label="Cantón" value={editorForm.canton || ''} onChange={event => updateEditorField('canton', event.target.value)}>
                <option value="">Seleccionar...</option>
                {CANTONS.map(item => <option key={item.code} value={item.code}>{item.code} — {item.name}</option>)}
              </Select>
              <Input label="PLZ" value={editorForm.plz || ''} onChange={event => updateEditorField('plz', event.target.value)} />
            </div>
            <Input label="WhatsApp o teléfono" value={editorForm.contactPhone || ''} onChange={event => updateEditorField('contactPhone', event.target.value)} />
            <Input label="Email de contacto" value={editorForm.contactEmail || ''} onChange={event => updateEditorField('contactEmail', event.target.value)} />
            <Select label="Privacidad" value={editorForm.privacy || 'public'} onChange={event => updateEditorField('privacy', event.target.value)}>
              <option value="public">Público</option>
              <option value="private">Privado</option>
            </Select>
          </>
        )}

        {editorItem?.kind === 'job' && (
          <>
            <Input label="Sector" value={editorForm.sector || ''} onChange={event => updateEditorField('sector', event.target.value)} />
            <Input label="Título del puesto" value={editorForm.title || ''} onChange={event => updateEditorField('title', event.target.value)} />
            <Input label="Empresa" value={editorForm.company || ''} onChange={event => updateEditorField('company', event.target.value)} />
            <Select label="Tipo de contrato" value={editorForm.type || ''} onChange={event => updateEditorField('type', event.target.value)}>
              <option value="">Seleccionar...</option>
              {JOB_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
            </Select>
            <div className="grid-2" style={{ gap:10 }}>
              <Input label="Ciudad" value={editorForm.city || ''} onChange={event => updateEditorField('city', event.target.value)} />
              <Select label="Cantón" value={editorForm.canton || ''} onChange={event => updateEditorField('canton', event.target.value)}>
                <option value="">Seleccionar...</option>
                {CANTONS.map(item => <option key={item.code} value={item.code}>{item.code} — {item.name}</option>)}
              </Select>
            </div>
            <Input label="Salario" value={editorForm.salary || ''} onChange={event => updateEditorField('salary', event.target.value)} />
            <Input label="Idiomas (separados por coma)" value={editorForm.langs || ''} onChange={event => updateEditorField('langs', event.target.value)} />
            <Input label="Descripción" rows={4} value={editorForm.desc || ''} onChange={event => updateEditorField('desc', event.target.value)} />
            <Input label="WhatsApp" value={editorForm.contactPhone || ''} onChange={event => updateEditorField('contactPhone', event.target.value)} />
            <Input label="Email" value={editorForm.contactEmail || ''} onChange={event => updateEditorField('contactEmail', event.target.value)} />
            <Input label="Link de aplicación" value={editorForm.contactLink || ''} onChange={event => updateEditorField('contactLink', event.target.value)} />
          </>
        )}

        {editorItem?.kind === 'event' && (
          <>
            <Select label="Tipo de evento" value={editorForm.type || ''} onChange={event => updateEditorField('type', event.target.value)}>
              <option value="">Seleccionar...</option>
              {EVENTO_TYPES.filter(item => item.id).map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
            </Select>
            <Input label="Título" value={editorForm.title || ''} onChange={event => updateEditorField('title', event.target.value)} />
            <div className="grid-2" style={{ gap:10 }}>
              <Input label="Día" value={editorForm.day || ''} onChange={event => updateEditorField('day', event.target.value)} />
              <Input label="Mes" value={editorForm.month || ''} onChange={event => updateEditorField('month', event.target.value)} />
            </div>
            <div className="grid-2" style={{ gap:10 }}>
              <Input label="Año" value={editorForm.year || ''} onChange={event => updateEditorField('year', event.target.value)} />
              <Input label="Hora" value={editorForm.time || ''} onChange={event => updateEditorField('time', event.target.value)} />
            </div>
            <Input label="Precio" value={editorForm.price || ''} onChange={event => updateEditorField('price', event.target.value)} />
            <div className="grid-2" style={{ gap:10 }}>
              <Input label="Ciudad" value={editorForm.city || ''} onChange={event => updateEditorField('city', event.target.value)} />
              <Select label="Cantón" value={editorForm.canton || ''} onChange={event => updateEditorField('canton', event.target.value)}>
                <option value="">Seleccionar...</option>
                {CANTONS.map(item => <option key={item.code} value={item.code}>{item.code} — {item.name}</option>)}
              </Select>
            </div>
            <Input label="Venue" value={editorForm.venue || ''} onChange={event => updateEditorField('venue', event.target.value)} />
            <Input label="Descripción" rows={4} value={editorForm.desc || ''} onChange={event => updateEditorField('desc', event.target.value)} />
            <Input label="Organizador" value={editorForm.host || ''} onChange={event => updateEditorField('host', event.target.value)} />
            <Input label="Link" value={editorForm.link || ''} onChange={event => updateEditorField('link', event.target.value)} />
          </>
        )}

        {editorItem?.kind === 'business' && (
          <>
            <Select label="Categoría" value={editorForm.category || ''} onChange={event => updateEditorField('category', event.target.value)}>
              <option value="">Seleccionar...</option>
              {NEGOCIO_TYPES.filter(item => item.id).map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
            </Select>
            <Input label="Nombre" value={editorForm.name || ''} onChange={event => updateEditorField('name', event.target.value)} />
            <div className="grid-2" style={{ gap:10 }}>
              <Input label="Ciudad" value={editorForm.city || ''} onChange={event => updateEditorField('city', event.target.value)} />
              <Select label="Cantón" value={editorForm.canton || ''} onChange={event => updateEditorField('canton', event.target.value)}>
                <option value="">Seleccionar...</option>
                {CANTONS.map(item => <option key={item.code} value={item.code}>{item.code} — {item.name}</option>)}
              </Select>
            </div>
            <Input label="Descripción" rows={4} value={editorForm.description || ''} onChange={event => updateEditorField('description', event.target.value)} />
            <Input label="Teléfono / WhatsApp" value={editorForm.whatsapp || ''} onChange={event => updateEditorField('whatsapp', event.target.value)} />
            <Input label="Email" type="email" value={editorForm.email || ''} onChange={event => updateEditorField('email', event.target.value)} />
            <Input label="Instagram" value={editorForm.instagram || ''} onChange={event => updateEditorField('instagram', event.target.value)} />
            <Input label="Web (opcional)" type="url" value={editorForm.website || ''} onChange={event => updateEditorField('website', event.target.value)} />
            <Input label="Servicios (coma)" value={editorForm.services || ''} onChange={event => updateEditorField('services', event.target.value)} />
          </>
        )}

        {editorItem?.kind === 'community' && (
          <>
            <Select label="Categoría" value={editorForm.cat || ''} onChange={event => updateEditorField('cat', event.target.value)}>
              <option value="">Seleccionar...</option>
              {COMMUNITY_OPTIONS.map(item => <option key={item.id} value={item.id}>{item.emoji} {item.label}</option>)}
            </Select>
            <Input label="Nombre" value={editorForm.name || ''} onChange={event => updateEditorField('name', event.target.value)} />
            <Input label="Ciudad / zona" value={editorForm.city || ''} onChange={event => updateEditorField('city', event.target.value)} />
            <Input label="Descripción" rows={4} value={editorForm.desc || ''} onChange={event => updateEditorField('desc', event.target.value)} />
            <Input label="Link o contacto" value={editorForm.contact || ''} onChange={event => updateEditorField('contact', event.target.value)} />
          </>
        )}

        <div style={{ display:'flex', gap:10, marginTop:18 }}>
          <button onClick={closeEditor} style={{ flex:1, fontFamily:PP, fontWeight:700, fontSize:12, background:'#fff', color:C.mid, border:`1.5px solid ${C.border}`, borderRadius:12, padding:'11px 0', cursor:'pointer' }}>
            Cancelar
          </button>
          <Btn onClick={handleSavePublication} disabled={saving} style={{ flex:1 }}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </Btn>
        </div>
      </Modal>
    </div>
  )
}
