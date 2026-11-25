import {ObjectArt} from './ObjectArt'
import {useMoment} from './Moment'
import {chestSteps,packSteps} from './moments'
import {useEffect,useRef,useState} from 'react'
import {useLocation,useNavigate,useParams} from 'react-router-dom'
import {useSv} from './Context'
import {Button,Card,Header,Logo,Sheet,Wallet,LatidoBackdrop} from './Shared'
import {ChestLinks} from './Map'
import {szApi,szKey} from '../../../lib/suizamenteV2'
import {useData} from './useData'

const backPath=search=>{const path=new URLSearchParams(search).get('volver');return /^\/suizamente(?:\/|$)/.test(path||'')?path:'/suizamente/album'}
export function useOpenPack(back){
  const navigate=useNavigate(),pending=useRef(false),[busy,setBusy]=useState(false),[error,setError]=useState('')
  async function open(){
    if(pending.current)return
    pending.current=true;setBusy(true);setError('')
    let key
    try{
      const album=await szApi('album')
      let id=album.sobrePendiente
      if(!id){key=szKey();id=(await szApi('sobres',{method:'POST',body:{clave:key}})).id}
      navigate('/suizamente/sobre/'+id+'?volver='+encodeURIComponent(back))
    }catch(e){
      if(key){
        try{await szApi('sobres/'+key);navigate('/suizamente/sobre/'+key+'?volver='+encodeURIComponent(back));return}catch{/* Retry uses the pending pack from the server. */}
      }
      setError(e.message)
    }finally{pending.current=false;setBusy(false)}
  }
  return {open,busy,error}
}
export function CardDetail({card,collection,onClose}){
  return <Sheet title={card.n} onClose={onClose}><div className={'sv-card-detail'+(!card.conseguida?' missing':'')}><span>{card.e}</span><b aria-label={card.r+' estrellas'}>{'★'.repeat(card.r)}</b><small>{collection}</small></div>{card.conseguida?<Card className="sv-fact"><b>💡 ¿Sabías que…?</b><p>{card.dato}</p></Card>:<p>Aún no la tienes · Sale en los sobres</p>}</Sheet>
}
function AlbumCard({card,onClick,pack=false,justRevealed=false}){
  return <button className={'sv-album-card '+(!card.conseguida?'missing ':'')+(justRevealed?'just-revealed':'')} onClick={onClick}>
    <small aria-label={card.r+' estrellas'}>{'★'.repeat(card.r)}</small><span>{card.e}</span><b>{card.n}</b>{pack&&<em className={card.nueva?'new':''}>{card.nueva?'NUEVA':'🪙 +'+card.monedas}</em>}
  </button>
}
export function Album(){
  const {player}=useSv(),{data,error}=useData('album'),[index,setIndex]=useState(0),[selected,setSelected]=useState(null),pack=useOpenPack('/suizamente/album')
  const monthlyIndex=data?.colecciones.findIndex(c=>c.mes===data.mes)??-1
  const col=data?.colecciones[index],sobres=player.inventario?.sobres||0
  return <section className="sv-screen sv-album"><header className="sv-shop-header"><h1>🃏 Álbum</h1><Wallet/></header>
    {col?<>{monthlyIndex>=0&&<button className="sv-monthly-entry" onClick={()=>setIndex(monthlyIndex)}>✨ Nueva este mes: {data.colecciones[monthlyIndex].nombre} · sale más en los sobres ›</button>}<div className="sv-collection-heading"><button className="sv-icon-button" aria-label="Colección anterior" disabled={index===0} onClick={()=>setIndex(i=>i-1)}>‹</button><div><h2>{col.mes===data.mes?'✨ ':''}{col.nombre}</h2><small>Colección {index+1} de {data.colecciones.length} · {col.tengo}/{col.cartas.length}</small></div><button className="sv-icon-button" aria-label="Colección siguiente" disabled={index===data.colecciones.length-1} onClick={()=>setIndex(i=>i+1)}>›</button></div>
      <div className="sv-collection-prize"><span>🏆</span><b>{col.completa?'✅ Completada':'Complétala y gana'}</b><span>🪙 {col.premio.monedas}</span><span>✂️ {col.premio.quita}</span><span>🛡️ {col.premio.escudos}</span></div>
      <div className="sv-album-grid">{col.cartas.map(card=><AlbumCard key={card.id} card={card} onClick={()=>setSelected({card,collection:col.nombre})}/>)}</div>
      <div className="sv-content">{(sobres>0||data.sobrePendiente)&&<Button disabled={pack.busy} onClick={pack.open}>{data.sobrePendiente?'🃏 Retomar el sobre':'🃏 Tienes '+sobres+' sobre'+(sobres===1?'':'s')+' sin abrir · Abrir'}</Button>}{sobres===0&&!data.sobrePendiente&&<Button tone="quiet" to="/suizamente/tienda">🛒 Conseguir un sobre</Button>}<ChestLinks chests={data.cofres} back="/suizamente/album"/></div>
    </>:!error&&<div className="sv-content"><div className="sv-skeleton" role="status" aria-label="Cargando álbum"/></div>}
    {(error||pack.error)&&<p role="alert" className="sv-error sv-content">{error||pack.error}</p>}
    {selected&&<CardDetail {...selected} onClose={()=>setSelected(null)}/>}</section>
}
export function Chest(){
  const {id}=useParams(),{search}=useLocation(),back=backPath(search),{config,player}=useSv(),{show}=useMoment(),[data,setData]=useState(null),[error,setError]=useState(''),[retry,setRetry]=useState(0),pack=useOpenPack(back)
  useEffect(()=>{
    let active=true
    ;(async()=>{
      let d=await szApi('cofres/'+id)
      if(!d.abierto){
        try{d=await szApi('cofres/'+id+'/abrir',{method:'POST'});if(active){show(chestSteps(d,config),{key:'cofre:'+id})}}catch(e){if(e.status===409)d=await szApi('cofres/'+id);else throw e}
      }
      if(active)setData(d)
    })().catch(e=>{if(active)setError(e.message)})
    return()=>{active=false}
  },[id,retry])
  const inventory=data?.contenido?.inventario||{},rows=data?[['🪙',data.contenido.monedas+' monedas','Para tu mapa'],...Object.entries(inventory).filter(([,n])=>n>0).map(([id,n])=>{
    const cm=config.comodines.find(c=>c.id===id)
    return [cm?.emoji||(id==='sobres'?'🃏':'🛡️'),cm?n+' comodín'+(n>1?'es':'')+' «'+cm.nombre+'»':n+(id==='sobres'?' sobre de cartas':' escudo'),cm?.efecto||(id==='sobres'?config.album.cartasPorSobre+' cartas para el álbum':'Para proteger tu mapa')]
  })]:[]
  return <section className="sv-screen sv-chest sv-themed-screen"><LatidoBackdrop tint="#FEEDD1"/><div className="sv-reward-heading"><span className="sv-store-object"><ObjectArt kind="chest"/></span><h1>{data?.titulo||'Tu cofre'}</h1><p>Esto es lo que había dentro</p></div><div className="sv-content">{data?rows.map(([e,note,desc])=><div className="sv-reward-row" key={note}><span>{e}</span><div><b>{note}</b><small>{desc}</small></div></div>):!error&&<div className="sv-skeleton" role="status" aria-label="Abriendo cofre"/>}{data?.contenido?.escudosAlMaximo&&<p className="sv-muted">🛡️ Ya tienes el máximo de escudos.</p>}{(error||pack.error)&&<p className="sv-error" role="alert">{error||pack.error}</p>}{error&&<Button tone="quiet" onClick={()=>{setError('');setRetry(n=>n+1)}}>Reintentar</Button>}</div><footer className="sv-footer">{data&&(player.inventario?.sobres||0)>0&&<Button disabled={pack.busy} onClick={pack.open}>🃏 Abrir sobre de cartas</Button>}<Button tone="quiet" to={back}>Seguir</Button></footer></section>
}
export function Pack(){
  const {id}=useParams(),{search}=useLocation(),back=backPath(search),{show}=useMoment(),[retry,setRetry]=useState(0),[data,setData]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[selected,setSelected]=useState(null),pending=useRef(false)
  useEffect(()=>{
    let active=true
    ;(async()=>{
      let next=await szApi('sobres/'+id)
      const unopened=next.giradas<next.total
      // Opening already grants every card. girar only reveals those saved results;
      // reveal the whole pack before presenting it, including when resuming a pack.
      pending.current=true;setBusy(true)
      while(active&&next.giradas<next.total){
        try{next=await szApi('sobres/'+id+'/girar',{method:'POST',body:{indice:next.giradas}})}
        catch(e){if(e.status===409)next=await szApi('sobres/'+id);else throw e}
      }
      if(active){setData(next);if(unopened)show(packSteps(next),{key:'sobre:'+id})}
    })().catch(e=>{if(active)setError(e.message)}).finally(()=>{pending.current=false;if(active)setBusy(false)})
    return()=>{active=false}
  },[id,retry,show])
  async function flip(index){
    if(pending.current)return
    pending.current=true;setBusy(true);setError('')
    try{setData(await szApi('sobres/'+id+'/girar',{method:'POST',body:{indice:index}}))}
    catch(e){setError(e.message);if(e.status===409){try{setData(await szApi('sobres/'+id))}catch{/* Retry safely from the same pack after reconnecting. */}}}
    finally{pending.current=false;setBusy(false)}
  }
  return <section className="sv-screen sv-pack sv-themed-screen"><LatidoBackdrop tint="#DFE7FC"/><header className="sv-shop-header"><h1>🃏 Sobre de cartas</h1><Wallet/></header><p className="sv-pack-hint">{data?'Las cartas ya están en tu álbum':'Abriendo tu sobre…'}</p>
    {data?<><div className="sv-pack-cards">{Array.from({length:data.total},(_,i)=>data.cartas[i]?<AlbumCard key={i} card={{...data.cartas[i],conseguida:true}} pack justRevealed={i===data.giradas-1} onClick={()=>setSelected(data.cartas[i])}/>:<button key={i} className="sv-card-back" disabled={busy||i!==data.giradas} onClick={()=>flip(i)} aria-label={'Girar carta '+(i+1)}><Logo size={48}/><b>{i===data.giradas?'Toca para girar':'?'}</b></button>)}</div><div className="sv-content">{data.giradas>0&&data.colecciones.map(c=><Card className="sv-pack-progress" key={c.id}><div className="sv-between"><b>{c.nombre}</b><b>{c.tengo}/{c.total}</b></div><div className="sv-xp-bar"><i style={{width:100*c.tengo/c.total+'%'}}/></div>{c.completa&&<small>✅ Colección completa · Premio recibido</small>}</Card>)}{data.giradas===data.total&&<p className="sv-muted">Las repetidas se cambian solas por monedas.</p>}</div></>:!error&&<div className="sv-content"><div className="sv-skeleton" role="status" aria-label="Cargando sobre"/></div>}
    {error&&<div className="sv-content"><p className="sv-error" role="alert">{error}</p><Button onClick={()=>{setError('');setRetry(n=>n+1)}}>Reintentar</Button></div>}<footer className="sv-footer"><Button to="/suizamente/album">🃏 Ver el álbum</Button><Button tone="quiet" to={back}>Seguir</Button></footer>{selected&&<CardDetail card={{...selected,conseguida:true}} collection={selected.coleccion} onClose={()=>setSelected(null)}/>}</section>
}
