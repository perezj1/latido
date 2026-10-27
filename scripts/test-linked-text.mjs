import assert from 'node:assert/strict'
import { findTextLinks } from '../src/lib/linkedText.js'

function links(text) {
  const matches = findTextLinks(text)
  for (let i = 1; i < matches.length; i++) {
    assert.ok(matches[i - 1].end <= matches[i].start, 'Links must not overlap')
  }
  return matches.map(({ start, end, href, type }) => ({ label:text.slice(start, end), href, type }))
}

for (const [number, href] of [
  ['079 123 45 67', 'tel:+41791234567'],
  ['0791234567', 'tel:+41791234567'],
  ['(079) 123 45 67', 'tel:+41791234567'],
  ['044 668 18 00', 'tel:+41446681800'],
  ['+41 (0)79 123 45 67', 'tel:+41791234567'],
  ['0041 79 123 45 67', 'tel:+41791234567'],
  ['+34 612 345 678', 'tel:+34612345678'],
  ['+49 30 123456', 'tel:+4930123456'],
  ['+1 (213) 373-4253', 'tel:+12133734253'],
  ['+41 44 668 18 00 ext. 123', 'tel:+41446681800;ext=123'],
]) {
  assert.deepEqual(links(`Llámame al ${number}. Gracias.`), [{ label:number, href, type:'phone' }])
}

assert.deepEqual(links('Teléfonos: 0791234567 0782345678'), [
  { label:'0791234567', href:'tel:+41791234567', type:'phone' },
  { label:'0782345678', href:'tel:+41782345678', type:'phone' },
])

assert.deepEqual(links('Llama al 079 123 45 67.\nMira https://example.com/0791234567 y www.example.org.\nO al +34 612 345 678.'), [
  { label:'079 123 45 67', href:'tel:+41791234567', type:'phone' },
  { label:'https://example.com/0791234567', href:'https://example.com/0791234567', type:'url' },
  { label:'www.example.org', href:'https://www.example.org/', type:'url' },
  { label:'+34 612 345 678', href:'tel:+34612345678', type:'phone' },
])

assert.deepEqual(links('Consulta (https://example.com/course_(intro)).'), [
  { label:'https://example.com/course_(intro)', href:'https://example.com/course_(intro)', type:'url' },
])
assert.deepEqual(links('example.com?phone=0791234567'), [
  { label:'example.com?phone=0791234567', href:'https://example.com/?phone=0791234567', type:'url' },
])

for (const text of [
  '',
  'Sin teléfono de contacto.',
  'Fechas: 27.10.2026, 2026-10-27, 27/10/2026.',
  'Alquiler CHF 1.800 al mes. Código postal 8000. 45 m². Referencia 123456.',
  'Referencia ABC0791234567XYZ.',
  '0791234567@example.com',
  'ftp://example.com/0791234567',
  'https://user:password@example.com/0791234567',
  'javascript:alert(1)',
]) {
  assert.deepEqual(links(text), [], `Unexpected link in: ${text}`)
}

console.log('Linked text: phone formats, URL coexistence, punctuation and non-phone values passed.')
