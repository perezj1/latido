// The standalone origin receives a short-lived access token in memory only.
// Its server exchanges it for a one-use OTP, creating an independent session.
export function installLatidoSsoBridge({target=window,getSession,origins=['https://suizamente.latido.ch']}) {
  const allowed=new Set(origins)
  let active=true
  async function receive(event) {
    if(!active||!allowed.has(event.origin)||!event.source
      ||![target.parent,target.opener].includes(event.source)||event.source===target
      ||event.data?.type!=='suizamente:sso-request'
      ||typeof event.data.nonce!=='string'||!/^[a-f0-9-]{36}$/i.test(event.data.nonce))return
    let session=null
    try {session=(await getSession()).data?.session||null}catch{/* A guest receives no credentials. */}
    if(!active)return
    event.source.postMessage({type:'suizamente:sso-session',nonce:event.data.nonce,
      accessToken:session?.access_token||null,userId:session?.user?.id||null},event.origin)
  }
  target.addEventListener('message',receive)
  return ()=>{active=false;target.removeEventListener('message',receive)}
}
