import {useEffect,useRef,useState} from 'react'
import {szApi} from '../../../lib/suizamenteV2'

export function useData(path,{refreshMs=0}={}){
  const [result,setResult]=useState({path:null,value:null}),[failure,setFailure]=useState({path:null,value:''}),[version,setVersion]=useState(0)
  const latest=useRef(result);latest.current=result
  useEffect(()=>{
    let active=true;setResult(old=>old.path===path?old:{path,value:null});setFailure({path,value:''})
    const load=()=>{if(document.hidden)return;return szApi(path,{fresh:version>0}).then(value=>{if(active){setResult({path,value});setFailure({path,value:''})}}).catch(e=>{if(active&&!(latest.current.path===path&&latest.current.value))setFailure({path,value:e.message})})}
    load();const timer=refreshMs?setInterval(load,refreshMs):null
    window.addEventListener('online',load)
    document.addEventListener('visibilitychange',load)
    return()=>{active=false;if(timer)clearInterval(timer);window.removeEventListener('online',load);document.removeEventListener('visibilitychange',load)}
  },[path,version,refreshMs])
  const setData=value=>setResult(old=>({path,value:typeof value==='function'?value(old.path===path?old.value:null):value}))
  const setError=value=>setFailure({path,value})
  return {data:result.path===path?result.value:null,setData,error:failure.path===path?failure.value:'',setError,reload:()=>setVersion(v=>v+1)}
}
