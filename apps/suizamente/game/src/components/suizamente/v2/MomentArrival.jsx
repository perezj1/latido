import {useCallback,useEffect,useRef} from 'react'
import {useLocation} from 'react-router-dom'
import {useSv} from './Context'
import {useMoment,momentSeen,rememberMoment} from './Moment'
import {absenceSteps,giftSteps,isAbsenceNotice,noticeEvent} from './moments'
import {szApi} from '../../../lib/suizamenteV2'
import {notify} from '../../../lib/suizamenteNotices'
import {flushMomentReads,pendingMomentReads,queueMomentReads} from './momentReads'

const gifts=new Map()
export function useDailyGift(){
  const {player}=useSv(),{show}=useMoment()
  return useCallback(()=>{
    const owner=player?.jugador_id
    if(!owner)return Promise.resolve()
    if(gifts.has(owner))return gifts.get(owner)
    const task=(async()=>{
      const shop=await szApi('tienda',{fresh:true})
      if(!shop.regaloDisponible)return
      // Claim before presenting either step; skipping the presentation cannot lose a gift.
      let result
      try{result=await szApi('tienda/regalo',{method:'POST'})}catch(e){if(e.status===409)return;throw e}
      await show(giftSteps(result,shop),{key:'regalo:'+result.jugador.actualizado_en})
    })().finally(()=>gifts.delete(owner))
    gifts.set(owner,task);return task
  },[player?.jugador_id,show])
}

export function MomentArrival({enabled}){
  const {pathname}=useLocation(),{player,config}=useSv(),{show}=useMoment(),gift=useDailyGift(),running=useRef(false)
  useEffect(()=>{
    if(!enabled||!player)return
    const flush=()=>{flushMomentReads(player.jugador_id)}
    flush();window.addEventListener('online',flush);window.addEventListener('focus',flush)
    return()=>{window.removeEventListener('online',flush);window.removeEventListener('focus',flush)}
  },[enabled,player?.jugador_id])
  useEffect(()=>{
    if(!enabled||!player||!/^\/suizamente\/?$/.test(pathname)||running.current)return
    let cancelled=false
    running.current=true
    ;(async()=>{
      const owner=player.jugador_id
      await flushMomentReads(owner)
      const [state,list]=await Promise.all([szApi('jugador'),szApi('partidas?terminadas=true')])
      if(cancelled)return
      const pendingNotices=new Set(pendingMomentReads(owner).map(job=>job.noticeId))
      const notices=(state.novedades||[]).filter(n=>isAbsenceNotice(n)&&!pendingNotices.has(n.id))
      // Duel read flags already exist on the server. Reuse them without adding an API.
      let details=list.partidas||[]
      if(!list.duelosIncluidos){
        // Compatibility during rollout: at most two old-server reads at once,
        // and stop scheduling them when the player leaves Home.
        const todo=[...details],found=[]
        await Promise.all([0,1].map(async()=>{while(!cancelled&&todo.length){const match=todo.shift();try{found.push(await szApi('partidas/'+match.id))}catch{/* Retry on the next visit. */}}}))
        details=found
      }
      if(cancelled)return
      const duels=details.filter(m=>m.duelo?.mostrarResultado&&!momentSeen(owner,'duelo:'+m.duelo.id))
      const events=[...notices.map(noticeEvent),...duels.map(m=>{
        const won=m.duelo.ganador===m.tuId,category=config.categorias.find(c=>c.id===m.duelo.sello)
        return {id:'duelo:'+m.duelo.id,title:won?'Has ganado el duelo contra '+m.rival?.apodo:m.rival?.apodo+' ha ganado vuestro duelo',detail:(won?'Has conseguido':'Has perdido')+' el sello de '+category?.nombre,icon:category?.emoji||'🛂',loss:!won}
      })]
      if(events.length)await show(absenceSteps(events),{key:'ausencia:'+events.map(e=>e.id).join(','),onFinish:()=>{
        queueMomentReads(owner,notices,duels)
        duels.forEach(m=>rememberMoment(owner,'duelo:'+m.duelo.id))
        flushMomentReads(owner)
      }})
      if(!cancelled)await gift()
    })().catch(e=>{if(!cancelled)notify(e,{error:true})}).finally(()=>{running.current=false})
    return()=>{cancelled=true;running.current=false}
  },[enabled,pathname,player?.jugador_id,config,show,gift])
  return null
}
