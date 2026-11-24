import {Link} from 'react-router-dom'
import {useSv} from './Context'
import {useData} from './useData'

export function DailyHome({compact=false}){
  const {config}=useSv()
  const {data}=useData('dia')
  if(!data)return null
  return <Link className="sv-daily-home" to="/suizamente/pregunta-del-dia"><span>📊</span><div><b>Pregunta del día</b><small>{data.hecho?compact?'✓ Hecho':'Ya has votado · Mira el resultado':compact?'Vota · 🪙 +'+config.recompensasComunidad.dia.monedas:'Vota y mira qué elige la comunidad'}</small></div><strong>{data.hecho?'✓ Hecho':'🪙 +'+config.recompensasComunidad.dia.monedas}</strong></Link>
}
