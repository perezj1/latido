import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

export default function LatidoCardQr({ value, label = 'QR de Latido Card' }) {
  const [src, setSrc] = useState('')
  const [error, setError] = useState(false)
  useEffect(() => {
    let active = true
    setSrc('')
    setError(false)
    if (value)
      QRCode.toDataURL(value, { width: 320, margin: 3, errorCorrectionLevel: 'M' })
        .then((url) => {
          if (active) setSrc(url)
        })
        .catch(() => {
          if (active) setError(true)
        })
    return () => {
      active = false
    }
  }, [value])
  if (error) return <p role="alert">No se pudo generar el QR. Vuelve a intentarlo.</p>
  return src ? <img className="lc-qr" src={src} alt={label} /> : <p role="status">Preparando QR…</p>
}
