import { useState } from 'react'

export default function LatidoCardCameraHelp() {
  const ua = navigator.userAgent
  const ios =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const android = /Android/.test(ua)
  // Three choices on each platform. On iOS, Chrome and Brave share the
  // system permission steps; Safari has its own website settings.
  const tabs = ios ? ['Safari', 'Chrome / Brave', 'Firefox'] : ['Chrome', 'Brave', 'Firefox']
  const [selected, setSelected] = useState(() =>
    /Firefox|FxiOS/.test(ua) ? 2 : ios && /CriOS|Brave/.test(ua) ? 1 : 0
  )
  let steps
  if (ios && selected === 0) {
    steps = [
      'Abre latido.ch en Safari. Toca el menú de página junto a la dirección y luego Más (…) → Ajustes del sitio web.',
      'En Cámara, elige Permitir para latido.ch. Si no aparece, ve a Ajustes del iPhone → Apps → Safari → Cámara y elige Preguntar.',
      'Vuelve a Latido, recarga la página y abre Scanner. Pulsa Permitir si Safari lo solicita.'
    ]
  } else if (ios) {
    const browser = selected === 2 ? 'Firefox' : 'Chrome o Brave'
    steps = [
      `Abre Ajustes del iPhone → Privacidad y seguridad → Cámara. Activa ${browser} si aparece en la lista. También puedes revisar Ajustes → Apps → tu navegador → Cámara.`,
      selected === 1
        ? 'En Chrome, abre latido.ch y toca el icono de cámara junto a la dirección para cambiar el permiso del sitio. En Brave, revisa los permisos del sitio si tu versión muestra esta opción.'
        : 'Vuelve a Firefox y abre de nuevo latido.ch. Si aparece la solicitud de cámara, pulsa Permitir.',
      'Recarga Latido y abre Scanner. Si el navegador sigue bloqueando la cámara y no ofrece ajustes del sitio, abre latido.ch en Safari y sigue la pestaña Safari.'
    ]
  } else if (android) {
    const browser = tabs[selected]
    steps = [
      `Abre Ajustes del móvil → Aplicaciones → ${browser} → Permisos → Cámara. Elige Permitir mientras se usa la aplicación.`,
      selected === 2
        ? 'En Firefox, abre latido.ch y toca el candado junto a la dirección. Si indica Cámara bloqueada, borra ese permiso para que vuelva a preguntar.'
        : `En ${browser}, abre el menú ⋮ → Configuración → Configuración de sitios → Cámara. Activa las solicitudes y permite latido.ch en la lista de sitios bloqueados.`,
      'Comprueba que el acceso general a Cámara esté activado en los ajustes rápidos del móvil. Vuelve a Latido, recarga y abre Scanner; pulsa Permitir si aparece la solicitud.'
    ]
  } else {
    steps = [
      'Abre los permisos de latido.ch desde el icono junto a la barra de direcciones del navegador.',
      'Permite Cámara para este sitio. Revisa también el permiso del navegador en los ajustes de privacidad del ordenador.',
      'Recarga la página y abre Scanner. Si el navegador pregunta, pulsa Permitir.'
    ]
  }
  return (
    <details className="lc-camera-help">
      <summary>Cómo activar los permisos de la cámara</summary>
      <p>{ios ? 'iPhone / iPad' : android ? 'Android' : 'Ordenador'} · ¿Cuál es tu navegador?</p>
      <div className="lc-camera-browser-options" role="group" aria-label="Elige tu navegador">
        {tabs.map((tab, index) => (
          <button
            key={tab}
            type="button"
            aria-pressed={selected === index}
            onClick={() => setSelected(index)}
          >
            {tab}
          </button>
        ))}
      </div>
      <ol>
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className="lc-muted">
        Los nombres de los ajustes pueden variar según la versión. Latido no puede cambiar estos
        permisos por ti.
      </p>
    </details>
  )
}
