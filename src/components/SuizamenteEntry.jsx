import {useEffect,useRef} from 'react'
import {supabase} from '../lib/supabase'
import {mountSuizamenteOnboarding,mountSuizamenteWelcome} from '../../apps/suizamente/src/onboarding.js'

export default function SuizamenteEntry({user,onSignup,onLogin,onComplete}){
  const root=useRef(null),actions=useRef(null),initialUser=useRef(user)
  actions.current={onSignup,onLogin,onComplete}
  const id=user?.id
  useEffect(()=>{
    if(!id)return mountSuizamenteWelcome(root.current,{onSignup:()=>actions.current.onSignup(),onLogin:()=>actions.current.onLogin()})
    return mountSuizamenteOnboarding(root.current,{
      client:supabase,user:initialUser.current,
      socialApi:import.meta.env.DEV?'/api/suizamente/social':import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/,'')+'/functions/v1/suizamente-social',
      onComplete:()=>actions.current.onComplete(),
    })
  },[id])
  return <div ref={root}/>
}
