import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { C, PP } from '../lib/theme'
import { Btn, Tag } from '../components/UI'
import { REPORT_REASONS } from '../lib/reports'
import { BUSINESS_VERIFICATION_STATUSES, calculateBusinessVerification, getBusinessVerificationStatus } from '../lib/businessVerification'
import { getMissingColumnName } from '../lib/supabaseCompat'
import { subscribeToOnlineUsers, subscribeToPresenceStatus } from '../lib/presence'
import { isAdminEmail } from '../lib/admin'

const STATUS_LABELS = {
  pending: 'Pendiente',
  reviewed: 'Revisado',
  actioned: 'Accionado',
  approved: 'Aprobado',
  rejected: 'Eliminado',
}

const BUSINESS_VERIFICATION_FILTERS = [
  { id: 'pending', label: 'Pendientes', color: '#D97706', bg: '#FFFBEB' },
  { id: 'unverified', label: 'No verificados', color: C.primary, bg: C.primaryLight },
  { id: 'verified', label: 'Verificados', color: '#059669', bg: '#ECFDF5' },
  { id: 'rejected', label: 'Rechazados', color: '#DC2626', bg: '#FEF2F2' },
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

function fmtActivity(value) {
  if (!value) return 'Sin actividad'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin actividad'
  const diff = Date.now() - date.getTime()
  if (diff < 60_000) return 'Ahora'
  if (diff < 3_600_000) return `Hace ${Math.max(1, Math.floor(diff / 60_000))} min`
  if (diff < 86_400_000) return `Hace ${Math.floor(diff / 3_600_000)} h`
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

function isWithinRecentDays(value, days) {
  if (!value) return false
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return false
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  if (days > 1) start.setDate(start.getDate() - (days - 1))
  return date >= start
}

function countRecent(items, days) {
  return items.filter(item => isWithinRecentDays(item.created_at, days)).length
}

function localDateKey(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function countByDay(items, days = 30) {
  const counts = {}
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    counts[localDateKey(d)] = 0
  }
  items.forEach(item => {
    const key = localDateKey(item.created_at)
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

function readMetadata(value) {
  if (!value) return {}
  if (typeof value === 'object') return value
  try { return JSON.parse(value) } catch { return {} }
}

function pageLabel(path = '') {
  const clean = String(path || '/').split('?')[0]
  if (clean === '/') return 'Inicio'
  if (clean.startsWith('/tablon')) return 'Anuncios'
  if (clean.startsWith('/anuncios/')) return 'Detalle de anuncio'
  if (clean.startsWith('/empleos/')) return 'Detalle de empleo'
  if (clean.startsWith('/comunidades')) return 'Comunidad'
  if (clean.startsWith('/negocios/')) return 'Perfil de negocio'
  if (clean.startsWith('/eventos/')) return 'Evento'
  if (clean.startsWith('/mensajes')) return 'Mensajes'
  if (clean.startsWith('/perfil')) return 'Perfil'
  if (clean.startsWith('/publicar-empleo')) return 'Publicar empleo'
  if (clean.startsWith('/publicar-evento')) return 'Publicar evento'
  if (clean.startsWith('/registrar-negocio')) return 'Registrar negocio'
  if (clean.startsWith('/registrar-comunidad')) return 'Registrar grupo'
  if (clean.startsWith('/publicar')) return 'Publicar anuncio'
  if (clean.startsWith('/guias')) return 'Guías'
  if (clean.startsWith('/auth')) return 'Acceso'
  if (clean.startsWith('/admin-latido')) return 'Admin'
  return clean
}

function topAnalyticsRows(items, labelFn, limit = 8, subFn) {
  const map = new Map()
  items.forEach(item => {
    const label = String(labelFn(item) || '').trim()
    if (!label) return
    const current = map.get(label) || { label, value: 0, sub: '' }
    current.value += 1
    if (!current.sub && subFn) current.sub = subFn(item) || ''
    map.set(label, current)
  })
  return [...map.values()].sort((a, b) => b.value - a.value).slice(0, limit)
}

function analyticsQuery(event) {
  const metadata = readMetadata(event.metadata)
  return String(metadata.query || '').trim()
}

function analyticsScope(event) {
  const metadata = readMetadata(event.metadata)
  const scope = metadata.scope || 'global'
  const labels = {
    global: 'Búsqueda global',
    tablon: 'Anuncios',
    empleos: 'Empleos',
    comunidad_grupos: 'Grupos',
    comunidad_negocios: 'Negocios',
  }
  return labels[scope] || scope
}

const WEEKDAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']

function countByHour(items) {
  const rows = Array.from({ length: 24 }, (_, hour) => ({
    label: `${String(hour).padStart(2, '0')}:00`,
    value: 0,
  }))

  items.forEach(item => {
    const date = new Date(item.created_at)
    if (!Number.isNaN(date.getTime())) rows[date.getHours()].value += 1
  })

  return rows
}

function countByWeekday(items) {
  const rows = WEEKDAY_LABELS.map(label => ({ label, value: 0 }))

  items.forEach(item => {
    const date = new Date(item.created_at)
    if (!Number.isNaN(date.getTime())) rows[date.getDay()].value += 1
  })

  return rows
}

function topTimeRows(rows, limit = 6) {
  return [...rows]
    .filter(row => row.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
}

function strongestTimeLabel(rows) {
  const best = rows.reduce((acc, row) => row.value > acc.value ? row : acc, { label: 'Sin datos', value: 0 })
  return best.value ? best.label : 'Sin datos'
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

// eslint-disable-next-line no-unused-vars
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

// eslint-disable-next-line no-unused-vars
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

// eslint-disable-next-line no-unused-vars
function AdminStatCard({ icon, label, value, sub, color, isActive, onClick, urgent }) {
  const hasAlert = urgent && Number(value) > 0
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: 132,
        padding: '14px',
        borderRadius: 20,
        border: `1.5px solid ${isActive ? color : hasAlert ? `${color}55` : C.border}`,
        background: '#fff',
        boxShadow: isActive ? `0 16px 34px ${color}18` : '0 10px 26px rgba(15,23,42,0.04)',
        cursor: 'pointer',
        textAlign: 'left',
        overflow: 'hidden',
      }}
    >
      {isActive && (
        <span style={{
          position: 'absolute',
          left: 0,
          top: 14,
          bottom: 14,
          width: 4,
          borderRadius: '0 999px 999px 0',
          background: color,
        }} />
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
        <span style={{
          width: 38,
          height: 38,
          borderRadius: 14,
          background: `${color}14`,
          display: 'grid',
          placeItems: 'center',
          fontSize: 18,
          flexShrink: 0,
        }}>
          {icon}
        </span>
        <span style={{
          fontFamily: PP,
          fontWeight: 900,
          fontSize: 10,
          color: hasAlert ? color : C.light,
          background: hasAlert ? `${color}12` : C.bgAlt,
          borderRadius: 999,
          padding: '4px 8px',
        }}>
          {hasAlert ? 'Atencion' : 'Modulo'}
        </span>
      </div>
      <p style={{ fontFamily: PP, fontSize: 12, fontWeight: 800, color: isActive ? color : C.mid, margin: '0 0 4px' }}>
        {label}
      </p>
      <p style={{
        fontFamily: PP,
        fontWeight: 900,
        fontSize: value === 'â€”' ? 24 : String(value).length > 4 ? 24 : 34,
        color: C.text,
        lineHeight: 1,
        letterSpacing: -1,
        margin: '0 0 5px',
      }}>
        {value}
      </p>
      <p style={{ fontFamily: PP, fontSize: 11, color: C.light, lineHeight: 1.35, margin: 0 }}>
        {sub}
      </p>
    </button>
  )
}

function AdminChartCard({ title, items, color }) {
  const [days, setDays] = useState(30)
  const data = useMemo(() => countByDay(items, days), [items, days])
  const total = data.reduce((sum, item) => sum + item.count, 0)
  const trend = periodTrend(items, days)
  const trendColor = trend > 0 ? '#059669' : trend < 0 ? '#DC2626' : C.mid
  const trendLabel = trend > 0 ? `+${trend}%` : trend < 0 ? `-${Math.abs(trend)}%` : 'sin cambio'

  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${C.border}`,
      borderRadius: 22,
      padding: '18px 18px 12px',
      boxShadow: '0 18px 44px rgba(15,23,42,0.06)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, marginBottom: 10 }}>
        <div>
          <p style={{ fontFamily: PP, fontSize: 10, color: C.light, margin: '0 0 4px', fontWeight: 900, letterSpacing: 0.7, textTransform: 'uppercase' }}>
            {title}
          </p>
          <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 32, color: C.text, margin: 0, letterSpacing: -1, lineHeight: 1 }}>
            {total}
          </p>
        </div>
        <span style={{
          fontFamily: PP,
          fontSize: 11,
          fontWeight: 900,
          color: trendColor,
          background: `${trendColor}16`,
          padding: '6px 10px',
          borderRadius: 999,
          marginTop: 2,
          whiteSpace: 'nowrap',
        }}>
          {trendLabel}
        </span>
      </div>
      <SparkBarChart data={data} color={color} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {[7, 30].map(d => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              style={{
                fontFamily: PP,
                fontSize: 10,
                fontWeight: 900,
                padding: '4px 9px',
                borderRadius: 999,
                border: `1px solid ${days === d ? C.primary : C.border}`,
                cursor: 'pointer',
                background: days === d ? C.primary : '#fff',
                color: days === d ? '#fff' : C.light,
              }}
            >
              {d}d
            </button>
          ))}
        </div>
        <p style={{ fontFamily: PP, fontSize: 11, color: C.light, margin: 0 }}>
          ultimos {days} dias
        </p>
      </div>
    </div>
  )
}

function SummaryMetric({ label, value, hint, color = C.primary }) {
  return (
    <div style={{
      position: 'relative',
      overflow: 'hidden',
      minWidth: 150,
      flex: '1 1 150px',
      background: '#fff',
      border: '1px solid rgba(226,234,244,0.92)',
      borderRadius: 16,
      padding: '15px 15px 14px',
      boxShadow: '0 16px 34px rgba(15,23,42,0.055)',
    }}>
      <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: color }} />
      <p style={{ fontFamily: PP, fontSize: 10, fontWeight: 900, color: C.light, textTransform: 'uppercase', letterSpacing: 0.7, margin: '0 0 6px' }}>
        {label}
      </p>
      <p style={{ fontFamily: PP, fontSize: 24, fontWeight: 900, color, lineHeight: 1, margin: '0 0 5px' }}>
        {value}
      </p>
      <p style={{ fontFamily: PP, fontSize: 11, color: C.mid, lineHeight: 1.35, margin: 0 }}>
        {hint}
      </p>
    </div>
  )
}

function InsightBarList({ title, subtitle, rows, color = C.primary, emptyText = 'Sin datos todavía.' }) {
  const max = Math.max(...rows.map(row => row.value), 1)

  return (
    <Card style={{ padding: 16, overflow: 'hidden' }}>
      <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 15, color: C.text, margin: '0 0 3px' }}>{title}</p>
      <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: '0 0 14px', lineHeight: 1.45 }}>{subtitle}</p>

      <div style={{ display: 'grid', gap: 10, minWidth: 0, overflow: 'hidden' }}>
        {rows.map(row => (
          <div key={row.label} style={{ minWidth: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 5 }}>
              <span style={{ minWidth: 0, flex: '1 1 0', overflow: 'hidden' }}>
                <span style={{ display: 'block', fontFamily: PP, fontSize: 12, fontWeight: 900, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.label}</span>
                {row.sub && (
                  <span style={{ display: 'block', fontFamily: PP, fontSize: 10, color: C.light, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{row.sub}</span>
                )}
              </span>
              <span style={{ fontFamily: PP, fontSize: 12, fontWeight: 900, color, flexShrink: 0 }}>{row.value}</span>
            </div>
            <div style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', height: 8, borderRadius: 999, background: C.bg, overflow: 'hidden' }}>
              <div style={{ width: `${Math.max(8, Math.round((row.value / max) * 100))}%`, height: '100%', borderRadius: 999, background: color }} />
            </div>
          </div>
        ))}

        {!rows.length && (
          <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: 0, lineHeight: 1.5 }}>{emptyText}</p>
        )}
      </div>
    </Card>
  )
}

function PeriodSwitch({ value, onChange }) {
  const options = [
    { value: 1, label: 'Hoy' },
    { value: 7, label: '7 dias' },
    { value: 30, label: '30 dias' },
  ]
  return (
    <div style={{ display: 'flex', gap: 6, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 999, padding: 5, boxShadow: '0 8px 20px rgba(15,23,42,0.04)' }}>
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          style={{
            border: 'none',
            borderRadius: 999,
            background: value === option.value ? C.primary : 'transparent',
            color: value === option.value ? '#fff' : C.mid,
            padding: '7px 10px',
            fontFamily: PP,
            fontSize: 11,
            fontWeight: 900,
            cursor: 'pointer',
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function AdminPeriodChart({ title, items, color, days, onDaysChange }) {
  const data = useMemo(() => countByDay(items, days), [items, days])
  const total = data.reduce((sum, item) => sum + item.count, 0)
  const titleSuffix = days === 1 ? 'hoy' : `${days} dias`

  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${C.border}`,
      borderRadius: 22,
      padding: '18px',
      boxShadow: '0 18px 44px rgba(15,23,42,0.06)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap', marginBottom: 10 }}>
        <div>
          <p style={{ fontFamily: PP, fontSize: 10, color: C.light, margin: '0 0 4px', fontWeight: 900, letterSpacing: 0.7, textTransform: 'uppercase' }}>
            {title} · {titleSuffix}
          </p>
          <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 32, color: C.text, margin: 0, letterSpacing: -1, lineHeight: 1 }}>
            {total}
          </p>
        </div>
        <PeriodSwitch value={days} onChange={onDaysChange} />
      </div>
      <SparkBarChart data={data} color={color} />
    </div>
  )
}

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid rgba(226,234,244,0.95)',
      borderRadius: 18,
      padding: 18,
      boxShadow: '0 14px 32px rgba(15,23,42,0.05)',
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
    <Card style={{ textAlign: 'center', padding: '48px 24px', background: 'linear-gradient(180deg,#fff,#F8FAFF)' }}>
      <div style={{ fontSize: 34, marginBottom: 10 }}>{icon}</div>
      <p style={{ fontFamily: PP, color: C.light, margin: 0, fontSize: 14, lineHeight: 1.5 }}>{text}</p>
    </Card>
  )
}

async function logAdminAction(action) {
  await supabase.from('admin_actions').insert(action)
}

export default function Admin() {
  const { user } = useAuth()
  const [tab, setTab] = useState('users')
  const [loading, setLoading] = useState(true)
  const [userSearch, setUserSearch] = useState('')
  const [userDays, setUserDays] = useState(1)
  const [reports, setReports] = useState([])
  const [queue, setQueue] = useState([])
  const [users, setUsers] = useState([])
  const [recentListings, setRecentListings] = useState([])
  const [recentJobs, setRecentJobs] = useState([])
  const [businesses, setBusinesses] = useState([])
  const [businessVerificationFilter, setBusinessVerificationFilter] = useState('pending')
  const [contentByKey, setContentByKey] = useState(new Map())
  const [onlineUserIds, setOnlineUserIds] = useState(new Set())
  const [presenceStatus, setPresenceStatus] = useState('idle')
  const [analyticsEvents, setAnalyticsEvents] = useState([])
  const [analyticsUnavailable, setAnalyticsUnavailable] = useState(false)

  const metricUsers = useMemo(
    () => users.filter(profile => !isAdminEmail(profile.email)),
    [users]
  )
  const adminUserIds = useMemo(
    () => new Set(users.filter(profile => isAdminEmail(profile.email)).map(profile => profile.id)),
    [users]
  )

  const stats = useMemo(() => ({
    reports: reports.filter(r => r.status === 'pending').length,
    queue: queue.filter(r => r.status === 'pending').length,
    users: metricUsers.length,
    banned: metricUsers.filter(u => u.banned).length,
    content: recentListings.length + recentJobs.length,
    businessVerification: businesses.filter(b => getBusinessVerificationDetails(b).status === 'pending').length,
  }), [businesses, queue, reports, metricUsers, recentListings, recentJobs])

  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return users
    const q = userSearch.toLowerCase()
    return users.filter(u =>
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.canton || '').toLowerCase().includes(q)
    )
  }, [users, userSearch])
  const newUsersInRange = useMemo(
    () => metricUsers.filter(profile => isWithinRecentDays(profile.created_at, userDays)),
    [metricUsers, userDays]
  )
  const userRangeLabel = userDays === 1 ? 'hoy' : `${userDays} dias`
  const activeUsersToday = useMemo(
    () => metricUsers.filter(profile => isWithinRecentDays(profile.last_seen_at, 1)),
    [metricUsers]
  )
  const activeUsersWeek = useMemo(
    () => metricUsers.filter(profile => isWithinRecentDays(profile.last_seen_at, 7)),
    [metricUsers]
  )
  const onlineUsers = useMemo(
    () => metricUsers.filter(profile => onlineUserIds.has(profile.id)),
    [metricUsers, onlineUserIds]
  )
  const recentActiveUsers = useMemo(
    () => [...metricUsers]
      .filter(profile => profile.last_seen_at)
      .sort((a, b) => String(b.last_seen_at || '').localeCompare(String(a.last_seen_at || '')))
      .slice(0, 6),
    [metricUsers]
  )
  const activeChartUsers = useMemo(
    () => metricUsers
      .filter(profile => profile.last_seen_at)
      .map(profile => ({ ...profile, created_at: profile.last_seen_at })),
    [metricUsers]
  )
  const contentItems = useMemo(() => [...recentListings, ...recentJobs], [recentListings, recentJobs])
  const analytics30 = useMemo(
    () => analyticsEvents.filter(event => isWithinRecentDays(event.created_at, 30) && !adminUserIds.has(event.user_id)),
    [adminUserIds, analyticsEvents]
  )
  const pageViewEvents = useMemo(
    () => analytics30.filter(event => event.event_type === 'page_view' && !String(event.path || '').startsWith('/admin-latido')),
    [analytics30]
  )
  const searchEvents = useMemo(
    () => analytics30.filter(event => event.event_type === 'search' && analyticsQuery(event)),
    [analytics30]
  )
  const searchResultEvents = useMemo(
    () => analytics30.filter(event => event.event_type === 'search_result_open'),
    [analytics30]
  )
  const topPageRows = useMemo(
    () => topAnalyticsRows(pageViewEvents, event => pageLabel(event.path), 8, event => event.path),
    [pageViewEvents]
  )
  const topSearchRows = useMemo(
    () => topAnalyticsRows(searchEvents, analyticsQuery, 8, analyticsScope),
    [searchEvents]
  )
  const analyticsSessions = useMemo(() => {
    const ids = new Set()
    pageViewEvents.forEach(event => {
      const sessionKey = event.session_id || event.user_id || ''
      if (sessionKey) ids.add(sessionKey)
    })
    return ids.size
  }, [pageViewEvents])
  const searchActionRate = searchEvents.length
    ? Math.round((searchResultEvents.length / searchEvents.length) * 100)
    : 0
  const topSearchActionRows = useMemo(
    () => topAnalyticsRows(
      searchResultEvents,
      event => readMetadata(event.metadata).query,
      6,
      event => {
        const metadata = readMetadata(event.metadata)
        return [metadata.result_type, metadata.result_label].filter(Boolean).join(' · ')
      }
    ),
    [searchResultEvents]
  )
  const topResultTypeRows = useMemo(
    () => topAnalyticsRows(
      searchResultEvents,
      event => readMetadata(event.metadata).result_type || 'resultado',
      6
    ),
    [searchResultEvents]
  )
  const pageHourRows = useMemo(() => countByHour(pageViewEvents), [pageViewEvents])
  const searchHourRows = useMemo(() => countByHour(searchEvents), [searchEvents])
  const signupItems30 = useMemo(() => metricUsers.filter(profile => isWithinRecentDays(profile.created_at, 30)), [metricUsers])
  const publicationItems30 = useMemo(() => contentItems.filter(item => isWithinRecentDays(item.created_at, 30)), [contentItems])
  const signupHourRows = useMemo(() => countByHour(signupItems30), [signupItems30])
  const publicationHourRows = useMemo(() => countByHour(publicationItems30), [publicationItems30])
  const pageWeekdayRows = useMemo(() => countByWeekday(pageViewEvents), [pageViewEvents])
  const signupWeekdayRows = useMemo(() => countByWeekday(signupItems30), [signupItems30])
  const publicationWeekdayRows = useMemo(() => countByWeekday(publicationItems30), [publicationItems30])
  const topPageHourRows = useMemo(() => topTimeRows(pageHourRows), [pageHourRows])
  const topSearchHourRows = useMemo(() => topTimeRows(searchHourRows), [searchHourRows])
  const topSignupHourRows = useMemo(() => topTimeRows(signupHourRows), [signupHourRows])
  const topPublicationHourRows = useMemo(() => topTimeRows(publicationHourRows), [publicationHourRows])
  const liveLast14Days = useMemo(() => countByDay(activeChartUsers, 14), [activeChartUsers])
  const recentLiveUsers = useMemo(() => {
    const byId = new Map()
    onlineUsers.forEach(profile => byId.set(profile.id, profile))
    recentActiveUsers.forEach(profile => byId.set(profile.id, profile))
    return [...byId.values()].slice(0, 8)
  }, [onlineUsers, recentActiveUsers])
  const liveWeeklyTrend = useMemo(() => periodTrend(activeChartUsers, 7), [activeChartUsers])
  const activeCantonRows = useMemo(() => {
    const counts = activeUsersWeek.reduce((acc, profile) => {
      const key = profile.canton || 'Sin canton'
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})
    return Object.entries(counts)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
  }, [activeUsersWeek])
  const activeCantonMax = Math.max(...activeCantonRows.map(row => row.value), 1)
  const usersWithActivityBaseline = metricUsers.filter(profile => profile.last_seen_at)
  const liveInactiveUsers = usersWithActivityBaseline.filter(profile => !isWithinRecentDays(profile.last_seen_at, 30)).length
  const liveUntrackedUsers = metricUsers.length - usersWithActivityBaseline.length
  const liveOnlineRate = metricUsers.length ? Math.round((onlineUsers.length / metricUsers.length) * 100) : 0
  const liveTodayRate = metricUsers.length ? Math.round((activeUsersToday.length / metricUsers.length) * 100) : 0
  const liveWeekRate = metricUsers.length ? Math.round((activeUsersWeek.length / metricUsers.length) * 100) : 0
  const liveLast14Total = liveLast14Days.reduce((sum, item) => sum + item.count, 0)
  const presenceStatusMeta = {
    subscribed: { label: 'Conectado', color: '#059669', bg: '#D1FAE5', note: 'Canal Presence activo' },
    connecting: { label: 'Conectando', color: '#D97706', bg: '#FEF3C7', note: 'Esperando Supabase Presence' },
    channel_error: { label: 'Error canal', color: '#DC2626', bg: '#FEE2E2', note: 'Revisa conexión realtime' },
    timed_out: { label: 'Timeout', color: '#DC2626', bg: '#FEE2E2', note: 'Supabase no respondió a tiempo' },
    closed: { label: 'Cerrado', color: '#64748B', bg: '#F1F5F9', note: 'Canal Presence cerrado' },
    idle: { label: 'Inactivo', color: '#64748B', bg: '#F1F5F9', note: 'Sin canal abierto' },
  }[presenceStatus] || { label: presenceStatus, color: '#64748B', bg: '#F1F5F9', note: 'Estado realtime' }

  useEffect(() => {
    const stopOnline = subscribeToOnlineUsers(setOnlineUserIds)
    const stopStatus = subscribeToPresenceStatus(setPresenceStatus)

    return () => {
      stopOnline()
      stopStatus()
    }
  }, [])

  useEffect(() => { loadAdminData() }, [])

  function switchTab(nextTab) {
    setTab(nextTab)
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    })
  }

  async function loadAdminData() {
    setLoading(true)
    const [reportsRes, queueRes, usersRes, listingsRes, jobsRes, providersRes] = await Promise.all([
      supabase.from('reports').select('*').order('created_at', { ascending: false }).limit(120),
      supabase.from('moderation_queue').select('*').order('created_at', { ascending: false }).limit(120),
      supabase.from('profiles').select('id,name,email,canton,banned,banned_reason,banned_at,created_at,last_seen_at').order('created_at', { ascending: false }).limit(300),
      supabase.from('listings').select('id,title,desc,cat,sub,active,user_id,user_name,canton,city,created_at').order('created_at', { ascending: false }).limit(80),
      supabase.from('jobs').select('id,title,company,desc,sector,active,user_id,canton,city,created_at').order('created_at', { ascending: false }).limit(80),
      supabase.from('providers').select('*').order('created_at', { ascending: false }).limit(300),
    ])

    if (reportsRes.error || queueRes.error || usersRes.error) {
      toast.error('No se pudo cargar todo el panel. Revisa que el SQL de moderacion este aplicado.')
    }

    const analyticsSince = new Date(Date.now() - 60 * 86_400_000).toISOString()
    const analyticsRes = await supabase
      .from('analytics_events')
      .select('id,event_type,path,search,user_id,session_id,metadata,created_at')
      .gte('created_at', analyticsSince)
      .order('created_at', { ascending: false })
      .limit(1500)

    if (analyticsRes.error) {
      setAnalyticsEvents([])
      setAnalyticsUnavailable(true)
      console.warn('Analytics events unavailable:', analyticsRes.error.message)
    } else {
      setAnalyticsEvents(analyticsRes.data || [])
      setAnalyticsUnavailable(false)
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
      profileIds.length ? supabase.from('profiles').select('id,name,email,canton,banned,banned_reason,created_at,last_seen_at').in('id', profileIds) : Promise.resolve({ data: [] }),
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
      ? await supabase.from('profiles').select('id,name,email,canton,banned,banned_reason,banned_at,created_at,last_seen_at').in('id', missingOwnerIds)
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
  const totalPendingActions = stats.queue + stats.reports + stats.businessVerification
  const activePublications = recentListings.filter(item => item.active !== false).length + recentJobs.filter(item => item.active !== false).length
  const verifiedBusinessCount = businessVerificationCounts.verified || 0
  const adminHealth = totalPendingActions > 0 ? 'Requiere atencion' : 'Todo al dia'
  const adminHealthColor = totalPendingActions > 0 ? '#D97706' : '#059669'
  const activeBusinesses = businesses.filter(business => business.active !== false).length
  const featuredBusinesses = businesses.filter(business => business.featured).length
  const businessAverageScore = businesses.length
    ? Math.round(businesses.reduce((sum, business) => sum + getBusinessVerificationDetails(business).score, 0) / businesses.length)
    : 0
  const newUsers30 = countRecent(metricUsers, 30)
  const newContent30 = countRecent(contentItems, 30)
  const reports30 = countRecent(reports, 30)
  const userTrend30 = periodTrend(metricUsers, 30)
  const contentTrend30 = periodTrend(contentItems, 30)
  const reportsTrend30 = periodTrend(reports, 30)
  const generalScore = Math.max(0, Math.min(100,
    74
    + Math.min(10, activeUsersWeek.length)
    + (userTrend30 > 0 ? 6 : userTrend30 < -20 ? -8 : 0)
    + (contentTrend30 > 0 ? 6 : contentTrend30 < -20 ? -8 : 0)
    - Math.min(28, totalPendingActions * 4)
    - (reportsTrend30 > 25 ? 8 : 0)
  ))
  const generalStatus = generalScore >= 82 ? 'Va bien' : generalScore >= 64 ? 'Estable' : 'Requiere atención'
  const generalTrend = reportsTrend30 > 25 || userTrend30 < -20 || contentTrend30 < -20
    ? 'Empeora'
    : userTrend30 > 10 || contentTrend30 > 10
      ? 'Mejora'
      : 'Estable'
  const generalTrendColor = generalTrend === 'Mejora' ? '#059669' : generalTrend === 'Empeora' ? '#DC2626' : '#D97706'
  const generalSuggestions = [
    totalPendingActions > 0 && `Resolver ${totalPendingActions} acciones pendientes para bajar fricción administrativa.`,
    stats.queue > 0 && `Revisar ${stats.queue} elementos en cola antes de que se acumulen publicaciones bloqueadas.`,
    stats.reports > 0 && `Atender ${stats.reports} reportes pendientes para mantener confianza y seguridad.`,
    stats.businessVerification > 0 && `Verificar ${stats.businessVerification} negocios pendientes para mejorar confianza visual.`,
    newContent30 < 5 && 'Impulsar publicaciones recientes: hay poca creación de contenido en los últimos 30 días.',
    liveUntrackedUsers > metricUsers.length * 0.4 && 'Esperar unos días para leer actividad real: muchos usuarios antiguos aún no tienen last_seen_at.',
  ].filter(Boolean).slice(0, 4)
  const overviewSignals = [
    { label: 'Usuarios nuevos 30d', value: newUsers30, trend: userTrend30, color: C.primary },
    { label: 'Publicaciones 30d', value: newContent30, trend: contentTrend30, color: '#059669' },
    { label: 'Reportes 30d', value: reports30, trend: reportsTrend30, color: '#DC2626' },
    { label: 'Pendientes ahora', value: totalPendingActions, trend: null, color: adminHealthColor },
  ]
  const topPageMax = Math.max(...topPageRows.map(row => row.value), 1)
  const topSearchMax = Math.max(...topSearchRows.map(row => row.value), 1)

  // eslint-disable-next-line no-unused-vars
  const STAT_CARDS = [
    { id: 'moderation', icon: '⏳', label: 'En revisión', value: loading ? '—' : stats.queue,   color: '#D97706', urgent: true,  sub: 'Cola de moderación' },
    { id: 'reports',    icon: '🚨', label: 'Reportes',    value: loading ? '—' : stats.reports, color: '#DC2626', urgent: true,  sub: 'Denuncias pendientes' },
    { id: 'businessVerification', icon: '✓', label: 'Negocios', value: loading ? '—' : stats.businessVerification, color: '#059669', urgent: true, sub: 'Pendientes de verificar' },
    { id: 'users',      icon: '👥', label: 'Usuarios',    value: loading ? '—' : stats.users,   color: C.primary, urgent: false, sub: `${loading ? '—' : stats.banned} baneados` },
    { id: 'content',    icon: '📋', label: 'Contenido',   value: loading ? '—' : stats.content, color: '#059669', urgent: false, sub: 'Anuncios y empleos' },
  ]

  const NAV_ITEMS = [
    { id: 'users', icon: '👥', label: 'Usuarios', value: loading ? '...' : `${stats.users} total`, color: C.primary, bg: C.primaryLight },
    { id: 'analytics', icon: '📈', label: 'Uso app', value: loading ? '...' : `${pageViewEvents.length} vistas`, color: '#0284C7', bg: '#E0F2FE' },
    { id: 'live', icon: '📡', label: 'Live', value: loading ? '...' : `${onlineUsers.length} online`, color: '#7C3AED', bg: '#F3E8FF' },
    { id: 'overview', icon: '📊', label: 'Estado general', value: loading ? '...' : `${generalScore}/100`, color: generalTrendColor, bg: generalTrend === 'Mejora' ? '#ECFDF5' : generalTrend === 'Empeora' ? '#FEF2F2' : '#FFFBEB' },
    { id: 'businessVerification', icon: '✓', label: 'Negocios', value: loading ? '...' : `${stats.businessVerification} pend.`, color: '#059669', bg: '#ECFDF5' },
    { id: 'content', icon: '📋', label: 'Publicaciones', value: loading ? '...' : `${stats.content} items`, color: '#0284C7', bg: '#E0F2FE' },
    { id: 'reports', icon: '🚨', label: 'Reportes', value: loading ? '...' : `${stats.reports} pend.`, color: '#DC2626', bg: '#FEF2F2' },
    { id: 'moderation', icon: '⏳', label: 'Revisión', value: loading ? '...' : `${stats.queue} en cola`, color: '#D97706', bg: '#FFFBEB' },
  ]

  const SECTION_TITLES = {
    overview: { icon: '📊', label: 'Estado general' },
    live: { icon: '📡', label: 'Live' },
    analytics: { icon: '📈', label: 'Uso de la app' },
    moderation: { icon: '⏳', label: 'Revisión manual' },
    reports:    { icon: '🚨', label: 'Reportes pendientes' },
    businessVerification: { icon: '✓', label: 'Verificación de negocios' },
    users:      { icon: '👥', label: 'Usuarios' },
    content:    { icon: '📋', label: 'Contenido reciente' },
  }

  const activeSection = tab === 'content'
    ? { ...SECTION_TITLES.content, label: 'Publicaciones recientes' }
    : SECTION_TITLES[tab]
  const SECTION_DETAILS = {
    overview: { description: 'Rapport de 30 días con señales de crecimiento, actividad, pendientes y recomendaciones.', color: generalTrendColor, count: generalScore, badge: `${generalStatus} · ${generalTrend}` },
    live: { description: 'Pulso operativo de actividad diaria, semanal y usuarios online en este momento.', color: '#7C3AED', count: onlineUsers.length, badge: `${onlineUsers.length} online` },
    analytics: { description: 'Páginas más usadas, búsquedas frecuentes, horarios fuertes y comportamiento de navegación de los últimos 30 días.', color: '#0284C7', count: pageViewEvents.length, badge: `${pageViewEvents.length} vistas · ${searchEvents.length} búsquedas · ${searchResultEvents.length} aperturas` },
    moderation: { description: 'Publicaciones retenidas por filtros o pendientes de una decisión manual antes de quedar visibles.', color: '#D97706', count: stats.queue, badge: `${stats.queue} elementos en cola` },
    reports: { description: 'Denuncias de la comunidad que necesitan revision y accion.', color: '#DC2626', count: stats.reports, badge: `${stats.reports} reportes pendientes` },
    businessVerification: { description: 'Evalua datos, contacto y confianza antes de mostrar la pill verificado.', color: '#059669', count: stats.businessVerification, badge: `${stats.businessVerification} negocios pendientes` },
    users: { description: 'Busca cuentas, revisa actividad basica y gestiona baneos. Las métricas excluyen la cuenta admin.', color: C.primary, count: metricUsers.length, badge: `${metricUsers.length} usuarios sin admin` },
    content: { description: 'Control rapido de anuncios y empleos publicados en Latido.', color: '#059669', count: stats.content, badge: `${stats.content} publicaciones cargadas` },
  }
  const activeSectionDetails = SECTION_DETAILS[tab]
  const sectionMetrics = tab === 'overview'
    ? [
        { label: 'Estado', value: loading ? '...' : generalStatus, hint: `Score operativo ${generalScore}/100`, color: generalTrendColor },
        { label: 'Tendencia 30d', value: loading ? '...' : generalTrend, hint: `Usuarios ${userTrend30 > 0 ? '+' : ''}${userTrend30}% · contenido ${contentTrend30 > 0 ? '+' : ''}${contentTrend30}%`, color: generalTrendColor },
        { label: 'Pendientes', value: loading ? '...' : totalPendingActions, hint: 'Reportes, revisión y negocios', color: adminHealthColor },
        { label: 'Publicaciones 30d', value: loading ? '...' : newContent30, hint: `${recentListings.length} anuncios · ${recentJobs.length} empleos cargados`, color: '#059669' },
      ]
    : tab === 'live'
    ? [
        { label: 'Online ahora', value: loading ? '...' : onlineUsers.length, hint: `${liveOnlineRate}% de la base cargada`, color: '#7C3AED' },
        { label: 'Activos hoy', value: loading ? '...' : activeUsersToday.length, hint: `${liveTodayRate}% han abierto Latido`, color: C.primary },
        { label: 'Activos 7 días', value: loading ? '...' : activeUsersWeek.length, hint: `${liveWeekRate}% activos esta semana`, color: '#059669' },
        { label: 'Conexión live', value: loading ? '...' : presenceStatusMeta.label, hint: presenceStatusMeta.note, color: presenceStatusMeta.color },
        { label: 'Sin registro', value: loading ? '...' : liveUntrackedUsers, hint: 'Usuarios previos al tracking', color: '#D97706' },
      ]
    : tab === 'analytics'
      ? [
          { label: 'Vistas 30d', value: loading ? '...' : pageViewEvents.length, hint: `${analyticsSessions} sesiones registradas`, color: '#0284C7' },
          { label: 'Búsquedas 30d', value: loading ? '...' : searchEvents.length, hint: 'Términos escritos en barras', color: C.primary },
          { label: 'Aperturas búsqueda', value: loading ? '...' : searchResultEvents.length, hint: `${searchActionRate}% sobre búsquedas registradas`, color: '#059669' },
          { label: 'Hora fuerte', value: loading ? '...' : strongestTimeLabel(pageHourRows), hint: analyticsUnavailable ? 'Falta tabla analytics_events' : 'Según vistas de página', color: analyticsUnavailable ? '#D97706' : '#0F766E' },
        ]
    : tab === 'users'
      ? [
        { label: 'Nuevos usuarios', value: loading ? '...' : newUsersInRange.length, hint: `Registrados ${userRangeLabel}`, color: C.primary },
        { label: 'Usuarios totales', value: loading ? '...' : metricUsers.length, hint: `Sin contar admin · ${filteredUsers.length} visibles`, color: C.text },
        { label: 'Usuarios baneados', value: loading ? '...' : stats.banned, hint: stats.banned ? 'Revisar cuentas bloqueadas' : 'Sin bloqueos activos', color: stats.banned ? '#DC2626' : '#059669' },
        { label: 'Cantones nuevos', value: loading ? '...' : new Set(newUsersInRange.map(u => u.canton).filter(Boolean)).size, hint: `Diversidad en ${userRangeLabel}`, color: '#0F766E' },
      ]
    : tab === 'businessVerification'
      ? [
          { label: 'Negocios activos', value: loading ? '...' : activeBusinesses, hint: `${businesses.length} negocios cargados`, color: '#059669' },
          { label: 'Verificados', value: loading ? '...' : verifiedBusinessCount, hint: 'Con pill visible en ficha', color: '#0F766E' },
          { label: 'Pendientes', value: loading ? '...' : businessVerificationCounts.pending || 0, hint: 'Esperan decision manual', color: '#D97706' },
          { label: 'Score medio', value: loading ? '...' : `${businessAverageScore}/100`, hint: `${featuredBusinesses} destacados`, color: C.primary },
        ]
      : tab === 'reports'
        ? [
            { label: 'Reportes pendientes', value: loading ? '...' : stats.reports, hint: 'Necesitan revision', color: '#DC2626' },
            { label: 'Reportes totales', value: loading ? '...' : reports.length, hint: 'Ultimos cargados', color: C.text },
            { label: 'Contenido accionable', value: loading ? '...' : pendingReports.length, hint: 'Pendiente en esta vista', color: '#D97706' },
          ]
        : tab === 'moderation'
          ? [
              { label: 'En revision', value: loading ? '...' : stats.queue, hint: 'Cola pendiente', color: '#D97706' },
              { label: 'Cola total', value: loading ? '...' : queue.length, hint: 'Ultimos elementos cargados', color: C.text },
              { label: 'Acciones pendientes', value: loading ? '...' : totalPendingActions, hint: 'Incluye reportes y negocios', color: adminHealthColor },
            ]
          : [
              { label: 'Publicaciones activas', value: loading ? '...' : activePublications, hint: `${stats.content} cargadas`, color: '#059669' },
              { label: 'Anuncios', value: loading ? '...' : recentListings.length, hint: 'Publicaciones recientes', color: C.primary },
              { label: 'Empleos', value: loading ? '...' : recentJobs.length, hint: 'Ofertas y busquedas', color: '#0F766E' },
            ]
  const activeChart =
    tab === 'users'
      ? <AdminPeriodChart title="Nuevos usuarios" items={users} color={C.primary} days={userDays} onDaysChange={setUserDays} />
      : tab === 'analytics'
        ? <AdminChartCard title="Vistas de página" items={pageViewEvents} color="#0284C7" />
      : tab === 'reports'
        ? <AdminChartCard title="Reportes recibidos" items={reports} color="#DC2626" />
        : tab === 'businessVerification'
          ? <AdminChartCard title="Negocios registrados" items={businesses} color="#059669" />
          : tab === 'content'
            ? <AdminChartCard title="Publicaciones" items={[...recentListings, ...recentJobs]} color="#059669" />
          : null
  const showChartPlaceholder = ['users', 'analytics', 'reports', 'businessVerification', 'content'].includes(tab)

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#F4F7FB 0%,#EEF4FF 100%)', padding: '18px 14px calc(104px + env(safe-area-inset-bottom))' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <main style={{ minWidth: 0 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap', marginBottom: 14, background: '#fff', border: '1px solid rgba(226,234,244,0.95)', borderRadius: 24, padding: 20, boxShadow: '0 18px 46px rgba(15,23,42,0.06)' }}>
        <div style={{ minWidth: 240, flex: '1 1 420px' }}>
          <p style={{ fontFamily: PP, fontSize: 11, fontWeight: 900, color: activeSectionDetails.color, margin: '0 0 6px', letterSpacing: 0.8, textTransform: 'uppercase' }}>
            {activeSection.label}
          </p>
          <h1 style={{ fontFamily: PP, fontWeight: 900, fontSize: 30, color: C.text, margin: '0 0 6px', letterSpacing: -0.8, lineHeight: 1.08 }}>
            Centro de control
          </h1>
          <p style={{ fontFamily: PP, fontSize: 13, color: C.mid, margin: 0, lineHeight: 1.55, maxWidth: 620 }}>
            Panel operativo para leer datos, tomar decisiones y mantener Latido ordenado.
          </p>
        </div>
        <button
          onClick={loadAdminData}
          style={{ fontFamily: PP, fontWeight: 900, fontSize: 12, background: C.primary, color: '#fff', border: 'none', borderRadius: 14, padding: '11px 15px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, boxShadow: '0 14px 30px rgba(37,99,235,0.22)' }}
        >
          <span style={{ fontSize: 14 }}>↻</span> Actualizar
        </button>
      </div>

      {/* Stat cards — double as navigation */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginBottom: 16 }}>
        {sectionMetrics.map(metric => (
          <SummaryMetric
            key={metric.label}
            label={metric.label}
            value={metric.value}
            hint={metric.hint}
            color={metric.color}
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 14, background: '#fff', border: '1px solid rgba(226,234,244,0.95)', borderRadius: 20, padding: '14px 16px', boxShadow: '0 14px 32px rgba(15,23,42,0.045)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <span style={{ width: 40, height: 40, borderRadius: 14, background: `${activeSectionDetails.color}14`, display: 'grid', placeItems: 'center', fontSize: 18, flexShrink: 0 }}>
            {activeSection.icon}
          </span>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontFamily: PP, fontWeight: 900, fontSize: 17, color: C.text, margin: '0 0 3px', lineHeight: 1.2 }}>
              {activeSection.label}
            </h2>
            <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: 0, lineHeight: 1.45 }}>
              {activeSectionDetails.description}
            </p>
          </div>
        </div>
        <span style={{ fontFamily: PP, fontSize: 12, fontWeight: 900, color: activeSectionDetails.color, background: `${activeSectionDetails.color}12`, borderRadius: 999, padding: '7px 11px' }}>
          {activeSectionDetails.badge || (tab === 'live' ? `${activeSectionDetails.count} online` : `${activeSectionDetails.count} items`)}
        </span>
      </div>

      {/* ── Estado general ─────────────────────────────── */}
      {tab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card style={{ padding: 0, overflow: 'hidden', borderRadius: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 0 }}>
              <div style={{ padding: 22, background: `linear-gradient(135deg,${generalTrendColor} 0%,#2563EB 100%)`, color: '#fff' }}>
                <p style={{ fontFamily: PP, fontSize: 11, fontWeight: 900, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: 0.8, opacity: 0.86 }}>
                  Rapport 30 días
                </p>
                <h3 style={{ fontFamily: PP, fontWeight: 900, fontSize: 31, lineHeight: 1.05, margin: '0 0 8px', letterSpacing: -0.8 }}>
                  {generalStatus}
                </h3>
                <p style={{ fontFamily: PP, fontSize: 13, lineHeight: 1.55, margin: '0 0 18px', opacity: 0.9 }}>
                  {newUsers30} usuarios nuevos, {newContent30} publicaciones y {reports30} reportes registrados en los últimos 30 días.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, height: 10, borderRadius: 999, background: 'rgba(255,255,255,0.22)', overflow: 'hidden' }}>
                    <div style={{ width: `${generalScore}%`, height: '100%', borderRadius: 999, background: '#fff' }} />
                  </div>
                  <strong style={{ fontFamily: PP, fontSize: 22, fontWeight: 900 }}>{generalScore}/100</strong>
                </div>
              </div>

              <div style={{ padding: 22, background: '#fff' }}>
                <p style={{ fontFamily: PP, fontSize: 10, fontWeight: 900, color: C.light, textTransform: 'uppercase', letterSpacing: 0.7, margin: '0 0 8px' }}>
                  Lectura automática
                </p>
                <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 22, color: C.text, margin: '0 0 8px', lineHeight: 1.15 }}>
                  La tendencia está {generalTrend.toLowerCase()}.
                </p>
                <p style={{ fontFamily: PP, fontSize: 13, color: C.mid, lineHeight: 1.6, margin: 0 }}>
                  Se calcula sin IA, comparando los últimos 30 días con los 30 anteriores y penalizando acumulación de reportes, revisión y verificaciones pendientes.
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 15 }}>
                  <Tag bg={generalTrend === 'Mejora' ? '#D1FAE5' : generalTrend === 'Empeora' ? '#FEE2E2' : '#FEF3C7'} color={generalTrendColor}>
                    {generalTrend}
                  </Tag>
                  <Tag bg={C.bg} color={C.mid}>30 días</Tag>
                  <Tag bg={totalPendingActions ? '#FEF3C7' : '#D1FAE5'} color={totalPendingActions ? '#92400E' : '#047857'}>
                    {totalPendingActions} pendientes
                  </Tag>
                </div>
              </div>
            </div>
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12 }}>
            {overviewSignals.map(signal => (
              <Card key={signal.label} style={{ padding: 15 }}>
                <p style={{ fontFamily: PP, fontSize: 10, fontWeight: 900, color: C.light, textTransform: 'uppercase', letterSpacing: 0.7, margin: '0 0 7px' }}>
                  {signal.label}
                </p>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                  <strong style={{ fontFamily: PP, fontWeight: 900, fontSize: 28, color: signal.color, lineHeight: 1 }}>
                    {loading ? '...' : signal.value}
                  </strong>
                  {signal.trend != null && (
                    <span style={{ fontFamily: PP, fontSize: 11, fontWeight: 900, color: signal.trend > 0 ? '#047857' : signal.trend < 0 ? '#B91C1C' : C.light, background: signal.trend > 0 ? '#D1FAE5' : signal.trend < 0 ? '#FEE2E2' : C.bg, borderRadius: 999, padding: '5px 8px' }}>
                      {signal.trend > 0 ? `+${signal.trend}%` : signal.trend < 0 ? `${signal.trend}%` : '0%'}
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 14 }}>
            <Card style={{ padding: 16, overflow: 'hidden' }}>
              <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 16, color: C.text, margin: '0 0 4px' }}>Sugerencias de mejora</p>
              <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: '0 0 14px' }}>Reglas simples basadas en actividad y carga pendiente.</p>
              <div style={{ display: 'grid', gap: 10 }}>
                {(generalSuggestions.length ? generalSuggestions : ['El panel no detecta bloqueos fuertes ahora mismo. Mantén revisión y reportes al día.']).map((text, index) => (
                  <div key={text} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '11px 12px', border: `1px solid ${C.border}`, borderRadius: 14, background: '#F8FAFF' }}>
                    <span style={{ width: 25, height: 25, borderRadius: 9, background: C.primaryLight, color: C.primary, display: 'grid', placeItems: 'center', fontFamily: PP, fontWeight: 900, fontSize: 12, flexShrink: 0 }}>
                      {index + 1}
                    </span>
                    <p style={{ fontFamily: PP, fontSize: 12, color: C.mid, margin: 0, lineHeight: 1.45 }}>{text}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card style={{ padding: 16 }}>
              <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 16, color: C.text, margin: '0 0 4px' }}>Cola operativa</p>
              <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: '0 0 14px' }}>Qué necesita atención ahora.</p>
              <div style={{ display: 'grid', gap: 10 }}>
                {[
                  { label: 'Revisión de contenido', value: stats.queue, color: '#D97706' },
                  { label: 'Reportes pendientes', value: stats.reports, color: '#DC2626' },
                  { label: 'Negocios por verificar', value: stats.businessVerification, color: '#059669' },
                ].map(item => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => switchTab(item.label.includes('contenido') ? 'moderation' : item.label.includes('Reportes') ? 'reports' : 'businessVerification')}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, border: `1px solid ${C.border}`, borderRadius: 14, padding: '11px 12px', background: '#fff', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <span style={{ fontFamily: PP, fontSize: 12, fontWeight: 900, color: C.text }}>{item.label}</span>
                    <strong style={{ fontFamily: PP, fontSize: 13, color: item.color }}>{item.value} pend.</strong>
                  </button>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* -- Uso de la app ---------------------------------- */}
      {tab === 'analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {analyticsUnavailable && (
            <Card style={{ borderColor: '#F59E0B', background: '#FFFBEB' }}>
              <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 15, color: '#92400E', margin: '0 0 5px' }}>
                Tracking pendiente de activar
              </p>
              <p style={{ fontFamily: PP, fontSize: 12, color: '#92400E', lineHeight: 1.55, margin: 0 }}>
                El panel ya está preparado, pero Supabase no devuelve la tabla analytics_events. Cuando exista, aquí aparecerán páginas más usadas y búsquedas reales.
              </p>
            </Card>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 14 }}>
            <Card style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                <div>
                  <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 16, color: C.text, margin: '0 0 3px' }}>Páginas más usadas</p>
                  <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: 0 }}>Agrupado por sección en los últimos 30 días.</p>
                </div>
                <Tag bg="#E0F2FE" color="#0284C7">{pageViewEvents.length} vistas</Tag>
              </div>

              <div style={{ display: 'grid', gap: 11, minWidth: 0, overflow: 'hidden' }}>
                {topPageRows.map((row, index) => (
                  <div key={row.label} style={{ minWidth: 0, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                      <div style={{ minWidth: 0, maxWidth: '100%', flex: '1 1 0', display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                        <span style={{ width: 24, height: 24, borderRadius: 9, background: '#E0F2FE', color: '#0284C7', display: 'grid', placeItems: 'center', fontFamily: PP, fontWeight: 900, fontSize: 11, flexShrink: 0 }}>
                          {index + 1}
                        </span>
                        <div style={{ minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
                          <p style={{ fontFamily: PP, fontSize: 12, fontWeight: 900, color: C.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.label}</p>
                          <p style={{ fontFamily: PP, fontSize: 10, color: C.light, margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.sub}</p>
                        </div>
                      </div>
                      <strong style={{ fontFamily: PP, fontSize: 12, color: '#0284C7', flexShrink: 0 }}>{row.value}</strong>
                    </div>
                    <div style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', height: 8, borderRadius: 999, background: C.bg, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.max(8, Math.round((row.value / topPageMax) * 100))}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,#0284C7,#2563EB)' }} />
                    </div>
                  </div>
                ))}
                {!topPageRows.length && (
                  <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: 0, lineHeight: 1.5 }}>
                    Todavía no hay vistas registradas. Empezará a llenarse cuando los usuarios naveguen con el tracking activo.
                  </p>
                )}
              </div>
            </Card>

            <Card style={{ padding: 16, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                <div>
                  <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 16, color: C.text, margin: '0 0 3px' }}>Búsquedas frecuentes</p>
                  <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: 0 }}>Términos escritos en búsqueda global, anuncios y comunidad.</p>
                </div>
                <Tag bg={C.primaryLight} color={C.primary}>{searchEvents.length} búsquedas</Tag>
              </div>

              <div style={{ display: 'grid', gap: 11, minWidth: 0, overflow: 'hidden' }}>
                {topSearchRows.map((row, index) => (
                  <div key={row.label} style={{ minWidth: 0, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                      <div style={{ minWidth: 0, maxWidth: '100%', flex: '1 1 0', display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                        <span style={{ width: 24, height: 24, borderRadius: 9, background: C.primaryLight, color: C.primary, display: 'grid', placeItems: 'center', fontFamily: PP, fontWeight: 900, fontSize: 11, flexShrink: 0 }}>
                          {index + 1}
                        </span>
                        <div style={{ minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
                          <p style={{ fontFamily: PP, fontSize: 12, fontWeight: 900, color: C.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.label}</p>
                          <p style={{ fontFamily: PP, fontSize: 10, color: C.light, margin: '2px 0 0' }}>{row.sub}</p>
                        </div>
                      </div>
                      <strong style={{ fontFamily: PP, fontSize: 12, color: C.primary, flexShrink: 0 }}>{row.value}</strong>
                    </div>
                    <div style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', height: 8, borderRadius: 999, background: C.bg, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.max(8, Math.round((row.value / topSearchMax) * 100))}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,#2563EB,#10B981)' }} />
                    </div>
                  </div>
                ))}
                {!topSearchRows.length && (
                  <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: 0, lineHeight: 1.5 }}>
                    Todavía no hay búsquedas registradas. Se guardan solo términos de 2 o más caracteres con una pequeña pausa.
                  </p>
                )}
              </div>
            </Card>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 14 }}>
            <InsightBarList
              title="Horas con más navegación"
              subtitle="Cuándo se abren más páginas de Latido."
              rows={topPageHourRows}
              color="#0284C7"
              emptyText="Sin vistas suficientes para detectar horas fuertes."
            />
            <InsightBarList
              title="Horas de búsqueda"
              subtitle="Cuándo la gente escribe más en las barras de búsqueda."
              rows={topSearchHourRows}
              color={C.primary}
              emptyText="Sin búsquedas suficientes para detectar horarios."
            />
            <InsightBarList
              title="Altas por hora"
              subtitle="Nuevas cuentas creadas en los últimos 30 días."
              rows={topSignupHourRows}
              color="#7C3AED"
              emptyText="Sin nuevas cuentas recientes."
            />
            <InsightBarList
              title="Publicaciones por hora"
              subtitle="Anuncios y empleos creados en los últimos 30 días."
              rows={topPublicationHourRows}
              color="#059669"
              emptyText="Sin publicaciones recientes."
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 14 }}>
            <InsightBarList
              title="Días con más navegación"
              subtitle="Distribución semanal de vistas de página."
              rows={pageWeekdayRows.some(row => row.value > 0) ? pageWeekdayRows : []}
              color="#0284C7"
              emptyText="Sin navegación suficiente por día."
            />
            <InsightBarList
              title="Días de nuevas cuentas"
              subtitle="Qué días se registran más usuarios."
              rows={signupWeekdayRows.some(row => row.value > 0) ? signupWeekdayRows : []}
              color="#7C3AED"
              emptyText="Sin altas recientes por día."
            />
            <InsightBarList
              title="Días de publicación"
              subtitle="Qué días se crean más anuncios y empleos."
              rows={publicationWeekdayRows.some(row => row.value > 0) ? publicationWeekdayRows : []}
              color="#059669"
              emptyText="Sin publicaciones recientes por día."
            />
            <InsightBarList
              title="Resultados abiertos"
              subtitle="Qué tipo de resultado abre la gente desde búsqueda."
              rows={topResultTypeRows}
              color="#0F766E"
              emptyText="Todavía no hay aperturas desde búsqueda."
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 14 }}>
            <Card style={{ padding: 16, background: 'linear-gradient(180deg,#FFFFFF,#F8FAFF)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
                <div>
                  <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 16, color: C.text, margin: '0 0 3px' }}>Embudo de búsqueda</p>
                  <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: 0 }}>Mide si las búsquedas acaban abriendo un resultado.</p>
                </div>
                <Tag bg="#ECFDF5" color="#047857">{searchActionRate}% acción</Tag>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                {[
                  { label: 'Búsquedas', value: searchEvents.length, color: C.primary },
                  { label: 'Aperturas', value: searchResultEvents.length, color: '#059669' },
                  { label: 'Términos', value: topSearchRows.length, color: '#0284C7' },
                ].map(item => (
                  <div key={item.label} style={{ border: `1px solid ${C.border}`, borderRadius: 14, padding: '11px 10px', background: '#fff' }}>
                    <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 22, color: item.color, lineHeight: 1, margin: '0 0 4px' }}>{item.value}</p>
                    <p style={{ fontFamily: PP, fontWeight: 800, fontSize: 10, color: C.light, margin: 0 }}>{item.label}</p>
                  </div>
                ))}
              </div>
            </Card>

            <InsightBarList
              title="Términos que abren resultados"
              subtitle="Búsquedas que terminaron en clic o Enter sobre un resultado."
              rows={topSearchActionRows}
              color="#059669"
              emptyText="Todavía no hay términos con apertura registrada."
            />
          </div>

          <Card style={{ padding: 16, background: '#fff' }}>
            <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 15, color: C.text, margin: '0 0 3px' }}>Cómo se mide</p>
            <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: '0 0 14px', lineHeight: 1.55 }}>
              Esta sección mezcla comportamiento y operación: navegación/búsqueda salen de analytics_events; altas y publicaciones salen de created_at en perfiles, anuncios y empleos.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 10 }}>
              {[
                { label: 'Páginas usadas', note: 'Agrupa rutas como Inicio, Anuncios, Comunidad, Mensajes o Detalle de anuncio.', color: '#0284C7' },
                { label: 'Búsquedas', note: 'Guarda el término, la sección y filtros como categoría, cantón o tipo de empleo.', color: C.primary },
                { label: 'Aperturas', note: 'Registra cuando una persona abre un resultado de búsqueda con clic o Enter.', color: '#059669' },
                { label: 'Horarios', note: 'Usa la hora local del created_at para detectar horas y días con más movimiento.', color: '#7C3AED' },
              ].map(item => (
                <div key={item.label} style={{ border: `1px solid ${C.border}`, borderRadius: 14, padding: 12, background: '#F8FAFF' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 999, background: item.color, display: 'inline-block', marginBottom: 8 }} />
                  <p style={{ fontFamily: PP, fontSize: 12, fontWeight: 900, color: C.text, margin: '0 0 4px' }}>{item.label}</p>
                  <p style={{ fontFamily: PP, fontSize: 11, color: C.light, margin: 0, lineHeight: 1.45 }}>{item.note}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ── Moderación ─────────────────────────────────── */}
      {tab === 'moderation' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Card style={{ padding: 16, background: '#FFFBEB', borderColor: '#FDE68A' }}>
            <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 15, color: '#92400E', margin: '0 0 5px' }}>Qué significa revisión</p>
            <p style={{ fontFamily: PP, fontSize: 12, color: '#92400E', lineHeight: 1.55, margin: 0 }}>
              Aquí aparecen publicaciones retenidas por filtros automáticos o marcadas para decisión manual. El objetivo es aprobar contenido válido, eliminar contenido problemático o bloquear al autor si el caso lo requiere.
            </p>
          </Card>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 18, padding: 8, boxShadow: '0 10px 26px rgba(15,23,42,0.04)' }}>
            {BUSINESS_VERIFICATION_FILTERS.map(item => (
              <button
                key={item.id}
                onClick={() => setBusinessVerificationFilter(item.id)}
                style={{
                  fontFamily: PP,
                  fontWeight: 900,
                  fontSize: 11,
                  borderRadius: 999,
                  border: `1.5px solid ${businessVerificationFilter === item.id ? item.color : C.border}`,
                  background: item.bg,
                  color: item.color,
                  padding: '9px 12px',
                  cursor: 'pointer',
                  width: '100%',
                  minHeight: 44,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  boxShadow: businessVerificationFilter === item.id ? `0 0 0 3px ${item.color}14, 0 10px 22px ${item.color}12` : 'none',
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

      {/* ── Live ───────────────────────────────────────── */}
      {tab === 'live' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card style={{ padding: 0, overflow: 'hidden', borderRadius: 24, boxShadow: '0 24px 60px rgba(15,23,42,0.08)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 0 }}>
              <div style={{ padding: 20, background: 'linear-gradient(135deg,#7C3AED 0%,#2563EB 58%,#0F766E 100%)', color: '#fff' }}>
                <p style={{ fontFamily: PP, fontSize: 11, fontWeight: 900, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: 0.8, opacity: 0.86 }}>
                  Monitor en vivo
                </p>
                <h3 style={{ fontFamily: PP, fontSize: 28, fontWeight: 900, lineHeight: 1.05, margin: '0 0 10px', letterSpacing: -0.7 }}>
                  Pulso real de Latido
                </h3>
                <p style={{ fontFamily: PP, fontSize: 13, lineHeight: 1.5, margin: '0 0 18px', opacity: 0.86 }}>
                  Online ahora, actividad diaria y señales recientes en una vista pensada para leer rápido.
                </p>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.24)', borderRadius: 999, padding: '7px 10px', marginBottom: 12 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: presenceStatusMeta.color, boxShadow: `0 0 0 3px ${presenceStatusMeta.color}22` }} />
                  <span style={{ fontFamily: PP, fontWeight: 900, fontSize: 11, color: '#fff' }}>
                    Realtime: {presenceStatusMeta.label}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                  {[
                    { label: 'Online', value: onlineUsers.length },
                    { label: 'Hoy', value: activeUsersToday.length },
                    { label: '7 dias', value: activeUsersWeek.length },
                  ].map(item => (
                    <div key={item.label} style={{ background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.24)', borderRadius: 16, padding: '11px 12px' }}>
                      <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 22, margin: '0 0 3px', lineHeight: 1 }}>{loading ? '...' : item.value}</p>
                      <p style={{ fontFamily: PP, fontSize: 10, fontWeight: 800, margin: 0, opacity: 0.82 }}>{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ padding: 20, background: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
                  <div>
                    <p style={{ fontFamily: PP, fontSize: 10, fontWeight: 900, color: C.light, textTransform: 'uppercase', letterSpacing: 0.7, margin: '0 0 5px' }}>
                      Actividad últimos 14 días
                    </p>
                    <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 30, color: C.text, margin: 0, lineHeight: 1 }}>
                      {loading ? '...' : liveLast14Total}
                    </p>
                  </div>
                  <span style={{ fontFamily: PP, fontSize: 11, fontWeight: 900, color: liveWeeklyTrend >= 0 ? '#047857' : '#B91C1C', background: liveWeeklyTrend >= 0 ? '#D1FAE5' : '#FEE2E2', borderRadius: 999, padding: '7px 10px', whiteSpace: 'nowrap' }}>
                    {liveWeeklyTrend > 0 ? `+${liveWeeklyTrend}%` : liveWeeklyTrend < 0 ? `${liveWeeklyTrend}%` : 'estable'}
                  </span>
                </div>
                <SparkBarChart data={liveLast14Days} color="#7C3AED" />
              </div>
            </div>
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 14 }}>
            <Card style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 15, color: C.text, margin: '0 0 3px' }}>Usuarios online</p>
                  <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: 0 }}>Presencia conectada en tiempo real.</p>
                </div>
                <span style={{ width: 44, height: 44, borderRadius: 16, background: '#F3E8FF', color: '#7C3AED', display: 'grid', placeItems: 'center', fontFamily: PP, fontWeight: 900 }}>
                  {onlineUsers.length}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {onlineUsers.slice(0, 7).map(profile => (
                  <div key={profile.id} style={{ display: 'flex', alignItems: 'center', gap: 10, border: `1px solid ${C.border}`, borderRadius: 14, padding: '9px 10px', background: '#F8FAFF' }}>
                    <span style={{ width: 10, height: 10, borderRadius: 999, background: '#10B981', boxShadow: '0 0 0 4px rgba(16,185,129,0.14)' }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 12, color: C.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {profile.name || profile.email || 'Usuario'}
                      </p>
                      <p style={{ fontFamily: PP, fontSize: 11, color: C.light, margin: '2px 0 0' }}>
                        {profile.canton || 'Sin canton'}
                      </p>
                    </div>
                    <span style={{ fontFamily: PP, fontSize: 10, fontWeight: 900, color: '#047857', background: '#D1FAE5', borderRadius: 999, padding: '4px 7px' }}>
                      online
                    </span>
                  </div>
                ))}
                {!onlineUsers.length && (
                  <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: 0, padding: '18px 0' }}>
                    No hay usuarios online ahora mismo.
                  </p>
                )}
              </div>
            </Card>

            <Card style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 15, color: C.text, margin: '0 0 3px' }}>Últimas señales</p>
                  <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: 0 }}>Usuarios con actividad más reciente.</p>
                </div>
                <span style={{ fontFamily: PP, fontSize: 11, fontWeight: 900, color: C.primary, background: C.primaryLight, borderRadius: 999, padding: '7px 10px' }}>
                  {recentLiveUsers.length}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {recentLiveUsers.map(profile => {
                  const isOnline = onlineUserIds.has(profile.id)
                  return (
                    <div key={profile.id} style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: `1px solid ${C.border}`, padding: '8px 0' }}>
                      <span style={{ flex: '0 0 auto', width: 34, height: 34, borderRadius: 12, background: isOnline ? '#D1FAE5' : C.bg, display: 'grid', placeItems: 'center', fontFamily: PP, fontWeight: 900, color: isOnline ? '#047857' : C.mid }}>
                        {(profile.name || profile.email || 'U').slice(0, 1).toUpperCase()}
                      </span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 12, color: C.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {profile.name || profile.email || 'Usuario'}
                        </p>
                        <p style={{ fontFamily: PP, fontSize: 11, color: C.light, margin: '2px 0 0' }}>
                          {profile.canton || 'Sin canton'}
                        </p>
                      </div>
                      <span style={{ fontFamily: PP, fontSize: 10, fontWeight: 900, color: isOnline ? '#047857' : C.light, background: isOnline ? '#D1FAE5' : C.bg, borderRadius: 999, padding: '4px 7px', whiteSpace: 'nowrap' }}>
                        {isOnline ? 'online' : fmtActivity(profile.last_seen_at)}
                      </span>
                    </div>
                  )
                })}
                {!recentLiveUsers.length && (
                  <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: 0, padding: '18px 0' }}>
                    Sin actividad registrada todavía.
                  </p>
                )}
              </div>
            </Card>

            <Card style={{ padding: 16 }}>
              <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 15, color: C.text, margin: '0 0 3px' }}>Actividad por cantón</p>
              <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: '0 0 14px' }}>Top de usuarios activos esta semana.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {activeCantonRows.map(row => (
                  <div key={row.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 5 }}>
                      <span style={{ fontFamily: PP, fontSize: 12, fontWeight: 900, color: C.text }}>{row.label}</span>
                      <span style={{ fontFamily: PP, fontSize: 12, fontWeight: 900, color: C.primary }}>{row.value}</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 999, background: C.bg, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.max(8, Math.round((row.value / activeCantonMax) * 100))}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,#7C3AED,#10B981)' }} />
                    </div>
                  </div>
                ))}
                {!activeCantonRows.length && (
                  <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: 0 }}>
                    Todavía no hay actividad semanal para agrupar.
                  </p>
                )}
              </div>
            </Card>

            <Card style={{ padding: 16, background: 'linear-gradient(180deg,#FFFFFF,#F8FAFF)' }}>
              <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 15, color: C.text, margin: '0 0 3px' }}>Lectura rápida</p>
              <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: '0 0 14px' }}>Resumen para decidir si hay que activar, revisar o esperar.</p>
              <div style={{ display: 'grid', gap: 9 }}>
                {[
                  { label: 'Tracción diaria', value: `${liveTodayRate}%`, note: `${activeUsersToday.length} usuarios activos hoy`, color: C.primary },
                  { label: 'Retención semanal', value: `${liveWeekRate}%`, note: `${activeUsersWeek.length} usuarios activos en 7 días`, color: '#059669' },
                  { label: 'Sin registro', value: liveUntrackedUsers, note: 'usuarios antiguos sin last_seen_at todavía', color: '#D97706' },
                  { label: 'Reactivación real', value: liveInactiveUsers, note: 'con tracking, sin señal en 30 días', color: '#B45309' },
                ].map(item => (
                  <div key={item.label} style={{ display: 'grid', gridTemplateColumns: '76px 1fr', gap: 10, alignItems: 'center', border: `1px solid ${C.border}`, borderRadius: 14, padding: '10px 11px', background: '#fff' }}>
                    <strong style={{ fontFamily: PP, fontSize: 22, fontWeight: 900, color: item.color, lineHeight: 1 }}>{item.value}</strong>
                    <div>
                      <p style={{ fontFamily: PP, fontSize: 12, fontWeight: 900, color: C.text, margin: 0 }}>{item.label}</p>
                      <p style={{ fontFamily: PP, fontSize: 11, color: C.light, margin: '2px 0 0' }}>{item.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card style={{ padding: 16, background: '#fff' }}>
              <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 15, color: C.text, margin: '0 0 3px' }}>Cómo se mide</p>
              <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: '0 0 14px', lineHeight: 1.5 }}>
                La actividad empieza a ser fiable desde que Latido guarda presencia y última conexión.
              </p>
              <div style={{ display: 'grid', gap: 9 }}>
                {[
                  { label: 'Online ahora', note: 'Supabase Presence: usuarios con sesión conectada en este momento.', color: '#7C3AED' },
                  { label: 'Activos hoy/semana', note: 'Usuarios cuyo profiles.last_seen_at cae dentro del día o los últimos 7 días.', color: C.primary },
                  { label: 'Conexión live', note: `Estado actual del canal realtime: ${presenceStatusMeta.label}.`, color: presenceStatusMeta.color },
                  { label: 'Sin registro', note: 'Usuarios antiguos que aún no han vuelto a abrir la app desde que se activó el tracking.', color: '#D97706' },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ width: 9, height: 9, borderRadius: 999, background: item.color, marginTop: 5, flexShrink: 0 }} />
                    <div>
                      <p style={{ fontFamily: PP, fontSize: 12, fontWeight: 900, color: C.text, margin: '0 0 2px' }}>{item.label}</p>
                      <p style={{ fontFamily: PP, fontSize: 11, color: C.light, margin: 0, lineHeight: 1.45 }}>{item.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
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
              <strong style={{ color: C.text }}>{metricUsers.length}</strong> total sin admin
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
        </main>
      </div>

      <nav
        aria-label="Navegación admin"
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 80,
          width: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          gap: 7,
          overflowX: 'auto',
          padding: '8px max(12px, env(safe-area-inset-left)) calc(8px + env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-right))',
          background: 'rgba(255,255,255,0.94)',
          borderTop: '1px solid rgba(203,213,225,0.9)',
          boxShadow: '0 -18px 58px rgba(15,23,42,0.14)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
        }}
      >
        {NAV_ITEMS.map(item => {
          const active = tab === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => switchTab(item.id)}
              style={{
                flex: active ? '1.25 0 154px' : '1 0 116px',
                minHeight: 56,
                borderRadius: 18,
                border: `1.5px solid ${active ? `${item.color}55` : 'transparent'}`,
                background: active ? item.bg : 'transparent',
                color: active ? item.color : C.mid,
                cursor: 'pointer',
                padding: '8px 10px',
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                textAlign: 'left',
                boxShadow: active ? `0 12px 28px ${item.color}16` : 'none',
                transition: 'background .15s ease, border-color .15s ease, box-shadow .15s ease',
              }}
            >
              <span style={{ width: 36, height: 36, borderRadius: 14, background: active ? '#fff' : item.bg, display: 'grid', placeItems: 'center', fontSize: 17, flexShrink: 0 }}>
                {item.icon}
              </span>
              <span style={{ minWidth: 0, display: 'grid', gap: 2 }}>
                <span style={{ fontFamily: PP, fontWeight: 900, fontSize: 11, color: active ? item.color : C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.label}
                </span>
                <span style={{ fontFamily: PP, fontWeight: 800, fontSize: 10, color: active ? item.color : C.light, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.value}
                </span>
              </span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
