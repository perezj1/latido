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
      'Abre Ajustes en tu iPhone.',
      'Busca Safari → Cámara y marca Preguntar.',
      'Vuelve a Latido. Recarga, abre Scanner y pulsa Permitir.'
    ]
  } else if (ios) {
    const browser = selected === 2 ? 'Firefox' : 'Chrome o Brave'
    steps = [
      'Abre Ajustes → Privacidad y seguridad → Cámara.',
      `Activa la cámara para ${browser}.`,
      'Vuelve a Latido. Recarga, abre Scanner y pulsa Permitir.'
    ]
  } else if (android) {
    const browser = tabs[selected]
    steps = [
      `Abre Ajustes → Aplicaciones → ${browser}.`,
      'En Permisos → Cámara, elige Permitir al usar la aplicación.',
      'Vuelve a Latido. Recarga, abre Scanner y pulsa Permitir.'
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
        ¿Sigue bloqueada? Puedes introducir el código del cliente sin usar la cámara.
      </p>
      <details>
        <summary>Si ya lo permití y sigue sin funcionar</summary>
        <p>
          {ios && selected === 0
            ? 'En Safari, abre latido.ch. Toca el menú junto a la dirección → Más (…) → Ajustes del sitio web → Cámara → Permitir.'
            : android && selected !== 2
              ? `En ${tabs[selected]}, abre ⋮ → Configuración → Configuración de sitios → Cámara. Busca latido.ch y permite su cámara.`
              : 'Abre latido.ch y revisa el permiso de cámara junto a la dirección del sitio. Si no aparece, prueba Safari en iPhone o Chrome en Android.'}
        </p>
      </details>
    </details>
  )
}
