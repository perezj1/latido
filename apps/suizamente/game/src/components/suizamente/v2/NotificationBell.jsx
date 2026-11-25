import {Icono,iconizar} from './Icono'
import {useState} from 'react'
import {Link} from 'react-router-dom'
import {useSv} from './Context'
import {Button,Sheet} from './Shared'
import {usePushActivation} from '../../../hooks/usePushActivation'
import {loadPushSettings,subscribeToPushNotifications} from '../../../lib/pushNotifications'
import {szApi} from '../../../lib/suizamenteV2'

export function NotificationBell({matches=[]}){
 const {user,player,settings,updateSettings}=useSv(),{status,refresh}=usePushActivation(user?.id),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[rows,setRows]=useState(matches)
 const waiting=matches.filter(m=>m.teToca&&m.estado==='jugando')
 function show(){setOpen(true);setError('');setRows(matches);szApi('partidas',{fresh:true}).then(d=>setRows(d.partidas)).catch(e=>setError(e.message))}
 async function activate(){setBusy(true);setError('');try{await subscribeToPushNotifications({user,settings:loadPushSettings(),userCanton:player.canton});await updateSettings({...settings,avisos:{...settings.avisos,turnos:true}});await refresh()}catch(e){setError(e.message)}finally{setBusy(false)}}
 return <><button type="button" className="sv-icon-button sv-notification-bell" aria-label="Notificaciones" aria-expanded={open} onClick={show}><Icono nombre="aviso" size={22}/>{waiting.length>0?<b>{waiting.length}</b>:!status.subscribed&&<i aria-hidden="true"/>}</button>{open&&<Sheet title="Notificaciones" onClose={()=>setOpen(false)}>
  {status.subscribed?<p role="status"><Icono nombre="aviso"/> Avisos activados en este dispositivo</p>:status.supported?<Button disabled={busy} onClick={activate}>{iconizar(busy?'Activando…':'🔔 Activar notificaciones')}</Button>:<p>En iPhone, añade Suizamente a la pantalla de inicio para activar los avisos.</p>}
  <div className="sv-notification-list">{rows.filter(m=>m.teToca&&m.estado==='jugando').map(m=><Link key={m.id} to={'/suizamente/partida/'+m.id} onClick={()=>setOpen(false)}><b>¡Te toca!</b><span>Tu partida con {m.rival?.apodo||'tu rival'} ›</span></Link>)}</div>
  {!rows.some(m=>m.teToca&&m.estado==='jugando')&&<p>No tienes turnos pendientes.</p>}{error&&<p role="alert" className="sv-error">{error}</p>}
 </Sheet>}</>
}
