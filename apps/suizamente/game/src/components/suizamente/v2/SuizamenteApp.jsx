import {useCallback,useEffect,useRef,useState} from 'react'
import {Link,Navigate,Route,Routes,useLocation} from 'react-router-dom'
import {useAuth} from '../../../hooks/useAuth'
import {szApi,szSettings,SV_STATE} from '../../../lib/suizamenteV2'
import {SuizamenteContext} from './Context'
import {Brand,Button,Logo,Navigation} from './Shared'
import {HowTo,Login,Menu,Onboarding,ProfileForm,Settings,Welcome} from './Account'
import {Game,Home,NewGame} from './Game'
import {Profile,Achievements,Shop} from './Economy'
import {MapHelp} from './Map'
import {MapPage,MapLevels} from './MapPage3D'
import {Album,Chest,Pack} from './Rewards'
import {Raid} from './Raid'
import {DailyHome,DayQuestion,Friends,Notebook,OtherProfile,Proposals,Ranking} from './Community'
import './suizamente.css'
import './community.css'
import {AdminPanel} from './Admin'
import './world.css'
import './finish.css'
import './production.css'
import {Feedback,InstallMetadata} from './Finish'
import {Missions,LapComplete} from './Duration'

function Opening({onDone,reduced}){
  useEffect(()=>{
    const timer=setTimeout(onDone,reduced?700:3000)
    const skip=()=>onDone()
    window.addEventListener('keydown',skip)
    return()=>{clearTimeout(timer);window.removeEventListener('keydown',skip)}
  },[onDone,reduced])
  return <button className={'sv-opening'+(reduced?' reduced':'')} onClick={onDone} aria-label="Saltar apertura"><Logo size={145}/><Brand/><p>Un juego de <b>latido.ch</b></p><div className="sv-brand-dots">{['#24E2C9','#03AA98','#F9A719','#FA2F35','#4A76EF','#24BFE2'].map(c=><i key={c} style={{background:c}}/>)}</div></button>
}
function Invitation(){
  const {pathname}=useLocation()
  return <NewGame invitation={pathname.split('/').pop()}/>
}
function ProfileGate({children,player,ready}){
  const {pathname,search}=useLocation()
  if(!ready)return <Loading/>
  if(!player){
    if(pathname!=='/suizamente'&&pathname!=='/suizamente/')sessionStorage.setItem('suizamente:despues-perfil',pathname+search)
    return <ProfileForm/>
  }
  if(player.renombrar&&pathname!=='/suizamente/perfil/editar')return <Navigate to="/suizamente/perfil/editar" replace/>
  return children
}
function Loading(){return <section className="sv-screen"><div className="sv-content"><div className="sv-skeleton" role="status" aria-label="Cargando Suizamente"/><div className="sv-skeleton short"/></div></section>}
function HomeEntry({children}){const {search}=useLocation(),id=new URLSearchParams(search).get('p');return id?<Navigate to={'/suizamente/pregunta/'+encodeURIComponent(id)} replace/>:children}
export default function SuizamenteApp(){
  const {authUser:user,loading:authLoading,signOut}=useAuth(),location=useLocation()
  const [config,setConfig]=useState(null),[player,setPlayer]=useState(null),[ready,setReady]=useState(false),[error,setError]=useState('')
  const [settings,setSettings]=useState(szSettings),[retry,setRetry]=useState(0),[online,setOnline]=useState(navigator.onLine)
  const [opening,setOpening]=useState(()=>!sessionStorage.getItem('suizamente:apertura'))
  const [notices,setNotices]=useState([])
  const [map,setMap]=useState(null)
  const [capabilities,setCapabilities]=useState(null)
  const [questionVisible,setQuestionVisible]=useState(false)
  const [systemReduced,setSystemReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [networkFailure,setNetworkFailure]=useState(false)
  useEffect(()=>{const failed=()=>setNetworkFailure(true);window.addEventListener('suizamente:error-conexion',failed);return()=>window.removeEventListener('suizamente:error-conexion',failed)},[])
  useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)'),change=()=>setSystemReduced(media.matches);media.addEventListener('change',change);return()=>media.removeEventListener('change',change)},[])
  const configRevision=useRef(-1)
  const refreshConfig=useCallback(async()=>{const d=await szApi('config');configRevision.current=d.version??0;setConfig(d)},[])
  const seen=useRef(new Set())
  const currentPlayer=useRef(null)
  const finishOpening=useCallback(()=>{sessionStorage.setItem('suizamente:apertura','1');setOpening(false)},[])
  const savePlayer=useCallback(data=>{
    const old=currentPlayer.current,next=data.jugador
    if(old&&next&&old.jugador_id===next.jugador_id&&Date.parse(old.actualizado_en)>Date.parse(next.actualizado_en))return
    currentPlayer.current=next
    setPlayer(next?{...next,marco:data.marco??next.marco}:next)
    if(data.mapa)setMap(data.mapa)
    if(!next)setMap(null)
    if(data.jugador?.ajustes){
      setSettings(old=>({...old,...data.jugador.ajustes}))
      if(data.jugador.ajustes.onboarding)localStorage.setItem('suizamente:onboarding',data.jugador.ajustes.onboarding)
    }
  },[])
  useEffect(()=>{
    const update=e=>{
      const data=e.detail
      if(!user||data.jugador.jugador_id!==user.id)return
      savePlayer(data)
      if(data.configVersion!==undefined&&data.configVersion!==configRevision.current)refreshConfig().catch(()=>{})
      const fresh=(data.novedades||[]).filter(n=>!seen.current.has(data.jugador.jugador_id+':'+n.id))
      if(fresh.length){
        fresh.forEach(n=>seen.current.add(data.jugador.jugador_id+':'+n.id))
        setNotices(old=>[...old,...fresh])
        szApi('novedades/leer',{method:'POST',body:{ids:fresh.map(n=>n.id)}}).catch(()=>{})
      }
    }
    window.addEventListener(SV_STATE,update)
    return()=>window.removeEventListener(SV_STATE,update)
  },[user?.id,savePlayer,refreshConfig])
  useEffect(()=>{
    if(!notices.length)return
    const timer=setTimeout(()=>setNotices(old=>old.slice(1)),['nivel','logro','sello','mision'].includes(notices[0].tipo)?3000:10000)
    return()=>clearTimeout(timer)
  },[notices[0]?.id])
  useEffect(()=>{
    let active=true
    szApi('config').then(data=>{if(active){configRevision.current=data.version??0;setConfig(data)}}).catch(e=>{if(active)setError(e.message)})
    return()=>{active=false}
  },[retry])
  useEffect(()=>{let active=true;setCapabilities(null);if(!user)return;szApi('capacidades').then(d=>{if(active)setCapabilities(d)}).catch(()=>{if(active)setCapabilities({admin:false})});return()=>{active=false}},[user?.id,retry])
  useEffect(()=>{
    if(authLoading)return
    let active=true
    setReady(false);setPlayer(null);setError('')
    currentPlayer.current=null;setMap(null);setNotices([])
    if(!user){setReady(true);return}
    ;(async()=>{
      if(user&&localStorage.getItem('suizamente:invitado-con-datos')){
        try{
          await szApi('jugador/vincular',{method:'POST'})
          localStorage.removeItem('suizamente:invitado-con-datos')
          localStorage.removeItem('suizamente:jugador')
        }catch(e){if(e.status!==401)throw e}
      }
      const data=await szApi('jugador')
      if(active){savePlayer(data);setReady(true)}
    })().catch(e=>{if(active)setError(e.message)})
    return()=>{active=false}
  },[user?.id,authLoading,retry,savePlayer])
  useEffect(()=>{
    if(!ready||!player)return
    const refresh=()=>{if(document.visibilityState==='visible')szApi('jugador').catch(()=>{})}
    const timer=setInterval(refresh,30000)
    window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh)
    return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh)}
  },[ready,player?.jugador_id])
  useEffect(()=>{
    localStorage.setItem('suizamente:ajustes',JSON.stringify(settings))
    const media=matchMedia('(prefers-color-scheme: dark)')
    function apply(){
      document.documentElement.dataset.suizamenteTheme=settings.apariencia==='oscura'||((!settings.apariencia||settings.apariencia==='auto')&&media.matches)?'oscura':'clara'
      document.documentElement.dataset.suizamenteReduced=settings.menosAnimaciones?'true':'false'
    }
    apply();media.addEventListener('change',apply)
    return()=>{media.removeEventListener('change',apply);delete document.documentElement.dataset.suizamenteTheme;delete document.documentElement.dataset.suizamenteReduced}
  },[settings])
  useEffect(()=>{
    const up=()=>{setOnline(true);setNetworkFailure(false);if(!ready||!config)setRetry(n=>n+1)},down=()=>setOnline(false)
    window.addEventListener('online',up);window.addEventListener('offline',down)
    return()=>{window.removeEventListener('online',up);window.removeEventListener('offline',down)}
  },[ready,!!config])
  useEffect(()=>{
    document.title='Suizamente · Un juego de Latido'
    window.scrollTo(0,0)
    if(ready&&config){const heading=document.querySelector('.sv-root h1');heading?.setAttribute('tabindex','-1');heading?.focus({preventScroll:true})}
  },[location.pathname,ready,!!config])
  async function updateSettings(value){
    setSettings(value)
    if(player){
      const data=await szApi('jugador',{method:'PUT',body:{...player,ajustes:value}})
      savePlayer(data)
    }
  }
  const gate=element=><ProfileGate player={player} ready={ready}>{element}</ProfileGate>
  const reduced=!!settings.menosAnimaciones||systemReduced
  const admin=location.pathname.startsWith('/suizamente/admin'),showNavigation=!!user&&!!player&&ready&&!questionVisible
  const activeTab=['mapa','album','tienda','amigos'].find(tab=>location.pathname.startsWith('/suizamente/'+tab))||'inicio'
  return <SuizamenteContext.Provider value={{player,map,config,user,capabilities,refreshConfig,settings,reduced,savePlayer,updateSettings,signOut,setQuestionVisible}}><div className={'sv-root'+(admin?' sv-admin-root':'')+(showNavigation?' sv-has-nav':'')}>
    <Feedback/><InstallMetadata/>
    {networkFailure&&<div className="sv-connection" role="alert">Algo ha fallado. Inténtalo otra vez. <button className="sv-text-button" onClick={()=>{setNetworkFailure(false);setRetry(n=>n+1)}}>Reintentar conexión</button></div>}
    {!online&&<p className="sv-connection" role="status">Sin conexión · reintentando…</p>}
    {authLoading?<Loading/>:!user?<Login/>:error?<section className="sv-screen"><div className="sv-welcome"><Logo size={90}/><h1>No se pudo abrir Suizamente</h1><p role="alert">{error}</p><Button onClick={()=>setRetry(n=>n+1)}>Reintentar</Button></div></section>:!config||!ready?<Loading/>:
    <Routes>
      <Route path="admin/*" element={<AdminPanel/>}/>
      <Route path="primera-vez" element={<Onboarding/>}/>
      <Route path="bienvenida" element={<Welcome/>}/>
      <Route path="como-se-juega" element={<HowTo/>}/>
      <Route path="entrar" element={<Login/>}/>
      <Route path="perfil/nuevo" element={<ProfileForm/>}/>
      <Route path="perfil/editar" element={gate(<ProfileForm editing/>)}/>
      <Route path="perfil" element={gate(<Profile/>)}/>
      <Route path="logros" element={gate(<Achievements/>)}/>
      <Route path="tienda" element={gate(<Shop/>)}/>
      <Route path="mapa" element={gate(<MapPage/>)}/>
      <Route path="mapa/ayuda" element={gate(<MapHelp/>)}/>
      <Route path="mapa/niveles/:canton" element={gate(<MapLevels/>)}/>
      <Route path="mapa/vuelta" element={gate(<LapComplete/>)}/>
      <Route path="misiones" element={gate(<Missions/>)}/>
      <Route path="album" element={gate(<Album/>)}/>
      <Route path="cofre/:id" element={gate(<Chest/>)}/>
      <Route path="sobre/:id" element={gate(<Pack/>)}/>
      <Route path="asalto/:id" element={gate(<Raid/>)}/>
      <Route path="amigos" element={gate(<Friends/>)}/>
      <Route path="ranking" element={gate(<Ranking/>)}/>
      <Route path="jugador/:id" element={gate(<OtherProfile key={location.pathname}/>)}/>
      <Route path="pregunta-del-dia" element={<DayQuestion key={location.pathname}/>}/>
      <Route path="pregunta/:id" element={<DayQuestion shared key={location.pathname}/>}/>
      <Route path="libreta" element={gate(<Notebook/>)}/>
      <Route path="crea-preguntas" element={gate(<Proposals/>)}/>
      <Route path="proponer" element={gate(<Proposals form/>)}/>
      <Route path="menu" element={gate(<Menu/>)}/>
      <Route path="ajustes" element={gate(<Settings/>)}/>
      <Route path="nueva" element={gate(<NewGame/>)}/>
      <Route path="invitar/:codigo" element={gate(<Invitation/>)}/>
      <Route path="partida/:id" element={gate(<Game key={location.pathname}/>)}/>
      <Route path="/" element={<HomeEntry>{gate(<Home/>)}</HomeEntry>}/>
      <Route path="*" element={<Navigate to="/suizamente" replace/>}/>
    </Routes>}
    {showNavigation&&<Navigation active={activeTab}/>}
    {opening&&user&&<Opening onDone={finishOpening} reduced={reduced}/>}
    {!!notices.length&&<div className={'sv-notice'+(notices[0].datos.href?' has-link':'')} role="status" aria-live="polite">{notices[0].datos.texto}{notices[0].datos.href&&<><Link to={notices[0].datos.href} onClick={()=>setNotices(old=>old.slice(1))}>{notices[0].tipo==='asalto'?'Ver mapa':'Ver'}</Link><button aria-label="Cerrar aviso" onClick={()=>setNotices(old=>old.slice(1))}>×</button></>}</div>}
  </div></SuizamenteContext.Provider>
}
