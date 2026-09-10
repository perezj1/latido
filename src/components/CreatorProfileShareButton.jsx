import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toBlob } from 'html-to-image'
import toast from 'react-hot-toast'
import { PP } from '../lib/theme'

const CARD_WIDTH = 540
const CARD_HEIGHT = 540

function cleanText(value, fallback='') {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  return text || fallback
}

function creatorInitials(name='') {
  return cleanText(name, 'C')
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('')
}

function safeFilename(name='creador', style='simple') {
  const slug = cleanText(name, 'creador')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
  return `${slug || 'creador'}-en-latido-${style}.png`
}

async function imageAsDataUrl(src='') {
  if (!src || src.startsWith('data:')) return src
  try {
    const response = await fetch(src, { mode:'cors', credentials:'omit', referrerPolicy:'no-referrer' })
    if (!response.ok) return ''
    const blob = await response.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return ''
  }
}

function nextPaint() {
  return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
}

function creatorNameFontSize(name='') {
  const length = cleanText(name).length
  if (length > 42) return 21
  if (length > 34) return 23
  if (length > 27) return 25
  if (length > 21) return 29
  return 37
}

function creatorCardContent(creator) {
  const name = cleanText(creator?.name, 'Creador Latido')
  const location = [creator?.city || creator?.reach, creator?.canton].filter(Boolean).join(', ')
  const fullTagline = cleanText(
    creator?.tagline,
    'Compartiendo información útil para la comunidad hispanohablante en Suiza.',
  )
  const tagline = fullTagline.length > 155 ? `${fullTagline.slice(0, 152).trim()}…` : fullTagline
  const handle = cleanText(creator?.handle)

  return { name, location, tagline, handle }
}

function SimpleCreatorShareCard({ creator, avatarUrl }) {
  const { name, location, tagline, handle } = creatorCardContent(creator)

  return (
    <div style={{ position:'relative', width:CARD_WIDTH, height:CARD_HEIGHT, overflow:'hidden', boxSizing:'border-box', padding:'24px 34px 20px', background:'linear-gradient(145deg, #FFFFFF 0%, #F8FAFF 58%, #EFF6FF 100%)', color:'#0F172A', fontFamily:PP }}>
      <header style={{ position:'relative', display:'flex', alignItems:'center' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <img src="/icon-192.png" alt="" crossOrigin="anonymous" style={{ display:'block', width:50, height:50, borderRadius:'50%', objectFit:'contain' }} />
          <span style={{ color:'#0F172A', fontSize:33, lineHeight:1, fontWeight:900, letterSpacing:-1.1 }}>Latido</span>
        </div>
      </header>

      <main style={{ position:'relative', display:'flex', height:450, alignItems:'center', flexDirection:'column', textAlign:'center' }}>
        <div style={{ position:'relative', width:146, height:146, flex:'0 0 146px', marginTop:10, display:'grid', placeItems:'center', border:'6px solid #fff', borderRadius:'50%', background:avatarUrl ? '#fff' : `linear-gradient(145deg, ${creator?.accent || '#2563EB'}, #0F172A)`, color:'#fff', boxShadow:'0 10px 28px rgba(15,23,42,0.17)', fontSize:42, fontWeight:900, overflow:'hidden' }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="" style={{ display:'block', width:'102%', height:'102%', maxWidth:'none', objectFit:'cover', objectPosition:'center' }} />
          ) : creatorInitials(name)}
        </div>

        <h1 style={{ width:'100%', maxWidth:470, margin:'11px 0 0', color:'#071633', fontSize:creatorNameFontSize(name), lineHeight:1.1, fontWeight:900, letterSpacing:-0.9, overflowWrap:'anywhere' }}>
          {name}
        </h1>
        <p style={{ margin:'5px 0 0', color:'#64748B', fontSize:14.5, lineHeight:1.35, fontWeight:700 }}>
          {[handle, location].filter(Boolean).join(' · ') || 'Creador de contenido en Suiza'}
        </p>

        <div style={{ width:'100%', maxWidth:440, boxSizing:'border-box', marginTop:17, padding:'14px 20px', borderRadius:18, background:'#EAF2FF', color:'#334155', fontSize:15.5, lineHeight:1.42, fontWeight:650 }}>
          {tagline}
        </div>

        <div style={{ maxWidth:460, marginTop:18, fontSize:14.5, lineHeight:1.55, fontWeight:700 }}>
          <span style={{ display:'block', color:'#2563EB', fontSize:15.5, fontWeight:800 }}>Juntos hacemos crecer la comunidad hispanohablante en Suiza.</span>
          <span style={{ display:'block', marginTop:2, color:'#64748B' }}>Latido crece contigo. · latido.ch</span>
        </div>
      </main>
    </div>
  )
}

function LatidoCreatorShareCard({ creator, avatarUrl, backgroundUrl }) {
  const { name, location, tagline, handle } = creatorCardContent(creator)

  return (
    <div style={{ position:'relative', width:CARD_WIDTH, height:CARD_HEIGHT, overflow:'hidden', boxSizing:'border-box', background:'#fff', color:'#0F172A', fontFamily:PP }}>
      <img src={backgroundUrl || '/latido_style.png'} alt="" style={{ position:'absolute', inset:0, display:'block', width:'100%', height:'100%', objectFit:'cover' }} />

      <header style={{ position:'absolute', zIndex:1, top:22, left:28, display:'flex', alignItems:'center', gap:8 }}>
        <img src="/icon-192.png" alt="" crossOrigin="anonymous" style={{ display:'block', width:42, height:42, borderRadius:'50%', objectFit:'contain' }} />
        <span style={{ color:'#0F172A', fontSize:29, lineHeight:1, fontWeight:900, letterSpacing:-1 }}>Latido</span>
      </header>

      <main style={{ position:'absolute', zIndex:1, top:67, right:34, bottom:64, left:34, display:'flex', alignItems:'center', flexDirection:'column', textAlign:'center' }}>
        <div style={{ position:'relative', width:128, height:128, flex:'0 0 128px', display:'grid', placeItems:'center', border:'5px solid #fff', borderRadius:'50%', background:avatarUrl ? '#fff' : `linear-gradient(145deg, ${creator?.accent || '#2563EB'}, #0F172A)`, color:'#fff', boxShadow:'0 9px 25px rgba(15,23,42,0.18)', fontSize:38, fontWeight:900, overflow:'hidden' }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="" style={{ display:'block', width:'102%', height:'102%', maxWidth:'none', objectFit:'cover', objectPosition:'center' }} />
          ) : creatorInitials(name)}
        </div>

        <h1 style={{ width:'100%', maxWidth:455, margin:'8px 0 0', color:'#071633', fontSize:creatorNameFontSize(name), lineHeight:1.08, fontWeight:900, letterSpacing:-0.9, overflowWrap:'anywhere' }}>
          {name}
        </h1>
        <p style={{ margin:'5px 0 0', color:'#64748B', fontSize:13.5, lineHeight:1.35, fontWeight:700 }}>
          {[handle, location].filter(Boolean).join(' · ') || 'Creador de contenido en Suiza'}
        </p>

        <div style={{ width:'100%', maxWidth:440, boxSizing:'border-box', marginTop:14, padding:'13px 20px', border:'1px solid rgba(219,234,254,0.9)', borderRadius:17, background:'rgba(234,242,255,0.9)', color:'#334155', fontSize:14.5, lineHeight:1.42, fontWeight:650 }}>
          {tagline}
        </div>

        <div style={{ width:'100%', maxWidth:465, marginTop:15, fontSize:13.5, lineHeight:1.5, fontWeight:700 }}>
          <span style={{ display:'block', color:'#2563EB', fontSize:14.5, fontWeight:800 }}>Juntos hacemos crecer la comunidad hispanohablante en Suiza.</span>
          <span style={{ display:'block', marginTop:3, color:'#64748B' }}>Latido crece contigo. · latido.ch</span>
        </div>
      </main>
    </div>
  )
}

function CreatorShareCard({ creator, avatarUrl, backgroundUrl, style }) {
  if (style === 'latido') {
    return <LatidoCreatorShareCard creator={creator} avatarUrl={avatarUrl} backgroundUrl={backgroundUrl} />
  }
  return <SimpleCreatorShareCard creator={creator} avatarUrl={avatarUrl} />
}

export default function CreatorProfileShareButton({ creator, isOwner=false, showTrigger=true, open=false, onClose, onShared }) {
  const cardRef = useRef(null)
  const previewUrlRef = useRef('')
  const autoOpenRef = useRef(false)
  const [busy, setBusy] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [backgroundUrl, setBackgroundUrl] = useState(null)
  const [cardStyle, setCardStyle] = useState('simple')
  const [preview, setPreview] = useState(null)
  const profileUrl = typeof window !== 'undefined' ? `${window.location.origin}/creadores/${creator.slug}` : `/creadores/${creator.slug}`

  const closePreview = () => {
    setPreview(null)
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = ''
    }
    onClose?.()
  }

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
  }, [])

  useEffect(() => {
    if (!preview) return undefined
    const previousOverflow = document.body.style.overflow
    const onKeyDown = event => {
      if (event.key === 'Escape') closePreview()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [preview])

  const createCard = async (nextStyle=cardStyle) => {
    if (busy || !cardRef.current) return
    setBusy(true)
    try {
      const [embeddedAvatar, embeddedBackground] = await Promise.all([
        avatarUrl === null ? imageAsDataUrl(creator.avatar_url) : Promise.resolve(avatarUrl),
        backgroundUrl === null ? imageAsDataUrl('/latido_style.png') : Promise.resolve(backgroundUrl),
      ])
      setAvatarUrl(embeddedAvatar)
      setBackgroundUrl(embeddedBackground)
      setCardStyle(nextStyle)
      await nextPaint()
      if (document.fonts?.ready) await document.fonts.ready
      const blob = await toBlob(cardRef.current, { backgroundColor:'#fff', cacheBust:true, pixelRatio:2 })
      if (!blob) throw new Error('No se pudo crear la imagen')

      const filename = safeFilename(creator.name, nextStyle)
      const file = new File([blob], filename, { type:'image/png' })
      const shareData = {
        files:[file],
        title:`${creator.name} en Latido`,
        text:`${creator.tagline || 'Mi contenido apoya a la comunidad hispanohablante en Suiza desde Latido.'}\n${profileUrl}`,
      }
      const canShare = typeof navigator.share === 'function'
        && typeof navigator.canShare === 'function'
        && navigator.canShare(shareData)
      const objectUrl = URL.createObjectURL(blob)
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = objectUrl
      setPreview({ objectUrl, filename, shareData, canShare, style:nextStyle })
    } catch {
      toast.error('No se pudo crear la tarjeta del perfil')
      if (!showTrigger) {
        autoOpenRef.current = false
        onClose?.()
      }
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!open) {
      autoOpenRef.current = false
      return
    }
    if (autoOpenRef.current) return
    autoOpenRef.current = true
    void createCard(cardStyle)
  }, [open])

  const downloadCard = () => {
    if (!preview) return
    const anchor = document.createElement('a')
    anchor.href = preview.objectUrl
    anchor.download = preview.filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    toast.success('Tarjeta descargada')
  }

  const shareCard = async () => {
    if (!preview) return
    try {
      if (preview.canShare) {
        await navigator.share(preview.shareData)
      } else if (typeof navigator.share === 'function') {
        await navigator.share({
          title:`${creator.name} en Latido`,
          text:creator.tagline || 'Apoyando a la comunidad hispanohablante en Suiza.',
          url:profileUrl,
        })
      } else {
        await copyProfileLink()
        return
      }
      onShared?.()
      closePreview()
    } catch (error) {
      if (error?.name !== 'AbortError') toast.error('No se pudo compartir el perfil')
    }
  }

  const copyProfileLink = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl)
      toast.success('Enlace del perfil copiado')
    } catch {
      toast.error('No se pudo copiar el enlace')
    }
  }

  return (
    <>
      {showTrigger && (
        <button type="button" className="creator-profile-share" onClick={() => createCard(cardStyle)} disabled={busy} aria-label="Compartir perfil como imagen">
          <span aria-hidden="true">{busy ? '⏳' : '📤'}</span>
          <span>{busy ? 'Creando…' : 'Compartir perfil'}</span>
        </button>
      )}

      <div aria-hidden="true" style={{ position:'fixed', left:-10000, top:0, width:CARD_WIDTH, height:CARD_HEIGHT, pointerEvents:'none', zIndex:-1 }}>
        <div ref={cardRef}>
          <CreatorShareCard creator={creator} avatarUrl={avatarUrl === null ? creator.avatar_url : avatarUrl} backgroundUrl={backgroundUrl} style={cardStyle} />
        </div>
      </div>

      {preview && createPortal(
        <div role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) closePreview() }} style={{ position:'fixed', inset:0, zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:18, background:'rgba(15,23,42,0.72)', backdropFilter:'blur(8px)' }}>
          <div role="dialog" aria-modal="true" aria-labelledby="creator-share-title" style={{ width:'min(430px, 100%)', maxHeight:'calc(100dvh - 36px)', overflowY:'auto', boxSizing:'border-box', padding:16, borderRadius:24, background:'#fff', boxShadow:'0 28px 80px rgba(0,0,0,0.35)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, marginBottom:12 }}>
              <div>
                <h2 id="creator-share-title" style={{ margin:0, color:'#0F172A', fontFamily:PP, fontSize:17, fontWeight:900 }}>
                  {isOwner ? 'Comparte tu perfil' : 'Comparte este perfil'}
                </h2>
                <p style={{ margin:'3px 0 0', color:'#64748B', fontFamily:PP, fontSize:10.5, fontWeight:600 }}>
                  {isOwner
                    ? 'Comparte en redes tu participación en la comunidad hispanohablante en Suiza.'
                    : 'Comparte el perfil de este creador para seguir apoyando a la comunidad.'}
                </p>
              </div>
              <button type="button" onClick={closePreview} aria-label="Cerrar vista previa" style={{ width:36, height:36, flexShrink:0, border:'1px solid #E2E8F0', borderRadius:'50%', background:'#fff', color:'#475569', fontSize:22, lineHeight:1, cursor:'pointer' }}>×</button>
            </div>

            <div aria-label="Estilo de tarjeta" style={{ width:'min(290px, 100%)', display:'grid', gridTemplateColumns:'1fr 1fr', gap:5, margin:'0 auto 12px', padding:4, border:'1px solid #E2E8F0', borderRadius:13, background:'#F8FAFC' }}>
              <button type="button" aria-pressed={cardStyle === 'simple'} onClick={() => createCard('simple')} disabled={busy || cardStyle === 'simple'} style={{ minHeight:34, padding:'0 10px', border:cardStyle === 'simple' ? '1px solid #BFDBFE' : '1px solid transparent', borderRadius:9, background:cardStyle === 'simple' ? '#fff' : 'transparent', color:cardStyle === 'simple' ? '#1D4ED8' : '#64748B', fontFamily:PP, fontSize:10.5, fontWeight:800, cursor:cardStyle === 'simple' ? 'default' : 'pointer', boxShadow:cardStyle === 'simple' ? '0 2px 8px rgba(15,23,42,0.07)' : 'none' }}>
                Tarjeta simple
              </button>
              <button type="button" aria-pressed={cardStyle === 'latido'} onClick={() => createCard('latido')} disabled={busy || cardStyle === 'latido'} style={{ minHeight:34, padding:'0 10px', border:cardStyle === 'latido' ? '1px solid #BFDBFE' : '1px solid transparent', borderRadius:9, background:cardStyle === 'latido' ? '#fff' : 'transparent', color:cardStyle === 'latido' ? '#1D4ED8' : '#64748B', fontFamily:PP, fontSize:10.5, fontWeight:800, cursor:cardStyle === 'latido' ? 'default' : 'pointer', boxShadow:cardStyle === 'latido' ? '0 2px 8px rgba(15,23,42,0.07)' : 'none' }}>
                Estilo Latido
              </button>
            </div>

            <div style={{ position:'relative' }}>
              <img src={preview.objectUrl} alt={`Vista previa de la tarjeta ${cardStyle === 'latido' ? 'Estilo Latido' : 'simple'}`} style={{ display:'block', width:'100%', height:'auto', borderRadius:17, boxShadow:'0 10px 30px rgba(15,23,42,0.16)', opacity:busy ? 0.55 : 1, transition:'opacity 160ms ease' }} />
              {busy && <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center', color:'#1D4ED8', fontFamily:PP, fontSize:13, fontWeight:800 }}>Generando estilo…</div>}
            </div>

            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'center', gap:26, marginTop:13, padding:'15px 14px 13px', border:'1px solid #E2E8F0', borderRadius:19, background:'#F8FAFC' }}>
              <div style={{ width:72, display:'flex', alignItems:'center', flexDirection:'column', gap:7 }}>
                <button type="button" onClick={shareCard} aria-label="Compartir perfil" style={{ width:54, height:54, display:'grid', placeItems:'center', border:'1px solid #E2E8F0', borderRadius:'50%', background:'#fff', color:'#475569', fontSize:23, cursor:'pointer', boxShadow:'0 6px 16px rgba(15,23,42,0.08)' }}>📤</button>
                <span style={{ color:'#334155', fontFamily:PP, fontSize:10.5, lineHeight:1.25, fontWeight:700, textAlign:'center' }}>Compartir</span>
              </div>
              <div style={{ width:72, display:'flex', alignItems:'center', flexDirection:'column', gap:7 }}>
                <button type="button" onClick={copyProfileLink} aria-label="Copiar enlace del perfil" style={{ width:54, height:54, display:'grid', placeItems:'center', border:'1px solid #E2E8F0', borderRadius:'50%', background:'#fff', color:'#475569', fontSize:23, cursor:'pointer', boxShadow:'0 6px 16px rgba(15,23,42,0.08)' }}>🔗</button>
                <span style={{ color:'#334155', fontFamily:PP, fontSize:10.5, lineHeight:1.25, fontWeight:700, textAlign:'center' }}>Copiar enlace</span>
              </div>
              <div style={{ width:72, display:'flex', alignItems:'center', flexDirection:'column', gap:7 }}>
                <button type="button" onClick={downloadCard} aria-label="Descargar tarjeta PNG" style={{ width:54, height:54, display:'grid', placeItems:'center', border:'1px solid #E2E8F0', borderRadius:'50%', background:'#fff', color:'#475569', fontSize:23, cursor:'pointer', boxShadow:'0 6px 16px rgba(15,23,42,0.08)' }}>⬇️</button>
                <span style={{ color:'#334155', fontFamily:PP, fontSize:10.5, lineHeight:1.25, fontWeight:700, textAlign:'center' }}>Descargar</span>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
