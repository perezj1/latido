// Original exercises. Dictionaries substantiate vocabulary, not the invented
// situations or sentences. Each family shares a concept to support spaced review.
const pons=word=>`https://de.pons.com/%C3%BCbersetzung/deutsch-spanisch/${encodeURIComponent(word)}`
const lang=word=>`https://de.langenscheidt.com/deutsch-spanisch/${word}`
const a1='https://www.goethe.de/pro/relaunch/prf/de/A1_SD1_Wortliste_02.pdf'
const words=[
  ['schluessel','der Schlüssel','la llave','Wo ist mein ___?','¿Dónde está mi llave?',pons('Schlüssel'),'PONS · Schlüssel',['Wo','ist','mein Schlüssel?']],
  ['haltestelle','die Haltestelle','la parada de transporte','Wo ist die ___?','¿Dónde está la parada?',pons('Haltestelle'),'PONS · Haltestelle',['Wo','ist','die Haltestelle?']],
  ['unterschrift','die Unterschrift','la firma','Hier fehlt Ihre ___.','Aquí falta su firma.',pons('Unterschrift'),'PONS · Unterschrift',['Das','ist','meine Unterschrift.']],
  ['oeffnungszeiten','die Öffnungszeiten','el horario de apertura','Wie sind die ___?','¿Cuál es el horario de apertura?','https://de.langenscheidt.com/spanisch-deutsch/horario','Langenscheidt · horario',['Wie','sind','die Öffnungszeiten?']],
  ['fahrkarte','die Fahrkarte','el billete de transporte','Ich brauche eine ___.','Necesito un billete de transporte.',pons('Fahrschein'),'PONS · Fahrschein / Fahrkarte',['Ich','brauche','eine Fahrkarte.']],
  ['quittung','die Quittung','el recibo de pago','Ich hätte gern eine ___.','Quisiera un recibo de pago.','https://pons-langenscheidt-zusatzmaterial.de/audio-daten/DaF/Deutsch-Test%20f%C3%BCr%20Zuwanderer%20-%20wordlist%20DE-ES_final.pdf','PONS · Vocabulario de compras',['Bitte','geben Sie','mir','eine Quittung.']],
  ['ausweis','der Ausweis','el documento de identidad','Zeigen Sie bitte Ihren ___.','Muestre su documento de identidad, por favor.',lang('ausweis'),'Langenscheidt · Ausweis',['Mein Ausweis','ist','hier.']],
  ['bewerbung','die Bewerbung','la solicitud de empleo','Ich schicke meine ___.','Envío mi solicitud de empleo.','https://m.dict.cc/deutsch-spanisch/bewerbung.html','dict.cc · Bewerbung',['Ich','schicke','meine Bewerbung.']],
  ['briefkasten','der Briefkasten','el buzón de correo','Wo ist der ___?','¿Dónde está el buzón de correo?','https://m.dict.cc/deutsch-spanisch/Briefkasten.html','dict.cc · Briefkasten',['Der Briefkasten','ist','dort.']],
  ['abfall','der Abfall','la basura','Hier sammeln wir ___.','Aquí recogemos basura.',lang('abfall'),'Langenscheidt · Abfall',['Wir','entsorgen','den Abfall.']],
  ['lohn','der Lohn','el salario','Wann bekomme ich meinen ___?','¿Cuándo recibo mi salario?',lang('lohn'),'Langenscheidt · Lohn',['Wann','bekomme','ich','meinen Lohn?']],
  ['hilfe','die Hilfe','la ayuda','Ich brauche ___.','Necesito ayuda.',a1,'Goethe-Institut · Vocabulario A1',['Ich brauche','heute','Hilfe.']],
  ['obst','das Obst','la fruta','Ich esse gern ___.','Me gusta comer fruta.','https://pons-langenscheidt-zusatzmaterial.de/shop-daten/landingpages/bildwoerterbuch/PONS_Bildwoerterbuch_Deutsch-Spanisch_nach_Kapitel.pdf','PONS · Obst – Fruta'],
  ['brot','das Brot','el pan','Ich kaufe ___.','Compro pan.','https://en.langenscheidt.com/german-spanish/brot','Langenscheidt · Brot'],
  ['milch','die Milch','la leche','Ich trinke ___.','Bebo leche.',lang('milch'),'Langenscheidt · Milch'],
  ['wasser','das Wasser','el agua','Ich möchte ___.','Quisiera agua.',pons('Wasser'),'PONS · Wasser'],
]
const surfaces=words.map(w=>w[1].replace(/^(der|die|das) /,''))
const groups=[[0,8,9,11],[1,3,4,6],[2,5,7,10],[12,13,14,15]]
const reverseDistractors=[
  [8,9,10],[3,7,5],[7,5,1],[1,5,7],[5,7,2],[4,7,2],[8,10,0],[2,5,4],
  [0,10,9],[0,8,10],[0,8,6],[2,5,7],[13,14,15],[12,14,15],[15,12,13],[14,12,13],
]
const orderTranslations=['¿Dónde está mi llave?','¿Dónde está la parada?','Esta es mi firma.','¿Cuál es el horario de apertura?','Necesito un billete de transporte.','Por favor, deme un recibo de pago.','Mi documento de identidad está aquí.','Envío mi solicitud de empleo.','El buzón de correo está allí.','Desechamos la basura.','¿Cuándo recibo mi salario?','Necesito ayuda hoy.']
const source=w=>({url:w[5],title:w[6],checked_at:'2026-11-18',locator:`Entrada ${surfaces[words.indexOf(w)]}: género, significado y uso cotidiano`})
function base(w,task,difficulty=1){
  return {id:`szl16-de-${w[0]}-${task}`,collection:'suizamente-language-exercises-16',territory:'CH',scope:'CH',canton:null,topic:'idioma',category:'idioma',difficulty,language:'es',learning_language:'de',language_task:task,concept_id:`language:de:${w[0]}`,learning_concepts:[`language:de:${w[0]}`],status:'published',game_only:true,correct_index:0,source_url:w[5],source_title:w[6],sources:[source(w)],reviewed_at:'2026-11-18',verified_at:'2026-11-18',validation_status:'verified',next_review_at:'2027-11-18'}
}
export function languageExercises(){
  const questions=[]
  for(const [i,w]of words.entries()){
    const hard=[2,3,5,6,7,10].includes(i)?2:1
    const wrong=reverseDistractors[i]
    const explanation=`${w[1]}: ${w[2]}.`
    questions.push({...base(w,'choose_word',hard),game_type:'choice',prompt:`Elige «${w[2]}» en alemán.`,options:[w[1],...wrong.map(j=>words[j][1])],explanation})
    questions.push({...base(w,'meaning',hard),game_type:'choice',prompt:`¿Qué significa «${w[1]}»?`,options:[w[2],...wrong.map(j=>words[j][2])],explanation})
    questions.push({...base(w,'complete_sentence',Math.min(3,hard+1)),game_type:'choice',prompt:`Completa «${w[3]}» para decir: «${w[4]}»`,options:[surfaces[i],...wrong.map(j=>surfaces[j])],explanation:`${w[3].replace('___',surfaces[i])} ${w[4]}`})
    if(w[7]){
      const tokens=w[7],options=[...tokens.slice(1),tokens[0]]
      questions.push({...base(w,'order_sentence',Math.min(3,hard+1)),game_type:'order',prompt:`Ordena «${orderTranslations[i]}». Empieza por «${tokens[0]}».`,options,correct_order:tokens.map(token=>options.indexOf(token)),explanation:`${tokens.join(' ')} ${orderTranslations[i]}`})
    }
  }
  for(const [i,indexes]of groups.entries()){
    const rows=indexes.map(j=>words[j]),q=base(rows[0],'match_words',2)
    questions.push({...q,id:`szl16-de-parejas-${i+1}`,concept_id:`language:de:review-${i+1}`,learning_concepts:rows.map(w=>`language:de:${w[0]}`),game_type:'match',prompt:['Une palabras alemanas de casa y ayuda.','Une palabras de un viaje en transporte público.','Une palabras de documentos, compras y trabajo.','Une estas palabras de la lista de la compra.'][i],options:rows.map(w=>w[1]),pairs:rows.map(w=>w[2]),sources:rows.map(source),explanation:rows.map(w=>`${w[1]}: ${w[2]}`).join('; ')+'.'})
  }
  return questions
}
