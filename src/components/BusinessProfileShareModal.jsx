import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toBlob } from 'html-to-image'
import toast from 'react-hot-toast'
import { PP } from '../lib/theme'

const CARD_SIZE = 540

function cleanText(value, fallback='') {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  return text || fallback
}

function truncateText(value, maxLength) {
  const text = cleanText(value)
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}…` : text
}

function businessNameFontSize(name='') {
  const length = cleanText(name).length
  if (length > 46) return 21
  if (length > 36) return 24
  if (length > 27) return 27
  if (length > 20) return 31
  return 37
}

function safeFilename(name='negocio', style='simple') {
  const slug = cleanText(name, 'negocio')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
  return `${slug || 'negocio'}-en-latido-${style}.png`
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

function businessCardContent(business, categoryLabel='') {
  return {
    name:cleanText(business?.name, 'Negocio en Latido'),
    category:cleanText(categoryLabel || business?.type, 'Negocio local'),
    location:[business?.city, business?.canton].filter(Boolean).join(', '),
    description:truncateText(business?.desc || business?.description, 145)
      || 'Un negocio de nuestra comunidad hispanohablante en Suiza.',
  }
}

function BusinessPhoto({ imageUrl, name, compact=false }) {
  const size = compact ? 128 : 146
  return (
    <div style={{ position:'relative', width:size, height:size, flex:`0 0 ${size}px`, display:'grid', placeItems:'center', overflow:'hidden', boxSizing:'border-box', border:'4px solid #fff', borderRadius:compact ? 16 : 18, background:'#F8FAFC', color:'#1D4ED8', boxShadow:'0 9px 24px rgba(15,23,42,0.13)', fontSize:compact ? 39 : 46, fontWeight:900 }}>
      {imageUrl ? (
        <img src={imageUrl} alt="" style={{ display:'block', width:'100%', height:'100%', objectFit:'contain', objectPosition:'center', background:'#fff' }} />
      ) : (
        <span aria-label={name}>🏪</span>
      )}
    </div>
  )
}

function SimpleBusinessShareCard({ business, categoryLabel, imageUrl }) {
  const { name, category, location, description } = businessCardContent(business, categoryLabel)
  return (
    <div style={{ width:CARD_SIZE, height:CARD_SIZE, overflow:'hidden', boxSizing:'border-box', padding:'24px 34px 20px', background:'linear-gradient(145deg, #FFFFFF 0%, #F8FAFF 58%, #EFF6FF 100%)', color:'#0F172A', fontFamily:PP }}>
      <header style={{ display:'flex', alignItems:'center', gap:10 }}>
        <img src="/icon-192.png" alt="" crossOrigin="anonymous" style={{ display:'block', width:50, height:50, borderRadius:'50%', objectFit:'contain' }} />
        <span style={{ color:'#0F172A', fontSize:33, lineHeight:1, fontWeight:900, letterSpacing:-1.1 }}>Latido</span>
      </header>

      <main style={{ display:'flex', height:450, alignItems:'center', flexDirection:'column', textAlign:'center' }}>
        <span style={{ marginTop:8, marginBottom:7, padding:'6px 13px', borderRadius:999, background:'#EFF6FF', color:'#1D4ED8', fontSize:12, lineHeight:1, fontWeight:800 }}>{category}</span>
        <BusinessPhoto imageUrl={imageUrl} name={name} />
        <h1 style={{ width:'100%', maxWidth:465, margin:'10px 0 0', color:'#071633', fontSize:businessNameFontSize(name), lineHeight:1.08, fontWeight:900, letterSpacing:-0.9, overflowWrap:'anywhere' }}>{name}</h1>
        <p style={{ margin:'5px 0 0', color:'#64748B', fontSize:14, lineHeight:1.3, fontWeight:700 }}>📍 {location || 'Suiza'}</p>
        <div style={{ width:'100%', maxWidth:440, boxSizing:'border-box', marginTop:11, padding:'11px 18px', borderRadius:17, background:'#EAF2FF', color:'#334155', fontSize:14, lineHeight:1.4, fontWeight:650 }}>{description}</div>
        <div style={{ maxWidth:460, marginTop:12, fontSize:13, lineHeight:1.45, fontWeight:700 }}>
          <span style={{ display:'block', color:'#2563EB', fontSize:14, fontWeight:800 }}>Apoyando a los negocios de nuestra comunidad en Suiza.</span>
          <span style={{ display:'block', marginTop:2, color:'#64748B' }}>Somos parte de Latido · latido.ch</span>
        </div>
      </main>
    </div>
  )
}

function LatidoBusinessShareCard({ business, categoryLabel, imageUrl, backgroundUrl }) {
  const { name, category, location, description } = businessCardContent(business, categoryLabel)
  return (
    <div style={{ position:'relative', width:CARD_SIZE, height:CARD_SIZE, overflow:'hidden', boxSizing:'border-box', background:'#fff', color:'#0F172A', fontFamily:PP }}>
      <img src={backgroundUrl || '/latido_style.png'} alt="" style={{ position:'absolute', inset:0, display:'block', width:'100%', height:'100%', objectFit:'cover' }} />
      <header style={{ position:'absolute', zIndex:1, top:22, left:28, display:'flex', alignItems:'center', gap:8 }}>
        <img src="/icon-192.png" alt="" crossOrigin="anonymous" style={{ display:'block', width:42, height:42, borderRadius:'50%', objectFit:'contain' }} />
        <span style={{ color:'#0F172A', fontSize:29, lineHeight:1, fontWeight:900, letterSpacing:-1 }}>Latido</span>
      </header>

      <main style={{ position:'absolute', zIndex:1, top:67, right:34, bottom:64, left:34, display:'flex', alignItems:'center', flexDirection:'column', textAlign:'center' }}>
        <span style={{ marginBottom:6, padding:'6px 13px', borderRadius:999, background:'rgba(239,246,255,0.94)', color:'#1D4ED8', fontSize:11.5, lineHeight:1, fontWeight:800 }}>{category}</span>
        <BusinessPhoto imageUrl={imageUrl} name={name} compact />
        <h1 style={{ width:'100%', maxWidth:465, margin:'8px 0 0', color:'#071633', fontSize:businessNameFontSize(name), lineHeight:1.06, fontWeight:900, letterSpacing:-0.9, overflowWrap:'anywhere' }}>{name}</h1>
        <p style={{ margin:'4px 0 0', color:'#64748B', fontSize:13.5, lineHeight:1.3, fontWeight:700 }}>📍 {location || 'Suiza'}</p>
        <div style={{ width:'100%', maxWidth:440, boxSizing:'border-box', marginTop:10, padding:'10px 18px', border:'1px solid rgba(219,234,254,0.9)', borderRadius:17, background:'rgba(234,242,255,0.9)', color:'#334155', fontSize:13.5, lineHeight:1.38, fontWeight:650 }}>{description}</div>
        <div style={{ width:'100%', maxWidth:465, marginTop:10, fontSize:13, lineHeight:1.45, fontWeight:700 }}>
          <span style={{ display:'block', color:'#2563EB', fontSize:14, fontWeight:800 }}>Apoyando a los negocios de nuestra comunidad en Suiza.</span>
          <span style={{ display:'block', marginTop:2, color:'#64748B' }}>Somos parte de Latido · latido.ch</span>
        </div>
      </main>
    </div>
  )
}

function BusinessShareCard({ business, categoryLabel, imageUrl, backgroundUrl, style }) {
  if (style === 'latido') return <LatidoBusinessShareCard business={business} categoryLabel={categoryLabel} imageUrl={imageUrl} backgroundUrl={backgroundUrl} />
  return <SimpleBusinessShareCard business={business} categoryLabel={categoryLabel} imageUrl={imageUrl} />
}

export default function BusinessProfileShareModal({ business, categoryLabel='', imageUrl:sourceImageUrl='', url='', isOwner=false, open=false, onClose }) {
  const cardRef = useRef(null)
  const previewUrlRef = useRef('')
  const busyRef = useRef(false)
  const [busy, setBusy] = useState(false)
  const [embeddedImageUrl, setEmbeddedImageUrl] = useState(null)
  const [backgroundUrl, setBackgroundUrl] = useState(null)
  const [cardStyle, setCardStyle] = useState('simple')
  const [preview, setPreview] = useState(null)
  const businessPath = url || `/negocios/${business?.id}`
  const businessUrl = typeof window !== 'undefined'
    ? new URL(businessPath, window.location.origin).toString()
    : businessPath

  const releasePreview = () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = ''
    setPreview(null)
  }

  const closeModal = () => {
    releasePreview()
    onClose?.()
  }

  const createCard = async (nextStyle='simple') => {
    if (busyRef.current || !cardRef.current) return
    busyRef.current = true
    setBusy(true)
    try {
      const [nextImageUrl, nextBackgroundUrl] = await Promise.all([
        embeddedImageUrl === null ? imageAsDataUrl(sourceImageUrl) : Promise.resolve(embeddedImageUrl),
        backgroundUrl === null ? imageAsDataUrl('/latido_style.png') : Promise.resolve(backgroundUrl),
      ])
      setEmbeddedImageUrl(nextImageUrl)
      setBackgroundUrl(nextBackgroundUrl)
      setCardStyle(nextStyle)
      await nextPaint()
      if (document.fonts?.ready) await document.fonts.ready
      const blob = await toBlob(cardRef.current, { backgroundColor:'#fff', cacheBust:true, pixelRatio:2 })
      if (!blob) throw new Error('No se pudo crear la imagen')

      const filename = safeFilename(business?.name, nextStyle)
      const file = new File([blob], filename, { type:'image/png' })
      const shareData = {
        files:[file],
        title:`${business?.name || 'Negocio'} en Latido`,
        text:`Descubre ${business?.name || 'este negocio'} en Latido.\n${businessUrl}`,
      }
      const canShare = typeof navigator.share === 'function'
        && typeof navigator.canShare === 'function'
        && navigator.canShare(shareData)
      const objectUrl = URL.createObjectURL(blob)
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = objectUrl
      setPreview({ objectUrl, filename, shareData, canShare })
    } catch {
      toast.error('No se pudo crear la tarjeta del negocio')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
  }, [])

  useEffect(() => {
    if (!open) return undefined
    const previousOverflow = document.body.style.overflow
    const onKeyDown = event => {
      if (event.key === 'Escape') closeModal()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    setCardStyle('simple')
    void createCard('simple')
  }, [open, business?.id])

  const copyBusinessLink = async () => {
    try {
      await navigator.clipboard.writeText(businessUrl)
      toast.success('Enlace del negocio copiado')
    } catch {
      toast.error('No se pudo copiar el enlace')
    }
  }

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
      if (preview.canShare) await navigator.share(preview.shareData)
      else if (typeof navigator.share === 'function') {
        await navigator.share({ title:`${business?.name || 'Negocio'} en Latido`, text:'Descubre este negocio en Latido.', url:businessUrl })
      } else {
        await copyBusinessLink()
        return
      }
      closeModal()
    } catch (error) {
      if (error?.name !== 'AbortError') toast.error('No se pudo compartir el negocio')
    }
  }

  return (
    <>
      <div aria-hidden="true" style={{ position:'fixed', left:-10000, top:0, width:CARD_SIZE, height:CARD_SIZE, pointerEvents:'none', zIndex:-1 }}>
        <div ref={cardRef}>
          <BusinessShareCard business={business} categoryLabel={categoryLabel} imageUrl={embeddedImageUrl === null ? sourceImageUrl : embeddedImageUrl} backgroundUrl={backgroundUrl} style={cardStyle} />
        </div>
      </div>

      {open && createPortal(
        <div role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) closeModal() }} style={{ position:'fixed', inset:0, zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:18, background:'rgba(15,23,42,0.72)', backdropFilter:'blur(8px)' }}>
          <div role="dialog" aria-modal="true" aria-labelledby="business-share-title" style={{ width:'min(430px, 100%)', maxHeight:'calc(100dvh - 36px)', overflowY:'auto', boxSizing:'border-box', padding:16, borderRadius:24, background:'#fff', boxShadow:'0 28px 80px rgba(0,0,0,0.35)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, marginBottom:12 }}>
              <div>
                <h2 id="business-share-title" style={{ margin:0, color:'#0F172A', fontFamily:PP, fontSize:17, fontWeight:900 }}>{isOwner ? 'Comparte tu negocio' : 'Comparte este negocio'}</h2>
                <p style={{ margin:'3px 0 0', color:'#64748B', fontFamily:PP, fontSize:10.5, fontWeight:600 }}>
                  {isOwner
                    ? 'Comparte tu negocio en redes para alcanzar un mayor número de personas.'
                    : 'Comparte este negocio para apoyar a la comunidad.'}
                </p>
              </div>
              <button type="button" onClick={closeModal} aria-label="Cerrar vista previa" style={{ width:36, height:36, flexShrink:0, border:'1px solid #E2E8F0', borderRadius:'50%', background:'#fff', color:'#475569', fontSize:22, lineHeight:1, cursor:'pointer' }}>×</button>
            </div>

            <div aria-label="Estilo de tarjeta" style={{ width:'min(290px, 100%)', display:'grid', gridTemplateColumns:'1fr 1fr', gap:5, margin:'0 auto 12px', padding:4, border:'1px solid #E2E8F0', borderRadius:13, background:'#F8FAFC' }}>
              {[
                ['simple', 'Tarjeta simple'],
                ['latido', 'Estilo Latido'],
              ].map(([id, label]) => (
                <button key={id} type="button" aria-pressed={cardStyle === id} onClick={() => createCard(id)} disabled={busy || cardStyle === id} style={{ minHeight:34, padding:'0 10px', border:cardStyle === id ? '1px solid #BFDBFE' : '1px solid transparent', borderRadius:9, background:cardStyle === id ? '#fff' : 'transparent', color:cardStyle === id ? '#1D4ED8' : '#64748B', fontFamily:PP, fontSize:10.5, fontWeight:800, cursor:cardStyle === id ? 'default' : 'pointer', boxShadow:cardStyle === id ? '0 2px 8px rgba(15,23,42,0.07)' : 'none' }}>{label}</button>
              ))}
            </div>

            <div style={{ position:'relative', minHeight:180, display:'grid', placeItems:'center' }}>
              {preview && <img src={preview.objectUrl} alt={`Vista previa de la tarjeta del negocio ${cardStyle === 'latido' ? 'Estilo Latido' : 'simple'}`} style={{ display:'block', width:'100%', height:'auto', borderRadius:17, boxShadow:'0 10px 30px rgba(15,23,42,0.16)', opacity:busy ? 0.55 : 1, transition:'opacity 160ms ease' }} />}
              {(!preview || busy) && <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center', color:'#1D4ED8', fontFamily:PP, fontSize:13, fontWeight:800 }}>{preview ? 'Generando estilo…' : 'Creando tarjeta…'}</div>}
            </div>

            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'center', gap:26, marginTop:13, padding:'15px 14px 13px', border:'1px solid #E2E8F0', borderRadius:19, background:'#F8FAFC' }}>
              {[
                ['📤', 'Compartir', shareCard, 'Compartir negocio'],
                ['🔗', 'Copiar enlace', copyBusinessLink, 'Copiar enlace del negocio'],
                ['⬇️', 'Descargar', downloadCard, 'Descargar tarjeta PNG'],
              ].map(([icon, label, action, ariaLabel], index) => (
                <div key={label} style={{ width:72, display:'flex', alignItems:'center', flexDirection:'column', gap:7 }}>
                  <button type="button" onClick={action} disabled={!preview || busy} aria-label={ariaLabel} style={{ width:54, height:54, display:'grid', placeItems:'center', border:index === 0 ? '1px solid #BFDBFE' : '1px solid #E2E8F0', borderRadius:'50%', background:'#fff', color:index === 0 ? '#2563EB' : '#475569', fontSize:23, cursor:!preview || busy ? 'wait' : 'pointer', opacity:!preview || busy ? 0.6 : 1, boxShadow:index === 0 ? '0 6px 16px rgba(37,99,235,0.12)' : '0 6px 16px rgba(15,23,42,0.08)' }}>{icon}</button>
                  <span style={{ color:'#334155', fontFamily:PP, fontSize:10.5, lineHeight:1.25, fontWeight:700, textAlign:'center' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
