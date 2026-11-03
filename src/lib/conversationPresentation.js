function validDate(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function messageDay(value) {
  const date = validDate(value)
  return date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : ''
}

export function messageTime(value) {
  const date = validDate(value)
  return date ? date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : ''
}

export function messageDayLabel(value, now = new Date()) {
  const date = validDate(value)
  if (!date) return ''
  if (messageDay(date) === messageDay(now)) return 'Hoy'
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (messageDay(date) === messageDay(yesterday)) return 'Ayer'
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
}
