import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { AD_CATS, CANTONS } from '../lib/constants'
import { C, PP } from '../lib/theme'

const ALERT_CATEGORIES = AD_CATS.filter(category =>
  ['vivienda', 'servicios', 'cuidados', 'documentos', 'venta', 'regalo'].includes(category.id),
)

const emptySettings = {
  recipientEmail:'', categories:[], services:[], keywords:[], cities:[], cantons:[], plzs:[], nationwide:false, pausedAt:null,
}

function splitList(value='') {
  return Array.from(new Set(value.split(',').map(item => item.trim()).filter(Boolean)))
}
function joinList(value=[]) {
  return (value || []).join(', ')
}
function formatDate(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('es-CH', { day:'2-digit', month:'short', year:'numeric' })
}
function errorCode(error) {
  return String(error?.message || error || '')
}
function stateCopy(state) {
  return {
    active:{ label:'Activas', color:'#166534', background:'#DCFCE7' },
    paused:{ label:'Pausadas', color:'#92400E', background:'#FEF3C7' },
    pending_payment:{ label:'Pago pendiente', color:'#1D4ED8', background:'#DBEAFE' },
    payment_failed:{ label:'Pago pendiente', color:'#B91C1C', background:'#FEE2E2' },
    canceled:{ label:'Canceladas', color:'#475569', background:'#E2E8F0' },
    needs_configuration:{ label:'Completa la configuración', color:'#92400E', background:'#FEF3C7' },
    inactive:{ label:'No activas', color:'#475569', background:'#E2E8F0' },
  }[state] || { label:'No activas', color:'#475569', background:'#E2E8F0' }
}

export default function AlertasClientesPotenciales() {
  const { providerId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [status, setStatus] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const [openingPortal, setOpeningPortal] = useState(false)
  const [form, setForm] = useState(emptySettings)

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true)
    try {
      const [statusResult, historyResult] = await Promise.all([
        supabase.rpc('get_business_lead_alert_status', { p_provider_id:providerId }),
        supabase
          .from('business_lead_alerts')
          .select('id, listing_title, listing_category, listing_city, listing_canton, listing_path, matched_terms, plan_snapshot, priority, notification_status, notification_sent_at, email_status, email_sent_at, delivery_last_error, read_at, created_at')
          .eq('provider_id', providerId)
          .order('created_at', { ascending:false })
          .limit(60),
      ])
      if (statusResult.error) throw statusResult.error
      if (historyResult.error) throw historyResult.error
      const nextStatus = statusResult.data
      setStatus(nextStatus)
      setHistory(historyResult.data || [])
      const settings = nextStatus?.settings || emptySettings
      setForm({
        recipientEmail:settings.recipientEmail || '',
        categories:settings.categories || [],
        services:settings.services || [],
        keywords:settings.keywords || [],
        cities:settings.cities || [],
        cantons:settings.cantons || [],
        plzs:settings.plzs || [],
        nationwide:settings.nationwide === true,
        pausedAt:settings.pausedAt || null,
      })
    } catch (error) {
      console.error('Could not load business lead alerts:', error)
      if (!quiet) toast.error('No se pudieron cargar las alertas.')
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [providerId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (searchParams.get('checkout') !== 'success' && searchParams.get('portal') !== 'return') return undefined
    let stopped = false
    let attempts = 0
    const refresh = async () => {
      await load({ quiet:true })
      attempts += 1
      if (!stopped && attempts < 8 && searchParams.get('checkout') === 'success') window.setTimeout(refresh, 1800)
    }
    refresh()
    const next = new URLSearchParams(searchParams)
    next.delete('checkout'); next.delete('portal'); next.delete('session_id')
    setSearchParams(next, { replace:true })
    return () => { stopped = true }
  }, [load, searchParams, setSearchParams])

  const isConfigured = useMemo(() => (
    Boolean(form.recipientEmail.trim())
    && form.categories.length > 0
    && (form.services.length > 0 || form.keywords.length > 0)
    && (form.nationwide || form.cities.length > 0 || form.cantons.length > 0 || form.plzs.length > 0)
  ), [form])

  const update = (key, value) => setForm(current => ({ ...current, [key]:value }))
  const toggleCategory = category => update('categories', form.categories.includes(category)
    ? form.categories.filter(item => item !== category)
    : [...form.categories, category])

  const saveSettings = async () => {
    if (!isConfigured) {
      toast.error('Añade email, categoría, un servicio y una zona.')
      return false
    }
    setSaving(true)
    try {
      const { error } = await supabase.from('business_lead_alert_settings').upsert({
        provider_id:providerId,
        recipient_email:form.recipientEmail.trim(),
        categories:form.categories,
        services:form.services,
        keywords:form.keywords,
        cities:form.cities,
        cantons:form.cantons,
        plzs:form.plzs,
        nationwide:form.nationwide,
        paused_at:form.pausedAt,
      }, { onConflict:'provider_id' })
      if (error) throw error
      await load({ quiet:true })
      toast.success('Configuración guardada')
      return true
    } catch (error) {
      console.error('Could not save business lead alert settings:', error)
      toast.error('No se pudo guardar la configuración.')
      return false
    } finally {
      setSaving(false)
    }
  }

  const startCheckout = async () => {
    if (!(await saveSettings())) return
    setCheckingOut(true)
    try {
      const { data, error } = await supabase.functions.invoke('create_business_lead_alert_checkout', { body:{ providerId } })
      if (error || !data?.url) throw new Error(data?.error || 'CHECKOUT_CREATE_FAILED')
      window.location.assign(data.url)
    } catch (error) {
      const code = errorCode(error)
      toast.error(code.includes('SUBSCRIPTION_EXISTS') ? 'Ya existe una suscripción de alertas para este negocio.' : 'No se pudo abrir el pago.')
    } finally {
      setCheckingOut(false)
    }
  }

  const setPaused = async paused => {
    if (!status?.settings) {
      toast.error('Guarda primero la configuración.')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase
        .from('business_lead_alert_settings')
        .update({ paused_at:paused ? new Date().toISOString() : null })
        .eq('provider_id', providerId)
      if (error) throw error
      await load({ quiet:true })
      toast.success(paused ? 'Alertas pausadas' : 'Alertas reanudadas')
    } catch {
      toast.error('No se pudo actualizar el estado.')
    } finally {
      setSaving(false)
    }
  }

  const openPortal = async () => {
    setOpeningPortal(true)
    try {
      const { data, error } = await supabase.functions.invoke('create_business_lead_alert_portal', { body:{ providerId } })
      if (error || !data?.url) throw new Error(data?.error || 'PORTAL_CREATE_FAILED')
      window.location.assign(data.url)
    } catch {
      toast.error('No se pudo abrir la gestión de la suscripción.')
    } finally {
      setOpeningPortal(false)
    }
  }

  const openAlert = async alert => {
    if (!alert.read_at) await supabase.rpc('mark_business_lead_alert_read', { p_alert_id:alert.id })
    navigate(alert.listing_path)
  }

  if (loading) return <div style={{ maxWidth:760, margin:'0 auto', padding:'28px 18px 60px' }}><div className="skeleton" style={{ height:42, width:250, borderRadius:12, marginBottom:16 }} /><div className="skeleton" style={{ height:420, borderRadius:24 }} /></div>
  if (!status?.provider) return <div style={{ maxWidth:560, margin:'0 auto', padding:'60px 20px', textAlign:'center' }}><p style={{ fontFamily:PP, color:C.mid }}>No se pudo cargar este negocio.</p><Link to="/perfil" style={{ color:C.primary }}>Volver al perfil</Link></div>

  const state = stateCopy(status.state)
  const canManage = status.subscription?.canManage === true

  return (
    <main style={{ maxWidth:760, margin:'0 auto', padding:'24px 16px 64px' }}>
      <button onClick={() => navigate('/perfil')} style={backStyle}>← Volver al perfil</button>
      <section style={{ background:'linear-gradient(135deg,#EFF6FF,#fff)', border:`1px solid ${C.primaryMid}`, borderRadius:24, padding:'24px 22px', marginTop:14 }}>
        <p style={{ fontFamily:PP, fontWeight:800, fontSize:11, color:C.primary, letterSpacing:.8, margin:'0 0 8px' }}>ALERTAS DE CLIENTES POTENCIALES</p>
        <h1 style={{ fontFamily:PP, fontSize:25, lineHeight:1.2, color:C.text, margin:'0 0 9px' }}>{status.provider.name}</h1>
        <p style={{ fontFamily:PP, color:C.mid, fontSize:14, lineHeight:1.6, margin:'0 0 17px' }}>No esperes a que el cliente te encuentre. Latido te avisa cuando alguien busca un servicio como el tuyo.</p>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          <span style={{ fontFamily:PP, fontWeight:800, fontSize:12, color:state.color, background:state.background, padding:'8px 11px', borderRadius:999 }}>{state.label}</span>
          <span style={{ fontFamily:PP, fontWeight:800, fontSize:15, color:C.text }}>Incluidas en Premium</span>
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={headingStyle}>Configura qué clientes quieres recibir</h2>
        <p style={helpStyle}>Latido enviará una alerta cuando un anuncio de tipo “Busco o necesito” coincida con estas reglas.</p>
        <label style={labelStyle}>Email de recepción</label>
        <input type="email" value={form.recipientEmail} onChange={event => update('recipientEmail', event.target.value)} placeholder="empresa@ejemplo.ch" style={inputStyle} />
        <label style={labelStyle}>Categorías</label>
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:18 }}>
          {ALERT_CATEGORIES.map(category => <button key={category.id} onClick={() => toggleCategory(category.id)} style={{ ...chipStyle, background:form.categories.includes(category.id) ? C.primary : '#fff', color:form.categories.includes(category.id) ? '#fff' : C.mid, borderColor:form.categories.includes(category.id) ? C.primary : C.border }}>{category.emoji} {category.label}</button>)}
        </div>
        <Field label="Servicios" hint="Separados por comas. Ej.: limpieza, mudanzas, fontanero"><input value={joinList(form.services)} onChange={event => update('services', splitList(event.target.value))} style={inputStyle} placeholder="limpieza, reparaciones" /></Field>
        <Field label="Palabras clave adicionales" hint="Opcional. Ej.: instalación de cocinas, clases de alemán"><input value={joinList(form.keywords)} onChange={event => update('keywords', splitList(event.target.value))} style={inputStyle} placeholder="palabra o frase, otra frase" /></Field>
        <div style={{ display:'flex', alignItems:'center', gap:9, margin:'17px 0' }}><input id="all-switzerland" type="checkbox" checked={form.nationwide} onChange={event => update('nationwide', event.target.checked)} /><label htmlFor="all-switzerland" style={{ fontFamily:PP, fontWeight:700, fontSize:13, color:C.text }}>Toda Suiza</label></div>
        {!form.nationwide && <>
          <Field label="Ciudades" hint="Opcional; se compara con la ciudad del anuncio."><input value={joinList(form.cities)} onChange={event => update('cities', splitList(event.target.value))} style={inputStyle} placeholder="Zúrich, Winterthur" /></Field>
          <Field label="Cantones"><select multiple value={form.cantons} onChange={event => update('cantons', Array.from(event.target.selectedOptions, option => option.value))} style={{ ...inputStyle, height:116 }}>{CANTONS.map(canton => <option key={canton.id || canton.code || canton} value={canton.id || canton.code || canton}>{canton.label || canton.name || canton.id || canton}</option>)}</select></Field>
          <Field label="Códigos postales" hint="Opcional; separados por comas."><input value={joinList(form.plzs)} onChange={event => update('plzs', splitList(event.target.value))} style={inputStyle} placeholder="8001, 8050" /></Field>
        </>}
        <button onClick={saveSettings} disabled={saving} style={secondaryButton}>{saving ? 'Guardando...' : 'Guardar configuración'}</button>
      </section>

      {status.active || status.state === 'paused' ? (
        <section style={cardStyle}>
          <h2 style={headingStyle}>Estado y suscripción</h2>
          <p style={helpStyle}>Email: <strong>{form.recipientEmail}</strong></p>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            <button onClick={() => setPaused(status.state !== 'paused')} disabled={saving} style={secondaryButton}>{status.state === 'paused' ? 'Reanudar alertas' : 'Pausar alertas'}</button>
            {canManage && <button onClick={openPortal} disabled={openingPortal} style={dangerButton}>{openingPortal ? 'Abriendo Stripe...' : 'Gestionar o cancelar'}</button>}
          </div>
        </section>
      ) : (
        <section style={{ ...cardStyle, borderColor:C.primaryMid, background:'#F8FBFF' }}>
          <h2 style={headingStyle}>Incluidas en Partner Premium</h2>
          <p style={helpStyle}>Las alertas de clientes potenciales ya no se venden como complemento separado. Se activan automáticamente con el plan Premium del negocio.</p>
          <button onClick={() => navigate(`/negocios/${providerId}/destacar?plan=premium`)} disabled={saving} style={primaryButton}>Ver plan Premium</button>
        </section>
      )}

      <section style={cardStyle}>
        <h2 style={headingStyle}>Historial de alertas</h2>
        {!history.length ? <p style={helpStyle}>Todavía no se han enviado alertas para este negocio.</p> : <div style={{ display:'grid', gap:10 }}>{history.map(alert => <button key={alert.id} onClick={() => openAlert(alert)} style={{ textAlign:'left', background:alert.read_at ? '#fff' : '#F0F7FF', border:`1px solid ${C.border}`, borderRadius:15, padding:'13px 14px', cursor:'pointer' }}><div style={{ display:'flex', justifyContent:'space-between', gap:10 }}><strong style={{ fontFamily:PP, fontSize:13, color:C.text }}>{alert.listing_title}</strong><span style={{ fontFamily:PP, fontSize:10, color:C.light }}>{formatDate(alert.created_at)}</span></div><p style={{ fontFamily:PP, fontSize:11, color:C.mid, margin:'7px 0' }}>{[alert.listing_category, alert.listing_city || alert.listing_canton].filter(Boolean).join(' · ')}{alert.matched_terms?.length ? ` · ${alert.matched_terms.join(', ')}` : ''}</p><div style={{ display:'flex', gap:6, flexWrap:'wrap' }}><MiniStatus label={alert.notification_status === 'sent' ? 'Notificación enviada' : 'Notificación pendiente'} good={alert.notification_status === 'sent'} /><MiniStatus label={alert.email_status === 'sent' ? 'Email enviado' : 'Email pendiente'} good={alert.email_status === 'sent'} /></div></button>)}</div>}
      </section>
    </main>
  )
}

function Field({ label, hint, children }) { return <div style={{ marginBottom:16 }}><label style={labelStyle}>{label}</label>{children}{hint && <p style={helpStyle}>{hint}</p>}</div> }
function MiniStatus({ label, good }) { return <span style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:good ? '#166534' : '#92400E', background:good ? '#DCFCE7' : '#FEF3C7', borderRadius:999, padding:'4px 7px' }}>{label}</span> }

const cardStyle = { background:'#fff', border:`1px solid ${C.border}`, borderRadius:20, padding:'20px', marginTop:16, boxShadow:'0 8px 22px rgba(15,23,42,.04)' }
const headingStyle = { fontFamily:PP, fontSize:17, color:C.text, margin:'0 0 7px' }
const helpStyle = { fontFamily:PP, fontSize:11, lineHeight:1.55, color:C.light, margin:'0 0 13px' }
const labelStyle = { display:'block', fontFamily:PP, fontSize:12, fontWeight:800, color:C.text, marginBottom:7 }
const inputStyle = { width:'100%', boxSizing:'border-box', fontFamily:PP, fontSize:13, color:C.text, border:`1.5px solid ${C.border}`, borderRadius:12, padding:'11px 12px', background:'#fff', outline:'none' }
const chipStyle = { fontFamily:PP, fontSize:11, fontWeight:700, border:'1px solid', borderRadius:999, padding:'8px 10px', cursor:'pointer' }
const primaryButton = { fontFamily:PP, fontWeight:800, fontSize:13, background:C.primary, color:'#fff', border:'none', borderRadius:13, padding:'12px 16px', cursor:'pointer' }
const secondaryButton = { fontFamily:PP, fontWeight:800, fontSize:12, background:C.primaryLight, color:C.primaryDark, border:`1px solid ${C.primaryMid}`, borderRadius:12, padding:'11px 13px', cursor:'pointer' }
const dangerButton = { fontFamily:PP, fontWeight:800, fontSize:12, background:'#FFF7ED', color:'#C2410C', border:'1px solid #FDBA74', borderRadius:12, padding:'11px 13px', cursor:'pointer' }
const backStyle = { fontFamily:PP, fontSize:12, fontWeight:700, color:C.mid, background:'#fff', border:`1px solid ${C.border}`, borderRadius:11, padding:'8px 11px', cursor:'pointer' }
