import assert from 'node:assert/strict'
import {readFile,writeFile} from 'node:fs/promises'
const reviewed=JSON.parse(await readFile('supabase/seed-data/suizamente-reviewed.json','utf8'))
const additions=JSON.parse(await readFile('supabase/seed-data/suizamente-language-exercises.json','utf8'))
const bank=[...new Map([...reviewed,...additions].map(q=>[q.id,q])).values()]
// The reviewed choice prompts with a quoted expression teach actual vocabulary.
// Course registration and general language-policy questions stay in practice.
const choices=bank.filter(q=>q.status==='published'&&q.category==='idioma'&&(!q.game_type||q.game_type==='choice')&&q.prompt.includes('«')).map(q=>q.id)
assert.ok(choices.length>=43)
const helper=`CREATE OR REPLACE FUNCTION suizamente_private.is_language_exercise(p jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT coalesce(p->>'category'='idioma' AND (
    p->>'game_type' IN ('match','order','image') OR p->>'id' IN (${choices.map(id=>`'${id}'`).join(',')})
  ),false)
$$;`
let game=(await readFile('supabase/suizamente_game.sql','utf8')).replaceAll('\r\n','\n')
const previous=/CREATE OR REPLACE FUNCTION suizamente_private\.is_language_exercise\(p jsonb\)[\s\S]*?\${1,2};/
game=previous.test(game)?game.replace(previous,()=>helper):game.replace('CREATE OR REPLACE FUNCTION suizamente_private.game_start(',()=>`${helper}\n\nCREATE OR REPLACE FUNCTION suizamente_private.game_start(`)
await writeFile('supabase/suizamente_game.sql',game)
function definition(name){
  const start=game.indexOf(`CREATE OR REPLACE FUNCTION suizamente_private.${name}(`),end=game.indexOf('$$;',start)
  assert.ok(start>=0&&end>start,name);return game.slice(start,end+3)
}
const names=['is_language_exercise','game_start','game_practice']
await writeFile('supabase/suizamente_actualizacion_idiomas_15.sql',`-- Suizamente 15: idiomas en etapas, práctica libre y tests de cima.
-- Ejecutar completo DESPUÉS de la revisión 14. No vuelve a importar preguntas.
-- Repetible: conserva partidas asignadas, XP, mochila, racha, etapas e intentos.
BEGIN;
${names.map(definition).join('\n\n')}
REVOKE ALL ON FUNCTION suizamente_private.is_language_exercise(jsonb),suizamente_private.game_start(jsonb),suizamente_private.game_practice(jsonb) FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
`)
console.log('Language selector: one per stage, 2/2/3/3/4 per summit, no typing, existing language XP rules preserved.')
