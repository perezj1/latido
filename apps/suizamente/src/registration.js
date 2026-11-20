const escape = value => String(value ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))

export function registrationError(error) {
  if (error?.code === 'user_already_exists' || /already (registered|exists)/i.test(error?.message || '')) return 'Ya tienes una cuenta. Pulsa «Ya tengo cuenta · Entrar».'
  if (error?.status === 429) return 'Espera unos minutos antes de volver a intentarlo.'
  if (error?.code === 'weak_password') return 'Elige una contraseña más segura, de al menos 8 caracteres.'
  return 'No se ha podido crear la cuenta. Revisa los datos y vuelve a intentarlo.'
}

// Demographic choices travel with email confirmation, even on another device.
// Only a confirmed session may write them through the existing profile API.
export async function completeRegistrationProfile({client, socialApi,completeOnboarding=false}) {
  const {data:{session}} = await client.auth.getSession()
  const profile = session?.user?.user_metadata?.suizamente_perfil_pendiente
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return
  const body = Object.fromEntries(['pais','canton','anosSuiza'].map(key => [key,typeof profile[key] === 'string' ? profile[key] : '']))
  const response = await fetch(socialApi + '/profile', {
    method:'PUT', headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},
    body:JSON.stringify(body), signal:AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error('No se ha podido guardar tu perfil. Tu cuenta ya está creada; vuelve a intentarlo.')
  const {error} = await client.auth.updateUser({data:{suizamente_perfil_pendiente:null,suizamente_necesita_perfil:false,...(completeOnboarding?{suizamente_onboarding_completed:true}:{})}})
  if (error) throw new Error('No se ha podido completar el perfil. Vuelve a intentarlo.')
}

export const needsRegistrationProfile = user => user?.user_metadata?.suizamente_necesita_perfil === true

// A new Google account created from Suizamente completes this game's profile.
// Existing Latido accounts keep their origin and their existing onboarding.
export async function prepareSuizamenteAccount({client,storage,now=Date.now()}) {
  let {data:{session}}=await client.auth.getSession()
  if(!session?.user)return session
  // An older session on another device may contain stale onboarding metadata.
  // Check the account before showing the tutorial again; persist only a newer
  // completed state through the SDK's normal session machinery.
  if(session.user.user_metadata?.suizamente_onboarding_completed!==true&&typeof client.auth.getUser==='function'){
    const latest=await client.auth.getUser().catch(()=>null)
    if(latest?.data?.user?.id===session.user.id&&latest.data.user.user_metadata?.suizamente_onboarding_completed===true){
      const saved=await client.auth.setSession({access_token:session.access_token,refresh_token:session.refresh_token})
      if(!saved.error&&saved.data?.session)session=saved.data.session
    }
  }
  if(!storage)try{storage=globalThis.sessionStorage}catch{return session}
  if(!storage)return session
  let started=0
  try{started=Number(storage.getItem('suizamente:oauth-inicio'))}catch{}
  if(!started)return session
  const user=session.user,meta=user.user_metadata||{},created=Date.parse(user.created_at||'')
  const social=(user.app_metadata?.providers||[user.app_metadata?.provider]).some(p=>p==='google'||p==='apple')
  if(social&&Number.isFinite(created)&&created>=started-5000&&now-created<600000&&meta.latido_onboarding_completed!==true&&!Object.hasOwn(meta,'suizamente_necesita_perfil')&&!meta.registro_origen){
    const result=await client.auth.updateUser({data:{registro_origen:'suizamente',suizamente_necesita_perfil:true,latido_onboarding_completed:false}})
    if(result.error)throw new Error('No se ha podido abrir tu perfil de Suizamente. Vuelve a intentarlo.')
  }
  try{storage.removeItem('suizamente:oauth-inicio')}catch{}
  return (await client.auth.getSession()).data.session
}

export function mountSuizamenteRegistration(root, {client, socialApi, redirectTo, backHref, onLogin, onGoogle, onLatido=onLogin, onComplete, profileOnly=false,completeOnboarding=false, initialUser=null}) {
  let disposed=false, submitting=false, step=profileOnly?1:0, choices=null, accountUser=null
  const values={email:'',password:'',name:'',pais:'',canton:'',anosSuiza:'',terms:false}
  const message=(text,error=false)=>{
    const node=root.querySelector('#message')
    if(node){node.textContent=text;node.setAttribute('role',error?'alert':'status')}
  }
  function remember(form) {
    const fields=new FormData(form)
    for(const key of ['email','password','name','pais','canton','anosSuiza'])if(fields.has(key)&&(choices||!['pais','canton','anosSuiza'].includes(key)))values[key]=String(fields.get(key))
    if(form.elements.namedItem('terms'))values.terms=fields.has('terms')
  }
  const draftKey=()=>accountUser?.id?'suizamente:registro:'+accountUser.id:null
  function saveDraft(){try{const key=draftKey();if(key)sessionStorage.setItem(key,JSON.stringify(Object.fromEntries(['name','pais','canton','anosSuiza'].map(k=>[k,values[k]]))))}catch{/* The profile form also works without storage. */}}
  function restoreDraft(){try{const saved=JSON.parse(sessionStorage.getItem(draftKey())||'{}');for(const k of ['name','pais','canton','anosSuiza'])if(typeof saved[k]==='string')values[k]=saved[k]}catch{}}
  const options=(list,selected,placeholder)=>'<option value="">'+placeholder+'</option>'+Object.entries(list).map(([id,label])=>`<option value="${escape(id)}" ${selected===id?'selected':''}>${escape(label)}</option>`).join('')
  function render() {
    if(disposed)return
    root.innerHTML=`<section class="suizamente-access" data-theme="light"><div class="suizamente-access__inner">
      ${!step?`<a class="suizamente-access__back" href="${escape(backHref)}" aria-label="Volver">←</a>`:''}
      <header class="suizamente-access__heading"><img src="/suizamente/logo.svg" width="72" height="54" alt="Suizamente"><h1>${step?'Tu perfil en Suizamente':'Crea tu cuenta'}</h1><p>${step?'Elige cómo quieres aparecer en el juego.':'Crea tu cuenta de Suizamente. También podrás usarla para entrar en Latido cuando quieras.'}</p></header>
      <form id="registration-form">
        ${step?`<label>Nombre de usuario<input name="name" autocomplete="nickname" minlength="2" maxlength="80" value="${escape(values.name)}" placeholder="Tu nombre en el juego" required aria-describedby="name-hint"></label><p class="suizamente-access__hint" id="name-hint">Obligatorio. Será tu nombre visible en Suizamente.</p>
          <label>País de origen<select name="pais" aria-label="País de origen">${options(choices?.PAISES||{},values.pais,'Prefiero no indicarlo')}</select></label>
          <label>Cantón<select name="canton" aria-label="Cantón">${options(choices?.CANTONES||{},values.canton,'Elige tu cantón (opcional)')}</select></label>
          <label>¿Cuánto llevas en Suiza?<select name="anosSuiza" aria-label="¿Cuánto llevas en Suiza?">${options(choices?.ANOS||{},values.anosSuiza,'Prefiero no indicarlo')}</select></label>`:
          `<label>Email<input name="email" type="email" autocomplete="email" maxlength="254" value="${escape(values.email)}" placeholder="tu@email.com" required></label><label>Contraseña<input name="password" type="password" autocomplete="new-password" minlength="8" maxlength="254" value="${escape(values.password)}" placeholder="Mínimo 8 caracteres" required></label><label class="suizamente-access__check"><input name="terms" type="checkbox" ${values.terms?'checked':''} required><span>Acepto los <a href="https://www.latido.ch/terminos" target="_blank" rel="noopener">términos</a> y he leído la <a href="https://www.latido.ch/privacidad" target="_blank" rel="noopener">política de privacidad</a>.</span></label>`}
        <button class="suizamente-access__primary" type="submit" ${step&&!choices?'disabled':''}>${step?(completeOnboarding?'¡A jugar!':'Guardar perfil'):'Crear cuenta'}</button>
      </form><p id="message" class="suizamente-access__message" role="status" aria-live="polite"></p>
      ${!step&&onGoogle?'<div class="suizamente-access__divider" aria-hidden="true">o</div><div class="suizamente-access__providers"><button type="button" id="register-google">Continuar con Google</button><button type="button" id="register-latido">Entrar con mi cuenta de Latido</button></div>':''}
      ${!step?'<footer class="suizamente-access__footer"><button type="button" data-login>Ya tengo cuenta · Entrar</button></footer>':''}
    </div></section>`
    const login=root.querySelector('[data-login]')
    if(login)login.onclick=()=>{if(!submitting){values.password='';onLogin()}}
    const google=root.querySelector('#register-google')
    if(google)google.onclick=()=>onGoogle()
    const latido=root.querySelector('#register-latido')
    if(latido)latido.onclick=()=>{if(!submitting){values.password='';onLatido()}}
    root.querySelector('form').onsubmit=async event=>{
      event.preventDefault()
      if(submitting)return
      const form=event.currentTarget
      remember(form)
      if(step){values.name=values.name.trim().replace(/\s+/g,' ');if(values.name.length<2){message('Introduce un nombre de usuario de al menos 2 caracteres.',true);root.querySelector('[name="name"]').focus();return}}
      submitting=true
      root.querySelectorAll('input,select,button').forEach(node=>{node.disabled=true})
      message(step?'Guardando tu perfil…':'Creando tu cuenta…')
      try{
        if(!step){
          values.email=values.email.trim().toLowerCase()
          const {data,error}=await client.auth.signUp({email:values.email,password:values.password,options:{emailRedirectTo:redirectTo,data:{registro_origen:'suizamente',latido_onboarding_completed:false,suizamente_necesita_perfil:true}}})
          if(disposed)return
          if(error){message(registrationError(error),true);return}
          if(!data?.user||(!data.session&&data.user.identities?.length===0)){message('Revisa tu correo. Si ya tienes cuenta en Suizamente o Latido, pulsa «Ya tengo cuenta · Entrar».');values.password='';return}
          values.password=''
          if(data.session){onComplete();return}
          form.remove();root.querySelector('.suizamente-access__providers')?.remove();root.querySelector('.suizamente-access__divider')?.remove()
          message('Tu cuenta está creada. Confirma tu correo y entra para empezar el onboarding de Suizamente.')
          return
        }
        saveDraft()
        let current=(await client.auth.getSession()).data.session
        if(!current&&values.password){
          const result=await client.auth.signInWithPassword({email:values.email,password:values.password})
          if(result.error?.code==='email_not_confirmed'||/email not confirmed/i.test(result.error?.message||'')){message('Confirma tu correo y vuelve a pulsar «Guardar perfil». Tus opciones se conservan.',true);return}
          if(result.error)throw new Error('Entra con tu cuenta para guardar el perfil.')
          current=result.data.session
        }
        if(disposed)return
        if(!current?.user)throw new Error('Confirma tu correo y entra con tu cuenta para guardar el perfil.')
        if(accountUser?.id&&current.user.id!==accountUser.id)throw new Error('Entra con la cuenta que acabas de crear para guardar este perfil.')
        const profile={pais:values.pais,canton:values.canton,anosSuiza:values.anosSuiza}
        const saved=await client.from('profiles').upsert({id:current.user.id,email:current.user.email,name:values.name,canton:values.canton||null},{onConflict:'id'})
        if(saved.error)throw new Error('No se ha podido guardar tu nombre. Vuelve a intentarlo.')
        const updated=await client.auth.updateUser({data:{name:values.name,canton:values.canton,suizamente_necesita_perfil:true,suizamente_perfil_pendiente:profile}})
        if(updated.error)throw new Error('No se ha podido guardar tu perfil. Vuelve a intentarlo.')
        await completeRegistrationProfile({client,socialApi,completeOnboarding})
        values.password=''
        try{sessionStorage.removeItem(draftKey())}catch{}
        if(!disposed)onComplete()
      }catch(error){if(!disposed)message(error.message||'No se ha podido conectar. Vuelve a intentarlo.',true)}
      finally{submitting=false;root.querySelectorAll('input,select,button').forEach(node=>{node.disabled=false})}
    }
    root.querySelector('form').oninput=()=>{message('');if(step){remember(root.querySelector('form'));saveDraft()}}
  }
  // Load the same canonical choices used by the game, without copying lists.
  const choicesUrl=new URL('/suizamente/experiencia-datos.js',location.origin).href
  import(/* @vite-ignore */ choicesUrl).then(data=>{if(step&&!disposed)remember(root.querySelector('form'));choices=data;if(step&&!disposed)render()}).catch(()=>{})
  if(profileOnly&&initialUser){accountUser=initialUser;values.name=accountUser.user_metadata?.name||'';values.email=accountUser.email;for(const k of ['pais','canton','anosSuiza']){const v=accountUser.user_metadata?.suizamente_perfil_pendiente?.[k];if(typeof v==='string')values[k]=v}restoreDraft()}
  render()
  return ()=>{disposed=true;values.password=''}
}
