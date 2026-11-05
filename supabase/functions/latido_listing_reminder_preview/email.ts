export function listingReminderEmail(test = true) {
  const subject = `${test ? '[PRUEBA] ' : ''}Tienes mensajes pendientes. ¿Sigue disponible tu anuncio?`
  const text = [
    'Hola,', '',
    'Hemos detectado mensajes sin leer de personas interesadas en tus anuncios de Latido.',
    '¿Sigue disponible lo que publicaste?', '',
    'Si sigue disponible, revisa tus mensajes y responde a las personas que te han contactado.',
    'Si algo ha cambiado, actualiza la información de tu anuncio.',
    'Si ya no está disponible o ya encontraste lo que buscabas, desactiva el anuncio desde tu perfil para evitar nuevas consultas.', '',
    'Ver mis mensajes: https://www.latido.ch/mensajes',
    'Revisar mis anuncios: https://www.latido.ch/perfil?atencion=anuncios', '',
    'Con un momento de tu tiempo puedes ayudar a alguien a dar el siguiente paso.',
    'Gracias por mantener Latido al día y cuidar de nuestra comunidad. ❤️', '',
    'El equipo de Latido',
    'https://www.latido.ch',
  ].join('\n')
  const font="'Poppins',Arial,sans-serif"
  const html=`<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>¿Sigue disponible tu anuncio?</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>body{margin:0;padding:0;-webkit-text-size-adjust:100%}table,td{mso-table-lspace:0;mso-table-rspace:0}a{text-decoration:none}@media(max-width:620px){.outer{padding:20px 12px!important}.content{padding-left:24px!important;padding-right:24px!important}.title{font-size:26px!important;line-height:1.3!important}}</style></head>
<body style="background:#F4F7FC;color:#14213C;font-family:${font}">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">Hay personas esperando tu respuesta. Revisa tus mensajes y mantén tus anuncios al día.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F4F7FC"><tr><td class="outer" align="center" style="padding:40px 12px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#fff;border:1px solid #E6EBF5;border-radius:24px;overflow:hidden">
<tr><td><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>${['#FFBF00','#FF416A','#315FFF','#17BBEB','#03AA98'].map(c=>`<td width="20%" height="6" bgcolor="${c}" style="font-size:0;line-height:6px">&nbsp;</td>`).join('')}</tr></table></td></tr>
<tr><td class="content" style="padding:32px 40px 0"><a href="https://www.latido.ch" style="color:#14213C"><table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="padding-right:10px"><img src="https://www.latido.ch/icon-192.png" width="34" height="34" alt="" style="display:block;border:0"></td><td style="font:700 24px ${font};letter-spacing:-.7px">latido.ch</td></tr></table></a></td></tr>
<tr><td class="content" style="padding:28px 40px 0"><span style="display:inline-block;background:#EEF3FF;color:#245DF2;border-radius:30px;padding:7px 12px;font:600 11px ${font};letter-spacing:.7px">TUS ANUNCIOS EN LATIDO</span>
<h1 class="title" style="font:700 30px/1.3 ${font};letter-spacing:-.7px;margin:18px 0 20px;color:#101C33">Hay personas esperando<br>tu respuesta</h1>
<p style="font:400 15px/1.8 ${font};color:#4C5E7A;margin:0 0 12px">Hola,</p>
<p style="font:400 15px/1.8 ${font};color:#4C5E7A;margin:0">Hemos detectado <strong style="color:#14213C">mensajes sin leer</strong> de personas interesadas en tus anuncios de Latido.</p></td></tr>
<tr><td class="content" style="padding:24px 40px 0"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F4F7FF;border:1px solid #E3EAFC;border-radius:16px"><tr><td style="padding:24px">
<h2 style="font:600 19px/1.5 ${font};margin:0 0 17px;color:#14213C">¿Sigue disponible lo que publicaste?</h2>
<p style="font:400 14px/1.8 ${font};margin:0 0 14px;color:#4C5E7A"><strong style="color:#14213C">Si sigue disponible,</strong> revisa tus mensajes y responde a las personas que te han contactado.</p>
<p style="font:400 14px/1.8 ${font};margin:0 0 14px;color:#4C5E7A"><strong style="color:#14213C">Si algo ha cambiado,</strong> actualiza la información de tu anuncio.</p>
<p style="font:400 14px/1.8 ${font};margin:0;color:#4C5E7A"><strong style="color:#14213C">Si ya no está disponible o ya encontraste lo que buscabas,</strong> desactiva el anuncio desde tu perfil para evitar nuevas consultas.</p>
</td></tr></table></td></tr>
<tr><td class="content" align="center" style="padding:26px 40px 0"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td bgcolor="#245DF2" align="center" style="border-radius:12px"><a href="https://www.latido.ch/mensajes" style="display:block;padding:16px 12px;color:#fff;font:600 15px/1.5 ${font};border-radius:12px">Ver mis mensajes</a></td></tr></table>
<a href="https://www.latido.ch/perfil?atencion=anuncios" style="display:inline-block;color:#245DF2;font:600 14px/1.5 ${font};padding:18px 0 0">Revisar mis anuncios →</a></td></tr>
<tr><td class="content" style="padding:26px 40px 32px"><p style="font:400 14px/1.8 ${font};color:#4C5E7A;margin:0 0 14px">Con un momento de tu tiempo puedes ayudar a alguien a dar el siguiente paso.</p><p style="font:400 14px/1.8 ${font};color:#4C5E7A;margin:0">Gracias por mantener Latido al día y cuidar de nuestra comunidad. ❤️</p><p style="font:600 14px/1.8 ${font};color:#14213C;margin:20px 0 0">El equipo de Latido</p></td></tr>
</table><p style="font:400 12px/1.8 ${font};color:#7A8AA5;margin:20px 0 0;text-align:center">Recibes este correo porque publicaste un anuncio en Latido.<br><a href="https://www.latido.ch" style="color:#667C9E">Visitar latido.ch</a></p>
</td></tr></table></body></html>`
  return {subject,text,html}
}
