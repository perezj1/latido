import {CANTONES} from './experiencia-datos.js'

// Isolated, deterministic examples. No Auth accounts, database rows, votes,
// friendships, points or medals are created by this module.
export const DEMO={enabled:true,profiles:320,minVotes:20,minPlayers:20}
export const demoEnabled=()=>DEMO.enabled&&globalThis.SUIZAMENTE_DEMO!==false
const hash=value=>[...String(value)].reduce((n,c)=>(Math.imul(n,31)+c.codePointAt(0))>>>0,7)
export function repartoDemo(q,counts){
  const reales=q.opciones.map((_,i)=>Number(counts[i])||0),realTotal=reales.reduce((a,b)=>a+b,0)
  if(!demoEnabled()||realTotal>=DEMO.minVotes)return {n:reales,total:realTotal,realTotal,demo:false}
  const seed=hash(q.id),first=35+seed%31
  const n=q.opciones.length===2?[first*3+20,DEMO.profiles-(first*3+20)]:[80+seed%80,60+seed%50,0]
  if(n.length===3)n[2]=DEMO.profiles-n[0]-n[1]
  return {n,total:DEMO.profiles,realTotal,demo:true}
}
export function perfilesDemo(){
  const names=['Lucía','Diego','Carla','Pablo','María','Andrés','Sofía','Mateo','Valentina','Javier','Camila','Daniel','Elena','Gabriel','Isabel','Nicolás']
  const cantons=Object.keys(CANTONES)
  return Array.from({length:DEMO.profiles},(_,i)=>({id:'demo-'+i,apodo:names[i%names.length]+' '+String.fromCharCode(65+i%26)+'.',canton:cantons[i%cantons.length],puntos:110+(hash('perfil-'+i)%129)*5,demo:true})).sort((a,b)=>b.puntos-a.puntos).map((p,i)=>({...p,puesto:i+1}))
}
export function cantonesDemo(){
  const people=perfilesDemo()
  return Object.entries(CANTONES).map(([codigo,nombre])=>{
    const players=people.filter(p=>p.canton===codigo),puntos=players.reduce((sum,p)=>sum+p.puntos,0)
    return {codigo,nombre,activos:players.length,puntos,media:puntos/players.length}
  }).sort((a,b)=>b.media-a.media).map((c,i)=>({...c,puesto:i+1}))
}
