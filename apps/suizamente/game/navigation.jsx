import {createContext,useCallback,useContext,useLayoutEffect,useRef,useState} from 'react'
import {useLocation,useNavigate} from 'react-router-dom'
import {useAuth} from './src/hooks/useAuth'
import {useEntry} from './entry'

const HOME='/suizamente',NavigationContext=createContext(null)
const plainHome=path=>['/','/suizamente','/suizamente/'].includes(path)
const historyIndex=()=>Number.isInteger(window.history.state?.idx)?window.history.state.idx:0

// Run before BrowserRouter reads the URL. A direct link has Home underneath it;
// an existing history (including a reload) is left exactly where it was.
export function initializeGameHistory(){
 const state=window.history.state||{},path=location.pathname+location.search+location.hash
 if((!Number.isInteger(state.idx)||state.idx===0)&&!plainHome(path)){
  window.history.replaceState({idx:0,key:'suizamente-home',usr:null},'',HOME)
  window.history.pushState({...state,idx:1},'',path)
 }
}

export function GameNavigationProvider({children}){
 const {authUser}=useAuth(),{account}=useEntry(),navigate=useNavigate(),location=useLocation(),pending=useRef(null),arriving=useRef(null),[resetting,setResetting]=useState(false)
 const reset=useCallback((destination=HOME)=>{
  const url=new URL(/^\/suizamente(?:\/|\?|$)/.test(destination)?destination:HOME,window.location.origin),safe=url.pathname+url.search+url.hash
  pending.current=safe
  setResetting(true)
  const index=historyIndex()
  if(index>0)navigate(-index)
  else if(!plainHome(window.location.pathname+window.location.search+window.location.hash))navigate(HOME,{replace:true})
  else{pending.current=null;if(!plainHome(safe)){arriving.current=safe;navigate(safe)}else setResetting(false)}
 },[navigate])
 useLayoutEffect(()=>{
  // Router transitions may follow a synchronous account update. Never rewind
  // a newer browser URL while React still renders the previous location.
  if(window.location.pathname+window.location.search+window.location.hash!==location.pathname+location.search+location.hash)return
  if(arriving.current){
   if(location.pathname+location.search+location.hash===arriving.current){arriving.current=null;setResetting(false)}
   return
  }
  if(pending.current){
   if(historyIndex()>0)return
   if(!plainHome(location.pathname+location.search+location.hash)){navigate(HOME,{replace:true});return}
   const destination=pending.current;pending.current=null
   if(!plainHome(destination)){arriving.current=destination;navigate(destination)}else setResetting(false)
   return
  }
  // Returning to Inicio must not leave old tabs, login or profile forms behind it.
  // At index zero, native Back leaves the app; no popstate trap or window.close.
  if(account&&account===authUser?.id&&plainHome(location.pathname+location.search+location.hash)&&historyIndex()>0)reset()
 },[location.key,location.pathname,location.search,location.hash,account,authUser?.id,navigate,reset])
 return <NavigationContext.Provider value={{enter:reset,resetting}}>{children}</NavigationContext.Provider>
}
export const useGameNavigation=()=>useContext(NavigationContext)
