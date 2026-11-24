// Presentation only. No question IDs, solutions or answer keys are shipped here.
// Templates keep the proposed value received from the server, whether true or
// false; they never decide its correctness or change the option order.
const lower=text=>text.charAt(0).toLocaleLowerCase('es')+text.slice(1)
const sentence=text=>`${text.trim().replace(/\.+$/u,'')}.`
const templates=[
  [/^¿Qué caracteriza a los cantones suizos\?$/iu,p=>`Los cantones suizos ${lower(p)}`],
  [/^Antes de usar un sótano o plaza adicional,/iu,p=>`Antes de usar un sótano o una plaza adicional, basta con comprobar ${lower(p)}`],
  [/^¿Qué conjunto de datos debe quedar claro antes de empezar un trabajo\?$/iu,p=>`Antes de empezar un trabajo deben quedar claros estos datos: ${lower(p)}`],
  [/^¿Qué describe la franquicia del seguro de salud\?$/iu,p=>`La franquicia del seguro de salud es ${lower(p)}`],
  [/^¿Qué país comparte frontera con Suiza\?$/iu,p=>`${p} comparte frontera con Suiza`],
  [/^¿Qué cámaras forman el Parlamento federal\?$/iu,p=>`Las cámaras del Parlamento federal son el ${p.replace(/ y /u,' y el ')}`],
  [/^Varias personas figuran como inquilinas en el mismo contrato\./iu,p=>`En un contrato de alquiler conjunto, ${lower(p).replace(/^que /u,'')}`],
  [/^¿Qué idea describe correctamente un contrato de trabajo\?$/iu,p=>`Un contrato de trabajo ${lower(p)}`],
  [/^¿Qué ocurre generalmente con la prima al elegir una franquicia opcional más alta\?$/iu,p=>`Al elegir una franquicia más alta, ${lower(p)}`],
  [/^¿Qué conviene saber sobre el alemán en la Suiza germanófona\?$/iu,p=>`En la Suiza germanófona ${lower(p)}`],
  [/^¿Quién elige a los miembros del Consejo Federal\?$/iu,p=>`${p} elige a los miembros del Consejo Federal`],
  [/^¿Qué información conviene dejar claramente documentada en un subalquiler\?$/iu,p=>`En un subalquiler se debe documentar ${lower(p)}`],
  [/^¿Cómo se relacionan la jornada pactada y las normas de protección laboral\?$/iu,p=>p],
  [/^Para una solicitud de seguro básico sujeta a la obligación de asegurarse,/iu,p=>`El seguro básico obligatorio y el complementario ${lower(p).replace(/^ambos /u,'')}`],
  [/^Tu abono cubre muchos trayectos y quieres subir a una línea de montaña\./iu,p=>`Antes de usar tu abono en una línea de montaña, conviene comprobar ${lower(p)}`],
  [/^Debes informarte sobre escuela local y sobre una norma federal\./iu,p=>`Para dudas sobre escuela local y normas federales, lo adecuado es ${lower(p)}`],
  [/^Vais a compartir piso y todos firmaréis\./iu,p=>`Si todos firmáis el contrato del piso, lo adecuado es ${lower(p)}`],
  [/^Dos ofertas tienen el mismo salario anunciado\./iu,p=>`Para comparar dos empleos con igual salario, conviene comparar ${lower(p)}`],
  [/^Una prima baja te atrae, pero apenas tienes ahorro para gastos imprevistos\./iu,p=>`Antes de elegir seguro hay que comparar ${lower(p)}`],
  [/^Un abono tiene cobertura en Suiza y planeas seguir hacia el extranjero\./iu,p=>`Antes de seguir al extranjero con un abono suizo, hay que comprobar ${lower(p)}`],
]

export function questionStatement(question){
  const prompt=String(question?.prompt||'')
  if((question?.type||question?.game_type)!=='tf')return prompt
  const legacy=prompt.match(/^([\s\S]*?)\s*Respuesta propuesta:\s*[«“"]([\s\S]+)[»”"]\s*\.?\s*¿Es correcta\?\s*$/iu)
  if(legacy){
    const context=legacy[1].replace(/\s+/gu,' ').trim(),value=legacy[2].trim()
    const template=templates.find(([pattern])=>pattern.test(context))
    return template?sentence(template[1](value)):prompt
  }
  // A yes/no question already has a complete proposition. Open questions need
  // an editorial rewrite instead of simply deleting their punctuation.
  const polar=prompt.trim().match(/^¿([^¿?]+)\?$/u)
  if(polar&&!/^(qué|quién|cuál|dónde|adónde|cómo|cuándo|cuánto|por qué|para qué)(?:\s|$)/iu.test(polar[1]))return sentence(polar[1])
  return prompt
}

export function isStatement(prompt){
  const main=String(prompt||'').replace(/«[^»]*»|“[^”]*”|"[^"]*"/gu,'').trim()
  return !!main&&!/[¿?]|respuesta propuesta/iu.test(main)
}

export function reviewStatement(review){
  return questionStatement({...review,type:review?.type||review?.game_type||(/Respuesta propuesta:/iu.test(review?.prompt||'')?'tf':undefined)})
}

export function sessionQuestionText(session){
  if(!session||typeof session!=='object'||Array.isArray(session))return session
  const result={...session}
  if(session.question)result.question={...session.question,prompt:questionStatement(session.question)}
  if(Array.isArray(session.review_answers))result.review_answers=session.review_answers.map(review=>({...review,prompt:reviewStatement(review)}))
  return result
}
