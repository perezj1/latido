// Une paquetes y guías: los pasos de un paquete y el recorrido de una guía.
// Vive aparte porque seo.js ya importa resourcePackages.js (evita el ciclo).
import { getGuideById, getGuidePath } from './seo.js'
import {
  getGuidePackages,
  getPackageResourceKind,
  getPackageResourcePath,
  getResourceGuideId,
} from './resourcePackages.js'

// La guía se abre con el paquete como contexto para no perder el recorrido.
export function getGuideStepPath(guide, resourcePackage, canton=null) {
  const params = new URLSearchParams({paquete:resourcePackage.slug})
  if (canton !== null) params.set('canton',canton || 'all')
  return `${getGuidePath(guide)}?${params}`
}

// Non-guide tasks need their own topic, rather than the whole package's terms.
// This prevents a childcare step from inheriting insurance or immigration ads.
export function getPackageResourceBusinessContext(resource, resourcePackage) {
  const url = new URL(resource.href, 'https://latido.ch')
  const category = url.searchParams.get('cat')
  if (category === 'empleo' || url.pathname === '/publicar-empleo') {
    return {
      relatedBusinessTerms:['rav', 'orp', 'búsqueda de empleo', 'búsqueda de trabajo', 'agencia de empleo', 'agencia de colocación', 'colocación de personal', 'trabajo temporal', 'orientación laboral', 'cv', 'currículum', 'carta de motivación', 'cartas de presentación'],
      relatedBusinessCategories:['empleo'],
    }
  }
  if (category === 'vivienda') return getGuideById('d9')
  if (category === 'documentos') return {
    relatedBusinessCategories:resourcePackage?.slug === 'sin-trabajo' ? ['empleo'] : [],
    relatedBusinessTerms:[
      'gestoría', 'gestoria', 'trámites administrativos', 'trámites y papeleo', 'trámites y acompañamientos', 'gestiones administrativas', 'traducción', 'traducciones', 'interpretación', 'documentación', 'cartas y formularios', 'papeleo', 'burocracia',
      ...({
        'acabo-de-llegar':['permiso de residencia', 'permisos y registro'],
        'busco-piso':['contratos de alquiler', 'derecho de arrendamiento'],
        'sin-trabajo':['rav', 'orp', 'desempleo'],
        'vuelvo-a-mi-pais':['trámites de salida', 'salida de suiza', 'salidas de suiza', 'retorno', 'repatriación'],
      }[resourcePackage?.slug] || []),
    ],
  }
  if (category === 'cuidados') return {
    relatedBusinessTerms:['cuidado infantil', 'cuidado de niños', 'niñera', 'niñero', 'au pair', 'guardería', 'guarderías', 'kita'],
  }
  if (category === 'servicios' && url.searchParams.get('q') === 'mudanza') return {
    relatedBusinessTerms:['mudanza', 'mudanzas', 'transporte de muebles', 'limpieza final', 'limpieza de fin de alquiler', 'umzug', 'umzüge', 'déménagement', 'déménagements'],
  }
  // Events, groups, creators and selling belongings have their own destinations;
  // no unrelated business rail is inserted just to fill the space.
  return null
}

export function getPackageSteps(resourcePackage, canton='') {
  return resourcePackage.resources.map((resource, index) => {
    const guide = getGuideById(getResourceGuideId(resource))
    return {
      id:resource.id,
      index,
      resource,
      guide,
      businessContext:guide || getPackageResourceBusinessContext(resource, resourcePackage),
      kind:guide ? 'Guía' : getPackageResourceKind(resource),
      path:guide ? getGuideStepPath(guide, resourcePackage, canton) : getPackageResourcePath(resource, canton),
    }
  })
}

// Paquetes de una guía y el paquete activo: el de la URL (?paquete=) o, si no
// llega desde ninguno, el primero que la incluye.
export function getGuideJourney(guideId, packageSlug='') {
  const memberships = getGuidePackages(guideId)
  const fromUrl = memberships.find(membership => membership.resourcePackage.slug === packageSlug) || null
  return {
    memberships,
    active:fromUrl || memberships[0] || null,
    fromPackage:Boolean(fromUrl),
  }
}
