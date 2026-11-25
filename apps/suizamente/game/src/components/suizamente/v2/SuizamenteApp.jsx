import {lazy,Suspense,useCallback,useEffect,useRef,useState} from 'react'
import {Link,Navigate,Route,Routes,useLocation} from 'react-router-dom'
import {useAuth} from '../../../hooks/useAuth'
import {useEntry} from '../../../../entry'
import {useGameNavigation} from '../../../../navigation'
import {szApi,szSettings,SV_STATE,SV_AVATARS} from '../../../lib/suizamenteV2'
import {SuizamenteContext} from './Context'
import {Brand,Button,Logo,Navigation} from './Shared'
import {HowTo,Login,Menu,ProfileForm,Settings,Welcome} from './Account'
import {Home,NewGame} from './Lobby'
import {MapHelp} from './Map'
import './suizamente.css'
import './community.css'
import './world.css'
import './finish.css'
import './production.css'
import './play.css'
import {Feedback,InstallMetadata} from './Finish'
import {Missions,LapComplete} from './Duration'
import {InstallBanner} from './InstallBanner'
import {MomentProvider} from './Moment'
import {MomentArrival} from './MomentArrival'
import {isAbsenceNotice} from './moments'

// Only load a screen when its route is opened. Navigation remains mounted.
const screen=(load,name)=>lazy(()=>load().then(module=>({default:module[name]})))
const Onboarding=screen(()=>import('./Onboarding'),'Onboarding')
const Game=screen(()=>import('./Game'),'Game')
const Profile=screen(()=>import('./Economy'),'Profile')
const Achievements=screen(()=>import('./Economy'),'Achievements')
const Shop=screen(()=>import('./Economy'),'Shop')
const MapPage=screen(()=>import('./MapPage3D'),'MapPage')
const MapLevels=screen(()=>import('./MapPage3D'),'MapLevels')
const Album=screen(()=>import('./Rewards'),'Album')
const Chest=screen(()=>import('./Rewards'),'Chest')
const Pack=screen(()=>import('./Rewards'),'Pack')
const Raid=screen(()=>import('./Raid'),'Raid')
const DayQuestion=screen(()=>import('./Community'),'DayQuestion')
const Friends=screen(()=>import('./Community'),'Friends')
const Notebook=screen(()=>import('./Community'),'Notebook')
const OtherProfile=screen(()=>import('./Community'),'OtherProfile')
const Proposals=screen(()=>import('./Community'),'Proposals')
const Ranking=screen(()=>import('./Community'),'Ranking')
const AdminPanel=screen(()=>import('./Admin'),'AdminPanel')
const VictoryAttack=screen(()=>import('./VictoryAttack'),'VictoryAttack')

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
  const {authUser:user,loading:authLoading,signOut,avatarUrl,profileName,profileMetaLoaded}=useAuth(),location=useLocation(),{account}=useEntry(),{resetting}=useGameNavigation()
  const entered=!!user&&account===user.id
  const playing=/^\/suizamente\/(partida|asalto|ataque|pregunta|pregunta-del-dia)(\/|$)/.test(location.pathname)
  const [config,setConfig]=useState(null),[player,setPlayer]=useState(null),[ready,setReady]=useState(false),[error,setError]=useState('')
  const [settings,setSettings]=useState(szSettings),[retry,setRetry]=useState(0)
  const [opening,setOpening]=useState(()=>!sessionStorage.getItem('suizamente:apertura'))
  const [notices,setNotices]=useState([])
  const [avatars,setAvatars]=useState({})
  useEffect(()=>{const update=e=>{if(e.detail.userId===user?.id)setAvatars(old=>({...old,...e.detail.photos}))};window.addEventListener(SV_AVATARS,update);return()=>window.removeEventListener(SV_AVATARS,update)},[user?.id])
  const [map,setMap]=useState(null)
  const [capabilities,setCapabilities]=useState(null)
  const [questionVisible,setQuestionVisible]=useState(false)
  const [systemReduced,setSystemReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [waiting,setWaiting]=useState(0)
  useEffect(()=>{
    if(!entered||!player||!ready){setWaiting(0);return}
    if(playing)return
    let alive=true
    const refresh=()=>{if(!document.hidden)szApi('partidas').then(d=>{if(alive)setWaiting(d.partidas.filter(m=>m.estado==='jugando'&&m.teToca&&m.rival).length)}).catch(()=>{})}
    refresh();const timer=setInterval(refresh,15000);window.addEventListener('focus',refresh)
    return()=>{alive=false;clearInterval(timer);window.removeEventListener('focus',refresh)}
  },[entered,ready,player?.jugador_id,location.pathname,playing])
  useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)'),change=()=>setSystemReduced(media.matches);media.addEventListener('change',change);return()=>media.removeEventListener('change',change)},[])
  const configRevision=useRef(-1)
  const refreshConfig=useCallback(async()=>{const d=await szApi('config',{fresh:true});configRevision.current=d.version??0;setConfig(d)},[])
  const seen=useRef(new Set())
  const currentPlayer=useRef(null)
  const finishOpening=useCallback(()=>{sessionStorage.setItem('suizamente:apertura','1');setOpening(false)},[])
  useEffect(()=>{if(entered&&ready&&player&&opening)finishOpening()},[entered,ready,!!player,opening,finishOpening])
  const savePlayer=useCallback(data=>{
    if(data.avatares)setAvatars(old=>({...old,...data.avatares}))
    const old=currentPlayer.current,next=data.jugador
    if(old&&next&&old.jugador_id===next.jugador_id&&Date.parse(old.actualizado_en)>Date.parse(next.actualizado_en))return
    currentPlayer.current=next
    setPlayer(next?{...next,marco:data.marco??next.marco}:next)
    if(data.mapa)setMap(data.mapa)
    if(!next)setMap(null)
    if(data.jugador?.ajustes){
      setSettings(old=>({...old,...data.jugador.ajustes,apariencia:'clara'}))
      if(data.jugador.ajustes.onboarding)localStorage.setItem('suizamente:onboarding',data.jugador.ajustes.onboarding)
    }
  },[])
  useEffect(()=>{
    const update=e=>{
      const data=e.detail
      if(!user||data.jugador.jugador_id!==user.id)return
      savePlayer(data)
      if(data.configVersion!==undefined&&data.configVersion!==configRevision.current)refreshConfig().catch(()=>{})
      const fresh=(data.novedades||[]).filter(n=>!isAbsenceNotice(n)&&!seen.current.has(data.jugador.jugador_id+':'+n.id))
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
  useEffect(()=>{let active=true;setCapabilities(null);if(!entered)return;szApi('capacidades').then(d=>{if(active)setCapabilities(d)}).catch(()=>{if(active)setCapabilities({admin:false})});return()=>{active=false}},[user?.id,entered,retry])
  useEffect(()=>{
    if(authLoading)return
    let active=true
    setReady(false);setPlayer(null);setError('')
    currentPlayer.current=null;setMap(null);setNotices([]);setAvatars({})
    if(!entered){setReady(true);return}
    ;(async()=>{
      if(user&&localStorage.getItem('suizamente:invitado-con-datos')){
        try{
          await szApi('jugador/vincular',{method:'POST'})
          localStorage.removeItem('suizamente:invitado-con-datos')
          localStorage.removeItem('suizamente:jugador')
        }catch(e){if(e.status!==401)throw e}
      }
      const [data]=await Promise.all([szApi('jugador'),!config&&refreshConfig()])
      if(active){savePlayer(data);setReady(true)}
    })().catch(e=>{if(active)setError(e.message)})
    return()=>{active=false}
  },[user?.id,entered,authLoading,retry,savePlayer])
  useEffect(()=>{
    if(!ready||!player)return
    const refresh=()=>{if(document.visibilityState==='visible')szApi('jugador').catch(()=>{})}
    const timer=setInterval(refresh,30000)
    window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh)
    return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh)}
  },[ready,player?.jugador_id])
  useEffect(()=>{
    localStorage.setItem('suizamente:ajustes',JSON.stringify(settings))
    function apply(){
      document.documentElement.dataset.suizamenteTheme='clara'
      document.documentElement.dataset.suizamenteReduced=settings.menosAnimaciones?'true':'false'
    }
    apply()
    return()=>{delete document.documentElement.dataset.suizamenteTheme;delete document.documentElement.dataset.suizamenteReduced}
  },[settings])
  useEffect(()=>{
    const up=()=>{if(!ready||!config)setRetry(n=>n+1)}
    window.addEventListener('online',up)
    return()=>window.removeEventListener('online',up)
  },[ready,!!config])
  useEffect(()=>{
    document.title='Suizamente · Un juego de Latido'
    window.scrollTo(0,0)
    if(ready&&config){const heading=document.querySelector('.sv-root h1');heading?.setAttribute('tabindex','-1');heading?.focus({preventScroll:true})}
  },[location.pathname,ready,!!config])
  async function updateSettings(value){
    value={...value,apariencia:'clara'}
    setSettings(value)
    if(player){
      const data=await szApi('jugador',{method:'PUT',body:{...player,ajustes:value}})
      savePlayer(data)
    }
  }
  const gate=element=><ProfileGate player={player} ready={ready}>{element}</ProfileGate>
  const reduced=!!settings.menosAnimaciones||systemReduced
  const bypassOnboarding=/^\/suizamente\/(invitar|pregunta|pregunta-del-dia|entrar|bienvenida)(\/|$)/.test(location.pathname)||new URLSearchParams(location.search).has('p')
  const onboarding=location.pathname==='/suizamente/primera-vez'||!bypassOnboarding&&!player&&(entered?ready&&!localStorage.getItem('suizamente:bienvenida-pendiente'):!user&&!localStorage.getItem('suizamente:onboarding'))
  const admin=location.pathname.startsWith('/suizamente/admin'),showNavigation=!resetting&&!onboarding&&entered&&!!player&&ready&&!questionVisible&&!playing
  const activeTab=['mapa','album','tienda','amigos'].find(tab=>location.pathname.startsWith('/suizamente/'+tab))||'inicio'
  return <SuizamenteContext.Provider value={{player,map,config,user,avatarUrl,avatars,latidoName:profileName,capabilities,refreshConfig,settings,reduced,savePlayer,updateSettings,signOut,setQuestionVisible}}><MomentProvider reduced={reduced} owner={player?.jugador_id}><MomentArrival enabled={!resetting&&!onboarding&&entered&&ready&&!!config&&!opening}/><div className={'sv-root'+(admin?' sv-admin-root':'')+(showNavigation?' sv-has-nav':'')}>
    <Feedback/><InstallMetadata/>
    <InstallBanner hidden={onboarding||playing||location.pathname==='/suizamente/perfil/nuevo'}/>
    {authLoading||resetting?<Loading/>:onboarding&&config?<Suspense fallback={<Loading/>}><Onboarding/></Suspense>:!entered?<Login/>:error?<section className="sv-screen"><div className="sv-welcome"><Logo size={90}/><h1>No se pudo abrir Suizamente</h1><p role="alert">{error}</p><Button onClick={()=>setRetry(n=>n+1)}>Reintentar</Button></div></section>:!config||!ready||!profileMetaLoaded?<Loading/>:
    <Suspense fallback={<Loading/>}><Routes>
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
      <Route path="ataque/:id" element={gate(<VictoryAttack/>)}/>
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
    </Routes></Suspense>}
    {showNavigation&&<Navigation active={activeTab} waiting={waiting}/>}
    {opening&&onboarding&&config&&<Opening onDone={finishOpening} reduced={reduced}/>}
    {!!notices.length&&<div className={'sv-notice'+(notices[0].datos.href?' has-link':'')} role="status" aria-live="polite">{notices[0].datos.texto}{notices[0].datos.href&&<><Link to={notices[0].datos.href} onClick={()=>setNotices(old=>old.slice(1))}>{notices[0].tipo==='asalto'?'Ver mapa':'Ver'}</Link><button aria-label="Cerrar aviso" onClick={()=>setNotices(old=>old.slice(1))}>×</button></>}</div>}
  </div></MomentProvider></SuizamenteContext.Provider>
}
