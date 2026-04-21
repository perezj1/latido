import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { usePWA } from '../hooks/usePWA'
import { useFavorites } from '../hooks/useFavorites'
import { notifyZoneAlertsUpdated } from '../hooks/useZoneAlerts'
import { uploadAvatar, getStorageErrorMessage } from '../lib/storage'
import { invalidateAvatarCache } from '../lib/profiles'
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

const ALERT_CATS = [
  { id:'vivienda', emoji:'🏠', label:'Vivienda' },
  { id:'servicios', emoji:'🔧', label:'Servicios' },
  { id:'empleo', emoji:'💼', label:'Empleo' },
  { id:'venta', emoji:'🛒', label:'Venta' },
  { id:'cuidados', emoji:'❤️', label:'Cuidados' },
  { id:'hogar', emoji:'🛋️', label:'Hogar' },
  { id:'documentos', emoji:'📄', label:'Documentos' },
  { id:'regalo', emoji:'🎁', label:'Regalos' },
]

const LANGS = ['Español', 'Alemán', 'Francés', 'Italiano', 'Inglés', 'Portugués']

function normalizeCommunityCategory(value='') {
  if (value === 'mamas') return 'familia'
  if (value === 'fe') return ''
  return value
}

const KIND_META = {
  ad: { label:'Anuncio', icon:'📌', table:'listings' },
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

function loadAlertSettings() {
  try { return JSON.parse(localStorage.getItem('latido_alerts') || '{}') } catch { return {} }
}

export default function Perfil() {
  const { isLoggedIn, displayName, userCanton, user, signOut, avatarUrl, updateAvatar } = useAuth()
  const { isPWA, canInstall, promptInstall } = usePWA()
  const navigate = useNavigate()

  // publications
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

  // avatar
  const avatarInputRef = useRef(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  // alerts
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [alertSettings, setAlertSettings] = useState(loadAlertSettings)

  // config
  const [configOpen, setConfigOpen] = useState(false)
  const [configForm, setConfigForm] = useState({})
  const [savingConfig, setSavingConfig] = useState(false)

  // favorites
  const { favorites, toggleFavorite, isFavorite } = useFavorites()
  const [favOpen, setFavOpen] = useState(false)
  const [favItems, setFavItems] = useState([])
  const [loadingFavs, setLoadingFavs] = useState(false)


  const loadPublications = async () => {
    if (!user?.id) return
    setLoadingPublications(true)
    try {
      const results = await Promise.allSettled([
        supabase.from('listings').select('*').eq('user_id', user.id).order('created_at', { ascending:false }),
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
        if (result.status === 'rejected') { nextIssues.push(`No se pudieron cargar tus ${issue}.`); return }
        if (result.value.error) { nextIssues.push(`Falta ajustar Supabase para ${issue}. Ejecuta publications_schema_v4.sql.`); return }
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

  const loadFavorites = async () => {
    setLoadingFavs(true)
    const adIds = favorites.ads || []
    const jobIds = favorites.jobs || []
    const results = []
    if (adIds.length) {
      const { data } = await supabase.from('listings').select('*').in('id', adIds)
      const foundIds = new Set((data || []).map(a => a.id))
      if (data) results.push(...data.map(a => ({ ...a, _kind:'ad' })))
      adIds.filter(id => !foundIds.has(id)).forEach(id =>
        results.push({ id, _kind:'ad', _unavailable:true })
      )
    }
    if (jobIds.length) {
      const { data } = await supabase.from('jobs').select('*').in('id', jobIds)
      const foundIds = new Set((data || []).map(j => j.id))
      if (data) results.push(...data.map(j => ({ ...j, _kind:'job' })))
      jobIds.filter(id => !foundIds.has(id)).forEach(id =>
        results.push({ id, _kind:'job', _unavailable:true })
      )
    }
    setFavItems(results)
    setLoadingFavs(false)
  }

  const counts = useMemo(() => {
    const total = publications.length
    const active = publications.filter(item => item.active).length
    return { total, active, inactive: total - active }
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

  const handleAvatarUpload = async e => {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return
    setUploadingAvatar(true)
    try {
      const publicUrl = await uploadAvatar({ file, userId: user.id })
      const { error: profileErr } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id)
      if (profileErr) {
        // Column probably missing — tell the user exactly what to run
        toast.error('Falta la columna avatar_url en profiles. Ejecuta en Supabase SQL Editor: ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;')
        return
      }
      invalidateAvatarCache(user.id)
      updateAvatar(publicUrl)
      toast.success('Foto actualizada')
    } catch (err) {
      toast.error(getStorageErrorMessage(err))
    } finally {
      setUploadingAvatar(false)
      e.target.value = ''
    }
  }

  const saveAlerts = next => {
    const normalizedNext = {
      ...next,
      canton: next.canton ?? alertSettings.canton ?? userCanton ?? '',
    }

    const prevCats = [...(alertSettings.categories || [])].sort().join('|')
    const nextCats = [...(normalizedNext.categories || [])].sort().join('|')
    const filtersChanged = normalizedNext.canton !== (alertSettings.canton ?? userCanton ?? '') || nextCats !== prevCats

    // Anchor lastCheck whenever alerts are enabled or filters change, so only future publications notify.
    if (normalizedNext.enabled && (!alertSettings.enabled || filtersChanged || !localStorage.getItem('latido_alerts_last_check'))) {
      localStorage.setItem('latido_alerts_last_check', new Date().toISOString())
    }
    setAlertSettings(normalizedNext)
    localStorage.setItem('latido_alerts', JSON.stringify(normalizedNext))
    notifyZoneAlertsUpdated()
  }

  const toggleAlertCat = cat => {
    const cats = alertSettings.categories || []
    const next = cats.includes(cat) ? cats.filter(c => c !== cat) : [...cats, cat]
    saveAlerts({ ...alertSettings, categories: next })
  }

  const openConfig = () => {
    setConfigForm({ name: displayName, canton: userCanton, newPassword:'', confirmPassword:'' })
    setConfigOpen(true)
  }

  const handleSaveConfig = async () => {
    setSavingConfig(true)
    try {
      const meta = {}
      if (configForm.name?.trim() && configForm.name.trim() !== displayName) meta.name = configForm.name.trim()
      if (configForm.canton && configForm.canton !== userCanton) meta.canton = configForm.canton
      if (Object.keys(meta).length) {
        const { error } = await supabase.auth.updateUser({ data: meta })
        if (error) throw error
      }
      if (configForm.newPassword) {
        if (configForm.newPassword !== configForm.confirmPassword) {
          toast.error('Las contraseñas no coinciden')
          setSavingConfig(false)
          return
        }
        if (configForm.newPassword.length < 6) {
          toast.error('La contraseña debe tener al menos 6 caracteres')
          setSavingConfig(false)
          return
        }
        const { error } = await supabase.auth.updateUser({ password: configForm.newPassword })
        if (error) throw error
      }
      toast.success('Configuración guardada')
      setConfigOpen(false)
    } catch (err) {
      toast.error(err?.message || 'Error al guardar')
    } finally {
      setSavingConfig(false)
    }
  }

  const openEditor = item => { setEditorItem(item); setEditorForm(buildEditorForm(item)) }
  const closeEditor = () => { setEditorItem(null); setEditorForm({}); setSaving(false) }
  const updateEditorField = (key, value) => setEditorForm(prev => ({ ...prev, [key]: value }))

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
        cat: editorForm.cat || null, sub: editorForm.sub?.trim() || null,
        type: editorForm.type || null, title: editorForm.title?.trim(),
        desc: editorForm.desc?.trim() || null, price: editorForm.price?.trim() || null,
        canton: editorForm.canton || null, plz: editorForm.plz?.trim() || null,
        privacy: editorForm.privacy || 'public',
        contact_phone: editorForm.contactPhone?.trim() || null,
        contact_email: editorForm.contactEmail?.trim() || null,
        updated_at: new Date().toISOString(),
      }
      if (!payload.title || !payload.type) { toast.error('Completa al menos el título y el tipo del anuncio'); return }
    }

    if (item.kind === 'job') {
      const languages = splitList(editorForm.langs || '')
      payload = {
        sector: editorForm.sector?.trim() || null, category: editorForm.sector?.trim() || null,
        title: editorForm.title?.trim(), company: editorForm.company?.trim() || null,
        type: editorForm.type || null, city: editorForm.city?.trim() || null,
        canton: editorForm.canton || null, salary: editorForm.salary?.trim() || null,
        lang: languages.length ? languages.join(' · ') : null,
        languages: languages.length ? languages : null,
        desc: editorForm.desc?.trim() || null,
        contact_phone: editorForm.contactPhone?.trim() || null,
        contact_email: editorForm.contactEmail?.trim() || null,
        contact_link: editorForm.contactLink?.trim() || null,
        contact: editorForm.contactEmail?.trim() || editorForm.contactLink?.trim() || null,
        updated_at: new Date().toISOString(),
      }
      if (!payload.title || !payload.canton) { toast.error('Completa al menos el título y el cantón del empleo'); return }
    }

    if (item.kind === 'event') {
      payload = {
        type: editorForm.type || null, title: editorForm.title?.trim(),
        day: editorForm.day?.trim() || null, month: editorForm.month?.trim() || null,
        year: editorForm.year?.trim() || null, time: editorForm.time?.trim() || null,
        price: editorForm.price?.trim() || null, city: editorForm.city?.trim() || null,
        canton: editorForm.canton || null, venue: editorForm.venue?.trim() || null,
        desc: editorForm.desc?.trim() || null, host: editorForm.host?.trim() || null,
        link: editorForm.link?.trim() || null, updated_at: new Date().toISOString(),
      }
      if (!payload.title || !payload.canton) { toast.error('Completa al menos el título y el cantón del evento'); return }
    }

    if (item.kind === 'business') {
      const services = splitList(editorForm.services || '')
      payload = {
        category: editorForm.category || null, name: editorForm.name?.trim(),
        city: editorForm.city?.trim() || null, canton: editorForm.canton || null,
        description: editorForm.description?.trim() || null,
        whatsapp: editorForm.whatsapp?.trim() || null, email: editorForm.email?.trim() || null,
        instagram: editorForm.instagram?.trim() || null, website: editorForm.website?.trim() || null,
        services: services.length ? services : null, updated_at: new Date().toISOString(),
      }
      if (!payload.name || !payload.canton) { toast.error('Completa al menos el nombre y el cantón del negocio'); return }
      if (![payload.whatsapp, payload.email, payload.instagram].some(Boolean)) { toast.error('Añade al menos un método de contacto para el negocio'); return }
    }

    if (item.kind === 'community') {
      const category = COMMUNITY_OPTIONS.find(entry => entry.id === normalizeCommunityCategory(editorForm.cat))
      payload = {
        cat: editorForm.cat || null, name: editorForm.name?.trim(),
        city: editorForm.city?.trim() || null, desc: editorForm.desc?.trim() || null,
        contact: editorForm.contact?.trim() || null,
        emoji: category?.emoji || item.raw.emoji || '🤝',
        updated_at: new Date().toISOString(),
      }
      if (!payload.name || !payload.contact) { toast.error('Completa al menos el nombre y el enlace de la comunidad'); return }
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
    { icon:'❤️', label:'Favoritos', sub:`${(favorites.ads?.length||0)+(favorites.jobs?.length||0)} guardados · toca el corazón en los anuncios`, action:() => { setFavOpen(true); loadFavorites() } },
    // { icon:'💬', label:'Mensajes', sub:'Conversaciones con otros usuarios', action:() => navigate('/mensajes') },
    { icon:'📚', label:'Guías', sub:'Documentos y recursos útiles para vivir en Suiza', action:() => navigate('/guias') },
    { icon:'🔔', label:'Alertas de zona', sub:'Nuevos anuncios en tu cantón y PLZ', action:() => setAlertsOpen(true) },
    { icon:'⚙️', label:'Configuración', sub:'Nombre, cantón, idiomas, contraseña', action:openConfig },
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

      {/* Avatar + header card */}
      <div style={{ background:'linear-gradient(135deg,#1D4ED8,#2563EB)', borderRadius:24, padding:'28px 20px 24px', marginBottom:20, position:'relative', overflow:'hidden', textAlign:'center' }}>
        <div style={{ position:'absolute', top:-30, right:-30, width:120, height:120, borderRadius:'50%', background:'rgba(255,255,255,0.06)' }}/>
        <div style={{ position:'absolute', bottom:-20, left:-20, width:80, height:80, borderRadius:'50%', background:'rgba(255,255,255,0.04)' }}/>

        {/* Avatar with camera overlay */}
        <div
          style={{ position:'relative', display:'inline-block', marginBottom:12, cursor:'pointer' }}
          onClick={() => !uploadingAvatar && avatarInputRef.current?.click()}
        >
          <Avatar name={displayName} size={80} src={avatarUrl} />
          <div style={{ position:'absolute', bottom:0, right:0, width:26, height:26, borderRadius:'50%', background:'#fff', border:'2px solid #2563EB', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13 }}>
            {uploadingAvatar ? '⏳' : '📷'}
          </div>
          <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display:'none' }} />
        </div>

        {/* Name & info */}
        <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:22, color:'#fff', margin:'0 0 4px', letterSpacing:-0.3 }}>{displayName}</h1>
        <p style={{ fontFamily:PP, fontSize:12, color:'rgba(255,255,255,0.65)', margin:'0 0 8px' }}>{user?.email}</p>
        {userCanton && (
          <span style={{ display:'inline-flex', alignItems:'center', gap:4, background:'rgba(255,255,255,0.15)', borderRadius:20, padding:'4px 12px', fontFamily:PP, fontSize:11, fontWeight:600, color:'#fff' }}>
            📍 Cantón {userCanton}
          </span>
        )}

        {/* Stats */}
        <div style={{ display:'flex', justifyContent:'center', gap:0, marginTop:20, borderTop:'1px solid rgba(255,255,255,0.15)', paddingTop:16 }}>
          {[
            { icon:'📌', value: counts.total, label:'Publicaciones' },
            { icon: alertSettings.enabled ? '🔔' : '🔕', value: alertSettings.enabled ? '✅' : '❌', label:'Alertas', isText: true },
            { icon:'❤️', value: (favorites.ads?.length||0)+(favorites.jobs?.length||0), label:'Favoritos' },
          ].map(({ icon, value, label, isText }, i, arr) => (
            <div key={label} style={{ flex:1, textAlign:'center', borderRight: i < arr.length-1 ? '1px solid rgba(255,255,255,0.12)' : 'none' }}>
              <p style={{ fontFamily:PP, fontWeight:800, fontSize:22, color:'#fff', margin:'0 0 2px', letterSpacing:-0.5 }}>{value}</p>
              <p style={{ fontFamily:PP, fontSize:10, color:'rgba(255,255,255,0.6)', margin:0 }}>{icon} {label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Twint promo banner */}
      {/* <div style={{ background:'linear-gradient(135deg,#f0fdf4,#dcfce7)', border:'1.5px solid #86efac', borderRadius:16, padding:'14px 16px', marginBottom:20, display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
        <div>
          <p style={{ fontFamily:PP, fontWeight:700, fontSize:13, color:'#15803d', marginBottom:3 }}>💚 Apoya a Latido</p>
          <p style={{ fontFamily:PP, fontSize:11, color:'#166534', margin:0, lineHeight:1.5 }}>
            Publica tu anuncio, da a conocer tu negocio o apoya a tu comunidad.<br/>
            ¿No encuentras lo que buscas? ¡Publícalo y deja que la comunidad te ayude!
          </p>
        </div>
        <a
          href="twint://send?phone=%2B41786543234"
          style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:'#fff', background:'#16a34a', padding:'7px 12px', borderRadius:10, textDecoration:'none', flexShrink:0, textAlign:'center', lineHeight:1.4 }}
        >
          Pagar<br/>Twint
        </a>
      </div>
 */}
      {menu.map(item => {
        const content = (
          <div style={{ background:'#fff', border:`1px solid ${C.border}`, borderRadius:14, padding:'13px 15px', display:'flex', gap:12, alignItems:'center', marginBottom:8, cursor:item.disabled ? 'not-allowed' : 'pointer', transition:'all .15s', opacity:item.disabled ? 0.6 : 1 }}>
            <div style={{ width:42, height:42, background:C.bg, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>{item.icon}</div>
            <div style={{ flex:1 }}>
              <p style={{ fontFamily:PP, fontWeight:600, fontSize:13, color:C.text, marginBottom:1 }}>{item.label}</p>
              <p style={{ fontFamily:PP, fontSize:11, color:C.light, margin:0 }}>{item.sub}</p>
            </div>
            <span style={{ color:C.light, fontSize:16 }}>{item.disabled ? '🔒' : '›'}</span>
          </div>
        )
        if (item.disabled) return <div key={item.label}>{content}</div>
        return (
          <button key={item.label} onClick={item.action} style={{ width:'100%', background:'none', border:'none', padding:0, textAlign:'left' }}>
            {content}
          </button>
        )
      })}

      {/* Install app card */}
      {!isPWA && (
        <div style={{ background:'linear-gradient(135deg,#1e293b,#0f172a)', borderRadius:16, padding:'16px 18px', marginTop:8, marginBottom:8 }}>
          <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
            <div style={{ fontSize:28, flexShrink:0 }}>📲</div>
            <div style={{ flex:1 }}>
              <p style={{ fontFamily:PP, fontWeight:700, fontSize:14, color:'#fff', margin:'0 0 4px', letterSpacing:-0.3 }}>Tu gente más cerca que nunca</p>
              {/iPad|iPhone|iPod/.test(navigator.userAgent) ? (
                <>
                  <p style={{ fontFamily:PP, fontSize:11, color:'rgba(255,255,255,0.65)', margin:'0 0 10px', lineHeight:1.55 }}>
                    Añade Latido a tu pantalla de inicio gratis y accede a tu comunidad en segundos estés donde estés.
                  </p>
                  <div style={{ background:'rgba(255,255,255,0.08)', borderRadius:10, padding:'8px 12px' }}>
                    {['1. Abre Safari (no Chrome)', '2. Toca el icono 📤 de la barra inferior', '3. Selecciona "Añadir a pantalla de inicio"'].map(s => (
                      <p key={s} style={{ fontFamily:PP, fontSize:11, color:'rgba(255,255,255,0.65)', margin:'2px 0', lineHeight:1.4 }}>{s}</p>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p style={{ fontFamily:PP, fontSize:11, color:'rgba(255,255,255,0.65)', margin:'0 0 10px', lineHeight:1.55 }}>
                    Añade Latido a tu pantalla de inicio gratis y accede a tu comunidad en segundos estés donde estés.
                  </p>
                  {canInstall ? (
                    <button onClick={promptInstall} style={{ fontFamily:PP, fontWeight:700, fontSize:12, background:C.primary, color:'#fff', border:'none', borderRadius:10, padding:'9px 18px', cursor:'pointer' }}>
                      Añadir a inicio
                    </button>
                  ) : (
                    <p style={{ fontFamily:PP, fontSize:11, color:'rgba(255,255,255,0.5)', margin:0 }}>
                      En el menú del navegador busca "Instalar app" o "Añadir a pantalla de inicio".
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <button onClick={handleSignOut} style={{ fontFamily:PP, fontWeight:600, fontSize:13, color:'#EF4444', background:'#FEF2F2', border:'none', borderRadius:14, padding:'13px 0', width:'100%', cursor:'pointer', marginTop:8 }}>
        Cerrar sesión
      </button>

      {/* ── Favoritos ── */}
      <Sheet show={favOpen} onClose={() => setFavOpen(false)} title="❤️ Favoritos">
        {loadingFavs ? (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {[1,2].map(i => <div key={i} className="skeleton" style={{ height:80, borderRadius:14 }} />)}
          </div>
        ) : favItems.length === 0 ? (
          <div style={{ textAlign:'center', padding:'40px 20px' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🤍</div>
            <p style={{ fontFamily:PP, fontWeight:700, fontSize:15, color:C.text, marginBottom:6 }}>Sin favoritos todavía</p>
            <p style={{ fontFamily:PP, fontSize:12, color:C.light, lineHeight:1.6 }}>
              Toca el corazón 🤍 en cualquier anuncio o empleo para guardarlo aquí.
            </p>
          </div>
        ) : (
          favItems.map(item => {
            const isJob = item._kind === 'job'
            const favType = isJob ? 'jobs' : 'ads'
            const href = isJob ? `/tablon?cat=empleo&openJob=${item.id}` : `/tablon?openAd=${item.id}`

            if (item._unavailable) return (
              <div key={item.id} style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:14, padding:'13px 15px', marginBottom:10, display:'flex', gap:12, alignItems:'center' }}>
                <div style={{ width:44, height:44, borderRadius:12, background:'#FEE2E2', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>🗑️</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontFamily:PP, fontWeight:600, fontSize:13, color:'#B91C1C', margin:'0 0 2px' }}>Anuncio no disponible</p>
                  <p style={{ fontFamily:PP, fontSize:11, color:'#EF4444', margin:0 }}>Este anuncio fue eliminado o ya no está activo</p>
                </div>
                <button
                  onClick={() => { toggleFavorite(favType, item.id); setFavItems(prev => prev.filter(x => x.id !== item.id)) }}
                  style={{ background:'none', border:'none', cursor:'pointer', fontSize:16, padding:'4px', flexShrink:0, color:'#EF4444' }}
                  aria-label="Eliminar de favoritos"
                >✕</button>
              </div>
            )

            return (
              <div key={item.id} style={{ background:'#fff', border:`1px solid ${C.border}`, borderRadius:14, padding:'13px 15px', marginBottom:10, display:'flex', gap:12, alignItems:'center' }}>
                <button
                  onClick={() => navigate(href)}
                  style={{ display:'flex', gap:12, alignItems:'center', flex:1, minWidth:0, background:'none', border:'none', cursor:'pointer', padding:0, textAlign:'left' }}
                >
                  <div style={{ width:44, height:44, borderRadius:12, background:C.primaryLight, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>
                    {isJob ? (item.emoji || '💼') : '📌'}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontFamily:PP, fontWeight:700, fontSize:13, color:C.text, margin:'0 0 2px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.title || item.company}</p>
                    <p style={{ fontFamily:PP, fontSize:11, color:C.light, margin:0 }}>
                      {isJob ? `💼 ${item.company || ''} · ${item.city || item.canton || ''}` : `📍 ${item.canton || ''} ${item.plz || ''}`}
                    </p>
                  </div>
                </button>
                <button
                  onClick={() => { toggleFavorite(favType, item.id); setFavItems(prev => prev.filter(x => x.id !== item.id)) }}
                  style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, padding:'4px', flexShrink:0 }}
                  aria-label="Quitar de favoritos"
                >
                  ❤️
                </button>
              </div>
            )
          })
        )}
      </Sheet>

      {/* ── Alertas de zona ── */}
      <Sheet show={alertsOpen} onClose={() => setAlertsOpen(false)} title="🔔 Alertas de zona">
        <p style={{ fontFamily:PP, fontSize:12, color:C.mid, marginBottom:16, lineHeight:1.6 }}>
          Recibe una notificación cuando se publiquen nuevos anuncios en tu zona. Las alertas se guardan en este dispositivo.
        </p>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:C.bg, border:`1px solid ${C.border}`, borderRadius:14, padding:'12px 14px', marginBottom:14 }}>
          <div>
            <p style={{ fontFamily:PP, fontWeight:600, fontSize:13, color:C.text, margin:'0 0 2px' }}>Activar alertas</p>
            <p style={{ fontFamily:PP, fontSize:11, color:C.light, margin:0 }}>Notificaciones cuando haya anuncios nuevos</p>
          </div>
          <button
            onClick={() => saveAlerts({ ...alertSettings, enabled: !alertSettings.enabled })}
            style={{ width:44, height:24, borderRadius:12, border:'none', cursor:'pointer', background: alertSettings.enabled ? C.primary : '#D1D5DB', transition:'background .2s', position:'relative', flexShrink:0 }}
            aria-label="Toggle alertas"
          >
            <span style={{ position:'absolute', top:2, left: alertSettings.enabled ? 22 : 2, width:20, height:20, borderRadius:'50%', background:'#fff', transition:'left .2s', boxShadow:'0 1px 4px rgba(0,0,0,0.2)' }} />
          </button>
        </div>

        {alertSettings.enabled && (
          <>
            <Select
              label="Cantón de alertas"
              value={alertSettings.canton || userCanton || ''}
              onChange={e => saveAlerts({ ...alertSettings, canton: e.target.value })}
            >
              <option value="">Todos los cantones</option>
              {CANTONS.map(item => <option key={item.code} value={item.code}>{item.code} — {item.name}</option>)}
            </Select>

            <p style={{ fontFamily:PP, fontWeight:600, fontSize:12, color:C.text, margin:'14px 0 8px' }}>Categorías</p>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:16 }}>
              {ALERT_CATS.map(cat => {
                const active = (alertSettings.categories || []).includes(cat.id)
                return (
                  <button
                    key={cat.id}
                    onClick={() => toggleAlertCat(cat.id)}
                    style={{ fontFamily:PP, fontSize:11, fontWeight:600, padding:'6px 12px', borderRadius:20, border:`1.5px solid ${active ? C.primary : C.border}`, background: active ? C.primaryLight : '#fff', color: active ? C.primaryDark : C.mid, cursor:'pointer', transition:'all .15s' }}
                  >
                    {cat.emoji} {cat.label}
                  </button>
                )
              })}
            </div>

           {/*  <div style={{ background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:12, padding:'10px 12px' }}>
              <p style={{ fontFamily:PP, fontSize:11, color:'#92400E', margin:0, lineHeight:1.5 }}>
                ⚠️ Las notificaciones push llegarán en una próxima actualización. Tus preferencias ya están guardadas.
              </p>
            </div> */}
          </>
        )}
      </Sheet>

      {/* ── Configuración ── */}
      <Sheet show={configOpen} onClose={() => setConfigOpen(false)} title="⚙️ Configuración">
        <Input
          label="Nombre visible"
          value={configForm.name || ''}
          onChange={e => setConfigForm(prev => ({ ...prev, name: e.target.value }))}
        />
        <Select
          label="Tu cantón"
          value={configForm.canton || ''}
          onChange={e => setConfigForm(prev => ({ ...prev, canton: e.target.value }))}
        >
          <option value="">Seleccionar cantón...</option>
          {CANTONS.map(item => <option key={item.code} value={item.code}>{item.code} — {item.name}</option>)}
        </Select>

        <p style={{ fontFamily:PP, fontWeight:600, fontSize:12, color:C.text, margin:'16px 0 6px' }}>Cambiar contraseña</p>
        <Input
          label="Nueva contraseña"
          type="password"
          value={configForm.newPassword || ''}
          onChange={e => setConfigForm(prev => ({ ...prev, newPassword: e.target.value }))}
        />
        <Input
          label="Confirmar contraseña"
          type="password"
          value={configForm.confirmPassword || ''}
          onChange={e => setConfigForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
        />

        <p style={{ fontFamily:PP, fontSize:11, color:C.light, marginBottom:16, lineHeight:1.5 }}>
          Deja la contraseña en blanco si no quieres cambiarla.
        </p>

        <div style={{ display:'flex', gap:10 }}>
          <button onClick={() => setConfigOpen(false)} style={{ flex:1, fontFamily:PP, fontWeight:700, fontSize:12, background:'#fff', color:C.mid, border:`1.5px solid ${C.border}`, borderRadius:12, padding:'11px 0', cursor:'pointer' }}>
            Cancelar
          </button>
          <Btn onClick={handleSaveConfig} disabled={savingConfig} style={{ flex:1 }}>
            {savingConfig ? 'Guardando...' : 'Guardar'}
          </Btn>
        </div>
      </Sheet>

      {/* ── Mis publicaciones modal ── */}
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
                      {item.meta && <span style={{ fontFamily:PP, fontSize:10, color:C.light, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.meta}</span>}
                      <span style={{ fontFamily:PP, fontSize:10, color:C.light, flexShrink:0 }}>{item.meta ? '· ' : ''}{formatDate(item.createdAt)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setActionItem(item)}
                    style={{ width:36, height:36, borderRadius:12, border:`1px solid ${C.border}`, background:C.bg, color:C.mid, fontSize:18, cursor:'pointer', flexShrink:0 }}
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
            <Btn onClick={() => { openEditor(actionItem); setActionItem(null) }} style={{ marginBottom:10 }}>✏️ Editar publicación</Btn>
            <button
              onClick={() => handleDeletePublication(actionItem)}
              style={{ width:'100%', fontFamily:PP, fontWeight:700, fontSize:13, background:'#FEF2F2', color:'#DC2626', border:'none', borderRadius:14, padding:'12px 16px', cursor:'pointer', marginBottom:8 }}
            >
              🗑️ Borrar publicación
            </button>
            <button
              onClick={() => setActionItem(null)}
              style={{ width:'100%', fontFamily:PP, fontWeight:600, fontSize:12, color:C.mid, background:'transparent', border:`1.5px solid ${C.border}`, borderRadius:14, padding:'11px 16px', cursor:'pointer' }}
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
