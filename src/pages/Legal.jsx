import { useEffect } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { C, PP } from '../lib/theme'

const DOCS = [
  { id:'impressum',  path:'/impressum',  label:'Impressum' },
  { id:'privacidad', path:'/privacidad', label:'Privacidad' },
  { id:'terminos',   path:'/terminos',   label:'Términos de uso' },
  { id:'descargo',   path:'/descargo',   label:'Descargo de responsabilidad' },
]

function Section({ title, children }) {
  return (
    <div style={{ marginBottom:28 }}>
      <h2 style={{ fontFamily:PP, fontWeight:700, fontSize:16, color:C.text, marginBottom:10, paddingBottom:8, borderBottom:`1px solid ${C.border}` }}>
        {title}
      </h2>
      <div style={{ fontFamily:PP, fontSize:13, color:C.mid, lineHeight:1.85 }}>
        {children}
      </div>
    </div>
  )
}

function P({ children }) {
  return <p style={{ margin:'0 0 10px' }}>{children}</p>
}

function Ul({ items }) {
  return (
    <ul style={{ margin:'0 0 10px', paddingLeft:20 }}>
      {items.map((item, i) => <li key={i} style={{ marginBottom:5 }}>{item}</li>)}
    </ul>
  )
}

// ── CONTENIDOS ─────────────────────────────────────────────────

function Impressum() {
  return (
    <>
      <Section title="1. Responsable del sitio web">
        <P><strong>Denominación:</strong> Latido.ch</P>
        <P><strong>Domicilio:</strong> Zürich, Suiza</P>
        <P><strong>Email:</strong> hola@latido.ch</P>
        <P><strong>Web:</strong> https://latido.ch</P>
      </Section>

      <Section title="2. Naturaleza de la plataforma">
        <P>
          Latido.ch es una plataforma digital de contacto y comunidad para hispanohablantes
          residentes en Suiza. No tiene personalidad jurídica propia como sociedad mercantil registrada.
          El operador actúa como persona física responsable del contenido en el sentido del
          art. 322 del Código Penal suizo (CP) y del art. 3 de la Ley federal contra la competencia
          desleal (LCD/UWG).
        </P>
      </Section>

      <Section title="3. Contenidos y derechos de autor">
        <P>
          El diseño, textos e imágenes propias de Latido.ch están protegidos por la Ley federal
          de derecho de autor (LDA/URG). Queda prohibida su reproducción o uso sin autorización
          escrita del operador.
        </P>
        <P>
          Los contenidos publicados por usuarios (anuncios, mensajes, reseñas) son responsabilidad
          exclusiva de quien los publica. Latido.ch actúa únicamente como intermediario técnico
          en el sentido del art. 12 de la Ley federal de servicios de comunicación electrónica.
        </P>
      </Section>

      <Section title="4. Infraestructura técnica">
        <P>
          El servicio de autenticación y base de datos es proporcionado por <strong>Supabase Inc.</strong>
          (San Francisco, EE. UU.), con servidores en la Unión Europea.
          El alojamiento y entrega de la aplicación corre a cargo de <strong>Vercel Inc.</strong>
          (San Francisco, EE. UU.), con servidores en Europa.
          Ambos proveedores ofrecen garantías de nivel adecuado de protección de datos conforme a la
          nDSG y al RGPD.
        </P>
      </Section>

      <Section title="5. Legislación aplicable">
        <P>
          Este sitio web y sus actividades están sujetos al derecho suizo, en particular a la
          nueva Ley federal de protección de datos (nDSG, en vigor desde el 1 de septiembre de 2023),
          la LCD/UWG, el CO (Código de Obligaciones) y el CP.
        </P>
      </Section>

      <Section title="6. Contacto para avisos legales">
        <P>
          Para cualquier aviso legal, reclamación sobre contenidos o ejercicio de derechos,
          escriba a: <strong>hola@latido.ch</strong>
        </P>
      </Section>
    </>
  )
}

function Privacidad() {
  return (
    <>
      <P style={{ fontStyle:'italic', fontSize:12, color:C.light }}>
        Última actualización: enero de 2025 · Conforme a la nDSG (nueva Ley federal suiza de
        protección de datos, en vigor desde el 1 de septiembre de 2023).
      </P>

      <Section title="1. Responsable del tratamiento">
        <P>
          El responsable del tratamiento de sus datos personales es el operador de Latido.ch,
          con domicilio en Zürich, Suiza. Contacto: hola@latido.ch
        </P>
      </Section>

      <Section title="2. Datos que recopilamos">
        <P><strong>Al crear una cuenta:</strong></P>
        <Ul items={[
          'Nombre o apodo, dirección de email y contraseña (almacenada cifrada).',
          'Cantón de residencia e idiomas (opcionales, para personalizar la experiencia).',
        ]} />
        <P><strong>Al usar la plataforma:</strong></P>
        <Ul items={[
          'Contenidos que publicas (anuncios, reseñas, datos de contacto que decides incluir).',
          'Datos de uso: páginas visitadas, interacciones con la app (almacenados de forma anonimizada).',
          'Dirección IP y agente de usuario (browser), retenidos brevemente por razones de seguridad.',
        ]} />
        <P><strong>No recopilamos:</strong> datos de pago, documentos de identidad ni datos sensibles
        en el sentido del art. 5 lit. c nDSG salvo los que el propio usuario decida publicar.</P>
      </Section>

      <Section title="3. Finalidad y base jurídica del tratamiento">
        <Ul items={[
          'Prestación del servicio y gestión de tu cuenta (art. 31 nDSG — ejecución de un contrato).',
          'Seguridad de la plataforma y prevención de abusos (interés legítimo del operador).',
          'Comunicaciones de servicio por email (interés legítimo / consentimiento).',
          'Mejora de la experiencia de usuario mediante datos anonimizados de uso (interés legítimo).',
        ]} />
        <P>No realizamos tratamientos automatizados con efectos jurídicos sobre las personas ni
        elaboración de perfiles en el sentido del art. 5 lit. f nDSG.</P>
      </Section>

      <Section title="4. Plazo de conservación">
        <Ul items={[
          'Datos de cuenta: mientras la cuenta esté activa. Tras la eliminación de la cuenta, 30 días de retención por seguridad y luego eliminación definitiva.',
          'Anuncios y publicaciones: se eliminan cuando el usuario los borra o cuando se elimina la cuenta.',
          'Datos de acceso (logs IP): máximo 30 días.',
        ]} />
      </Section>

      <Section title="5. Transferencia de datos a terceros">
        <P>No vendemos ni cedemos datos personales a terceros con fines comerciales. Los datos
        son accesibles únicamente a:</P>
        <Ul items={[
          'Supabase Inc. — proveedor de base de datos y autenticación (servidores UE, con garantías adecuadas conforme a la nDSG).',
          'Vercel Inc. — proveedor de alojamiento de la aplicación (servidores UE).',
          'Autoridades suizas, cuando exista obligación legal.',
        ]} />
      </Section>

      <Section title="6. Transferencias internacionales">
        <P>
          Supabase y Vercel son empresas estadounidenses con servidores en Europa. Ambas se
          encuentran en el ámbito de garantías adecuadas reconocidas por la Comisión federal de
          protección de datos e información (PFPDT/EDÖB). El nivel de protección es equivalente
          al exigido por la nDSG.
        </P>
      </Section>

      <Section title="7. Cookies y almacenamiento local">
        <P>
          Latido.ch utiliza únicamente cookies técnicas esenciales (sesión de usuario) y
          almacenamiento local del navegador (localStorage) para mantener la sesión iniciada.
          No utilizamos cookies de seguimiento, publicidad ni análisis de terceros.
        </P>
      </Section>

      <Section title="8. Tus derechos (art. 25–27 nDSG)">
        <P>Como usuario tienes derecho a:</P>
        <Ul items={[
          'Acceso: saber qué datos tuyos tratamos.',
          'Rectificación: corregir datos inexactos.',
          'Supresión: eliminar tus datos ("derecho al olvido").',
          'Portabilidad: recibir tus datos en formato estructurado.',
          'Oposición: oponerte a determinados tratamientos.',
          'Revocación del consentimiento: sin efecto retroactivo.',
        ]} />
        <P>
          Para ejercer cualquier derecho escribe a <strong>hola@latido.ch</strong>. Responderemos
          en un plazo máximo de 30 días. Si consideras que tratamos tus datos de forma incorrecta,
          puedes reclamar ante el <strong>Comisionado Federal de Protección de Datos e Información
          (PFPDT / EDÖB)</strong>: edoeb.admin.ch
        </P>
      </Section>

      <Section title="9. Seguridad">
        <P>
          Aplicamos medidas técnicas y organizativas adecuadas: cifrado en tránsito (HTTPS/TLS),
          contraseñas almacenadas con hash seguro (bcrypt vía Supabase Auth), acceso restringido
          a la base de datos y revisión periódica de permisos.
        </P>
      </Section>

      <Section title="10. Menores de edad">
        <P>
          Latido.ch no está dirigido a menores de 16 años. Si tienes conocimiento de que un menor
          ha proporcionado datos personales, contacta con nosotros para su eliminación inmediata.
        </P>
      </Section>

      <Section title="11. Cambios en esta política">
        <P>
          Notificaremos cualquier cambio relevante por email o mediante aviso en la plataforma.
          El uso continuado de Latido.ch tras la notificación implica la aceptación de la nueva versión.
        </P>
      </Section>
    </>
  )
}

function Terminos() {
  return (
    <>
      <P style={{ fontStyle:'italic' }}>
        Última actualización: enero de 2025 · Legislación aplicable: derecho suizo.
      </P>

      <Section title="1. Aceptación de los términos">
        <P>
          Al acceder a Latido.ch o crear una cuenta, aceptas plenamente estos Términos de Uso y
          Condiciones ("Términos"). Si no estás de acuerdo, no utilices la plataforma.
          Los presentes Términos constituyen un contrato vinculante entre tú y el operador de
          Latido.ch, sujeto al Código de Obligaciones suizo (CO/OR).
        </P>
      </Section>

      <Section title="2. Descripción del servicio">
        <P>
          Latido.ch es una <strong>plataforma de intermediación y contacto</strong> para
          hispanohablantes residentes en Suiza. Facilita la publicación y consulta de anuncios,
          la conexión con comunidades, la búsqueda de empleo y el acceso a guías de trámites.
        </P>
        <P>
          <strong>Latido.ch actúa exclusivamente como intermediario técnico.</strong> No es parte
          en ninguna transacción, acuerdo o comunicación entre usuarios. No verifica la veracidad
          de los contenidos publicados salvo las verificaciones expresamente indicadas.
        </P>
      </Section>

      <Section title="3. Registro y cuenta de usuario">
        <Ul items={[
          'Debes tener al menos 18 años para crear una cuenta.',
          'La información que proporcionas debe ser veraz, completa y actualizada.',
          'Eres responsable de la confidencialidad de tu contraseña y de toda actividad realizada desde tu cuenta.',
          'Está prohibido crear cuentas falsas, suplantar identidades o crear múltiples cuentas.',
          'Notifica inmediatamente a hola@latido.ch si detectas un uso no autorizado de tu cuenta.',
        ]} />
      </Section>

      <Section title="4. Responsabilidad sobre los contenidos publicados">
        <P>
          <strong>Cada usuario es el único y exclusivo responsable de los contenidos que publica</strong>
          en Latido.ch (anuncios, mensajes, reseñas, datos de contacto, imágenes, etc.).
        </P>
        <P>
          Al publicar un contenido, el usuario declara y garantiza que:
        </P>
        <Ul items={[
          'Tiene derecho a publicarlo (es el autor o tiene los permisos necesarios).',
          'No infringe derechos de terceros (propiedad intelectual, privacidad, honor).',
          'Su contenido es veraz, no es engañoso ni fraudulento.',
          'No viola ninguna ley suiza ni internacional aplicable.',
        ]} />
        <P>
          Latido.ch se reserva el derecho de eliminar sin previo aviso cualquier contenido que
          infrinja estos Términos o la legislación vigente.
        </P>
      </Section>

      <Section title="5. Contenidos prohibidos">
        <P>Está estrictamente prohibido publicar contenidos que:</P>
        <Ul items={[
          'Sean ilegales según el derecho suizo (CP, LCD, CO y demás legislación aplicable).',
          'Contengan información falsa, engañosa o fraudulenta (art. 146 CP — estafa).',
          'Inciten al odio, discriminación o violencia por razón de origen, religión, sexo u otra característica (art. 261bis CP).',
          'Constituyan acoso, amenazas o intimidación a otros usuarios.',
          'Vulneren derechos de propiedad intelectual o industrial de terceros.',
          'Promuevan actividades ilegales, incluida la venta de sustancias prohibidas.',
          'Contengan spam, publicidad no solicitada o contenido con fines puramente comerciales no autorizados.',
          'Expongan datos personales de terceros sin su consentimiento (art. 179 CP).',
          'Sean de naturaleza sexual explícita o pornográfica.',
        ]} />
      </Section>

      <Section title="6. Conducta en la plataforma">
        <Ul items={[
          'Trata a los demás usuarios con respeto y buena fe.',
          'No utilices la plataforma para actividades comerciales masivas o scraping de datos.',
          'No intentes vulnerar la seguridad, integridad o disponibilidad del servicio.',
          'Usa los datos de contacto de otros usuarios únicamente para el fin legítimo por el que fueron publicados.',
        ]} />
      </Section>

      <Section title="7. Propiedad intelectual">
        <P>
          El diseño, marca, código fuente y contenidos originales de Latido.ch son propiedad del
          operador y están protegidos por la Ley federal de derecho de autor (LDA/URG).
          Al publicar contenido en la plataforma, concedes a Latido.ch una licencia no exclusiva,
          gratuita y revocable para mostrarlo y distribuirlo dentro del servicio.
        </P>
      </Section>

      <Section title="8. Modificación y suspensión del servicio">
        <P>
          El operador puede modificar, suspender o interrumpir el servicio en cualquier momento
          sin previo aviso. También puede suspender o eliminar cuentas de usuario que infrinjan
          estos Términos, sin obligación de indemnización.
        </P>
      </Section>

      <Section title="9. Limitación de responsabilidad">
        <P>
          En la máxima medida permitida por el derecho suizo, Latido.ch no asume responsabilidad
          por daños directos, indirectos, incidentales o consecuentes derivados del uso o la
          imposibilidad de uso de la plataforma, incluyendo los daños derivados de contenidos
          publicados por terceros.
        </P>
        <P>
          Latido.ch no garantiza la exactitud, integridad o actualidad de los contenidos
          publicados por los usuarios.
        </P>
      </Section>

      <Section title="10. Derecho aplicable y jurisdicción">
        <P>
          Estos Términos se rigen exclusivamente por el <strong>derecho suizo</strong>, con
          exclusión de las normas de conflicto de leyes. Para cualquier litigio derivado del uso
          de Latido.ch, las partes se someten a la <strong>jurisdicción exclusiva de los
          tribunales ordinarios de Zürich, Suiza</strong>.
        </P>
        <P>
          Si eres consumidor con domicilio en Suiza, te beneficias de la protección irrenunciable
          que ofrece la legislación suiza de protección al consumidor.
        </P>
      </Section>

      <Section title="11. Modificación de los Términos">
        <P>
          El operador puede actualizar estos Términos en cualquier momento. Los cambios se
          notificarán por email o mediante aviso en la plataforma con al menos 14 días de
          antelación. El uso continuado del servicio tras ese plazo implica la aceptación
          de los nuevos Términos.
        </P>
      </Section>

      <Section title="12. Nulidad parcial">
        <P>
          Si alguna cláusula de estos Términos fuera declarada nula o inaplicable por un tribunal
          competente, las demás cláusulas seguirán siendo plenamente válidas y eficaces.
        </P>
      </Section>
    </>
  )
}

function Descargo() {
  return (
    <>
      <Section title="1. Naturaleza de la plataforma">
        <P>
          Latido.ch es una <strong>plataforma de intermediación</strong>: proporciona la
          infraestructura tecnológica para que los usuarios publiquen y consulten contenidos,
          pero no genera ni verifica dichos contenidos. Actúa como proveedor de servicios de
          alojamiento de información en el sentido del art. 12 ss. de la legislación suiza
          aplicable a los servicios de comunicación electrónica.
        </P>
      </Section>

      <Section title="2. Contenidos generados por usuarios">
        <P>
          <strong>Latido.ch no es responsable de los contenidos publicados por los usuarios</strong>
          (anuncios, ofertas de empleo, reseñas, datos de contacto, imágenes u otra información).
          Cada usuario publica bajo su exclusiva responsabilidad.
        </P>
        <P>
          Latido.ch eliminará los contenidos manifiestamente ilegales cuando tenga conocimiento
          efectivo de los mismos, conforme al principio de "notice and takedown". Para notificar
          un contenido ilícito: hola@latido.ch
        </P>
      </Section>

      <Section title="3. Ausencia de garantías">
        <P>El servicio se presta "tal cual" ("as is"). Latido.ch no garantiza:</P>
        <Ul items={[
          'La veracidad, exactitud o actualidad de los anuncios y publicaciones de usuarios.',
          'La disponibilidad ininterrumpida de la plataforma.',
          'Que los contactos establecidos a través de la plataforma deriven en transacciones exitosas.',
          'La identidad real de los usuarios registrados.',
          'La solvencia, fiabilidad o cualificación de los usuarios que ofrecen servicios.',
        ]} />
      </Section>

      <Section title="4. Transacciones entre usuarios">
        <P>
          <strong>Cualquier acuerdo, transacción económica, intercambio de servicios o relación
          contractual que se origine a través de Latido.ch es responsabilidad exclusiva de las
          partes implicadas.</strong> Latido.ch no interviene, no media ni garantiza el cumplimiento
          de ningún acuerdo entre usuarios.
        </P>
        <P>
          Se recomienda a los usuarios actuar con la debida diligencia antes de realizar cualquier
          pago o entrega de bienes a través de contactos establecidos en la plataforma.
        </P>
      </Section>

      <Section title="5. Guías e información práctica">
        <P>
          Las guías sobre trámites, permisos, impuestos, seguros y otros procedimientos en Suiza
          publicadas en Latido.ch tienen carácter <strong>meramente orientativo</strong>.
          No constituyen asesoramiento legal, fiscal ni administrativo. La normativa suiza
          puede variar por cantón y con el tiempo.
        </P>
        <P>
          Para situaciones individuales, consulta siempre a un profesional cualificado
          (abogado, asesor fiscal, oficina de migración cantonal, etc.).
        </P>
      </Section>

      <Section title="6. Enlaces externos">
        <P>
          Latido.ch puede contener enlaces a sitios web de terceros. Dichos enlaces se proporcionan
          únicamente como recurso informativo. El operador no controla ni asume responsabilidad
          alguna por el contenido, la política de privacidad ni las prácticas de sitios externos.
        </P>
      </Section>

      <Section title="7. Limitación de responsabilidad">
        <P>
          En la medida máxima permitida por el derecho suizo (art. 100 CO), el operador de
          Latido.ch no será responsable de ningún daño directo, indirecto, incidental, especial
          ni consecuente que resulte del uso o la imposibilidad de uso de la plataforma o de
          los contenidos en ella publicados.
        </P>
        <P>
          Esta limitación no afecta a la responsabilidad por dolo o negligencia grave, ni a
          los derechos irrenunciables del consumidor conforme al derecho suizo.
        </P>
      </Section>

      <Section title="8. Notificación de contenidos ilegales">
        <P>
          Si encuentras en Latido.ch contenidos que consideres ilegales, fraudulentos o que
          vulneren derechos de terceros, notifícalo a <strong>hola@latido.ch</strong> indicando
          la URL del contenido y el motivo de la denuncia. El operador actuará con la mayor
          diligencia posible.
        </P>
      </Section>
    </>
  )
}

// ── COMPONENTE PRINCIPAL ────────────────────────────────────────

const DOC_MAP = {
  impressum:  { title:'Impressum',                      component: Impressum },
  privacidad: { title:'Política de Privacidad',         component: Privacidad },
  terminos:   { title:'Términos de Uso y Condiciones',  component: Terminos },
  descargo:   { title:'Descargo de Responsabilidad',    component: Descargo },
}

export default function Legal() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const docId = pathname.replace('/', '') // '/impressum' → 'impressum'
  const doc = DOC_MAP[docId] || DOC_MAP['impressum']
  const Content = doc.component

  useEffect(() => {
    if (!DOC_MAP[docId]) navigate('/impressum', { replace: true })
  }, [docId, navigate])

  return (
    <div style={{ maxWidth:780, margin:'0 auto', padding:'32px 24px 100px' }}>
      <Link to="/" style={{ fontFamily:PP, fontSize:12, color:C.primary, textDecoration:'none', display:'inline-flex', alignItems:'center', gap:4, marginBottom:20 }}>
        ← Volver
      </Link>

      {/* Tab nav */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:28 }}>
        {DOCS.map(d => (
          <Link
            key={d.id}
            to={d.path}
            style={{
              fontFamily:PP, fontWeight:600, fontSize:11,
              padding:'7px 14px', borderRadius:20, textDecoration:'none',
              background: docId === d.id ? C.primary : C.bg,
              color: docId === d.id ? '#fff' : C.mid,
              border: `1.5px solid ${docId === d.id ? C.primary : C.border}`,
              transition:'all .15s',
            }}
          >
            {d.label}
          </Link>
        ))}
      </div>

      <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:24, color:C.text, marginBottom:6, letterSpacing:-0.3 }}>
        {doc.title}
      </h1>
      <p style={{ fontFamily:PP, fontSize:12, color:C.light, marginBottom:28 }}>
        Latido.ch · Zürich, Suiza
      </p>

      <div style={{ background:'#fff', borderRadius:20, border:`1px solid ${C.border}`, padding:'28px 24px' }}>
        <Content />
      </div>

      <p style={{ fontFamily:PP, fontSize:11, color:C.light, textAlign:'center', marginTop:24 }}>
        ¿Preguntas legales? Escríbenos a hola@latido.ch
      </p>
    </div>
  )
}
