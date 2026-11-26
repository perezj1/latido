const BASE='#FBF9F6'
const surfaces='.sv-root,.sv-screen,.sv-question-header,[data-latido-backdrop],[data-chrome-color],.sv-opening,.sv-moment,.standalone-loading'
const opaque=color=>color&&color!=='transparent'&&!/^rgba\([^)]*,\s*0\)$/.test(color)

// Read only screen boundaries, never individual answer options or animation frames.
export function syncScreenChrome(doc=document,host=window){
 const root=doc.documentElement,meta=doc.querySelector('meta[name="theme-color"]'),original=meta?.getAttribute('content'),oldColor=root.style.getPropertyValue('--sv-system-color')
 let frame=null
 const background=element=>element&&host.getComputedStyle(element).backgroundColor
 function update(){
  frame=null
  const game=doc.querySelector('.sv-root'),screen=game?.querySelector(':scope>.sv-screen'),header=screen?.querySelector(':scope>.sv-question-header'),backdrop=screen?.querySelector('[data-chrome-color]'),opening=doc.querySelector('.sv-opening')
  let color=doc.querySelector('.sv-moment')?BASE:opening?background(opening):header?background(header):backdrop?backdrop.dataset.chromeColor:background(screen)
  if(!opaque(color))color=background(game)
  if(!opaque(color))color=BASE
  if(meta?.getAttribute('content')!==color)meta?.setAttribute('content',color)
  if(root.style.getPropertyValue('--sv-system-color')!==color)root.style.setProperty('--sv-system-color',color)
 }
 function schedule(){if(frame===null)frame=host.requestAnimationFrame(update)}
 const relevant=record=>record.target===root||record.type==='attributes'&&record.target.matches(surfaces)||record.type==='childList'&&[...record.addedNodes,...record.removedNodes].some(node=>node.nodeType===1&&(node.matches(surfaces)||node.querySelector(surfaces)))
 const observer=new host.MutationObserver(records=>{if(records.some(relevant))schedule()})
 observer.observe(doc.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','data-chrome-color']})
 observer.observe(root,{attributes:true,attributeFilter:['data-suizamente-theme']})
 host.addEventListener('pageshow',schedule);update()
 return()=>{observer.disconnect();if(frame!==null)host.cancelAnimationFrame(frame);host.removeEventListener('pageshow',schedule);if(meta&&original!==null)meta.setAttribute('content',original);if(oldColor)root.style.setProperty('--sv-system-color',oldColor);else root.style.removeProperty('--sv-system-color')}
}
