import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { C, PP } from '../lib/theme'
import { Btn, Tag } from '../components/UI'
import { REPORT_REASONS } from '../lib/reports'
import { BUSINESS_VERIFICATION_STATUSES, calculateBusinessVerification, getBusinessVerificationStatus } from '../lib/businessVerification'
import { getMissingColumnName } from '../lib/supabaseCompat'

const STATUS_LABELS = {
  pending: 'Pendiente',
  reviewed: 'Revisado',
  actioned: 'Accionado',
  approved: 'Aprobado',
  rejected: 'Eliminado',
}

const BUSINESS_VERIFICATION_FILTERS = [
  { id: 'pending', label: 'Pendientes' },
  { id: 'verified', label: 'Verificados' },
  { id: 'unverified', label: 'No verificados' },
  { id: 'rejected', label: 'Rechazados' },
]

const BUSINESS_VERIFICATION_ACTIONS = [
  { id: 'pending', label: 'Pendiente', color: C.primary, bg: C.primaryLight },
  { id: 'verified', label: 'Verificado', color: '#065F46', bg: '#D1FAE5' },
  { id: 'unverified', label: 'No verificado', color: C.primary, bg: C.primaryLight },
  { id: 'rejected', label: 'Rechazado', color: '#B91C1C', bg: '#FEE2E2' },
]
const OPTIONAL_PROVIDER_VERIFICATION_COLUMNS = new Set([
  'verification_status',
  'verification_score',
  'verified_at',
  'verified_by',
  'verification_notes',
])

function reasonLabel(id) {
  return REPORT_REASONS.find(r => r.id === id)?.label || id || 'Sin motivo'
}

function fmtDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleString('es-ES', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function fmtDateShort(value) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

function countByDay(items, days = 30) {
  const counts = {}
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    counts[d.toISOString().slice(0, 10)] = 0
  }
  items.forEach(item => {
    const key = (item.created_at || '').slice(0, 10)
    if (key in counts) counts[key]++
  })
  return Object.entries(counts).map(([date, count]) => ({ date, count }))
}

function periodTrend(items, days) {
  const full = countByDay(items, days * 2)
  const cur  = full.slice(-days).reduce((s, d) => s + d.count, 0)
  const prev = full.slice(0, days).reduce((s, d) => s + d.count, 0)
  if (prev === 0) return cur > 0 ? 100 : 0
  return Math.round(((cur - prev) / prev) * 100)
}

function SparkBarChart({ data, color }) {
  const rawMax = Math.max(...data.map(d => d.count), 0)
  const axisMax = rawMax > 0 ? rawMax : 1

  const LW = 18
  const W  = 300
  const H  = 68
  const PAD_TOP = 6
  const PAD_BOT = 1
  const chartH = H - PAD_TOP - PAD_BOT
  const chartW = W - LW
  const n    = data.length
  const slot = chartW / n
  const bw   = slot * 0.65

  const mid  = Math.round(axisMax / 2)
  const ticks = [...new Set([0, mid, axisMax])]

  function yPos(value) {
    return PAD_TOP + chartH - (value / axisMax) * chartH
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 68, display: 'block' }}>
      {ticks.map(tick => {
        const y = yPos(tick)
        return (
          <g key={tick}>
            <line
              x1={LW} y1={y} x2={W} y2={y}
              stroke="#E2E8F0"
              strokeWidth={tick === 0 ? 1 : 0.7}
              strokeDasharray={tick === 0 ? '' : '3 3'}
            />
            <text
              x={LW - 3} y={y + 3.5}
              textAnchor="end"
              fontSize={8}
              fill="#94A3B8"
              fontFamily="system-ui,sans-serif"
            >
              {tick}
            </text>
          </g>
        )
      })}
      {data.map((d, i) => {
        const bh = Math.max(2, (d.count / axisMax) * chartH)
        return (
          <rect
            key={d.date}
            x={LW + i * slot + (slot - bw) / 2}
            y={yPos(0) - bh}
            width={bw}
            height={bh}
            rx={1.5}
            fill={color}
            opacity={0.82}
          />
        )
      })}
    </svg>
  )
}

function ChartCard({ title, items, color }) {
  const [days, setDays] = useState(30)
  const data  = useMemo(() => countByDay(items, days), [items, days])
  const total = data.reduce((s, d) => s + d.count, 0)
  const trend = periodTrend(items, days)
  const trendColor = trend > 0 ? '#059669' : trend < 0 ? '#DC2626' : C.mid
  const trendLabel = trend > 0 ? `↑ ${trend}%` : trend < 0 ? `↓ ${Math.abs(trend)}%` : '→ sin cambio'

  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${C.border}`,
      borderRadius: 16,
      padding: '16px 16px 10px',
      boxShadow: '0 2px 12px rgba(15,23,42,0.04)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <p style={{ fontFamily: PP, fontSize: 10, color: C.light, margin: '0 0 3px', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            {title}
          </p>
          <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 26, color: C.text, margin: 0, letterSpacing: -1 }}>
            {total}
          </p>
        </div>
        <span style={{
          fontFamily: PP, fontSize: 11, fontWeight: 700,
          color: trendColor,
          background: trendColor + '18',
          padding: '4px 9px', borderRadius: 999, marginTop: 2,
        }}>
          {trendLabel}
        </span>
      </div>
      <SparkBarChart data={data} color={color} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {[7, 30].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              style={{
                fontFamily: PP, fontSize: 9, fontWeight: 700,
                padding: '2px 7px', borderRadius: 999,
                border: `1px solid ${days === d ? C.primary : C.border}`,
                cursor: 'pointer',
                background: days === d ? C.primary : 'transparent',
                color: days === d ? '#fff' : C.light,
                transition: 'all 0.15s',
              }}
            >
              {d}d
            </button>
          ))}
        </div>
        <p style={{ fontFamily: PP, fontSize: 10, color: C.light, margin: 0 }}>
          últimos {days} días
        </p>
      </div>
    </div>
  )
}

function StatCard({ id, icon, label, value, sub, color, isActive, onClick, urgent }) {
  const hasAlert = urgent && value > 0
  return (
    <button
      onClick={onClick}
      style={{
        background: isActive ? `${color}12` : '#fff',
        border: `2px solid ${isActive ? color : hasAlert ? `${color}50` : C.border}`,
        borderRadius: 16,
        padding: '16px',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        transition: 'border-color .15s, background .15s',
        position: 'relative',
      }}
    >
      {hasAlert && (
        <span style={{
          position: 'absolute', top: 12, right: 12,
          width: 8, height: 8, borderRadius: '50%',
          background: color,
          boxShadow: `0 0 0 3px ${color}30`,
        }} />
      )}
      <span style={{ fontSize: 20 }}>{icon}</span>
      <p style={{
        fontFamily: PP, fontWeight: 900,
        fontSize: value === '—' ? 22 : String(value).length > 4 ? 22 : 30,
        color: isActive ? color : C.text,
        margin: '6px 0 2px', lineHeight: 1, letterSpacing: -1,
      }}>
        {value}
      </p>
      <p style={{ fontFamily: PP, fontSize: 12, color: isActive ? color : C.mid, margin: 0, fontWeight: 700 }}>
        {label}
      </p>
      {sub != null && (
        <p style={{ fontFamily: PP, fontSize: 10, color: C.light, margin: '4px 0 0' }}>{sub}</p>
      )}
    </button>
  )
}

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${C.border}`,
      borderRadius: 14,
      padding: 16,
      boxShadow: '0 2px 12px rgba(15,23,42,0.04)',
      ...style,
    }}>
      {children}
    </div>
  )
}

function AdminButton({ children, onClick, variant = 'secondary', disabled = false }) {
  return (
    <Btn
      size="sm"
      variant={variant}
      disabled={disabled}
      onClick={onClick}
      style={{ width: 'auto', minWidth: 0, padding: '9px 12px', borderRadius: 10, fontSize: 11 }}
    >
      {children}
    </Btn>
  )
}

function EmptyState({ icon, text }) {
  return (
    <Card style={{ textAlign: 'center', padding: '40px 24px' }}>
      <div style={{ fontSize: 36, marginBottom: 10 }}>{icon}</div>
      <p style={{ fontFamily: PP, color: C.light, margin: 0, fontSize: 14 }}>{text}</p>
    </Card>
  )
}

async function logAdminAction(action) {
  await supabase.from('admin_actions').insert(action)
}

export default function Admin() {
  const { user } = useAuth()
  const [tab, setTab] = useState('moderation')
  const [loading, setLoading] = useState(true)
  const [userSearch, setUserSearch] = useState('')
  const [reports, setReports] = useState([])
  const [queue, setQueue] = useState([])
  const [users, setUsers] = useState([])
  const [recentListings, setRecentListings] = useState([])
  const [recentJobs, setRecentJobs] = useState([])
  const [businesses, setBusinesses] = useState([])
  const [businessVerificationFilter, setBusinessVerificationFilter] = useState('pending')
  const [contentByKey, setContentByKey] = useState(new Map())

  const stats = useMemo(() => ({
    reports: reports.filter(r => r.status === 'pending').length,
    queue: queue.filter(r => r.status === 'pending').length,
    users: users.length,
    banned: users.filter(u => u.banned).length,
    content: recentListings.length + recentJobs.length,
    businessVerification: businesses.filter(b => getBusinessVerificationDetails(b).status === 'pending').length,
  }), [businesses, queue, reports, users, recentListings, recentJobs])

  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return users
    const q = userSearch.toLowerCase()
    return users.filter(u =>
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.canton || '').toLowerCase().includes(q)
    )
  }, [users, userSearch])

  useEffect(() => { loadAdminData() }, [])

  async function loadAdminData() {
    setLoading(true)
    const [reportsRes, queueRes, usersRes, listingsRes, jobsRes, providersRes] = await Promise.all([
      supabase.from('reports').select('*').order('created_at', { ascending: false }).limit(120),
      supabase.from('moderation_queue').select('*').order('created_at', { ascending: false }).limit(120),
      supabase.from('profiles').select('id,name,email,canton,banned,banned_reason,banned_at,created_at').order('created_at', { ascending: false }).limit(300),
      supabase.from('listings').select('id,title,desc,cat,sub,active,user_id,user_name,canton,city,created_at').order('created_at', { ascending: false }).limit(80),
      supabase.from('jobs').select('id,title,company,desc,sector,active,user_id,canton,city,created_at').order('created_at', { ascending: false }).limit(80),
      supabase.from('providers').select('*').order('created_at', { ascending: false }).limit(300),
    ])

    if (reportsRes.error || queueRes.error || usersRes.error) {
      toast.error('No se pudo cargar todo el panel. Revisa que el SQL de moderacion este aplicado.')
    }

    const nextReports = reportsRes.data || []
    const nextQueue = queueRes.data || []

    const listingIds = [
      ...nextReports.filter(r => r.content_type === 'listing').map(r => r.content_id),
      ...nextQueue.filter(r => r.content_type === 'listing').map(r => r.content_id),
    ].filter(Boolean)
    const jobIds = [
      ...nextReports.filter(r => r.content_type === 'job').map(r => r.content_id),
      ...nextQueue.filter(r => r.content_type === 'job').map(r => r.content_id),
    ].filter(Boolean)
    const messageIds = nextReports.filter(r => r.content_type === 'message').map(r => r.content_id).filter(Boolean)
    const profileIds = nextReports.filter(r => r.content_type === 'profile').map(r => r.content_id).filter(Boolean)

    const [reportedListings, reportedJobs, reportedMessages, reportedProfiles] = await Promise.all([
      listingIds.length ? supabase.from('listings').select('id,title,desc,cat,sub,active,user_id,user_name,canton,city,created_at').in('id', listingIds) : Promise.resolve({ data: [] }),
      jobIds.length ? supabase.from('jobs').select('id,title,company,desc,sector,active,user_id,canton,city,created_at').in('id', jobIds) : Promise.resolve({ data: [] }),
      messageIds.length ? supabase.from('messages').select('id,conversation_id,sender_id,body,created_at').in('id', messageIds) : Promise.resolve({ data: [] }),
      profileIds.length ? supabase.from('profiles').select('id,name,email,canton,banned,banned_reason,created_at').in('id', profileIds) : Promise.resolve({ data: [] }),
    ])

    const nextContent = new Map()
    ;[...(listingsRes.data || []), ...(reportedListings.data || [])].forEach(item => nextContent.set(`listing:${item.id}`, item))
    ;[...(jobsRes.data || []), ...(reportedJobs.data || [])].forEach(item => nextContent.set(`job:${item.id}`, item))
    ;(reportedMessages.data || []).forEach(item => nextContent.set(`message:${item.id}`, item))
    ;(reportedProfiles.data || []).forEach(item => nextContent.set(`profile:${item.id}`, item))

    const baseUsers = usersRes.data || []
    const knownUserIds = new Set(baseUsers.map(u => u.id))
    const ownerIds = [
      ...nextQueue.map(q => q.author_id),
      ...nextReports.map(r => metadataOwnerId(r)),
      ...profileIds,
      ...(reportedListings.data || []).map(l => l.user_id),
      ...(reportedJobs.data || []).map(j => j.user_id),
      ...(reportedMessages.data || []).map(m => m.sender_id),
    ].filter(Boolean)
    const missingOwnerIds = [...new Set(ownerIds)].filter(id => !knownUserIds.has(id))
    const ownerProfilesRes = missingOwnerIds.length
      ? await supabase.from('profiles').select('id,name,email,canton,banned,banned_reason,banned_at,created_at').in('id', missingOwnerIds)
      : { data: [] }
    const usersById = new Map(baseUsers.map(u => [u.id, u]))
    ;(ownerProfilesRes.data || []).forEach(u => usersById.set(u.id, u))

    setReports(nextReports)
    setQueue(nextQueue)
    setUsers([...usersById.values()])
    setRecentListings(listingsRes.data || [])
    setRecentJobs(jobsRes.data || [])
    setBusinesses(providersRes.data || [])
    setContentByKey(nextContent)
    setLoading(false)
  }

  function metadataOwnerId(item) {
    const m = item?.metadata || {}
    return m.reported_owner_id || m.owner_id || m.author_id || ''
  }

  async function updateReport(report, status) {
    const { error } = await supabase
      .from('reports')
      .update({ status, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
      .eq('id', report.id)
    if (error) { toast.error(error.message || 'No se pudo actualizar el reporte'); return }
    await logAdminAction({ admin_id: user.id, action_type: `report_${status}`, target_type: report.content_type, target_id: report.content_id, notes: report.reason || '' })
    toast.success('Reporte actualizado')
    loadAdminData()
  }

  async function setUserBanned(profile, banned) {
    const reason = banned ? window.prompt('Motivo del baneo', profile.banned_reason || 'Uso fraudulento') : ''
    if (banned && reason === null) return
    const { error } = await supabase.from('profiles')
      .update({ banned, banned_reason: banned ? reason : null, banned_at: banned ? new Date().toISOString() : null })
      .eq('id', profile.id)
    if (error) { toast.error(error.message || 'No se pudo actualizar el usuario'); return }
    await logAdminAction({ admin_id: user.id, action_type: banned ? 'ban_user' : 'unban_user', target_type: 'profile', target_id: profile.id, notes: reason || '' })
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

  function getUserProfileById(id) {
    if (!id) return null
    return users.find(u => u.id === id) || { id, name: 'Usuario' }
  }

  function getContentOwnerProfile(item) {
    return getUserProfileById(getContentOwnerId(item))
  }

  function getBusinessVerificationDetails(business) {
    const computed = calculateBusinessVerification(business, { existingBusinesses: businesses })
    const storedStatus = getBusinessVerificationStatus(business)
    const hasStoredStatus = !!business?.verification_status && BUSINESS_VERIFICATION_STATUSES[business.verification_status]
    return {
      ...computed,
      score: computed.score,
      status: hasStoredStatus || business?.verified ? storedStatus : computed.status,
    }
  }

  async function persistBusinessVerification(business, patch) {
    const nextPatch = { ...patch }
    const strippedColumns = []

    while (true) {
      const result = await supabase
        .from('providers')
        .update(nextPatch)
        .eq('id', business.id)
        .select('*')
        .maybeSingle()

      if (!result.error) {
        return { ...result, patch: nextPatch, strippedColumns }
      }

      const missingColumn = getMissingColumnName(result.error, 'providers')
      if (
        !missingColumn ||
        !OPTIONAL_PROVIDER_VERIFICATION_COLUMNS.has(missingColumn) ||
        !(missingColumn in nextPatch)
      ) {
        return { ...result, patch: nextPatch, strippedColumns }
      }

      delete nextPatch[missingColumn]
      strippedColumns.push(missingColumn)
    }
  }

  async function updateBusinessVerification(business, status) {
    const details = getBusinessVerificationDetails(business)
    const now = new Date().toISOString()
    let notes = business.verification_notes || null

    if (status === 'rejected') {
      notes = window.prompt('Motivo del rechazo', notes || 'Datos insuficientes o no verificables')
      if (notes === null) return
    }

    const patch = {
      verification_status: status,
      verification_score: details.score,
      verified: status === 'verified',
      verified_at: status === 'verified' ? now : null,
      verified_by: status === 'verified' ? user.id : null,
      verification_notes: status === 'rejected' ? notes : null,
    }

    const { data: savedBusiness, error, patch: savedPatch, strippedColumns } = await persistBusinessVerification(business, patch)
    if (error) {
      toast.error(error.message?.includes('verification_')
        ? 'Aplica primero el SQL de verificacion en Supabase.'
        : error.message || 'No se pudo actualizar el negocio')
      return
    }

    if (!savedBusiness) {
      toast.error('No se guardó el cambio. Revisa la política RLS de providers para permitir actualizar negocios desde admin.')
      return
    }

    setBusinesses(prev => prev.map(item => String(item.id) === String(business.id) ? { ...item, ...savedPatch, ...savedBusiness } : item))

    try {
      await logAdminAction({
        admin_id: user.id,
        action_type: `business_verification_${status}`,
        target_type: 'provider',
        target_id: business.id,
        notes: `Score ${details.score}/100${notes ? ` - ${notes}` : ''}`,
      })
    } catch (error) {
      console.warn('Admin action log failed:', error)
    }
    toast.success(strippedColumns.length
      ? 'Estado guardado en la columna verified'
      : status === 'verified' ? 'Negocio verificado' : 'Estado actualizado')
  }

  function renderContentOwnerMeta(item) {
    const p = getContentOwnerProfile(item)
    if (!p?.id) return null
    return (
      <p style={{ fontFamily: PP, fontSize: 11, color: p.banned ? '#B91C1C' : C.light, margin: '8px 0 0', overflowWrap: 'anywhere' }}>
        Autor: {p.name || p.email || p.id}{p.banned ? ' · baneado' : ''}
      </p>
    )
  }

  function banAuthorButtonLabel(item) {
    const p = getContentOwnerProfile(item)
    if (!p?.id) return 'Sin autor'
    if (p.id === user.id) return 'Tu usuario'
    if (p.banned) return 'Autor baneado'
    return 'Banear autor'
  }

  function canBanContentAuthor(item) {
    const p = getContentOwnerProfile(item)
    return !!p?.id && p.id !== user.id && !p.banned
  }

  async function banContentAuthor(item) {
    const p = getContentOwnerProfile(item)
    if (!p?.id) { toast.error('No se encontro el autor'); return }
    if (p.id === user.id) { toast.error('No puedes banear tu propia cuenta'); return }
    if (p.banned) { toast.success('El autor ya esta baneado'); return }
    await setUserBanned(p, true)
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
      await logAdminAction({ admin_id: user.id, action_type: `moderation_${status}`, target_type: item.content_type, target_id: item.content_id, notes: item.reason || '' })
      toast.success(status === 'approved' ? 'Contenido aprobado' : 'Contenido eliminado')
      loadAdminData()
    } catch (err) {
      toast.error(err.message || 'No se pudo procesar')
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
    } catch (err) {
      toast.error(err.message || 'No se pudo eliminar el contenido')
    }
  }

  function renderContentSummary(contentType, contentId, fallback = '') {
    const content = contentByKey.get(`${contentType}:${contentId}`)
    if (!content) return <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: 0 }}>{fallback || 'Contenido no encontrado'}</p>

    if (contentType === 'message') {
      return (
        <p style={{ fontFamily: PP, fontSize: 13, color: C.text, lineHeight: 1.55, margin: 0, fontStyle: 'italic' }}>
          "{content.body}"
        </p>
      )
    }
    if (contentType === 'profile') {
      return (
        <div>
          <p style={{ fontFamily: PP, fontWeight: 800, fontSize: 14, color: C.text, margin: '0 0 3px' }}>{content.name || 'Usuario'}</p>
          <p style={{ fontFamily: PP, fontSize: 12, color: C.mid, lineHeight: 1.5, margin: 0, overflowWrap: 'anywhere' }}>
            {content.email || content.id}{content.canton ? ` · ${content.canton}` : ''}
          </p>
          {content.banned && (
            <p style={{ fontFamily: PP, fontSize: 11, color: '#B91C1C', margin: '5px 0 0' }}>
              Baneado: {content.banned_reason || 'Sin motivo'}
            </p>
          )}
        </div>
      )
    }
    return (
      <div>
        <p style={{ fontFamily: PP, fontWeight: 800, fontSize: 14, color: C.text, margin: '0 0 4px' }}>
          {content.title || content.company || 'Sin titulo'}
        </p>
        <p style={{ fontFamily: PP, fontSize: 12, color: C.mid, lineHeight: 1.5, margin: 0 }}>
          {(content.desc || '').slice(0, 200)}
        </p>
      </div>
    )
  }

  const pendingQueue = queue.filter(q => q.status === 'pending')
  const pendingReports = reports.filter(r => r.status === 'pending')
  const businessVerificationCounts = BUSINESS_VERIFICATION_FILTERS.reduce((acc, item) => {
    acc[item.id] = businesses.filter(business => getBusinessVerificationDetails(business).status === item.id).length
    return acc
  }, {})
  const filteredVerificationBusinesses = businesses
    .filter(business => getBusinessVerificationDetails(business).status === businessVerificationFilter)
    .sort((a, b) => getBusinessVerificationDetails(b).score - getBusinessVerificationDetails(a).score)

  const STAT_CARDS = [
    { id: 'moderation', icon: '⏳', label: 'En revisión', value: loading ? '—' : stats.queue,   color: '#D97706', urgent: true,  sub: 'Cola de moderación' },
    { id: 'reports',    icon: '🚨', label: 'Reportes',    value: loading ? '—' : stats.reports, color: '#DC2626', urgent: true,  sub: 'Denuncias pendientes' },
    { id: 'businessVerification', icon: '✓', label: 'Negocios', value: loading ? '—' : stats.businessVerification, color: '#059669', urgent: true, sub: 'Pendientes de verificar' },
    { id: 'users',      icon: '👥', label: 'Usuarios',    value: loading ? '—' : stats.users,   color: C.primary, urgent: false, sub: `${loading ? '—' : stats.banned} baneados` },
    { id: 'content',    icon: '📋', label: 'Contenido',   value: loading ? '—' : stats.content, color: '#059669', urgent: false, sub: 'Anuncios y empleos' },
  ]

  const SECTION_TITLES = {
    moderation: { icon: '⏳', label: 'Cola de revisión' },
    reports:    { icon: '🚨', label: 'Reportes pendientes' },
    businessVerification: { icon: '✓', label: 'Verificación de negocios' },
    users:      { icon: '👥', label: 'Usuarios' },
    content:    { icon: '📋', label: 'Contenido reciente' },
  }

  const activeSection = tab === 'content'
    ? { ...SECTION_TITLES.content, label: 'Publicaciones recientes' }
    : SECTION_TITLES[tab]
  const activeChart =
    tab === 'users'
      ? <ChartCard title="Usuarios registrados" items={users} color={C.primary} />
      : tab === 'reports'
        ? <ChartCard title="Reportes recibidos" items={reports} color="#DC2626" />
        : tab === 'content'
          ? <ChartCard title="Publicaciones" items={[...recentListings, ...recentJobs]} color="#059669" />
          : null
  const showChartPlaceholder = ['users', 'reports', 'content'].includes(tab)

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px 100px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: PP, fontWeight: 900, fontSize: 26, color: C.text, margin: '0 0 4px', letterSpacing: -0.5 }}>
            Centro de control
          </h1>
          <p style={{ fontFamily: PP, fontSize: 13, color: C.light, margin: 0 }}>
            Moderación, reportes y usuarios de Latido.
          </p>
        </div>
        <button
          onClick={loadAdminData}
          style={{ fontFamily: PP, fontWeight: 700, fontSize: 12, background: '#fff', color: C.mid, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '9px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <span style={{ fontSize: 14 }}>↻</span> Actualizar
        </button>
      </div>

      {/* Stat cards — double as navigation */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
        {STAT_CARDS.map(card => (
          <StatCard
            key={card.id}
            {...card}
            label={card.id === 'content' ? 'Publicaciones' : card.label}
            isActive={tab === card.id}
            onClick={() => setTab(card.id)}
          />
        ))}
      </div>

      {/* Context chart */}
      {!loading && activeChart && (
        <div style={{ marginBottom: 24 }}>
          {activeChart}
        </div>
      )}

      {loading && showChartPlaceholder && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 16, padding: '16px', height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: 0 }}>Cargando...</p>
          </div>
        </div>
      )}

      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <h2 style={{ fontFamily: PP, fontWeight: 800, fontSize: 15, color: C.text, margin: 0, whiteSpace: 'nowrap' }}>
          {activeSection.icon} {activeSection.label}
        </h2>
        <div style={{ flex: 1, height: 1, background: C.border }} />
      </div>

      {/* ── Moderación ─────────────────────────────────── */}
      {tab === 'moderation' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pendingQueue.length === 0 ? (
            <EmptyState icon="✅" text="No hay contenido pendiente de revisión." />
          ) : pendingQueue.map(item => (
            <Card key={item.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Tag bg="#FEF3C7" color="#92400E">{STATUS_LABELS[item.status] || item.status}</Tag>
                  <Tag bg={C.bg} color={C.mid}>{item.content_type}</Tag>
                </div>
                <span style={{ fontFamily: PP, fontSize: 11, color: C.light, whiteSpace: 'nowrap' }}>{fmtDate(item.created_at)}</span>
              </div>
              {renderContentSummary(item.content_type, item.content_id, item.excerpt)}
              {renderContentOwnerMeta(item)}
              <p style={{ fontFamily: PP, fontSize: 11, color: C.light, margin: '8px 0 12px' }}>
                Motivo: {item.reason || 'Filtro automático'}{item.matched_term ? ` · término: "${item.matched_term}"` : ''}
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <AdminButton variant="success" onClick={() => resolveQueueItem(item, 'approved')}>✓ Aprobar</AdminButton>
                <AdminButton variant="danger"  onClick={() => resolveQueueItem(item, 'rejected')}>✕ Eliminar</AdminButton>
                <AdminButton variant="danger" disabled={!canBanContentAuthor(item)} onClick={() => banContentAuthor(item)}>
                  🚫 {banAuthorButtonLabel(item)}
                </AdminButton>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Reportes ───────────────────────────────────── */}
      {tab === 'reports' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pendingReports.length === 0 ? (
            <EmptyState icon="✅" text="No hay reportes pendientes." />
          ) : pendingReports.map(report => (
            <Card key={report.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Tag bg="#FEE2E2" color="#B91C1C">{reasonLabel(report.reason)}</Tag>
                  <Tag bg={C.bg} color={C.mid}>{report.content_type}</Tag>
                </div>
                <span style={{ fontFamily: PP, fontSize: 11, color: C.light, whiteSpace: 'nowrap' }}>{fmtDate(report.created_at)}</span>
              </div>
              {renderContentSummary(report.content_type, report.content_id)}
              {renderContentOwnerMeta(report)}
              {report.notes && (
                <p style={{ fontFamily: PP, fontSize: 12, color: C.mid, margin: '8px 0 0', fontStyle: 'italic' }}>
                  "{report.notes}"
                </p>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                <AdminButton onClick={() => updateReport(report, 'reviewed')}>✓ Mantener</AdminButton>
                <AdminButton variant="danger" onClick={() => removeReportedContent(report)}>✕ Eliminar contenido</AdminButton>
                <AdminButton variant="danger" disabled={!canBanContentAuthor(report)} onClick={() => banContentAuthor(report)}>
                  🚫 {banAuthorButtonLabel(report)}
                </AdminButton>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Verificación de negocios ───────────────────────────────────── */}
      {tab === 'businessVerification' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {BUSINESS_VERIFICATION_FILTERS.map(item => (
              <button
                key={item.id}
                onClick={() => setBusinessVerificationFilter(item.id)}
                style={{
                  fontFamily: PP,
                  fontWeight: 800,
                  fontSize: 11,
                  borderRadius: 999,
                  border: `1.5px solid ${businessVerificationFilter === item.id ? C.primary : C.border}`,
                  background: businessVerificationFilter === item.id ? C.primary : '#fff',
                  color: businessVerificationFilter === item.id ? '#fff' : C.mid,
                  padding: '8px 11px',
                  cursor: 'pointer',
                }}
              >
                {item.label} ({businessVerificationCounts[item.id] || 0})
              </button>
            ))}
          </div>

          {filteredVerificationBusinesses.length === 0 ? (
            <EmptyState icon="✓" text="No hay negocios en este estado." />
          ) : filteredVerificationBusinesses.map(business => {
            const details = getBusinessVerificationDetails(business)
            const statusMeta = BUSINESS_VERIFICATION_STATUSES[details.status] || BUSINESS_VERIFICATION_STATUSES.unverified
            const description = business.description || business.desc || ''
            const contactBits = [
              business.whatsapp || business.phone,
              business.email,
              business.website,
            ].filter(Boolean)

            return (
              <Card key={business.id}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  {business.photo_url ? (
                    <img
                      src={business.photo_url}
                      alt={business.name || 'Negocio'}
                      style={{ width: 74, height: 74, objectFit: 'contain', borderRadius: 12, background: C.bg, border: `1px solid ${C.border}`, flexShrink: 0 }}
                    />
                  ) : (
                    <div style={{ width: 74, height: 74, borderRadius: 12, background: C.bg, display: 'grid', placeItems: 'center', fontSize: 28, flexShrink: 0 }}>🏪</div>
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 15, color: C.text, margin: '0 0 3px', overflowWrap: 'anywhere' }}>
                          {business.name || 'Negocio sin nombre'}
                        </p>
                        <p style={{ fontFamily: PP, fontSize: 11, color: C.light, margin: 0, overflowWrap: 'anywhere' }}>
                          {[business.category, business.city || business.canton].filter(Boolean).join(' · ') || 'Sin categoría'}
                        </p>
                      </div>
                      <Tag bg={statusMeta.bg} color={statusMeta.color}>{statusMeta.label}</Tag>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <div style={{ flex: 1, height: 8, background: C.border, borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(details.score, 100)}%`, height: '100%', background: details.score >= 80 ? '#10B981' : details.score >= 50 ? '#F59E0B' : '#EF4444' }} />
                      </div>
                      <span style={{ fontFamily: PP, fontSize: 12, fontWeight: 900, color: C.text, whiteSpace: 'nowrap' }}>
                        {details.score}/100
                      </span>
                    </div>

                    {description && (
                      <p style={{ fontFamily: PP, fontSize: 12, color: C.mid, lineHeight: 1.55, margin: '0 0 8px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {description}
                      </p>
                    )}

                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
                      {details.criteria.map(item => (
                        <span
                          key={item.id}
                          style={{
                            fontFamily: PP,
                            fontWeight: 700,
                            fontSize: 10,
                            color: item.passed ? '#065F46' : '#B91C1C',
                            background: item.passed ? '#ECFDF5' : '#FEF2F2',
                            borderRadius: 999,
                            padding: '3px 8px',
                          }}
                        >
                          {item.passed ? '✓' : '×'} {item.label} (+{item.points})
                        </span>
                      ))}
                    </div>

                    <p style={{ fontFamily: PP, fontSize: 11, color: C.light, margin: '0 0 10px', overflowWrap: 'anywhere' }}>
                      Contacto: {contactBits.length ? contactBits.join(' · ') : 'sin contacto'}{business.verification_notes ? ` · Nota: ${business.verification_notes}` : ''}
                    </p>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {BUSINESS_VERIFICATION_ACTIONS.map(action => {
                        const isCurrent = details.status === action.id
                        return (
                          <button
                            key={action.id}
                            type="button"
                            onClick={() => updateBusinessVerification(business, action.id)}
                            style={{
                              fontFamily: PP,
                              fontWeight: 800,
                              fontSize: 11,
                              borderRadius: 10,
                              border: `1.5px solid ${isCurrent ? action.color : action.bg}`,
                              background: action.bg,
                              color: action.color,
                              padding: '9px 12px',
                              cursor: 'pointer',
                              boxShadow: isCurrent ? `0 0 0 3px ${action.bg}` : 'none',
                            }}
                          >
                            {isCurrent ? 'Actual: ' : ''}{action.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* ── Usuarios ───────────────────────────────────── */}
      {tab === 'users' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Search */}
          <div style={{ position: 'relative', marginBottom: 4 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, pointerEvents: 'none' }}>🔍</span>
            <input
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              placeholder="Buscar por nombre, email o cantón..."
              style={{
                width: '100%', boxSizing: 'border-box',
                fontFamily: PP, fontSize: 13, color: C.text,
                background: '#fff', border: `1.5px solid ${C.border}`,
                borderRadius: 12, padding: '11px 14px 11px 36px',
                outline: 'none',
              }}
            />
          </div>

          {/* Summary bar */}
          <div style={{ display: 'flex', gap: 16, padding: '10px 14px', background: C.bg, borderRadius: 12, marginBottom: 4 }}>
            <span style={{ fontFamily: PP, fontSize: 12, color: C.mid }}>
              <strong style={{ color: C.text }}>{filteredUsers.length}</strong> mostrados
            </span>
            <span style={{ fontFamily: PP, fontSize: 12, color: C.mid }}>
              <strong style={{ color: '#DC2626' }}>{users.filter(u => u.banned).length}</strong> baneados
            </span>
            <span style={{ fontFamily: PP, fontSize: 12, color: C.mid }}>
              <strong style={{ color: C.text }}>{users.length}</strong> total
            </span>
          </div>

          {filteredUsers.length === 0 ? (
            <EmptyState icon="👤" text="No se encontraron usuarios." />
          ) : filteredUsers.map(profile => (
            <Card key={profile.id} style={{ padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <p style={{ fontFamily: PP, fontWeight: 800, fontSize: 14, color: C.text, margin: 0, overflowWrap: 'anywhere' }}>
                      {profile.name || 'Sin nombre'}
                    </p>
                    {profile.banned && (
                      <span style={{ fontFamily: PP, fontSize: 10, fontWeight: 700, color: '#B91C1C', background: '#FEE2E2', borderRadius: 999, padding: '2px 8px' }}>
                        BANEADO
                      </span>
                    )}
                  </div>
                  <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: '2px 0 0', overflowWrap: 'anywhere' }}>
                    {profile.email || profile.id}
                    {profile.canton ? ` · ${profile.canton}` : ''}
                    {profile.created_at ? ` · desde ${fmtDateShort(profile.created_at)}` : ''}
                  </p>
                  {profile.banned && profile.banned_reason && (
                    <p style={{ fontFamily: PP, fontSize: 11, color: '#B91C1C', margin: '5px 0 0' }}>
                      Motivo: {profile.banned_reason}
                    </p>
                  )}
                </div>
                <AdminButton
                  variant={profile.banned ? 'success' : 'danger'}
                  onClick={() => setUserBanned(profile, !profile.banned)}
                >
                  {profile.banned ? '↩ Desbanear' : '🚫 Banear'}
                </AdminButton>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Contenido ──────────────────────────────────── */}
      {tab === 'content' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
          {/* Anuncios */}
          <div>
            <p style={{ fontFamily: PP, fontWeight: 800, fontSize: 13, color: C.mid, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Anuncios recientes
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentListings.length === 0 ? (
                <EmptyState icon="📭" text="Sin anuncios recientes." />
              ) : recentListings.map(item => (
                <Card key={item.id} style={{ padding: '12px 14px' }}>
                  {renderContentSummary('listing', item.id)}
                  <div style={{ display: 'flex', gap: 6, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Tag bg={item.active ? '#D1FAE5' : '#FEE2E2'} color={item.active ? '#065F46' : '#B91C1C'}>
                      {item.active ? 'Activo' : 'Oculto'}
                    </Tag>
                    <span style={{ fontFamily: PP, fontSize: 11, color: C.light, flex: 1 }}>{fmtDate(item.created_at)}</span>
                    <AdminButton
                      variant={item.active ? 'danger' : 'success'}
                      onClick={() => setContentActive('listing', item.id, !item.active).then(loadAdminData)}
                    >
                      {item.active ? 'Ocultar' : 'Activar'}
                    </AdminButton>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Empleos */}
          <div>
            <p style={{ fontFamily: PP, fontWeight: 800, fontSize: 13, color: C.mid, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Empleos recientes
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentJobs.length === 0 ? (
                <EmptyState icon="📭" text="Sin empleos recientes." />
              ) : recentJobs.map(item => (
                <Card key={item.id} style={{ padding: '12px 14px' }}>
                  {renderContentSummary('job', item.id)}
                  <div style={{ display: 'flex', gap: 6, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Tag bg={item.active ? '#D1FAE5' : '#FEE2E2'} color={item.active ? '#065F46' : '#B91C1C'}>
                      {item.active ? 'Activo' : 'Oculto'}
                    </Tag>
                    <span style={{ fontFamily: PP, fontSize: 11, color: C.light, flex: 1 }}>{fmtDate(item.created_at)}</span>
                    <AdminButton
                      variant={item.active ? 'danger' : 'success'}
                      onClick={() => setContentActive('job', item.id, !item.active).then(loadAdminData)}
                    >
                      {item.active ? 'Ocultar' : 'Activar'}
                    </AdminButton>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
