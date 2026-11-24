import {useDailyGift} from './MomentArrival'
import {useEffect,useState} from 'react'
import {Link} from 'react-router-dom'
import {useSv} from './Context'
import {Avatar,Button,Card,Header,Wallet} from './Shared'
import {cantonNames,szApi} from '../../../lib/suizamenteV2'
import {ProfileDuration} from './Duration'
import {ShareSheet,storyData} from './Sharing'
import {notify} from '../../../lib/suizamenteNotices'

export function Profile(){
  const openGift=useDailyGift()
  const {player,config}=useSv(),[data,setData]=useState(null),[error,setError]=useState('')
  const [sharing,setSharing]=useState(false)
  useEffect(()=>{let active=true;szApi('perfil').then(x=>{if(active)setData(x)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[player.jugador_id])
  const achievements=data?.logros.filter(l=>l.conseguido).sort((a,b)=>Date.parse(b.conseguidoEn)-Date.parse(a.conseguidoEn))||[]
  const categoryCard=(title,entry)=>{
    const cat=config.categorias.find(c=>c.id===entry.categoria)
    return <div className="sv-category-stat" style={{'--tint':cat.tinte,'--category':cat.color}}><span>{cat.emoji}</span><div><small>{title}</small><b>{cat.nombre}</b><div className="sv-xp-bar"><i style={{width:entry.pct+'%'}}/></div></div><b>{entry.pct} %</b></div>
  }
  return <section className="sv-screen"><Header title="" right={<Link className="sv-icon-button" to="/suizamente/menu" aria-label="Menú">☰</Link>}/>
    <div className="sv-content"><div className="sv-profile-heading"><Avatar id={player.jugador_id} name={player.apodo} color={player.color}/><div><h1>{player.apodo}</h1><p>@{player.apodo} · {cantonNames[player.canton]}</p></div></div>
      <p className="sv-muted">{data?.seguidores??0} seguidores · {data?.siguiendo??0} siguiendo</p><div className="sv-profile-actions"><Button tone="quiet" to="/suizamente/perfil/editar">✏️ Editar perfil</Button><Button tone="quiet" onClick={()=>setSharing(true)}>📤 Compartir</Button></div>
      <ProfileDuration/><div className="sv-profile-tabs"><b>Desempeño</b><Link to="/suizamente/proponer">Tus preguntas</Link></div>
      <Card className="sv-level-card"><div className="sv-between"><h2>⭐ Nivel {player.nivel}</h2><span>{player.xpNivel} / {player.xpNecesaria} XP</span></div><div className="sv-xp-bar" role="progressbar" aria-label="Progreso de nivel" aria-valuenow={player.xpNivel} aria-valuemin={0} aria-valuemax={player.xpNecesaria}><i style={{width:100*player.xpNivel/player.xpNecesaria+'%'}}/></div><p>Has acertado <b>{data?.aciertos??0}</b> preguntas</p></Card>
      {data?.especialidad&&categoryCard('TU ESPECIALIDAD',data.especialidad)}
      {data?.cuesta&&categoryCard('LO QUE MÁS TE CUESTA',data.cuesta)}
      {data&&<Card className="sv-results-grid">{[['ganadas','ganadas'],['perdidas','perdidas'],['abandonadas','abandonadas']].map(([key,label])=><div key={key}><b>{data[key]}</b><span>{label}</span></div>)}</Card>}
      <Link className="sv-achievement-preview" to="/suizamente/logros"><div className="sv-between"><h2>🏅 Logros · {achievements.length}</h2><span>›</span></div><div>{achievements.slice(0,6).map(l=><span key={l.id} title={l.nombre}>{l.emoji}</span>)}</div>{!achievements.length&&<p>Tu primera partida te espera.</p>}</Link>
      {error&&<p role="alert" className="sv-error">{error}</p>}
    </div>{sharing&&<ShareSheet data={storyData('perfil',{nivel:player.nivel,especialidad:config.categorias.find(c=>c.id===data?.especialidad?.categoria)?.nombre})} onClose={()=>setSharing(false)}/>}
  </section>
}
export function Achievements(){
  const [data,setData]=useState(null),[error,setError]=useState(''),[selected,setSelected]=useState(null)
  useEffect(()=>{let active=true;szApi('logros').then(x=>{if(active)setData(x.logros)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[])
  return <section className="sv-screen"><Header title="🏅 Logros" back="/suizamente/perfil"/><div className="sv-content"><p>Tienes <b>{data?.filter(l=>l.conseguido).length||0}</b>. Toca uno para ver cómo se consigue.</p><div className="sv-achievements-grid">{data?.map(l=><button key={l.id} onClick={()=>setSelected(l)} aria-label={l.nombre+': '+(l.conseguido?'Conseguido':l.avance+'/'+l.meta)}><span className={l.conseguido?'achieved':''}>{l.emoji}</span><b>{l.nombre}</b><div className="sv-xp-bar"><i style={{width:Math.min(100,100*l.avance/l.meta)+'%'}}/></div><small>{l.conseguido?'✓ Conseguido':l.avance+'/'+l.meta}</small></button>)}</div>{selected&&<Card role="status"><b>{selected.emoji} {selected.nombre}</b><p>{selected.condicion}</p></Card>}{error&&<p role="alert" className="sv-error">{error}</p>}</div></section>
}
export function Shop(){
  const openGift=useDailyGift()
  const {player,config}=useSv(),[data,setData]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
  async function load(){try{setData(await szApi('tienda'))}catch(e){setError(e.message)}}
  useEffect(()=>{
    const refresh=()=>{if(document.visibilityState==='visible')load()}
    refresh();const timer=setInterval(refresh,60000)
    window.addEventListener('focus',refresh)
    return()=>{clearInterval(timer);window.removeEventListener('focus',refresh)}
  },[config.version])
  async function buy(article){
    if(busy)return
    setBusy(true);setError('');setNotice('')
    try{
      const bytes=new Uint8Array(16);crypto.getRandomValues(bytes)
      bytes[6]=bytes[6]&15|64;bytes[8]=bytes[8]&63|128
      const hex=[...bytes].map(n=>n.toString(16).padStart(2,'0')).join('')
      const storageKey='suizamente:compra-pendiente:'+player.jugador_id
      let pending
      try{pending=JSON.parse(sessionStorage.getItem(storageKey)||'null')}catch{/* A corrupt local draft must not block the shop. */}
      const clave=pending?.articulo===article?pending.clave:hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20)
      sessionStorage.setItem(storageKey,JSON.stringify({articulo:article,clave}))
      await szApi('tienda/comprar',{method:'POST',body:{articulo:article,clave}})
      sessionStorage.removeItem(storageKey)
      const label=data.comodines.find(c=>c.id===article)?.nombre||(article==='escudo'?'Escudo':'Sobre de cartas')
      notify('Comprado: '+label);await load()
    }catch(e){if(e.status&&e.status<500)sessionStorage.removeItem('suizamente:compra-pendiente:'+player.jugador_id);notify(e,{error:true})}finally{setBusy(false)}
  }
  async function gift(){
    if(busy)return
    setBusy(true);setError('');setNotice('')
    try{
      await openGift()
      await load()
    }catch(e){setError(e.message);await load()}finally{setBusy(false)}
  }
  const owned=article=>player.inventario?.[article]||0
  return <section className="sv-screen sv-shop"><header className="sv-shop-header"><h1>🛒 Tienda</h1><Wallet/></header><div className="sv-content">
    {data?<><button className={'sv-daily-gift '+(!data.regaloDisponible?'opened':'')} disabled={busy||!data.regaloDisponible} onClick={gift}><span>🎁</span><div><b>Regalo diario</b><small>{data.regaloDisponible?'Monedas y un comodín, gratis':'Vuelve mañana a por otro'}</small></div><strong>{data.regaloDisponible?'Abrir':'✓'}</strong></button>
      <h2>Comodines</h2><div className="sv-shop-grid">{data.comodines.map(c=><div className="sv-shop-card" key={c.id}><div className="sv-between"><span>{c.emoji}</span><small>Tienes {owned(c.id)}</small></div><b>{c.nombre}</b><p>{c.efecto}</p><button className={player.monedas>=c.precio?'affordable':''} disabled={busy} onClick={()=>buy(c.id)} aria-label={'Comprar '+c.nombre+' por '+c.precio+' monedas'}>🪙 {c.precio}</button></div>)}</div>
      <h2>Más</h2>{[['escudo','🛡️','Escudo','Reduce lo que te roban · tienes '+owned('escudos')+'/'+data.maxEscudos],['sobre','🃏','Sobre de cartas','Para tu álbum · tienes '+owned('sobres')]].map(([id,emoji,name,description])=><button key={id} className="sv-shop-row" disabled={busy||(id==='escudo'&&owned('escudos')>=data.maxEscudos)} onClick={()=>buy(id)}><span>{emoji}</span><div><b>{name}</b><small>{description}</small></div><strong className={player.monedas>=data.precios[id]?'affordable':''}>🪙 {data.precios[id]}</strong></button>)}
    </>:!error&&<div className="sv-skeleton" role="status" aria-label="Cargando tienda"/>}
    {notice&&<p className="sv-shop-notice" role="status">{notice}</p>}{error&&<p role="alert" className="sv-error">{error}</p>}
  </div></section>
}
