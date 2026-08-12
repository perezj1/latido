import GlobalSearch from '../components/GlobalSearch'
import { EXPLORE_EXTRAS, EXPLORE_SECTIONS } from '../lib/sections'
import { Icon } from '../lib/icons'

// Explorar es la misma pantalla de busqueda que se abre desde Inicio, pero
// entrando directamente y con las seis secciones en lugar de las sugerencias.
export default function Explorar() {
  return (
    <GlobalSearch
      immersive
      pageMode
      pageTitle={<span style={{ display:'inline-flex', alignItems:'center', gap:8 }}><Icon name="search" size={22} /> Explorar</span>}
      assistantMode
      searchEmoji={<Icon name="search" size={21} />}
      placeholder="Buscar en Latido"
      startSections={EXPLORE_SECTIONS}
      startExtras={EXPLORE_EXTRAS}
    />
  )
}
