import { useEffect, useRef, useState } from 'react'

export default function LatidoCardCamera({
  onRead,
  onClose,
  hint = 'Encuadra el QR del negocio o de una Tarjeta Latido.'
}) {
  const dialogRef = useRef(null)
  const videoRef = useRef(null)
  const readRef = useRef(onRead)
  const [error, setError] = useState('')
  readRef.current = onRead
  useEffect(() => {
    dialogRef.current.showModal()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
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
      document.body.style.overflow = previousOverflow
    }
  }, [])
  return (
    <dialog
      ref={dialogRef}
      className="lc-camera"
      aria-labelledby="lc-camera-title"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
    >
      <h2 id="lc-camera-title">Scanner</h2>
      <video ref={videoRef} muted playsInline autoPlay aria-label="Vista de la cámara" />
      {error ? <p role="alert">{error}</p> : <p>{hint}</p>}
      <div className="lc-actions">
        <button className="lc-button lc-button--secondary" onClick={onClose} autoFocus>
          Cerrar cámara
        </button>
      </div>
    </dialog>
  )
}
