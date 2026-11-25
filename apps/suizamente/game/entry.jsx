import {createContext,useContext} from 'react'
import {useAuth} from './src/hooks/useAuth'
const EntryContext=createContext(null)
const ACTIVE_ACCOUNT='suizamente:cuenta-activa'
// Supabase persists and refreshes the actual session across tabs/app restarts.
// A per-tab preference must never make a signed-in person log in again.
export function EntryProvider({children}){
 const {authUser}=useAuth(),account=authUser?.id||null
 function acceptAccount(){try{sessionStorage.removeItem(ACTIVE_ACCOUNT);localStorage.removeItem(ACTIVE_ACCOUNT)}catch{/* The verified Supabase session remains authoritative. */}}
 return <EntryContext.Provider value={{account,acceptAccount}}>{children}</EntryContext.Provider>
}
export const useEntry=()=>useContext(EntryContext)
export function rememberEntryDestination(destination='/suizamente'){
 const safe=/^\/suizamente(?:\/|\?|$)/.test(destination)?destination:'/suizamente'
 sessionStorage.setItem('suizamente:auth-destino',safe)
 sessionStorage.setItem('suizamente:despues-perfil',safe)
}
