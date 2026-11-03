import { FOLLOWUP_HTML } from './email-template.ts'
export type FollowupEmailInput = { title:string; conversation_id:string; token:string; contact_name?:string }
const escapeHtml = (value:string) => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]!))
export function buildFollowupEmail(input:FollowupEmailInput, appUrl:string) {
  const base = appUrl.replace(/\/+$/, '')
  const link = (answer:string) => `${base}/seguimiento#token=${encodeURIComponent(input.token)}&respuesta=${answer}`
  const choices = [{ answer: 'yes', label: 'Sí' }, { answer: 'not_yet', label: 'En proceso' }, { answer: 'no', label: 'No' }]
  const chat = `${base}/mensajes?conv=${encodeURIComponent(input.conversation_id)}`
  const name = input.contact_name?.replace(/[\r\n]+/g, ' ').trim() || 'este contacto'
  const subject = input.contact_name ? `¿Cómo fue tu consulta con ${name}?` : '¿Cómo fue tu consulta en Latido?'
  const text = ['Estado de tu consulta en Latido', '', '¿Cómo te ha ido?', '', `Hace unos días hablaste por el chat de Latido con ${name}.`, `Tu consulta: ${input.title}`, '', '¿Conseguiste lo que buscabas con este contacto?', '', ...choices.map(({answer,label}) => `${label}: ${link(answer)}`), '', 'Responde en un clic', '', `Abrir conversación: ${chat}`, '', 'Tu respuesta nos ayuda a mejorar Latido y ofrecer servicios de calidad. ¡Gracias! ❤️', 'El equipo de Latido'].join('\n')
  const values:Record<string,string> = { nombre_contacto:name, titulo_consulta:input.title, url_conversacion:chat, url_si:link('yes'), url_en_proceso:link('not_yet'), url_no:link('no'), url_logo:`${base}/icon-192.png` }
  const html = FOLLOWUP_HTML.replace(/\{\{([a-z_]+)\}\}/g, (_match, key:string) => escapeHtml(values[key] || ''))
  return { subject, text, html }
}
