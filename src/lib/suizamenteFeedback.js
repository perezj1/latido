export const SV_FEEDBACK='suizamente:feedback'
export const feedback=kind=>window.dispatchEvent(new CustomEvent(SV_FEEDBACK,{detail:kind}))

// Original short oscillator motifs. No downloaded recordings or third-party sounds.
export function createFeedback(getSettings,host=globalThis){
  let context,unlocked=false
  const active=new Set()
  const motifs={ruleta:[510,430,570,470,620],acierto:[523,659,784],fallo:[310,220],sello:[392,784],cofre:[392,494,587,784]}
  function unlock(){
    unlocked=true
    if(getSettings().sonidos===false)return
    const Audio=host.AudioContext||host.webkitAudioContext
    if(Audio){context??=new Audio();context.resume()?.catch(()=>{})}
  }
  function stop(){for(const node of active){try{node.stop()}catch{/* Already ended. */}}active.clear()}
  function play(kind){
    const settings=getSettings()
    if(!unlocked||host.document?.visibilityState==='hidden')return
    if(settings.vibracion!==false&&['acierto','fallo'].includes(kind))host.navigator?.vibrate?.(kind==='acierto'?20:35)
    if(settings.sonidos===false||!context||!motifs[kind])return
    stop()
    const start=context.currentTime
    motifs[kind].forEach((frequency,i)=>{
      const oscillator=context.createOscillator(),gain=context.createGain(),when=start+i*.075
      oscillator.type=kind==='fallo'?'triangle':'sine';oscillator.frequency.value=frequency
      gain.gain.setValueAtTime(0,when);gain.gain.linearRampToValueAtTime(.045,when+.008);gain.gain.exponentialRampToValueAtTime(.0001,when+.115)
      oscillator.connect(gain);gain.connect(context.destination);oscillator.start(when);oscillator.stop(when+.12)
      active.add(oscillator);oscillator.onended=()=>{active.delete(oscillator);oscillator.disconnect();gain.disconnect()}
    })
  }
  return {unlock,play,stop,dispose(){stop();context?.close()?.catch(()=>{})}}
}
