import {useState} from 'react'
import {useSv} from './Context'
import './topControls.css'

export function MusicButton(){
 const context=useSv(),[busy,setBusy]=useState(false)
 if(!context)return null
 const {settings,updateSettings}=context,enabled=settings.musica!==false
 async function toggle(event){
  event.stopPropagation();if(busy)return
  setBusy(true)
  try{await updateSettings({...settings,musica:!enabled})}catch{/* The API already reports persistence errors; the local mute remains immediate. */}finally{setBusy(false)}
 }
 return <button type="button" className="sv-icon-button sv-music-toggle" aria-label={enabled?'Desactivar música':'Activar música'} title={enabled?'Desactivar música':'Activar música'} aria-pressed={enabled} aria-busy={busy||undefined} aria-disabled={busy||undefined} onClick={toggle} onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')e.stopPropagation()}}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18V6l11-3v12M9 6l11-3"/><ellipse cx="6" cy="18" rx="3" ry="2.5"/><ellipse cx="17" cy="15" rx="3" ry="2.5"/>{!enabled&&<path d="m3 3 18 18" strokeWidth="2.3"/>}</svg></button>
}
