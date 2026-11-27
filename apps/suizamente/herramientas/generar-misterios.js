// Portable in the reference (CommonJS) and independent app (ES modules).
;(async()=>{
 const fs=await import('node:fs/promises'),path=await import('node:path')
 const root=path.resolve(path.dirname(process.argv[1]),'..'),errors=[],dates=new Set(),misterios=[]
 const cantons=new Set('ZH BE LU UR SZ OW NW GL ZG FR SO BS BL SH AR AI SG GR AG TG TI VD VS NE GE JU'.split(' '))
 const source=await fs.readFile(path.join(root,'fuentes/misterios.txt'),'utf8')
 let geometry
 for(const [index,line] of source.split(/\r?\n/).entries()){
  if(!line.trim()||line.trim().startsWith('#'))continue
  try{
   const c=line.split('|').map(s=>s.trim());if(c.length!==12)throw Error('Se necesitan 12 campos')
   const [fecha,tipo,pregunta,imagen,...rest]=c,pistas=rest.slice(0,3),opciones=rest.slice(3,7),dato=rest[7]
   const parsed=new Date(fecha+'T12:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(fecha)||!Number.isFinite(+parsed)||parsed.toISOString().slice(0,10)!==fecha)throw Error('Fecha no válida')
   if(dates.has(fecha))throw Error('Fecha repetida');dates.add(fecha)
   if(!['monumento','silueta','palabra','personaje','tradicion'].includes(tipo))throw Error('Tipo no válido')
   if(imagen!=='-'&&!cantons.has(imagen))throw Error('Imagen no válida')
   const check=(text,max)=>{if(!text||text.length>max||/[<>\x00-\x1f\x7f]/.test(text))throw Error('Texto vacío, demasiado largo o no permitido')}
   check(pregunta,180);pistas.forEach(t=>check(t,180));opciones.forEach(t=>check(t.replace(/^\*/,''),100));check(dato,500)
   if(opciones.filter(t=>t.startsWith('*')).length!==1)throw Error('Tiene que haber una sola correcta')
   const labels=opciones.map(t=>t.replace(/^\*/,''));if(new Set(labels.map(t=>t.toLocaleLowerCase('es'))).size!==4)throw Error('Opciones repetidas')
   let silueta=null
   if(imagen!=='-'){
    if(!geometry){try{geometry=JSON.parse(await fs.readFile(path.join(root,'data/mapa3d.json'),'utf8'))}catch{geometry=JSON.parse(await fs.readFile(path.join(root,'public/suizamente-assets/mapa3d.json'),'utf8'))}}
    const canton=geometry.cantones[imagen],bounds=canton.b,scale=100/Math.max(bounds[2]-bounds[0],bounds[3]-bounds[1])
    // No canton code, name, original coordinates or SVG IDs are sent to the client.
    silueta={viewBox:'-2 -2 104 104',trazos:canton.tierra.map(p=>p.map(r=>r.map(([x,y],i)=>(i?'L':'M')+((x-bounds[0])*scale).toFixed(3)+' '+((y-bounds[1])*scale).toFixed(3)).join(' ')+' Z').join(' '))}
   }
   misterios.push({fecha,tipo,pregunta,imagen:imagen==='-'?null:imagen,silueta,pistas,opciones:labels,correcta:opciones.findIndex(t=>t.startsWith('*')),dato})
  }catch(e){errors.push('Línea '+(index+1)+': '+e.message)}
 }
 if(errors.length){console.error(errors.join('\n'));process.exitCode=1;return}
 misterios.sort((a,b)=>a.fecha.localeCompare(b.fecha))
 if(process.argv.includes('--escribir')){
  const data=JSON.stringify({version:1,misterios},null,2)+'\n';await fs.mkdir(path.join(root,'data'),{recursive:true});await fs.writeFile(path.join(root,'data/misterios.json'),data)
  try{await fs.access(path.join(root,'server/suizamente/data'));await fs.writeFile(path.join(root,'server/suizamente/data/misterios.json'),data)}catch{/* Reference folder has no server. */}
 }
 console.log('Misterios validados: '+misterios.length+(process.argv.includes('--escribir')?' · escrito':' · sin escribir'))
})().catch(e=>{console.error(e.message);process.exitCode=1})
