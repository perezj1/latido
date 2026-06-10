import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import toast from 'react-hot-toast'
import {
  PUSH_SETTINGS_KEY,
  getPushStatus,
  loadPushSettings,
  subscribeToPushNotifications,
} from '../lib/pushNotifications'
import { C, PP } from '../lib/theme'

export default function PostPublishPushModal({
  open,
  user,
  userCanton = '',
  onActivated,
  onComplete,
}) {
  const [permission, setPermission] = useState('default')
  const [phase, setPhase] = useState('')

  useEffect(() => {
    if (!open) {
      setPhase('')
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    getPushStatus()
      .then(status => setPermission(status.permission))
      .catch(() => setPermission('unsupported'))

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  if (!open || typeof document === 'undefined') return null

  const publish = async () => {
    setPhase('publishing')

    try {
      await onActivated?.()
      onComplete?.()
    } catch (error) {
      toast.error(error?.message || 'No se pudo publicar')
      setPhase('')
    }
  }

  const activateAndPublish = async () => {
    if (phase) return
    setPhase('activating')

    try {
      const settings = {
        ...loadPushSettings(),
        messagesEnabled:true,
      }
      await subscribeToPushNotifications({ user, settings, userCanton })
      localStorage.setItem(PUSH_SETTINGS_KEY, JSON.stringify(settings))
      toast.success('Notificaciones activadas')
    } catch {
      const status = await getPushStatus().catch(() => null)
      if (status?.permission) setPermission(status.permission)
      toast.error('No se activaron las notificaciones. Publicando igualmente.')
    }

    await publish()
  }

  const publishWithoutNotifications = async () => {
    if (phase) return
    await publish()
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="post-publish-push-title"
      style={{
        position:'fixed',
        inset:0,
        zIndex:600,
        display:'flex',
        alignItems:'center',
        justifyContent:'center',
        padding:18,
        background:'rgba(15,23,42,0.62)',
        backdropFilter:'blur(8px)',
        WebkitBackdropFilter:'blur(8px)',
      }}
    >
      <div
        onClick={event => event.stopPropagation()}
        style={{
          width:'100%',
          maxWidth:420,
          background:'#fff',
          borderRadius:24,
          border:`1px solid ${C.border}`,
          padding:'24px 22px 20px',
          textAlign:'center',
          boxShadow:'0 30px 90px rgba(15,23,42,0.36)',
        }}
      >
        <div style={{ width:68, height:68, borderRadius:22, background:'#DBEAFE', display:'flex', alignItems:'center', justifyContent:'center', fontSize:34, margin:'0 auto 16px' }}>
          🔔
        </div>
        <h2 id="post-publish-push-title" style={{ fontFamily:PP, fontWeight:900, fontSize:21, color:C.text, margin:'0 0 8px' }}>
          No te pierdas nada
        </h2>
        <p style={{ fontFamily:PP, fontSize:13, color:C.mid, lineHeight:1.65, margin:'0 0 14px' }}>
          Activa las notificaciones para saber cuándo alguien responde a tu publicación.
        </p>

        {permission === 'denied' && (
          <div style={{ background:'#FFF7ED', border:'1px solid #FED7AA', borderRadius:13, padding:'10px 12px', marginBottom:14 }}>
            <p style={{ fontFamily:PP, fontSize:11, color:'#9A3412', lineHeight:1.5, margin:0 }}>
              Las notificaciones están bloqueadas. Puedes publicar igualmente con “Ahora no”.
            </p>
          </div>
        )}

        {permission === 'unsupported' && (
          <div style={{ background:'#F8FAFC', border:`1px solid ${C.border}`, borderRadius:13, padding:'10px 12px', marginBottom:14 }}>
            <p style={{ fontFamily:PP, fontSize:11, color:C.mid, lineHeight:1.5, margin:0 }}>
              Este navegador no permite notificaciones push, pero puedes publicar igualmente.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={activateAndPublish}
          disabled={Boolean(phase)}
          style={{
            width:'100%',
            border:'none',
            borderRadius:14,
            padding:'12px 16px',
            background:C.primary,
            color:'#fff',
            fontFamily:PP,
            fontWeight:800,
            fontSize:13,
            cursor:phase ? 'default' : 'pointer',
            opacity:phase ? 0.65 : 1,
          }}
        >
          {phase === 'activating'
            ? 'Activando notificaciones...'
            : phase === 'publishing'
              ? 'Publicando...'
              : 'Activar notificaciones y publicar'}
        </button>
        <button
          type="button"
          onClick={publishWithoutNotifications}
          disabled={Boolean(phase)}
          style={{
            border:'none',
            padding:'12px 10px 0',
            background:'transparent',
            color:C.mid,
            fontFamily:PP,
            fontWeight:600,
            fontSize:10,
            cursor:phase ? 'default' : 'pointer',
            opacity:phase ? 0.45 : 0.75,
          }}
        >
          Ahora no
        </button>
      </div>
    </div>,
    document.body,
  )
}
