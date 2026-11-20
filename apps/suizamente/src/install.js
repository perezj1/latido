import './install.css'

const ICON='/suizamente/icons/suizamente-circle-logo-192.png'
const INSTALLED='suizamente:pwa-installed',DISMISSED='suizamente:install-dismissed'
const read=(storage,key)=>{try{return window[storage].getItem(key)==='1'}catch{return false}}
const write=(storage,key)=>{try{window[storage].setItem(key,'1')}catch{/* Installation also works without storage. */}}

// Shared by the standalone PWA and its integrated localhost/Latido preview.
// The integrated host must never prompt installation of Latido's root manifest.
export function createSuizamenteInstall({integrated=false,navigate}) {
  const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)
  const android=/Android/i.test(navigator.userAgent)
  const displays=['standalone','minimal-ui','window-controls-overlay'].map(mode=>window.matchMedia(`(display-mode: ${mode})`))
  let prompt=null,installed=read('localStorage',INSTALLED),dismissed=read('sessionStorage',DISMISSED)
  let route='',banner=null,guide=null,backHref='/',active=true
  const isInstalled=()=>!integrated&&(installed||navigator.standalone===true||displays.some(query=>query.matches))

  function dismiss(){dismissed=true;write('sessionStorage',DISMISSED);renderBanner()}
  function remember(){installed=true;prompt=null;write('localStorage',INSTALLED);refresh()}
  function setRoute(path){route=path.split('?')[0];if(route!=='/instalar')guide=null;renderBanner()}
  function refresh(){if(!active)return;if(isInstalled()&&!installed)remember();else{renderBanner();if(guide?.isConnected)renderGuide(guide,{back:backHref})}}
  function beforeInstall(event){event.preventDefault();if(isInstalled())return;prompt=event;refresh()}
  async function install(){
    if(integrated){location.assign('https://suizamente.latido.ch/instalar');return}
    if(isInstalled())return
    if(!prompt){
      if(route!=='/instalar'){navigate('/instalar');return}
      const status=guide?.querySelector('[data-install-status]')
      if(status)status.textContent=ios?'En Safari, pulsa Compartir y elige «Añadir a pantalla de inicio».':'Abre el menú de tu navegador y elige «Instalar aplicación» o «Añadir a pantalla de inicio».'
      return
    }
    const request=prompt;prompt=null
    try{
      await request.prompt()
      if((await request.userChoice).outcome==='accepted')remember()
      else dismiss()
    }catch{
      if(route!=='/instalar')navigate('/instalar')
      else{const status=guide?.querySelector('[data-install-status]');if(status)status.textContent='Puedes instalar desde el menú de tu navegador.'}
    }
    refresh()
  }
  function renderBanner(){
    banner?.remove();banner=null
    if(!active||isInstalled()||dismissed||route!=='/'||(!ios&&!android&&!prompt))return
    banner=document.createElement('aside');banner.className='suizamente-install-banner';banner.setAttribute('aria-label','Instalar Suizamente')
    if(route==='/bienvenida')banner.style.bottom='max(16px, env(safe-area-inset-bottom))'
    banner.innerHTML=`<img src="${ICON}" width="46" height="46" alt=""><div class="suizamente-install-banner-copy"><b>Instala Suizamente en tu ${ios?'iPhone':android?'móvil':'dispositivo'}</b><p>Gratis. Directo desde el navegador.</p><div><button type="button" data-install>${ios?'Cómo instalar':'Instalar'}</button><button type="button" data-dismiss>Ahora no</button></div></div>`
    banner.querySelector('[data-install]').onclick=()=>ios||integrated?navigate('/instalar'):install()
    banner.querySelector('[data-dismiss]').onclick=dismiss
    document.body.append(banner)
  }
  function renderGuide(container,{back='/'}={}){
    guide=container;backHref=back;route='/instalar';renderBanner()
    const done=isInstalled()
    container.innerHTML=`<section class="suizamente-install-page"><a class="suizamente-install-back" href="${back}">Volver al juego</a><img class="suizamente-install-logo" src="${ICON}" width="80" height="80" alt="Suizamente"><h1>Suizamente en tu móvil</h1><p>Instala Suizamente para abrir el juego directamente desde tu pantalla de inicio.</p>${done?'<p class="suizamente-install-note" role="status">Suizamente ya está instalada en este dispositivo.</p>':`<button class="suizamente-install-primary" type="button" data-install>${integrated?'Abrir Suizamente para instalar':'Instalar Suizamente'}</button>`}${integrated?'<p class="suizamente-install-note">Instala desde <b>suizamente.latido.ch</b> para tener el icono y el juego de Suizamente.</p>':''}<div class="suizamente-install-guide-grid"><section class="suizamente-install-guide ${ios?'preferred':''}"><h2>🍎 iPhone y iPad</h2><ol><li>Abre <b>suizamente.latido.ch</b> en Safari.</li><li>Pulsa <b>Compartir 📤</b>. Si está dentro del menú <b>•••</b>, ábrelo primero.</li><li>Selecciona <b>Añadir a pantalla de inicio</b>.</li><li>Confirma con <b>Añadir</b>. ¡Listo!</li></ol></section><section class="suizamente-install-guide ${android?'preferred':''}"><h2>🤖 Android</h2><ol><li>Abre <b>suizamente.latido.ch</b> en Chrome.</li><li>Pulsa <b>Instalar Suizamente</b> o abre el menú <b>⋮</b>.</li><li>Elige <b>Instalar aplicación</b> o <b>Añadir a pantalla de inicio</b> y confirma.</li></ol></section></div><section class="suizamente-install-guide"><h2>🎬 Vídeo de instalación</h2><p>El vídeo usa Latido como ejemplo. Sigue los mismos pasos en Suizamente.</p><video src="/videos/install-ios.mp4" controls playsinline preload="metadata" aria-label="Vídeo para instalar Suizamente en iPhone"></video></section><details class="suizamente-install-guide"><summary>💻 En tu ordenador</summary><p>En Chrome o Edge, pulsa el icono de instalación de la barra de direcciones o abre el menú del navegador y busca la opción de instalar la aplicación.</p></details><p class="suizamente-install-note">Sin App Store ni Google Play. Necesitas conexión para jugar y consultar los votos de la comunidad.</p><p data-install-status role="status" aria-live="polite"></p></section>`
    container.querySelector('[data-install]')?.addEventListener('click',install)
  }
  function storage(event){if(event.key===INSTALLED&&event.newValue==='1'){installed=true;refresh()}}
  if(!integrated){
    window.addEventListener('beforeinstallprompt',beforeInstall)
    window.addEventListener('appinstalled',remember)
    window.addEventListener('storage',storage)
    window.addEventListener('pageshow',refresh)
    for(const query of displays)query.addEventListener?.('change',refresh)
    if(isInstalled())remember()
    if(typeof navigator.getInstalledRelatedApps==='function')navigator.getInstalledRelatedApps().then(apps=>{
      if(active&&apps.some(app=>app.platform==='webapp'&&[new URL('/manifest.webmanifest',location.origin).href,new URL('/',location.origin).href].includes(app.url||app.id)))remember()
    }).catch(()=>{})
  }
  return {setRoute,renderGuide,dispose(){active=false;banner?.remove();window.removeEventListener('beforeinstallprompt',beforeInstall);window.removeEventListener('appinstalled',remember);window.removeEventListener('storage',storage);window.removeEventListener('pageshow',refresh);for(const query of displays)query.removeEventListener?.('change',refresh)}}
}
