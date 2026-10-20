import assert from 'node:assert/strict'
import { cardFeaturedDay, selectFeaturedCardOffer } from '../src/lib/latidoCardFeatured.js'

const now = Date.parse('2026-10-20T12:00:00Z')
const offer = (provider, id = provider, extras = {}) => ({
  id, provider_id: provider, city: 'Zürich', benefit_type: 'percent', benefit_value: 10,
  ends_at: 'infinity', ...extras
})
const options = { now }
assert.equal(selectFeaturedCardOffer([], options), null)
for (const unavailable of [
  { active: false }, { deleted_at: '2026-10-01' }, { remaining: 0 },
  { ends_at: '2020-01-01' }, { starts_at: '2030-01-01' }
]) assert.equal(selectFeaturedCardOffer([offer('a', 'a', unavailable)], options), null)
// Public catalog rows need not include the active field.
assert.equal(selectFeaturedCardOffer([offer('a')], options).id, 'a')
assert.equal(selectFeaturedCardOffer([
  offer('a'), offer('b', 'b', { city: 'Luzern' })
], { now, canton: 'LU' }).provider_id, 'b')
assert.equal(selectFeaturedCardOffer([
  offer('a'), offer('b', 'b', { city: 'Baden-Dättwil' })
], { now, canton: 'AG', businesses: [{ id: 'b', canton: 'AG', photo_url: '/logo.png' }] }).business_photo_url, '/logo.png')
assert.ok(selectFeaturedCardOffer([offer('a')], { now, canton: 'TI' }), 'Fall back when no local offer exists')
const many = [offer('a', 'a1'), offer('a', 'a2'), offer('a', 'a3'), offer('b')]
const counts = { a: 0, b: 0 }
const seen = new Set()
for (let offset = 0; offset < 6; offset++) {
  const result = selectFeaturedCardOffer(many, { now: now + offset * 86400000 })
  counts[result.provider_id]++
  seen.add(result.id)
  assert.equal(result.id, selectFeaturedCardOffer([...many].reverse(), { now: now + offset * 86400000 }).id)
}
assert.deepEqual(counts, { a: 3, b: 3 }, 'More offers must not buy more featured days')
assert.equal(seen.size, 4, 'Rotate offers within each business as well')
assert.equal(cardFeaturedDay(Date.parse('2026-10-20T21:59:59Z')), cardFeaturedDay(Date.parse('2026-10-20T22:00:00Z')) - 1)
assert.equal(cardFeaturedDay(Date.parse('2026-10-25T22:59:59Z')), cardFeaturedDay(Date.parse('2026-10-25T23:00:00Z')) - 1)
console.log('Featured offers: eligibility, canton priority, equal business rotation, stable ordering and Zurich midnight passed')
