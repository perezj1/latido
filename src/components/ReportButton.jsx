import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import { C, PP } from '../lib/theme'
import { REPORT_REASONS, reportContent } from '../lib/reports'

export default function ReportButton({
  contentType,
  contentId,
  ownerId,
  title = 'Reportar contenido',
  metadata = {},
  compact = false,
  style = {},
}) {
  const { user, isLoggedIn } = useAuth()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState(REPORT_REASONS[0].id)
  const [notes, setNotes] = useState('')
  const [sending, setSending] = useState(false)

  const isOwnContent = user?.id && ownerId && user.id === ownerId

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = event => {
      if (event.key === 'Escape') setOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const handleOpen = event => {
    event?.stopPropagation?.()
    if (!isLoggedIn) {
      toast.error('Inicia sesion para reportar contenido')
      return
    }
    if (isOwnContent) return
    setOpen(true)
  }

  const submitReport = async () => {
    if (!user?.id || !contentId || sending) return
    setSending(true)
    const { error } = await reportContent({
      reporterId: user.id,
      contentType,
      contentId,
      reason,
      notes,
      metadata: {
        ...metadata,
        reported_owner_id: ownerId || null,
      },
    })
    setSending(false)

    if (error) {
      toast.error(error.message || 'No se pudo enviar el reporte')
      return
    }

    toast.success('Reporte enviado. Gracias por avisar.')
    setNotes('')
    setReason(REPORT_REASONS[0].id)
    setOpen(false)
  }

  if (isOwnContent) return null

  const modal = open && typeof document !== 'undefined' ? createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(15,23,42,0.58)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div
        onClick={event => event.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 440,
          maxHeight: 'calc(100vh - 32px)',
          overflowY: 'auto',
          background: '#fff',
          borderRadius: 22,
          border: `1px solid ${C.border}`,
          boxShadow: '0 28px 80px rgba(15,23,42,0.35)',
        }}
      >
        <div style={{ position: 'sticky', top: 0, background: '#fff', padding: '18px 20px 12px', borderBottom: `1px solid ${C.border}`, borderRadius: '22px 22px 0 0', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 18, color: C.text, margin: 0 }}>
                {title}
              </p>
              <p style={{ fontFamily: PP, fontSize: 12, color: C.mid, lineHeight: 1.5, margin: '5px 0 0' }}>
                Revisaremos el contenido desde administracion.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                border: `1px solid ${C.border}`,
                background: C.bg,
                color: C.mid,
                cursor: 'pointer',
                fontSize: 16,
                flexShrink: 0,
              }}
            >
              x
            </button>
          </div>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {REPORT_REASONS.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setReason(item.id)}
                style={{
                  fontFamily: PP,
                  fontSize: 13,
                  fontWeight: 800,
                  borderRadius: 14,
                  border: `1.5px solid ${reason === item.id ? '#DC2626' : C.border}`,
                  background: reason === item.id ? '#FEF2F2' : '#fff',
                  color: reason === item.id ? '#B91C1C' : C.text,
                  padding: '13px 14px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  boxShadow: reason === item.id ? '0 0 0 3px rgba(220,38,38,0.08)' : 'none',
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          <textarea
            value={notes}
            onChange={event => setNotes(event.target.value)}
            placeholder="Detalles opcionales"
            rows={4}
            style={{
              fontFamily: PP,
              fontSize: 14,
              border: `1.5px solid ${C.border}`,
              borderRadius: 16,
              padding: '13px 14px',
              resize: 'none',
              outline: 'none',
              background: C.bg,
              color: C.text,
              minHeight: 104,
            }}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 2 }}>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={sending}
              style={{
                fontFamily: PP,
                fontWeight: 800,
                fontSize: 13,
                borderRadius: 15,
                border: `1.5px solid ${C.border}`,
                background: C.bg,
                color: C.primary,
                padding: '13px 14px',
                cursor: sending ? 'not-allowed' : 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={submitReport}
              disabled={sending}
              style={{
                fontFamily: PP,
                fontWeight: 800,
                fontSize: 13,
                borderRadius: 15,
                border: 'none',
                background: sending ? C.border : '#DC2626',
                color: '#fff',
                padding: '13px 14px',
                cursor: sending ? 'not-allowed' : 'pointer',
              }}
            >
              {sending ? 'Enviando...' : 'Enviar reporte'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  ) : null

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        style={{
          fontFamily: PP,
          fontWeight: 700,
          fontSize: compact ? 10 : 12,
          borderRadius: compact ? 999 : 12,
          border: '1.5px solid #FCA5A5',
          background: '#fff',
          color: '#DC2626',
          padding: compact ? '4px 8px' : '9px 12px',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 5,
          ...style,
        }}
      >
        Reportar
      </button>
      {modal}
    </>
  )
}
