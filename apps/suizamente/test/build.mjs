import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'

const read=file=>readFile(file,'utf8')
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const root=await read('dist/index.html')
assert.match(root,/<title>Suizamente/)
assert.match(root,/<link rel="canonical" href="https:\/\/suizamente\.latido\.ch\/">/)
assert.match(root,/<meta name="robots" content="index, follow">/)
assert.equal(root.includes('__SITE_URL__'),false)
assert.match(root,/<html lang="es" data-theme="light">/)
const manifest=JSON.parse(await read('dist/manifest.webmanifest'))
assert.equal(hash(await readFile('dist/videos/install-ios.mp4')),hash(await readFile('../../public/videos/install-ios.mp4')))
for(const size of [128,192,512])assert.equal(hash(await readFile(`dist/suizamente/icons/suizamente-circle-logo-${size}.png`)),hash(await readFile(`../../public/suizamente/icons/suizamente-circle-logo-${size}.png`)))
for(const size of [72,96,128,192,512]){
  const icon=manifest.icons.find(icon=>icon.sizes===`${size}x${size}`&&icon.purpose==='maskable')
  assert.ok(icon,`Missing supplied maskable icon: ${size}`)
  assert.equal(hash(await readFile('dist'+icon.src)),hash(await readFile(`../../public/suizamente/icons/suizamente-logo-${size}.png`)))
}
assert.equal(hash(await readFile('dist/icons/apple-touch-icon.png')),hash(await readFile('../../public/suizamente/icons/suizamente-logo-192.png')))
for(const size of [72,96]){
  assert.ok(root.includes(`rel="icon" href="/icons/favicon-circle-${size}.png"`))
  assert.equal(hash(await readFile(`dist/icons/favicon-circle-${size}.png`)),hash(await readFile(`../../public/suizamente/icons/suizamente-circle-logo-${size}.png`)))
}
for (const route of ['conquista','conquista/tienda','conquista/batallas','conquista/coleccion','conquista/retar','onboarding','cuenta','auth/callback','auth/restablecer','retos','ranking','libreta','perfil','perfil/editar','amigos','medallas','ajustes','proponer','moderacion','avisos','jugar']) {
  const html=await read(`dist/${route}/index.html`)
  assert.ok(html.includes('class="startup"'),'Missing startup animation: '+route)
  assert.ok(html.includes('class="page boot"'),'Text fallback must remain hidden when JS runs: '+route)
  assert.equal(html.includes('Abriendo tu cuenta'),false)
  assert.match(html,/<meta name="robots" content="noindex, nofollow">/)
  assert.match(html,/<meta name="referrer" content="no-referrer">/)
  assert.match(html,new RegExp('href="https://suizamente.latido.ch/'+route+'"'))
}
for (const file of ['conquista.js','conquista.css','conquista/mapa.json','logo.svg','juego.js','juego.html','votos.js','fonts.css','data/preguntas.json','experiencia.js','experiencia.css','experiencia-datos.js','historia.js']) {
  assert.equal(hash(await readFile('dist/suizamente/'+file)),hash(await readFile('../../public/suizamente/'+file)),`Shared source drift: ${file}`)
}
for(const file of ['experiencia.js','juego.js','historia.js'])assert.doesNotMatch(await read('dist/suizamente/'+file),/perfiles ficticios|Datos de demostración|No son cuentas ni actividad real|Ver la clasificación real|NO SON VOTOS REALES/i)
const sitemap=await read('dist/sitemap.xml')
assert.match(sitemap,/<loc>https:\/\/suizamente.latido.ch\/instalar<\/loc>/)
assert.doesNotMatch(sitemap,/cuenta|auth\//)
const worker=await read('dist/sw.js')
assert.equal(worker.includes('__BUILD_ID__'),false)
assert.doesNotMatch(worker,/access_token|refresh_token|Authorization|localStorage/)
const vercel=JSON.parse(await read('vercel.json'))
for (const source of ['/conquista(.*)','/onboarding(.*)','/cuenta(.*)','/auth/(.*)','/retos(.*)','/ranking(.*)','/libreta(.*)','/perfil(.*)','/amigos(.*)','/medallas(.*)','/ajustes(.*)','/proponer(.*)','/moderacion(.*)','/avisos(.*)','/jugar(.*)','/duelo(.*)']) {
  const headers=vercel.headers.find(rule=>rule.source===source).headers
  assert.equal(headers.find(h=>h.key==='Cache-Control').value,'no-store')
  assert.match(headers.find(h=>h.key==='X-Robots-Tag').value,/noindex/)
}
const conquest=await read('dist/conquista.html')
assert.match(conquest,/<meta name="robots" content="noindex, nofollow">/)
for(const part of ['canton','partida','batalla'])assert.ok(vercel.rewrites.some(rule=>rule.source.startsWith('/conquista/'+part+'/')&&rule.destination==='/conquista.html'))
const duel=await read('dist/duelo.html')
assert.match(duel,/<meta name="robots" content="noindex, nofollow">/)
for(const route of ['bienvenida','como-se-juega']) {
 const html=await read(`dist/${route}/index.html`)
 assert.match(html,/<meta name="robots" content="index, follow">/)
 assert.doesNotMatch(html,/<title>Tu cuenta|<h1>Instalar/)
}
assert.equal(vercel.rewrites.some(rule=>rule.source.includes('(.*)')),false)
// Check actual locally configured server secrets without printing any values.
const localEnv=await read('../../.env.local').catch(()=>'')
const secrets=[...localEnv.matchAll(/^(?:SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|SUPABASE_DB_PASSWORD)\s*=\s*["']?([^\r\n"']+)/gm)].map(match=>match[1].trim()).filter(Boolean)
async function scan(directory) {
  for (const entry of await readdir(directory,{withFileTypes:true})) {
    const file=path.join(directory,entry.name)
    if (entry.isDirectory()) await scan(file)
    else if (/\.(js|html|json|css|xml|txt|webmanifest)$/.test(file)) {
      const text=await read(file)
      for (const secret of secrets) assert.equal(text.includes(secret),false,'A private credential was included in the build')
      for (const token of text.matchAll(/eyJ[\w-]+\.([\w-]+)\.[\w-]+/g)) {
        let role
        try {role=JSON.parse(Buffer.from(token[1],'base64url').toString()).role} catch {continue}
        assert.notEqual(role,'service_role','Privileged JWT included in browser output')
      }
      assert.doesNotMatch(text,/sb_secret_[a-zA-Z0-9_-]{10,}/)
    }
  }
}
await scan('dist')
for(const file of ['dist/suizamente/conquista.js','dist/suizamente/conquista/mapa.json']){const content=await read(file);assert.doesNotMatch(content,/cq-2026-[A-Z]{2}-\d{3}/,'Protected question IDs leaked into public assets')}
assert.equal((await readdir('dist/suizamente/conquista')).includes('preguntas.json'),false)
console.log('PASS: independent production artifacts, exact shared sources, private SEO/headers, sitemap, versioned SW and absence of server secrets.')
