// Only the selected same-origin game frame may change the host's browser tint.
export function connectSuizamenteAppearance({getFrame,target=window}){
  const doc=target.document,html=doc.documentElement,body=doc.body
  const meta=doc.querySelector('meta[name="theme-color"]')||doc.head.appendChild(Object.assign(doc.createElement('meta'),{name:'theme-color'}))
  const apple=doc.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')
  const previous={color:meta.content,html:html.style.backgroundColor,body:body.style.backgroundColor,apple:apple?.content}
  if(apple)apple.content='black-translucent'
  let scheduled=false,active=true
  function setColor(color){
    if(!/^(#[\da-f]{6}|rgb\([\d.,%\s]+\))$/i.test(color||''))return
    if(meta.content===color)return
    if(meta.content!==color)meta.content=color
    if(html.style.backgroundColor!==color)html.style.backgroundColor=color
    if(body.style.backgroundColor!==color)body.style.backgroundColor=color
  }
  function receive(event){if(event.origin===target.location.origin&&event.source===getFrame()&&event.data?.type==='suizamente:appearance')setColor(event.data.color)}
  function update(){
    scheduled=false
    if(!active)return
    if(getFrame())return
    const screen=doc.querySelector('.s-onb-hero,.s-onb-profile-top,.s-onb-welcome,.suizamente-access,.startup,.suizamente-install-host')
    const color=screen&&target.getComputedStyle(screen).backgroundColor
    setColor(color&&color!=='rgba(0, 0, 0, 0)'?color:'#FFFFFF')
  }
  const observer=new target.MutationObserver(()=>{if(!scheduled){scheduled=true;target.requestAnimationFrame(update)}})
  observer.observe(html,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','data-theme']})
  target.addEventListener('message',receive);update()
  return ()=>{active=false;observer.disconnect();target.removeEventListener('message',receive);meta.content=previous.color;html.style.backgroundColor=previous.html;body.style.backgroundColor=previous.body;if(apple)apple.content=previous.apple}
}
