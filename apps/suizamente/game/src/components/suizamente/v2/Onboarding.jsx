import {iconizar,Sello,UiIcon} from './Icono'
import {useEffect,useRef,useState} from 'react'
import {useLocation,useNavigate} from 'react-router-dom'
import {useSv} from './Context'
import {Button,Stamps,MatchWheel,LatidoBackdrop} from './Shared'
import {WorldMap} from './WorldMap'
import {QuestionOptions} from './QuestionOptions'
import {useMoment} from './Moment'
import {welcomeSteps} from './moments'
import {szApi} from '../../../lib/suizamenteV2'
import {feedback} from '../../../lib/suizamenteFeedback'
import './onboarding.css'

const copy=[
 ['¿Cuánto sabes de Suiza?','Elige una respuesta y aprende un dato curioso.'],
 ['Gana los 6 sellos','Gira la ruleta y acierta. Con 3 aciertos seguidos, juegas por un sello.'],
 ['Construye tu Suiza','Con las monedas que ganas, levanta los 26 cantones en 3D.'],
]
const tints=['#DFE7FC','#FEEDD1','#D3F8F3']
function Category({question}){const {config}=useSv(),c=config.categorias.find(c=>c.temas.includes(question.tema));return <span className="sv-onb-category" style={{background:c?.tinte}}><Sello categoria={c?.id} conseguido/> {c?.nombre}</span>}
function Lucerne(){
 const {reduced}=useSv(),[level,setLevel]=useState(reduced?3:1),[cycle,setCycle]=useState(0)
 useEffect(()=>{if(reduced){setLevel(3);return}setLevel(1);let active=true,timer;const advance=n=>{if(!active)return;setLevel(n);setCycle(v=>v+1);timer=setTimeout(()=>advance(n===3?1:n+1),n===3?3000:1500)};timer=setTimeout(()=>advance(2),1500);return()=>{active=false;clearTimeout(timer)}},[reduced])
 return <div className="sv-onb-lucerne"><div className="sv-onb-map-frame" role="img" aria-label={'Maqueta 3D de Lucerna, nivel '+level+': '+['','naturaleza','pueblo','monumento'][level]}><WorldMap preview demo state={{vuelta:1,region:0,niveles:{LU:level}}} selected="LU" animated={{canton:'LU',cycle}}/></div><div className="sv-onb-levels" role="list" aria-label="Los 3 niveles de cada cantón">{[[1,'🌲','Naturaleza'],[2,'🏡','Pueblo'],[3,'🏰','Monumento']].map(([n,e,name])=><span key={n} role="listitem" aria-current={level===n?'step':undefined} className={level===n?'active':''}><span aria-hidden="true"><UiIcon value={e}/></span> {name}</span>)}</div></div>
}
export function Onboarding(){
 const {config,player,savePlayer,reduced}=useSv(),{show}=useMoment(),navigate=useNavigate(),location=useLocation()
 const replay=new URLSearchParams(location.search).has('repetir')||!!player?.ajustes?.onboarding
 const pageNumber=Number(new URLSearchParams(location.search).get('paso'))
 const step=Number.isInteger(pageNumber)&&pageNumber>=1?Math.min(3,pageNumber)-1:0
 const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0)
 function setStep(value){const next=typeof value==='function'?value(step):value,search=new URLSearchParams(location.search);search.set('paso',next+1);navigate({pathname:location.pathname,search:search.toString()})}
 const title=useRef(null),touch=useRef(null),pending=useRef(false)
 useEffect(()=>{let active=true;szApi('primera-vez',{fresh:true}).then(d=>{if(active)setData(d)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[retry])
 useEffect(()=>{title.current?.focus({preventScroll:true});title.current?.closest('.sv-onb-body')?.scrollTo(0,0);window.scrollTo(0,0)},[step,data?.resultado?.opcion])
 async function answer(opcion){if(pending.current)return;pending.current=true;setBusy(true);setError('');try{const next=await szApi('primera-vez/respuesta',{method:'POST',body:{opcion}});if(next.resultado)feedback(next.resultado.ok?'acierto':'fallo',{key:'primera-vez:'+next.pregunta.id+':respuesta'});setData(next)}catch(e){setError(e.message)}finally{pending.current=false;setBusy(false)}}
 async function finish(){
  if(pending.current)return
  if(replay){navigate('/suizamente/ajustes');return}
  pending.current=true;setBusy(true);setError('')
  try{
   await show(welcomeSteps(config),{key:'bienvenida',onFinish:async()=>{
    const result=await szApi('primera-vez/finalizar',{method:'POST'})
    if(result.jugador)savePlayer(result)
    localStorage.setItem('suizamente:onboarding',result.onboarding||result.jugador?.ajustes.onboarding||new Date().toISOString())
    if(result.pendientePerfil)localStorage.setItem('suizamente:bienvenida-pendiente','1')
   }})
   sessionStorage.setItem('suizamente:despues-perfil','/suizamente/nueva')
   navigate(player?'/suizamente/nueva':'/suizamente/perfil/nuevo')
  }catch(e){setError(e.message)}finally{pending.current=false;setBusy(false)}
 }
 const result=data?.resultado,words=step===0&&result?[result.ok?'¡Correcto! 🎉':'¡Casi!',result.dato]:copy[step]
 return <section className={'sv-screen sv-onboarding sv-onb-new'+(reduced?' reduced':'')} data-onb-step={step+1} onTouchStart={e=>{touch.current=e.changedTouches[0].clientX}} onTouchEnd={e=>{const dx=(touch.current??e.changedTouches[0].clientX)-e.changedTouches[0].clientX;touch.current=null;if(busy||e.target.closest('button,a'))return;if(dx>60)setStep(n=>Math.min(2,n+1));else if(dx< -60)setStep(n=>Math.max(0,n-1))}}>
  <LatidoBackdrop tint={tints[step]} deco scene={false}/>
  <header className="sv-onboarding-progress"><div role="img" aria-label={'Paso '+(step+1)+' de 3'}>{copy.map((_,i)=><i key={i} className={i<=step?'done':''}/>)}</div>{step<2&&<button type="button" disabled={busy} onClick={finish}>Saltar</button>}</header>
  <div className="sv-onb-body"><div className="sv-onboarding-art">
   {step===0&&(data?<div className="sv-onb-practice"><div className="sv-onb-practice-category"><span data-sz-content aria-hidden="true">{data.pregunta.emoji}</span><Category question={data.pregunta}/></div><h2 data-sz-content>{data.pregunta.pregunta}</h2><QuestionOptions question={data.pregunta} result={result} onAnswer={answer} busy={busy}/></div>:<div role="status" className="sv-skeleton" aria-label="Cargando pregunta"/>)}
   {step===1&&<div className="sv-onb-learn"><div className="sv-onb-wheel"><MatchWheel categories={config.categorias} max={config.partida.barraParaSello} value={2} target="comida" yourTurn={false}/></div><div className="sv-onb-passport" role="img" aria-label="Tu pasaporte: 4 de 6 sellos"><Stamps categories={config.categorias} owned={['idioma','cultura','comida','casa']}/><b>4/6</b></div></div>}
   {step===2&&!busy&&<Lucerne/>}
  </div>
  <section className="sv-onboarding-copy"><h1 ref={title} tabIndex={-1}>{words[0]}</h1><p data-sz-content={step===0&&!!result||undefined}>{words[1]}</p></section>
  {error&&<div className="sv-content"><p role="alert" className="sv-error">{error}</p>{!data&&<Button tone="quiet" onClick={()=>{setError('');setRetry(n=>n+1)}}>Reintentar</Button>}</div>}</div>
  <footer className="sv-footer"><Button tone={step===0&&!result?'quiet':''} disabled={busy} onClick={()=>step===2?finish():setStep(n=>n+1)}>{iconizar(busy?'Preparando…':step===0&&!result?'Ahora no':step===2?(replay?'✓ Listo':'🎁 Abrir mi regalo'):'Siguiente')}</Button></footer>
 </section>
}
