import {createContext,useCallback,useContext,useEffect,useId,useRef,useState} from 'react'
import {createPortal} from 'react-dom'
import './moment.css'
import './share.css'

const MomentContext=createContext(null)
export const useMoment=()=>useContext(MomentContext)

// Receipts only remember presentations. They never change balances or game state.
function receipts(owner){try{const value=JSON.parse(localStorage.getItem('suizamente:momentos:'+owner)||'[]');return Array.isArray(value)?value:[]}catch{return []}}
export function momentSeen(owner,key){return receipts(owner).includes(key)}
export function rememberMoment(owner,key){try{localStorage.setItem('suizamente:momentos:'+owner,JSON.stringify([...new Set([...receipts(owner),key])]))}catch{/* The server still owns every reward. */}}

export function MomentProvider({children,reduced,owner}){
  const [queue,setQueue]=useState([]),pending=useRef(new Map()),alive=useRef(true),currentOwner=useRef(owner),sequence=useRef(0)
  currentOwner.current=owner
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;pending.current.forEach(item=>item.resolve(false));pending.current.clear()}},[])
  const show=useCallback((steps,{key,onFinish,persist=false}={})=>{
    if(!alive.current||currentOwner.current!==owner||!steps?.length||persist&&momentSeen(owner,key))return Promise.resolve(false)
    const pendingKey=String(owner)+'|'+key
    if(key&&pending.current.has(pendingKey))return pending.current.get(pendingKey).promise
    let resolve
    const promise=new Promise(done=>{resolve=done}),id=++sequence.current,item={steps,id,key,onFinish,persist,resolve,promise,owner,pendingKey:key?pendingKey:id}
    pending.current.set(item.pendingKey,item);setQueue(old=>[...old,item])
    return promise
  },[owner])
  const finish=useCallback(async item=>{
    await item.onFinish?.()
    if(item.persist)rememberMoment(item.owner,item.key)
    item.resolve(true);pending.current.delete(item.pendingKey)
    if(alive.current)setQueue(old=>old.filter(x=>x!==item))
  },[])
  // Changing accounts must not show the previous person's rewards.
  useEffect(()=>{setQueue(old=>{old.filter(item=>item.owner!==owner).forEach(item=>{item.resolve(false);pending.current.delete(item.pendingKey)});return old.filter(item=>item.owner===owner)})},[owner])
  const current=queue.find(item=>item.owner===owner)
  return <MomentContext.Provider value={{show,active:!!current}}>{children}{current&&<Moment key={current.id} steps={current.steps} reduced={reduced} onFinish={()=>finish(current)}/>}</MomentContext.Provider>
}

export function Moment({steps,onFinish,reduced=false}){
  const [index,setIndex]=useState(0),[opening,setOpening]=useState(false),[closing,setClosing]=useState(false),[error,setError]=useState('')
  const dialog=useRef(null),timer=useRef(null),locked=useRef(false),closingRef=useRef(false),titleId=useId(),descriptionId=useId(),step=steps[index]
  const prepared=useRef(null),[shareReady,setShareReady]=useState(false),[sharing,setSharing]=useState(false)
  useEffect(()=>{let active=true;prepared.current=null;setShareReady(false);if(step.image)import('./story').then(async engine=>({blob:await engine.png(step.image),share:engine.compartir})).then(result=>{if(active){prepared.current=result;setShareReady(!!result.blob)}}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[step])
  async function share(){if(!shareReady||sharing)return;setSharing(true);try{await prepared.current.share(step.image,'suizamente.png',prepared.current.blob)}catch(e){setError(e.message)}finally{setSharing(false)}}
  useEffect(()=>{
    const previous=document.activeElement,host=dialog.current.parentElement,oldOverflow=document.body.style.overflow
    const siblings=[...document.body.children].filter(el=>el!==host),inert=siblings.map(el=>el.inert)
    siblings.forEach(el=>{el.inert=true});document.body.style.overflow='hidden'
    const focus=()=>{if(dialog.current&&!dialog.current.contains(document.activeElement))dialog.current.focus({preventScroll:true})}
    focus();document.addEventListener('focusin',focus)
    return()=>{clearTimeout(timer.current);document.removeEventListener('focusin',focus);siblings.forEach((el,i)=>{el.inert=inert[i]});document.body.style.overflow=oldOverflow;if(previous?.isConnected&&!previous.closest('[inert]'))previous.focus({preventScroll:true})}
  },[])
  useEffect(()=>{dialog.current?.focus({preventScroll:true})},[index])
  async function close(){
    if(closingRef.current)return
    closingRef.current=true;locked.current=true;clearTimeout(timer.current);setClosing(true);setError('')
    try{await onFinish?.()}catch(e){closingRef.current=false;locked.current=false;setClosing(false);setError(e.message||'No se pudo guardar. Toca para reintentar.')}
  }
  function advance(){
    if(locked.current||closing)return
    if(index===steps.length-1)return close()
    locked.current=true
    const next=()=>{setIndex(i=>i+1);setOpening(false);locked.current=false}
    if(step.open&&!reduced&&!matchMedia('(prefers-reduced-motion: reduce)').matches){setOpening(true);timer.current=setTimeout(next,360)}else next()
  }
  function keydown(e){
    e.stopPropagation()
    if(e.key==='Escape'){e.preventDefault();close()}
    else if((e.key==='Enter'||e.key===' ')&&!e.repeat){e.preventDefault();if(e.target.closest('[data-m="compartir"]'))share();else if(e.target.closest('button'))close();else advance()}
    else if(e.key==='Tab'){e.preventDefault();const buttons=[...dialog.current.querySelectorAll('button:not(:disabled)')],i=buttons.indexOf(document.activeElement),next=e.shiftKey?(i<0?buttons.length-1:i-1):i+1;if(next<0||next>=buttons.length)dialog.current.focus();else buttons[next].focus()}
  }
  return createPortal(<div data-moment-host><div ref={dialog} data-momento data-reduced={reduced||undefined} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} tabIndex={-1} className={'sv-moment'+(step.image?' has-share':'')} style={{'--moment-tint':step.tint||'#FEEDD1'}} onKeyDown={keydown} onClick={e=>{e.stopPropagation();advance()}}>
    <div aria-hidden="true" className="sv-moment-decoration"><div className={'sv-moment-rays'+(step.grey?' grey':'')}/><div className="sv-moment-glow"/>
    {step.confetti&&<div aria-hidden="true" className="sv-moment-confetti">{Array.from({length:18},(_,i)=><span key={i} style={{left:((i*53+7)%96)+'%',width:i%2?8:10,height:i%2?15:10,borderRadius:i%2?3:'50%',background:['#FA2F35','#F9A719','#24E2C9','#4A76EF','#24BFE2','#03AA98'][i%6],animation:`sz-caer ${2.8+(i%4)*.45}s ${(i%6)*.33+(i%3)*.17}s linear infinite`}}/>)}</div>}
    </div><button className="sv-moment-skip" disabled={closing} onClick={e=>{e.stopPropagation();close()}}>Omitir</button>
    <div className="sv-moment-page" key={index} aria-live="polite" aria-atomic="true"><h1 id={titleId}>{step.title}</h1>{step.subtitle&&<p className="sv-moment-sub">{step.subtitle}</p>}<div id={descriptionId} className="sv-moment-body"><div className={'sv-moment-content'+(opening?' opening':'')}>{step.body}</div></div></div>
    {step.image&&<button data-m="compartir" className="sv-moment-share" disabled={!shareReady||sharing} onClick={e=>{e.stopPropagation();share()}}>📤 {step.shareLabel||'Compartir'}</button>}
    <footer className="sv-moment-footer"><p>{closing?'Guardando…':step.footer||(step.open?'Toca para abrirlo':'Toca para continuar')}</p>{steps.length>1&&<span>{index+1} de {steps.length}</span>}{error&&<p role="alert">{error}</p>}</footer>
  </div></div>,document.body)
}

export function MomentObject({pack=false,total}){
  return <div className={'sv-moment-object'+(pack?' pack':'')}><div aria-hidden="true" className="sv-moment-sparkles">{[[-96,-78,28,'#F9A719',0],[100,-48,20,'#24BFE2',.5],[78,92,24,'#FA2F35',1],[-84,70,16,'#24E2C9',.8]].map(([x,y,s,c,d],i)=><svg key={i} viewBox="0 0 24 24" width={s} height={s} style={{left:'50%',top:'50%',margin:`${y-s/2}px 0 0 ${x-s/2}px`,animationDelay:d+'s'}}><path d="M12 0C13 8 16 11 24 12C16 13 13 16 12 24C11 16 8 13 0 12C8 11 11 8 12 0Z" fill={c}/></svg>)}</div>{pack?<div className="sv-moment-envelope" aria-hidden="true"><i className="sv-moment-envelope-band"/><span><img src="/suizamente-assets/logo-suizamente.svg" width="68" alt=""/></span><b>{total} cartas</b></div>:<span aria-hidden="true" className="sv-moment-gift">🎁</span>}</div>
}
export function MomentStamp({category,size=44}){return <span className="sv-moment-stamp" style={{width:size,height:size,fontSize:size/2,background:category?.color,boxShadow:`inset 0 0 0 ${Math.round(size*.08)}px rgba(255,255,255,.6)`}} role="img" aria-label={'Sello de '+category?.nombre}>{category?.emoji}</span>}
export function MomentTokens({items,type='gain',label}){
  if(!items?.length)return null
  return <div className={'sv-moment-block '+type}>{label&&<b className="sv-moment-label">{label}</b>}<div className="sv-moment-tokens">{items.map(([icon,value,text],i)=><div key={i} className={'sv-moment-token '+type} style={{'--delay':(.3+i*.18)+'s','--shake-delay':(.8+i*.18)+'s'}}><span className="sv-moment-icon" aria-hidden={typeof icon==='string'?true:undefined}>{icon}</span><b style={{fontSize:String(value).length>6?14:21}}>{value}</b><span>{text}</span></div>)}</div></div>
}
export function MomentSummary({hero,gain,loss,other,note,nothing}){return <>{hero&&<span aria-hidden="true" className={'sv-moment-hero'+(loss||nothing?' lost':'')}>{hero}</span>}<MomentTokens items={gain} label="✓ Has conseguido"/><MomentTokens items={loss} type="loss" label="✕ Has perdido"/>{other&&<MomentTokens items={other[1]} type="other" label={other[0]}/ >}{nothing&&<b className="sv-moment-label other">{nothing}</b>}{note&&<p className="sv-moment-note">{note}</p>}</>}
