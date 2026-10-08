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
export function getGuideStepPath(guide, resourcePackage) {
  return `${getGuidePath(guide)}?paquete=${encodeURIComponent(resourcePackage.slug)}`
}

export function getPackageSteps(resourcePackage, canton='') {
  return resourcePackage.resources.map((resource, index) => {
    const guide = getGuideById(getResourceGuideId(resource))
    return {
      id:resource.id,
      index,
      resource,
      guide,
      kind:guide ? 'Guía' : getPackageResourceKind(resource),
      path:guide ? getGuideStepPath(guide, resourcePackage) : getPackageResourcePath(resource, canton),
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
