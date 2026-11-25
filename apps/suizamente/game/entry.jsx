import {createContext,useContext,useEffect,useState} from 'react'
import {useAuth} from './src/hooks/useAuth'
const EntryContext=createContext(null)
const ACTIVE_ACCOUNT='suizamente:cuenta-activa'
function selectedAccount(){try{return sessionStorage.getItem(ACTIVE_ACCOUNT)}catch{return null}}
// Remember the deliberate choice in this tab, never another account's credentials.
// Supabase still validates the session before the game can load personal data.
export function EntryProvider({children}){
 const {authUser,loading}=useAuth(),[account,setAccount]=useState(selectedAccount)
 function acceptAccount(user){const id=user?.id||null;try{if(id)sessionStorage.setItem(ACTIVE_ACCOUNT,id);else sessionStorage.removeItem(ACTIVE_ACCOUNT)}catch{/* The current in-memory choice remains usable. */}setAccount(id)}
 useEffect(()=>{if(!loading&&account&&account!==authUser?.id)acceptAccount(null)},[loading,authUser?.id,account])
 return <EntryContext.Provider value={{account,acceptAccount}}>{children}</EntryContext.Provider>
}
export const useEntry=()=>useContext(EntryContext)
export function rememberEntryDestination(destination='/suizamente'){
 const safe=/^\/suizamente(?:\/|\?|$)/.test(destination)?destination:'/suizamente'
 sessionStorage.setItem('suizamente:auth-destino',safe)
 sessionStorage.setItem('suizamente:despues-perfil',safe)
}
