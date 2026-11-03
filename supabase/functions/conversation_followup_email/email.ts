import { FOLLOWUP_HTML } from './email-template.ts'
export type FollowupEmailInput = { title:string; conversation_id:string; token:string; contact_name?:string }
const escapeHtml = (value:string) => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]!))
export function buildFollowupEmail(input:FollowupEmailInput, appUrl:string) {
  const base = appUrl.replace(/\/+$/, '')
  const link = (answer:string) => `${base}/seguimiento#token=${encodeURIComponent(input.token)}&respuesta=${answer}`
  const choices = [{ answer: 'yes', label: 'Sí' }, { answer: 'not_yet', label: 'En proceso' }, { answer: 'no', label: 'No' }]
  const chat = `${base}/mensajes?conv=${encodeURIComponent(input.conversation_id)}`
  const name = input.contact_name?.replace(/[\r\n]+/g, ' ').trim() || 'este contacto'
  const firstName = /^(?:este contacto|usuario)$/i.test(name) ? 'este contacto' : name.split(/\s+/)[0]
  const question = `¿Pudiste llegar a un acuerdo con ${firstName}?`
  const subject = input.contact_name ? `¿Cómo fue tu consulta con ${name}?` : '¿Cómo fue tu consulta en Latido?'
  const text = ['Estado de tu consulta en Latido', '', question, '', `Hace unos días hablaste por el chat de Latido con ${name}.`, `Tu consulta: ${input.title}`, '', 'Responde en un clic', '', ...choices.map(({answer,label}) => `${label}: ${link(answer)}`), '', `Abrir conversación: ${chat}`, '', 'Tu respuesta nos ayuda a mejorar Latido y ofrecer servicios de calidad. ¡Gracias! ❤️', 'El equipo de Latido'].join('\n')
  const values:Record<string,string> = { nombre_contacto:name, titulo_consulta:input.title, pregunta_seguimiento:question, url_conversacion:chat, url_si:link('yes'), url_en_proceso:link('not_yet'), url_no:link('no'), url_logo:`${base}/icon-192.png` }
  // Preserve the email layout already deployed from the dashboard.
  const template = FOLLOWUP_HTML
    .replace(/¡Hola!\s*/g, '')
    .replace(/(<title\b[^>]*>)[\s\S]*?(<\/title>)/i, '$1{{pregunta_seguimiento}}$2')
    .replace(/(<h1\b[^>]*>)[\s\S]*?(<\/h1>)/i, '$1{{pregunta_seguimiento}}$2')
    .replace(/(<h2\b[^>]*>)[\s\S]*?(<\/h2>)/i, '$1Responde en un clic$2')
    .replace(/<p\b[^>]*>\s*Responde en un clic\s*<\/p>/gi, '')
    .replace(/¿Conseguiste lo que buscabas\?/gi, '{{pregunta_seguimiento}}')
  const html = template.replace(/\{\{([a-z_]+)\}\}/g, (_match, key:string) => escapeHtml(values[key] || ''))
  return { subject, text, html }
}
