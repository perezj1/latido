import { useEffect, useRef, useState } from 'react'
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
  label = 'Reportar',
  icon = null,
  metadata = {},
  compact = false,
  style = {},
}) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [sending, setSending] = useState(false)
  const dialogRef = useRef(null)

  const isOwnContent = user?.id && ownerId && user.id === ownerId

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusFrame = window.requestAnimationFrame(() => dialogRef.current?.focus())

    const onKeyDown = event => {
      if (event.key === 'Escape') setOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const handleOpen = event => {
    event?.stopPropagation?.()
    if (isOwnContent) return
    setReason('')
    setNotes('')
    setOpen(true)
  }

  const submitReport = async () => {
    if (!reason || sending) return
    if (!user?.id) {
      toast.error('Inicia sesión para enviar el reporte')
      return
    }
    if (!contentId) return
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
    setReason('')
    setOpen(false)
  }

  if (isOwnContent) return null

  const modal = open && typeof document !== 'undefined' ? createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      tabIndex={-1}
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 500,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: '12px max(0px, env(safe-area-inset-right)) 0 max(0px, env(safe-area-inset-left))',
        background: 'rgba(15,23,42,0.58)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div
        onClick={event => event.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 500,
          height: 'min(800px, calc(100dvh - 12px))',
          maxHeight: 'calc(100dvh - 12px)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          background: '#fff',
          borderRadius: '28px 28px 0 0',
          border: `1px solid ${C.border}`,
          boxShadow: '0 28px 80px rgba(15,23,42,0.35)',
        }}
      >
        <div style={{ flexShrink:0, background:'#fff', borderBottom:`1px solid ${C.border}` }}>
          <div aria-hidden="true" style={{ width:46, height:5, borderRadius:999, background:'#D9DDD9', margin:'8px auto 5px' }} />
          <div style={{ padding:'8px 20px 17px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontFamily: PP, fontWeight: 900, fontSize: 21, color: C.text, margin: 0, letterSpacing:-0.35 }}>
                {title}
              </p>
              <p style={{ fontFamily: PP, fontSize: 13, color: C.mid, lineHeight: 1.55, margin: '4px 0 0', maxWidth:360 }}>
                Revisaremos la denuncia y podremos ocultar el contenido si incumple las reglas.
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
                background: '#fff',
                color: C.text,
                cursor: 'pointer',
                fontSize: 22,
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>
          </div>
        </div>

        <div className="no-scroll" style={{ flex:1, minHeight:0, overflowY:'auto', padding:'0 22px', scrollbarWidth:'none', msOverflowStyle:'none' }}>
          <div role="radiogroup" aria-label="Motivo del reporte">
            {REPORT_REASONS.map(item => (
              <div key={item.id} style={{ borderBottom:`1px solid ${C.borderLight}` }}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={reason === item.id}
                  onClick={() => {
                    setReason(item.id)
                    if (item.id !== 'other') setNotes('')
                  }}
                  style={{
                    width:'100%',
                    display:'flex',
                    alignItems:'flex-start',
                    gap:14,
                    fontFamily:PP,
                    fontSize:14,
                    fontWeight:800,
                    border:'none',
                    background:'#fff',
                    color:reason === item.id ? '#FF3341' : C.text,
                    padding:'15px 2px',
                    textAlign:'left',
                    cursor:'pointer',
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width:22,
                      height:22,
                      marginTop:1,
                      borderRadius:'50%',
                      border:`2px solid ${reason === item.id ? '#FF3341' : '#D5DAE2'}`,
                      background:reason === item.id ? '#FF3341' : '#fff',
                      display:'grid',
                      placeItems:'center',
                      boxSizing:'border-box',
                      flexShrink:0,
                    }}
                  >
                    {reason === item.id && <span style={{ width:8, height:8, borderRadius:'50%', background:'#fff' }} />}
                  </span>
                  <span style={{ minWidth:0, flex:1 }}>
                    <span style={{ display:'block', lineHeight:1.45 }}>{item.label}</span>
                    {reason === item.id && item.description && (
                      <span style={{ display:'block', fontSize:12, fontWeight:500, color:C.mid, lineHeight:1.55, marginTop:5 }}>
                        {item.description}
                      </span>
                    )}
                  </span>
                </button>

                {reason === item.id && item.id === 'other' && (
                  <textarea
                    value={notes}
                    onChange={event => setNotes(event.target.value)}
                    placeholder="Añade detalles, URL externa, datos de contacto sospechosos o por qué crees que incumple las reglas."
                    rows={3}
                    style={{
                      width:'100%',
                      boxSizing:'border-box',
                      fontFamily:PP,
                      fontSize:13,
                      border:`1px solid ${C.border}`,
                      borderRadius:16,
                      padding:'13px 15px',
                      resize:'none',
                      outline:'none',
                      background:'#F8F8F7',
                      color:C.text,
                      minHeight:92,
                      margin:'4px 2px 16px',
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={{ flexShrink:0, background:'#fff', borderTop:`1px solid ${C.border}`, padding:`14px 20px calc(14px + env(safe-area-inset-bottom))` }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={sending}
              style={{
                fontFamily: PP,
                fontWeight: 800,
                fontSize: 14,
                borderRadius: 16,
                border: 'none',
                background: '#EEF2FF',
                color: C.primary,
                padding: '16px 14px',
                cursor: sending ? 'not-allowed' : 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={submitReport}
              disabled={!reason || sending}
              style={{
                fontFamily: PP,
                fontWeight: 800,
                fontSize: 14,
                borderRadius: 16,
                border: 'none',
                background:reason && !sending ? '#FF3341' : '#F5B0B4',
                color: '#fff',
                padding: '16px 14px',
                cursor:!reason || sending ? 'not-allowed' : 'pointer',
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
        {icon}
        {label}
      </button>
      {modal}
    </>
  )
}
