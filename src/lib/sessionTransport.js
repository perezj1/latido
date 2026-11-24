// Retry a rejected authenticated REST request once, sharing refresh across callers.
// Auth requests themselves bypass this transport's recovery to avoid recursion.
export function createSessionTransport({fetchImpl=(...args)=>globalThis.fetch(...args),getSession,refreshSession,signOut,anonKey}){
 let pending,pendingToken
 function owner(token){try{return JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).sub}catch{return null}}
 async function invalidate(token){const {data:{session}}=await getSession();if(session?.access_token===token)await signOut()}
 async function recover(rejectedToken,expectedOwner=owner(rejectedToken)){
  const {data:{session}}=await getSession()
  if(expectedOwner&&session?.user?.id!==expectedOwner)return null
  if(!session||session.access_token!==rejectedToken)return session
  if(pending&&pendingToken===rejectedToken)return pending
  pendingToken=rejectedToken
  const request=pending=(async()=>{
   const {data,error}=await refreshSession()
   if(error){
    if([400,401,403].includes(error.status)||['refresh_token_not_found','session_not_found','refresh_token_already_used'].includes(error.code))await invalidate(rejectedToken)
    return null
   }
   if(!data?.session)return null
   const {data:{session:current}}=await getSession()
   return current&&(!expectedOwner||current.user?.id===expectedOwner)?current:null
  })()
  try{return await request}finally{if(pending===request)pending=null}
 }
 async function authenticatedFetch(input,init){
  const address=typeof input==='string'?input:input.url||String(input)
  const headers=new Headers(init?.headers||(input instanceof Request?input.headers:undefined))
  const token=headers.get('Authorization')?.replace(/^Bearer /i,'')
  const retryInput=input instanceof Request?input.clone():input
  const response=await fetchImpl(input,init)
  if(response.status!==401||!address.includes('/rest/v1/')||!token||token===anonKey)return response
  const session=await recover(token)
  if(!session?.access_token)return response
  headers.set('Authorization','Bearer '+session.access_token)
  const retried=await fetchImpl(retryInput,{...init,headers})
  if(retried.status===401)await invalidate(session.access_token)
  return retried
 }
 return {fetch:authenticatedFetch,recover,invalidate}
}
