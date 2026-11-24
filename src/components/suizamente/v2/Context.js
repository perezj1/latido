import {createContext,useContext,useEffect} from 'react'
export const SuizamenteContext=createContext(null)
export const useSv=()=>useContext(SuizamenteContext)
export function useQuestionScreen(active){
 const {setQuestionVisible}=useSv()
 useEffect(()=>{setQuestionVisible(!!active);return()=>setQuestionVisible(false)},[!!active,setQuestionVisible])
}
