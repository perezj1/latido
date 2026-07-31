import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import { C, PP } from '../lib/theme'
import { Modal } from './UI'
import {
  findSavedSearch,
  getSavedSearchFingerprint,
  saveSavedSearch,
} from '../lib/savedSearches'
import {
  getPushStatus,
  loadPushSettings,
  subscribeToPushNotifications,
} from '../lib/pushNotifications'

export default function SavedSearchButton({ draft, compact = false }) {
  const { isLoggedIn, user, userCanton } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const fingerprint = useMemo(() => getSavedSearchFingerprint(draft), [draft])
  const [existing, setExisting] = useState(null)
  const [checking, setChecking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pushPromptOpen, setPushPromptOpen] = useState(false)
  const [activatingPush, setActivatingPush] = useState(false)

  useEffect(() => {
    let active = true
    setExisting(null)
    if (!isLoggedIn || !user?.id || !fingerprint) return () => { active = false }

    setChecking(true)
    findSavedSearch(user.id, draft)
      .then(value => {
        if (active) setExisting(value)
      })
      .catch(error => {
        if (!/saved_searches|schema cache|does not exist/i.test(error?.message || '')) {
          console.warn('Saved search status could not be loaded:', error)
        }
      })
      .finally(() => {
        if (active) setChecking(false)
      })

    return () => { active = false }
  }, [draft, fingerprint, isLoggedIn, user?.id])

  if (!fingerprint) return null

  async function requestPushIfUseful() {
    try {
      const status = await getPushStatus()
      if (status.supported && !status.subscribed && status.permission !== 'denied') {
        setPushPromptOpen(true)
      }
    } catch {
      // La búsqueda queda guardada y seguirá apareciendo dentro de Latido.
    }
  }

  async function handleSave() {
    if (!isLoggedIn || !user?.id) {
      toast('Inicia sesión para guardar esta búsqueda')
      navigate('/auth', { state:{ from:`${location.pathname}${location.search}` } })
      return
    }
    if (existing?.active || saving) return

    setSaving(true)
    try {
      const saved = await saveSavedSearch(user.id, draft)
      setExisting({ id:saved.id, active:true, push_enabled:true })
      toast.success(existing ? 'Alerta reactivada' : 'Búsqueda guardada; te avisaremos por email')
      await requestPushIfUseful()
    } catch (error) {
      toast.error(error?.message || 'No se pudo guardar la búsqueda')
    } finally {
      setSaving(false)
    }
  }

  async function activatePush() {
    if (activatingPush) return
    setActivatingPush(true)
    try {
      await subscribeToPushNotifications({
        user,
        settings:loadPushSettings(),
        userCanton,
      })
      toast.success('Notificaciones activadas')
      setPushPromptOpen(false)
    } catch (error) {
      toast.error(error?.message || 'No se pudieron activar las notificaciones')
    } finally {
      setActivatingPush(false)
    }
  }

  const isSaved = Boolean(existing?.active)
  const label = saving
    ? 'Guardando...'
    : checking
      ? 'Comprobando...'
      : isSaved
        ? 'Alerta guardada'
        : existing
          ? 'Reactivar alerta'
          : compact
            ? 'Activar'
            : 'Avísame de nuevos resultados'

  return (
    <>
      <button
        type="button"
        onClick={handleSave}
        disabled={saving || checking || isSaved}
        aria-label={label}
        style={{
          display:'inline-flex',
          alignItems:'center',
          justifyContent:'center',
          gap:6,
          minHeight:34,
          maxWidth:'100%',
          padding:compact ? '7px 11px' : '8px 13px',
          borderRadius:12,
          border:`1px solid ${isSaved ? '#86EFAC' : C.primaryMid}`,
          background:isSaved ? '#ECFDF5' : '#fff',
          color:isSaved ? '#047857' : C.primary,
          fontFamily:PP,
          fontWeight:800,
          fontSize:11,
          lineHeight:1.2,
          cursor:saving || checking || isSaved ? 'default' : 'pointer',
          opacity:saving || checking ? 0.7 : 1,
          whiteSpace:'nowrap',
        }}
      >
        <span aria-hidden="true">{isSaved ? '✓' : '🔔'}</span>
        <span style={{ overflow:'hidden', textOverflow:'ellipsis' }}>{label}</span>
      </button>

      <Modal
        show={pushPromptOpen}
        onClose={() => setPushPromptOpen(false)}
        title="Recibe la novedad cuando aparezca"
        syncHistory={false}
      >
        <p style={{ fontFamily:PP, fontSize:13, color:C.mid, lineHeight:1.6, margin:'0 0 16px' }}>
          La búsqueda ya está guardada y recibirás las coincidencias por email. Activa también las notificaciones para verlas al momento en este dispositivo.
        </p>
        <button
          type="button"
          onClick={activatePush}
          disabled={activatingPush}
          style={{ width:'100%', border:'none', borderRadius:14, background:C.primary, color:'#fff', padding:'12px 16px', fontFamily:PP, fontWeight:800, fontSize:13, cursor:activatingPush ? 'default' : 'pointer' }}
        >
          {activatingPush ? 'Activando...' : 'Activar notificaciones'}
        </button>
        <button
          type="button"
          onClick={() => setPushPromptOpen(false)}
          style={{ width:'100%', border:'none', background:'transparent', color:C.mid, padding:'12px 16px 4px', fontFamily:PP, fontWeight:700, fontSize:12, cursor:'pointer' }}
        >
          Ahora no
        </button>
      </Modal>
    </>
  )
}
