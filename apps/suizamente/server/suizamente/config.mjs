// Server-only. Never import this module or these data files from src/.
import { readFileSync } from 'node:fs'

const read = name => JSON.parse(readFileSync(new URL('./data/' + name + '.json', import.meta.url), 'utf8'))
let cached
let mysteryDates
export function publicImprovementFlags(flags,available){
 mysteryDates??=new Set(read('misterios').misterios.map(m=>m.fecha))
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Zurich',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
 return {...flags,misterio:{...flags.misterio,disponibleHoy:available??mysteryDates.has(today)}}
}
export function getSuizamenteConfig() {
  if (!cached) {
    const juego = read('juego')
    if (juego.categorias.length !== 6) throw new Error('Configuración de Suizamente incompleta')
    let album,preguntas
    // HTTP flags/configuration need only juego. Keep the private banks lazy.
    cached = {juego,get album(){album??=read('album');if(!album.colecciones.length)throw new Error('Álbum incompleto');return album},get preguntas(){preguntas??=read('preguntas');if(!preguntas.preguntas.length)throw new Error('Preguntas incompletas');return preguntas}}
  }
  return cached
}
export function publicSuizamenteConfig() {
  const { juego } = getSuizamenteConfig()
  return {
    categorias: juego.categorias, ruleta: juego.ruleta, partida: juego.partida,
    bienvenida: juego.recompensas.bienvenida,
    quienYaJugaba: juego.recompensas.quienYaJugaba,
    comodines:juego.comodines, tienda:juego.tienda, escudos:juego.escudos,
    duelo:juego.duelo, niveles:juego.niveles,
    mapa:juego.mapa, asaltos:juego.asaltos, album:juego.album,
    minimoVotosParaPorcentajes:juego.minimoVotosParaPorcentajes,
    mejoras:publicImprovementFlags(juego.mejoras),negocios:juego.negocios,
    recompensasComunidad:{dia:juego.recompensas.preguntaDelDia,valorar:juego.recompensas.valoracionPropuesta},
  }
}
