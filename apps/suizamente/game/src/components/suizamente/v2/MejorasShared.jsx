import {useEffect,useRef,useState} from 'react'
import {Link,useNavigationType} from 'react-router-dom'
import {useSv} from './Context'
import {Avatar,Button,Card,Header,Sheet,Wallet} from './Shared'
import {Icono} from './Icono'
import {useData} from './useData'
import {szApi} from '../../../lib/suizamenteV2'
import {copyInvitationText} from '../../../lib/suizamenteInvitations'
import {notify} from '../../../lib/suizamenteNotices'
import {SHARE_URL} from './shareData'
import './mejoras.css'

export const mejoraActiva=(config,key)=>config?.mejoras?.[key]?.activo===true
export function MejoraPage({title,children,right,back,className=''}){return <section className={'sv-screen sv-mj-page '+className}><Header title={title} back={back} right={right||<Wallet/>}/><div className="sv-mj-content">{children}</div></section>}
export function MejoraError({error,retry}){return error?<Card><p className="sv-error" role="alert">{error}</p>{retry&&<Button tone="quiet" onClick={retry}>Reintentar</Button>}</Card>:null}
export function MejoraLoading(){return <div className="sv-skeleton sv-mj-loading" role="status" aria-label="Cargando"/>}
export function MejoraQuestionTitle({question}){const ref=useRef(null);useEffect(()=>{ref.current?.focus({preventScroll:true})},[question?.id]);return <h1 ref={ref} tabIndex={-1} data-sz-content>{question?.pregunta}</h1>}
export function useMejora(path,initial){
 const navigation=useNavigationType(),[state,setState]=useState(navigation!=='POP'?initial||null:null),[error,setError]=useState(''),[version,setVersion]=useState(0),writes=useRef(0)
 useEffect(()=>{let active=true;setError('');if(initial&&version===0&&navigation!=='POP'){setState(initial);return()=>{active=false}}const atStart=writes.current;szApi('mejoras/'+path).then(d=>{if(active&&atStart===writes.current)setState(d)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[path,version,navigation])
 return {state,setState:value=>{writes.current++;setState(value)},error,setError,reload:()=>setVersion(n=>n+1)}
}
export function useServerSeconds(deadline,serverNow,active=true){
 const [seconds,setSeconds]=useState(()=>Math.max(0,Math.ceil((Date.parse(deadline)-Date.parse(serverNow))/1000))||0)
 useEffect(()=>{if(!deadline||!serverNow||!active)return;const end=performance.now()+Date.parse(deadline)-Date.parse(serverNow);const tick=()=>setSeconds(Math.max(0,Math.ceil((end-performance.now())/1000)));tick();const timer=setInterval(tick,200);return()=>clearInterval(timer)},[deadline,serverNow,active])
 return seconds
}
export function MejoraTimer({seconds,total,wrong=false}){
 return <><div className={'sv-mj-timer'+(wrong?' wrong':'')} role="timer" aria-label={seconds+' segundos'} aria-live="off" style={{'--timer':Math.min(1,seconds/Math.max(1,total))}}><div aria-hidden="true"><b>{seconds}</b><span>segundos</span></div></div><TimerAnnouncement seconds={seconds}/></>
}
export function TimerAnnouncement({seconds}){const [text,setText]=useState(''),last=useRef(null);useEffect(()=>{if(seconds!==last.current&&(seconds%10===0||seconds<=10)){last.current=seconds;setText(seconds+' segundos')}},[seconds]);return <span className="sv-sr-only" role="status" aria-live="polite">{text}</span>}
export async function shareMejora(text,path='/suizamente'){
 const url=path.startsWith('https://')?path:SHARE_URL+path
 if(navigator.share)await navigator.share({title:'Suizamente',text,url})
 else{await copyInvitationText(text+' '+url);notify('Texto y enlace copiados')}
}
export function MejoraFriends({onPick,label='Retar',busy=false,footer}){
 const {data,error,reload}=useData('amigos',{reuseCached:true}),[query,setQuery]=useState('')
 const people=[...(data?.lista||[])].filter(p=>p.apodo.toLocaleLowerCase('es').includes(query.trim().replace(/^@/,'').toLocaleLowerCase('es'))).sort((a,b)=>Number(b.online)-Number(a.online)||a.apodo.localeCompare(b.apodo,'es'))
 return <><label className="sv-mj-search"><Icono nombre="amigos"/><input type="search" aria-label="Buscar entre tus amigos" placeholder="Busca a tus amigos" value={query} onChange={e=>setQuery(e.target.value)}/></label><MejoraError error={error} retry={reload}/>{!data&&!error&&<MejoraLoading/>}<ul className="sv-mj-friends">{people.map(p=><li key={p.id}><span className="sv-mj-person"><span className="sv-mj-avatar"><Avatar id={p.id} name={p.apodo} color={p.color} photo={p.foto}/>{p.online&&<i/>}</span><span><b>{p.apodo}</b><small className={p.online?'online':''}>Nivel {p.nivel}{p.online?' · en línea':''}</small></span></span><button type="button" className="sv-mini-button" disabled={busy} onClick={()=>onPick(p)} aria-label={label+' a '+p.apodo+', nivel '+p.nivel+(p.online?', en línea':'')}>{label}</button></li>)}</ul>{data&&!people.length&&<p className="sv-muted">{query?'No coincide ningún amigo.':'Tus amigos aparecerán aquí.'}</p>}{footer}</>
}
export function MejoraChallenge({game,onClose}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('')
 async function pick(p){if(busy)return;setBusy(true);try{await szApi('mejoras/minuto/'+game.id+'/retar',{method:'POST',body:{amigo:p.id}});notify('Reto enviado a '+p.apodo);onClose()}catch(e){setError(e.message)}finally{setBusy(false)}}
 return <Sheet title="Reta a alguien" onClose={onClose}><MejoraFriends busy={busy} onPick={pick}/><MejoraError error={error}/></Sheet>
}
export function MejoraRanking({rows=[]}){
 return <ol className="sv-mj-ranking">{rows.map(p=><li key={p.id} className={p.tuyo?'own':''}><b>{p.puesto}</b><Avatar id={p.id} name={p.apodo} color={p.color} photo={p.foto}/><span>{p.tuyo?'Tú':p.apodo}</span><strong>{p.puntos}</strong></li>)}</ol>
}
export function MejoraModeLink({mode,compact=false}){return <Link className={compact?'sv-mj-mode compact':'sv-mj-mode'} to={mode.to}><span className="sv-mj-mode-icon"><Icono nombre={mode.icono} size={compact?28:38}/></span><span><b>{mode.nombre}</b><small>{mode.linea}</small></span>{!!mode.globo&&<i>{mode.globo}</i>}{compact&&<span aria-hidden="true">›</span>}</Link>}
export function MejoraModes({modes=[],title=true}){return modes.length?<section className="sv-mj-now" aria-label="Juega ahora">{title&&<div className="sv-mj-section-title"><h2>Juega ahora</h2><span>Sin esperar a nadie</span></div>}<div className="sv-mj-modes">{modes.map(m=><MejoraModeLink key={m.id} mode={m}/>)}</div></section>:null}
export function MejoraIdeas({ideas=[]}){return ideas.length?<section className="sv-mj-ideas" aria-label="Para ti"><div className="sv-mj-section-title"><h2>Para ti</h2><span>Lo que tienes más cerca</span></div><ul>{ideas.map(i=><li key={i.id}><Icono nombre={i.icono} size={30}/><span><b>{i.titulo}</b><small>{i.linea}</small></span><Link to={i.to}>{i.boton}</Link></li>)}</ul></section>:null}
export function useMejoraSummary(enabled){return useData('mejoras/resumen',{enabled,refreshMs:30000,reuseCached:true})}
export function MejoraMenuRows(){const {config}=useSv(),enabled=['minuto','espejo','misterio'].some(k=>mejoraActiva(config,k)),{data}=useMejoraSummary(enabled);return data?.modos?.map(m=><div role="listitem" key={m.id}><MejoraModeLink compact mode={m}/></div>)||null}
