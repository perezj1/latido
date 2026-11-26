import assert from 'node:assert/strict'
import {PUSH_REMINDER_DELAY,pushReminderDue,postponePushReminder} from '../game/src/lib/suizamentePushReminder.js'
const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)},now=Date.parse('2026-11-26T12:00:00Z')
assert.equal(PUSH_REMINDER_DELAY,3*86400000)
assert.equal(pushReminderDue(null,now,storage),false);assert.equal(pushReminderDue('a',now,storage),true)
postponePushReminder('a',now,storage);assert.equal(pushReminderDue('a',now,storage),false);assert.equal(pushReminderDue('a',now+PUSH_REMINDER_DELAY-1,storage),false);assert.equal(pushReminderDue('a',now+PUSH_REMINDER_DELAY,storage),true);assert.equal(pushReminderDue('b',now,storage),true)
values.set('suizamente:push-recordatorio:a','invalid');assert.equal(pushReminderDue('a',now,storage),true)
const unavailable={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};assert.equal(pushReminderDue('a',now,unavailable),true);postponePushReminder('a',now,unavailable)
console.log('Push reminder: first visit, three-day boundary, separate accounts, damaged/missing storage and safe postponement passed.')
