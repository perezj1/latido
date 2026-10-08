import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check } from 'lucide-react'
import { EmptyState, PillFilters } from '../components/UI'
import { usePackageProgress } from '../hooks/usePackageProgress'
import { C, PP } from '../lib/theme'
import { normalizeSearchText } from '../lib/naturalSearch'
import { RESOURCE_PACKAGES, getResourcePackagePath } from '../lib/resourcePackages'
import './ResourcePackage.css'

const PACKAGE_CATEGORIES = [
  { id:'', label:'Todos' },
  { id:'llegada', label:'🧳 Llegada', slugs:['acabo-de-llegar', 'llego-con-ninos'] },
  { id:'trabajo', label:'💼 Trabajo', slugs:['busco-trabajo', 'sin-trabajo'] },
  { id:'vivienda', label:'🏠 Vivienda', slugs:['busco-piso', 'me-mudo'] },
  { id:'familia', label:'👶 Familia', slugs:['llego-con-ninos', 'viene-un-bebe'] },
  { id:'planes', label:'🎉 Planes y comunidad', slugs:['planes-y-comunidad'] },
  { id:'salida', label:'✈️ Salida de Suiza', slugs:['vuelvo-a-mi-pais'] },
]

export default function ResourcePackages() {
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState('')
  const { completedIn } = usePackageProgress()
  const selectedCategory = PACKAGE_CATEGORIES.find(category => category.id === cat)
  const terms = normalizeSearchText(search).split(' ').filter(Boolean)
  const filtered = RESOURCE_PACKAGES.filter(resourcePackage => {
    const matchesCategory = !cat || selectedCategory.slugs.includes(resourcePackage.slug)
    const searchableText = normalizeSearchText([
      resourcePackage.title,
      resourcePackage.description,
      resourcePackage.intro,
      ...resourcePackage.resources.map(resource => `${resource.title} ${resource.description}`),
    ].join(' '))
    return matchesCategory && terms.every(term => searchableText.includes(term))
  })

  return (
    <div className="latido-page-container latido-page-container--content latido-package-catalog" style={{ paddingTop:16, paddingBottom:100 }}>
      <header className="section-page-head">
        <h1>📦 Paquetes</h1>
        <p>Guías, anuncios y comunidad reunidos para cada etapa de tu vida en Suiza.</p>
      </header>
      <div style={{ position:'relative', marginBottom:12 }}>
        <span aria-hidden="true" style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', color:C.light }}>🔍</span>
        <input
          type="search"
          aria-label="Buscar paquetes"
          style={{ width:'100%', border:`1.5px solid ${C.border}`, borderRadius:13, padding:'11px 13px 11px 36px', fontSize:12, fontFamily:PP, outline:'none', background:'#fff', boxSizing:'border-box' }}
          placeholder="Buscar piso, trabajo, familia, mudanza..."
          value={search}
          onChange={event => setSearch(event.target.value)}
        />
      </div>
      <PillFilters options={PACKAGE_CATEGORIES} value={cat} onChange={setCat} className="mb-4" />
      <section className="latido-resource-package__resources" aria-labelledby="package-catalog-title">
        <h2 id="package-catalog-title">¿Por dónde quieres empezar?</h2>
        <div className="latido-package-catalog__grid">
          {filtered.map(resourcePackage => {
            const total = resourcePackage.resources.length
            const done = completedIn(resourcePackage.slug, resourcePackage.resources.map(resource => resource.id))
            const complete = total > 0 && done === total
            return (
              <Link key={resourcePackage.slug} className={`latido-package-catalog__card${complete ? ' is-complete' : ''}`} to={getResourcePackagePath(resourcePackage)}>
                <span className="latido-resource-packages__emoji" aria-hidden="true">{resourcePackage.emoji}</span>
                <h3>{resourcePackage.title}</h3>
                <p>{resourcePackage.description}</p>
                {done > 0 && (
                  <span className="latido-package-catalog__progress">
                    <span className="latido-package-catalog__progress-label">
                      {complete ? <><Check size={13} strokeWidth={3} aria-hidden="true" />Completado</> : `Llevas ${done} de ${total}`}
                    </span>
                    <span className="latido-package-catalog__progress-bar" aria-hidden="true">
                      <span style={{ width:`${Math.round((done / total) * 100)}%` }} />
                    </span>
                  </span>
                )}
                <span className="latido-resource-package__action">
                  {done > 0 && !complete ? 'Continuar' : 'Ver paquete'}
                  <ArrowRight size={16} aria-hidden="true" />
                </span>
              </Link>
            )
          })}
        </div>
        {filtered.length === 0 && (
          <EmptyState
            emoji="📦"
            title="No se encontraron paquetes"
            text="Prueba otra búsqueda o elige otra categoría."
            action="Ver todos los paquetes"
            onAction={() => { setSearch(''); setCat('') }}
          />
        )}
      </section>
    </div>
  )
}
