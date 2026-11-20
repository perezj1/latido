const escape = value => String(value ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))

export function registrationError(error) {
  if (error?.code === 'user_already_exists' || /already (registered|exists)/i.test(error?.message || '')) return 'Ya tienes una cuenta. Pulsa «Ya tengo cuenta · Entrar».'
  if (error?.status === 429) return 'Espera unos minutos antes de volver a intentarlo.'
  if (error?.code === 'weak_password') return 'Elige una contraseña más segura, de al menos 8 caracteres.'
  return 'No se ha podido crear la cuenta. Revisa los datos y vuelve a intentarlo.'
}

// Demographic choices travel with email confirmation, even on another device.
// Only a confirmed session may write them through the existing profile API.
export async function completeRegistrationProfile({client, socialApi}) {
  const {data:{session}} = await client.auth.getSession()
  const profile = session?.user?.user_metadata?.suizamente_perfil_pendiente
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return
  const body = Object.fromEntries(['pais','canton','anosSuiza'].map(key => [key,typeof profile[key] === 'string' ? profile[key] : '']))
  const response = await fetch(socialApi + '/profile', {
    method:'PUT', headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},
    body:JSON.stringify(body), signal:AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error('No se ha podido guardar tu perfil. Tu cuenta ya está creada; vuelve a intentarlo.')
  const {error} = await client.auth.updateUser({data:{suizamente_perfil_pendiente:null}})
  if (error) throw new Error('No se ha podido completar el perfil. Vuelve a intentarlo.')
}

export function mountSuizamenteRegistration(root, {client, redirectTo, backHref, onLogin, onGoogle, onComplete}) {
  let disposed=false, submitting=false, step=0, choices=null
  const values={email:'',password:'',name:'',pais:'',canton:'',anosSuiza:'',terms:false}
  const message=(text,error=false)=>{
    const node=root.querySelector('#message')
    if(node){node.textContent=text;node.setAttribute('role',error?'alert':'status')}
  }
  function remember(form) {
    const fields=new FormData(form)
    for(const key of ['email','password','name','pais','canton','anosSuiza'])if(fields.has(key))values[key]=String(fields.get(key))
    if(fields.has('name'))values.terms=fields.has('terms')
  }
  const options=(list,selected,placeholder)=>'<option value="">'+placeholder+'</option>'+Object.entries(list).map(([id,label])=>`<option value="${escape(id)}" ${selected===id?'selected':''}>${escape(label)}</option>`).join('')
  function render() {
    if(disposed)return
    root.innerHTML=`<section class="suizamente-access" data-theme="light"><div class="suizamente-access__inner">
      ${step?'<button class="suizamente-access__back" type="button" data-back aria-label="Volver al correo y contraseña">←</button>':`<a class="suizamente-access__back" href="${escape(backHref)}" aria-label="Volver">←</a>`}
      <header class="suizamente-access__heading"><img src="/suizamente/logo.svg" width="72" height="54" alt="Suizamente"><p class="suizamente-access__step">Paso ${step+1} de 2</p><h1>${step?'Tu perfil en Suizamente':'Crea tu cuenta'}</h1><p>${step?'Elige el nombre con el que te verá la comunidad.':'Una misma cuenta para Suizamente y Latido. Guarda tus puntos, rachas y medallas.'}</p></header>
      <form id="registration-form">
        ${step?`<label>Nombre de usuario<input name="name" autocomplete="nickname" minlength="2" maxlength="80" value="${escape(values.name)}" placeholder="Tu nombre en el juego" required aria-describedby="name-hint"></label><p class="suizamente-access__hint" id="name-hint">Obligatorio. Será tu nombre visible en Suizamente y Latido.</p>
          <label>País de origen<select name="pais" aria-label="País de origen">${options(choices.PAISES,values.pais,'Prefiero no indicarlo')}</select></label>
          <label>Cantón<select name="canton" aria-label="Cantón">${options(choices.CANTONES,values.canton,'Elige tu cantón (opcional)')}</select></label>
          <label>¿Cuánto llevas en Suiza?<select name="anosSuiza" aria-label="¿Cuánto llevas en Suiza?">${options(choices.ANOS,values.anosSuiza,'Prefiero no indicarlo')}</select></label>
          <label class="suizamente-access__check"><input name="terms" type="checkbox" ${values.terms?'checked':''} required><span>Acepto los <a href="https://www.latido.ch/terminos" target="_blank" rel="noopener">términos</a> y he leído la <a href="https://www.latido.ch/privacidad" target="_blank" rel="noopener">política de privacidad</a>.</span></label>`:
          `<label>Email<input name="email" type="email" autocomplete="email" maxlength="254" value="${escape(values.email)}" placeholder="tu@email.com" required></label><label>Contraseña<input name="password" type="password" autocomplete="new-password" minlength="8" maxlength="254" value="${escape(values.password)}" placeholder="Mínimo 8 caracteres" required></label>`}
        <button class="suizamente-access__primary" type="submit">${step?'Guardar perfil y crear cuenta':'Crear cuenta'}</button>
      </form><p id="message" class="suizamente-access__message" role="status" aria-live="polite"></p>
      ${!step&&onGoogle?'<div class="suizamente-access__divider" aria-hidden="true">o</div><div class="suizamente-access__providers"><button type="button" id="register-google">Continuar con Google</button></div>':''}
      <footer class="suizamente-access__footer"><button type="button" data-login>Ya tengo cuenta · Entrar</button></footer>
    </div></section>`
    root.querySelector('[data-login]').onclick=()=>{if(!submitting){values.password='';onLogin()}}
    const back=root.querySelector('[data-back]')
    if(back)back.onclick=()=>{remember(root.querySelector('form'));step=0;render()}
    const google=root.querySelector('#register-google')
    if(google)google.onclick=()=>onGoogle()
    root.querySelector('form').onsubmit=async event=>{
      event.preventDefault()
      if(submitting)return
      const form=event.currentTarget
      remember(form)
      if(!step){
        values.email=values.email.trim().toLowerCase()
        if(!choices)await loaded
        if(disposed)return
        if(!choices){message('No se han podido cargar las opciones del perfil. Recarga para volver a intentarlo.',true);return}
        step=1;render();root.querySelector('[name="name"]').focus({preventScroll:true});return
      }
      values.name=values.name.trim().replace(/\s+/g,' ')
      if(values.name.length<2){message('Introduce un nombre de usuario de al menos 2 caracteres.',true);root.querySelector('[name="name"]').focus();return}
      submitting=true
      root.querySelectorAll('input,select,button').forEach(node=>{node.disabled=true})
      message('Creando tu cuenta…')
      try{
        const {data,error}=await client.auth.signUp({email:values.email,password:values.password,options:{emailRedirectTo:redirectTo,data:{name:values.name,canton:values.canton,languages:[],latido_onboarding_completed:false,suizamente_perfil_pendiente:{pais:values.pais,canton:values.canton,anosSuiza:values.anosSuiza}}}})
        if(error){message(registrationError(error),true);return}
        values.password=''
        if(data?.session){onComplete();return}
        // Supabase deliberately obscures duplicate emails; never claim a new
        // account exists until the email link has authenticated its owner.
        root.querySelector('form').remove()
        root.querySelector('[data-back]')?.remove()
        message('Revisa tu correo para confirmar la cuenta. Si ya tienes una cuenta de Latido, pulsa «Ya tengo cuenta · Entrar».')
      }catch{message('No se ha podido conectar. Comprueba tu conexión y vuelve a intentarlo.',true)}
      finally{submitting=false;root.querySelectorAll('input,select,button').forEach(node=>{node.disabled=false})}
    }
    root.querySelector('form').oninput=()=>message('')
  }
  // Load the same canonical choices used by the game, without copying lists.
  const choicesUrl=new URL('/suizamente/experiencia-datos.js',location.origin).href
  const loaded=import(/* @vite-ignore */ choicesUrl).then(data=>{choices=data}).catch(()=>{})
  render()
  return ()=>{disposed=true;values.password=''}
}
