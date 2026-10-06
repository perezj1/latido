// Sorteos de Latido: datos compartidos por la landing y el banner de Inicio.
// Las fechas deben coincidir con public.giveaways
// (supabase/giveaways_santiago_cruz_2026.sql).

export const SANTIAGO_CRUZ_GIVEAWAY = {
  id:'santiago-cruz-zurich-2026',
  path:'/santiago-cruz',
  startsAt:'2026-10-01T00:00:00+02:00',
  endsAt:'2026-10-31T23:59:59+01:00',
  endLabel:'sábado 31 de octubre de 2026, 23:59 (hora de Suiza)',
  shortEndLabel:'31 oct · 23:59',
  startLabel:'1 de octubre de 2026',
  drawLabel:'lunes 2 de noviembre de 2026',
  shortEndDayLabel:'31 oct',
  winners:2,
  ticketsPerWinner:2,
  responseHours:48,
  heroImage:'/events/santiago-cruz/santiago-cruz-zurich.jpg',
}

export const SANTIAGO_CRUZ_EVENT = {
  artist:'Santiago Cruz',
  tour:'Sigo En Pie Tour 2026',
  album:'Fragmentos',
  dateLabel:'Lunes 9 de noviembre de 2026',
  shortDateLabel:'9 noviembre 2026',
  compactDateLabel:'Lun 9 nov · 20:00',
  doors:'19:00',
  show:'20:00',
  end:'22:30',
  venue:'Plaza Zürich',
  address:'Badenerstrasse 109, 8004 Zürich',
  mapsUrl:'https://www.google.com/maps/search/?api=1&query=Plaza+Z%C3%BCrich+Badenerstrasse+109',
  organizer:'C² Concerts GmbH',
  ticketProvider:'C² Concerts GmbH',
  imageCredit:'Good News Productions AG',
  ticketsUrl:'https://www.ticketcorner.ch/event/santiago-cruz-sigo-en-pie-tour-2026-plaza-21638881/',
}

export function isGiveawayOpen(giveaway, now = Date.now()) {
  return now >= new Date(giveaway.startsAt).getTime() && now <= new Date(giveaway.endsAt).getTime()
}

export function giveawayDaysLeft(giveaway, now = Date.now()) {
  const diff = new Date(giveaway.endsAt).getTime() - now
  return diff > 0 ? Math.ceil(diff / 86400000) : 0
}
