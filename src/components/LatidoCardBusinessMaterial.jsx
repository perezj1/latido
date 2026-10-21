import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { businessStickerImage } from '../lib/latidoCardStickerImage'
import toast from 'react-hot-toast'
import { businessCardUrl } from '../lib/latidoCard'
import { trackCardEvent } from '../lib/analytics'
import LatidoCardQr from './LatidoCardQr'

export function LatidoCardBusinessSticker({ business, stickerRef, onLoad }) {
  return (
    <div className="lc-business-sticker" ref={stickerRef} onLoadCapture={onLoad}>
      <strong>LATIDO CLUB</strong>
      <h3>{business.name}</h3>
      <LatidoCardQr value={businessCardUrl(business.id)} label={`QR público de ${business.name}`} />
      <strong className="lc-business-sticker-caption">Escanea para obtener descuentos</strong>
    </div>
  )
}

export function LatidoCardStaffGuide() {
  return (
    <article className="lc-staff-guide">
      <h1>Cómo aplicar un descuento de Latido Club</h1>
      <ol>
        <li>El cliente te enseña la pantalla del descuento en su móvil.</li>
        <li>
          Comprueba que aparece vuestro negocio, que el contador avanza y que la fecha y la hora son
          las de ahora.
        </li>
        <li>Aplica el descuento en vuestra caja, respetando la compra mínima.</li>
      </ol>
    </article>
  )
}

export default function LatidoCardBusinessMaterial({ business }) {
  const stickerRef = useRef(null),
    inputRef = useRef(null)
  const id = useId()
  const [busy, setBusy] = useState(false),
    [copied, setCopied] = useState(false)
  const url = businessCardUrl(business.id)
  const preparedImage = useRef(null)
  const prepareImage = useCallback(() => {
    if (preparedImage.current) return preparedImage.current
    const node = stickerRef.current
    const image = node?.querySelector('img.lc-qr')
    if (!node?.clientWidth || !image) return Promise.reject(new Error('QR pendiente'))
    preparedImage.current = (async () => {
      const blob = await businessStickerImage(node)
      return new File([blob], `latido-club-${business.id}.png`, { type: 'image/png' })
    })().catch((error) => {
      preparedImage.current = null
      throw error
    })
    return preparedImage.current
  }, [business.id])
  useEffect(() => {
    preparedImage.current = null
    // Prepare before a tap so file sharing keeps the browser's user activation.
    const observer = new ResizeObserver(() => {
      prepareImage().catch(() => {})
    })
    observer.observe(stickerRef.current)
    return () => observer.disconnect()
  }, [prepareImage, business.name])
  const download = (file) => {
    const href = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.download = file.name
    link.href = href
    link.click()
    setTimeout(() => URL.revokeObjectURL(href), 1000)
    trackCardEvent('qr_download')
  }
  return (
    <div className="lc-business-material">
      <LatidoCardBusinessSticker
        business={business}
        stickerRef={stickerRef}
        onLoad={() => {
          prepareImage().catch(() => {})
        }}
      />
      <div className="lc-actions">
        <button
          className="lc-button lc-button--secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              download(await prepareImage())
            } catch {
              toast.error('No se pudo descargar el QR. Vuelve a intentarlo.')
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? 'Preparando imagen…' : 'Descargar imagen'}
        </button>
        <button
          className="lc-button lc-button--secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              const file = await prepareImage()
              if (navigator.canShare?.({ files: [file] }) && navigator.share) {
                await navigator.share({ files: [file] })
                trackCardEvent('qr_share')
              } else {
                download(file)
                toast('Imagen descargada. Puedes compartirla desde tus archivos.')
              }
            } catch (error) {
              if (error.name !== 'AbortError')
                toast.error('No se pudo compartir la imagen. Prueba a descargarla.')
            } finally {
              setBusy(false)
            }
          }}
        >
          Compartir imagen
        </button>
      </div>
      <label className="lc-public-link" htmlFor={id}>
        Enlace público
      </label>
      <div className="lc-public-link-row">
        <input id={id} ref={inputRef} readOnly value={url} onFocus={(e) => e.target.select()} />
        <button
          className="lc-button lc-button--secondary"
          aria-label="Copiar enlace público"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url)
              setCopied(true)
            } catch {
              inputRef.current?.focus()
              inputRef.current?.select()
              toast('El enlace está seleccionado. Usa Copiar en tu dispositivo.')
            }
          }}
        >
          <span role="status">{copied ? 'Copiado' : 'Copiar'}</span>
        </button>
      </div>
    </div>
  )
}
