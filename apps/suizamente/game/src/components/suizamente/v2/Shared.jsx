import {Icono,IconText,UiIcon,Sello} from './Icono'
import {useEffect,useRef,useState} from 'react'
import {createPortal} from 'react-dom'
import {Link,useNavigate} from 'react-router-dom'
import {useSv} from './Context'
import {warmDestination} from './preload'
export {LatidoBackdrop} from './LatidoBackdrop'
export {MatchWheel} from './MatchWheel'

export function Logo({size=38}){return <img className="sv-logo" src="/suizamente-assets/logo-suizamente.svg" width={size} alt="Suizamente"/>}
export function Brand(){return <span className="sv-brand"><span>Suiza</span><span>mente</span></span>}
export function Button({children,onClick,to,tone='',disabled=false,...props}){
  return to?<Link className={'sv-button '+tone} to={to} onPointerEnter={()=>warmDestination(to)} onFocus={()=>warmDestination(to)} onPointerDown={()=>warmDestination(to)} {...props}><IconText>{children}</IconText></Link>:<button type="button" className={'sv-button '+tone} onClick={onClick} disabled={disabled} {...props}><IconText>{children}</IconText></button>
}
export function Avatar({id,name='',color='menta',level,marco,photo}){
  const {player,avatarUrl,avatars={}}=useSv(),pid=id||null,own=!!pid&&pid===player?.jugador_id,frame=marco||(own?player.marco:null),image=photo||(own?player.ajustes?.foto_url:null)||avatars[pid]||(own?avatarUrl:null),[failed,setFailed]=useState(null),[loaded,setLoaded]=useState(null)
  const safe=typeof image==='string'&&/^(https:\/\/|data:image\/jpeg;base64,)/.test(image)
  return <span className={'sv-avatar '+color} style={frame?{outline:'3px solid '+frame.colores.at(-1),outlineOffset:3}:undefined} aria-label={level?'Nivel '+level:undefined}>{safe&&failed!==image?<>{loaded!==image&&<i className="sv-avatar-loading" aria-hidden="true"/>}<img className={loaded===image?'sv-image-ready':'sv-image-pending'} src={image} alt="" decoding="async" referrerPolicy="no-referrer" onLoad={()=>setLoaded(image)} onError={()=>setFailed(image)}/></>:name==='🔍'?name:name.slice(0,1).toUpperCase()}{level&&<small>{level}</small>}</span>
}
export function Header({title,subtitle,back='/suizamente',right,close=false}){
  const navigate=useNavigate()
  return <header className="sv-header"><button type="button" className="sv-icon-button" onClick={()=>window.history.state?.idx>0?navigate(-1):navigate(back,{replace:true})} aria-label="Volver">{close?'×':'←'}</button>{subtitle?<div className="sv-header-heading"><h1><IconText>{title}</IconText></h1><p>{subtitle}</p></div>:<h1><IconText>{title}</IconText></h1>}{right||<span className="sv-icon-space"/>}</header>
}
export function Card({children,className='',...props}){return <div className={'sv-card '+className} {...props}>{children}</div>}
export function Chip({children,...props}){return <span className="sv-chip" {...props}><IconText>{children}</IconText></span>}
export function Wallet(){const {player}=useSv();return <Link className="sv-chip sv-coins" to="/suizamente/tienda" aria-label={player.monedas+' monedas. Abrir Tienda'}><Icono nombre="moneda"/> {player.monedas}</Link>}
export function Earnings({value}){return value&&(value.monedas>0||value.xp>0)?<div className="sv-chips sv-earnings">{value.monedas>0&&<Chip role="img" aria-label={'+'+value.monedas+' monedas'}><Icono nombre="moneda"/> +{value.monedas}</Chip>}{value.xp>0&&<Chip role="img" aria-label={'+'+value.xp+' XP'}><Icono nombre="xp"/> +{value.xp} XP</Chip>}</div>:null}
export function Stamps({categories,owned=[],large=false,freshIds=[]}){
  const previous=useRef(owned),[fresh,setFresh]=useState([]),key=owned.join(',')
  useEffect(()=>{setFresh(owned.filter(id=>!previous.current.includes(id)));previous.current=owned;const timer=setTimeout(()=>setFresh([]),400);return()=>clearTimeout(timer)},[key])
  return <div className={'sv-stamps'+(large?' large':'')}>{categories.map(c=><span key={c.id} className={(owned.includes(c.id)?'owned ':'')+(fresh.includes(c.id)||freshIds.includes(c.id)?'just-stamped':'')} style={{'--category':c.color,'--tint':c.tinte}} role="img" aria-label={'Sello de '+c.nombre+': '+(owned.includes(c.id)?'conseguido':'falta')} title={c.nombre}><Sello categoria={c.id} conseguido={owned.includes(c.id)} size="100%"/></span>)}</div>
}
export function StampBar({value,max=3}){
  return <div className="sv-stamp-bar" role="progressbar" aria-label="Barra de sello" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}><span aria-hidden="true"><Icono nombre="pasaporte"/></span><div>{Array.from({length:max},(_,i)=><i key={i} className={i<value?'filled':''}/>)}</div><b>{value}/{max}</b></div>
}
export function Wheel({categories,rotation=0,spinning=false,duration=2700,onSpin,disabled=false}){
  const slots=[...categories,{id:'sello',color:'var(--sv-card)'}]
  const n=slots.length
  const point=(r,a)=>[150+r*Math.sin(a*Math.PI/180),150-r*Math.cos(a*Math.PI/180)]
  return <div className="sv-wheel" role={onSpin?'group':'img'} aria-label="Ruleta de seis categorías y sello"><div className="sv-pointer"/><svg aria-hidden="true" onClick={()=>{if(!disabled&&!spinning)onSpin?.()}} viewBox="0 0 300 300" style={{transform:'rotate('+rotation+'deg)',transition:spinning?'transform '+duration+'ms cubic-bezier(.15,.75,.2,1)':'none'}}>{slots.map((c,i)=>{
    const a=point(145,(i-.5)*360/n),b=point(145,(i+.5)*360/n),label=point(104,i*360/n)
    return <g key={c.id}><path d={'M150 150 L'+a.join(' ')+' A145 145 0 0 1 '+b.join(' ')+' Z'} fill={c.color} stroke="white" strokeWidth="3"/><Icono nombre={c.id==='sello'?'pasaporte':'sello-'+c.id} x={label[0]-17.55} y={label[1]-17.55} size={35.1}/></g>
  })}</svg>{onSpin?<button className="sv-wheel-logo sv-wheel-spin" onClick={onSpin} disabled={disabled} aria-label="Girar la ruleta"><Logo size={32}/><b>{spinning?'…':'GIRAR'}</b></button>:<div className="sv-wheel-logo"><Logo size={38}/></div>}</div>
}
export function Navigation({waiting=0,enabled=['mapa','album','inicio','tienda','amigos'],active='inicio'}){
  const tabs=[['mapa','🗺️','Mapa'],['album','🃏','Álbum'],['inicio','','Inicio'],['tienda','🛒','Tienda'],['amigos','👥','Amigos']]
  const warm=id=>{if(id!==active)warmDestination('/suizamente/'+id)}
  return <nav className="sv-nav" aria-label="Navegación principal"><div className="sv-nav-pill">{tabs.map(([id,emoji,label],i)=><span key={id} style={{gridColumn:i+1}}>{enabled.includes(id)&&<Link to={'/suizamente'+(id==='inicio'?'':'/'+id)} onPointerEnter={()=>warm(id)} onPointerDown={()=>warm(id)} onFocus={()=>warm(id)} aria-label={label} aria-current={id===active?'page':undefined}><span className={'sv-nav-icon '+(id==='inicio'?'home':'')}>{emoji?<UiIcon value={emoji}/>:<span className="sv-nav-logo"><Logo size={30}/></span>} {!!waiting&&id==='inicio'&&<b aria-label={waiting+' partidas te esperan'}>{waiting}</b>}</span><span className="sv-nav-label">{label}</span></Link>}</span>)}</div></nav>
}
export function Sheet({title,children,onClose,contentTitle=false,centered=false,footerClose=true,hero,className=''}){
  const dialog=useRef(null),previous=useRef(document.activeElement),close=useRef(onClose)
  const drag=useRef(null)
  close.current=onClose
  useEffect(()=>{
    const node=dialog.current
    const overflow=document.body.style.overflow;document.body.style.overflow='hidden'
    node?.focus()
    const key=e=>{
      if(e.key==='Escape'){e.preventDefault();close.current()}
      if(e.key==='Tab'){
        const all=[...node.querySelectorAll('button,a,input,textarea,select,[tabindex="0"]')].filter(x=>!x.disabled)
        if(!all.length){e.preventDefault();return}
        const first=all[0],last=all[all.length-1]
        if(e.shiftKey&&(document.activeElement===first||document.activeElement===node)){e.preventDefault();last.focus()}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
      }
    }
    node?.addEventListener('keydown',key)
    const prior=previous.current
    return()=>{node?.removeEventListener('keydown',key);document.body.style.overflow=overflow;prior?.focus()}
  },[])
  return createPortal(<div className={'sv-sheet-backdrop'+(centered?' sv-centered-backdrop':'')} onClick={onClose}><section className={'sv-sheet '+className} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={dialog} onClick={e=>e.stopPropagation()}><div className="sv-sheet-handle" onPointerDown={e=>{drag.current=e.clientY;e.currentTarget.setPointerCapture(e.pointerId)}} onPointerUp={e=>{if(drag.current!==null&&e.clientY-drag.current>60)onClose();drag.current=null}}/>{hero&&<div className="sv-sheet-hero" aria-hidden="true">{hero}</div>}<h2 data-sz-content={contentTitle||undefined}>{contentTitle?title:<IconText>{title}</IconText>}</h2>{children}{footerClose&&<Button tone="quiet" onClick={onClose}>Cerrar</Button>}</section></div>,document.body)
}
