import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { membershipMailUrl } from '../lib/latidoCardExperience'
import { trackCardEvent } from '../lib/analytics'
import './LatidoCardLanding.css'

export default function LatidoCardLanding() {
  const { user, displayName } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const businessView = ['#negocios', '#registro', '#ventajas-negocios'].includes(location.hash)
  const requestUrl = user
    ? membershipMailUrl({ user, name: displayName })
    : '/auth?mode=register&next=%2Fcard'
  const selectView = (business) => navigate({ hash: business ? '#negocios' : '#socios' })
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(location.hash.slice(1))
      const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth'
      if (target) target.scrollIntoView({ behavior })
      else window.scrollTo({ top: 0, behavior: 'instant' })
    })
    return () => cancelAnimationFrame(frame)
  }, [location.hash])
  return (
    <div className="lc-landing">
      {/* Iconos reutilizables */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <symbol id="lcl-i-check" viewBox="0 0 24 24">
          <path
            d="M5 12.5l4.5 4.5L19 7.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </symbol>
        <symbol id="lcl-i-ojo" viewBox="0 0 24 24">
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" />
          </g>
        </symbol>
        <symbol id="lcl-i-ajustes" viewBox="0 0 24 24">
          <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
          </g>
        </symbol>
        <symbol id="lcl-i-corazon" viewBox="0 0 24 24">
          <path
            d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </symbol>
        <symbol id="lcl-i-movil" viewBox="0 0 24 24">
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="7" y="2" width="10" height="20" rx="2" />
            <path d="M11 18h2" />
          </g>
        </symbol>
        <symbol id="lcl-i-tienda" viewBox="0 0 24 24">
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 10v10h16V10" />
            <path d="M2.5 10L4.5 4h15l2 6" />
            <path d="M2.5 10a2.4 2.4 0 0 0 4.8 0 2.4 2.4 0 0 0 4.7 0 2.4 2.4 0 0 0 4.7 0 2.4 2.4 0 0 0 4.8 0" />
            <path d="M10 20v-5h4v5" />
          </g>
        </symbol>
      </svg>

      <header className="cabecera">
        <div className="contenedor cabecera__fila">
          <a className="marca" href="/">
            <img src="/favicon.svg" alt="" width="32" height="32" />
            Latido
          </a>
          <nav className="vistas" aria-label="Información para">
            <button
              type="button"
              className="vistas__boton"
              data-ver="socios"
              aria-pressed={!businessView}
              onClick={() => selectView(false)}
            >
              Socios
            </button>
            <button
              type="button"
              className="vistas__boton"
              data-ver="negocios"
              aria-pressed={businessView}
              onClick={() => selectView(true)}
            >
              Negocios
            </button>
          </nav>
          <a className="lcl-open-app" href="/card">
            Ver descuentos
          </a>
        </div>
      </header>

      <div className="lc-landing-content">
        {/* ===================== SOCIOS ===================== */}
        <div data-vista="socios" hidden={businessView}>
          <section className="portada" aria-labelledby="titulo-socios">
            <div className="contenedor portada__fila">
              <div className="portada__texto">
                <p className="portada__etiqueta">
                  <img src="/favicon.svg" alt="" width="20" height="20" />
                  Tarjeta Latido · El club de la comunidad
                </p>
                <h1 className="portada__titulo" id="titulo-socios">
                  Apoya los negocios de tu comunidad y obtén descuentos
                </h1>
                <p className="portada__texto-largo">
                  Con la Tarjeta Latido tienes descuentos, 2x1 y regalos en negocios
                  hispanohablantes de Suiza. Tú ahorras y ellos crecen.
                </p>
                <div className="botones">
                  <a className="boton boton--principal" href="#precio">
                    Hazte socio
                  </a>
                  <a className="boton boton--secundario" href="#ventajas-socios">
                    Ver ventajas
                  </a>
                </div>
                <ul className="checks">
                  <li>
                    <svg width="16" height="16">
                      <use href="#lcl-i-check" />
                    </svg>
                    CHF 6,90 al mes
                  </li>
                  <li>
                    <svg width="16" height="16">
                      <use href="#lcl-i-check" />
                    </svg>
                    Úsala desde el móvil
                  </li>
                </ul>
              </div>

              <div className="portada__visual" aria-hidden="true">
                <div className="tarjeta-socio">
                  <img className="tarjeta-socio__marca-agua" src="/favicon.svg" alt="" />
                  <div className="tarjeta-socio__fila">
                    <div className="tarjeta-socio__marca">
                      <span className="tarjeta-socio__logo">
                        <img src="/favicon.svg" alt="" />
                      </span>
                      <span>
                        <span className="tarjeta-socio__nombre">Latido</span>
                        <span className="tarjeta-socio__etiqueta">TARJETA DE SOCIO</span>
                      </span>
                    </div>
                    <span className="estado-activa">Activa</span>
                  </div>
                  <div>
                    <span className="tarjeta-socio__etiqueta">Nº DE SOCIO</span>
                    <span className="tarjeta-socio__numero">0001</span>
                  </div>
                  <div className="tarjeta-socio__fila tarjeta-socio__fila--abajo">
                    <span>
                      <span className="tarjeta-socio__etiqueta">TITULAR</span>
                      <span className="tarjeta-socio__dato">Tu nombre</span>
                    </span>
                    <span className="tarjeta-socio__derecha">
                      <span className="tarjeta-socio__etiqueta">VÁLIDA HASTA</span>
                      <span className="tarjeta-socio__dato">DD/MM/AAAA</span>
                    </span>
                  </div>
                  <span className="franja">
                    <span></span>
                    <span></span>
                    <span></span>
                    <span></span>
                    <span></span>
                    <span></span>
                  </span>
                </div>
                <div className="mini-oferta">
                  <div className="mini-oferta__cabeza">
                    <span className="mini-oferta__valor">
                      10 %<small>dto.</small>
                    </span>
                    <span>
                      <span className="mini-oferta__titulo">10 % en tu corte</span>
                      <span className="mini-oferta__lugar">Peluquería en Luzern</span>
                    </span>
                  </div>
                  <div className="mini-oferta__pie">
                    <span className="mini-oferta__uso">Sin límite de usos</span>
                    <span className="mini-oferta__boton">Usar ahora</span>
                  </div>
                  <span className="franja">
                    <span></span>
                    <span></span>
                    <span></span>
                    <span></span>
                    <span></span>
                    <span></span>
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section
            className="seccion"
            id="ventajas-socios"
            aria-labelledby="titulo-ventajas-socios"
          >
            <div className="contenedor">
              <p className="antetitulo">Para socios</p>
              <h2 className="titulo-seccion" id="titulo-ventajas-socios">
                Ahorra mientras apoyas lo nuestro
              </h2>
              <p className="entradilla">
                Tu tarjeta te da ventajas en los negocios de la comunidad hispanohablante. Cada vez
                que la usas, ayudas a que sigan creciendo.
              </p>
              <div className="ventajas">
                <article className="ventaja">
                  <span className="ventaja__icono tono-azul" aria-hidden="true">
                    %
                  </span>
                  <h3 className="ventaja__titulo">Descuentos exclusivos</h3>
                  <p className="ventaja__texto">
                    Descuentos, 2x1 y regalos que solo tienen los socios de la tarjeta.
                  </p>
                </article>
                <article className="ventaja">
                  <span className="ventaja__icono tono-verde" aria-hidden="true">
                    <svg width="24" height="24">
                      <use href="#lcl-i-movil" />
                    </svg>
                  </span>
                  <h3 className="ventaja__titulo">Todo desde tu móvil</h3>
                  <p className="ventaja__texto">
                    Elige la oferta en la app y enséñala al pagar. Sin cupones ni papeles.
                  </p>
                </article>
                <article className="ventaja">
                  <span className="ventaja__icono tono-rosa" aria-hidden="true">
                    <svg width="24" height="24">
                      <use href="#lcl-i-corazon" />
                    </svg>
                  </span>
                  <h3 className="ventaja__titulo">Apoyas a tu gente</h3>
                  <p className="ventaja__texto">
                    Cada compra ayuda a un negocio hispanohablante de Suiza.
                  </p>
                </article>
              </div>
            </div>
          </section>

          <section
            className="seccion seccion--gris"
            id="precio"
            aria-labelledby="titulo-como-socios"
          >
            <div className="contenedor como">
              <div className="como__pasos">
                <p className="antetitulo">Cómo funciona</p>
                <h2 className="titulo-seccion" id="titulo-como-socios">
                  Así de fácil
                </h2>
                <ol className="pasos">
                  <li className="paso">
                    <span className="paso__numero" aria-hidden="true">
                      1
                    </span>
                    <div>
                      <h3 className="paso__titulo">Hazte socio</h3>
                      <p className="paso__texto">Solicita tu Tarjeta Latido por CHF 6,90 al mes.</p>
                    </div>
                  </li>
                  <li className="paso">
                    <span className="paso__numero" aria-hidden="true">
                      2
                    </span>
                    <div>
                      <h3 className="paso__titulo">Elige una oferta</h3>
                      <p className="paso__texto">
                        Busca en la app por ciudad o por tipo de oferta.
                      </p>
                    </div>
                  </li>
                  <li className="paso">
                    <span className="paso__numero" aria-hidden="true">
                      3
                    </span>
                    <div>
                      <h3 className="paso__titulo">Úsala al pagar</h3>
                      <p className="paso__texto">
                        Activa la oferta al pagar y enseña la pantalla al personal.
                      </p>
                    </div>
                  </li>
                </ol>
              </div>
              <div className="precio">
                <p className="precio__nombre">
                  <img src="/favicon.svg" alt="" width="22" height="22" />
                  Tarjeta Latido
                </p>
                <p className="precio__cifra">
                  CHF 6,90 <small>/ mes</small>
                </p>
                <ul className="lista-check">
                  <li>
                    <svg width="20" height="20">
                      <use href="#lcl-i-check" />
                    </svg>
                    Todas las ofertas para socios
                  </li>
                  <li>
                    <svg width="20" height="20">
                      <use href="#lcl-i-check" />
                    </svg>
                    Tu tarjeta digital en el móvil
                  </li>
                  <li>
                    <svg width="20" height="20">
                      <use href="#lcl-i-check" />
                    </svg>
                    Apoyas a los negocios de la comunidad
                  </li>
                </ul>
                {/* Enlace o acción para solicitar la tarjeta */}
                <a
                  className="boton boton--principal boton--ancho"
                  href={requestUrl}
                  onClick={() => trackCardEvent('request')}
                >
                  Solicitar mi tarjeta
                </a>
                <p className="precio__nota">Solicita la activación por email a Latido.</p>
              </div>
            </div>
          </section>

          <section className="seccion" aria-labelledby="titulo-preguntas-socios">
            <div className="preguntas">
              <h2 className="titulo-seccion" id="titulo-preguntas-socios">
                Preguntas frecuentes
              </h2>
              <div className="preguntas__lista">
                <details className="pregunta">
                  <summary>¿Cuánto cuesta la Tarjeta Latido?</summary>
                  <p>CHF 6,90 al mes. Solicitas la activación por email a Latido.</p>
                </details>
                <details className="pregunta">
                  <summary>¿Dónde puedo usarla?</summary>
                  <p>
                    En los negocios participantes. Los encuentras en la app, por ciudad o por tipo
                    de oferta.
                  </p>
                </details>
                <details className="pregunta">
                  <summary>¿Cómo uso una oferta?</summary>
                  <p>
                    Elige la oferta, pulsa «Usar ahora» y enseña la pantalla al pagar en el negocio.
                  </p>
                </details>
              </div>
            </div>
          </section>

          <section className="seccion--cierre" aria-labelledby="titulo-cierre-socios">
            <div className="contenedor">
              <div className="cierre">
                <h2 id="titulo-cierre-socios">Únete a la comunidad que se apoya</h2>
                <p>Hazte socio y ahorra en los negocios hispanohablantes de tu comunidad.</p>
                <a className="boton boton--blanco" href="#precio">
                  Hazte socio
                </a>
              </div>
            </div>
          </section>
        </div>

        {/* ===================== NEGOCIOS ===================== */}
        <div data-vista="negocios" hidden={!businessView}>
          <section className="portada" aria-labelledby="titulo-negocios">
            <div className="contenedor portada__fila">
              <div className="portada__texto">
                <p className="portada__etiqueta">
                  <img src="/favicon.svg" alt="" width="20" height="20" />
                  Tarjeta Latido · Para negocios
                </p>
                <h1 className="portada__titulo" id="titulo-negocios">
                  Haz que más personas descubran tu negocio
                </h1>
                <p className="portada__texto-largo">
                  Ofrece beneficios a la comunidad hispanohablante y consigue que más personas
                  descubran tu negocio gracias a Latido.
                </p>
                <div className="botones">
                  <a className="boton boton--principal" href="#registro">
                    Registrar mi negocio
                  </a>
                  <a className="boton boton--secundario" href="#ventajas-negocios">
                    Ver ventajas
                  </a>
                </div>
                <ul className="checks">
                  <li>
                    <svg width="16" height="16">
                      <use href="#lcl-i-check" />
                    </svg>
                    Participar es gratis
                  </li>
                  <li>
                    <svg width="16" height="16">
                      <use href="#lcl-i-check" />
                    </svg>
                    Tú pones las condiciones
                  </li>
                </ul>
              </div>

              <div className="portada__visual" aria-hidden="true">
                <span className="portada__aviso">
                  <svg width="14" height="14">
                    <use href="#lcl-i-ojo" />
                  </svg>
                  Así te verán los socios
                </span>
                <div className="mini-negocio">
                  <span className="mini-negocio__icono">
                    <svg width="24" height="24">
                      <use href="#lcl-i-tienda" />
                    </svg>
                  </span>
                  <span>
                    <span className="mini-negocio__nombre">Tu negocio</span>
                    <span className="mini-negocio__lugar">Tu ciudad</span>
                    <span className="mini-negocio__resumen">
                      <b>2x1</b>1 oferta
                    </span>
                  </span>
                </div>
                <div className="mini-oferta">
                  <div className="mini-oferta__cabeza">
                    <span className="mini-oferta__valor mini-oferta__valor--rosa">
                      2x1<small>oferta</small>
                    </span>
                    <span>
                      <span className="mini-oferta__titulo">2x1 en tu servicio</span>
                      <span className="mini-oferta__lugar">Tu negocio · Tu ciudad</span>
                    </span>
                  </div>
                  <div className="mini-oferta__pie">
                    <span className="mini-oferta__uso">1 uso al mes</span>
                    <span className="mini-oferta__boton">Usar ahora</span>
                  </div>
                  <span className="franja">
                    <span></span>
                    <span></span>
                    <span></span>
                    <span></span>
                    <span></span>
                    <span></span>
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section
            className="seccion"
            id="ventajas-negocios"
            aria-labelledby="titulo-ventajas-negocios"
          >
            <div className="contenedor">
              <p className="antetitulo">Para negocios</p>
              <h2 className="titulo-seccion" id="titulo-ventajas-negocios">
                Más visibilidad y apoyo en la comunidad
              </h2>
              <p className="entradilla">
                Ofrece ventajas a los miembros de tu comunidad y consigue más visibilidad y apoyo
                dentro de la comunidad hispanohablante en Suiza.
              </p>
              <div className="ventajas">
                <article className="ventaja">
                  <span className="ventaja__icono tono-azul" aria-hidden="true">
                    <svg width="24" height="24">
                      <use href="#lcl-i-ojo" />
                    </svg>
                  </span>
                  <h3 className="ventaja__titulo">Más visibilidad</h3>
                  <p className="ventaja__texto">
                    Tu negocio aparece ante los socios de la comunidad hispanohablante.
                  </p>
                </article>
                <article className="ventaja">
                  <span className="ventaja__icono tono-ambar" aria-hidden="true">
                    <svg width="24" height="24">
                      <use href="#lcl-i-ajustes" />
                    </svg>
                  </span>
                  <h3 className="ventaja__titulo">Tú pones las reglas</h3>
                  <p className="ventaja__texto">
                    Descuento, 2x1 o regalo, y cuántas veces se puede usar.
                  </p>
                </article>
                <article className="ventaja">
                  <span className="ventaja__icono tono-rosa" aria-hidden="true">
                    <svg width="24" height="24">
                      <use href="#lcl-i-corazon" />
                    </svg>
                  </span>
                  <h3 className="ventaja__titulo">Apoyo de la comunidad</h3>
                  <p className="ventaja__texto">
                    Los socios eligen negocios hispanohablantes como el tuyo.
                  </p>
                </article>
                <article className="ventaja">
                  <span className="ventaja__icono tono-verde" aria-hidden="true">
                    <svg width="24" height="24">
                      <use href="#lcl-i-movil" />
                    </svg>
                  </span>
                  <h3 className="ventaja__titulo">Fácil de gestionar</h3>
                  <p className="ventaja__texto">Crea y cambia tus ofertas desde la app.</p>
                </article>
              </div>
            </div>
          </section>

          <section
            className="seccion seccion--gris"
            id="registro"
            aria-labelledby="titulo-como-negocios"
          >
            <div className="contenedor como">
              <div className="como__pasos">
                <p className="antetitulo">Cómo funciona</p>
                <h2 className="titulo-seccion" id="titulo-como-negocios">
                  Así de fácil
                </h2>
                <ol className="pasos">
                  <li className="paso">
                    <span className="paso__numero" aria-hidden="true">
                      1
                    </span>
                    <div>
                      <h3 className="paso__titulo">Registra tu negocio</h3>
                      <p className="paso__texto">Crea la ficha de tu negocio en Latido.</p>
                    </div>
                  </li>
                  <li className="paso">
                    <span className="paso__numero" aria-hidden="true">
                      2
                    </span>
                    <div>
                      <h3 className="paso__titulo">Crea tu oferta</h3>
                      <p className="paso__texto">
                        Un descuento, un 2x1 o un regalo, en 4 pasos desde la app.
                      </p>
                    </div>
                  </li>
                  <li className="paso">
                    <span className="paso__numero" aria-hidden="true">
                      3
                    </span>
                    <div>
                      <h3 className="paso__titulo">Recibe a los socios</h3>
                      <p className="paso__texto">
                        Comprueba su pantalla y aplica la oferta en tu caja.
                      </p>
                    </div>
                  </li>
                </ol>
              </div>
              <div className="precio">
                <p className="precio__nombre">
                  <img src="/favicon.svg" alt="" width="22" height="22" />
                  Tarjeta Latido para negocios
                </p>
                <p className="precio__cifra">Gratis</p>
                <ul className="lista-check">
                  <li>
                    <svg width="20" height="20">
                      <use href="#lcl-i-check" />
                    </svg>
                    Ficha de tu negocio en Latido
                  </li>
                  <li>
                    <svg width="20" height="20">
                      <use href="#lcl-i-check" />
                    </svg>
                    Tus ofertas para los socios
                  </li>
                  <li>
                    <svg width="20" height="20">
                      <use href="#lcl-i-check" />
                    </svg>
                    Más visibilidad en la comunidad
                  </li>
                </ul>
                {/* Enlace o acción para registrar el negocio */}
                <a
                  className="boton boton--principal boton--ancho"
                  href="/registrar-negocio?origen=tarjeta"
                >
                  Registrar mi negocio
                </a>
              </div>
            </div>
          </section>

          <section className="seccion" aria-labelledby="titulo-preguntas-negocios">
            <div className="preguntas">
              <h2 className="titulo-seccion" id="titulo-preguntas-negocios">
                Preguntas frecuentes
              </h2>
              <div className="preguntas__lista">
                <details className="pregunta">
                  <summary>¿Cuánto cuesta participar?</summary>
                  <p>Participar es gratis para tu negocio.</p>
                </details>
                <details className="pregunta">
                  <summary>¿Qué ofertas puedo crear?</summary>
                  <p>
                    Descuentos en porcentaje o en CHF, 2x1, regalos u otros beneficios. Tú decides
                    las condiciones.
                  </p>
                </details>
                <details className="pregunta">
                  <summary>¿Cómo usan los socios mi oferta?</summary>
                  <p>
                    El socio la activa en Latido y te la enseña al pagar. Compruebas su pantalla y
                    aplicas la oferta en tu caja.
                  </p>
                </details>
              </div>
            </div>
          </section>

          <section className="seccion--cierre" aria-labelledby="titulo-cierre-negocios">
            <div className="contenedor">
              <div className="cierre">
                <h2 id="titulo-cierre-negocios">Suma tu negocio a la comunidad</h2>
                <p>
                  Ofrece ventajas a los socios y gana visibilidad entre los hispanohablantes de
                  Suiza.
                </p>
                <a className="boton boton--blanco" href="#registro">
                  Registrar mi negocio
                </a>
              </div>
            </div>
          </section>
        </div>
      </div>

      <footer className="pie">
        <div className="contenedor pie__fila">
          <a className="marca" href="/">
            <img src="/favicon.svg" alt="" width="28" height="28" />
            Latido
          </a>
          <nav aria-label="Pie de página">
            <a href="mailto:info@latido.ch">Contacto</a> <a href="/card">Ver descuentos</a>
          </nav>
          <p className="pie__copy">© 2026 Latido</p>
        </div>
        <span className="franja" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
        </span>
      </footer>
    </div>
  )
}
