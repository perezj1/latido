import {szApi} from '../../../lib/suizamenteV2'

// Only acknowledgements, never rewards. Durable per-account outbox lets Omitir
// close immediately even when the server cannot currently confirm the read.
const memory=new Map(),flushing=new Map()
const storageKey=owner=>'suizamente:momentos:lecturas:'+owner
export function pendingMomentReads(owner){
  if(memory.has(owner))return memory.get(owner)
  try{const value=JSON.parse(localStorage.getItem(storageKey(owner))||'[]');const jobs=Array.isArray(value)?value:[];memory.set(owner,jobs);return jobs}catch{return []}
}
function save(owner,jobs){memory.set(owner,jobs);try{localStorage.setItem(storageKey(owner),JSON.stringify(jobs))}catch{/* Retain the in-memory acknowledgement if storage is unavailable. */}}
export function queueMomentReads(owner,notices,duels){
  const jobs=new Map(pendingMomentReads(owner).map(job=>[job.key,job]))
  for(const notice of notices)jobs.set('aviso:'+notice.id,{key:'aviso:'+notice.id,noticeId:notice.id})
  for(const match of duels)jobs.set('duelo:'+match.duelo.id,{key:'duelo:'+match.duelo.id,matchId:match.id,duelId:match.duelo.id,turn:match.turnoN})
  save(owner,[...jobs.values()])
}
export function flushMomentReads(owner){
  if(flushing.has(owner))return flushing.get(owner)
  const task=(async()=>{
    if(!navigator.onLine)return
    const jobs=[...pendingMomentReads(owner)],notices=jobs.filter(job=>job.noticeId!=null),done=new Set()
    if(notices.length){try{await szApi('novedades/leer',{method:'POST',body:{ids:notices.map(job=>job.noticeId)}});notices.forEach(job=>done.add(job.key))}catch{/* Retry on the next entry, focus or reconnection. */}}
    for(const job of jobs.filter(job=>job.duelId)){
      try{
        try{await szApi('partidas/'+job.matchId+'/duelo',{method:'POST',body:{turnoN:job.turn,operacion:'continuar'}})}
        catch(e){
          if(e.status!==409)throw e
          const current=await szApi('partidas/'+job.matchId)
          if(current.duelo?.id===job.duelId&&current.duelo.mostrarResultado)await szApi('partidas/'+job.matchId+'/duelo',{method:'POST',body:{turnoN:current.turnoN,operacion:'continuar'}})
        }
        done.add(job.key)
      }catch{/* Keep this duel in the outbox until it is acknowledged. */}
    }
    save(owner,pendingMomentReads(owner).filter(job=>!done.has(job.key)))
  })().finally(()=>flushing.delete(owner))
  flushing.set(owner,task);return task
}
