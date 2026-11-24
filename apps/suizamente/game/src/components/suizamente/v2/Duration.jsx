import {useState} from 'react'
import {Link,useLocation} from 'react-router-dom'
import {useSv} from './Context'
import {DailyHome} from './DailyPreview'
import {useData} from './useData'
import {Avatar,Button,Card,Header,Stamps,Wallet,LatidoBackdrop} from './Shared'
import {MapDrawing} from './Map'
import {szApi,timeLeft} from '../../../lib/suizamenteV2'
import {Confetti} from './Finish'

export function DurationHome(){
  const {data}=useData('misiones',{refreshMs:15000}),{data:league}=useData('liga',{refreshMs:30000})
  const own=league?.filas.find(p=>p.tu),division=league?.reglas.divisiones.find(d=>d.id===league.division)
  return <>
    <div className="sv-home-daily-grid">{data&&<Link className="sv-missions-entry" to="/suizamente/misiones"><span>🎯</span><div><b>Misiones</b><span><i className="sv-home-map-progress"><i style={{width:100*data.misiones.filter(m=>m.cobrada).length/data.misiones.length+'%'}}/></i><strong>{data.misiones.filter(m=>m.cobrada).length}/{data.misiones.length}</strong></span></div></Link>}<DailyHome compact/></div>
    {division&&<Link className="sv-league-entry" to="/suizamente/ranking?tab=liga"><span>{division.emoji}</span><div><b>{division.nombre}{own?' · '+own.puesto+'.º de '+league.filas.length:''}</b><small>{own&&own.destino!==league.division?(league.reglas.divisiones.findIndex(d=>d.id===own.destino)>league.reglas.divisiones.findIndex(d=>d.id===league.division)?'⬆️ En zona de ascenso':'⬇️ En zona de descenso'):'Termina el domingo'}</small></div>›</Link>}
  </>
}
export function ProfileDuration(){
  const {player}=useSv(),{data}=useData('liga'),division=data?.reglas.divisiones.find(d=>d.id===data.division)
  return <>{division&&<Link className="sv-league-entry" to="/suizamente/ranking?tab=liga"><span>{division.emoji}</span><b>{division.nombre}</b>›</Link>}{player.marco&&<Card>{player.marco.emoji} Marco {player.marco.marco}</Card>}</>
}
export function Missions(){
  const {data,error,reload}=useData('misiones',{refreshMs:15000}),{config}=useSv(),[busy,setBusy]=useState(false),[fault,setFault]=useState('')
  async function change(m){setBusy(true);setFault('');try{await szApi('misiones/cambiar',{method:'POST',body:{fecha:data.fecha,dificultad:m.dificultad,version:m.version}});reload()}catch(e){setFault(e.message);if(e.status===409)reload()}finally{setBusy(false)}}
  const icons={aciertos:'✅',sellos:'🛂',ganar:'🏆',seguidas:'🔥',duelo:'⚔️',construir:'🏗️',sobres:'🃏',dia:'📊',turnos:'🎡'}
  const event=data?data.evento:config.evento
  return <section className="sv-screen"><Header title="🎯 Misiones" right={<Wallet/>}/><div className="sv-content">
    <p className="sv-muted">{data?.renuevaEn?'Se renuevan en '+timeLeft(data.renuevaEn,Date.parse(data.servidorAhora))+', a medianoche de Zúrich.':'Se renuevan a medianoche, hora de Zúrich.'} Puedes cambiar una al día.</p>
    {data?.misiones.map(m=><Card className={'sv-mission '+(m.cobrada?'complete':'')} key={m.dificultad}>
      <span className="sv-mission-icon" aria-hidden="true">{icons[m.tipo]||'🎯'}</span><div className="sv-mission-main"><small className="sv-sr-only">{({facil:'Fácil',media:'Media',dificil:'Difícil'})[m.dificultad]}</small><h2>{m.texto}</h2><div className="sv-mission-progress"><div className="sv-xp-bar" role="progressbar" aria-label={m.texto} aria-valuenow={m.avance} aria-valuemin={0} aria-valuemax={m.meta}><i style={{width:100*m.avance/m.meta+'%'}}/></div><b>{m.avance}/{m.meta}</b></div></div>
      <div className="sv-mission-side"><span className="sv-chip">🪙 {m.premio.monedas}{m.premio.sobres?' · 🃏 '+m.premio.sobres:''}</span>{m.cobrada?<b>✓ Cobrada</b>:<button className="sv-mini-button" disabled={busy||!data.cambiosRestantes} onClick={()=>change(m)}>🔄 Cambiar</button>}</div>
    </Card>)}
    {data?.cofre?<Button to={'/suizamente/cofre/'+data.cofre.id+'?volver=/suizamente/misiones'}>{data.cofre.abierto?'🎁 Ver cofre diario':'🎁 Abrir cofre diario'}</Button>:<Card><h2>🎁 Cofre diario</h2><p>Completa las {config.misiones.porDia} misiones para abrirlo.</p></Card>}
    {event&&<Card className="sv-weekend-event"><h2>🎉 {event.titulo}</h2><p>{event.efecto}</p><small>⏳ {timeLeft(event.fin)}</small></Card>}
    {!data&&!error&&<div className="sv-skeleton" role="status" aria-label="Cargando misiones"/>}
    {(error||fault)&&<Card><p className="sv-error" role="alert">{error||fault}</p><Button tone="quiet" onClick={reload}>Reintentar</Button></Card>}
  </div></section>
}
export function League(){
  const {data,error,reload}=useData('liga',{refreshMs:15000})
  if(!data)return <div className="sv-content">{error?<Card><p role="alert">{error}</p><Button onClick={reload}>Reintentar</Button></Card>:<div className="sv-skeleton" role="status" aria-label="Cargando liga"/>}</div>
  const rules=data.reglas,index=rules.divisiones.findIndex(d=>d.id===data.division),division=rules.divisiones[index]
  return <><Card className="sv-league-heading"><span>{division.emoji}</span><h2>{division.nombre}</h2><p>{data.grupo?'Grupo de '+data.filas.length:'Aún no tienes grupo'} · termina en {timeLeft(data.fin)}</p>
    {index<rules.divisiones.length-1&&<small>⬆️ {rules.suben} suben a {rules.divisiones[index+1].nombre}</small>}{index>0&&<small>⬇️ {rules.bajan} bajan a {rules.divisiones[index-1].nombre}</small>}</Card>
    {!data.filas.length&&<Card>Juega una partida esta semana para entrar en un grupo el lunes.</Card>}
    <div className="sv-ranking-list">{data.filas.map((r,i)=><div key={r.id}>
      {i===rules.suben&&index<rules.divisiones.length-1&&<p className="sv-league-zone">⬆️ Zona de ascenso</p>}
      {i===Math.max(rules.suben,data.filas.length-rules.bajan)&&index>0&&<p className="sv-league-zone down">⬇️ Zona de descenso</p>}
      <Link className={'sv-rank-row '+(r.tu?'you':'')} to={'/suizamente/jugador/'+r.id}><span>{['🥇','🥈','🥉'][i]||r.puesto}</span><Avatar id={r.id} name={r.apodo} color={r.color} marco={r.marco}/><b>{r.tu?'Tú':r.apodo}</b><strong>{r.puntos}</strong></Link>
    </div>)}</div><Card><h2>Premios de la semana</h2>{rules.premiosDomingo.map(p=><p key={p.desde}>{p.desde===p.hasta?p.desde:p.desde+'–'+p.hasta}.º · 🪙 {Math.round(p.monedas*division.multiplicadorPremio)}{p.sobres?' · 🃏 '+Math.round(p.sobres*division.multiplicadorPremio):''}</p>)}<small>{rules.puntos.partidaGanada} puntos por victoria · {rules.puntos.selloGanado} por sello. Los empates se ordenan por quién llegó antes a la puntuación.</small></Card>
  </>
}
export function LapComplete(){
  const {search}=useLocation(),lap=new URLSearchParams(search).get('vuelta'),{data,error}=useData('mapa/vuelta?vuelta='+encodeURIComponent(lap)),{config}=useSv()
  const style=config.vueltasMapa.vueltas[Math.min(Number(lap)-1,config.vueltasMapa.vueltas.length-1)]
  const levels=Object.fromEntries(config.mapa.regiones.flatMap(r=>r.cantones.map(k=>[k.id,config.mapa.nivelesPorCanton])))
  return <section className="sv-screen sv-themed-screen"><LatidoBackdrop tint={config.vueltasMapa.vueltas[Math.min(Number(lap),config.vueltasMapa.vueltas.length-1)]?.colores[1]}/><Header title="Vuelta completa"/>{data?<><Confetti/><div className="sv-content sv-lap-complete"><h1>🎉 ¡{style?.nombre} completa!</h1><MapDrawing region={config.mapa.regiones.length} levels={levels} vuelta={Number(lap)}/><h2>🪙 +{data.monedas}</h2><p>{style?.emoji} Marco {style?.marco}</p><Stamps categories={config.categorias}/></div><footer className="sv-footer"><Button to="/suizamente/mapa">▶ A por la vuelta {data.vuelta+1}</Button></footer></>:<div className="sv-content">{error?<p role="alert">{error}</p>:<div className="sv-skeleton"/>}</div>}</section>
}
