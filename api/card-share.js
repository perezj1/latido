import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { cardPublicSeo, renderCardShareHtml } from '../src/lib/latidoCardSeo.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
let shell

export default async function handler(req, res) {
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.setHeader('Allow', 'GET, HEAD')
    return res.status(405).end()
  }
  try {
    shell ||= readFile(path.join(process.cwd(), 'dist/index.html'), 'utf8')
    const html = await shell
    const provider = String(req.query.provider || '')
    const offerId = String(req.query.oferta || '')
    const origin = process.env.VITE_SITE_URL || 'https://latido.ch'
    const endpoint = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
    const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
    let seo = null
    if (endpoint && anon && (UUID.test(provider) || UUID.test(offerId))) {
      const rpc = async (name, params) => {
        const response = await fetch(`${endpoint}/rest/v1/rpc/${name}`, {
          method: 'POST',
          headers: {
            apikey: anon,
            Authorization: `Bearer ${anon}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(params),
          signal: AbortSignal.timeout(4500)
        })
        if (!response.ok) throw new Error('Public catalog unavailable')
        return response.json()
      }
      try {
        if (UUID.test(provider)) {
          const local = await rpc('lc_business_benefits', { p_provider: provider })
          seo = cardPublicSeo({
            ...local,
            offer: local.offers?.find((o) => o.id === offerId),
            origin
          })
        } else {
          const offers = await rpc('lc_catalog', {})
          const offer = offers.find((o) => o.id === offerId)
          if (offer) seo = cardPublicSeo({ offer, origin })
        }
      } catch {
        /* Serve the working app even if the public catalog is temporarily unavailable. */
      }
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader(
      'Cache-Control',
      seo ? 'public, max-age=0, s-maxage=60, stale-while-revalidate=300' : 'no-store'
    )
    res.setHeader('X-Robots-Tag', 'noindex, follow')
    return res.status(200).end(req.method === 'HEAD' ? '' : renderCardShareHtml(html, seo))
  } catch {
    shell = null
    return res.status(503).end('No se pudo cargar Latido. Vuelve a intentarlo.')
  }
}
