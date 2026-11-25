// Browser-test instrumentation only. Does not replace any server/game behavior.
export function installFakeAudio(){
 const probe=window.audioProbe={contexts:[],events:[],vibrations:[],fx:0,maxLive:0}
 window.addEventListener('suizamente:feedback',e=>probe.events.push(typeof e.detail==='string'?{kind:e.detail}:e.detail))
 Object.defineProperty(navigator,'vibrate',{configurable:true,value:n=>{probe.vibrations.push(n);return true}})
 const param=(value=0)=>({value,setValueAtTime(v){this.value=v},linearRampToValueAtTime(v){this.value=v},exponentialRampToValueAtTime(v){if(!(v>0))throw Error('Invalid exponential gain');this.value=v},setTargetAtTime(v){this.value=v},cancelScheduledValues(){},cancelAndHoldAtTime(){}})
 const node=extra=>Object.assign({outputs:[],connect(n){this.outputs.push(n)},disconnect(){this.disconnected=true;this.outputs=[]}},extra)
 const reaches=(n,bus)=>!!n&&!n.disconnected&&(!n.gain||n.gain.value>0)&&(n===bus||n.outputs.some(next=>reaches(next,bus)))
 class AudioContext{
  constructor(){this.state='suspended';this.sampleRate=44100;this.destination=node();this.events=[];this.gains=[];this.elapsed=0;this.resumed=window.performance.now();probe.contexts.push(this);probe.maxLive=Math.max(probe.maxLive,probe.contexts.filter(c=>c.state!=='closed').length)}
  get currentTime(){return this.elapsed+(this.state==='running'?(window.performance.now()-this.resumed)/1000:0)}
  addEventListener(_e,f){this.events.push(f)}
  resume(){if(this.state==='closed')return Promise.reject(Error('closed context'));if(this.state!=='running'){this.resumed=window.performance.now();this.state='running';this.events.forEach(f=>f())}return Promise.resolve()}
  suspend(){this.elapsed=this.currentTime;this.state='suspended';this.events.forEach(f=>f());return Promise.resolve()}
  close(){this.state='closed';return Promise.resolve()}
  createGain(){const n=node({gain:param(1)});this.gains.push(n);return n}
  createDynamicsCompressor(){return node({threshold:param(),knee:param(),ratio:param(),attack:param(),release:param()})}
  createBiquadFilter(){return node({frequency:param(),Q:param()})}
  createBuffer(_c,n){return {getChannelData:()=>new Float32Array(n)}}
  createBufferSource(){return node({start(){}})}
  createOscillator(){const context=this;return node({frequency:param(440),detune:param(),start(){if(reaches(this,context.gains[1]))probe.fx++},stop(){}})}
 }
 window.AudioContext=AudioContext
 probe.music=()=>probe.contexts.some(c=>c.state==='running'&&c.gains[0]?.gain.value>0&&c.gains.some((n,i)=>i>2&&reaches(n,c.gains[2])))
}
