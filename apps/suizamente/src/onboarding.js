import slides from './onboarding-slides.json'
import {mountSuizamenteRegistration} from './registration.js'
import './onboarding.css'

export const needsSuizamenteOnboarding = user => !!user && (user.user_metadata?.suizamente_onboarding_completed !== true || !String(user.user_metadata?.suizamente_nombre || user.user_metadata?.name || '').trim())
const progress=step=>`<div class="s-onb-progress" role="progressbar" aria-label="Onboarding de Suizamente" aria-valuemin="1" aria-valuemax="5" aria-valuenow="${step+1}" aria-valuetext="Paso ${step+1} de 5">${[0,1,2,3,4].map(i=>`<span class="${i<=step?'active':''}"></span>`).join('')}</div>`

export function mountSuizamenteOnboarding(root,{client,socialApi,user,onComplete}){
  const key='suizamente:onboarding:paso:'+user.id
  let step=0,disposed=false,disposeProfile,resize
  const seed={...user,user_metadata:{...user.user_metadata}}
  try{step=Math.max(0,Math.min(4,Number(sessionStorage.getItem(key))||0))}catch{}
  // Import the existing Latido name as the initial value, while leaving the
  // final profile form editable and requiring a non-empty name.
  client.from('profiles').select('name,canton').eq('id',user.id).maybeSingle().then(({data})=>{
    if(data&&step<4){if(data.name)seed.user_metadata.name=data.name;if(data.canton)seed.user_metadata.canton=data.canton}
  }).catch(()=>{})
  function go(next){step=next;try{sessionStorage.setItem(key,String(step))}catch{};render()}
  function render(){
    if(disposed)return
    disposeProfile?.();disposeProfile=null;resize?.disconnect()
    if(step===4){
      root.innerHTML=`<section class="s-onboarding s-onb-profile"><header class="s-onb-profile-top">${progress(4)}<div><button class="s-onb-back" type="button" aria-label="Paso anterior">←</button><img src="/suizamente/logo.svg" width="72" height="54" alt="Suizamente"><span>Paso 5 de 5</span></div></header><div id="onboarding-profile"></div></section>`
      root.querySelector('.s-onb-back').onclick=()=>go(3)
      disposeProfile=mountSuizamenteRegistration(root.querySelector('#onboarding-profile'),{
        client,socialApi,profileOnly:true,completeOnboarding:true,initialUser:seed,
        onComplete:()=>{try{sessionStorage.removeItem(key)}catch{};onComplete()},
      })
    }else{
      const slide=slides[step]
      root.innerHTML=`<section class="s-onboarding"><div class="s-onb-hero" style="background:${slide.background}"><div class="s-onb-top">${progress(step)}<button type="button" data-skip>Saltar</button></div><div class="s-onb-art onb-voto">${slide.art}</div></div><div class="s-onb-content">${slide.content}${step?'<small class="s-onb-example">Ilustración con cifras de ejemplo.</small>':''}<footer class="s-onb-actions">${step?'<button class="s-onb-back" type="button" aria-label="Paso anterior">←</button>':''}<button class="s-onb-next" type="button">${step===0?'Empezar →':'Siguiente →'}</button></footer></div></section>`
      root.querySelector('[data-skip]').onclick=()=>go(4)
      const back=root.querySelector('.s-onb-back');if(back)back.onclick=()=>go(step-1)
      root.querySelector('.s-onb-next').onclick=()=>go(step+1)
      const hero=root.querySelector('.s-onb-hero'),art=root.querySelector('.s-onb-art')
      const scale=()=>{const width=hero.clientWidth,height=window.visualViewport?.height||window.innerHeight,factor=Math.min(width/390,height*(height<740?.46:.55)/468);hero.style.height=468*factor+'px';art.style.transform=`translateX(-50%) scale(${factor})`}
      resize=new ResizeObserver(scale);resize.observe(root);scale()
    }
    root.querySelector('.s-onboarding').scrollTo({top:0})
    root.querySelector('h1')?.setAttribute('tabindex','-1')
    root.querySelector('h1')?.focus({preventScroll:true})
  }
  render()
  return ()=>{disposed=true;disposeProfile?.();resize?.disconnect()}
}

// The welcome screen is public; no player profile or vote is created here.
export function mountSuizamenteWelcome(root,{onSignup,onLogin}){
  root.innerHTML=`<section class="s-onboarding s-onb-welcome"><div class="s-onb-welcome-brand"><img src="/suizamente/logo.svg" width="128" height="96" alt="Suizamente"><h1><span>Suiza</span><span>mente</span></h1><p>Aprende cómo funciona Suiza jugando con la comunidad hispanohablante.</p></div><div class="s-onb-welcome-cards" aria-hidden="true"><article><small>🤔 ¿QUÉ PREFIERES?</small><b>¿Fondue o raclette en pleno agosto?</b></article><article><small>🕵️ ¿VERDAD O MITO?</small><b>Zúrich tiene metro.</b><span>Verdad　·　Mito</span></article><article><span>💡 Elige, compárate y aprende algo nuevo sobre Suiza.</span></article></div><footer class="s-onb-welcome-actions"><button class="s-onb-next" data-signup type="button">Crear cuenta</button><button class="s-onb-login" data-login type="button">Ya tengo una cuenta</button><p>Un juego de <b>latido.ch</b></p></footer></section>`
  root.querySelector('[data-signup]').onclick=onSignup
  root.querySelector('[data-login]').onclick=onLogin
  return ()=>{}
}
