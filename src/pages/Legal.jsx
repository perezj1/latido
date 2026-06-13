import { useEffect } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { C, PP } from '../lib/theme'

const DOCS = [
  { id:'impressum',  path:'/impressum',  label:'Impressum' },
  { id:'privacidad', path:'/privacidad', label:'Privacidad' },
  { id:'cookies',    path:'/cookies',    label:'Cookies' },
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

function P({ children, style={} }) {
  return <p style={{ margin:'0 0 10px', ...style }}>{children}</p>
}

function Ul({ items }) {
  return (
    <ul style={{ margin:'0 0 10px', paddingLeft:20 }}>
      {items.map((item, i) => <li key={i} style={{ marginBottom:5 }}>{item}</li>)}
    </ul>
  )
}

function StorageTable({ rows }) {
  return (
    <div style={{ overflowX:'auto', margin:'12px 0 16px' }}>
      <table style={{ width:'100%', minWidth:620, borderCollapse:'collapse', fontFamily:PP, fontSize:11, lineHeight:1.55 }}>
        <thead>
          <tr>
            {['Tecnología', 'Proveedor', 'Finalidad', 'Duración'].map(label => (
              <th key={label} scope="col" style={{ padding:'9px 10px', textAlign:'left', color:C.text, background:C.bg, border:`1px solid ${C.border}` }}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.name}>
              <td style={{ padding:'9px 10px', verticalAlign:'top', border:`1px solid ${C.border}`, color:C.text, fontWeight:700 }}>{row.name}</td>
              <td style={{ padding:'9px 10px', verticalAlign:'top', border:`1px solid ${C.border}` }}>{row.provider}</td>
              <td style={{ padding:'9px 10px', verticalAlign:'top', border:`1px solid ${C.border}` }}>{row.purpose}</td>
              <td style={{ padding:'9px 10px', verticalAlign:'top', border:`1px solid ${C.border}` }}>{row.duration}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── CONTENIDOS ─────────────────────────────────────────────────

function Impressum() {
  return (
    <>
      <Section title="1. Responsable del sitio web">
        <P><strong>Denominación:</strong> Latido.ch</P>
        <P><strong>Domicilio:</strong> Zürich, Suiza</P>
        <P><strong>Email:</strong> info@latido.ch</P>
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
          exclusiva de quien los publica. Latido.ch actúa como plataforma de alojamiento y contacto:
          no crea, no encarga ni garantiza automáticamente dichos contenidos, y actúa tras recibir
          avisos razonables sobre contenido ilegal, engañoso o peligroso.
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
          escriba a: <strong>info@latido.ch</strong>
        </P>
      </Section>
    </>
  )
}

function Privacidad() {
  return (
    <>
      <P style={{ fontStyle:'italic', fontSize:12, color:C.light }}>
        Última actualización: junio de 2026 · Conforme a la nDSG (nueva Ley federal suiza de
        protección de datos, en vigor desde el 1 de septiembre de 2023).
      </P>

      <Section title="1. Responsable del tratamiento">
        <P>
          El responsable del tratamiento de sus datos personales es el operador de Latido.ch,
          con domicilio en Zürich, Suiza. Contacto: info@latido.ch
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

      <Section title="3. Datos visibles públicamente">
        <P>
          Si publicas anuncios, empleos, eventos, negocios, grupos, reseñas, fotos, logos o datos
          de contacto, esa información puede ser visible para otros usuarios o visitantes, indexarse
          técnicamente por buscadores si el contenido es público, y ser compartida mediante enlaces.
        </P>
        <P>
          No publiques datos personales de terceros, documentos oficiales, direcciones privadas,
          fotos de personas sin permiso ni información sensible que no quieras hacer pública.
        </P>
      </Section>

      <Section title="4. Finalidad y base jurídica del tratamiento">
        <Ul items={[
          'Prestación del servicio y gestión de tu cuenta (art. 31 nDSG — ejecución de un contrato).',
          'Seguridad de la plataforma y prevención de abusos (interés legítimo del operador).',
          'Comunicaciones de servicio por email (interés legítimo / consentimiento).',
          'Analítica opcional para mejorar la experiencia de usuario (consentimiento, cuando se active).',
          'Recepción, análisis y gestión de denuncias, moderación y retirada de contenido problemático.',
        ]} />
        <P>No realizamos tratamientos automatizados con efectos jurídicos sobre las personas ni
        elaboración de perfiles en el sentido del art. 5 lit. f nDSG.</P>
      </Section>

      <Section title="5. Plazo de conservación">
        <Ul items={[
          'Datos de cuenta: mientras la cuenta esté activa. Tras la eliminación de la cuenta, 30 días de retención por seguridad y luego eliminación definitiva.',
          'Anuncios y publicaciones: se eliminan cuando el usuario los borra o cuando se elimina la cuenta.',
          'Denuncias, cola de moderación y registros de actuación: mientras sean necesarios para seguridad, prevención de abusos, defensa de derechos o cumplimiento legal.',
          'Datos de acceso (logs IP): máximo 30 días.',
        ]} />
      </Section>

      <Section title="6. Transferencia de datos a terceros">
        <P>No vendemos ni cedemos datos personales a terceros con fines comerciales. Los datos
        son accesibles únicamente a:</P>
        <Ul items={[
          'Supabase Inc. — proveedor de base de datos y autenticación (servidores UE, con garantías adecuadas conforme a la nDSG).',
          'Vercel Inc. — proveedor de alojamiento de la aplicación (servidores UE).',
          'Autoridades suizas, cuando exista obligación legal.',
        ]} />
      </Section>

      <Section title="7. Transferencias internacionales">
        <P>
          Supabase y Vercel son empresas estadounidenses con servidores en Europa. Ambas se
          utilizan para prestar infraestructura técnica. Cuando exista una transferencia internacional
          de datos, se aplicarán las salvaguardas contractuales, técnicas y organizativas disponibles
          según la nDSG y, cuando corresponda, el RGPD.
        </P>
      </Section>

      <Section title="8. Cookies y almacenamiento local">
        <P>
          Latido.ch utiliza almacenamiento local y de sesión para prestar el servicio, mantener
          la autenticación, recordar funciones solicitadas y conservar tu elección de privacidad.
          La analítica propia y Vercel Web Analytics solo se activan si das tu consentimiento.
          No utilizamos publicidad comportamental ni vendemos datos de navegación.
        </P>
        <P>
          Encontrarás el inventario, las finalidades y la forma de retirar el consentimiento en
          nuestra <Link to="/cookies" style={{ color:C.primary, fontWeight:700 }}>Política de Cookies</Link>.
        </P>
      </Section>

      <Section title="9. Tus derechos (art. 25–27 nDSG)">
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
          Para ejercer cualquier derecho escribe a <strong>info@latido.ch</strong>. Responderemos
          en un plazo máximo de 30 días. Si consideras que tratamos tus datos de forma incorrecta,
          puedes reclamar ante el <strong>Comisionado Federal de Protección de Datos e Información
          (PFPDT / EDÖB)</strong>: edoeb.admin.ch
        </P>
      </Section>

      <Section title="10. Seguridad y brechas">
        <P>
          Aplicamos medidas técnicas y organizativas adecuadas: cifrado en tránsito (HTTPS/TLS),
          contraseñas almacenadas con hash seguro (bcrypt vía Supabase Auth), acceso restringido
          a la base de datos y revisión periódica de permisos.
        </P>
        <P>
          Si se produce una brecha de seguridad que pueda implicar un riesgo relevante para las
          personas afectadas, Latido evaluará el incidente y realizará las comunicaciones necesarias
          a usuarios o autoridades competentes conforme a la ley aplicable.
        </P>
      </Section>

      <Section title="11. Menores de edad">
        <P>
          Latido.ch no está dirigido a menores de 16 años. Si tienes conocimiento de que un menor
          ha proporcionado datos personales, contacta con nosotros para su eliminación inmediata.
        </P>
      </Section>

      <Section title="12. Cambios en esta política">
        <P>
          Notificaremos cualquier cambio relevante por email o mediante aviso en la plataforma.
          El uso continuado de Latido.ch tras la notificación implica la aceptación de la nueva versión.
        </P>
      </Section>
    </>
  )
}

function Cookies() {
  const necessaryRows = [
    {
      name:'latido_cookie_consent',
      provider:'Latido.ch',
      purpose:'Conserva tu elección de privacidad y la versión de la política aceptada o rechazada.',
      duration:'6 meses.',
    },
    {
      name:'sb-…-auth-token',
      provider:'Supabase / Latido.ch',
      purpose:'Mantiene la sesión autenticada, renueva el acceso de forma segura y permite cerrar sesión.',
      duration:'Hasta cerrar sesión, expirar la sesión o borrar los datos del navegador.',
    },
    {
      name:'Preferencias latido_*',
      provider:'Latido.ch',
      purpose:'Recuerda funciones solicitadas como favoritos, alertas, notificaciones, mensajes leídos y avisos ya revisados.',
      duration:'Hasta desactivar la función, cerrar la cuenta o borrar los datos del navegador.',
    },
    {
      name:'latido_pwa_dismissed y sesión técnica',
      provider:'Latido.ch',
      purpose:'Evita repetir avisos durante la sesión y coordina funciones activas de la aplicación.',
      duration:'Hasta cerrar la pestaña o el navegador.',
    },
    {
      name:'Cache de la PWA y Eventfrog',
      provider:'Latido.ch',
      purpose:'Mejora la carga, el funcionamiento sin conexión y evita repetir consultas de eventos.',
      duration:'La caché de eventos se reutiliza hasta 1 hora; la caché PWA se renueva con nuevas versiones.',
    },
  ]

  const analyticsRows = [
    {
      name:'latido_analytics_session_id',
      provider:'Latido.ch / Supabase',
      purpose:'Distingue de forma seudónima las interacciones de una misma sesión para medir páginas, búsquedas y clics.',
      duration:'Hasta cerrar la pestaña o el navegador. Los eventos analíticos se conservan como máximo 12 meses.',
    },
    {
      name:'Vercel Web Analytics',
      provider:'Vercel Inc.',
      purpose:'Genera estadísticas agregadas de visitas, rutas, dispositivo, navegador, referencia y ubicación aproximada.',
      duration:'No instala cookies de terceros; Vercel descarta el identificador de sesión derivado en 24 horas.',
    },
    {
      name:'Atribución de colaboradores',
      provider:'Latido.ch / Supabase',
      purpose:'Mide, con consentimiento, interacciones con servicios colaboradores y la campaña de origen.',
      duration:'Hasta retirar el consentimiento o borrar los datos del navegador; eventos, máximo 12 meses.',
    },
  ]

  return (
    <>
      <P style={{ fontStyle:'italic', fontSize:12, color:C.light }}>
        Última actualización: 13 de junio de 2026 · Versión de consentimiento: 2026-06-13.
      </P>

      <Section title="1. Alcance">
        <P>
          Esta política explica cómo Latido.ch utiliza cookies y tecnologías similares, incluidas
          localStorage, sessionStorage, identificadores de sesión y cachés del navegador. Se aplica
          al sitio web y a la aplicación web progresiva de Latido.
        </P>
      </Section>

      <Section title="2. Responsable y contacto">
        <P>
          El responsable es el operador de Latido.ch, con domicilio en Zürich, Suiza.
          Para consultas o ejercicio de derechos: <strong>info@latido.ch</strong>.
        </P>
      </Section>

      <Section title="3. Categorías y base jurídica">
        <P><strong>Necesarias y funcionales.</strong> Permiten prestar el servicio solicitado,
        autenticar usuarios, proteger la plataforma y recordar funciones elegidas. No pueden
        desactivarse desde el panel porque Latido no funcionaría correctamente sin ellas.</P>
        <P><strong>Analítica opcional.</strong> Se basa en tu consentimiento. Está desactivada
        por defecto y rechazarla no limita el acceso a Latido. No usamos categorías de publicidad
        comportamental ni creamos perfiles publicitarios.</P>
      </Section>

      <Section title="4. Tecnologías necesarias y funcionales">
        <StorageTable rows={necessaryRows} />
        <P>
          Algunas claves incluyen un identificador de usuario para separar correctamente las
          preferencias de varias cuentas que utilicen el mismo dispositivo.
        </P>
      </Section>

      <Section title="5. Analítica opcional">
        <StorageTable rows={analyticsRows} />
        <P>
          La analítica propia puede incluir la ruta visitada, términos de búsqueda limitados,
          tipo de interacción, estado de inicio de sesión, identificador de usuario cuando exista
          cuenta y metadatos técnicos necesarios para interpretar el evento. Evita introducir datos
          personales o sensibles en el buscador.
        </P>
      </Section>

      <Section title="6. Proveedores y transferencias">
        <P>
          Supabase Inc. presta autenticación y base de datos; Vercel Inc. presta alojamiento y
          analítica agregada. Son proveedores estadounidenses que pueden tratar datos desde o fuera
          de Suiza y del EEE conforme a sus contratos, medidas de seguridad y mecanismos de
          transferencia aplicables. La información ampliada figura en la Política de Privacidad.
        </P>
      </Section>

      <Section title="7. Cómo decidir o retirar el consentimiento">
        <P>
          En la primera visita a la landing pública puedes aceptar la analítica, rechazarla o
          configurar tu selección. Puedes cambiarla en cualquier momento, sin justificar tu decisión
          y sin perder acceso al servicio. La retirada no afecta al tratamiento realizado lícitamente
          antes de retirarla.
        </P>
        <Link
          to="/?cookie-settings=1"
          style={{ display:'inline-flex', fontFamily:PP, fontWeight:800, fontSize:12, color:'#fff', background:C.primary, border:0, borderRadius:12, padding:'11px 16px', cursor:'pointer', textDecoration:'none' }}
        >
          Volver a la landing y configurar
        </Link>
      </Section>

      <Section title="8. Control desde el navegador">
        <P>
          También puedes borrar o bloquear el almacenamiento desde la configuración del navegador.
          Si eliminas los datos necesarios, se cerrará la sesión y podrían perderse favoritos,
          alertas u otras preferencias guardadas localmente.
        </P>
      </Section>

      <Section title="9. Cambios en esta política">
        <P>
          Si cambia una finalidad, proveedor o categoría relevante, actualizaremos esta política
          y solicitaremos una nueva elección cuando sea necesario. La selección actual caduca a
          los seis meses para que puedas revisarla periódicamente.
        </P>
      </Section>
    </>
  )
}

function Terminos() {
  return (
    <>
      <P style={{ fontStyle:'italic' }}>
        Última actualización: junio de 2026 · Legislación aplicable: derecho suizo.
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
          la conexión con grupos, la búsqueda de empleo y el acceso a guías de trámites.
        </P>
        <P>
          <strong>Latido.ch actúa exclusivamente como intermediario técnico.</strong> No es parte
          en ninguna transacción, acuerdo o comunicación entre usuarios. No verifica la veracidad
          de los contenidos publicados salvo las verificaciones expresamente indicadas.
        </P>
      </Section>

      <Section title="3. Rol de Latido: contacto, no garantía">
        <P>
          Latido.ch no es parte de los contratos, pagos, entregas, servicios, empleos, alquileres,
          eventos o acuerdos que los usuarios puedan cerrar entre sí. Latido no fija precios,
          no cobra comisiones por contratación, no selecciona candidatos, no envía trabajadores,
          no actúa como agencia privada de colocación ni como empresa de trabajo temporal.
        </P>
        <P>
          Salvo que se indique expresamente por escrito, Latido no verifica automáticamente
          identidad, solvencia, licencias, seguros, permisos, formación, antecedentes, disponibilidad,
          calidad, legalidad ni resultados de los servicios publicados.
        </P>
      </Section>

      <Section title="4. Registro y cuenta de usuario">
        <Ul items={[
          'Debes tener al menos 18 años para crear una cuenta.',
          'La información que proporcionas debe ser veraz, completa y actualizada.',
          'Eres responsable de la confidencialidad de tu contraseña y de toda actividad realizada desde tu cuenta.',
          'Está prohibido crear cuentas falsas, suplantar identidades o crear múltiples cuentas.',
          'Notifica inmediatamente a info@latido.ch si detectas un uso no autorizado de tu cuenta.',
        ]} />
      </Section>

      <Section title="5. Responsabilidad sobre los contenidos publicados">
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
          'Cuenta con autorización para publicar fotos, logos, marcas, nombres comerciales y datos de contacto.',
          'Cuenta con los permisos, licencias, seguros o cualificaciones necesarios cuando el servicio anunciado lo requiera.',
          'No viola ninguna ley suiza ni internacional aplicable.',
        ]} />
        <P>
          Latido.ch se reserva el derecho de eliminar sin previo aviso cualquier contenido que
          infrinja estos Términos o la legislación vigente.
        </P>
      </Section>

      <Section title="6. Contenidos prohibidos">
        <P>Está estrictamente prohibido publicar contenidos que:</P>
        <Ul items={[
          'Sean ilegales según el derecho suizo (CP, LCD, CO y demás legislación aplicable).',
          'Contengan información falsa, engañosa o fraudulenta (art. 146 CP — estafa).',
          'Inciten al odio, discriminación o violencia por razón de origen, religión, sexo u otra característica (art. 261bis CP).',
          'Constituyan acoso, amenazas o intimidación a otros usuarios.',
          'Difamen, insulten gravemente o lesionen el honor de personas o empresas.',
          'Vulneren derechos de propiedad intelectual o industrial de terceros.',
          'Promuevan actividades ilegales, incluida la venta de sustancias prohibidas, armas, medicamentos sin autorización, documentos falsos, productos falsificados o servicios sexuales si Latido no los permite.',
          'Contengan spam, publicidad no solicitada o contenido con fines puramente comerciales no autorizados.',
          'Expongan datos personales de terceros sin su consentimiento, incluidas direcciones, teléfonos, documentos, imágenes privadas o información sensible.',
          'Sean de naturaleza sexual explícita o pornográfica.',
          'Ofrezcan empleo sin contrato, sin permiso de trabajo, pagos en negro o condiciones contrarias a la normativa laboral aplicable.',
          'Incluyan requisitos discriminatorios en empleo o vivienda, salvo requisitos objetivos y legalmente justificables.',
          'Presenten servicios regulados como salud, legal, seguros, finanzas, transporte, construcción, cuidado infantil u otros sin permisos o cualificaciones suficientes.',
        ]} />
      </Section>

      <Section title="7. Denuncias, moderación y retirada">
        <P>
          Latido puede revisar contenidos publicados, denuncias recibidas y señales automáticas
          de riesgo. Si un contenido parece ilegal, fraudulento, discriminatorio, peligroso o
          contrario a estos Términos, Latido podrá:
        </P>
        <Ul items={[
          'Ocultarlo temporalmente mientras se revisa.',
          'Solicitar información adicional al publicador o denunciante.',
          'Eliminarlo total o parcialmente.',
          'Suspender, limitar o eliminar cuentas reincidentes.',
          'Conservar registros razonables para prevenir abusos, defender derechos o colaborar con autoridades competentes cuando exista obligación legal.',
        ]} />
        <P>
          Los usuarios pueden denunciar contenido desde el botón "Reportar" o escribiendo a
          <strong> info@latido.ch</strong> con la URL, motivo y pruebas disponibles.
        </P>
      </Section>

      <Section title="8. Empleo, vivienda y servicios regulados">
        <P>
          Las publicaciones de empleo deben ser reales, claras y no discriminatorias. Latido no
          interviene en procesos de selección, contratación, cesión de personal, pagos, nóminas,
          permisos de trabajo, seguros sociales ni cumplimiento de convenios.
        </P>
        <P>
          Para vivienda, servicios profesionales, salud, asesoría legal o fiscal, seguros,
          transporte, construcción, cuidado infantil u otros ámbitos regulados, las partes deben
          verificar directamente permisos, cualificaciones, seguros, referencias, contratos,
          precios, impuestos y obligaciones cantonales o federales.
        </P>
      </Section>

      <Section title="9. Destacados, verificación y recomendaciones">
        <P>
          Las etiquetas como "Destacado", "Colaborador", "Verificada" o similares solo significan
          lo que se indique en la interfaz. Un destacado puede responder a criterios editoriales,
          técnicos o comerciales, y no implica por sí solo que Latido garantice calidad, seguridad,
          licencias, disponibilidad o resultados.
        </P>
        <P>
          Las recomendaciones y reseñas pertenecen a usuarios de la comunidad. Latido puede retirarlas
          si son falsas, abusivas, difamatorias, incentivadas de forma engañosa o contrarias a estos Términos.
        </P>
      </Section>

      <Section title="10. Conducta en la plataforma">
        <Ul items={[
          'Trata a los demás usuarios con respeto y buena fe.',
          'No utilices la plataforma para actividades comerciales masivas o scraping de datos.',
          'No intentes vulnerar la seguridad, integridad o disponibilidad del servicio.',
          'Usa los datos de contacto de otros usuarios únicamente para el fin legítimo por el que fueron publicados.',
        ]} />
      </Section>

      <Section title="11. Propiedad intelectual">
        <P>
          El diseño, marca, código fuente y contenidos originales de Latido.ch son propiedad del
          operador y están protegidos por la Ley federal de derecho de autor (LDA/URG).
          Al publicar contenido en la plataforma, concedes a Latido.ch una licencia no exclusiva,
          gratuita y revocable para mostrarlo y distribuirlo dentro del servicio.
        </P>
      </Section>

      <Section title="12. Modificación y suspensión del servicio">
        <P>
          El operador puede modificar, suspender o interrumpir el servicio en cualquier momento
          sin previo aviso. También puede suspender o eliminar cuentas de usuario que infrinjan
          estos Términos, sin obligación de indemnización.
        </P>
      </Section>

      <Section title="13. Limitación de responsabilidad">
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

      <Section title="14. Derecho aplicable y jurisdicción">
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

      <Section title="15. Modificación de los Términos">
        <P>
          El operador puede actualizar estos Términos en cualquier momento. Los cambios se
          notificarán por email o mediante aviso en la plataforma con al menos 14 días de
          antelación. El uso continuado del servicio tras ese plazo implica la aceptación
          de los nuevos Términos.
        </P>
      </Section>

      <Section title="16. Nulidad parcial">
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
          alojamiento de información y contacto. No crea ni encarga las publicaciones de usuarios.
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
          un contenido ilícito: info@latido.ch
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
          'La existencia de licencias, permisos, seguros, cualificaciones, referencias o habilitaciones profesionales.',
          'La autenticidad de fotos, logos, marcas, certificados o documentos mostrados por usuarios.',
        ]} />
      </Section>

      <Section title="4. Servicios regulados y contratación">
        <P>
          En áreas como salud, asesoría legal o fiscal, seguros, finanzas, transporte, construcción,
          cuidado infantil, empleo, vivienda u otros servicios sujetos a permisos, Latido.ch no
          comprueba automáticamente la habilitación profesional ni el cumplimiento de normas
          cantonales o federales. Cada parte debe verificarlo directamente antes de contratar.
        </P>
      </Section>

      <Section title="5. Empleo y agencias">
        <P>
          Latido.ch publica ofertas o búsquedas de empleo como tablón comunitario. No actúa como
          agencia privada de colocación, empresa de trabajo temporal, intermediario laboral activo
          ni empleador, y no gestiona contratos, nóminas, permisos de trabajo ni cesión de personal.
        </P>
      </Section>

      <Section title="6. Transacciones entre usuarios">
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

      <Section title="7. Guías e información práctica">
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

      <Section title="8. Enlaces externos">
        <P>
          Latido.ch puede contener enlaces a sitios web de terceros. Dichos enlaces se proporcionan
          únicamente como recurso informativo. El operador no controla ni asume responsabilidad
          alguna por el contenido, la política de privacidad ni las prácticas de sitios externos.
        </P>
      </Section>

      <Section title="9. Propiedad intelectual y privacidad de terceros">
        <P>
          Los usuarios son responsables de contar con permisos para publicar fotos, textos, logos,
          marcas, imágenes de personas y datos de contacto. Latido.ch podrá retirar contenidos
          cuando reciba avisos razonables sobre infracción de copyright, marca, privacidad, honor
          o derechos de imagen.
        </P>
      </Section>

      <Section title="10. Limitación de responsabilidad">
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

      <Section title="11. Notificación de contenidos ilegales">
        <P>
          Si encuentras en Latido.ch contenidos que consideres ilegales, fraudulentos o que
          vulneren derechos de terceros, usa el botón <strong>Reportar</strong> o notifícalo a
          <strong> info@latido.ch</strong> indicando la URL del contenido, el motivo de la denuncia
          y cualquier prueba disponible. El operador actuará con la mayor diligencia posible.
        </P>
      </Section>
    </>
  )
}

// ── COMPONENTE PRINCIPAL ────────────────────────────────────────

const DOC_MAP = {
  impressum:  { title:'Impressum',                      component: Impressum },
  privacidad: { title:'Política de Privacidad',         component: Privacidad },
  cookies:    { title:'Política de Cookies',             component: Cookies },
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
        ¿Preguntas legales? Escríbenos a info@latido.ch
      </p>
    </div>
  )
}
