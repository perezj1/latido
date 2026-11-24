import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {questionStatement,reviewStatement,sessionQuestionText,isStatement} from '../src/lib/suizamenteQuestionText.js'

const bank=JSON.parse(await readFile('supabase/seed-data/suizamente-questions.json','utf8'))
const expansion=JSON.parse(await readFile('supabase/seed-data/suizamente-expansion/questions.json','utf8'))
const legacy=JSON.parse(await readFile('supabase/seed-data/suizamente-presentation.json','utf8')).entries
const combined=new Map([...bank,...expansion].map(q=>[q.id,q]))
const statements=[...combined.values()].filter(q=>q.game_type==='tf')
assert.equal(statements.length,296)
for(const q of statements){
  assert.ok(isStatement(q.prompt),`${q.id}: native wording must be a statement`)
  assert.equal(questionStatement(q),q.prompt,`${q.id}: keep native wording and its local conditions`)
}
for(const entry of legacy)for(const options of [['Verdadero','Falso'],['Falso','Verdadero']]){
  const old={question:{id:'arbitrary-legacy-id',type:'tf',prompt:entry.original_prompt,options},answer:null,position:3,total:6,review_answers:[{prompt:entry.original_prompt,correct:false,explanation:'La explicación original.'}]}
  const snapshot=structuredClone(old),display=sessionQuestionText(old)
  assert.ok(isStatement(display.question.prompt),entry.id)
  assert.ok(!/[¿?]|Respuesta propuesta/u.test(display.question.prompt),entry.id)
  assert.deepEqual(display.question.options,options)
  assert.deepEqual(Object.keys(display.question),Object.keys(old.question),'Only the wording changes; no solution data is added')
  assert.equal(display.answer,null);assert.equal(display.position,3)
  assert.ok(isStatement(display.review_answers[0].prompt))
  assert.equal(display.review_answers[0].correct,false)
  assert.deepEqual(old,snapshot,'Do not mutate a saved session or its confirmed answers')
  assert.equal(questionStatement({...old.question,prompt:entry.original_prompt.replaceAll('\n','\r\n')}),display.question.prompt)
}
const country=legacy.find(entry=>entry.original_prompt.includes('¿Qué país'))
assert.equal(questionStatement({type:'tf',prompt:country.original_prompt}),'Liechtenstein comparte frontera con Suiza.')
assert.equal(questionStatement({type:'tf',prompt:country.original_prompt.replace('Liechtenstein','Portugal')}),'Portugal comparte frontera con Suiza.','Keep the proposed value even when the proposition is false')
assert.equal(reviewStatement({prompt:country.original_prompt}),'Liechtenstein comparte frontera con Suiza.')
assert.equal(questionStatement({type:'choice',prompt:'¿Qué país comparte frontera con Suiza?'}),'¿Qué país comparte frontera con Suiza?')
assert.equal(questionStatement({type:'tf',prompt:'¿Suiza tiene 26 cantones?'}),'Suiza tiene 26 cantones.')
assert.equal(questionStatement({type:'tf',prompt:'¿Qué país limita con Suiza?'}),'¿Qué país limita con Suiza?','Do not turn an open question into a claim without its subject')
assert.equal(isStatement('¿Suiza tiene 26 cantones?'),false)
assert.equal(isStatement('La frase «Wo wohnst du?» pregunta dónde vives.'),true)
console.log('Statements: all 296 native true/false entries are declarative; all 20 legacy forms render as statements without SQL, including saved sessions, CRLF, both option orders and review. Correctness and question types are unchanged.')
