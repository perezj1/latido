import {useEffect,useRef,useState} from 'react'
import {useLocation,useNavigate} from 'react-router-dom'
import {useSv} from './Context'
import {Button,Chip,Stamps,MatchWheel,LatidoBackdrop} from './Shared'
import {WorldMap} from './WorldMap'
import {QuestionOptions} from './QuestionOptions'
import {MomentObject,useMoment} from './Moment'
import {welcomeSteps} from './moments'
import {szApi} from '../../../lib/suizamenteV2'
import './onboarding.css'

const copy=[
 ['👋 BIENVENIDA','¿Cuánto sabes de la vida en Suiza?','El juego de preguntas para hispanohablantes en Suiza: idioma, papeles, comida, trabajo… Con datos curiosos.'],
 ['✋ PRUÉBALO','Así es cada pregunta','Elige una respuesta. Después verás un dato curioso.'],
 ['🎡 LA PARTIDA','Gira, acierta y gana sellos','Partidas 1 contra 1, por turnos. La ruleta elige la categoría y, con 3 aciertos, juegas por un sello. Gana quien llene antes su pasaporte.'],
 ['🏗️ TU SUIZA','Construye tu Suiza en 3D','Con las monedas que ganas levantas cada cantón en 3 niveles, hasta su monumento. Región a región, hasta los 26. Y llenas tu álbum de cartas.'],
 ['🎁 REGALO DE BIENVENIDA','Todo listo para jugar','Dentro hay monedas, un sobre de cartas y comodines para tu primera partida. Y cada día, más: regalo, misiones y la pregunta del día.'],
]
const tints=['#DFE7FC','#D3F2F9','#FEEDD1','#D3F8F3','#FFE1E2']
function Category({question}){const {config}=useSv(),c=config.categorias.find(c=>c.temas.includes(question.tema));return <span className="sv-onb-category" style={{background:c?.tinte}}>{c?.emoji} {c?.nombre}</span>}
function Fan({questions}){
 return <div className="sv-onb-fan" role="img" aria-label={'Ejemplos de preguntas: '+questions.map(q=>q.pregunta).join(' · ')}>{questions.map((q,i)=><div key={q.id} className={'sv-onb-example card-'+i} aria-hidden="true"><Category question={q}/><span className="sv-onb-question-heading"><span>{q.emoji}</span><b>{q.pregunta}</b></span>{i===2&&<div className="sv-onb-example-options">{q.opciones.map(o=><span key={o.indice}>{o.e} <b>{o.t}</b></span>)}</div>}</div>)}</div>
}
function Lucerne(){
 const {reduced}=useSv(),[level,setLevel]=useState(reduced?3:1),[cycle,setCycle]=useState(0)
 useEffect(()=>{if(reduced){setLevel(3);return}setLevel(1);let active=true,timer;const advance=n=>{if(!active)return;setLevel(n);setCycle(v=>v+1);timer=setTimeout(()=>advance(n===3?1:n+1),n===3?3000:1500)};timer=setTimeout(()=>advance(2),1500);return()=>{active=false;clearTimeout(timer)}},[reduced])
 return <div className="sv-onb-lucerne"><div className="sv-onb-map-frame" role="img" aria-label={'Maqueta 3D de Lucerna, nivel '+level+': '+['','naturaleza','pueblo','monumento'][level]}><WorldMap preview demo state={{vuelta:1,region:0,niveles:{LU:level}}} selected="LU" animated={{canton:'LU',cycle}}/></div><div className="sv-onb-levels" role="list" aria-label="Los 3 niveles de cada cantón">{[[1,'🌲','Naturaleza'],[2,'🏡','Pueblo'],[3,'🏰','Monumento']].map(([n,e,name])=><span key={n} role="listitem" aria-current={level===n?'step':undefined} className={level===n?'active':''}><span aria-hidden="true">{e}</span> {name}</span>)}</div></div>
}
export function Onboarding(){
 const {config,player,savePlayer,reduced}=useSv(),{show}=useMoment(),navigate=useNavigate(),location=useLocation()
 const replay=new URLSearchParams(location.search).has('repetir')||!!player?.ajustes?.onboarding
 const [step,setStep]=useState(0),[data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0)
 const title=useRef(null),touch=useRef(null),pending=useRef(false)
 useEffect(()=>{let active=true;szApi('primera-vez',{fresh:true}).then(d=>{if(active)setData(d)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[retry])
 useEffect(()=>{title.current?.focus({preventScroll:true});title.current?.closest('.sv-onb-body')?.scrollTo(0,0);window.scrollTo(0,0)},[step,data?.resultado?.opcion])
 async function answer(opcion){if(pending.current)return;pending.current=true;setBusy(true);setError('');try{setData(await szApi('primera-vez/respuesta',{method:'POST',body:{opcion}}))}catch(e){setError(e.message)}finally{pending.current=false;setBusy(false)}}
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
 const result=data?.resultado,words=step===1&&result?[result.ok?'✅ ¡CORRECTO!':'💡 ¡CASI!',result.ok?'¡Bien visto!':'Ahora ya lo sabes',result.dato]:copy[step]
 return <section className={'sv-screen sv-onboarding sv-onb-new'+(reduced?' reduced':'')} data-onb-step={step+1} onTouchStart={e=>{touch.current=e.changedTouches[0].clientX}} onTouchEnd={e=>{const dx=(touch.current??e.changedTouches[0].clientX)-e.changedTouches[0].clientX;touch.current=null;if(busy||e.target.closest('button,a'))return;if(dx>60)setStep(n=>Math.min(4,n+1));else if(dx< -60)setStep(n=>Math.max(0,n-1))}}>
  <LatidoBackdrop tint={tints[step]} deco scene={false}/>
  <header className="sv-onboarding-progress"><div role="img" aria-label={'Paso '+(step+1)+' de 5'}>{copy.map((_,i)=><i key={i} className={i<=step?'done':''}/>)}</div>{step<4&&<button type="button" disabled={busy} onClick={()=>setStep(4)}>Saltar</button>}</header>
  <div className="sv-onb-body"><div className="sv-onboarding-art">
   {step===0&&(data?<Fan questions={data.ejemplos}/>:<div role="status" className="sv-skeleton" aria-label="Cargando preguntas"/>)}
   {step===1&&data&&<div className="sv-onb-practice"><Category question={data.pregunta}/><div className="sv-onb-question-heading"><span aria-hidden="true">{data.pregunta.emoji}</span><h2>{data.pregunta.pregunta}</h2></div><QuestionOptions question={data.pregunta} result={result} onAnswer={answer} busy={busy}/></div>}
   {step===2&&<div className="sv-onb-learn"><div className="sv-onb-wheel"><MatchWheel categories={config.categorias} max={config.partida.barraParaSello} value={2} target="comida" yourTurn={false}/></div><div className="sv-onb-passport" role="img" aria-label="Tu pasaporte: 4 de 6 sellos"><Stamps categories={config.categorias} owned={['idioma','cultura','comida','casa']}/><b>4/6</b></div></div>}
   {step===3&&<Lucerne/>}
   {step===4&&<div className="sv-onb-gift"><MomentObject/><div className="sv-chips"><Chip>🎁 Regalo diario</Chip><Chip>🎯 Misiones</Chip><Chip>📊 Pregunta del día</Chip></div></div>}
  </div>
  <section className="sv-onboarding-copy"><small>{words[0]}</small><h1 ref={title} tabIndex={-1}>{words[1]}</h1><p>{words[2]}</p></section>
  {error&&<div className="sv-content"><p role="alert" className="sv-error">{error}</p>{!data&&<Button tone="quiet" onClick={()=>{setError('');setRetry(n=>n+1)}}>Reintentar</Button>}</div>}</div>
  <footer className="sv-footer"><Button tone={step===1&&!result?'quiet':''} disabled={busy||!data&&step===0} onClick={()=>step===4?finish():setStep(n=>n+1)}>{busy?'Preparando…':step===0?'Empezar':step===1&&!result?'Ahora no':step===4?(replay?'✓ Listo':'🎁 Abrir mi regalo'):'Siguiente'}</Button></footer>
 </section>
}
