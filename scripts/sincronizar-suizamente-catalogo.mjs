import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const read = path => readFile(new URL(path, root), 'utf8')
const data = JSON.parse(await read('public/suizamente/data/preguntas.json'))
const base = JSON.parse(await read('data/suizamente/fuentes/base.json'))
const byId = new Map(data.preguntas.map(q => [q.id, q]))
assert.equal(byId.size, data.preguntas.length, 'Hay identificadores repetidos')
const stable = ({ dato,emoji,opciones,...question })=>question
for(const original of base.preguntas){const next=byId.get(original.id);assert.deepEqual(stable(next),stable(original));assert.deepEqual(next.opciones.slice(0,original.opciones.length),original.opciones)}
const catalog = Object.fromEntries(data.preguntas.map(q => {
  assert.match(q.id, /^[a-z0-9_]+$/)
  assert.ok(q.opciones.length >= 2 && q.opciones.length <= 4)
  return [q.id, q.opciones.length]
}))
const previous = JSON.parse(await read('supabase/functions/_shared/suizamenteCatalogo.json'))
for (const [id, options] of Object.entries(previous)) {
  if (catalog[id] !== undefined) assert.ok(catalog[id]===options||options===3&&catalog[id]===4, `El número de opciones de ${id} ha cambiado`)
}
const values = Object.entries(catalog).map(([id, options]) => `('${id}', ${options})`).join(',\n')
const seed = `INSERT INTO public.suizamente_catalogo_votos(pregunta_id, opciones) VALUES\n${values}\nON CONFLICT (pregunta_id) DO NOTHING;`
const install = await read('supabase/suizamente_votos.sql')
const pattern = /INSERT INTO public\.suizamente_catalogo_votos\(pregunta_id, opciones\) VALUES[\s\S]*?ON CONFLICT \(pregunta_id\) DO NOTHING;/
assert.match(install, pattern)
await writeFile(new URL('supabase/suizamente_votos.sql', root), install.replace(pattern, seed))
await writeFile(new URL('supabase/functions/_shared/suizamenteCatalogo.json', root), JSON.stringify(catalog, null, 2) + '\n')
const update = `-- Actualización aditiva del catálogo de Suizamente. No modifica votos ni preguntas existentes.
-- Generado por npm run suizamente:catalogo desde el banco publicado.
BEGIN;
ALTER TABLE public.suizamente_catalogo_votos DROP CONSTRAINT IF EXISTS suizamente_catalogo_votos_opciones_check;
ALTER TABLE public.suizamente_catalogo_votos ADD CONSTRAINT suizamente_catalogo_votos_opciones_check CHECK (opciones BETWEEN 2 AND 4);
ALTER TABLE public.suizamente_votos DROP CONSTRAINT IF EXISTS suizamente_votos_opcion_check;
ALTER TABLE public.suizamente_votos ADD CONSTRAINT suizamente_votos_opcion_check CHECK (opcion BETWEEN 0 AND 3);
CREATE TEMP TABLE suizamente_catalogo_import (
  pregunta_id text PRIMARY KEY,
  opciones smallint NOT NULL CHECK (opciones BETWEEN 2 AND 4)
) ON COMMIT DROP;
INSERT INTO suizamente_catalogo_import(pregunta_id, opciones) VALUES
${values};
DO $suizamente_catalogo$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.suizamente_catalogo_votos existente
    JOIN suizamente_catalogo_import nuevo USING (pregunta_id)
    WHERE existente.opciones <> nuevo.opciones AND NOT(existente.opciones=3 AND nuevo.opciones=4)
  ) THEN
    RAISE EXCEPTION 'El catálogo existente tiene opciones distintas. Actualización cancelada para proteger los votos.';
  END IF;
END;
$suizamente_catalogo$;
INSERT INTO public.suizamente_catalogo_votos(pregunta_id, opciones)
SELECT pregunta_id, opciones FROM suizamente_catalogo_import
ON CONFLICT (pregunta_id) DO UPDATE SET opciones=excluded.opciones;
COMMIT;
SELECT count(*) AS preguntas_registradas FROM public.suizamente_catalogo_votos;
`
await writeFile(new URL('supabase/suizamente_actualizar_catalogo.sql', root), update)
console.log(`Catálogo sincronizado: ${byId.size} preguntas; se conservan las preguntas y los índices publicados.`)
