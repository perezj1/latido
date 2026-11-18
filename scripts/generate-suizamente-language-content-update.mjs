import assert from 'node:assert/strict'
import {readFile,writeFile} from 'node:fs/promises'
const read=p=>readFile(p,'utf8')
const questions=JSON.parse(await read('supabase/seed-data/suizamente-language-exercises.json'))
const selectors=(await read('supabase/suizamente_actualizacion_idiomas_15.sql')).replace(/^BEGIN;\s*$/m,'').replace(/^COMMIT;\s*$/m,'').replace(/^NOTIFY pgrst.*$/m,'')
const full=await read('supabase/suizamente_revision_completa.sql')
const start=full.indexOf('CREATE OR REPLACE FUNCTION suizamente_private.import_review_14('),end=full.indexOf('END $review_helper$;',start)
assert.ok(start>=0&&end>start)
const importer=full.slice(start,end+'END $review_helper$;'.length)
const items=JSON.stringify(questions.map(question=>({question,known:[]})))
assert.ok(!items.includes('$language16$'))
const sql=`-- Suizamente 16: 64 ejercicios originales de alemán cotidiano.
-- Ejecutar tras la revisión 14. Incluye el selector 15 actualizado con idiomas en cimas.
-- Repetible: conserva preguntas propias, versiones, partidas, progreso, XP y premios.
BEGIN;
${selectors}
${importer}
REVOKE ALL ON FUNCTION suizamente_private.import_review_14(jsonb,jsonb) FROM PUBLIC,anon,authenticated;
SELECT result,count(*) AS questions,array_agg(id ORDER BY id) FILTER(WHERE result LIKE 'skipped_%') AS omitted_ids
FROM suizamente_private.import_review_14($language16$${items}$language16$::jsonb,'[]'::jsonb) GROUP BY result ORDER BY result;
NOTIFY pgrst,'reload schema';
COMMIT;
`
assert.ok(Buffer.byteLength(sql)<200000)
await writeFile('supabase/suizamente_actualizacion_idiomas_16.sql',sql)
console.log(`Language 16: ${questions.length} exercises, ${Math.ceil(Buffer.byteLength(sql)/1024)} KiB; includes selector and safe private import, no temporary tables.`)
