import { AD_CATS, normalizeAdCat } from './constants'

function getListingPublishTarget(catId = '') {
  const normalizedCat = normalizeAdCat(catId)
  if (!normalizedCat) return { label:'+ Anuncio', to:'/publicar' }
  if (normalizedCat === 'empleo') return { label:'+ Empleo', to:'/publicar-empleo' }

  const category = AD_CATS.find(item => item.id === normalizedCat)
  if (!category) return { label:'+ Anuncio', to:'/publicar' }

  return {
    label:`+ ${category.label}`,
    to:`/publicar?cat=${encodeURIComponent(category.id)}`,
  }
}

export function getPublishTarget(pathname, search = '') {
  const params = new URLSearchParams(search)

  if (pathname === '/comunidades') {
    const view = params.get('view') || 'comunidades'

    if (view === 'negocios') return { label:'+ Negocio', to:'/registrar-negocio' }
    if (view === 'eventos') return { label:'+ Evento', to:'/publicar-evento' }

    return { label:'+ Comunidad', to:'/registrar-comunidad' }
  }

  if (pathname === '/tablon') {
    return getListingPublishTarget(params.get('cat') || '')
  }

  return { label:'+ Anuncio', to:'/publicar' }
}
