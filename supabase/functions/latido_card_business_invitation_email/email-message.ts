import { INVITATION_HTML } from './email-template.ts'
import { INVITATION_IMAGES } from './email-images.ts'

const escape = (value: string) => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]!)

export function invitationMessage({ appUrl, providerId, name, unsubscribe = '', test = false, register = false }: {
  appUrl: string
  providerId: string | null
  name: string
  unsubscribe?: string
  test?: boolean
  register?: boolean
}) {
  const path = providerId
    ? `/card/negocios?negocio=${encodeURIComponent(providerId)}&crear=1`
    : register ? '/registrar-negocio?origen=tarjeta' : '/card/negocios'
  const url = `${appUrl.replace(/\/+$/, '')}${path}`
  let html = INVITATION_HTML.replaceAll('{{URL_CREAR_OFERTA}}', escape(url))
  if (unsubscribe) html = html.replace('</body>', `<p style="text-align:center;font:12px Arial;color:#62728b"><a href="${escape(unsubscribe)}">No recibir más invitaciones</a></p></body>`)
  return {
    url,
    subject: `${test ? '[PRUEBA] ' : ''}Haz crecer tu negocio con Latido`,
    text: [
      name ? `¡Enhorabuena, ${name}!` : '¡Enhorabuena!', '',
      '¡Haz crecer tu negocio con Latido!', '',
      'Tu negocio ya forma parte de Latido.ch y queremos ayudarte a llegar a más clientes.',
      'Ahora puedes crear ofertas exclusivas para atraer nuevos clientes, dar más visibilidad a tu negocio y animar a nuestra comunidad a apoyar a los negocios hispanohablantes en Suiza.', '',
      'Es totalmente GRATIS. Tú decides qué ofrecer y las condiciones.', '',
      `Crear oferta gratis: ${url}`, '',
      'Juntos podemos hacer crecer nuestros negocios y fortalecer nuestra comunidad.',
      ...(unsubscribe ? ['', `No recibir más invitaciones: ${unsubscribe}`] : []),
    ].join('\n'),
    html,
    attachments: INVITATION_IMAGES.map(image => ({ ...image })),
    ...(unsubscribe ? { headers: {
      'List-Unsubscribe': `<${unsubscribe}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    } } : {}),
  }
}
