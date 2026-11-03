import assert from 'node:assert/strict'
import { messageDay, messageDayLabel, messageTime } from '../src/lib/conversationPresentation.js'

// Calendar boundaries use the viewer's timezone, including DST and year changes.
process.env.TZ = 'Europe/Zurich'
assert.equal(messageTime('2026-11-03T08:05:00Z'), '09:05')
assert.equal(messageTime('2026-11-02T23:00:00Z'), '00:00')
assert.equal(messageDay('2026-11-02T23:05:00Z'), '2026-11-03')
assert.equal(messageDay('2026-11-02T22:59:00Z'), '2026-11-02')
assert.equal(messageDayLabel('2026-11-02T23:05:00Z', new Date('2026-11-03T12:00:00Z')), 'Hoy')
assert.equal(messageDayLabel('2026-12-31T12:00:00Z', new Date('2027-01-01T12:00:00Z')), 'Ayer')
assert.equal(messageDayLabel('2026-10-24T23:30:00Z', new Date('2026-10-26T11:00:00Z')), 'Ayer')
assert.equal(messageDayLabel('2025-11-03T12:00:00Z', new Date('2026-11-03T12:00:00Z')), '3 de noviembre de 2025')
for (const invalid of [null, '', 'invalid']) {
  assert.equal(messageTime(invalid), '')
  assert.equal(messageDay(invalid), '')
  assert.equal(messageDayLabel(invalid), '')
}
console.log('Conversation presentation: HH:MM, local date boundaries, DST and date labels passed.')
