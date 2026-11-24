import {readFile,writeFile} from 'node:fs/promises'

function definition(sql,name){
  const start=sql.indexOf(`CREATE OR REPLACE FUNCTION suizamente_private.${name}(`)
  if(start<0)throw Error(`Missing ${name}`)
  const end=sql.indexOf('$$;',start)
  if(end<0)throw Error(`Unterminated ${name}`)
  return sql.slice(start,end+3)
}
const core=await readFile('supabase/suizamente.sql','utf8'),game=await readFile('supabase/suizamente_game.sql','utf8')
const sql=`-- Suizamente: actualización incremental de jugabilidad e ilustraciones.
-- Para instalaciones que ya ejecutaron los SQL anteriores del juego.
-- Ejecutar ANTES de los nuevos lotes cantonales. No reinicializa datos ni RLS.
BEGIN;
${definition(core,'write_question')}
${definition(core,'admin_action')}
${definition(game,'game_start')}
REVOKE ALL ON FUNCTION suizamente_private.write_question(jsonb),
  suizamente_private.admin_action(jsonb),suizamente_private.game_start(jsonb)
  FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
`
const output=process.argv.find(a=>a.startsWith('--output='))?.slice('--output='.length)||'supabase/suizamente_actualizacion_jugabilidad.sql'
if(!/^supabase\/suizamente_[a-z0-9_]+\.sql$/.test(output))throw Error('Expected a Suizamente SQL filename under supabase/')
await writeFile(output,sql,'utf8')
console.log(`${output}: incremental SQL generated locally; no remote database connection.`)
