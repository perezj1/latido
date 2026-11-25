import {createContext,useContext,useEffect} from 'react'
export const SuizamenteContext=createContext(null)
export const useSv=()=>useContext(SuizamenteContext)
export function useQuestionScreen(active,silent=active){
 const {setQuestionVisible,setAudioQuestionVisible}=useSv()
 useEffect(()=>{setQuestionVisible(!!active);return()=>setQuestionVisible(false)},[!!active,setQuestionVisible])
 useEffect(()=>{setAudioQuestionVisible(!!silent);return()=>setAudioQuestionVisible(false)},[!!silent,setAudioQuestionVisible])
}
