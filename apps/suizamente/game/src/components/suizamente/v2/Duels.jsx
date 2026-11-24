import {useState} from 'react'
import {useSv} from './Context'
import {Avatar,Button,Card,Earnings,Header,Stamps} from './Shared'

export function Powerups({match,act,busy,remaining}){
  const {config:globalConfig,player}=useSv(),config={...globalConfig,...match.configPartida},q=match.pregunta
  if(!q)return null
  return <div className="sv-powerups" aria-label="Comodines">{config.comodines.map(c=>{
    const count=player.inventario?.[c.id]||0
    const used=q.usados?.includes(c.id)
    const blocked=busy||remaining===0||count===0||used||c.noEnModos.includes(q.modo)||(c.soloConTresOpciones&&q.opciones.length!==3)
    return <button key={c.id} aria-label={c.nombre+': tienes '+count} aria-pressed={!!used} disabled={blocked} onClick={()=>act('comodin',{n:q.n,tipo:c.id})}><span>{c.emoji}<small>{count}</small></span><b>{c.nombre}</b>{used&&<em>✓</em>}</button>
  })}</div>
}
export function DuelPrepare({match,act,onClose}){
  const {config:globalConfig,player}=useSv(),config={...globalConfig,...match.configPartida}
  const canTake=match.susSellos.filter(k=>!match.tusSellos.includes(k)),canBet=match.tusSellos.filter(k=>!match.susSellos.includes(k))
  const [take,setTake]=useState(canTake[0]),[bet,setBet]=useState(canBet[0]),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const choose=(keys,value,setter)=> <div className="sv-duel-select">{keys.map(id=>{
    const c=config.categorias.find(c=>c.id===id)
    return <button key={id} aria-pressed={id===value} onClick={()=>setter(id)} style={{'--category':c.color,'--tint':c.tinte}}><span>{c.emoji}</span><b>{c.nombre}</b></button>
  })}</div>
  async function start(){
    setBusy(true);setError('')
    const result=await act('duelo',{quitar:take,apostar:bet})
    if(result)onClose();else setError('No se pudo empezar el duelo. Revisa la partida e inténtalo otra vez.')
    setBusy(false)
  }
  return <section className="sv-screen"><Header title="⚔️ Duelo de sellos" right={<button className="sv-icon-button" onClick={onClose} aria-label="Cerrar preparación del duelo">✕</button>}/><div className="sv-content"><div className="sv-duel-vs"><Avatar name={player.apodo} color={player.color}/><b>VS</b><Avatar name={match.rival?.apodo} color={match.rival?.color}/></div><h2>1 · ¿Qué sello le quitas a {match.rival?.apodo}?</h2>{choose(canTake,take,setTake)}<h2>2 · ¿Qué sello apuestas tú?</h2>{choose(canBet,bet,setBet)}<div className="sv-duel-stakes"><Card><small>SI GANAS</small><b>Te lo llevas</b><Stamps categories={config.categorias.filter(c=>c.id===take)} owned={[take]}/></Card><Card><small>SI PIERDES</small><b>Se lo queda</b><Stamps categories={config.categorias.filter(c=>c.id===bet)} owned={[bet]}/></Card></div><p className="sv-muted">📝 {config.duelo.preguntas} preguntas, una por categoría</p><p className="sv-muted">🏆 Gana quien acierte más · ⚖️ Empate: desempate</p>{error&&<p className="sv-error" role="alert">{error}</p>}</div><footer className="sv-footer"><Button tone="danger" disabled={busy||!take||!bet} onClick={start}>⚔️ ¡Al duelo!</Button><Button tone="quiet" onClick={onClose}>Volver a elegir sello</Button></footer></section>
}
export function DuelResult({match,act,busy}){
  const {config}=useSv(),d=match.duelo,won=d.ganador===match.tuId
  const score=values=>values.filter(Boolean).length
  const stamp=config.categorias.find(c=>c.id===d.sello)
  return <section className="sv-screen"><div className="sv-content sv-duel-result"><span className="sv-finish-emoji">{won?'🏆':'💔'}</span><h1>{won?'¡Duelo ganado!':'Duelo perdido'}</h1><p>{d.desempate?'Se decidió en el desempate':'Contra '+match.rival?.apodo}</p><Card><div className="sv-duel-score"><b>Tú</b><strong>{score(d.tusAciertos)} – {score(d.susAciertos)}</strong><b>{match.rival?.apodo}</b></div>{config.categorias.map((c,i)=><div className="sv-duel-row" key={c.id}><span className={d.tusAciertos[i]?'right':'wrong'}>{d.tusAciertos[i]?'✓':'✕'}</span><b>{c.emoji} {c.nombre}</b><span className={d.susAciertos[i]?'right':'wrong'}>{d.susAciertos[i]?'✓':'✕'}</span></div>)}</Card><Card className={won?'sv-duel-won':'sv-duel-lost'}><b>{stamp?.emoji} {won?'El sello de '+stamp?.nombre+' es tuyo':match.rival?.apodo+' se queda tu sello de '+stamp?.nombre}</b></Card><Earnings value={d.premio}/></div><footer className="sv-footer"><Button disabled={busy} onClick={()=>act('duelo',{operacion:'continuar'})}>▶ Seguir la partida</Button></footer></section>
}
