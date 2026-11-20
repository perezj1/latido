function lines(ctx,text,width){const result=[];let line='';for(const word of String(text).split(/\s+/)){const next=(line?line+' ':'')+word;if(line&&ctx.measureText(next).width>width){result.push(line);line=word}else line=next}if(line)result.push(line);return result}
export async function crearHistoria({titulo,subtitulo='',pregunta=null,conteos=[],eleccion=null,enlace='https://suizamente.latido.ch/'}) {
  await document.fonts.ready
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1920
  const ctx=canvas.getContext('2d');ctx.fillStyle='#0F1A2B';ctx.fillRect(0,0,1080,1920)
  ctx.fillStyle='#24E2C9';ctx.beginPath();ctx.arc(1050,100,300,0,Math.PI*2);ctx.fill()
  ctx.font='800 66px Poppins, sans-serif';ctx.fillStyle='#FA2F35';ctx.fillText('Suiza',78,150);const x=78+ctx.measureText('Suiza').width;ctx.fillStyle='#7797FF';ctx.fillText('mente',x,150)
  ctx.font='500 30px Poppins, sans-serif';ctx.fillStyle='#C3CFDD';ctx.fillText('Un juego de Latido.ch',80,205)
  let y=320;ctx.font='800 66px Poppins, sans-serif';ctx.fillStyle='#FFFFFF'
  for(const line of lines(ctx,titulo,910)){ctx.fillText(line,80,y);y+=82}
  ctx.font='500 32px Poppins, sans-serif';ctx.fillStyle='#C3CFDD'
  for(const line of lines(ctx,subtitulo,910)){ctx.fillText(line,80,y+20);y+=48}
  if(pregunta){
    y+=90;ctx.fillStyle='#FFFFFF';ctx.font='800 44px Poppins, sans-serif'
    for(const line of lines(ctx,pregunta.pregunta,910)){ctx.fillText(line,80,y);y+=59}
    y+=35;const total=conteos.reduce((a,b)=>a+b,0)
    pregunta.opciones.forEach((op,i)=>{
      ctx.fillStyle=eleccion===i?'#24E2C9':'#FFFFFF';ctx.font='700 32px Poppins, sans-serif'
      const labels=lines(ctx,op.e+' '+op.t,760)
      for(const label of labels){ctx.fillText(label,80,y);y+=43}
      ctx.font='800 40px Poppins, sans-serif';ctx.fillText(total?Math.round(100*(conteos[i]||0)/total)+'%':'—',890,y-45)
      ctx.fillStyle='#27354A';ctx.beginPath();ctx.roundRect(80,y+12,920,23,12);ctx.fill()
      ctx.fillStyle=eleccion===i?'#24E2C9':'#4A76EF';const width=total?920*(conteos[i]||0)/total:0
      if(width>0){ctx.beginPath();ctx.roundRect(80,y+12,width,23,Math.min(12,width/2));ctx.fill()}
      y+=100
    })
  }
  ctx.fillStyle='#24E2C9';ctx.font='800 45px Poppins, sans-serif';ctx.fillText('¿Y tú qué eliges?',80,1700)
  ctx.fillStyle='#FFFFFF';ctx.font='500 34px Poppins, sans-serif';ctx.fillText('suizamente.latido.ch',80,1760)
  return {blob:await new Promise(resolve=>canvas.toBlob(resolve,'image/png')),enlace}
}
export async function compartirHistoria(options) {
  const {blob,enlace}=await crearHistoria(options),file=new File([blob],'suizamente.png',{type:'image/png'})
  if(navigator.canShare?.({files:[file]})&&navigator.share){try{await navigator.share({files:[file],title:'Suizamente'});return 'Imagen compartida.'}catch(error){if(error.name==='AbortError')return ''}}
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='suizamente.png';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000)
  try{await navigator.clipboard.writeText(enlace);return 'Imagen descargada y enlace copiado.'}catch{return 'Imagen descargada.'}
}
