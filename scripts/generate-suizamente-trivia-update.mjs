import assert from 'node:assert/strict'
import {access,readFile,writeFile} from 'node:fs/promises'
try{
  await access('supabase/suizamente_revision_completa.sql')
  console.log('Release 13 is frozen. Use node scripts/generate-suizamente-complete-review.mjs for the current bank.')
  process.exit(0)
}catch(error){if(error.code!=='ENOENT')throw error}
const game=(await readFile('supabase/suizamente_game.sql','utf8')).replaceAll('\r\n','\n')
const core=(await readFile('supabase/suizamente.sql','utf8')).replaceAll('\r\n','\n')
const {catalog}=JSON.parse(await readFile('supabase/seed-data/suizamente-trivia.json','utf8'))
function definition(source,name){
  const a=source.indexOf(`CREATE OR REPLACE FUNCTION suizamente_private.${name}(`),b=source.indexOf('$$;',a)
  assert.ok(a>=0&&b>a,name);return source.slice(a,b+3)
}
const ddl=game.slice(game.indexOf('CREATE TABLE IF NOT EXISTS suizamente_private.trivia_catalog('),game.indexOf('CREATE OR REPLACE FUNCTION suizamente_private.mountain('))
const data=JSON.stringify(catalog);assert.ok(!data.includes('$trivia$'))
const functions=[...['write_question','admin_action','start_session','session_view'].map(n=>definition(core,n)),...['mountain','game_prompt','game_start','game_view'].map(n=>definition(game,n))].join('\n')
const sql=`-- Suizamente 13: trivial de Suiza y selección cultural del recorrido.
-- Ejecutar después de los SQL de preguntas ya instalados, antes de las preguntas 13.
-- Repetible: no reinicia progreso, sesiones, versiones, premios ni intentos.
-- El catálogo no publica preguntas ni cambia sus soluciones; conserva sus IDs.
BEGIN;
${ddl}
INSERT INTO suizamente_private.trivia_catalog(question_id,topic,national,original_prompt,prompt)
SELECT id,topic,national,original_prompt,prompt FROM jsonb_to_recordset($trivia$${data}$trivia$::jsonb)
AS x(id text,topic text,national boolean,original_prompt text,prompt text)
ON CONFLICT(question_id) DO UPDATE SET topic=excluded.topic,national=excluded.national,original_prompt=excluded.original_prompt,prompt=excluded.prompt;
${functions}
REVOKE ALL ON FUNCTION suizamente_private.write_question(jsonb),suizamente_private.admin_action(jsonb),suizamente_private.start_session(jsonb),suizamente_private.session_view(uuid),suizamente_private.mountain(integer),suizamente_private.game_prompt(jsonb),suizamente_private.game_start(jsonb),suizamente_private.game_view(uuid) FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
`
await writeFile('supabase/suizamente_actualizacion_trivial_13.sql',sql)
console.log(`Trivia update: ${catalog.length} entries; safe server selectors and presentation; SQL only.`)
