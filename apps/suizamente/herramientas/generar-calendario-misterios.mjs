// Editorial adaptation of the existing Latido bank. No network or runtime AI.
// The game bank and every published option order remain untouched.
import {readFile,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
const bank=JSON.parse(await readFile('server/suizamente/data/preguntas.json','utf8')).preguntas
const config=JSON.parse(await readFile('server/suizamente/data/juego.json','utf8'))
const source=await readFile('fuentes/misterios.txt','utf8'),start='2026-11-29',days=365
const real=bank.filter(q=>q.tipo==='real'),quoted=s=>s.match(/«([^»]+)»/)?.[1]
const fit=s=>{if(s.length<=180)return s;const sentence=s.match(/^(.{1,179}[.!?])(?:\s|$)/)?.[1];if(sentence)return sentence;throw Error('Edit this clue before publishing: '+s)}
const hide=(text,term)=>text.replaceAll(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'),'[…]')
const initial=word=>'Empieza por «'+[...word.replace(/^(El|La|Los|Las|Un|Una) /,'')][0]+'».'
const item=(q,tipo,pregunta,pistas,opciones=q.opciones.map(o=>o.t),correcta=q.correcta,imagen='-')=>({origen:q.id,tipo,pregunta,pistas:pistas.map(fit),opciones,correcta,dato:q.dato,imagen})
const groups=[]
groups.push(real.filter(q=>q.id.startsWith('voc_')).map(q=>{
 const term=quoted(q.pregunta),context=q.pregunta.split(', ¿')[0],meaning=q.opciones[q.correcta].t
 const tradition=['Bénichon','Rabadan','Chalandamarz','Schwingen','Alpabzug','Torrée'].includes(term)
 return item(q,tradition?'tradicion':'palabra',tradition?'¿Qué significa el nombre de esta tradición?':'¿Qué significa esta expresión?',[context+'.','La expresión es «'+term+'».',initial(meaning)])
}))
groups.push(real.filter(q=>q.id.startsWith('vocr_')).map(q=>{
 const meaning=quoted(q.pregunta),term=q.opciones[q.correcta].t,context=q.pregunta.split('»')[1].replace(/\?$/,'').trim()
 return item(q,'palabra','¿Qué palabra o expresión buscamos?',['Se usa '+context+'.','Significa «'+meaning+'».',fit(hide(q.dato,term))])
}))
const people=real.filter(q=>q.id.startsWith('per_')),names=new Map(people.map(q=>[q.opciones[q.correcta].t,q.pregunta.replace(/^¿Quién (?:fue|es) /,'').replace(/\?$/,'')]))
groups.push(people.map(q=>{const name=names.get(q.opciones[q.correcta].t);return item(q,'personaje','¿Qué personaje es?',[q.opciones[q.correcta].t+'.',hide(q.dato,name),initial(name)],q.opciones.map(o=>{const n=names.get(o.t);if(!n)throw Error('Unknown approved person '+o.t);return n}))}))
const places=real.filter(q=>q.id.startsWith('ciu_')),town=q=>q.pregunta.replace(/^¿En qué cantón está /,'').replace(/\?$/,'')
const choices=(answer,pool,index)=>{const others=[...new Set(pool)].filter(s=>s!==answer);const list=[others[index%others.length],others[(index+1)%others.length],others[(index+2)%others.length]];list.splice(index%4,0,answer);return list}
groups.push(places.map((q,i)=>{const name=town(q);return item(q,'palabra','¿Qué lugar de Suiza buscamos?',[hide(q.dato,name),'Está en el cantón de '+q.opciones[q.correcta].t+'.',initial(name)],choices(name,places.map(town),i),i%4)}))
const capitals=real.filter(q=>q.id.startsWith('cap_'))
groups.push(capitals.map(q=>item(q,'palabra','¿Qué capital cantonal buscamos?',[hide(q.dato,q.opciones[q.correcta].t),'Es la capital del cantón de '+q.pregunta.replace(/^¿Cuál es la capital del cantón de /,'').replace(/\?$/,'')+'.',initial(q.opciones[q.correcta].t)])))
groups.push(real.filter(q=>q.id.startsWith('inv_')).map(q=>item(q,'palabra','¿Qué invento o creación buscamos?',['Su historia está relacionada con Suiza.',hide(q.dato,q.opciones[q.correcta].t.replace(/^(El|La|Los|Las) /,'')),initial(q.opciones[q.correcta].t)])))
const cantons=config.mapa.regiones.flatMap(r=>r.cantones.map(c=>({...c,region:r.nombre})))
groups.push(cantons.map((c,i)=>{
 const q=capitals.find(q=>q.pregunta.includes('de '+c.nombre+'?'))||places.find(q=>q.opciones[q.correcta].t===c.nombre)
 const labels=choices(c.nombre,cantons.map(c=>c.nombre),i)
 const capital=capitals.find(q=>q.pregunta.includes('de '+c.nombre+'?'))
 return {origen:'mapa:'+c.id+(q?' / '+q.id:''),tipo:'silueta',pregunta:'¿De qué cantón es esta silueta?',imagen:c.id,
  pistas:['Es el contorno de un cantón suizo.',capital?'Su capital es '+capital.opciones[capital.correcta].t+'.':'En el mapa del juego está en '+c.region+'.',initial(c.nombre)],
  opciones:labels,correcta:i%4,dato:q?q.dato:'En el mapa de Suizamente, '+c.nombre+' pertenece a la región '+c.region+'.'}
}))
// Alternate topics and language directions; don't schedule 191 vocabulary days in a row.
const pool=[];while(groups.some(g=>g.length))for(const g of groups)if(g.length)pool.push(g.shift())
if(pool.length<days)throw Error('Not enough distinct approved adaptations')
const records=pool.slice(0,days),lines=['# BEGIN CALENDARIO 2026-2027 · adaptación del banco existente, solicitada por Latido.']
const audit=[]
for(const [i,m]of records.entries()){
 const fecha=new Date(Date.parse(start+'T12:00:00Z')+i*86400000).toISOString().slice(0,10)
 const fields=[fecha,m.tipo,m.pregunta,m.imagen,...m.pistas,...m.opciones.map((s,n)=>(n===m.correcta?'*':'')+s),m.dato]
 if(fields.some(s=>!s||s.includes('|')||/[\r\n<>]/.test(s)))throw Error('Invalid source field '+m.origen)
 if(new Set(m.opciones.map(s=>s.toLocaleLowerCase('es'))).size!==4)throw Error('Repeated options '+m.origen)
 if(m.pistas.some(p=>p.length>180)||m.dato.length>500)throw Error('Text limit '+m.origen)
 lines.push('# Origen: '+m.origen,fields.join(' | '))
 audit.push({fecha,origen:m.origen,tipo:m.tipo,sha256:createHash('sha256').update(fields.join(' | ')).digest('hex')})
}
lines.push('# END CALENDARIO 2026-2027')
const block=lines.join('\n'),previous=source.match(/# BEGIN CALENDARIO 2026-2027[\s\S]*?# END CALENDARIO 2026-2027/)?.[0]
if(previous&&previous!==block)throw Error('Calendar already frozen. Create a new editorial batch; do not alter published days.')
if(process.argv.includes('--escribir')){
 if(!previous)await writeFile('fuentes/misterios.txt',source.trimEnd()+'\n\n'+block+'\n')
 await writeFile('fuentes/misterios-calendario-2026-2027.json',JSON.stringify({version:1,desde:start,hasta:audit.at(-1).fecha,entradas:audit},null,2)+'\n')
}
console.log(JSON.stringify({dias:records.length,desde:start,hasta:audit.at(-1).fecha,tipos:Object.fromEntries([...new Set(records.map(m=>m.tipo))].map(t=>[t,records.filter(m=>m.tipo===t).length])),escrito:process.argv.includes('--escribir')}))
