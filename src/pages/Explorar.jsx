import GlobalSearch from '../components/GlobalSearch'
import { EXPLORE_EXTRAS, EXPLORE_SECTIONS } from '../lib/sections'

// Explorar es la misma pantalla de busqueda que se abre desde Inicio, pero
// entrando directamente y con las seis secciones en lugar de las sugerencias.
export default function Explorar() {
  return (
    <GlobalSearch
      immersive
      pageMode
      pageTitle="🔎 Explorar"
      assistantMode
      searchEmoji="🔎"
      placeholder="Buscar en Latido"
      startSections={EXPLORE_SECTIONS}
      startExtras={EXPLORE_EXTRAS}
    />
  )
}
