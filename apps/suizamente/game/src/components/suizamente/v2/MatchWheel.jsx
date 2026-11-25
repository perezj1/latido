import {useEffect,useRef,useState} from 'react'
import {useSv} from './Context'
import {Icono,Sello} from './Icono'

// Presentation only: target is the slot returned by the existing spin endpoint.
export function MatchWheel({categories,value,max,spinning,run,target,duration,onSpin,onComplete,disabled,yourTurn,rival}){
 const {reduced}=useSv(),slots=[...categories,{id:'sello',color:'#FFFFFF',nombre:'Sello'}],n=slots.length
 const targetIndex=slots.findIndex(c=>c.id===target),[light,setLight]=useState(-1),[settled,setSettled]=useState(false),last=useRef(n-1),complete=useRef(onComplete)
 complete.current=onComplete
 useEffect(()=>{
  if(!spinning){if(targetIndex>=0){setLight(targetIndex);last.current=targetIndex}return}
  if(targetIndex<0)return
  let cancelled=false;const timers=[],schedule=(fn,ms)=>timers.push(setTimeout(()=>{if(!cancelled)fn()},ms))
  setSettled(false)
  const finish=()=>{setLight(targetIndex);last.current=targetIndex;setSettled(true);complete.current?.()}
  if(reduced){setLight(targetIndex);setSettled(true);schedule(finish,0)}
  else{
   const from=last.current,steps=n*3+(targetIndex-from+n)%n,blink=Math.min(140,duration*.05),hold=Math.min(250,duration*.09),travel=Math.max(0,duration-4*blink-hold)
   const weights=Array.from({length:steps},(_,i)=>35+260*Math.pow((i+1)/steps,2.6)),sum=weights.reduce((a,b)=>a+b,0)
   let elapsed=0
   weights.forEach((weight,i)=>{schedule(()=>setLight((from+i+1)%n),travel*elapsed/sum);elapsed+=weight})
   for(let i=0;i<4;i++)schedule(()=>{setLight(i%2?targetIndex:-1);if(i===3)setSettled(true)},travel+(i+1)*blink)
   schedule(finish,duration)
  }
  return()=>{cancelled=true;timers.forEach(clearTimeout)}
 },[run,spinning,targetIndex,duration,reduced,n])
 const cx=190,cy=242,rr=170,r=200,step=360/n,start=-90-(n-1)*step
 const point=(angle,radius)=>[cx+radius*Math.cos(angle*Math.PI/180),cy+radius*Math.sin(angle*Math.PI/180)].map(x=>+x.toFixed(2))
 const sector=i=>{const a=start+i*step-step/2,p=point(a,rr),q=point(a+step,rr);return 'M'+cx+' '+cy+'L'+p.join(' ')+'A'+rr+' '+rr+' 0 0 1 '+q.join(' ')+'Z'}
 const arc=(a,b)=>'M'+point(a,r).join(' ')+'A'+r+' '+r+' 0 0 1 '+point(b,r).join(' ')
 const selected=slots[targetIndex],status=!yourTurn?<><Icono nombre="tiempo"/> Le toca a {rival||'tu rival'} · te avisamos</>:spinning&&!settled?'…':selected&&light===targetIndex?(target==='sello'?<><Icono nombre="pasaporte"/> ¡Sello! Elige categoría</>:<><Sello categoria={selected.id} conseguido/> ¡{selected.nombre}!</>):'¡Te toca! Toca GIRAR'
 return <div className="sv-match-wheel"><div className="sv-wheel sv-light-wheel" data-light={light} data-target={target||''}>
  <svg viewBox="0 0 380 434" onClick={()=>{if(yourTurn&&!disabled&&!spinning)onSpin()}}>
   <g role="img" aria-label={'Barra de sello: '+value+' de '+max+' aciertos'}>
    <path d={arc(-128,-52)} transform="translate(0 3)" stroke="rgba(15,26,43,0.10)" strokeWidth="22" strokeLinecap="round" fill="none"/>
    <path d={arc(-128,-52)} stroke="#FFFFFF" strokeWidth="22" strokeLinecap="round" fill="none"/>
    {Array.from({length:max},(_,i)=><path key={i} d={arc(-126+i*72/max+2.2,-126+(i+1)*72/max-2.2)} stroke={i<value?'#F9A719':'#E4E8EF'} strokeWidth="12" strokeLinecap="round" fill="none"/>)}
    <circle cx="190" cy="22" r="19" fill="#FFFFFF" stroke="#F9A719" strokeWidth="2.5"/><Icono nombre="pasaporte" x={178.6} y={11.6} size={22.8}/>
   </g>
   <circle cx={cx} cy={cy+6} r="184" fill="rgba(15,26,43,0.10)"/><circle cx={cx} cy={cy} r="184" fill="#FFFFFF"/>
   <g data-ruleta role="img" aria-label={'Ruleta: Sello, '+categories.map(c=>c.nombre).join(', ')}>
    {slots.map((c,i)=>{const a=start+i*step,[x,y]=point(a,116),[bx,by]=point(a,177),size=c.id==='sello'?43.2:48.6;return <g key={c.id} data-slot={c.id}><path d={sector(i)} fill={c.color} stroke="#FFFFFF" strokeWidth="3"/><g transform={'rotate('+(a+90).toFixed(2)+' '+x+' '+y+')'}>{c.id==='sello'?<Icono nombre="pasaporte" x={x-size/2} y={y-size/2} size={size}/>:<Sello categoria={c.id} conseguido x={x-size/2} y={y-size/2} size={size}/>}</g><circle cx={bx} cy={by} r="3.6" fill="#E4E8EF"/></g>})}
    {slots.map((c,i)=>{const [x,y]=point(start+i*step,177);return <g key={c.id} data-luz={i} style={{opacity:light===i?1:0,transition:reduced?'none':'opacity .08s'}}><path d={sector(i)} fill="rgba(255,255,255,0.32)" stroke="rgba(255,255,255,0.6)" strokeWidth="12" strokeLinejoin="round"/><path d={sector(i)} fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinejoin="round"/><circle cx={x} cy={y} r="3.6" fill="#F9A719"/></g>})}
   </g>
  </svg>
  {yourTurn?<button className="sv-wheel-center" aria-label="Girar la ruleta" disabled={disabled||spinning} onClick={onSpin}><span>GIRAR</span></button>:<span className="sv-wheel-center" role="img" aria-label={'Le toca a '+(rival||'tu rival')}><span><img src="/suizamente-assets/logo-suizamente.svg" width="44" height="44" alt=""/></span></span>}
 </div><p className="sv-wheel-status" data-ruleta-texto role="status" aria-live="polite">{status}</p></div>
}
