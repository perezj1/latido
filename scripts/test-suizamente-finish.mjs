import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createFeedback} from '../src/lib/suizamenteFeedback.js'
const played=[],vibrations=[]
let created=0,closed=0,stopped=0,settings={sonidos:true,vibracion:true}
class Audio{
 constructor(){created++;this.currentTime=0;this.destination={}}
 resume(){return Promise.resolve()}
 close(){closed++;return Promise.resolve()}
 createOscillator(){return {frequency:{value:0},connect(){},disconnect(){},start(at){played.push({frequency:this.frequency.value,at})},stop(){stopped++}}}
 createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}}}
}
const host={AudioContext:Audio,navigator:{vibrate:n=>vibrations.push(n)},document:{visibilityState:'visible'}}
const player=createFeedback(()=>settings,host)
player.play('acierto');assert.equal(played.length,0);assert.equal(vibrations.length,0,'No autoplay or vibration before interaction')
player.unlock();player.play('acierto');assert.ok(played.length>1);assert.equal(created,1);assert.equal(vibrations.length,1)
assert.ok(new Set(played.map(n=>n.frequency)).size>1,'An original pitched cue')
player.unlock();assert.equal(created,1,'One audio context per app lifecycle')
settings={sonidos:false,vibracion:false};const oldCount=played.length,oldVibration=vibrations.length
player.play('fallo');assert.equal(played.length,oldCount);assert.equal(vibrations.length,oldVibration)
settings={sonidos:false,vibracion:true};player.play('fallo');assert.equal(played.length,oldCount);assert.equal(vibrations.length,oldVibration+1)
settings={sonidos:true,vibracion:false};player.play('cofre');assert.ok(played.length>oldCount)
host.document.visibilityState='hidden';const hiddenCount=played.length;player.play('ruleta');assert.equal(played.length,hiddenCount)
player.dispose();assert.equal(closed,1);assert.ok(stopped>0)
for(const file of ['preguntas','album'])assert.equal(await readFile('server/suizamente/data/'+file+'.json','utf8'),await readFile('suizamente/data/'+file+'.json','utf8'),'Exact canonical content and option order: '+file)
assert.equal(await readFile('public/suizamente-assets/mapa3d.json','utf8'),await readFile('suizamente/data/mapa3d.json','utf8'))
const manifest=JSON.parse(await readFile('public/suizamente.webmanifest','utf8'))
assert.equal(manifest.background_color,'#FFFFFF');assert.equal(manifest.id,'/suizamente');assert.ok(manifest.start_url.startsWith(manifest.scope))
for(const icon of manifest.icons){const png=await readFile('public'+icon.src);assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),Number(icon.sizes.split('x')[0]))}
console.log('Finish: original audio, gesture gating, independent mute/vibration, context cleanup, exact canonical banks/geometry, manifest and real PNG icons passed.')
