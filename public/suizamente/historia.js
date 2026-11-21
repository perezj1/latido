function lines(ctx,text,width){
  const result=[];let line=''
  for(const word of String(text).split(/\s+/)){
    const next=(line?line+' ':'')+word
    if(line&&ctx.measureText(next).width>width){result.push(line);line=''}
    if(ctx.measureText(word).width>width){let part='';for(const char of word){if(part&&ctx.measureText(part+char).width>width){result.push(part);part=''}part+=char}line=part}
    else line=(line?line+' ':'')+word
  }
  if(line)result.push(line);return result
}
let logoPromise
function officialLogo(){
  if(!logoPromise)logoPromise=new Promise(resolve=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>resolve(null);img.src='/suizamente/icons/suizamente-circle-logo-512.png'})
  return logoPromise
}
export async function crearHistoria({titulo,subtitulo='',pregunta=null,conteos=[],eleccion=null,enlace='https://suizamente.latido.ch/'}){
  await document.fonts.ready
  const logo=await officialLogo(),canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1920
  const ctx=canvas.getContext('2d'),ink='#0F1A2B',total=conteos.reduce((sum,n)=>sum+Number(n||0),0)
  const percent=total>1&&Number.isInteger(eleccion)?Math.round(100*(conteos[eleccion]||0)/total):null
  const title=pregunta?.tipo==='dilema'?(percent===null?'¿Piensas como yo?':'El '+percent+' % de los hispanohablantes en Suiza piensa lo mismo que yo'):titulo
  ctx.fillStyle='#4A76EF';ctx.fillRect(0,0,1080,1920)
  ctx.fillStyle='#FFFFFF';ctx.beginPath();ctx.roundRect(66,66,146,146,42);ctx.fill()
  if(logo)ctx.drawImage(logo,81,81,116,116)
  ctx.font='800 68px Poppins, sans-serif';ctx.fillText('Suizamente',244,159)
  let titleSize=78,titleLines
  do{ctx.font='800 '+titleSize+'px Poppins, sans-serif';titleLines=lines(ctx,title,920);if(titleLines.length<=5)break;titleSize-=4}while(titleSize>58)
  if(pregunta?.tipo==='dilema'&&percent!==null)titleLines=['El '+percent+' % de los','hispanohablantes en','Suiza piensa lo','mismo que yo']
  let y=340
  for(const line of titleLines){
    ctx.fillStyle='#FFFFFF'
    const token=percent===null?null:percent+' %',at=token?line.indexOf(token):-1
    if(at>=0){
      const prefix=line.slice(0,at),suffix=line.slice(at+token.length),x=80+ctx.measureText(prefix).width,w=ctx.measureText(token).width
      ctx.fillText(prefix,80,y);ctx.fillStyle='#24E2C9';ctx.beginPath();ctx.roundRect(x-6,y-titleSize*.88,w+14,titleSize*1.13,19);ctx.fill()
      ctx.fillStyle=ink;ctx.fillText(token,x,y);ctx.fillStyle='#FFFFFF';ctx.fillText(suffix,x+w,y)
    }else ctx.fillText(line,80,y)
    y+=titleSize*1.22
  }
  if(subtitulo&&!pregunta){
    y+=30;ctx.font='500 38px Poppins, sans-serif'
    for(const line of lines(ctx,subtitulo,920)){ctx.fillText(line,80,y);y+=54}
  }
  if(pregunta){
    const top=Math.max(720,y+55),available=1610-top
    let questionSize=45,optionSize=34,qLines,options,height
    do{
      ctx.font='800 '+questionSize+'px Poppins, sans-serif';qLines=lines(ctx,pregunta.pregunta,900)
      ctx.font='700 '+optionSize+'px Poppins, sans-serif';options=pregunta.opciones.map(op=>lines(ctx,op.t,745))
      height=84+qLines.length*questionSize*1.3+35+options.reduce((sum,row)=>sum+row.length*optionSize*1.35+67,0)
      if(height<=available||optionSize<=25)break
      questionSize-=2;optionSize-=2
    }while(true)
    ctx.save();ctx.translate(540,top+height/2);ctx.rotate(-.025);ctx.translate(-540,-top-height/2)
    ctx.fillStyle='#FFFFFF';ctx.beginPath();ctx.roundRect(56,top,968,height,62);ctx.fill()
    let cursor=top+62;ctx.fillStyle=ink;ctx.font='800 '+questionSize+'px Poppins, sans-serif'
    for(const line of qLines){ctx.fillText(line,94,cursor);cursor+=questionSize*1.3}
    cursor+=32
    options.forEach((labels,i)=>{
      const start=cursor;ctx.fillStyle=ink;ctx.font='700 '+optionSize+'px Poppins, sans-serif'
      for(const label of labels){ctx.fillText(label,94,cursor);cursor+=optionSize*1.35}
      ctx.textAlign='right';ctx.font='800 38px Poppins, sans-serif';ctx.fillText(total?Math.round(100*(conteos[i]||0)/total)+'%':'—',985,start);ctx.textAlign='left'
      ctx.fillStyle='#F0F3F8';ctx.beginPath();ctx.roundRect(94,cursor+5,890,24,12);ctx.fill()
      const width=total?890*(conteos[i]||0)/total:0
      if(width>0){ctx.fillStyle=['#4A76EF','#F9A719','#24BFE2'][i];ctx.beginPath();ctx.roundRect(94,cursor+5,width,24,Math.min(12,width/2));ctx.fill()}
      cursor+=67
    })
    ctx.restore()
  }
  ctx.save();ctx.translate(875,1725);ctx.rotate(-.65);ctx.fillStyle='#F9A719';ctx.beginPath();ctx.roundRect(-30,-75,60,150,30);ctx.fill();ctx.restore()
  ctx.fillStyle='#FA2F35';ctx.beginPath();ctx.roundRect(952,1600,60,155,30);ctx.fill()
  ctx.save();ctx.translate(650,1900);ctx.rotate(.35);ctx.fillStyle='#03AA98';ctx.beginPath();ctx.roundRect(-90,-28,180,56,28);ctx.fill();ctx.restore()
  ctx.fillStyle='#FFFFFF';ctx.font='800 52px Poppins, sans-serif';ctx.fillText('¿Y tú qué eliges? 🤔',78,1745)
  ctx.font='700 32px Poppins, sans-serif'
  ctx.fillText('suizamente.latido.ch',78,1815)
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'))
  if(!blob)throw new Error('Image unavailable')
  return {blob,enlace}
}
export async function compartirHistoria(options){
  const {blob,enlace}=options.historia||await crearHistoria(options),file=new File([blob],'suizamente.png',{type:'image/png'})
  if(!options.descargar&&navigator.canShare?.({files:[file]})&&navigator.share){try{await navigator.share({files:[file],title:'Suizamente',text:enlace});return 'Imagen compartida.'}catch(error){if(error.name==='AbortError')return ''}}
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='suizamente.png';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000)
  return options.descargar?'Imagen descargada.':'Imagen descargada. Adjúntala en WhatsApp, Instagram o la aplicación que prefieras.'
}
