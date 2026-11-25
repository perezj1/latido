import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import SZSonido from '../game/src/lib/suizamenteSonido.js'
import {createFeedback,backgroundMusicFor} from '../game/src/lib/suizamenteFeedback.js'

const reference=await readFile(process.env.SUIZAMENTE_SOUND_REFERENCE||'../../../latido/suizamente/disenos/sonido.js','utf8'),source=await readFile('game/src/lib/suizamenteSonido.js','utf8')
const section=(s,start,end)=>s.slice(s.indexOf(start),s.indexOf(end)).replaceAll('\r','')
assert.equal(section(source,'/* ---------- Instrumentos ---------- */','var CALLAN_LA_MUSICA'),section(reference,'/* ---------- Instrumentos ---------- */','var CALLAN_LA_MUSICA'),'exact reference instruments, notes and effect volumes')
assert.equal(section(source,'function compas(b, t, out)','/* ---------- Música de fondo ---------- */'),section(reference,'function compas(b, t, out)','/* ---------- Música de fondo ---------- */'),'exact eight-bar score')
assert.equal(section(source,'var MELODIA =','function crear(opciones)'),section(reference,'var MELODIA =','function crear(opciones)'),'exact melody and accompaniment notes')
assert.deepEqual(SZSonido.VOLUMEN,{efectos:.9,musica:.4})

let now=0,permission=false,serial=0,live=0,maximum=0
const timers=new Map(),intervals=new Map(),contexts=[],vibrations=[]
const original={setTimeout,clearTimeout,setInterval,clearInterval,Date}
globalThis.Date=class extends original.Date{static now(){return now*1000}}
globalThis.setTimeout=(f,ms)=>{const id=++serial;timers.set(id,{f,t:now+ms/1000});return id}
globalThis.clearTimeout=id=>timers.delete(id)
globalThis.setInterval=(f,ms)=>{const id=++serial;intervals.set(id,{f,t:now+ms/1000,step:ms/1000});return id}
globalThis.clearInterval=id=>intervals.delete(id)
const param=(v=0)=>({value:v,targets:[],setValueAtTime(v,t){assert.ok(Number.isFinite(t)&&t>=0);this.value=v},linearRampToValueAtTime(v,t){this.setValueAtTime(v,t)},exponentialRampToValueAtTime(v,t){assert.ok(v>0);this.setValueAtTime(v,t)},setTargetAtTime(v,t,c){assert.ok(t>=0&&c>0);this.targets.push(v)},cancelScheduledValues(){},cancelAndHoldAtTime(){}})
const node=extra=>Object.assign({connect(){},disconnect(){this.disconnected=true}},extra)
class AudioContext{
 constructor(){this.state='suspended';this.sampleRate=48000;this.destination=node();this.events=[];this.gains=[];this.oscs=[];this.elapsed=0;this.resumed=now;contexts.push(this);maximum=Math.max(maximum,++live)}
 get currentTime(){return this.elapsed+(this.state==='running'?now-this.resumed:0)}
 addEventListener(_e,f){this.events.push(f)}
 resume(){if(!permission)return Promise.reject(new Error('gesture required'));if(this.state!=='running'){this.resumed=now;this.state='running';this.events.forEach(f=>f())}return Promise.resolve()}
 suspend(){this.elapsed=this.currentTime;this.state='suspended';this.events.forEach(f=>f());return Promise.resolve()}
 close(){if(this.state!=='closed')live--;this.state='closed';return Promise.resolve()}
 createGain(){const n=node({gain:param(1)});this.gains.push(n);return n}
 createDynamicsCompressor(){return node({threshold:param(),knee:param(),ratio:param(),attack:param(),release:param()})}
 createBiquadFilter(){return node({frequency:param(),Q:param()})}
 createBuffer(_c,n){return {getChannelData:()=>new Float32Array(n)}}
 createBufferSource(){return node({start(t,o,d){assert.ok(t>=0&&o>=0&&d>0)}})}
 createOscillator(){const ctx=this;return node({frequency:param(440),detune:param(),start(t){assert.ok(t>=0);ctx.oscs.push({f:this.frequency.value,t})},stop(t){assert.ok(t>=0)}})}
}
const storage=()=>{const values=new Map();return {getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)}}
const host={AudioContext,document:{hidden:false,visibilityState:'visible'},navigator:{vibrate:n=>vibrations.push(n)},localStorage:storage(),sessionStorage:storage()}
const advance=async seconds=>{const end=now+seconds;while(now<end){now=Math.min(end,now+.05);for(const [id,t] of [...timers])if(t.t<=now&&timers.has(id)){timers.delete(id);t.f()}for(const t of [...intervals.values()])if(t.t<=now){t.t+=t.step;t.f()}await Promise.resolve()}}
try{
 const settings={musica:true,sonidos:true,vibracion:true};let owner='a';const s=createFeedback(()=>settings,host,()=>owner)
 assert.equal(s.play('acierto'),0);assert.equal(contexts.length,0);s.musica(true);assert.equal(s.sonando.musica,false)
 assert.equal(s.play('sintonia',{esperar:3000,key:'opening',scope:'session'}),0);await Promise.resolve();assert.equal(s.sonando.listo,false)
 permission=true;s.unlock();await advance(.05);assert.equal(s.sonando.listo,true);assert.equal(s.sonando.musica,false);await advance(2.6);assert.equal(s.sonando.musica,true)
 s.musica(false);assert.equal(s.sonando.musica,false);assert.equal(s.play('acierto',{key:'q1'}),.5);assert.equal(s.play('fallo',{key:'q2'}),.6);assert.deepEqual(vibrations.slice(-2),[20,35])
 const ctx=contexts[0],count=ctx.oscs.length;assert.equal(s.play('ruleta'),.42);assert.deepEqual(ctx.oscs.slice(count).map(n=>n.f),[510,430,570,470,620]);assert.equal(contexts.length,1)
 s.musica(true);assert.equal(s.play('victoria',{key:'win'}),3.1);assert.equal(s.sonando.musica,false);await advance(3.6);assert.equal(s.sonando.musica,true)
 assert.equal(s.play('premio',{key:'gift'}),1.1);assert.equal(s.sonando.musica,true);assert.deepEqual(ctx.gains[2].gain.targets.slice(-2),[.1,.4]);assert.equal(s.play('premio',{key:'gift'}),0)
 settings.musica=false;s.actualizar();assert.equal(s.sonando.musica,false);assert.equal(s.play('acierto'),.5)
 settings.sonidos=false;settings.musica=true;s.actualizar();assert.equal(s.sonando.musica,true);for(const kind of SZSonido.PIEZAS)assert.equal(s.play(kind),0);assert.equal(ctx.gains[1].gain.value,0)
 settings.sonidos=true;s.actualizar();assert.equal(ctx.gains[1].gain.value,.9);settings.vibracion=false;const vib=vibrations.length;s.play('fallo');assert.equal(vibrations.length,vib)
 s.play('victoria');host.document.hidden=true;s.ocultar();assert.equal(ctx.state,'suspended');assert.equal(ctx.gains[0].gain.value,0);assert.equal(s.sonando.musica,false);const silent=ctx.oscs.length;await advance(8);assert.equal(ctx.oscs.length,silent);assert.equal(s.play('premio'),0)
 host.document.hidden=false;s.mostrar();await advance(.05);assert.equal(s.sonando.musica,true);assert.equal(ctx.gains[0].gain.value,.85)
 await advance(20);s.dispose();assert.equal(ctx.state,'closed');assert.equal(timers.size,0);assert.equal(intervals.size,0);s.unlock();assert.equal(contexts.length,1)
 const again=createFeedback(()=>settings,host,()=>owner);again.unlock();assert.equal(again.play('premio',{key:'gift'}),0,'reload/back cannot repeat a receipt');owner='b';assert.equal(again.play('premio',{key:'gift'}),1.1);again.dispose();assert.equal(maximum,1)
 permission=false;const expired=createFeedback(()=>settings,host);expired.play('sintonia',{esperar:3000});await advance(3.1);const last=contexts.at(-1);permission=true;expired.unlock();await advance(.05);assert.equal(last.oscs.length,0,'opening expires without a gesture');expired.dispose()
 permission=false;const blocked=createFeedback(()=>settings,host);blocked.musica(true);blocked.play('sintonia',{esperar:3000});await Promise.resolve();const blockedCtx=contexts.at(-1)
 host.document.hidden=true;blocked.ocultar();host.document.hidden=false;blocked.mostrar();await Promise.resolve();permission=true;blocked.unlock();await advance(.05)
 assert.equal(blockedCtx.gains[0].gain.value,.85,'background before first gesture must not leave the master muted');assert.equal(blocked.sonando.musica,true)
 blockedCtx.state='interrupted';blockedCtx.events.forEach(f=>f());assert.equal(blocked.sonando.musica,false,'an interruption stops scheduling');const interruptedNotes=blockedCtx.oscs.length;await advance(2);assert.equal(blockedCtx.oscs.length,interruptedNotes)
 blocked.unlock();await advance(.05);assert.equal(blockedCtx.state,'running');assert.equal(blocked.sonando.musica,true);assert.equal(maximum,1)
 blocked.ocultar();blocked.unlock();await advance(.05);assert.equal(blockedCtx.gains[0].gain.value,.85,'a visible gesture recovers even if pageshow was missed');blocked.dispose()
 const unsupported=createFeedback(()=>settings,{document:{}});unsupported.unlock();assert.equal(unsupported.play('victoria'),0);unsupported.dispose()
 for(const pathname of ['/suizamente','/suizamente/partida/a','/suizamente/mapa','/suizamente/album','/suizamente/tienda','/suizamente/amigos','/suizamente/perfil','/suizamente/ajustes'])assert.equal(backgroundMusicFor({pathname}),true)
 for(const pathname of ['/suizamente/primera-vez','/suizamente/pregunta/a','/suizamente/pregunta-del-dia','/suizamente/admin','/suizamente/admin/propuestas'])assert.equal(backgroundMusicFor({pathname}),false)
 for(const flag of ['onboarding','opening','question'])assert.equal(backgroundMusicFor({pathname:'/suizamente/partida/a',[flag]:true}),false)
 assert.equal(live,0);console.log('Todo correcto: reference score/instruments/volumes; gesture and opening expiry; one AudioContext; wheel motif; fades/ducking; independent switches; vibration; hidden silence; persistent receipts; cleanup and central route policy.')
}finally{Object.assign(globalThis,original)}
