// Server-only. Never import this module or these data files from src/.
import { readFileSync } from 'node:fs'

const read = name => JSON.parse(readFileSync(new URL('./data/' + name + '.json', import.meta.url), 'utf8'))
let cached
export function getSuizamenteConfig() {
  if (!cached) {
    const juego = read('juego')
    const album = read('album')
    const preguntas = read('preguntas')
    if (juego.categorias.length !== 6 || !album.colecciones.length || !preguntas.preguntas.length) throw new Error('Configuración de Suizamente incompleta')
    cached = { juego, album, preguntas }
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
    recompensasComunidad:{dia:juego.recompensas.preguntaDelDia,valorar:juego.recompensas.valoracionPropuesta},
  }
}
