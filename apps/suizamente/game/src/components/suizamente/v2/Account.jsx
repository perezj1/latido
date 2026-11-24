import {useRef,useState} from 'react'
import {Link,useLocation,useNavigate} from 'react-router-dom'
import {useAuth} from '../../../hooks/useAuth'
import {supabase} from '../../../lib/supabase'
import {useEntry,rememberEntryDestination} from '../../../../entry'
import {connectLatidoAccount} from '../../../../latidoSso'
import {prepareProfilePhoto,uploadProfilePhoto} from '../../../lib/suizamentePhoto'
import {useSv} from './Context'
import {Avatar,Brand,Button,Card,Chip,Header,Logo,Sheet,StampBar,Stamps,Wheel} from './Shared'
import {szApi,cantonNames,countryNames} from '../../../lib/suizamenteV2'
import {loadPushSettings,subscribeToPushNotifications} from '../../../lib/pushNotifications'

const years={menos1:'Menos de 1 año','1a3':'1–3 años','3a10':'3–10 años',mas10:'Más de 10 años'}
const colors=['menta','naranja','rojo','azul','cielo','mar']
export function Onboarding(){
  const {config,player,savePlayer}=useSv(),navigate=useNavigate()
  const [step,setStep]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(''),[touch,setTouch]=useState(null)
  const steps=[
    ['BIENVENIDA','El juego de preguntas de Suiza','Partidas 1 contra 1 sobre la vida en Suiza. Para la comunidad hispanohablante de Latido.'],
    ['🎡 LA RULETA','Gira y responde','Seis categorías: idioma, cultura, comida y naturaleza, papeles y dinero, casa y trabajo, y el día a día.'],
    ['🛂 LOS SELLOS','Consigue los '+config.partida.sellosParaGanar+' sellos',config.partida.barraParaSello+' aciertos seguidos y juegas por un sello. Quien llene antes su pasaporte, gana.'],
    ['🗺️ TU MAPA','Construye tu Suiza','Con las monedas que ganas levantas los cantones, región a región. Y llenas tu álbum de cartas.'],
    ['🎁 REGALO DE BIENVENIDA','Todo listo','Tienes monedas, un sobre de cartas y dos comodines para empezar.'],
  ]
  async function finish(){
    setBusy(true);setError('')
    try{
      if(player)savePlayer(await szApi('jugador/bienvenida',{method:'POST'}))
      localStorage.setItem('suizamente:onboarding',new Date().toISOString())
      sessionStorage.setItem('suizamente:despues-perfil','/suizamente/nueva')
      navigate(player?'/suizamente/nueva':'/suizamente/entrar')
    }catch(e){setError(e.message)}finally{setBusy(false)}
  }
  return <section className="sv-screen sv-onboarding" onTouchStart={e=>setTouch(e.changedTouches[0].clientX)} onTouchEnd={e=>{
    if(touch!==null&&touch-e.changedTouches[0].clientX>60)setStep(s=>Math.min(4,s+1))
    else if(touch!==null&&e.changedTouches[0].clientX-touch>60)setStep(s=>Math.max(0,s-1))
    setTouch(null)
  }}>
    <header className="sv-onboarding-progress"><div aria-label={'Paso '+(step+1)+' de 5'}>{steps.map((_,i)=><i key={i} className={i<=step?'done':''}/>)}</div>{step<4&&<button onClick={finish} disabled={busy}>Saltar</button>}</header>
    <div className="sv-onboarding-art">
      {step===0&&<><Logo size={150}/><Brand/></>}
      {step===1&&<Wheel categories={config.categorias}/>}
      {step===2&&<><Card><b>TU PASAPORTE</b><Stamps categories={config.categorias} owned={[]} large/></Card><StampBar value={0} max={config.partida.barraParaSello}/></>}
      {step===3&&<><img className="sv-map-preview" src="/suizamente-assets/mapa-cantones.svg" alt="Los cantones de Suiza"/><div className="sv-chips"><Chip>🏗️ {config.mapa.nivelesPorCanton} niveles por cantón</Chip><Chip>🛡️ Escudos</Chip></div></>}
      {step===4&&<><span className="sv-gift" aria-hidden="true">🎁</span><div className="sv-chips"><Chip>🪙 {config.bienvenida.monedas}</Chip><Chip>🃏 {config.bienvenida.sobres} sobre</Chip><Chip>✂️ {config.bienvenida.comodines.quita}</Chip></div></>}
    </div>
    <div className="sv-onboarding-copy" key={step} aria-live="polite"><small>{steps[step][0]}</small><h1>{steps[step][1]}</h1><p>{steps[step][2]}</p></div>
    {error&&<p role="alert" className="sv-error">{error}</p>}
    <footer className="sv-footer"><Button disabled={busy} onClick={()=>step===4?finish():setStep(step+1)}>{busy?'Preparando…':step===0?'Empezar':step===4?'▶ Jugar mi primera partida':'Siguiente'}</Button></footer>
  </section>
}
export function Welcome(){
  return <Login/>
}
function LoginArt(){
 return <div className="sv-login-art" aria-hidden="true"><svg viewBox="0 0 360 280" focusable="false"><circle cx="180" cy="136" r="116" fill="#D3F8F3"/><circle cx="285" cy="55" r="24" fill="#F9A719"/><path d="M0 222 112 55 200 177 254 88 360 222Z" fill="#03AA98"/><path d="m112 55-44 66 28-6 16 17 16-18 29 7Z" fill="#FFFFFF"/><path d="m254 88-32 48 20-4 12 12 11-13 21 5Z" fill="#FFFFFF"/><path d="M0 224Q90 164 180 224T360 224V280H0Z" fill="#24E2C9"/><path d="M0 256Q90 216 180 256T360 256V280H0Z" fill="#24BFE2"/><g fill="#FFFFFF"><rect x="42" y="208" width="39" height="29" rx="4"/><rect x="268" y="203" width="42" height="30" rx="4"/></g><g fill="#F9A719"><path d="m34 208 28-23 28 23Z"/><path d="m260 203 29-23 29 23Z"/></g><g fill="#4A76EF"><rect x="56" y="220" width="10" height="17" rx="2"/><rect x="283" y="216" width="11" height="17" rx="2"/></g></svg><div className="sv-login-passport"><Logo size={70}/><span>Tu próxima aventura</span><b>empieza en Suiza</b></div><span className="sv-login-stamp one">🎡</span><span className="sv-login-stamp two">🛂</span><span className="sv-login-stamp three">🃏</span></div>
}
function GoogleMark(){return <svg viewBox="0 0 18 18" width="22" height="22" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.61Z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.81 5.96-2.19l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18Z"/><path fill="#FBBC05" d="M3.96 10.7A5.42 5.42 0 0 1 3.68 9c0-.59.1-1.16.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.03l3-2.33Z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58A8.64 8.64 0 0 0 9 0 9 9 0 0 0 .96 4.97l3 2.33C4.67 5.17 6.66 3.58 9 3.58Z"/></svg>}
export function Login(){
  const {authUser:user,signInWithGoogle}=useAuth(),{acceptAccount}=useEntry(),navigate=useNavigate(),{pathname,search}=useLocation(),[busy,setBusy]=useState(''),[error,setError]=useState('')
  const destination=['/suizamente/entrar','/suizamente/bienvenida','/suizamente/primera-vez'].includes(pathname)?'/suizamente':pathname+search
  const auth='/auth?next='+encodeURIComponent(destination)
  async function google(){setBusy('google');setError('');try{rememberEntryDestination(destination);const callback=new URL('/auth/callback',location.origin);const result=await signInWithGoogle({redirectTo:callback.toString()});if(result.error)throw result.error}catch{setError('No se pudo abrir Google. Inténtalo otra vez o entra con tu email.');setBusy('')}}
  async function latido(){
    setBusy('latido');setError('');rememberEntryDestination(destination)
    try{
      const session=user?{user}:await connectLatidoAccount({client:supabase,socialApi:import.meta.env.VITE_SUPABASE_URL+'/functions/v1/suizamente-social',popup:true})
      if(!session?.user)throw new Error('Abre Latido e inicia sesión allí. Después vuelve y pulsa «Entrar con cuenta de Latido». También puedes entrar con Google o email.')
      acceptAccount(session.user);navigate('/suizamente/perfil/nuevo')
    }catch(e){setError(e.message)}finally{setBusy('')}
  }
  return <section className="sv-screen sv-login-screen"><header className="sv-login-heading"><Logo size={62}/><h1><Brand/></h1><p>Descubre Suiza. Juega en comunidad.</p></header><LoginArt/><div className="sv-login-actions"><Link className="sv-login-button create" to={auth+'&mode=register&metodo=email'} onClick={()=>rememberEntryDestination(destination)}><b>Crear cuenta gratis</b></Link><Link className="sv-login-button existing" to={auth+'&mode=login&metodo=email'} onClick={()=>rememberEntryDestination(destination)}><b>Ya tengo cuenta</b></Link><div className="sv-login-divider" aria-hidden="true">o</div><button className="sv-login-button google" disabled={!!busy} onClick={google}><GoogleMark/><b>{busy==='google'?'Conectando con Google…':'Entrar con Google'}</b></button><button className="sv-login-button latido" disabled={!!busy} onClick={latido}><span aria-hidden="true">L</span><b>{busy==='latido'?'Conectando con Latido…':'Entrar con cuenta de Latido'}</b></button><p className="sv-login-account-note">Necesitas una cuenta para jugar.</p>{error&&<p className="sv-error" role="alert">{error}</p>}</div><p className="sv-login-legal">Al continuar, aceptas los <Link to="/terminos">Términos</Link> y la <Link to="/privacidad">Política de privacidad</Link>.</p></section>
}
export function HowTo(){
  const {config,player}=useSv()
  const steps=[['🎡','Gira la ruleta','Te toca una de las 6 categorías de la vida en Suiza. Partidas 1 contra 1, por turnos.'],['✅','Acierta y sigue','Cada acierto llena la barra de sello y vuelves a girar. Si fallas, le toca a tu rival.'],['🛂','Consigue los '+config.partida.sellosParaGanar+' sellos','Con '+config.partida.barraParaSello+' aciertos juegas por un sello. Quien llene antes su pasaporte, gana.'],['🗺️','Construye tu Suiza','Con las monedas levantas cantones, compras comodines y llenas tu álbum de cartas.']]
  return <section className="sv-screen"><Header title="Así se juega" back={player?'/suizamente/menu':'/suizamente/bienvenida'}/><div className="sv-content sv-steps">{steps.map(([emoji,title,text],i)=><div key={title}><span className="sv-step-icon">{emoji}<small>{i+1}</small></span><div><h2>{title}</h2><p>{text}</p></div></div>)}<Stamps categories={config.categorias}/></div><footer className="sv-footer"><Button to={player?'/suizamente/nueva':'/suizamente/entrar'}>▶ ¡A jugar!</Button></footer></section>
}
export function ProfileForm({editing=false}){
  const {player,user,avatarUrl,latidoName,savePlayer,settings}=useSv(),navigate=useNavigate(),fileInput=useRef(null)
  const [form,setForm]=useState(()=>({apodo:player?.apodo||(latidoName||user?.user_metadata?.name||user?.user_metadata?.full_name||'').slice(0,20),color:player?.color||'menta',pais:player?.pais||'ES',canton:player?.canton||user?.user_metadata?.canton||'ZH',anos_suiza:player?.anos_suiza||'menos1',en_ranking:player?.en_ranking??true}))
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  const [photo,setPhoto]=useState(null),[photoBusy,setPhotoBusy]=useState(false)
  async function choosePhoto(e){const file=e.target.files?.[0];e.target.value='';if(!file)return;setPhotoBusy(true);setError('');try{setPhoto(await prepareProfilePhoto(file))}catch(e){setError(e.message)}finally{setPhotoBusy(false)}}
  function change(key,value){setForm(f=>({...f,[key]:value}))}
  async function submit(e){
    e.preventDefault();setBusy(true);setError('')
    try{
      const ownPhoto=photo?await uploadProfilePhoto(photo,user.id):player?.ajustes?.foto_url
      let result=await szApi('jugador',{method:'PUT',body:{...form,ajustes:{...settings,...player?.ajustes,...(ownPhoto?{foto_url:ownPhoto}:{}),apariencia:'clara'}}})
      if(!editing){
        result=await szApi('jugador/bienvenida',{method:'POST'})
        localStorage.setItem('suizamente:onboarding',new Date().toISOString())
      }
      savePlayer(result)
      const destination=sessionStorage.getItem('suizamente:despues-perfil')||'/suizamente'
      sessionStorage.removeItem('suizamente:despues-perfil')
      navigate(editing?'/suizamente/ajustes':destination,{replace:true})
      if(!editing)requestAnimationFrame(()=>window.dispatchEvent(new Event('suizamente:instalar-tras-perfil')))
    }catch(e){setError(e.message)}finally{setBusy(false)}
  }
  return <form className="sv-screen" onSubmit={submit}><Header title={editing?'Editar perfil':'Tu perfil'}/><div className="sv-content sv-profile-form">{player?.renombrar&&<Card><b>📝 Elige otro apodo</b><p>Hemos revisado tu apodo. Cámbialo para seguir jugando.</p></Card>}<div className="sv-profile-avatar"><Avatar name={form.apodo||'?'} color={form.color} photo={photo||player?.ajustes?.foto_url||avatarUrl}/><button className="sv-photo-button" type="button" disabled={busy||photoBusy} aria-label="Elegir o cambiar foto de perfil" onClick={()=>fileInput.current?.click()}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 7h4l2-3h4l2 3h4v13H4Z"/><circle cx="12" cy="13" r="4"/></svg></button><input ref={fileInput} type="file" accept="image/*" aria-label="Foto de perfil" hidden onChange={choosePhoto}/></div>{photoBusy&&<p role="status">Preparando tu foto...</p>}<label>Tu apodo<input required minLength={2} maxLength={20} value={form.apodo} onChange={e=>change('apodo',e.target.value)} autoComplete="nickname" pattern="[A-Za-zÀ-ÿ0-9 ._\-]{2,20}" placeholder="¿Cómo te llamamos?"/></label><fieldset><legend>Tu color</legend><div className="sv-color-options">{colors.map(color=><button type="button" key={color} className={'sv-color '+color} aria-label={color} aria-pressed={form.color===color} onClick={()=>change('color',color)}>{form.color===color?'✓':''}</button>)}</div></fieldset>
    <label>País de origen<select value={form.pais} onChange={e=>change('pais',e.target.value)}>{Object.entries(countryNames).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
    <label>Tu cantón<select value={form.canton} onChange={e=>change('canton',e.target.value)}>{Object.entries(cantonNames).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
    <fieldset><legend>¿Cuánto llevas en Suiza?</legend><div className="sv-choice-grid">{Object.entries(years).map(([id,label])=><button type="button" key={id} aria-pressed={form.anos_suiza===id} onClick={()=>change('anos_suiza',id)}>{label}</button>)}</div></fieldset>
    {error&&<p className="sv-error" role="alert">{error}</p>}</div><footer className="sv-footer"><button className="sv-button" disabled={busy||photoBusy} type="submit">{busy?'Guardando…':editing?'Guardar cambios':'▶ ¡A jugar!'}</button></footer></form>
}
export function Menu(){
  const {player,config,capabilities}=useSv()
  return <section className="sv-screen"><Header title="Menú"/><div className="sv-content"><div className="sv-chips">{config.comodines.map(c=><Chip key={c.id}>{c.emoji} {player.inventario?.[c.id]||0}</Chip>)}<Chip>🛡️ {player.inventario?.escudos||0}</Chip><Link to="/suizamente/tienda"><Chip>🪙 {player.monedas}</Chip></Link></div><nav className="sv-menu" aria-label="Menú"><Link to="/suizamente/misiones">🎯 <span>Misiones y eventos</span>›</Link>{capabilities?.admin&&<Link to="/suizamente/admin">🛠️ <span>Administración</span>›</Link>}<Link to="/suizamente/amigos">👥 <span>Amigos</span>›</Link><Link to="/suizamente/ranking">🏆 <span>Ranking</span>›</Link><Link to="/suizamente/libreta">🔖 <span>Libreta</span>›</Link><Link to="/suizamente/crea-preguntas">✍️ <span>Crea preguntas</span>›</Link><Link to="/suizamente/amigos">🔍 <span>Buscar jugadores</span>›</Link><Link to="/suizamente/perfil">👤 <span>Perfil</span>›</Link><Link to="/suizamente/logros">🏅 <span>Logros</span>›</Link><Link to="/suizamente/tienda">🛒 <span>Tienda</span>›</Link><Link to="/suizamente/como-se-juega">❓ <span>Cómo se juega</span>›</Link><Link to="/suizamente/ajustes">⚙️ <span>Ajustes<small>Avisos, cuenta y privacidad</small></span>›</Link></nav><Card className="sv-latido-card"><Logo size={44}/><div><b>Un juego de Latido</b><p>La comunidad hispanohablante en Suiza</p></div><a href="https://www.latido.ch" target="_blank" rel="noopener noreferrer">Abrir</a></Card></div></section>
}
export function Settings(){
  const {player,user,settings,updateSettings,savePlayer,signOut}=useSv(),navigate=useNavigate()
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[deletion,setDeletion]=useState(0)
  async function change(key,value){
    setError('')
    try{await updateSettings({...settings,[key]:value})}catch(e){setError(e.message)}
  }
  async function privacy(value){
    try{savePlayer(await szApi('jugador',{method:'PUT',body:{...player,en_ranking:value}}))}catch(e){setError(e.message)}
  }
  async function activatePush(){
    setBusy(true);setError('')
    try{await subscribeToPushNotifications({user,settings:loadPushSettings(),userCanton:player.canton});await change('avisos',{...settings.avisos,turnos:true})}catch(e){setError(e.message)}finally{setBusy(false)}
  }
  async function remove(){
    setBusy(true)
    try{
      await szApi('jugador',{method:'DELETE',body:{confirmacion:'BORRAR'}})
      await szApi('sesion/salir',{method:'POST'})
      localStorage.removeItem('suizamente:jugador')
      localStorage.removeItem('suizamente:invitado-con-datos')
      localStorage.removeItem('suizamente:onboarding')
      savePlayer({jugador:null})
      navigate('/suizamente/primera-vez',{replace:true});setDeletion(0)
    }catch(e){setError(e.message)}finally{setBusy(false)}
  }
  async function logout(){
    try{
      await szApi('sesion/salir',{method:'POST'})
      localStorage.removeItem('suizamente:jugador')
      localStorage.removeItem('suizamente:invitado-con-datos')
      await signOut()
      navigate('/suizamente/bienvenida')
    }catch(e){setError(e.message)}
  }
  return <section className="sv-screen"><Header title="Ajustes" back="/suizamente/menu"/><div className="sv-content sv-settings"><h2>Cuenta</h2><Link className="sv-settings-row" to="/suizamente/perfil/editar"><Avatar name={player.apodo} color={player.color}/><span>{player.apodo}<small>Editar perfil</small></span>›</Link>{!user&&<Button tone="quiet" to={'/auth?next='+encodeURIComponent('/suizamente/ajustes')}>Vincular con mi cuenta de Latido</Button>}<h2>Juego</h2>
    {[['sonidos','Sonidos'],['vibracion','Vibración'],['menosAnimaciones','Menos animaciones']].map(([key,label])=><label className="sv-settings-row" key={key}><span>{label}</span><input type="checkbox" role="switch" checked={!!settings[key]} onChange={e=>change(key,e.target.checked)}/></label>)}
    <h2>Avisos</h2><label className="sv-settings-row"><span>Te toca en una partida</span><input type="checkbox" role="switch" checked={settings.avisos?.turnos!==false} onChange={e=>change('avisos',{...settings.avisos,turnos:e.target.checked})}/></label>
    {user&&<Button tone="quiet" disabled={busy} onClick={activatePush}>🔔 Activar avisos en este dispositivo</Button>}
    <h2>Privacidad</h2><label className="sv-settings-row"><span>Aparecer en los rankings</span><input type="checkbox" role="switch" checked={player.en_ranking} onChange={e=>privacy(e.target.checked)}/></label><p>Tus votos son anónimos. Tu rival solo ve tus sellos y tu barra.</p>
    <h2>Ayuda</h2><nav className="sv-menu"><Link to="/suizamente/como-se-juega">Cómo se juega <span/>›</Link><Link to="/suizamente/primera-vez">Ver la bienvenida otra vez <span/>›</Link></nav>
    {user&&<Button tone="quiet" onClick={logout}>Cerrar sesión de Suizamente</Button>}
    <Button tone="danger-text" onClick={()=>setDeletion(1)}>Borrar mis datos de Suizamente</Button>
    {error&&<p role="alert" className="sv-error">{error}</p>}</div>
    {!!deletion&&<Sheet title={deletion===1?'¿Borrar tus datos de Suizamente?':'Confirma el borrado'} onClose={()=>setDeletion(0)}><p>{deletion===1?'Se borrarán tu perfil y tus partidas. Tus votos se conservarán anónimos. Tu cuenta de Latido seguirá disponible.':'Esta acción no se puede deshacer.'}</p><Button tone="danger" disabled={busy} onClick={()=>deletion===1?setDeletion(2):remove()}>{deletion===1?'Continuar':'Borrar definitivamente'}</Button></Sheet>}
  </section>
}
