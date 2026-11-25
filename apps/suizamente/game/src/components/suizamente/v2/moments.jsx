import {Icono,iconizar,UiIcon,IconText} from './Icono'
import {MomentObject,MomentStamp,MomentSummary,MomentTokens} from './Moment'
import {cantonNames} from '../../../lib/suizamenteV2'
import {MapDrawing} from './Map'
import {cardImage,collectionImage,duelImage,victoryImage} from './shareData'

// Only present confirmed results. No prices, rewards or random choices live here.
export function rewardTokens(reward={},config={}){
  const items=[]
  if(reward.monedas>0)items.push(['🪙','+'+reward.monedas,'monedas'])
  if(reward.xp>0)items.push(['⭐','+'+reward.xp,'XP'])
  for(const [id,n] of Object.entries(reward.inventario||{})){
    if(n<=0)continue
    const power=config.comodines?.find(c=>c.id===id)
    items.push([power?.emoji||(id==='sobres'?'🃏':'🛡️'),'+'+n,power?'comodín '+power.nombre:id==='sobres'?'sobre de cartas':'escudo'])
  }
  return items
}
const league=(config,key)=>{const n=config.ligas?.puntos?.[key];return n>0?[['🏅','+'+n,n===1?'punto de liga':'puntos de liga']]:[]}
export function welcomeSteps(config){const gift=config.bienvenida;return [
 {title:'¡Tu regalo de bienvenida!',subtitle:'Para empezar con buen pie',sound:'sintonia',open:true,body:<MomentObject/>},
 {title:'¡Esto es para ti!',subtitle:'Para tu primera partida',confetti:true,footer:'Toca para jugar',body:<MomentTokens items={[
  ['🪙','+'+gift.monedas,'monedas'],['🃏',String(gift.sobres),gift.sobres===1?'sobre de cartas':'sobres de cartas'],
  ...Object.entries(gift.comodines).map(([id,n])=>{const c=config.comodines.find(c=>c.id===id);return [c.emoji,'+'+n,'comodín «'+c.nombre+'»']}),
 ]}/>},
]}
export function giftSteps(result,shop){
  const power=shop.comodines.find(c=>c.id===result.comodin)
  return [{title:'¡Regalo diario!',subtitle:'Hay uno nuevo cada día',open:true,body:<MomentObject/>},
    {title:'¡Esto es para ti!',subtitle:'Tu regalo de hoy',confetti:true,body:<MomentTokens items={rewardTokens({monedas:shop.regalo.monedas,inventario:{[result.comodin]:shop.regalo.comodinesAlAzar}},shop)}/> }]
}
export function chestSteps(chest,config){return [
  {title:chest.titulo,subtitle:'¡Te lo has ganado!',open:true,body:<MomentObject kind="chest"/>},
  {title:'Dentro había…',confetti:true,body:<><MomentTokens items={rewardTokens(chest.contenido,config)}/>{chest.contenido.escudosAlMaximo&&<p className="sv-moment-note"><Icono nombre="escudo"/> Ya tienes el máximo de escudos.</p>}</>},
]}
export function packSteps(pack){
  const fresh=pack.cartas.filter(c=>c.nueva).length,repeated=pack.cartas.filter(c=>!c.nueva),amounts=[...new Set(repeated.map(c=>c.monedas))]
  const rare=pack.cartas.find(c=>c.nueva&&c.r===3)
  const steps=[{title:'¡Nuevo sobre!',subtitle:pack.total===3?'Tres cartas para tu álbum':pack.total+' cartas para tu álbum',tint:'#DFE7FC',open:true,body:<MomentObject pack total={pack.total}/>},
    {title:fresh===1?'¡Una carta nueva!':fresh?'¡'+fresh+' cartas nuevas!':'Todas repetidas',subtitle:repeated.length?(amounts.length===1?'Las repetidas se cambian solas por 🪙 '+amounts[0]:'Las repetidas se cambian solas por monedas'):'Ya están en tu álbum',tint:'#DFE7FC',confetti:fresh>0,body:<div className="sv-moment-cards">{pack.cartas.map((c,i)=><div key={i} className="sv-moment-card" style={{'--delay':(.2+i*.35)+'s'}}><small aria-label={c.r+' estrellas'}>{'★'.repeat(c.r)}</small><span data-sz-content aria-hidden="true">{c.e}</span><b data-sz-content>{c.n}</b><em className={c.nueva?'new':''}>{iconizar(c.nueva?'NUEVA':'🪙 +'+c.monedas)}</em></div>)}</div>},
  ]
  if(rare)Object.assign(steps[1],{image:cardImage(rare),shareLabel:'Compartir tu carta'})
  for(const col of pack.coleccionesCompletadas||[])steps.push({title:'¡Colección completa!',subtitle:col.nombre,tint:'#FEEDD1',confetti:true,image:collectionImage(col),shareLabel:'Compartir tu colección',body:<><div className="sv-moment-collection" role="img" aria-label={col.nombre+': '+col.cartas.map(c=>c.n).join(', ')}>{col.cartas.map((c,i)=><span key={c.id} data-sz-content aria-hidden="true" style={{'--delay':(.2+i*.07)+'s'}}>{c.e}</span>)}</div><MomentTokens items={rewardTokens(col.premioEntregado,{comodines:[{id:'quita',emoji:'✂️',nombre:'Quita una'}]})}/></>})
  return steps
}
export function stampSteps(match,config){
  const result=match.resultado,category=config.categorias.find(c=>c.id===result.categoria)
  return [{title:'¡Sello conseguido!',subtitle:category.nombre+' ya está en tu pasaporte',sound:'premio',tint:category.tinte,confetti:true,body:<><MomentStamp category={category} size={112}/><MomentTokens items={[...rewardTokens(result.ganado),...league(config,'selloGanado')]}/></>}]
}
export function duelSteps(match,config){
  const duel=match.duelo,won=duel.ganador===match.tuId,category=config.categorias.find(c=>c.id===duel.sello),stamp=[<MomentStamp category={category}/>,'Sello',category?.nombre]
  return [won?{title:'¡Duelo ganado!',subtitle:'Contra '+match.rival?.apodo,sound:'premio',tint:'#D3F8F3',confetti:true,image:duelImage(duel.sello),body:<MomentSummary hero="🏆" gain={[stamp,...rewardTokens(duel.premio),...league(config,'selloGanado')]}/>}:
    {title:'Duelo perdido',subtitle:match.rival?.apodo+' se queda tu sello',tint:'#FFE1E2',grey:true,body:<MomentSummary hero="💔" loss={[stamp]} note="Puedes recuperarlo en otro duelo"/>}]
}
export function finishSteps(match,config){
  const won=match.ganador===match.tuId
  const subtitle=won?(match.motivoFin==='sellos'?'Has llenado tu pasaporte antes que ':'Has ganado la partida contra ')+match.rival?.apodo:match.ganador?match.rival?.apodo+' terminó la partida':'La partida ha terminado'
  return [{sound:won?'victoria':undefined,title:won?'¡Victoria!':match.ganador?'Esta vez no':'Partida terminada',subtitle,tint:won?'#FEEDD1':'#DFE7FC',grey:!won,confetti:won,image:won?victoryImage(match):undefined,body:<MomentSummary hero={won?'🏆':'🫶'} gain={[...rewardTokens(match.premio),...(match.cofre?[[<Icono nombre="cofre"/>,'1','cofre']]:[]),...(won?league(config,'partidaGanada'):[])]} note={!won?'No pierdes nada de tu mapa ni de tu álbum':undefined}/>}]
}
export function cantonSteps(name,landmark,image){return [{sound:'premio',title:'¡Cantón completo!',subtitle:name+' ya tiene su monumento',tint:'#D3F8F3',confetti:true,image,shareLabel:'Compartir mi Suiza',body:<><div className="sv-moment-canton-photo"><img src={image.foto} alt={'Maqueta de '+name+' con su monumento'} style={{objectFit:image.ajuste==='contener'?'contain':'cover'}}/></div><span className="sv-moment-landmark">🏰 {landmark||'Monumento'}</span></>} ]}
export function raidSteps(raid){
  const changed=raid.nivelFinal!=null&&raid.nivelFinal<raid.nivelInicial,won=raid.premio>0||changed,other=[]
  if(raid.escudo)other.push(['🛡️','−1','escudo'])
  if(changed)other.push([<MapDrawing only={raid.canton} levels={{[raid.canton]:raid.nivelFinal}} label={cantonNames[raid.canton]}/>,'Nivel '+raid.nivelFinal,cantonNames[raid.canton]+' baja un nivel'])
  return [{sound:won&&raid.estado!=='cancelado'?'premio':undefined,title:raid.estado==='cancelado'?'Asalto cancelado':raid.escudo?'¡Lo paró un escudo!':won?'¡Asalto con éxito!':'Asalto fallido',subtitle:won?'Al mapa de '+raid.victima?.apodo:'Esta vez no hubo suerte',tint:raid.escudo?'#DFE7FC':won?'#FEEDD1':'#F4F7FB',grey:!won,confetti:won&&!raid.escudo,body:<MomentSummary hero={raid.escudo?'🛡️':'⚔️'} gain={rewardTokens({monedas:raid.premio})} other={other.length?[raid.victima?.apodo+' pierde',other]:undefined} nothing={!won?'No pierdes nada':undefined}/>}]
}
export const isAbsenceNotice=notice=>['asalto','escudo','duelo','duelo_terminado','duelo_ganado','duelo_perdido'].includes(notice.tipo)
export function absenceSteps(events){return [{title:'Mientras no estabas',subtitle:'Esto ha pasado en tus partidas y en tu mapa',tint:'#FFE1E2',grey:true,body:<div className="sv-moment-events">{events.map((event,i)=><div key={event.id} className={'sv-moment-event'+(event.loss?' loss':'')} style={{'--delay':(.25+i*.25)+'s','--shake-delay':(.75+i*.25)+'s'}}><span aria-hidden="true"><UiIcon value={event.icon}/></span><span><b><IconText>{event.title}</IconText></b>{event.detail&&<small><IconText>{event.detail}</IconText></small>}</span></div>)}</div>} ]}
export function noticeEvent(notice){
  const d=notice.datos,text=d.texto||'',shield=/escudo/i.test(text),loss=d.perdido||/robado|baja|se lleva|perdido|ha asaltado/i.test(text)
  // Some older notices only carry their server-written text; never invent an amount.
  return {id:notice.id,title:text,detail:d.detalle,icon:shield?'🛡️':notice.tipo==='asalto'?'⚔️':'🛂',loss:!!loss}
}
