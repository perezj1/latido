import assert from 'node:assert/strict'
import {readFile,writeFile} from 'node:fs/promises'

const presentation=JSON.parse(await readFile('supabase/seed-data/suizamente-presentation.json','utf8'))
const bank=JSON.parse(await readFile('supabase/seed-data/suizamente-questions.json','utf8'))
const quote=value=>`'${value.replaceAll("'","''")}'`
for(const entry of presentation.entries){
  const question=bank.find(q=>q.id===entry.id)
  assert.equal(question?.game_type,'tf')
  assert.ok([entry.original_prompt,entry.prompt].includes(question.prompt),'Source must keep the same reviewed statement or its legacy wording')
  assert.ok(entry.prompt.endsWith('.')&&!/[¿?]|Respuesta propuesta/.test(entry.prompt))
}
const rows=presentation.entries.map(entry=>`(${['id','original_prompt','prompt'].map(k=>quote(entry[k])).join(',')})`).join(',\n    ')
const prompt=`CREATE OR REPLACE FUNCTION suizamente_private.game_prompt(p jsonb) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT coalesce((SELECT e.statement FROM (VALUES
    ${rows}
  ) AS e(id,original,statement) WHERE btrim(regexp_replace(e.original,'[[:space:]]+',' ','g'))=btrim(regexp_replace(p->>'prompt','[[:space:]]+',' ','g')) AND p->>'game_type'='tf'),p->>'prompt')
$$;`
let game=(await readFile('supabase/suizamente_game.sql','utf8')).replaceAll('\r\n','\n')
// Release 12 predates the private trivia catalogue. Never downgrade canonical
// functions or add a dependency on release 13 when regenerating this old patch.
if(game.includes('CREATE TABLE IF NOT EXISTS suizamente_private.trivia_catalog(')){
  assert.ok((await readFile('supabase/suizamente_actualizacion_experiencia_12.sql','utf8')).includes(prompt))
  console.log('Release 12 preserved; canonical schema now includes trivia release 13.')
  process.exit(0)
}
function definition(name){
  const start=game.indexOf(`CREATE OR REPLACE FUNCTION suizamente_private.${name}(`),end=game.indexOf('$$;',start)
  assert.ok(start>=0&&end>start)
  return game.slice(start,end+3)
}
game=game.replace(definition('game_prompt'),()=>prompt)
await writeFile('supabase/suizamente_game.sql',game,'utf8')
const sql=`-- Suizamente 12: enunciados directos y corrección estructurada de parejas.
-- Ejecutar una vez en una instalación con el juego existente. Es repetible.
-- No reimporta preguntas ni modifica versiones, XP, etapas, intentos o RLS.
BEGIN;
${prompt}
${definition('game_view')}
REVOKE ALL ON FUNCTION suizamente_private.game_prompt(jsonb),suizamente_private.game_view(uuid) FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
`
await writeFile('supabase/suizamente_actualizacion_experiencia_12.sql',sql,'utf8')
console.log(`Experience update: ${presentation.entries.length} explicit editorial statements; answer-only pair solutions. Local SQL only.`)
