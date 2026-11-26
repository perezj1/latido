import {useState} from 'react'
import {useSv} from './Context'
import './topControls.css'
import {Icono} from './Icono'
import {notify} from '../../../lib/suizamenteNotices'

export function MusicButton({home=false}){
 const context=useSv(),[busy,setBusy]=useState(false)
 if(!context)return null
 const {settings,updateSettings}=context,enabled=settings.musica!==false
 async function toggle(event){
  event.stopPropagation();if(busy)return
  setBusy(true)
  try{const saving=updateSettings(current=>({...current,musica:!enabled}));if(home)notify(enabled?'Música desactivada':'Música activada');await saving}catch{/* The API already reports persistence errors; the local mute remains immediate. */}finally{setBusy(false)}
 }
 return <button type="button" className="sv-icon-button sv-music-toggle" aria-label={home?'Música':enabled?'Desactivar música':'Activar música'} title={enabled?'Desactivar música':'Activar música'} aria-pressed={enabled} aria-busy={busy||undefined} aria-disabled={busy||undefined} onClick={toggle} onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')e.stopPropagation()}}><Icono nombre={enabled?'musica':'musica-no'} size={home?28:22}/></button>
}
