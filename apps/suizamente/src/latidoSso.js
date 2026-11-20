const ORIGINS=['https://latido.ch','https://www.latido.ch']
export function connectLatidoAccount({client,socialApi,popup=false,timeout=popup?120000:4500}) {
  return new Promise(resolve=>{
    const nonce=crypto.randomUUID(),sources=new Map()
    let completed=false,exchanging=false,popupWindow
    const frames=[]
    function finish(value){if(completed)return;completed=true;clearTimeout(timer);clearInterval(poll);window.removeEventListener('message',receive);frames.forEach(f=>f.remove());if(value&&popupWindow&&!popupWindow.closed)popupWindow.close();resolve(value)}
    async function receive(event){
      if(completed||!ORIGINS.includes(event.origin)||!sources.has(event.source))return
      if(event.data?.type==='suizamente:sso-ready'){sources.set(event.source,event.origin);ask();return}
      if(exchanging||event.data?.type!=='suizamente:sso-session'||event.data.nonce!==nonce||!event.data.accessToken)return
      exchanging=true
      try {
        const response=await fetch(socialApi+'/sso',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+event.data.accessToken},body:'{}',signal:AbortSignal.timeout(12000)})
        if(!response.ok)throw new Error('SSO unavailable')
        const ticket=await response.json()
        if(ticket.userId!==event.data.userId||typeof ticket.tokenHash!=='string')throw new Error('Invalid SSO identity')
        const result=await client.auth.verifyOtp({type:'magiclink',token_hash:ticket.tokenHash})
        if(result.error||result.data?.user?.id!==ticket.userId)throw new Error('Invalid SSO session')
        finish(result.data.session)
      }catch{exchanging=false;if(!popup)finish(null)}
    }
    function ask(){for(const [source,origin] of sources)try{source.postMessage({type:'suizamente:sso-request',nonce},origin)}catch{/* Wait for cross-origin navigation. */}}
    window.addEventListener('message',receive)
    if(popup){
      popupWindow=window.open(ORIGINS[0]+'/suizamente/conectar?appOrigin='+encodeURIComponent(location.origin),'latido-suizamente','popup,width=480,height=740')
      if(popupWindow)sources.set(popupWindow,ORIGINS[0])
    }else for(const origin of ORIGINS){const frame=document.createElement('iframe');frame.hidden=true;frame.title='Conectar tu cuenta de Latido';frame.src=origin+'/suizamente/conectar?appOrigin='+encodeURIComponent(location.origin);document.body.append(frame);sources.set(frame.contentWindow,origin);frames.push(frame)}
    const timer=setTimeout(()=>finish(null),timeout),poll=setInterval(ask,500)
    if(popup&&!popupWindow)finish(null)
    else ask()
  })
}
