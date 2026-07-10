import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { C } from '../lib/theme'

const SR_ONLY = {
  position:'absolute',
  width:1,
  height:1,
  padding:0,
  margin:-1,
  overflow:'hidden',
  clip:'rect(0, 0, 0, 0)',
  whiteSpace:'nowrap',
  border:0,
}

function fallbackCopy(text) {
  if (typeof document === 'undefined') return Promise.reject(new Error('No document'))

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '-9999px'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()

  try {
    const copied = document.execCommand('copy')
    document.body.removeChild(textarea)
    return copied ? Promise.resolve() : Promise.reject(new Error('Copy failed'))
  } catch (error) {
    document.body.removeChild(textarea)
    return Promise.reject(error)
  }
}

async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch {}
  }

  await fallbackCopy(text)
}

export function buildShareUrl(pathname, params={}) {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const url = new URL(pathname, origin || 'https://latidoch.vercel.app')

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    url.searchParams.set(key, String(value))
  })

  return origin ? url.toString() : `${url.pathname}${url.search}`
}

export default function ShareButton({
  title='Latido',
  text='Mira esto en Latido.',
  url,
  ariaLabel='Compartir',
  label='',
  icon='📤',
  style={},
}) {
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const statusTimer = useRef(null)
  const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '')

  useEffect(() => () => {
    if (statusTimer.current) window.clearTimeout(statusTimer.current)
  }, [])

  const announce = message => {
    setStatus(message)
    if (statusTimer.current) window.clearTimeout(statusTimer.current)
    statusTimer.current = window.setTimeout(() => setStatus(''), 2400)
  }

  const copyLink = async () => {
    await copyToClipboard(shareUrl)
    toast.success('Enlace copiado')
    announce('Enlace copiado al portapapeles')
  }

  const handleShare = async event => {
    event.stopPropagation()
    if (busy || !shareUrl) return

    const shareData = { title, text, url:shareUrl }
    const canUseNativeShare = typeof navigator !== 'undefined'
      && typeof navigator.share === 'function'
      && (!navigator.canShare || navigator.canShare(shareData))

    setBusy(true)
    try {
      if (canUseNativeShare) {
        await navigator.share(shareData)
        return
      }

      await copyLink()
    } catch (error) {
      if (error?.name === 'AbortError') return
      try {
        await copyLink()
      } catch {
        toast.error('No se pudo compartir')
        announce('No se pudo compartir el enlace')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      className="share-button"
      onClick={handleShare}
      disabled={busy || !shareUrl}
      aria-label={ariaLabel}
      title={ariaLabel}
      style={{
        width:38,
        height:38,
        borderRadius:'50%',
        border:`1px solid ${C.border}`,
        background:'#fff',
        color:C.mid,
        display:'inline-flex',
        alignItems:'center',
        justifyContent:'center',
        cursor:busy ? 'wait' : shareUrl ? 'pointer' : 'not-allowed',
        flexShrink:0,
        boxShadow:'0 4px 14px rgba(15,23,42,0.06)',
        transition:'background .15s, border-color .15s, color .15s, transform .15s',
        opacity:busy ? 0.7 : 1,
        ...style,
      }}
    >
      {icon && <span aria-hidden="true" style={{ fontSize:18, lineHeight:1 }}>{icon}</span>}
      {label && <span>{label}</span>}
      <span style={SR_ONLY} aria-live="polite">{status}</span>
    </button>
  )
}
