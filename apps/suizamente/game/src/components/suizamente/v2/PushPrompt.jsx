import {useEffect,useState} from 'react'
import {useSv} from './Context'
import {useMoment} from './Moment'
import {Button,Sheet} from './Shared'
import {Icono} from './Icono'
import {usePushActivation} from '../../../hooks/usePushActivation'
import {loadPushSettings,subscribeToPushNotifications} from '../../../lib/pushNotifications'
import {postponePushReminder,pushReminderDue} from '../../../lib/suizamentePushReminder'

export function notificationHelp(){
 if(import.meta.env.DEV)return 'En esta vista previa puedes revisar el aviso. La activación real se hace en la app publicada.'
 if(/iPad|iPhone|iPod/.test(navigator.userAgent)&&!navigator.standalone)return 'En iPhone, añade Suizamente a la pantalla de inicio para activar las notificaciones.'
 if(!window.isSecureContext)return 'Abre Suizamente con una conexión segura para activar las notificaciones.'
 return 'Este navegador no admite notificaciones aquí. Puedes activarlas desde otro navegador o desde la app instalada.'
}
export function PushPrompt({enabled}){
 const {user,player,updateSettings}=useSv(),{active}=useMoment(),{status,ready,refresh}=usePushActivation(user?.id),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const owner=user?.id
 useEffect(()=>{
  if(!enabled||!ready||!owner||status.subscribed||active||open)return
  const offer=()=>{
   if(document.hidden||!document.querySelector('.sv-home-screen')||!pushReminderDue(owner)||document.querySelector('[role="dialog"]'))return
   postponePushReminder(owner);setOpen(true)
  }
  const timer=setTimeout(offer,350),interval=setInterval(offer,60000),observer=new MutationObserver(offer)
  observer.observe(document.body,{childList:true,subtree:true});window.addEventListener('focus',offer);document.addEventListener('visibilitychange',offer)
  return()=>{clearTimeout(timer);clearInterval(interval);observer.disconnect();window.removeEventListener('focus',offer);document.removeEventListener('visibilitychange',offer)}
 },[enabled,ready,owner,status.subscribed,active,open])
 function later(){postponePushReminder(owner);setOpen(false);setError('')}
 async function activate(){
  if(busy)return
  if(!status.supported){setError(notificationHelp());return}
  setBusy(true);setError('')
  try{await subscribeToPushNotifications({user,settings:loadPushSettings(),userCanton:player.canton});await updateSettings(current=>({...current,avisos:{...current.avisos,turnos:true}}));await refresh();setOpen(false)}catch(e){setError(e.message)}finally{setBusy(false)}
 }
 if(!enabled||!open||status.subscribed)return null
 return <Sheet centered footerClose={false} className="sv-push-prompt" title="¿Te avisamos cuando te toque?" hero={<Icono nombre="aviso" size={38}/>} onClose={later}><p>Te avisamos cuando te toque jugar para que no pierdas tu turno.</p><Button disabled={busy} aria-busy={busy||undefined} onClick={activate}>{busy?'Activando…':'Activar notificaciones'}</Button><Button disabled={busy} tone="quiet" onClick={later}>Activar después</Button><p className="sv-push-later">También puedes activarlas desde la campana.</p>{error&&<p className="sv-error" role="alert">{error}</p>}</Sheet>
}
