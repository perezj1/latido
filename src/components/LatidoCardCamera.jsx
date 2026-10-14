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
  const [attempt, setAttempt] = useState(0)
  readRef.current = onRead
  useEffect(() => {
    dialogRef.current.showModal()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])
  useEffect(() => {
    setError('')
    let cancelled = false,
      controls,
      stream,
      captured = false
    const stop = () => {
      controls?.stop()
      stream?.getTracks().forEach((track) => track.stop())
    }
    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('HTTPS_REQUIRED')
        // The browser owns permission persistence. Retry every time instead of
        // caching a refusal or claiming to grant camera access ourselves.
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: { ideal: 'environment' } }
          })
        } catch (err) {
          if (!['OverconstrainedError', 'NotFoundError'].includes(err?.name)) throw err
          if (cancelled) return
          stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true })
        }
        if (cancelled) {
          stop()
          return
        }
        const { BrowserQRCodeReader } = await import('@zxing/browser')
        if (cancelled) {
          stop()
          return
        }
        const reader = new BrowserQRCodeReader()
        controls = await reader.decodeFromStream(
          stream,
          videoRef.current,
          (result, _error, scanner) => {
            if (!result || cancelled || captured) return
            captured = true
            scanner.stop()
            stream.getTracks().forEach((track) => track.stop())
            readRef.current(result.getText())
          }
        )
        if (cancelled || captured) stop()
      } catch (err) {
        stop()
        if (!cancelled)
          setError(
            err?.name === 'NotAllowedError'
              ? 'Permite el acceso a la cámara para escanear. Puedes volver a intentarlo.'
              : err?.name === 'NotReadableError'
                ? 'La cámara está ocupada. Cierra otras apps que la usen y vuelve a intentarlo.'
                : 'No se pudo abrir la cámara. Comprueba el permiso y que la página use HTTPS.'
          )
      }
    }
    start()
    return () => {
      cancelled = true
      stop()
    }
  }, [attempt])
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
      {error && (
        <>
          <div className="lc-actions">
            <button className="lc-button" onClick={() => setAttempt((n) => n + 1)}>
              Volver a pedir permiso
            </button>
          </div>
          <details className="lc-camera-help">
            <summary>¿La cámara sigue bloqueada?</summary>
            <p>
              En iPhone: abre los ajustes del sitio en Safari y permite Cámara. En Android: Chrome →
              Configuración → Configuración de sitios → Cámara → permite este sitio.
            </p>
            <p>
              Si usas Latido instalada, revisa también los permisos de cámara del dispositivo.
              Después, vuelve a intentarlo aquí.
            </p>
          </details>
        </>
      )}
      <div className="lc-actions">
        <button className="lc-button lc-button--secondary" onClick={onClose} autoFocus>
          Cerrar cámara
        </button>
      </div>
    </dialog>
  )
}
