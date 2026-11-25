import {useLayoutEffect,useRef,useState} from 'react'
import {useSv} from './Context'
import {LatidoBackdrop,StampBar} from './Shared'
import './sealProgress.css'

const memory=new Set()
export function sealMotionSeen(owner,key){try{return memory.has(owner+':'+key)||JSON.parse(localStorage.getItem('suizamente:sellos-vistos:'+owner)||'[]').includes(key)}catch{return memory.has(owner+':'+key)}}
function claim(owner,key){
 const id=owner+':'+key,store='suizamente:sellos-vistos:'+owner
 if(memory.has(id))return false
 let seen=[]
 try{seen=JSON.parse(localStorage.getItem(store)||'[]');if(seen.includes(key)){memory.add(id);return false}}catch{/* Presentation only. */}
 memory.add(id)
 try{localStorage.setItem(store,JSON.stringify([...seen,key]))}catch{/* Keep the receipt in memory when storage is unavailable. */}
 return true
}
export function useSealMotion(key,eligible){
 const {player,reduced}=useSv(),[active,setActive]=useState(null),owner=player?.jugador_id
 useLayoutEffect(()=>{setActive(owner&&eligible&&claim(owner,key)&&!reduced?key:null)},[owner,key,eligible,reduced])
 return active===key&&!reduced
}
export function ResultStampBar({value,max,animate}){
 return <div className={'sv-seal-progress'+(animate?' is-new':'')+(animate&&value===max?' is-full':'')}><StampBar value={value} max={max}/></div>
}
export function SealChoice({match,config,animate,onChoose,onDuel,busy,error,onRetry}){
 const title=useRef(null)
 useLayoutEffect(()=>{title.current?.focus({preventScroll:true})},[])
 return <section className={'sv-screen sv-themed-screen sv-game-seal sv-seal-choice'+(animate?' seal-enter':'')}><LatidoBackdrop tint="#FEEDD1"/>
  <header className="sv-seal-heading"><span className="sv-seal-hero" aria-hidden="true"><i/>🛂</span><h1 ref={title} tabIndex={-1} className="sv-wheel-status">¡Juega por un sello!</h1><p>Elige categoría. Si aciertas, el sello es tuyo.</p></header>
  <div className="sv-stamp-choice">{config.categorias.map((c,i)=>{const owned=match.tusSellos.includes(c.id);return <button key={c.id} className={owned?'owned':''} disabled={busy||owned} style={{'--category':c.color,'--tint':c.tinte,'--seal-delay':(.55+i*.08)+'s'}} onClick={()=>onChoose(c.id)}><span className="sv-seal-badge" aria-hidden="true">{c.emoji}</span><b>{c.nombre}</b><small>{owned?'✓ Ya es tuyo':'Jugar ›'}</small></button>})}</div>
  <div className="sv-seal-or"><i/>o bien<i/></div>
  <button className="sv-duel-invite sv-seal-duel" disabled={busy||!match.dueloDisponible} onClick={onDuel}><span aria-hidden="true">⚔️</span><span><b>Duelo de sellos</b><small>{match.dueloDisponible?'Quítale un sello a '+match.rival?.apodo+': '+config.duelo.preguntas+' preguntas, gana quien acierte más':'Hace falta un sello que no tengas y uno tuyo que no tenga'}</small></span><span aria-hidden="true">›</span></button>
  {error&&<p className="sv-error" role="alert">{error} <button className="sv-text-button" onClick={onRetry}>Reintentar</button></p>}
 </section>
}
