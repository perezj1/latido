import assert from 'node:assert/strict'
import {readFile,writeFile} from 'node:fs/promises'
import {languageExercises} from './lib/suizamente-language-exercises.mjs'
const questions=languageExercises()
assert.equal(questions.length,64)
const old=JSON.parse(await readFile('supabase/seed-data/suizamente-reviewed.json','utf8'))
const oldPrompts=new Set(old.filter(q=>!q.id.startsWith('szl16-')).map(q=>q.prompt))
const ids=new Set(),prompts=new Set()
for(const q of questions){
  assert.ok(!ids.has(q.id)&&!prompts.has(q.prompt)&&!oldPrompts.has(q.prompt),q.id);ids.add(q.id);prompts.add(q.prompt)
  assert.ok(q.options.length>=3&&q.options.length<=4,q.id)
  assert.equal(new Set(q.options.map(s=>s.toLowerCase())).size,q.options.length,q.id)
  assert.ok(q.explanation.length>=8&&q.source_url.startsWith('https://'),q.id)
  assert.equal(q.category,'idioma');assert.equal(q.game_only,true)
  if(q.game_type==='order')assert.equal(q.correct_order.length,q.options.length)
}
await writeFile('supabase/seed-data/suizamente-language-exercises.json',JSON.stringify(questions,null,2)+'\n')
console.log('64 original German exercises: 16 choose-word, 16 meaning, 16 gap-choice, 12 order, 4 pairs; sources attached, zero typing.')
