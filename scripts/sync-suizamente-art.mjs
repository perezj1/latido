import {readFile,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
import {IMG,ART_LABELS} from '../src/components/suizamente/questionArt.js'
assert.deepEqual(Object.keys(IMG).sort(),Object.keys(ART_LABELS).sort())
assert.ok(Object.keys(IMG).every(key=>/^[a-z0-9-]+$/.test(key)))
const file=new URL('../supabase/suizamente.sql',import.meta.url),sql=await readFile(file,'utf8')
let replacements=0
const keys=Object.keys(IMG).sort().map(key=>`'${key}'`).join(',')
const next=sql.replace(/(IF (?:p \? 'image_key' AND p->>'image_key'|p->>'game_type'='image' AND coalesce\(p->>'image_key',''\)) NOT IN )\([^\n]+?\)( THEN RAISE EXCEPTION 'SZ_INVALID_QUESTION'; END IF;)/g,(_,a,b)=>{replacements++;return `${a}(${keys})${b}`})
assert.equal(replacements,2,'Update only the two image allowlist guards')
await writeFile(file,next)
console.log(`Image catalogue: ${Object.keys(IMG).length} illustrations; editor and server keys agree.`)
