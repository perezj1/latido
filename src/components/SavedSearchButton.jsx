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
  setSavedSearchActive,
} from '../lib/savedSearches'
import {
  getPushStatus,
  loadPushSettings,
  subscribeToPushNotifications,
} from '../lib/pushNotifications'
import { Icon } from '../lib/icons'

export default function SavedSearchButton({ draft, compact = false, idleLabel = '', prominent = false, panel = false }) {
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
    if (saving) return

    if (existing?.active) {
      if (!panel) return
      setSaving(true)
      try {
        await setSavedSearchActive(user.id, existing.id, false)
        setExisting(current => ({ ...current, active:false }))
        toast.success('Aviso desactivado')
      } catch (error) {
        toast.error(error?.message || 'No se pudo desactivar el aviso')
      } finally {
        setSaving(false)
      }
      return
    }

    setSaving(true)
    try {
      const saved = await saveSavedSearch(user.id, draft)
      setExisting({ id:saved.id, active:true, push_enabled:true })
      toast.success(existing
        ? 'Alerta reactivada. Te avisaremos cuando haya una publicación relacionada.'
        : 'Has guardado tu búsqueda. Te avisaremos cuando haya una publicación relacionada.')
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
        ? panel ? 'Búsqueda guardada y aviso activo' : 'Alerta activa'
        : existing
          ? 'Reactivar alerta'
          : idleLabel
            ? idleLabel
            : compact
            ? 'Activar'
            : 'Avísame de nuevos resultados'

  return (
    <>
      <button
        type="button"
        onClick={handleSave}
        disabled={saving || checking || (isSaved && !panel)}
        role={panel ? 'switch' : undefined}
        aria-checked={panel ? isSaved : undefined}
        aria-label={label}
        style={{
          display:'inline-flex',
          alignItems:'center',
          justifyContent:panel ? 'space-between' : 'center',
          gap:panel ? 14 : 6,
          width:panel || prominent ? '100%' : undefined,
          minHeight:panel ? 64 : prominent ? 44 : 34,
          maxWidth:'100%',
          marginTop:panel ? 18 : undefined,
          padding:panel ? '11px 14px' : compact ? '7px 11px' : '8px 13px',
          borderRadius:panel ? 16 : prominent ? 14 : 12,
          border:panel ? `1px solid ${isSaved ? '#A7F3D0' : '#D7E4FF'}` : `1px solid ${isSaved ? '#86EFAC' : C.primaryMid}`,
          background:isSaved ? '#ECFDF5' : panel ? '#EEF4FF' : prominent ? C.primary : '#fff',
          color:panel ? C.text : isSaved ? '#047857' : prominent ? '#fff' : C.primary,
          fontFamily:PP,
          fontWeight:panel ? 400 : 800,
          fontSize:panel ? 11.5 : prominent ? 12.5 : 11,
          lineHeight:1.2,
          cursor:saving || checking || (isSaved && !panel) ? 'default' : 'pointer',
          opacity:saving || checking ? 0.7 : 1,
          whiteSpace:panel ? 'normal' : 'nowrap',
          textAlign:'left',
          boxShadow:prominent && !panel && !isSaved ? '0 8px 18px rgba(37,99,235,.2)' : 'none',
        }}
      >
        {panel ? (
          <>
            <span style={{ display:'inline-flex', alignItems:'center', gap:11, minWidth:0 }}>
              <span aria-hidden="true" style={{ color:C.primary, lineHeight:1 }}><Icon name="bell" size={19} /></span>
              <span style={{ overflow:'hidden', textOverflow:'ellipsis' }}>{label}</span>
            </span>
            <span
              aria-hidden="true"
              style={{
                width:44,
                height:26,
                padding:3,
                boxSizing:'border-box',
                borderRadius:999,
                background:isSaved ? C.primary : '#B8C5DA',
                display:'flex',
                alignItems:'center',
                justifyContent:isSaved ? 'flex-end' : 'flex-start',
                flexShrink:0,
                transition:'background .2s ease',
              }}
            >
              <span style={{ width:20, height:20, borderRadius:'50%', background:'#fff', boxShadow:'0 1px 3px rgba(15,23,42,.22)' }} />
            </span>
          </>
        ) : (
          <>
            <span aria-hidden="true"><Icon name={isSaved ? 'check' : 'bell'} size={15} /></span>
            <span style={{ overflow:'hidden', textOverflow:'ellipsis' }}>{label}</span>
          </>
        )}
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
