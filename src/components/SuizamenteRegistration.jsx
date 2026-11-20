import {useEffect,useRef} from 'react'
import {supabase} from '../lib/supabase'
import {mountSuizamenteRegistration} from '../../apps/suizamente/src/registration.js'
import {useAuth} from '../hooks/useAuth'

export default function SuizamenteRegistration({onLogin,onGoogle,onComplete,profileOnly=false}) {
  const root=useRef(null),actions=useRef(null)
  const {authUser}=useAuth()
  const initialUser=useRef(authUser)
  actions.current={onLogin,onGoogle,onComplete}
  useEffect(()=>mountSuizamenteRegistration(root.current,{
    client:supabase,redirectTo:window.location.origin+'/suizamente/perfil',backHref:'/suizamente/bienvenida',profileOnly,initialUser:initialUser.current,
    socialApi:import.meta.env.DEV?'/api/suizamente/social':import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/,'')+'/functions/v1/suizamente-social',
    onLogin:()=>actions.current.onLogin?.(),onGoogle:profileOnly?null:()=>actions.current.onGoogle?.(),onComplete:()=>actions.current.onComplete?.(),
  }),[profileOnly])
  return <div ref={root}/>
}
