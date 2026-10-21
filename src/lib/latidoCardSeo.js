import { businessBenefit } from './latidoCardExperience.js'

export function cardPublicSeo({ business, offers = [], offer, origin = 'https://latido.ch' }) {
  const name = business?.name || offer?.business_name
  if (!name) return null
  const city = business?.city || offer?.city
  const providerId = business?.id || offer?.provider_id
  const image = business?.photo_url || offer?.business_photo_url
  const url = new URL(`/card/negocio/${providerId}`, origin)
  if (offer) url.searchParams.set('oferta', offer.id)
  return {
    title: offer ? `${offer.title} · ${name} · Latido Club` : `${name} · Ofertas de Latido Club`,
    description: `${businessBenefit(offer ? [offer] : offers)} para socios${city ? ` en ${city}` : ''}. Consulta las ofertas y sus condiciones en Latido Club.`,
    image:
      image && /^https?:$/.test(new URL(image, origin).protocol)
        ? new URL(image, origin).href
        : new URL('/og-image.png', origin).href,
    canonical: url.href,
    // Indexing is a separate owner decision. Sharing previews work with noindex.
    robots: 'noindex, follow',
    type: 'website'
  }
}

const escape = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  )

export function renderCardShareHtml(html, seo) {
  if (!seo) return html
  let result = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escape(seo.title)}</title>`)
  const tags = {
    'name="description"': seo.description,
    'name="robots"': seo.robots,
    'property="og:title"': seo.title,
    'property="og:description"': seo.description,
    'property="og:image"': seo.image,
    'property="og:url"': seo.canonical,
    'name="twitter:title"': seo.title,
    'name="twitter:description"': seo.description,
    'name="twitter:image"': seo.image
  }
  for (const [selector, content] of Object.entries(tags)) {
    const tag = `<meta ${selector} content="${escape(content)}" />`
    const pattern = new RegExp(`<meta\\s+[^>]*${selector}[^>]*>`, 'i')
    result = pattern.test(result)
      ? result.replace(pattern, tag)
      : result.replace('</head>', `${tag}</head>`)
  }
  const canonical = `<link rel="canonical" href="${escape(seo.canonical)}" />`
  return /<link\s+[^>]*rel=["']canonical["'][^>]*>/i.test(result)
    ? result.replace(/<link\s+[^>]*rel=["']canonical["'][^>]*>/i, canonical)
    : result.replace('</head>', `${canonical}</head>`)
}
