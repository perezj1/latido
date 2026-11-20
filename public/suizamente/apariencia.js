let pending=false,last=''
function update(){
  pending=false
  const reveal=document.querySelector('.reveal'),color=reveal?getComputedStyle(reveal).getPropertyValue('--th').trim():getComputedStyle(document.body).backgroundColor
  // Resolve CSS variables from the question palette to an actual RGB color.
  const resolved=reveal?getComputedStyle(reveal).backgroundColor:color
  if(!resolved||resolved===last)return
  last=resolved
  let meta=document.querySelector('meta[name="theme-color"]')
  if(!meta){meta=document.createElement('meta');meta.name='theme-color';document.head.append(meta)}
  meta.content=resolved
  if(window.parent!==window)window.parent.postMessage({type:'suizamente:appearance',color:resolved},location.origin)
}
const observer=new MutationObserver(()=>{if(!pending){pending=true;requestAnimationFrame(update)}})
observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','data-theme']})
window.addEventListener('pageshow',update);update()
