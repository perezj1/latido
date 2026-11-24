import {useEffect,useLayoutEffect,useRef,useState} from 'react'
import {createPortal} from 'react-dom'
import {Link,useLocation,useNavigate,useParams} from 'react-router-dom'
import toast from 'react-hot-toast'
import {useAuth} from '../../hooks/useAuth'
import {CANTONS} from '../../lib/constants'
import {invalidateSuizamente,suizamenteCall,useSuizamente,szLevel} from '../../lib/suizamente'
import {questionStatement,reviewStatement} from '../../lib/suizamenteQuestionText'
import {ARCADE_DEMO} from '../../data/suizamenteArcadeDemo'
import GLOSSARY from '../../data/suizamenteGlossary.json'
import MT from '../../data/suizamenteMountains.json'
import QuestionImage from './QuestionImage'
import {answerPairs,AnswerPairs,FeedbackExplanation,FeedbackSolution} from './QuestionFeedback'
import {PRIZES,StreakWeek} from './SuizamenteArcade'
import {CheckIcon,MountainIcon,SuizamenteMark,SwissFlag} from './SuizamenteVisuals'
import Modal from './SuizamenteSheet'
import QuestionOrdering from './QuestionOrdering'
import CommunityAnswers from './CommunityAnswers'
import {useQuestionLayout} from './useQuestionLayout'
import './SuizamenteArcade.css'
import './SuizamenteGameStyle.css'

const DEMO_KEY='latido:suizamente:arcade-demo:trivia-v2',RETURNS=['/','/perfil','/explorar','/perfil/suizometro','/suizamente','/suizamente/progreso','/suizamente/reto','/suizamente/ascenso']
const INSTRUCTIONS={choice:'',image:'Mira la imagen',false:'¿Cuál es falsa?',tf:'¿Verdadero o falso?',multi:'Marca todas las correctas',match:'Toca una tarjeta de cada lado',order:'Ordena los bloques',short:'Una respuesta corta'}
const TOPICS={administracion:{label:'Trámites',icon:'🏛️',color:'#6351ba',tint:'#f3f0ff'},vivienda:{label:'Casa y convivencia',icon:'🏡',color:'#995315',tint:'#fff7e9'},trabajo:{label:'Trabajo',icon:'💼',color:'#196d90',tint:'#eaf7fc'},salud:{label:'Salud y seguros',icon:'💚',color:'#137453',tint:'#eaf8f1'},sociedad:{label:'Suiza y cultura',icon:'🇨🇭',color:'#255cdc',tint:'#edf3ff'},idioma:{label:'Idiomas',icon:'💬',color:'#a43b82',tint:'#fff0f9'}}
const TRIVIA_TOPICS={lugares:{label:'Lugares',icon:'🧭',color:'#196d90',tint:'#eaf7fc'},simbolos:{label:'Banderas y símbolos',icon:'🇨🇭',color:'#255cdc',tint:'#edf3ff'},sabores:{label:'Sabores de Suiza',icon:'🧀',color:'#995315',tint:'#fff7e9'},tradiciones:{label:'Fiestas y tradiciones',icon:'🎉',color:'#a43b82',tint:'#fff0f9'},naturaleza:{label:'Naturaleza',icon:'🌿',color:'#137453',tint:'#eaf8f1'},curiosidades:{label:'¿Lo sabías?',icon:'💡',color:'#6351ba',tint:'#f3f0ff'}}
const TF_SYMBOLS={verdadero:'✓',falso:'×'}
const LABELS={arrival:'Llegada',stage:'Etapa',bonus:'Reto con premio',trail_review:'Repaso',summit:'Test de cima',practice:'Práctica',review:'Repaso',daily:'Ruta guardada',ascent:'Ascenso guardado',weekly:'Reto semanal',demo:'Demostración · sin guardar XP'}
const WORDS=Object.keys(GLOSSARY).sort((a,b)=>b.length-a.length),WORD_REGEX=new RegExp(`(?<![\\p{L}])((?:${WORDS.map(w=>w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')})(?:en|e|n)?)(?![\\p{L}])`,'gu')
const baseWord=word=>WORDS.find(w=>word===w||['e','n','en'].some(ending=>word===w+ending))
function GlossText({text,onWord,option=false,enabled=true}){
  if(!enabled)return String(text||'')
  const parts=String(text||'').split(WORD_REGEX)
  return parts.map((part,i)=>{const word=baseWord(part);return word?option?<span key={i} className="sg-word" onClick={e=>{e.stopPropagation();onWord(word)}} title={`${part}: ver significado`}>{part}</span>:<button key={i} type="button" className="sg-word" onClick={()=>onWord(word)} aria-label={`${part}: ver significado`}>{part}</button>:part})
}
function freshDemo(){return {position:0,responses:[],pairs:{},created_at:new Date().toISOString(),completed_at:null}}
function loadDemo(){try{
  const d=JSON.parse(sessionStorage.getItem(DEMO_KEY)||'null')
  if(d&&Number.isInteger(d.position)&&d.position>=0&&d.position<6&&Array.isArray(d.responses)&&d.responses.length<=6&&d.responses.length>=d.position&&d.pairs&&typeof d.pairs==='object'&&Number.isFinite(Date.parse(d.created_at))&&d.responses.every((a,i)=>a&&typeof a.correct==='boolean'&&typeof a.skipped==='boolean'&&(a.choice===null||Number.isInteger(a.choice)&&a.choice>=0&&a.choice<ARCADE_DEMO[i].options.length)&&Array.isArray(a.choices)&&a.choices.every(j=>Number.isInteger(j)&&j>=0&&j<ARCADE_DEMO[i].options.length))&&Object.values(d.pairs).every(p=>Array.isArray(p.matched)&&p.matched.every(i=>Number.isInteger(i)&&i>=0&&i<4)&&Number.isInteger(p.errors)&&p.errors>=0))return d
}catch{}return freshDemo()}
const demoOrder=[2,0,3,1]
function demoView(d){
  const q=ARCADE_DEMO[d.position],a=d.responses[d.position],correct=q.game_type==='multi'?q.correct_indices:[q.correct_index]
  const reviews=d.responses.map((r,i)=>{const question=ARCADE_DEMO[i];return {position:i,prompt:question.prompt,category:question.category,correct:r.correct,skipped:r.skipped,chosen_answer:r.skipped?null:question.game_type==='multi'?r.choices.map(j=>question.options[j]).join('; '):question.game_type==='match'?'Parejas completadas':question.options[r.choice],correct_pairs:question.game_type==='match'?question.options.map((left,j)=>({left,right:question.pairs[j]})):null,correct_answer:question.game_type==='match'?question.options.map((o,j)=>`${o} → ${question.pairs[j]}`).join('; '):question.game_type==='multi'?question.correct_indices.map(j=>question.options[j]).join('; '):question.options[question.correct_index],explanation:question.explanation,source_url:question.source_url,source_title:question.source_title,xp:0}})
  const ps=d.pairs[d.position]||{matched:[],errors:0}
  return {id:'demo',mode:'demo',status:d.responses.length===6?'completed':'active',position:d.position,total:6,level:1,xp_gained:0,history:d.responses.map(r=>r.correct),states:d.responses.map(r=>r.skipped?'skipped':r.correct?'correct':'wrong'),correct_count:reviews.filter(r=>r.correct).length,review_answers:reviews,created_at:d.created_at,completed_at:d.completed_at,
    pair_state:{...ps,matched_right:ps.matched.map(i=>demoOrder.indexOf(i))},question:{...q,type:q.game_type,pairs:q.pairs?demoOrder.map(i=>q.pairs[i]):null},answer:a?{...a,selected_options:a.choices,correct_option:q.correct_index,correct_options:correct,correct_answer:reviews[d.position]?.correct_answer,correct_pairs:reviews[d.position]?.correct_pairs,explanation:q.explanation,source_url:q.source_url,source_title:q.source_title,xp:0}:null}
}
function answerDemo(d,p){
  const q=ARCADE_DEMO[d.position];if(d.responses[d.position])return demoView(d)
  let correct=false,choice=p.choice??0
  if(!p.skip){if(q.game_type==='multi')correct=[...p.choices].sort().join()===q.correct_indices.slice().sort().join();else if(q.game_type==='match'){
    const state=d.pairs[d.position]||{matched:[],errors:0};if(state.matched.includes(p.left)||state.matched.includes(demoOrder[p.right]))return demoView(d)
    const ok=p.left===demoOrder[p.right];if(ok)state.matched.push(p.left);else{state.errors++;state.wrong_pairs=[...(Array.isArray(state.wrong_pairs)?state.wrong_pairs:[]),`${p.left}:${p.right}`]}
    state.last={left:p.left,right:p.right,correct:ok};d.pairs[d.position]=state;if(state.matched.length<4)return demoView(d);correct=state.errors<=1
  }else correct=choice===q.correct_index}
  d.responses.push({correct,skipped:!!p.skip,choice:p.skip?null:choice,choices:p.choices||[]});if(d.responses.length===6)d.completed_at=new Date().toISOString();return demoView(d)
}
export default function SuizamenteGamePlayer(){
  const {sessionId}=useParams(),isDemo=sessionId==='demo',navigate=useNavigate(),location=useLocation(),{authUser,loading:authLoading}=useAuth(),{data:summary}=useSuizamente()
  const returnTo=RETURNS.includes(location.state?.returnTo)?location.state.returnTo:'/suizamente'
  const [session,setSession]=useState(null),[multi,setMulti]=useState([]),[pairLeft,setPairLeft]=useState(null),[pairRight,setPairRight]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[result,setResult]=useState(false),[exitOpen,setExitOpen]=useState(false),[reportOpen,setReportOpen]=useState(false),[word,setWord]=useState(null),[revision,setRevision]=useState(0),[reason,setReason]=useState('incorrect'),[notes,setNotes]=useState(''),[reportError,setReportError]=useState('')
  const pending=useRef(false),demo=useRef(null),questionRef=useRef(null),feedbackRef=useRef(null),scroll=useRef(null),playerRef=useRef(null)
  useQuestionLayout(playerRef,scroll,!!session&&!result,`${session?.question?.version_id||session?.question?.id}:${session?.position}:${!!session?.answer}:${session?.pair_state?.matched?.length}:${!!error}`)
  const [pairFlash,setPairFlash]=useState(null),pairLast=session?.pair_state?.last
  const [sequence,setSequence]=useState([]),[shortText,setShortText]=useState('')
  useEffect(()=>{setSequence([]);setShortText('')},[session?.question?.version_id,session?.position])
  useEffect(()=>{
    if(!pairLast||pairLast.correct){setPairFlash(null);return undefined}
    setPairFlash({left:pairLast.left,right:pairLast.right})
    const timer=setTimeout(()=>setPairFlash(null),950)
    return()=>clearTimeout(timer)
  },[session?.position,pairLast?.left,pairLast?.right,pairLast?.correct,session?.pair_state?.errors])
  useEffect(()=>{
    if(authLoading)return undefined
    let live=true;setSession(null);setError('');setMulti([]);setPairLeft(null);setPairRight(null);setResult(false)
    if(isDemo){demo.current=loadDemo();const s=demoView(demo.current);setSession(s);setResult(s.status==='completed');return undefined}
    if(!authUser)return undefined
    suizamenteCall('session',{id:sessionId}).then(s=>{if(live){setSession(s);setResult(s.status==='completed')}}).catch(e=>{if(live)setError(e.message)})
    return()=>{live=false}
  },[sessionId,isDemo,authLoading,authUser?.id,revision])
  useEffect(()=>{if(session&&!session.answer&&!result)questionRef.current?.focus({preventScroll:true})},[session?.position,session?.question?.id,result])
  useEffect(()=>{if(session?.answer)feedbackRef.current?.focus({preventScroll:true})},[session?.answer])
  function persist(){try{sessionStorage.setItem(DEMO_KEY,JSON.stringify(demo.current))}catch{}}
  async function submit(args){
    if(pending.current||session?.answer)return
    pending.current=true;setBusy(true);setError('')
    try{let s;if(isDemo){s=answerDemo(demo.current,args);persist()}else{s=await suizamenteCall('answer',{session_id:session.id,position:session.position,...args});invalidateSuizamente()}setSession(s);setPairLeft(null);setPairRight(null)}catch(e){setError(e.message)}finally{pending.current=false;setBusy(false)}
  }
  async function next(){
    if(pending.current)return
    if(session.status==='completed'){setResult(true);scroll.current?.scrollTo({top:0});return}
    pending.current=true;setBusy(true);setError('')
    try{let s;if(isDemo){demo.current.position++;persist();s=demoView(demo.current)}else s=await suizamenteCall('session',{id:session.id,advance:true});setSession(s);setMulti([]);setPairLeft(null);setPairRight(null);scroll.current?.scrollTo({top:0})}catch(e){setError(e.message)}finally{pending.current=false;setBusy(false)}
  }
  function pick(i){if(busy||session.answer)return;if(session.question.type==='multi')setMulti(items=>items.includes(i)?items.filter(j=>j!==i):[...items,i]);else if(session.question.type==='order')setSequence(items=>items.includes(i)?items.filter(j=>j!==i):[...items,i]);else if(session.question.type!=='short')void submit({choice:i})}
  useLayoutEffect(()=>{
    function key(e){
      if(e.defaultPrevented||!session||result||busy||exitOpen||reportOpen||word||e.target.closest('input,textarea,select,[contenteditable="true"]'))return
      const q=session.question
      if(e.key==='Escape'){e.preventDefault();setExitOpen(true)}
      else if(/^[1-8]$/.test(e.key)&&!session.answer&&!['match','short'].includes(q.type)&&Number(e.key)<=q.options.length){e.preventDefault();pick(Number(e.key)-1)}
      else if(e.key==='Enter'&&!e.target.closest('a,button')){e.preventDefault();if(session.answer)void next();else if(q.type==='multi'&&multi.length)void submit({choices:multi});else if(q.type==='order'&&sequence.length===q.options.length)void submit({choices:sequence})}
    }
    document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key)
  },[session,result,busy,exitOpen,reportOpen,word,multi,sequence])
  async function leave(){
    if(pending.current)return;pending.current=true;setBusy(true);setError('')
    try{if(!isDemo&&session.game_version===4)await suizamenteCall('game_exit',{id:session.id});invalidateSuizamente();navigate(returnTo)}catch(e){setError(e.message)}finally{pending.current=false;setBusy(false)}
  }
  async function report(e){e.preventDefault();if(pending.current)return;pending.current=true;setBusy(true);setReportError('');try{await suizamenteCall('report',{version_id:session.question.version_id,reason,notes});setReportOpen(false);toast.success('Gracias. Revisaremos la pregunta.')}catch(e){setReportError(e.message)}finally{pending.current=false;setBusy(false)}}
  let content
  if(!authLoading&&!authUser&&!isDemo)content=<div className="sg-loading-state"><h1>Tu partida en Suizamente</h1><p>Inicia sesión para continuar y guardar tu aprendizaje.</p><Link className="sz-button sz-button--primary" to={`/auth?next=${encodeURIComponent(location.pathname)}`}>Iniciar sesión</Link><Link to="/suizamente/partida/demo">Probar una demostración</Link></div>
  else if(!session)content=<div className="sg-loading-state"><Link to="/suizamente">‹ Suizamente</Link>{error?<><p role="alert">{error}</p><button className="sz-button sz-button--secondary" onClick={()=>setRevision(n=>n+1)}>Volver a cargar</button></>:<p role="status">Preparando las preguntas…</p>}</div>
  else if(result)content=<Results session={session} summary={summary} returnTo={returnTo} isDemo={isDemo} restart={()=>{demo.current=freshDemo();persist();setSession(demoView(demo.current));setMulti([]);setPairLeft(null);setResult(false)}}/>
  else{
    const s=session,q={...s.question,prompt:questionStatement(s.question)},a=s.answer,type=q.type||'choice',matched=s.pair_state?.matched||[],rightMatched=s.pair_state?.matched_right||[],state=a?.annulled?'skipped':a?.skipped?'skipped':a?.correct?'correct':a?'wrong':''
    // A definition must not give away the translation or institution being tested.
    const glossaryEnabled=!!a||!(q.hideGlossaryUntilAnswered||q.category==='idioma'||/Lohnausweis|parlamento|qué significa|quiere decir|cómo se dice|traduce|traducción/i.test(q.prompt))
    const words=glossaryEnabled?[...new Set((`${q.prompt} ${q.options.join(' ')} ${a?.explanation||''}`.match(WORD_REGEX)||[]).map(baseWord).filter(Boolean))]:[]
    const gift=s.trail?.gift&&s.trail.gift_at===s.position,won=s.trail?.gifts||[],usedLife=s.trail?.life,errors=s.states.filter(state=>state==='wrong'||state==='skipped').length,allow=Math.max(0,(s.valid_total??s.total)-(s.trail?.pass||0))
    const solvedPairs=type==='match'&&a?answerPairs(a,q):[]
    const topic=TRIVIA_TOPICS[q.trivia_topic]||TOPICS[q.category]||TOPICS.sociedad
    const test=s.mode==='summit'||s.trail?.summit_practice,combo=s.history.slice(0,s.position+1).reduce((n,correct)=>correct?n+1:0,0)
    content=<>
      <header className="sg-play-top"><button onClick={()=>setExitOpen(true)} aria-label="Salir de la partida">×</button><div className="sg-play-progress" role="progressbar" aria-label={`Pregunta ${s.position+1} de ${s.total}`} aria-valuemin={0} aria-valuemax={s.total} aria-valuenow={s.history.length}><span style={{width:`${s.history.length/s.total*100}%`,background:szLevel(s.level).color}}/></div>{test?<div className="sg-life-dots" role="img" aria-label={`${Math.max(0,allow-errors)} fallos disponibles${usedLife?', vida extra activada':''}`}>{Array.from({length:allow},(_,i)=><i key={i} className={`${i<errors?'used':''} ${usedLife&&i===allow-1?'extra':''}`}/>)}</div>:<strong>{s.mode==='weekly'?'🏆':'⚡'} {s.mode==='weekly'?s.correct_count*10:s.xp_gained}{s.trail?.x2&&<small>XP ×2</small>}</strong>}</header>
      <div className="sg-player-scroll" ref={scroll}><div className="sg-player-body">
        <div className="sg-question-meta"><div className="sg-question-context"><SuizamenteMark/>
        <p className="sg-play-label">{s.trail?.summit_practice?'Test de cima':s.game_version===4&&s.trail.node>=0&&s.mode!=='summit'?`ETAPA ${s.trail.node+1}`:LABELS[s.mode]} · {test?MT[s.level].top:MT[s.level].n} · {s.position+1} de {s.total}{s.trail?.practice?' · PRÁCTICA':''}</p>
        </div><div className="sg-question-badges"><div className={`sg-question-scope ${q.scope==='canton'?'is-canton':''}`}>{q.scope==='canton'?<>📍 Cantón de {CANTONS.find(c=>c.code===q.canton)?.name||q.canton}</>:<><SwissFlag/>Suiza general</>}</div>{s.mode==='arrival'&&<div className="sg-question-scope">🚉 {MT[s.level].n}</div>}</div>
        </div>
        {gift&&<div className="sg-gift-banner"><span aria-hidden="true">🎁</span>{won.includes(s.trail.gift)&&a?.correct?`${PRIZES[s.trail.gift].icon} Premio en tu mochila`: `Acierta y gana ${PRIZES[s.trail.gift].name.toLowerCase()}`}</div>}
        {s.fallback&&s.position===0&&<p className="sz-muted">Incluye preguntas generales porque falta contenido local de este nivel en tu selección.</p>}
        <div className="sg-trivia-card" style={{'--sg-topic':topic.color,'--sg-topic-tint':topic.tint}}><span className="sg-topic-label"><span aria-hidden="true">{topic.icon}</span>{topic.label}</span><h1 className="sg-question-heading" ref={questionRef} tabIndex={-1}><GlossText text={q.prompt} onWord={setWord} enabled={glossaryEnabled}/></h1></div>
        {!a&&INSTRUCTIONS[type]&&<p className={`sg-instruction ${type}`}>{INSTRUCTIONS[type]}</p>}
        {q.image_key&&<QuestionImage key={`${q.version_id||q.id}:${session.position}`} imageKey={q.image_key} answered={!!a}/>}
        {type==='order'?<QuestionOrdering options={q.options} sequence={sequence} onChange={setSequence} disabled={busy||!!a} answer={a}/>:type==='short'?<form className="sz-form sg-short-question" onSubmit={e=>{e.preventDefault();if(!busy&&!a&&shortText.trim())void submit({text:shortText})}}><label className="sz-field">Tu respuesta<input type="text" value={a&&!a.skipped?(a.response||''):shortText} onChange={e=>setShortText(e.target.value)} disabled={busy||!!a} maxLength={q.max_length||80} autoComplete="off" spellCheck={false} autoCapitalize="none"/></label></form>:type==='match'?<>{solvedPairs.length>0&&<p className="sg-pair-answer-label">Parejas correctas</p>}<div className={`sg-pair-grid ${solvedPairs.length?'is-solved':''}`} aria-label={solvedPairs.length?'Parejas correctas':'Une las parejas'}><div className="sg-pair-column">{q.options.map((o,i)=><button key={i} className={`sg-option${pairLeft===i?' selected':''}${solvedPairs.length||matched.includes(i)?' correct':''}${pairFlash?.left===i?' wrong':''}`} disabled={busy||!!a||matched.includes(i)} aria-pressed={pairLeft===i} onClick={()=>pairRight===null?setPairLeft(i):submit({left:i,right:pairRight})}>{o}</button>)}</div><div className="sg-pair-column">{(solvedPairs.length?solvedPairs.map(pair=>pair.right):q.pairs).map((o,i)=><button key={i} className={`sg-option${pairRight===i?' selected':''}${solvedPairs.length||rightMatched.includes(i)?' correct':''}${pairFlash?.right===i?' wrong':''}`} disabled={busy||!!a||rightMatched.includes(i)} aria-pressed={pairRight===i} onClick={()=>pairLeft===null?setPairRight(i):submit({left:pairLeft,right:i})}>{o}</button>)}</div></div><div className="sg-pair-status" role="status"><div className="sg-pair-progress"><span className="sg-pair-dots" aria-hidden="true">{Array.from({length:4},(_,i)=><i key={i} className={i<matched.length?'done':''}/>)}</span><span>{matched.length} de 4 parejas</span></div>{!a&&<span className={`sg-pair-hint ${pairLast&&!pairLast.correct?'is-error':''}`}>{pairLast&&!pairLast.correct?'No encajan. Prueba otra pareja.':matched.length?'¡Bien! Sigue así.':'Une las cuatro para terminar.'}</span>}<small>{s.pair_state?.errors||0} {(s.pair_state?.errors||0)===1?'fallo':'fallos'} · Acertarás con un fallo o menos.</small></div></>:<div className={`sg-options ${type==='tf'?'tf':''}`} role={type==='multi'?'group':'radiogroup'} aria-label="Respuestas">{q.options.map((o,i)=>{
          const correct=!!a&&(a.correct_options||[a.correct_option]).includes(i),chosen=a?type==='multi'?(a.selected_options||[]).includes(i):a.choice===i:multi.includes(i),wrong=!!a&&!a.skipped&&chosen&&!correct
          return <button key={`${q.id}-${i}`} type="button" role={type==='multi'?'checkbox':'radio'} aria-checked={a?!!chosen:multi.includes(i)} disabled={busy||!!a} onClick={()=>pick(i)} className={`sg-option${type==='multi'?' multi':''}${!a&&multi.includes(i)?' selected':''}${correct?' correct':''}${wrong?' wrong':''}${a&&!correct&&!wrong?' dim':''}`} onKeyDown={e=>{if(['ArrowDown','ArrowRight','ArrowUp','ArrowLeft'].includes(e.key)){e.preventDefault();const delta=e.key==='ArrowDown'||e.key==='ArrowRight'?1:-1;e.currentTarget.parentElement.children[(i+delta+q.options.length)%q.options.length]?.focus()}}}><i aria-hidden="true">{type==='tf'?(TF_SYMBOLS[o.trim().toLocaleLowerCase('es')]||''):type==='multi'?chosen||correct?'✓':'':i+1}</i><span><GlossText text={o} option onWord={setWord} enabled={glossaryEnabled}/></span></button>
        })}</div>}
        {!!words.length&&<details className="sg-words-disclosure"><summary>Palabras útiles</summary><div className="sg-words">{words.map(w=><button type="button" className="sg-word" key={w} onClick={()=>setWord(w)} aria-label={`${w}: ver significado`}>{w}</button>)}</div></details>}
        {error&&<div className="sg-error" role="alert"><p>{error}</p><button className="sz-text-link" onClick={()=>setRevision(n=>n+1)}>Recuperar mi partida</button></div>}
      </div></div>
      <footer className={`sg-game-footer ${state} ${a?'has-feedback':''} ${a&&type==='match'?'is-pair-feedback':''} ${!a&&['multi','order','short'].includes(type)?'is-multi':''}`}>
        {a?<><section className="sg-feedback" tabIndex={-1} ref={feedbackRef} aria-label="Explicación de la respuesta">
          <div className="sg-feedback-heading"><span className="sg-feedback-symbol" aria-hidden="true">{a.correct?<CheckIcon/>:a.skipped||a.annulled?'💡':type==='match'?'↔':'×'}</span><div><h2>{a.annulled?'Pregunta anulada':a.skipped?'Ahora ya lo sabes':a.correct?type==='match'?'¡Parejas correctas!':'¡Correcto!':type==='match'?'Vamos a repasarlas':'Incorrecto'}</h2>{a.correct&&<strong className="sg-feedback-xp">{a.xp?`+${a.xp} XP`:isDemo?'Demostración · sin guardar XP':s.mode==='weekly'?'Puntos del reto · sin XP':q.category==='idioma'?(s.mode==='summit'||s.trail?.summit_practice?'Acierto del test · sin XP adicional':'Idiomas opcionales · sin XP'):'Ya acertada · sin XP adicional'}{combo>=3&&<> · 🔥 {combo} seguidas</>}</strong>}</div></div>
          {gift&&a.correct&&won.includes(s.trail.gift)&&<div className="sg-gift-banner"><span aria-hidden="true">🎁</span>¡Premio! {PRIZES[s.trail.gift].icon} {PRIZES[s.trail.gift].name} va a tu mochila.</div>}
          {type==='match'&&!a.annulled&&<p className="sg-pair-recap">{matched.length} de 4 parejas unidas · {s.pair_state?.errors||0} {(s.pair_state?.errors||0)===1?'fallo':'fallos'}</p>}
          {!a.annulled&&(!a.correct||type==='match')&&<FeedbackSolution key={`solution:${q.version_id||q.id}:${s.position}`} answer={a} question={q} matchedCount={matched.length} wrongPairs={s.pair_state?.wrong_pairs}/>}
          <FeedbackExplanation key={`reason:${q.version_id||q.id}:${s.position}`} text={a.explanation} renderText={text=><GlossText text={text} onWord={setWord}/>}/>
          {!a.skipped&&!a.annulled&&['choice','tf','image','false','multi','order'].includes(type)&&<CommunityAnswers key={`community:${s.id}:${s.position}`} sessionId={s.id} position={s.position} isDemo={isDemo} available={Object.hasOwn(summary?.player||{},'community_country')}/>}
          <div className="sg-feedback-links"><a href={a.source_url} target="_blank" rel="noopener noreferrer">Fuente: {a.source_title} ↗</a>{!isDemo&&<button onClick={()=>{setReportError('');setReportOpen(true)}}>⚑ Avisar de un error</button>}{a.guide_path&&<Link to={a.guide_path} target="_blank" rel="noopener noreferrer">Leer guía ↗</Link>}</div>
        </section><button className="sz-button sz-button--primary" disabled={busy} onClick={next}>{busy?'Guardando…':s.status==='completed'?'Ver mi resultado':state==='wrong'?'Entendido':'Continuar'}</button></>:<><button className="sz-button sz-button--ghost" disabled={busy} onClick={()=>submit({skip:true,choice:0})}>{busy?'Guardando…':'No lo sé'}</button>{['multi','order','short'].includes(type)&&<button className="sz-button sz-button--primary" disabled={busy||(type==='multi'?!multi.length:type==='order'?sequence.length!==q.options.length:!shortText.trim())} onClick={()=>submit(type==='short'?{text:shortText}:{choices:type==='order'?sequence:multi})}>{busy?'Comprobando…':'Comprobar'}</button>}</>}
      </footer>
      <Modal show={exitOpen} onClose={()=>!busy&&setExitOpen(false)} title={s.mode==='summit'?'¿Salir del test?':'¿Salir de la etapa?'}><div className="sz-stack sg-sheet-content"><p>{s.mode==='summit'?'El intento se contará como no superado. Conservas tus XP y podrás volver a intentarlo mañana.':isDemo?'Tu demostración se guarda en esta pestaña.':`Tus respuestas están guardadas. Podrás retomar la pregunta ${s.position+1} de ${s.total}.`}</p>{error&&<p className="sz-error-text" role="alert">{error}</p>}<button className="sz-button sz-button--primary" disabled={busy} onClick={()=>setExitOpen(false)}>Seguir jugando</button><button className="sz-button sz-button--secondary" disabled={busy} onClick={leave}>{busy?'Guardando…':s.mode==='summit'?'Salir del test':'Salir y continuar después'}</button></div></Modal>
      <Modal show={reportOpen} onClose={()=>!busy&&setReportOpen(false)} title="Avisar de un error"><form className="sz-form sg-sheet-content" onSubmit={report}><label className="sz-field">¿Qué has encontrado?<select value={reason} onChange={e=>setReason(e.target.value)}><option value="incorrect">Respuesta o explicación incorrecta</option><option value="outdated">Información desactualizada</option><option value="scope">No corresponde a este ámbito</option><option value="other">Otro problema</option></select></label><label className="sz-field">Detalle opcional<textarea value={notes} maxLength={1000} onChange={e=>setNotes(e.target.value)}/></label>{reportError&&<p role="alert">{reportError}</p>}<button className="sz-button sz-button--primary" disabled={busy}>{busy?'Enviando…':'Enviar aviso'}</button></form></Modal>
      <Modal show={!!word} onClose={()=>setWord(null)} title={word||'Palabra útil'} className="sg-glossary-sheet" showClose={false}><div className="sz-stack sg-sheet-content"><span className="sg-language-tag">{GLOSSARY[word]?.l==='ch'?'Suizo alemán':'Alemán'}</span><strong>{GLOSSARY[word]?.tr}</strong><p><GlossText text={GLOSSARY[word]?.d} onWord={setWord}/></p><button className="sz-button sz-button--primary" onClick={()=>setWord(null)}>Entendido</button></div></Modal>
    </>
  }
  return createPortal(<main ref={playerRef} className="sg-player" aria-label="Partida de Suizamente">{content}</main>,document.body)
}
function Results({session:s,summary,returnTo,isDemo,restart}){
  const navigate=useNavigate(),[streak,setStreak]=useState(false),m=MT[s.level],test=['summit','ascent'].includes(s.mode)||s.trail?.summit_practice,passed=!!s.ascent_passed,promoted=test&&passed&&!s.trail?.practice&&!s.trail?.summit_practice&&s.level<5,newLevel=promoted?s.level+1:s.level,awards=s.trail?.gifts||[],elapsed=s.completed_at&&s.created_at?Math.max(1,Math.round((new Date(s.completed_at)-new Date(s.created_at))/1000)):null,duration=elapsed===null?'—':`${Math.floor(elapsed/60)}:${String(elapsed%60).padStart(2,'0')}`
  const answered=s.history.length,valid=Math.max(0,answered-(s.annulled_count||0)),accuracy=valid?Math.round(s.correct_count/valid*100):0
  const title=isDemo?'¡Ya conoces el juego!':test?passed?promoted?`¡Has llegado a ${MT[newLevel].n}!`:s.level===5?'¡Matterhorn conquistado!':'¡Test superado!':'Test no superado':s.mode==='arrival'?'¡Llegada completada!':s.mode==='bonus'?awards.length?'¡Premio conseguido!':'¡Reto completado!':s.mode==='weekly'?'¡Reto semanal completado!':s.trail?.practice?'¡Práctica completada!':'¡Etapa completada!'
  const firstToday=s.trail?.streak_awarded,trail=summary?.trail,done=summary?.player?.level>s.level?m.st.length:new Set((trail?.nodes||[]).filter(n=>n.level===s.level&&n.node>=0&&n.node<m.st.length).map(n=>n.node)).size
  const failed=test&&!passed,description=isDemo?'Seis tipos de pregunta. Tu próxima montaña empieza en Latido.':failed?s.trail?.exit_failed?'Has salido del test antes de terminarlo.':`Llevabas ${s.correct_count} aciertos y has superado los ${Math.max(0,(s.valid_total??s.total)-(s.trail?.pass||m.pass))} fallos permitidos. Para aprobar hacen falta ${s.trail?.pass||m.pass} de ${s.valid_total??s.total}.`:test?`${s.correct_count} de ${s.valid_total??s.total} correctas en el test de ${m.top}.`:`${s.correct_count} de ${valid} correctas.${accuracy===100?' ¡Perfecto! Todas correctas.':''}`
  function finish(){if(firstToday&&!streak){setStreak(true);return}navigate(returnTo)}
  if(streak)return <div className="sg-result-screen is-streak"><div className="sg-result"><div className="sg-result-streak" aria-hidden="true">🔥</div><div className="sg-result-heading"><strong className="sg-streak-count">{trail?.streak||1}</strong><h1>{trail?.streak===1?'día':'días'} de racha</h1></div><StreakWeek trail={trail}/><p className="sg-result-description">¡Un día más! Juega mañana para seguir sumando.{!!trail?.inventory?.freeze&&<> Tienes {trail.inventory.freeze} 🧊 por si un día no puedes.</>}</p></div><footer className="sg-result-actions"><button className="sz-button sz-button--primary" onClick={finish}>Volver al camino</button></footer></div>
  return <div className={`sg-result-screen ${failed?'is-failed':''}`}><div className="sg-result"><div className="sg-result-heading">{failed?<span className="sg-result-climber" aria-hidden="true">🧗</span>:<SuizamenteMark/>}<h1>{title}</h1><p>{description}</p></div>
    {!failed&&s.correct_count>0&&<div className="sg-confetti" aria-hidden="true">{Array.from({length:12},(_,i)=><i key={i} style={{'--i':i,'--c':['#10b981','#2563eb','#f59e0b','#ef4444'][i%4]}}/>)}</div>}
    {failed&&<p className="sg-result-notice">Tus XP y tus etapas se mantienen. Puedes repetir el test desde las 00:00 del día siguiente, hora de Suiza. Mientras tanto, puedes repasar en el sendero.</p>}
    {awards.filter(id=>PRIZES[id]).map((id,i)=><div key={`${id}-${i}`} className="sg-prize-earned"><span aria-hidden="true">{PRIZES[id].icon}</span><div><strong>Has ganado {PRIZES[id].name}.</strong> {PRIZES[id].description}</div></div>)}
    {promoted&&<section className="sg-new-mountain"><div><MountainIcon level={newLevel}/><strong>Nuevo sendero: {MT[newLevel].n} · {MT[newLevel].alt}</strong></div><p>{MT[newLevel].way==='w'?'Wanderweg':MT[newLevel].way==='b'?'Bergwanderweg':'Alpinwanderweg'} · {MT[newLevel].st.length} etapas · {MT[newLevel].q} preguntas cada una · test de {MT[newLevel].test}</p></section>}
    {!isDemo&&!test&&s.mode!=='weekly'&&!s.trail?.practice&&<div className="sg-route-progress"><div aria-hidden="true">{m.st.map((_,i)=><span key={i} className={i<done?'done':''} style={{'--sg-route-color':szLevel(s.level).color}}/>)}<SwissFlag/></div><p>{done} de {m.st.length} etapas hacia {m.top}</p></div>}
    <div className="sg-result-score"><div><b>{s.mode==='weekly'?'PUNTOS':'XP GANADOS'}</b><span>⚡ {s.mode==='weekly'?s.correct_count*10:s.xp_gained}{s.trail?.x2&&<small>×2</small>}</span></div><div><b>ACIERTOS</b><span>🎯 {test?`${s.correct_count}/${s.valid_total??s.total}`:`${accuracy} %`}</span></div><div><b>TIEMPO</b><span>⏱ {duration}</span></div></div>
    {test&&s.trail?.life&&<p className="sz-muted">❤️ Has utilizado una vida extra en este test.</p>}
    {s.trail?.practice&&<p className="sz-muted">Repetir afianza tus conocimientos. Los aciertos y premios ya ganados no se duplican.</p>}
    {isDemo&&<section className="sz-card sz-stack"><p>La demostración no guarda XP ni premios. Inicia sesión para elegir tu cantón y guardar el sendero en tu cuenta.</p><Link className="sz-button sz-button--primary" to="/auth?next=%2Fsuizamente">Empezar mi ascenso</Link><button className="sz-text-link" onClick={restart}>Repetir la demostración</button></section>}
    {s.mode==='weekly'&&<Link className="sz-button sz-button--primary" to="/suizamente/reto">Ver clasificación y privacidad</Link>}
    {s.category==='idioma'&&summary?.config?.school_name&&/^https:\/\//.test(summary.config.school_url)&&<section className="sz-card sz-stack"><span className="sz-pill">Escuela colaboradora</span><strong>¿Quieres seguir con el alemán?</strong><p>Conoce los cursos de {summary.config.school_name}. Visitar la escuela no comparte tus respuestas.</p><a href={summary.config.school_url} target="_blank" rel="noopener noreferrer sponsored">Ver cursos ↗</a></section>}
    {!!s.review_answers?.length&&<section className="sz-stack"><h2 className="sz-h2">Lo que has aprendido</h2><div className="sz-card sz-answer-review">{s.review_answers.map(a=><details key={a.position}><summary><span className={`sz-review-icon is-${a.correct?'correct':a.skipped?'skipped':'wrong'}`}>{a.correct?'✓':a.skipped?'?':'×'}</span><span>{reviewStatement(a)}</span></summary><div>{a.skipped?<p>Elegiste «No lo sé».</p>:a.chosen_answer&&<p>Tu respuesta: {a.chosen_answer}</p>}{a.correct_pairs?.length?<AnswerPairs pairs={a.correct_pairs}/>:<p><strong>{a.correct_answer}</strong></p>}<p>{a.explanation}</p><a href={a.source_url} target="_blank" rel="noopener noreferrer">Fuente: {a.source_title} ↗</a></div></details>)}</div></section>}
    {!!s.annulled_count&&<p className="sz-muted">{s.annulled_count} pregunta(s) anulada(s). Se conservan los XP recibidos; no cuentan como aciertos ni como puntos del reto.</p>}
  </div><footer className="sg-result-actions"><button className="sz-button sz-button--primary" onClick={finish}>{firstToday?'Continuar':promoted?`Ver el sendero de ${MT[newLevel].n}`:returnTo==='/'?'Volver a Inicio':'Volver al camino'}</button></footer></div>
}
