import test from 'node:test'
import assert from 'node:assert/strict'
import {businessOpen} from '../game/src/lib/suizamenteNegocios.js'
test('business hours use Zurich local time and retain overnight opening across midnight',()=>{
 const hours=Array.from({length:7},()=>null);hours[4]={desde:'22:00',hasta:'02:00'}
 assert.equal(businessOpen(hours,new Date('2026-11-27T20:59:00Z')).abierto,false)
 assert.deepEqual(businessOpen(hours,new Date('2026-11-27T21:00:00Z')),{abierto:true,hasta:'02:00'})
 assert.equal(businessOpen(hours,new Date('2026-11-28T00:30:00Z')).abierto,true)
 assert.equal(businessOpen(hours,new Date('2026-11-28T01:00:00Z')).abierto,false)
})
test('closed business and summer opening use the same Zurich calendar',()=>{
 const hours=Array.from({length:7},()=>null);assert.equal(businessOpen(hours).abierto,false)
 hours[4]={desde:'09:00',hasta:'17:00'}
 assert.equal(businessOpen(hours,new Date('2026-07-24T07:00:00Z')).abierto,true)
 assert.equal(businessOpen(hours,new Date('2026-07-24T15:00:00Z')).abierto,false)
})
