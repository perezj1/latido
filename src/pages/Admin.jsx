import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { C, PP } from '../lib/theme'
import { Btn, Tag } from '../components/UI'
import { REPORT_REASONS } from '../lib/reports'

const TABS = [
  { id: 'moderation', label: 'Moderacion' },
  { id: 'reports', label: 'Reportes' },
  { id: 'users', label: 'Usuarios' },
  { id: 'content', label: 'Contenido' },
]

const STATUS_LABELS = {
  pending: 'Pendiente',
  reviewed: 'Revisado',
  actioned: 'Accionado',
  approved: 'Aprobado',
  rejected: 'Eliminado',
}

function reasonLabel(id) {
  return REPORT_REASONS.find(reason => reason.id === id)?.label || id || 'Sin motivo'
}

function fmtDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function Card({ children, style = {} }) {
  return (
    <div style={{ background:'#fff', border:`1px solid ${C.border}`, borderRadius:14, padding:14, boxShadow:'0 8px 24px rgba(15,23,42,0.05)', ...style }}>
      {children}
    </div>
  )
}

function AdminButton({ children, onClick, variant = 'secondary', disabled = false }) {
  return (
    <Btn size="sm" variant={variant} disabled={disabled} onClick={onClick} style={{ width:'auto', minWidth:0, padding:'9px 12px', borderRadius:10, fontSize:11 }}>
      {children}
    </Btn>
  )
}

async function logAdminAction(action) {
  await supabase.from('admin_actions').insert(action)
}

export default function Admin() {
  const { user } = useAuth()
  const [tab, setTab] = useState('moderation')
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState([])
  const [queue, setQueue] = useState([])
  const [users, setUsers] = useState([])
  const [recentListings, setRecentListings] = useState([])
  const [recentJobs, setRecentJobs] = useState([])
  const [contentByKey, setContentByKey] = useState(new Map())

  const stats = useMemo(() => ({
    reports: reports.filter(item => item.status === 'pending').length,
    queue: queue.filter(item => item.status === 'pending').length,
    users: users.length,
    banned: users.filter(item => item.banned).length,
  }), [queue, reports, users])

  useEffect(() => {
    loadAdminData()
  }, [])

  async function loadAdminData() {
    setLoading(true)

    const [
      reportsRes,
      queueRes,
      usersRes,
      listingsRes,
      jobsRes,
    ] = await Promise.all([
      supabase.from('reports').select('*').order('created_at', { ascending:false }).limit(120),
      supabase.from('moderation_queue').select('*').order('created_at', { ascending:false }).limit(120),
      supabase.from('profiles').select('id,name,email,canton,banned,banned_reason,banned_at,created_at').order('created_at', { ascending:false }).limit(300),
      supabase.from('listings').select('id,title,desc,cat,sub,active,user_id,user_name,canton,city,created_at').order('created_at', { ascending:false }).limit(80),
      supabase.from('jobs').select('id,title,company,desc,sector,active,user_id,canton,city,created_at').order('created_at', { ascending:false }).limit(80),
    ])

    if (reportsRes.error || queueRes.error || usersRes.error) {
      toast.error('No se pudo cargar todo el panel. Revisa que el SQL de moderacion este aplicado.')
    }

    const nextReports = reportsRes.data || []
    const nextQueue = queueRes.data || []
    const listingIds = [
      ...nextReports.filter(item => item.content_type === 'listing').map(item => item.content_id),
      ...nextQueue.filter(item => item.content_type === 'listing').map(item => item.content_id),
    ].filter(Boolean)
    const jobIds = [
      ...nextReports.filter(item => item.content_type === 'job').map(item => item.content_id),
      ...nextQueue.filter(item => item.content_type === 'job').map(item => item.content_id),
    ].filter(Boolean)
    const messageIds = nextReports.filter(item => item.content_type === 'message').map(item => item.content_id).filter(Boolean)
    const profileIds = nextReports.filter(item => item.content_type === 'profile').map(item => item.content_id).filter(Boolean)

    const [reportedListings, reportedJobs, reportedMessages, reportedProfiles] = await Promise.all([
      listingIds.length
        ? supabase.from('listings').select('id,title,desc,cat,sub,active,user_id,user_name,canton,city,created_at').in('id', listingIds)
        : Promise.resolve({ data: [] }),
      jobIds.length
        ? supabase.from('jobs').select('id,title,company,desc,sector,active,user_id,canton,city,created_at').in('id', jobIds)
        : Promise.resolve({ data: [] }),
      messageIds.length
        ? supabase.from('messages').select('id,conversation_id,sender_id,body,created_at').in('id', messageIds)
        : Promise.resolve({ data: [] }),
      profileIds.length
        ? supabase.from('profiles').select('id,name,email,canton,banned,banned_reason,created_at').in('id', profileIds)
        : Promise.resolve({ data: [] }),
    ])

    const nextContent = new Map()
    ;[...(listingsRes.data || []), ...(reportedListings.data || [])].forEach(item => nextContent.set(`listing:${item.id}`, item))
    ;[...(jobsRes.data || []), ...(reportedJobs.data || [])].forEach(item => nextContent.set(`job:${item.id}`, item))
    ;(reportedMessages.data || []).forEach(item => nextContent.set(`message:${item.id}`, item))
    ;(reportedProfiles.data || []).forEach(item => nextContent.set(`profile:${item.id}`, item))

    const baseUsers = usersRes.data || []
    const knownUserIds = new Set(baseUsers.map(item => item.id))
    const ownerIds = [
      ...nextQueue.map(item => item.author_id),
      ...nextReports.map(item => metadataOwnerId(item)),
      ...profileIds,
      ...(reportedListings.data || []).map(item => item.user_id),
      ...(reportedJobs.data || []).map(item => item.user_id),
      ...(reportedMessages.data || []).map(item => item.sender_id),
    ].filter(Boolean)
    const missingOwnerIds = [...new Set(ownerIds)].filter(id => !knownUserIds.has(id))
    const ownerProfilesRes = missingOwnerIds.length
      ? await supabase.from('profiles').select('id,name,email,canton,banned,banned_reason,banned_at,created_at').in('id', missingOwnerIds)
      : { data: [] }
    const usersById = new Map(baseUsers.map(item => [item.id, item]))
    ;(ownerProfilesRes.data || []).forEach(item => usersById.set(item.id, item))

    setReports(nextReports)
    setQueue(nextQueue)
    setUsers([...usersById.values()])
    setRecentListings(listingsRes.data || [])
    setRecentJobs(jobsRes.data || [])
    setContentByKey(nextContent)
    setLoading(false)
  }

  function metadataOwnerId(item) {
    const metadata = item?.metadata || {}
    return metadata.reported_owner_id || metadata.owner_id || metadata.author_id || ''
  }

  async function updateReport(report, status) {
    const { error } = await supabase
      .from('reports')
      .update({ status, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
      .eq('id', report.id)

    if (error) {
      toast.error(error.message || 'No se pudo actualizar el reporte')
      return
    }

    await logAdminAction({
      admin_id: user.id,
      action_type: `report_${status}`,
      target_type: report.content_type,
      target_id: report.content_id,
      notes: report.reason || '',
    })
    toast.success('Reporte actualizado')
    loadAdminData()
  }

  async function setUserBanned(profile, banned) {
    const reason = banned ? window.prompt('Motivo del baneo', profile.banned_reason || 'Uso fraudulento') : ''
    if (banned && reason === null) return

    const { error } = await supabase
      .from('profiles')
      .update({
        banned,
        banned_reason: banned ? reason : null,
        banned_at: banned ? new Date().toISOString() : null,
      })
      .eq('id', profile.id)

    if (error) {
      toast.error(error.message || 'No se pudo actualizar el usuario')
      return
    }

    await logAdminAction({
      admin_id: user.id,
      action_type: banned ? 'ban_user' : 'unban_user',
      target_type: 'profile',
      target_id: profile.id,
      notes: reason || '',
    })
    toast.success(banned ? 'Usuario baneado' : 'Usuario reactivado')
    loadAdminData()
  }

  async function setContentActive(type, id, active) {
    const table = type === 'job' ? 'jobs' : 'listings'
    const { error } = await supabase.from(table).update({ active }).eq('id', id)
    if (error) throw error
  }

  function getContentOwnerId(item) {
    if (!item) return ''
    if (item.content_type === 'profile') return item.content_id

    const content = contentByKey.get(`${item.content_type}:${item.content_id}`)
    if (item.content_type === 'message' && content?.sender_id) return content.sender_id
    if (['listing', 'job'].includes(item.content_type) && content?.user_id) return content.user_id

    return item.author_id || metadataOwnerId(item)
  }

  function getUserProfileById(profileId) {
    if (!profileId) return null
    return users.find(profile => profile.id === profileId) || { id: profileId, name: 'Usuario' }
  }

  function getContentOwnerProfile(item) {
    return getUserProfileById(getContentOwnerId(item))
  }

  function renderContentOwnerMeta(item) {
    const ownerProfile = getContentOwnerProfile(item)
    if (!ownerProfile?.id) return null

    return (
      <p style={{ fontFamily:PP, fontSize:11, color:ownerProfile.banned ? '#B91C1C' : C.light, margin:'8px 0 0', overflowWrap:'anywhere' }}>
        Autor: {ownerProfile.name || ownerProfile.email || ownerProfile.id}{ownerProfile.banned ? ' - baneado' : ''}
      </p>
    )
  }

  function banAuthorButtonLabel(item) {
    const ownerProfile = getContentOwnerProfile(item)
    if (!ownerProfile?.id) return 'Sin autor'
    if (ownerProfile.id === user.id) return 'Tu usuario'
    if (ownerProfile.banned) return 'Autor baneado'
    return 'Banear autor'
  }

  function canBanContentAuthor(item) {
    const ownerProfile = getContentOwnerProfile(item)
    return !!ownerProfile?.id && ownerProfile.id !== user.id && !ownerProfile.banned
  }

  async function banContentAuthor(item) {
    const ownerProfile = getContentOwnerProfile(item)
    if (!ownerProfile?.id) {
      toast.error('No se encontro el autor del contenido')
      return
    }
    if (ownerProfile.id === user.id) {
      toast.error('No puedes banear tu propia cuenta desde este boton')
      return
    }
    if (ownerProfile.banned) {
      toast.success('El autor ya esta baneado')
      return
    }
    await setUserBanned(ownerProfile, true)
  }

  async function resolveQueueItem(item, status) {
    try {
      if (['listing', 'job'].includes(item.content_type)) {
        await setContentActive(item.content_type, item.content_id, status === 'approved')
      }

      const { error } = await supabase
        .from('moderation_queue')
        .update({ status, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
        .eq('id', item.id)

      if (error) throw error

      await logAdminAction({
        admin_id: user.id,
        action_type: `moderation_${status}`,
        target_type: item.content_type,
        target_id: item.content_id,
        notes: item.reason || '',
      })
      toast.success(status === 'approved' ? 'Contenido aprobado' : 'Contenido eliminado')
      loadAdminData()
    } catch (error) {
      toast.error(error.message || 'No se pudo procesar')
    }
  }

  async function removeReportedContent(report) {
    try {
      if (['listing', 'job'].includes(report.content_type)) {
        await setContentActive(report.content_type, report.content_id, false)
      } else if (report.content_type === 'message') {
        await supabase.from('messages').delete().eq('id', report.content_id)
      }
      await updateReport(report, 'actioned')
    } catch (error) {
      toast.error(error.message || 'No se pudo eliminar el contenido')
    }
  }

  function renderContentSummary(contentType, contentId, fallback = '') {
    const content = contentByKey.get(`${contentType}:${contentId}`)
    if (!content) return <p style={{ fontFamily:PP, fontSize:12, color:C.light, margin:0 }}>{fallback || 'Contenido no encontrado'}</p>

    if (contentType === 'message') {
      return (
        <p style={{ fontFamily:PP, fontSize:12, color:C.text, lineHeight:1.55, margin:0 }}>
          {content.body}
        </p>
      )
    }

    if (contentType === 'profile') {
      return (
        <div>
          <p style={{ fontFamily:PP, fontWeight:800, fontSize:13, color:C.text, margin:'0 0 4px' }}>
            {content.name || 'Usuario'}
          </p>
          <p style={{ fontFamily:PP, fontSize:12, color:C.mid, lineHeight:1.5, margin:0, overflowWrap:'anywhere' }}>
            {content.email || content.id}{content.canton ? ` - ${content.canton}` : ''}
          </p>
          {content.banned && (
            <p style={{ fontFamily:PP, fontSize:11, color:'#B91C1C', margin:'5px 0 0' }}>
              Baneado: {content.banned_reason || 'Sin motivo'}
            </p>
          )}
        </div>
      )
    }

    return (
      <div>
        <p style={{ fontFamily:PP, fontWeight:800, fontSize:13, color:C.text, margin:'0 0 4px' }}>
          {content.title || content.company || 'Sin titulo'}
        </p>
        <p style={{ fontFamily:PP, fontSize:12, color:C.mid, lineHeight:1.5, margin:0 }}>
          {(content.desc || '').slice(0, 180)}
        </p>
      </div>
    )
  }

  const pendingQueue = queue.filter(item => item.status === 'pending')
  const pendingReports = reports.filter(item => item.status === 'pending')

  return (
    <div style={{ maxWidth:1100, margin:'0 auto', padding:'24px 16px 100px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, marginBottom:18 }}>
        <div>
          <h1 style={{ fontFamily:PP, fontWeight:900, fontSize:26, color:C.text, margin:'0 0 4px' }}>Centro de control</h1>
          <p style={{ fontFamily:PP, fontSize:13, color:C.light, margin:0 }}>Moderacion, reportes y usuarios de Latido.</p>
        </div>
        <AdminButton onClick={loadAdminData}>Actualizar</AdminButton>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:8, marginBottom:14 }}>
        <Card><p style={{ fontFamily:PP, fontSize:11, color:C.light, margin:0 }}>Reportes</p><strong style={{ fontFamily:PP, fontSize:22 }}>{stats.reports}</strong></Card>
        <Card><p style={{ fontFamily:PP, fontSize:11, color:C.light, margin:0 }}>Revision</p><strong style={{ fontFamily:PP, fontSize:22 }}>{stats.queue}</strong></Card>
        <Card><p style={{ fontFamily:PP, fontSize:11, color:C.light, margin:0 }}>Usuarios</p><strong style={{ fontFamily:PP, fontSize:22 }}>{stats.users}</strong></Card>
        <Card><p style={{ fontFamily:PP, fontSize:11, color:C.light, margin:0 }}>Baneados</p><strong style={{ fontFamily:PP, fontSize:22 }}>{stats.banned}</strong></Card>
      </div>

      <div style={{ display:'flex', gap:6, overflowX:'auto', marginBottom:14 }}>
        {TABS.map(item => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            style={{ fontFamily:PP, fontWeight:800, fontSize:12, borderRadius:999, border:`1.5px solid ${tab === item.id ? C.primary : C.border}`, background:tab === item.id ? C.primary : '#fff', color:tab === item.id ? '#fff' : C.mid, padding:'9px 14px', cursor:'pointer', whiteSpace:'nowrap' }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Card><p style={{ fontFamily:PP, color:C.light, margin:0 }}>Cargando panel...</p></Card>
      ) : tab === 'moderation' ? (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {pendingQueue.length === 0 ? (
            <Card><p style={{ fontFamily:PP, color:C.light, margin:0 }}>No hay contenido pendiente de revision.</p></Card>
          ) : pendingQueue.map(item => (
            <Card key={item.id}>
              <div style={{ display:'flex', justifyContent:'space-between', gap:10, marginBottom:8 }}>
                <div>
                  <Tag bg="#FEF3C7" color="#92400E">{STATUS_LABELS[item.status] || item.status}</Tag>
                  <Tag bg={C.bg} color={C.mid}>{item.content_type}</Tag>
                </div>
                <span style={{ fontFamily:PP, fontSize:11, color:C.light }}>{fmtDate(item.created_at)}</span>
              </div>
              {renderContentSummary(item.content_type, item.content_id, item.excerpt)}
              {renderContentOwnerMeta(item)}
              <p style={{ fontFamily:PP, fontSize:11, color:C.light, margin:'8px 0 12px' }}>
                Motivo: {item.reason || 'Filtro automatico'} {item.matched_term ? `- termino: ${item.matched_term}` : ''}
              </p>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <AdminButton variant="success" onClick={() => resolveQueueItem(item, 'approved')}>Aprobar</AdminButton>
                <AdminButton variant="danger" onClick={() => resolveQueueItem(item, 'rejected')}>Eliminar</AdminButton>
                <AdminButton variant="danger" disabled={!canBanContentAuthor(item)} onClick={() => banContentAuthor(item)}>
                  {banAuthorButtonLabel(item)}
                </AdminButton>
              </div>
            </Card>
          ))}
        </div>
      ) : tab === 'reports' ? (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {pendingReports.length === 0 ? (
            <Card><p style={{ fontFamily:PP, color:C.light, margin:0 }}>No hay reportes pendientes.</p></Card>
          ) : pendingReports.map(report => (
            <Card key={report.id}>
              <div style={{ display:'flex', justifyContent:'space-between', gap:10, marginBottom:8 }}>
                <div>
                  <Tag bg="#FEE2E2" color="#B91C1C">{reasonLabel(report.reason)}</Tag>
                  <Tag bg={C.bg} color={C.mid}>{report.content_type}</Tag>
                </div>
                <span style={{ fontFamily:PP, fontSize:11, color:C.light }}>{fmtDate(report.created_at)}</span>
              </div>
              {renderContentSummary(report.content_type, report.content_id)}
              {renderContentOwnerMeta(report)}
              {report.notes && <p style={{ fontFamily:PP, fontSize:12, color:C.mid, margin:'8px 0 0' }}>{report.notes}</p>}
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:12 }}>
                <AdminButton onClick={() => updateReport(report, 'reviewed')}>Mantener</AdminButton>
                <AdminButton variant="danger" onClick={() => removeReportedContent(report)}>Eliminar contenido</AdminButton>
                <AdminButton variant="danger" disabled={!canBanContentAuthor(report)} onClick={() => banContentAuthor(report)}>
                  {banAuthorButtonLabel(report)}
                </AdminButton>
              </div>
            </Card>
          ))}
        </div>
      ) : tab === 'users' ? (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {users.map(profile => (
            <Card key={profile.id}>
              <div style={{ display:'flex', justifyContent:'space-between', gap:10, alignItems:'center' }}>
                <div style={{ minWidth:0 }}>
                  <p style={{ fontFamily:PP, fontWeight:800, color:C.text, margin:'0 0 3px', overflowWrap:'anywhere' }}>{profile.name || 'Usuario'}</p>
                  <p style={{ fontFamily:PP, fontSize:12, color:C.light, margin:0, overflowWrap:'anywhere' }}>{profile.email || profile.id}</p>
                  {profile.banned && <p style={{ fontFamily:PP, fontSize:11, color:'#B91C1C', margin:'6px 0 0' }}>Baneado: {profile.banned_reason || 'Sin motivo'}</p>}
                </div>
                <AdminButton variant={profile.banned ? 'success' : 'danger'} onClick={() => setUserBanned(profile, !profile.banned)}>
                  {profile.banned ? 'Desbanear' : 'Banear'}
                </AdminButton>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:10 }}>
          <Card>
            <h2 style={{ fontFamily:PP, fontSize:16, margin:'0 0 10px' }}>Anuncios recientes</h2>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {recentListings.map(item => (
                <div key={item.id} style={{ borderTop:`1px solid ${C.border}`, paddingTop:8 }}>
                  {renderContentSummary('listing', item.id)}
                  <div style={{ display:'flex', gap:6, marginTop:8 }}>
                    <Tag bg={item.active ? '#D1FAE5' : '#FEE2E2'} color={item.active ? '#065F46' : '#B91C1C'}>{item.active ? 'Activo' : 'Oculto'}</Tag>
                    <AdminButton variant={item.active ? 'danger' : 'success'} onClick={() => setContentActive('listing', item.id, !item.active).then(loadAdminData)}>
                      {item.active ? 'Ocultar' : 'Activar'}
                    </AdminButton>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <h2 style={{ fontFamily:PP, fontSize:16, margin:'0 0 10px' }}>Empleos recientes</h2>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {recentJobs.map(item => (
                <div key={item.id} style={{ borderTop:`1px solid ${C.border}`, paddingTop:8 }}>
                  {renderContentSummary('job', item.id)}
                  <div style={{ display:'flex', gap:6, marginTop:8 }}>
                    <Tag bg={item.active ? '#D1FAE5' : '#FEE2E2'} color={item.active ? '#065F46' : '#B91C1C'}>{item.active ? 'Activo' : 'Oculto'}</Tag>
                    <AdminButton variant={item.active ? 'danger' : 'success'} onClick={() => setContentActive('job', item.id, !item.active).then(loadAdminData)}>
                      {item.active ? 'Ocultar' : 'Activar'}
                    </AdminButton>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
