import assert from 'node:assert/strict'
import {mkdtemp,mkdir,readFile,writeFile,copyFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {spawnSync} from 'node:child_process'
const root=await mkdtemp(join(tmpdir(),'suizamente-misterios-')),checks=[]
try{
 await mkdir(join(root,'herramientas'));await mkdir(join(root,'fuentes'));await mkdir(join(root,'data'))
 await copyFile('herramientas/generar-misterios.js',join(root,'herramientas/generar-misterios.js'));await copyFile('public/suizamente-assets/mapa3d.json',join(root,'data/mapa3d.json'))
 const publishedSource=await readFile('fuentes/misterios.txt','utf8'),source=publishedSource.split(/\r?\n/).filter(l=>!l.trim()||l.trim().startsWith('#')).join('\n'),line=source.split(/\r?\n/).find(l=>l.startsWith('# FECHA |')).slice(2).replace('FECHA','2026-11-27'),fields=line.split('|').map(s=>s.trim())
 const run=async(text,args=[])=>{await writeFile(join(root,'fuentes/misterios.txt'),text);return spawnSync(process.execPath,[join(root,'herramientas/generar-misterios.js'),...args],{encoding:'utf8'})}
 assert.equal((await run(source)).status,0);assert.equal((await run(line,['--escribir'])).status,0);const file=join(root,'data/misterios.json'),valid=await readFile(file,'utf8');assert.equal(JSON.parse(valid).misterios.length,1)
 const cases=[f=>f.slice(1),f=>{f[0]='2026-02-30';return f},f=>{f[1]='inventado';return f},f=>{f[2]='x'.repeat(181);return f},f=>{f[3]='XXX';return f},f=>{f[4]='';return f},f=>{f[7]=f[7].replace(/^\*/,'');return f},f=>{f[8]='*'+f[8];return f},f=>{f[8]=f[7].replace(/^\*/,'');return f},f=>{f[11]='<script>';return f}]
 for(const change of cases){const invalid=change([...fields]).join(' | '),r=await run(invalid,['--escribir']);assert.notEqual(r.status,0,r.stdout);assert.equal(await readFile(file,'utf8'),valid,'Invalid input cannot overwrite the approved output')}
 assert.notEqual((await run(line+'\n'+line)).status,0);checks.push('Fields, real dates, duplicate dates, supported types/images, text limits, unique options, one correct option and atomic validation before writing')
 const silhouette=[...fields];silhouette[1]='silueta';silhouette[3]='LU';assert.equal((await run(silhouette.join(' | '),['--escribir'])).status,0);const image=JSON.parse(await readFile(file,'utf8')).misterios[0].silueta;assert.equal(image.viewBox,'-2 -2 104 104');assert.ok(image.trazos.length);assert.ok(!JSON.stringify(image).includes('LU'));checks.push('Anonymous silhouette geometry has no answer-bearing canton identifier')
 assert.equal((await run(source,['--escribir'])).status,0);assert.deepEqual(JSON.parse(await readFile(file,'utf8')).misterios,[]);const published=JSON.parse(await readFile('server/suizamente/data/misterios.json','utf8')).misterios;assert.deepEqual(published.map(m=>m.fecha),publishedSource.split(/\r?\n/).filter(l=>l.trim()&&!l.trim().startsWith('#')).map(l=>l.split('|')[0].trim()));assert.ok(published.every(m=>m.pistas.every(p=>!p.includes('pendiente de Latido'))));assert.equal((await run(publishedSource,['--escribir'])).status,0);assert.deepEqual(JSON.parse(await readFile(file,'utf8')).misterios,published);assert.deepEqual(JSON.parse(await readFile('data/misterios.json','utf8')).misterios,published);checks.push('Only approved dated records are published; the incomplete design example remains commented')
 const result=spawnSync(process.execPath,[resolve('herramientas/generar-misterios.js')],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);console.log(JSON.stringify({checks},null,2))
}finally{await rm(root,{recursive:true,force:true})}
