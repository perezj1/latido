import {useLayoutEffect,useRef} from 'react'
import {Link} from 'react-router-dom'
import {useSv} from './Context'
import {IconText,Icono} from './Icono'
import {Avatar} from './Shared'
import {timeLeft} from '../../../lib/suizamenteV2'

export function HomeBadge({to,onClick,label,image,tint,chip,name,alert,green,disabled}){
 const props={className:'sv-home-access','aria-label':label,style:{'--access-tint':tint}}
 const content=<><span className="sv-home-access-icon" aria-hidden="true">{image}</span>{alert&&<i aria-hidden="true">{alert}</i>}<span className={'sv-home-access-chip'+(green?' green':'')} aria-hidden="true"><IconText>{chip}</IconText></span><span className="sv-home-access-name" aria-hidden="true">{name}</span></>
 return to?<Link {...props} to={to}>{content}</Link>:<button {...props} onClick={onClick} disabled={disabled}>{content}</button>
}
export function HomeRow({label,children}){
 const row=useRef(null),drag=useRef(null),moved=useRef(false),{reduced}=useSv()
 useLayoutEffect(()=>{row.current.scrollLeft=0},[label])
 function end(e){
  if(!drag.current)return
  drag.current=null;row.current.style.scrollSnapType=''
  if(row.current.hasPointerCapture(e.pointerId))row.current.releasePointerCapture(e.pointerId)
  const base=row.current.children[0]?.offsetLeft||0,positions=[...row.current.children].map(n=>n.offsetLeft-base),left=row.current.scrollLeft
  row.current.scrollTo({left:positions.reduce((best,x)=>Math.abs(x-left)<Math.abs(best-left)?x:best,0),behavior:reduced?'instant':'smooth'})
 }
 return <div ref={row} className="sv-home-carousel-row" role="list" aria-label={label}
  onPointerDown={e=>{if(e.pointerType!=='mouse'||e.button!==0)return;drag.current={x:e.clientX,left:row.current.scrollLeft};moved.current=false}}
  onPointerMove={e=>{if(!drag.current)return;const delta=e.clientX-drag.current.x;if(Math.abs(delta)>4){moved.current=true;row.current.setPointerCapture(e.pointerId);row.current.style.scrollSnapType='none';row.current.scrollLeft=drag.current.left-delta}}}
  onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} onDragStart={e=>e.preventDefault()} onClickCapture={e=>{if(moved.current){e.preventDefault();e.stopPropagation();moved.current=false}}}
  onFocusCapture={e=>{const item=e.target.closest('[role=listitem]');if(item)row.current.scrollTo({left:item.offsetLeft-row.current.children[0].offsetLeft,behavior:'instant'})}}>{children}</div>
}
export function HomeAction({to,onClick,icon,children,label}){
 const props={role:'listitem',className:'sv-home-action '+icon,'aria-label':label}
 const content=<><Icono nombre={icon} size={36}/><b>{children}</b></>
 return to?<Link {...props} to={to}>{content}</Link>:<button {...props} onClick={onClick}>{content}</button>
}
export function HomeMatch({match:m,mine,sealText}){
 const left=timeLeft(m.plazo,Date.parse(m.servidorAhora)),name=m.rival?.apodo||'Buscando rival…'
 return <Link role="listitem" className={'sv-home-match '+(mine?'sv-home-turn':'sv-home-wait')} to={'/suizamente/partida/'+m.id} aria-label={mine?'Te toca contra '+name+', '+m.tusSellos.length+' a '+m.susSellos.length+'. '+sealText+'. Quedan '+left+'. Jugar':m.rival?'Turno de '+name+', '+m.tusSellos.length+' a '+m.susSellos.length+'. Le quedan '+left:'Partida pendiente: buscando rival'}>
  <span className="sv-home-rival"><Avatar id={m.rival?.id} name={m.rival?.apodo||'?'} color={m.rival?.color}/>{m.rival?.online&&<i aria-label="En línea"/>}</span><span className="sv-home-score">{m.tusSellos.length} – {m.susSellos.length}</span><b>{name}</b><span className="sv-home-match-foot" aria-hidden="true">{mine?'▶︎ Tu turno':<><Icono nombre="tiempo" size={14}/><span>Su turno · {left}</span></>}</span>
 </Link>
}
