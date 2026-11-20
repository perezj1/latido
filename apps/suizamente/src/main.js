import { createClient } from '@supabase/supabase-js'
import { resilientAuthStorage } from '../../../src/lib/authStorage.js'
import { connectSuizamenteSession,isSuizamentePath } from '../../../src/lib/suizamenteSessionBridge.js'
import { connectLatidoAccount } from './latidoSso.js'
import { publicConfig } from './config.js'
import { createSuizamenteInstall } from './install.js'
import './style.css'
import './access.css'
import {mountSuizamenteRegistration,completeRegistrationProfile,needsRegistrationProfile,prepareSuizamenteAccount} from './registration.js'

const root = document.getElementById('app')
const esc = text => String(text ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]))
let session = null, client, config, disposeFrame, booted = false
let accountMode = new URLSearchParams(location.search).get('mode') === 'login' ? 'login' : 'signup', signingOut = false
let disposeRegistration,registrationActive=false

const installation=createSuizamenteInstall({navigate:next=>{history.pushState(null,'',next);render()}})

function path() { return location.pathname.replace(/\/+$/, '') || '/' }
function message(text, error=false) {
  const node = root.querySelector('#message')
  if (node) { node.textContent = text; node.setAttribute('role', error ? 'alert' : 'status') }
}
function busy(form, value) { form.querySelectorAll('input,button').forEach(node => { node.disabled = value }) }
function authError(error) {
  if (error?.code === 'invalid_credentials') return 'El correo o la contraseña no son correctos.'
  if (error?.code === 'email_not_confirmed') return 'Confirma tu correo antes de entrar.'
  if (error?.status === 429) return 'Espera unos minutos antes de volver a intentarlo.'
  return 'No se ha podido completar la solicitud. Revisa los datos y vuelve a intentarlo.'
}
function shell(title, content, {back=true}={}) {
  root.innerHTML = `<section class="page">${back?'<a class="back" href="/">Volver al juego</a>':''}<img class="brand-icon" src="/suizamente/icons/suizamente-circle-logo-192.png" alt="Suizamente" width="64" height="64"><h1>${esc(title)}</h1>${content}<p class="legal"><a href="https://www.latido.ch/privacidad" target="_blank" rel="noopener">Privacidad</a> · <a href="https://www.latido.ch/terminos" target="_blank" rel="noopener">Términos de Latido</a></p></section>`
}
function metadata(privatePage) {
  document.querySelector('meta[name="robots"]').content = privatePage || __SUIZAMENTE_PREVIEW__ ? 'noindex, nofollow' : 'index, follow'
  if (privatePage) document.querySelector('meta[name="referrer"]').content = 'no-referrer'
}
function mountGame() {
  metadata(!['/','/bienvenida','/como-se-juega'].includes(path()))
  document.title = 'Suizamente · Un juego de Latido.ch'
  const frame = document.createElement('iframe')
  frame.className = 'game'
  frame.src = '/suizamente/juego.html'
  frame.title = 'Suizamente, un juego de Latido'
  frame.allow = 'clipboard-write; web-share'
  disposeFrame = connectSuizamenteSession({
    getFrame:() => frame.isConnected ? frame.contentWindow : null,
    getSession:() => client.auth.getSession(), api:config.api, standalone:true,
    experience:true,socialApi:config.socialApi,getPath:()=>location.pathname+location.search,
    onLogout:logout,
    onNavigate:next=>{history.pushState(null,'',next);installation.setRoute(new URL(next,location.origin).pathname);metadata(!['/','/bienvenida','/como-se-juega'].includes(new URL(next,location.origin).pathname))},
  })
  root.replaceChildren(frame)
}
async function logout() {
  if(signingOut)return
  signingOut=true
  try {
    const {error}=await client.auth.signOut({scope:'local'})
    if(error)throw error
    try{localStorage.setItem('suizamente:sso-optout','true')}catch{/* Storage may be unavailable. */}
    session=null;accountMode='signup'
    history.replaceState(null,'','/cuenta');render()
  }catch{
    const frame=root.querySelector('iframe.game')
    if(frame)frame.contentWindow.postMessage({type:'suizamente:logout-error'},location.origin)
    else{const button=root.querySelector('#logout');if(button)button.disabled=false;message('No se ha podido cerrar la sesión. Vuelve a intentarlo.',true)}
  }finally{signingOut=false}
}
function renderAccount() {
  metadata(true)
  document.title = 'Tu cuenta · Suizamente'
  if (session?.user) {
    shell('Tu cuenta de Suizamente', `<p>Has entrado en Suizamente.</p><p class="email">${esc(session.user.email)}</p><p>Tu progreso de Suizamente está vinculado a esta cuenta. También puedes usarla para entrar en Latido cuando quieras.</p><a class="button primary" href="/">Seguir jugando</a><button class="button secondary" id="logout">Cerrar sesión en esta app</button><p id="message" class="message" role="status" aria-live="polite"></p>`,{back:false})
    root.querySelector('#logout').onclick = async event => {
      event.currentTarget.disabled = true
      await logout()
    }
    return
  }
  function changeMode(mode) { accountMode=mode;history.replaceState(null,'','/cuenta'+(mode==='signup'?'':'?mode='+mode));render() }
  if(accountMode==='signup') {
    registrationActive=true
    disposeRegistration=mountSuizamenteRegistration(root,{
      client,socialApi:config.socialApi,redirectTo:location.origin+'/auth/callback',backHref:'/bienvenida',
      onLogin:()=>changeMode('login'),onGoogle:()=>googleLogin(),onComplete:()=>location.replace('/perfil'),
    })
    return
  }
  const recovery = accountMode === 'recovery'
  if(!recovery)root.innerHTML=`<section class="suizamente-access" data-theme="light"><div class="suizamente-access__inner"><a class="suizamente-access__back" href="/bienvenida" aria-label="Volver">←</a><header class="suizamente-access__heading"><img src="/suizamente/logo.svg" width="72" height="54" alt="Suizamente"><h1>Entra en Suizamente</h1><p>Entra con tu cuenta de Suizamente o con tu cuenta de Latido.</p></header><form id="account-form"><label>Email<input name="email" type="email" autocomplete="email" maxlength="254" placeholder="tu@email.com" required></label><label>Contraseña<input name="password" type="password" autocomplete="current-password" maxlength="254" placeholder="Tu contraseña" required></label><button class="suizamente-access__forgot" type="button" data-mode="recovery">¿Has olvidado la contraseña?</button><button class="suizamente-access__primary" type="submit">Entrar</button></form><p id="message" class="suizamente-access__message" role="status" aria-live="polite"></p><div class="suizamente-access__divider" aria-hidden="true">o</div><div class="suizamente-access__providers"><button id="google" type="button">Continuar con Google</button><button id="latido-login" type="button">Entrar con mi cuenta de Latido</button></div><footer class="suizamente-access__footer"><p>¿Aún no tienes cuenta en Suizamente? <button type="button" data-mode="signup">Crear cuenta</button></p></footer></div></section>`
  else shell('Recuperar contraseña', `<p>Te enviaremos un enlace para elegir una nueva contraseña.</p><form id="account-form"><label>Correo electrónico<input name="email" type="email" autocomplete="email" maxlength="254" required></label><button class="button primary" type="submit">Enviar enlace</button></form><p id="message" class="message" role="status" aria-live="polite"></p><div class="actions"><button data-mode="login">Ya tengo cuenta · Entrar</button></div>`,{back:false})
  const latido=root.querySelector('#latido-login')
  if(latido)latido.onclick=async()=>{try{localStorage.removeItem('suizamente:sso-optout')}catch{}latido.disabled=true;message('Abre tu cuenta de Latido en la ventana que aparece.');const linked=await connectLatidoAccount({client,socialApi:config.socialApi,popup:true});if(linked)location.replace('/');else{latido.disabled=false;message('Puedes entrar también con Google o con tu correo y contraseña.',true)}}
  root.querySelectorAll('[data-mode]').forEach(button => { button.onclick = () => { changeMode(button.dataset.mode) } })
  root.querySelector('#account-form').onsubmit = async event => {
    event.preventDefault()
    const form = event.currentTarget, values = new FormData(form)
    const email = String(values.get('email')).trim().toLowerCase()
    busy(form, true); message('Un momento…')
    try {
      let result
      if (recovery) {
        result = await client.auth.resetPasswordForEmail(email, { redirectTo:location.origin + '/auth/restablecer' })
      } else result = await client.auth.signInWithPassword({ email, password:String(values.get('password')) })
      if (result.error) return message(authError(result.error), true)
      if (result.data?.session) { try{localStorage.removeItem('suizamente:sso-optout')}catch{}location.replace('/'); return }
      message(recovery ? 'Si existe una cuenta con ese correo, recibirás un enlace para cambiar la contraseña. Ábrelo en este mismo navegador y dispositivo.' : 'Revisa tu correo para confirmar la cuenta. Abre el enlace en este mismo navegador y dispositivo.')
    } catch { message('No se ha podido conectar. Comprueba tu conexión y vuelve a intentarlo.', true) }
    finally { if (form.isConnected) busy(form, false) }
  }
  const google = root.querySelector('#google')
  if (google) google.onclick = () => googleLogin()
}
async function googleLogin() {
  const google=root.querySelector('#google')||root.querySelector('#register-google')
    try{localStorage.removeItem('suizamente:sso-optout')}catch{}
    try{sessionStorage.setItem('suizamente:oauth-inicio',String(Date.now()))}catch{}
    if(google)google.disabled = true
    try {
      const { error } = await client.auth.signInWithOAuth({ provider:'google', options:{ redirectTo:location.origin + '/auth/callback', queryParams:{ prompt:'select_account' } } })
      if (error) { if(google)google.disabled = false; message(authError(error), true) }
    } catch { if(google)google.disabled = false; message('No se ha podido abrir Google. Vuelve a intentarlo.', true) }
}
function renderRecovery() {
  metadata(true)
  document.title = 'Cambiar contraseña · Suizamente'
  history.replaceState(null, '', '/auth/restablecer')
  if (!session?.user) {
    shell('Enlace no disponible', '<p>Abre el enlace de recuperación desde tu correo. Si ha caducado, solicita otro desde tu cuenta.</p><a class="button primary" href="/cuenta">Volver a tu cuenta</a>')
    return
  }
  shell('Nueva contraseña', '<form id="password-form"><label>Nueva contraseña<input name="password" type="password" autocomplete="new-password" minlength="8" required></label><label>Repite la contraseña<input name="confirmation" type="password" autocomplete="new-password" minlength="8" required></label><button class="button primary">Guardar contraseña</button></form><p id="message" class="message" role="status" aria-live="polite"></p>')
  root.querySelector('#password-form').onsubmit = async event => {
    event.preventDefault()
    const form = event.currentTarget, values = new FormData(form)
    if (values.get('password') !== values.get('confirmation')) return message('Las contraseñas no coinciden.', true)
    busy(form, true)
    try {
      const { error } = await client.auth.updateUser({ password:String(values.get('password')) })
      if (error) { busy(form,false); return message(authError(error),true) }
      location.replace('/cuenta')
    } catch { busy(form,false); message('No se ha podido guardar. Vuelve a intentarlo.',true) }
  }
}
function renderInstall() {
  metadata(false)
  document.title = 'Instalar Suizamente · Latido.ch'
  installation.renderGuide(root)
}
function renderProfileSetup(){
  metadata(true);document.title='Tu perfil · Suizamente';registrationActive=true
  if(path().startsWith('/auth/'))history.replaceState(null,'','/cuenta')
  disposeRegistration=mountSuizamenteRegistration(root,{client,socialApi:config.socialApi,profileOnly:true,initialUser:session?.user,onComplete:()=>location.replace('/perfil')})
}
function render() {
  installation.setRoute(path())
  disposeFrame?.(); disposeFrame = null
  disposeRegistration?.();disposeRegistration=null;registrationActive=false
  if(needsRegistrationProfile(session?.user)){renderProfileSetup();return}
  if (isSuizamentePath(location.pathname+location.search)) mountGame()
  else if (path() === '/cuenta') renderAccount()
  else if (path() === '/instalar') renderInstall()
  else if (path() === '/auth/restablecer') renderRecovery()
  else if (path() === '/auth/callback') {
    metadata(true)
    // getSession() has already awaited the SDK's single automatic PKCE exchange.
    history.replaceState(null, '', '/auth/callback')
    if (session?.user) location.replace('/')
    else shell('No se ha podido entrar', '<p>El enlace puede haber caducado o haberse abierto en otro navegador. Vuelve a entrar con tu cuenta.</p><a class="button primary" href="/cuenta">Entrar de nuevo</a>')
  } else {
    metadata(true)
    shell('Página no encontrada', '<p>Esta página no está disponible.</p><a class="button primary" href="/">Volver al juego</a>')
  }
}

async function start() {
  try {
    config = publicConfig(import.meta.env)
    config.socialApi=config.url+'/functions/v1/suizamente-social'
    client = createClient(config.url, config.key, {
      auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:true, flowType:'pkce', storage:resilientAuthStorage },
    })
    client.auth.onAuthStateChange((_event, nextSession) => {
      const changed = session?.user?.id !== nextSession?.user?.id
      session = nextSession
      if (booted && changed && !signingOut && !registrationActive && (isSuizamentePath(location.pathname+location.search)||path()==='/cuenta')) setTimeout(render, 0)
    })
    session = (await client.auth.getSession()).data.session
    session = await prepareSuizamenteAccount({client})
    let skipSso=false;try{skipSso=localStorage.getItem('suizamente:sso-optout')==='true'}catch{}
    if(!session&&path()!=='/cuenta'&&path()!=='/instalar'&&!path().startsWith('/auth/')&&!window.SUIZAMENTE_DISABLE_SSO&&!skipSso)session=await connectLatidoAccount({client,socialApi:config.socialApi})
    if(!needsRegistrationProfile(session?.user))try{await completeRegistrationProfile({client,socialApi:config.socialApi})}catch{booted=true;renderProfileSetup();return}
    booted = true
    render()
    if (import.meta.env.PROD && 'serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js', { scope:'/' }).catch(() => {})
  } catch (error) {
    console.error('Suizamente: ' + error.message)
    shell('No se ha podido abrir Suizamente', '<p>Vuelve a intentarlo dentro de un momento.</p><a class="button primary" href="/">Volver a intentar</a>')
  }
}
window.addEventListener('popstate',()=>{
  const frame=root.querySelector('iframe.game')
  if(frame&&isSuizamentePath(location.pathname+location.search))frame.contentWindow.postMessage({type:'suizamente:route',path:location.pathname+location.search},location.origin)
  else render()
})
start()
