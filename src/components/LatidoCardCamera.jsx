import { useEffect, useRef, useState } from 'react'

export default function LatidoCardCamera({ onRead, onClose }) {
  const videoRef = useRef(null)
  const readRef = useRef(onRead)
  const [error, setError] = useState('')
  readRef.current = onRead
  useEffect(() => {
    let cancelled = false,
      controls,
      captured = false
    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('HTTPS_REQUIRED')
        const { BrowserQRCodeReader } = await import('@zxing/browser')
        if (cancelled) return
        const reader = new BrowserQRCodeReader()
        controls = await reader.decodeFromConstraints(
          { audio: false, video: { facingMode: { ideal: 'environment' } } },
          videoRef.current,
          (result, _error, scanner) => {
            if (!result || cancelled || captured) return
            captured = true
            scanner.stop()
            readRef.current(result.getText())
          }
        )
        if (cancelled || captured) controls.stop()
      } catch (err) {
        if (!cancelled)
          setError(
            err?.name === 'NotAllowedError'
              ? 'Permite el acceso a la cámara en los ajustes del navegador.'
              : 'No se pudo abrir la cámara. Comprueba el permiso y que la página use HTTPS.'
          )
      }
    }
    start()
    return () => {
      cancelled = true
      controls?.stop()
    }
  }, [])
  return (
    <section className="lc-camera" aria-label="Lector de QR">
      <video ref={videoRef} muted playsInline autoPlay aria-label="Vista de la cámara" />
      {error ? <p role="alert">{error}</p> : <p>Encuadra el QR de la tarjeta.</p>}
      <button className="lc-button lc-button--secondary" onClick={onClose}>
        Cerrar cámara
      </button>
    </section>
  )
}
