import {useEffect,useState} from 'react'
import Modal from './SuizamenteSheet'
import {SwissFlag} from './SuizamenteVisuals'
import {CANTONS} from '../../lib/constants'
import {useAuth} from '../../hooks/useAuth'
import {invalidateSuizamente,suizamenteCall} from '../../lib/suizamente'
const cantonName=code=>CANTONS.find(c=>c.code===code)?.name||'Suiza general'
export default function Preferences({open,onClose,data,onGuestSave,guestPreferences}) {
  const {authUser}=useAuth(),ranking=open==='ranking'
  const profileCanton=data?.profile_canton||authUser?.user_metadata?.canton||''
  const [canton,setCanton]=useState(''),[general,setGeneral]=useState(true),[local,setLocal]=useState(true),[alias,setAlias]=useState(''),[opt,setOpt]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState('')
  useEffect(()=>{if(open){
    const saved=data?.player||guestPreferences
    setCanton(saved?.canton||profileCanton);setGeneral(saved?.include_general!==false);setLocal(saved?.include_canton!==false)
    setAlias(data?.player?.alias||'');setOpt(!!data?.player?.leaderboard_opt_in);setError('')
  }},[open])
  async function save(e) {
    e.preventDefault();setSaving(true);setError('')
    try {
      if(authUser){
        if(!data?.player)throw new Error('Espera a que se cargue tu configuración y vuelve a intentarlo.')
        if(!ranking&&!(data?.config?.schema_version>=3))throw new Error('Esta selección todavía no está activada. Puedes seguir jugando con la configuración actual.')
        await suizamenteCall('preferences',{canton,alias,leaderboard_opt_in:opt,...(!ranking?{include_general:general,include_canton:local}:{})});invalidateSuizamente()
      }else onGuestSave?.({canton,include_general:general,include_canton:local})
      onClose()
    } catch(e){setError(e.message)} finally{setSaving(false)}
  }
  const invalid=!general&&!local||local&&!canton
  return <Modal show={!!open} onClose={onClose} title={ranking?'Alias y clasificación':'¿De dónde quieres preguntas?'}><form className="sz-form" onSubmit={save}>
    {ranking?<><p className="sz-muted">Tu progreso es privado. Tú decides si compartes tu resultado semanal con un alias.</p><label className="sz-field">Alias del juego<input value={alias} onChange={e=>setAlias(e.target.value)} minLength={3} maxLength={24} required autoComplete="off"/></label><label className="sz-check"><input type="checkbox" checked={opt} onChange={e=>setOpt(e.target.checked)}/>Aparecer con mi alias en la clasificación semanal</label></>:<>
      <p className="sz-muted">Puedes activar las dos opciones o solo una.</p>
      <div className="sz-sources">
        <div className="sz-source-row"><SwissFlag/><div><strong>Suiza general</strong><small>Válidas en toda Suiza</small></div><button type="button" role="switch" className="sz-switch" aria-label="Preguntas de Suiza general" aria-checked={general} onClick={()=>setGeneral(v=>!v)}/></div>
        <div className="sz-source-row"><span className="sz-source-pin" aria-hidden="true">📍</span><div><strong>Cantón</strong><small>Normas y servicios de un cantón</small></div><button type="button" role="switch" className="sz-switch" aria-label="Preguntas de un cantón" aria-checked={local} onClick={()=>setLocal(v=>!v)}/>
          <label className="sz-field sz-source-select">Cantón<select value={canton} onChange={e=>setCanton(e.target.value)} disabled={!local} required={local}><option value="">Elige un cantón</option>{CANTONS.map(c=><option key={c.code} value={c.code}>{c.name}{c.code===profileCanton?' · tu cantón':''}</option>)}</select></label>
          {local&&<p className="sz-muted sz-source-info">{canton===profileCanton&&canton?'El cantón de tu perfil · ':''}{canton?`${data?.coverage?.[canton]||0} preguntas propias · según el nivel`:'Elige un cantón o desactiva esta opción.'}</p>}
        </div>
      </div>
      <p className={`sz-source-note${invalid?' is-warning':''}`} role="status">{!general&&!local?'Activa al menos una opción para poder jugar.':local&&!canton?'No tienes un cantón seleccionado. Elige uno o desactiva Cantón.':general&&local?`Las etapas combinarán preguntas generales y de ${cantonName(canton)}.`:local?`Priorizaremos preguntas de ${cantonName(canton)}.`:'Las etapas tendrán preguntas de Suiza general.'}{!invalid&&local&&' Si faltan preguntas locales de tu nivel, completaremos con preguntas generales y te avisaremos.'}</p>
      <p className="sz-muted">Se aplica a las próximas etapas y prácticas. Las partidas empezadas y tus repasos se conservan. Las llegadas son sobre cada montaña; los tests de cima y el reto semanal usan preguntas generales.</p>
      {!authUser&&<p className="sz-muted">La demostración usa una muestra general. Inicia sesión para jugar con tu selección y guardar el progreso.</p>}
    </>}
    {error&&<p className="sz-error-text" role="alert">{error}</p>}<button className="sz-button sz-button--primary" disabled={saving||(!ranking&&invalid)||!!authUser&&!data?.player}>{saving?'Guardando…':'Guardar preferencias'}</button>
  </form></Modal>
}
