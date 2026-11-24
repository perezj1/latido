import {useEffect,useRef,useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {useSv} from './Context'
import {Button,Card,Sheet} from './Shared'
import {szApi} from '../../../lib/suizamenteV2'
import {dibujarHistoria,compartirHistoria} from './story'
import {SHARE_URL,SHARE_HOST,shareText,victoryImage,cleanShareText} from './shareData'

async function copyText(text){
  if(navigator.clipboard){await navigator.clipboard.writeText(text);return}
  const area=document.createElement('textarea');area.value=text;area.style.cssText='position:fixed;left:-10000px;top:0';document.body.append(area);area.select()
  try{if(!document.execCommand('copy'))throw new Error('Selecciona y copia el enlace de esta hoja.')}finally{area.remove()}
}
export async function inviteSomeone(){
  const data=await szApi('invitaciones',{method:'POST'})
  const url=SHARE_URL+data.enlace
  if(navigator.share)await navigator.share({title:'Suizamente',text:'¿Jugamos una partida de Suizamente?',url})
  else await copyText(url)
  return url
}
export function ShareSheet({data,onClose}){
  const {user}=useSv(),navigate=useNavigate(),canvas=useRef(null),prepared=useRef(null),[imageReady,setImageReady]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false)
  const previewKey=JSON.stringify(data)
  useEffect(()=>{let active=true;prepared.current=null;setImageReady(false);const draft=document.createElement('canvas');dibujarHistoria(draft,JSON.parse(previewKey)).then(()=>{if(!active)return;canvas.current.width=draft.width;canvas.current.height=draft.height;canvas.current.getContext('2d').drawImage(draft,0,0);draft.toBlob(blob=>{if(active){prepared.current=blob;setImageReady(!!blob)}},'image/png')}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[previewKey])
  const url=data.url||SHARE_URL,text=shareText(data)
  async function run(fn){setBusy(true);setError('');try{await fn()}catch(e){if(e.name!=='AbortError')setError(e.message)}finally{setBusy(false)}}
  return <Sheet title="📤 Compartir" onClose={onClose}><p className="sv-muted">Así se verá tu historia. Tu nombre no aparece.</p><canvas ref={canvas} className="sv-story-preview" aria-label="Vista previa de la historia"/><div className="sv-share-actions"><Button disabled={busy||!imageReady} tone="quiet" onClick={()=>run(()=>compartirHistoria(data,prepared.current))}>📸 Imagen para historias</Button><Button disabled={busy} tone="quiet" onClick={()=>run(async()=>{if(navigator.share)await navigator.share({text,url});else{await copyText(text);setNotice('Texto y enlace copiados')}})}>💬 Enviar a un grupo</Button><Button disabled={busy} tone="quiet" onClick={()=>run(async()=>{await copyText(text);setNotice('Texto copiado')})}>📋 Copiar texto</Button><Button disabled={busy} onClick={()=>user?run(async()=>{const link=await inviteSomeone();setNotice('Invitación lista: '+link)}):navigate('/suizamente/entrar')}>⚔️ Retar a alguien</Button></div>{notice&&<p role="status">{notice}</p>}{error&&<p className="sv-error" role="alert">{error}</p>}</Sheet>
}
export function storyData(kind,data){
  const base={enlace:SHARE_HOST,url:SHARE_URL,opciones:[]}
  if(kind==='dia'){
    const visible=data.pct!=null&&(data.total==null||data.total>=20)
    const texto=cleanShareText((data.emoji||'')+' '+data.pregunta)+'\n'+(visible?'Así votan los hispanohablantes en Suiza:\n':'')+data.opciones.map((o,i)=>cleanShareText((o.e||'')+' '+o.t)+(visible?' — '+data.porcentajes[i]+' %':'')).join('\n')+'\n¿Y tú qué eliges?'
    return {...base,titular:data.pct==null||data.total!=null&&data.total<20?[{t:'¿Qué eligen los hispanohablantes en Suiza?'}]:[{t:'El '},{t:data.pct+' %',resaltado:true},{t:' de los hispanohablantes en Suiza piensa lo mismo que yo'}],
      texto,pregunta:data.pregunta,opciones:data.opciones.map((o,i)=>({texto:o.t,pct:visible?data.porcentajes?.[i]??null:null})),cierre:'¿Y tú qué eliges? 🤔',url:SHARE_URL+'?p='+encodeURIComponent(data.id)}
  }
  if(kind==='perfil')return {...base,titular:[{t:'Mi vida en Suiza, pregunta a pregunta'}],pregunta:'⭐ Nivel '+data.nivel+(data.especialidad?' · '+data.especialidad:''),
    cierre:'¿Jugamos una partida? 🎡'}
  return {...victoryImage(data),titular:data.ganador===data.tuId?victoryImage(data).titular:[{t:'Una partida más sobre la vida en Suiza'}]}
}
export function Breakdown({id,initial,real=false}){
  const {config}=useSv(),[data,setData]=useState(initial||null),[tab,setTab]=useState('pais')
  useEffect(()=>{let active=true;if(!initial&&id)szApi('resultados/'+encodeURIComponent(id)).then(d=>{if(active)setData(d.desglose)}).catch(()=>{});return()=>{active=false}},[id,initial])
  const countries=data?.pais||[],years=data?.anos||[]
  if(!countries.length&&!years.length)return <p className="sv-privacy">🔒 Por país y por años en Suiza · Se ve cuando cada grupo tenga {config.minimoVotosParaPorcentajes||20} votos</p>
  const actual=tab==='pais'&&countries.length?'pais':years.length?'anos':'pais'
  const labels={menos1:'Menos de 1 año','1a3':'De 1 a 3 años','3a10':'De 3 a 10 años',mas10:'Más de 10 años'}
  return <Card className="sv-breakdown"><h2>{real?'¿Quién lo sabía?':'Eligieron lo mismo'}</h2><div className="sv-tab-pills" role="tablist">{countries.length>0&&<button role="tab" aria-selected={actual==='pais'} onClick={()=>setTab('pais')}>País</button>}{years.length>0&&<button role="tab" aria-selected={actual==='anos'} onClick={()=>setTab('anos')}>Años en Suiza</button>}</div>{(data[actual]||[]).map(g=><div key={g.grupo} className={g.tuyo?'yours':''}><div className="sv-between"><b>{actual==='pais'?(countryLabel(g.grupo)):labels[g.grupo]||g.grupo}</b><b>{g.pct} %</b></div><div className="sv-xp-bar"><i style={{width:g.pct+'%'}}/></div></div>)}</Card>
}
function countryLabel(code){try{return new Intl.DisplayNames(['es'],{type:'region'}).of(code)}catch{return code}}
export function FactCard({id,dato,guardada=false,question,share,onChange}){
  const {player}=useSv(),navigate=useNavigate(),[saved,setSaved]=useState(guardada),[error,setError]=useState(''),[notice,setNotice]=useState(''),[report,setReport]=useState(false),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[sharing,setSharing]=useState(false)
  useEffect(()=>{setSaved(guardada)},[guardada,id])
  async function save(){
    if(!player){sessionStorage.setItem('suizamente:despues-perfil',location.pathname+location.search);navigate('/suizamente/perfil/nuevo');return}
    setBusy(true);setError('')
    try{const d=await szApi('libreta',{method:'PUT',body:{preguntaId:id,guardar:!saved}});setSaved(d.guardada);setNotice(d.guardada?'Guardado en tu libreta':'Quitado de tu libreta');onChange?.(d.guardada)}catch(e){setError(e.message)}finally{setBusy(false)}
  }
  async function sendReport(){setBusy(true);try{await szApi('reportes',{method:'POST',body:{preguntaId:id,motivo:reason}});setReport(false);setNotice('Gracias por avisar')}catch(e){setError(e.message)}finally{setBusy(false)}}
  return <><Card className="sv-fact"><div className="sv-between"><b>💡 ¿Sabías que…?</b><button className={'sv-bookmark '+(saved?'saved':'')} aria-label={saved?'Quitar de la libreta':'Guardar en la libreta'} aria-pressed={saved} disabled={busy} onClick={save}>🔖</button></div><p>{dato}</p><div className="sv-fact-actions"><button onClick={()=>setReport(true)}>⚠️ Reportar</button>{share&&<button onClick={()=>setSharing(true)}>📤 Compartir</button>}</div></Card>{notice&&<p className="sv-muted" role="status">{notice}</p>}{error&&<p className="sv-error" role="alert">{error}</p>}{report&&<Sheet title="¿Qué está mal?" onClose={()=>setReport(false)}><p className="sv-muted">{question}</p><textarea aria-label="Qué está mal" maxLength={300} value={reason} onChange={e=>setReason(e.target.value)}/><Button disabled={busy||!reason.trim()} onClick={sendReport}>Enviar aviso</Button></Sheet>}{sharing&&<ShareSheet data={share} onClose={()=>setSharing(false)}/>}</>
}
