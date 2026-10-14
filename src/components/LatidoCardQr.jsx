import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

export default function LatidoCardQr({ value, label = 'QR de Tarjeta Latido', downloadName }) {
  const [src, setSrc] = useState('')
  const [error, setError] = useState(false)
  useEffect(() => {
    let active = true
    setSrc('')
    setError(false)
    if (value)
      QRCode.toDataURL(value, {
        width: downloadName ? 1024 : 320,
        margin: 3,
        errorCorrectionLevel: 'M'
      })
        .then((url) => {
          if (active) setSrc(url)
        })
        .catch(() => {
          if (active) setError(true)
        })
    return () => {
      active = false
    }
  }, [value, downloadName])
  if (error) return <p role="alert">No se pudo generar el QR. Vuelve a intentarlo.</p>
  return src ? (
    <>
      <img className="lc-qr" src={src} alt={label} />
      {downloadName && (
        <div className="lc-actions">
          <a className="lc-button lc-button--secondary" href={src} download={downloadName}>
            Descargar QR para impresión
          </a>
        </div>
      )}
    </>
  ) : (
    <p role="status">Preparando QR…</p>
  )
}
