
import { Link } from 'react-router-dom'
import { szLevel } from '../../lib/suizamente'
import LatidoCard from './v2/LatidoCards'

import ICON_PATHS from '../../data/suizamenteIconPaths.json'
import '../../pages/Suizamente.css'

const mountains=[
  {id:5,path:'M262 96L290 68L306 46L314 16L321 18L330 44L348 64L360 74V96Z',snow:'M314 16L309 30L314 27L318 32L324 28L321 18Z',x:317,y:16},
  {id:4,path:'M206 96L236 66L262 30L270 36L292 58L318 96Z',snow:'M262 30L255 41L261 38L265 43L270 36Z',x:264,y:30},
  {id:3,path:'M136 96L156 70L166 74L178 50L186 58L196 38L204 52L214 44L228 62L252 96Z',snow:'M196 38L191 48L196 45L200 49L202 46Z',x:196,y:38},
  {id:2,path:'M66 96L94 68L110 62L126 52L144 50L162 60L190 96Z',x:140,y:50},
  {id:1,path:'M0 96C22 76 42 62 64 60C88 58 106 72 128 96Z',x:66,y:30},
]
export function SuizamenteMark({small=false}) {
  return <svg className={`sz-mark${small?' sz-mark--small':''}`} viewBox="3 1.5 58 58" aria-hidden="true"><path d="M12.74 30.99L7.10 28.94" stroke="#00a89c" strokeWidth="5" strokeLinecap="round"/><path d="M20.24 21.21L16.80 16.29" stroke="#fc9c0c" strokeWidth="5" strokeLinecap="round"/><path d="M32 18.5V12.5" stroke="#fc3c3c" strokeWidth="5" strokeLinecap="round"/><path d="M43.76 21.21L47.20 16.29" stroke="#486cf0" strokeWidth="5" strokeLinecap="round"/><path d="M51.26 30.99L56.90 28.94" stroke="#18ccf0" strokeWidth="5" strokeLinecap="round"/><rect x="19" y="25" width="26" height="26" rx="5.72" fill="#ef4444"/><path d="M29.46 29.88h5.07v5.59h5.59v5.07h-5.59v5.59h-5.07v-5.59h-5.59v-5.07h5.59Z" fill="#fff"/></svg>
}
export function SwissFlag(){
  return <svg className="sz-swiss-flag" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="#ef4444"/><path d="M13 6.5H19V13H25.5V19H19V25.5H13V19H6.5V13H13Z" fill="white"/></svg>
}
export function MountainIcon({level=1,compact=false,muted=false}) {
  const item=mountains.find(m=>m.id===level)||mountains[4]
  const compactBounds={1:'0 15 120 57',2:'0 30 120 42',3:'0 20 120 52',4:'0 14 120 58',5:'0 8 120 64'}
  const softColors={1:'#93dfc6',2:'#8fdeec',3:'#9db9f6',4:'#fad391',5:'#f8abab'},color=muted?softColors[item.id]:szLevel(level).color
  return <svg viewBox={compact?compactBounds[item.id]:'0 0 120 72'} style={{color}} preserveAspectRatio={compact?'xMidYMax meet':'xMidYMid meet'} className="sz-mountain-icon" aria-hidden="true">{ICON_PATHS[item.id].map(({tag:Tag,props},i)=><Tag key={i} {...props}/>)}</svg>
}
export function CheckIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}
export function ReviewIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12a7 7 0 0 1 12-4.9M19 12a7 7 0 0 1-12 4.9" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"/><path d="M17.5 3.5v4h-4M6.5 20.5v-4h4" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
export function MountainSky({level=1,all=false}) {
  const current=mountains.find(m=>m.id===level)||mountains[4]
  return <div className="sz-sky" style={{'--sz-level':szLevel(level).color}}><svg viewBox="0 0 360 96" role="img" aria-label={`Tu recorrido de montañas. Nivel actual: ${szLevel(level).name}`}>
    {mountains.map(item=><g key={item.id} opacity={all||item.id<=level?1:.48}><path d={item.path} fill={szLevel(item.id).color}/>{item.snow&&<path d={item.snow} fill="white"/>}{item.id===1&&<><path d="M66 60V36M61 43h10M62 50h8" stroke={szLevel(1).color} strokeWidth="3" strokeLinecap="round"/><circle cx="66" cy="33" r="3.5" fill={szLevel(1).color}/></>}</g>)}
  </svg>{!all&&<span className="sz-pin" style={{left:`${current.x/3.6}%`,top:`${current.y/0.96}%`}}>Tú</span>}</div>
}
export function ProgressBar({percent=0,level=1,label}) {
  return <div className="sz-bar" role="progressbar" aria-label={label||'Progreso al siguiente nivel'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{width:`${percent}%`,background:szLevel(level).color}}/></div>
}
export default function SuizamenteEntry({surface='home'}) {
  return <LatidoCard surface={surface}/>
}
