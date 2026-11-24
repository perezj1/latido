import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from '../hooks/useAuth'
import {CANTONS} from './constants'
import {sessionQuestionText} from './suizamenteQuestionText'

export const SZ_EVENT = 'latido:suizamente-updated'
export const SZ_LEVELS = [
  { id:1, name:'Uetliberg', color:'#10b981', soft:'#d1fae5', ink:'#047857', description:'Empieza a descubrir' },
  { id:2, name:'Rigi', color:'#06b6d4', soft:'#cffafe', ink:'#0e7490', description:'Suiza te sorprende' },
  { id:3, name:'Pilatus', color:'#2563eb', soft:'#dbeafe', ink:'#1d4ed8', description:'Afina la mirada' },
  { id:4, name:'Eiger', color:'#f59e0b', soft:'#fef3c7', ink:'#b45309', description:'Todo un descubrimiento' },
  { id:5, name:'Matterhorn', color:'#ef4444', soft:'#fee2e2', ink:'#b91c1c', description:'El gran trivial suizo' },
]
export const SZ_CATEGORIES = [
  { id:'administracion', name:'Trámites y autoridades', short:'trámites', emoji:'🏛️' },
  { id:'vivienda', name:'Vivienda y convivencia', short:'vivienda', emoji:'🏠' },
  { id:'trabajo', name:'Trabajo y dinero', short:'trabajo', emoji:'💼' },
  { id:'salud', name:'Salud y emergencias', short:'salud', emoji:'🩺' },
  { id:'sociedad', name:'Vida cotidiana y sociedad', short:'vida cotidiana', emoji:'🚆' },
  { id:'idioma', name:'Idiomas cotidianos', short:'idiomas', emoji:'💬', optional:true },
]
export const SZ_THRESHOLDS = [150,400,800,1300,2000]
export const szCategory = id => SZ_CATEGORIES.find(item => item.id===id) || SZ_CATEGORIES[0]
export const szLevel = id => SZ_LEVELS[Math.max(0,Math.min(4,Number(id || 1)-1))]
export function szProgress(data) {
  const level = Number(data?.player?.level || 1), xp = Number(data?.player?.xp || 0)
  const thresholds = data?.config?.thresholds || SZ_THRESHOLDS
  const from = level===1 ? 0 : thresholds[level-2], target=thresholds[level-1]
  return { level, xp, from, target, remaining:Math.max(0,target-xp), percent:Math.max(0,Math.min(100,Math.round((xp-from)/Math.max(1,target-from)*100))),
    ready:xp>=target && !data?.player?.route_completed, completed:!!data?.player?.route_completed, next:SZ_LEVELS[Math.min(level,4)] }
}
export const szPercent = (correct,total) => total ? Math.round(Number(correct)/Number(total)*100) : null
export function szSourceLabel(player){
  const name=CANTONS.find(c=>c.code===player?.canton)?.name
  const general=player?.include_general!==false,local=player?.include_canton!==false&&!!name
  return general&&local?`Suiza general y ${name}`:local?`Cantón de ${name}`:'Suiza general'
}
const cache = new Map()
const pending = new Map()
let cacheGeneration = 0
const messages = {
  SZ_AUTH_REQUIRED:'Inicia sesión para guardar tu aprendizaje.', SZ_ACCOUNT_UNAVAILABLE:'Esta cuenta no puede participar ahora.',
  SZ_PAUSED:'Suizamente está en mantenimiento. Vuelve un poco más tarde.', SZ_NO_QUESTIONS:'No hay preguntas pendientes en esta selección. Prueba otro tema.',
  SZ_NOT_ENOUGH_QUESTIONS:'Estamos preparando más preguntas para esta selección. Puedes practicar otro tema.',
  SZ_XP_REQUIRED:'Todavía necesitas más XP para desbloquear este ascenso.', SZ_ROUTE_COMPLETED:'Ya has completado el recorrido inicial. Puedes seguir practicando.',
  SZ_SESSION_NOT_FOUND:'No se ha encontrado esta partida en tu cuenta.', SZ_QUESTION_CHANGED:'La partida ha avanzado en otra ventana. Vuelve a cargarla.',
  SZ_SESSION_CLOSED:'Esta partida ya ha terminado.', SZ_RATE_LIMIT:'Has empezado muchas partidas. Espera un poco antes de continuar.',
  SZ_INVALID_ALIAS:'Utiliza un alias de 3 a 24 caracteres, con letras, números, espacios o guiones.',
  SZ_FORBIDDEN:'Tu cuenta no tiene acceso a esta gestión.', SZ_INVALID_QUESTION:'Revisa los campos de la pregunta y su fuente.',
  SZ_INVALID_OPTIONS:'Escribe cuatro respuestas diferentes.', SZ_INVALID_CONFIG:'Revisa los umbrales crecientes y los valores de configuración.',
  SZ_NO_SOURCES:'Activa Suiza general, Cantón o ambas opciones para jugar.',
  SZ_STAGE_LOCKED:'Completa los tramos anteriores de esta montaña para desbloquear esta etapa.',
  SZ_SUMMIT_TOMORROW:'Hoy ya has realizado un test de cima. Puedes continuar las etapas y hacer otro test mañana.',
  SZ_CANTON_REQUIRED:'Elige un cantón o desactiva la opción Cantón.',
}
export async function suizamenteCall(action,args={}) {
  const { data,error } = await supabase.rpc('suizamente',{ p_action:action,p_args:args })
  if (error) {
    const code = error.message?.match(/SZ_[A-Z_]+/)?.[0] || error.code
    const missing = ['PGRST202','42883'].includes(error.code)
    const failure = new Error(missing ? 'Suizamente aún no está disponible para guardar el progreso. Puedes probar la demostración.'
      : error.code==='23505' ? 'Ese alias ya está en uso. Prueba con otro.' : messages[code] || 'No se ha podido completar la operación. Inténtalo de nuevo.')
    failure.code=code; failure.notConfigured=missing
    throw failure
  }
  return sessionQuestionText(data)
}
export function invalidateSuizamente() {
  cacheGeneration++
  cache.clear()
  pending.clear()
  if (typeof window!=='undefined') window.dispatchEvent(new Event(SZ_EVENT))
}
export function useSuizamente(filters={}) {
  const { authUser,loading:authLoading }=useAuth()
  const key=`${authUser?.id || 'guest'}:${filters.scope || 'all'}:${filters.level || 0}`
  const [state,setState]=useState({ key:'',data:null,error:null,loading:true })
  const [revision,setRevision]=useState(0)
  const refresh=useCallback(()=>{ cache.delete(key); setRevision(value=>value+1) },[key])
  useEffect(()=>{ window.addEventListener(SZ_EVENT,refresh);return ()=>window.removeEventListener(SZ_EVENT,refresh) },[refresh])
  useEffect(()=>{
    if (authLoading) return undefined
    let active=true
    const saved=cache.get(key)
    if (saved && Date.now()-saved.at<15000) { setState({key,data:saved.data,error:null,loading:false});return undefined }
    setState(previous=>({ key,data:previous.key===key ? previous.data : null,error:null,loading:true }))
    if (!pending.has(key)) {
      const generation=cacheGeneration
      const request=suizamenteCall('summary',{scope:filters.scope || 'all',level:filters.level || 0}).then(data=>{
        if(generation===cacheGeneration)cache.set(key,{data,at:Date.now()})
        return data
      }).finally(()=>{if(pending.get(key)===request)pending.delete(key)})
      pending.set(key,request)
    }
    pending.get(key).then(data=>{if(active)setState({key,data,error:null,loading:false})}).catch(error=>{if(active)setState({key,data:null,error,loading:false})})
    return ()=>{active=false}
  },[key,revision,authLoading])
  return { data:state.key===key ? state.data : null,error:state.key===key ? state.error : null,loading:authLoading || state.key!==key || state.loading,refresh,actor:authUser }
}
export function szWeekLabel(value) {
  if(!value)return 'Esta semana'
  const start=new Date(`${value}T12:00:00Z`),end=new Date(start);end.setUTCDate(end.getUTCDate()+6)
  const fmt={timeZone:'Europe/Zurich',day:'numeric',month:'short'}
  return `${start.toLocaleDateString('es-ES',fmt)} – ${end.toLocaleDateString('es-ES',fmt)}`
}
