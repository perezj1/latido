import {useLocation} from 'react-router-dom'
import SuizamenteArcade from '../components/suizamente/SuizamenteArcade'
import SuizamenteGamePlayer from '../components/suizamente/SuizamenteGamePlayer'
import './Suizamente.css'

export default function Suizamente(){
  const {pathname}=useLocation()
  return pathname.startsWith('/suizamente/partida')?<SuizamenteGamePlayer/>:<SuizamenteArcade/>
}
export function Suizometro(){return <SuizamenteArcade/>}
