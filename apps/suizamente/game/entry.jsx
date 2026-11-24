import {createContext,useContext,useState} from 'react'
const EntryContext=createContext(null)
// A cached session offers an identity; only an explicit choice opens the game.
// Keep the choice in memory so a fresh visit presents the access menu again.
export function EntryProvider({children}){
 const [account,setAccount]=useState(null)
 return <EntryContext.Provider value={{account,acceptAccount:user=>setAccount(user?.id||null)}}>{children}</EntryContext.Provider>
}
export const useEntry=()=>useContext(EntryContext)
export function rememberEntryDestination(destination='/suizamente'){
 const safe=/^\/suizamente(?:\/|\?|$)/.test(destination)?destination:'/suizamente'
 sessionStorage.setItem('suizamente:auth-destino',safe)
 sessionStorage.setItem('suizamente:despues-perfil',safe)
}
