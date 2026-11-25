import {useEffect,useRef,useState} from 'react'
import {szApi,peekSzData} from '../../../lib/suizamenteV2'
import {useSv} from './Context'

export function useData(path,{refreshMs=0,enabled=true,reuseCached=false}={}){
  const {user}=useSv(),owner=user?.id
  const [result,setResult]=useState(()=>({path,owner,value:enabled?peekSzData(path,owner):null})),[failure,setFailure]=useState({path:null,value:''}),[version,setVersion]=useState(0)
  const latest=useRef(result);latest.current=result
  useEffect(()=>{
    if(!enabled)return
    let active=true;setResult(old=>old.path===path&&old.owner===owner?old:{path,owner,value:peekSzData(path,owner)});setFailure({path,value:''})
    const load=()=>{if(document.hidden)return;return szApi(path,{fresh:version>0}).then(value=>{if(active){setResult({path,owner,value});setFailure({path,value:''})}}).catch(e=>{if(active&&!(latest.current.path===path&&latest.current.owner===owner&&latest.current.value))setFailure({path,value:e.message})})}
    if(!reuseCached||version>0||!peekSzData(path,owner))load();const timer=refreshMs?setInterval(load,refreshMs):null
    window.addEventListener('online',load)
    window.addEventListener('focus',load)
    document.addEventListener('visibilitychange',load)
    return()=>{active=false;if(timer)clearInterval(timer);window.removeEventListener('online',load);window.removeEventListener('focus',load);document.removeEventListener('visibilitychange',load)}
  },[path,owner,version,refreshMs,enabled,reuseCached])
  const setData=value=>setResult(old=>({path,owner,value:typeof value==='function'?value(old.path===path&&old.owner===owner?old.value:null):value}))
  const setError=value=>setFailure({path,value})
  return {data:enabled?(result.path===path&&result.owner===owner?result.value:peekSzData(path,owner)):null,setData,error:enabled&&failure.path===path?failure.value:'',setError,reload:()=>setVersion(v=>v+1)}
}
