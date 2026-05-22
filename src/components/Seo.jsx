import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { DEFAULT_SEO, getSeoForLocation, getStructuredData, SITE_NAME } from '../lib/seo'

function upsertMeta(selector, attrs) {
  let tag = document.head.querySelector(selector)

  if (!tag) {
    tag = document.createElement('meta')
    document.head.appendChild(tag)
  }

  Object.entries(attrs).forEach(([key, value]) => {
    tag.setAttribute(key, value)
  })
}

function upsertCanonical(href) {
  let tag = document.head.querySelector('link[rel="canonical"]')

  if (!tag) {
    tag = document.createElement('link')
    tag.setAttribute('rel', 'canonical')
    document.head.appendChild(tag)
  }

  tag.setAttribute('href', href)
}

function upsertJsonLd(data) {
  let tag = document.head.querySelector('script#latido-structured-data')

  if (!tag) {
    tag = document.createElement('script')
    tag.id = 'latido-structured-data'
    tag.type = 'application/ld+json'
    document.head.appendChild(tag)
  }

  tag.textContent = JSON.stringify(data)
}

function applySeo(seo) {
  document.documentElement.lang = 'es'
  document.title = seo.title || DEFAULT_SEO.title

  upsertMeta('meta[name="description"]', { name:'description', content:seo.description || DEFAULT_SEO.description })
  upsertMeta('meta[name="robots"]', { name:'robots', content:seo.robots || DEFAULT_SEO.robots })

  upsertMeta('meta[property="og:site_name"]', { property:'og:site_name', content:SITE_NAME })
  upsertMeta('meta[property="og:title"]', { property:'og:title', content:seo.title || DEFAULT_SEO.title })
  upsertMeta('meta[property="og:description"]', { property:'og:description', content:seo.description || DEFAULT_SEO.description })
  upsertMeta('meta[property="og:type"]', { property:'og:type', content:seo.type || DEFAULT_SEO.type })
  upsertMeta('meta[property="og:url"]', { property:'og:url', content:seo.canonical })
  upsertMeta('meta[property="og:image"]', { property:'og:image', content:seo.image })

  upsertMeta('meta[name="twitter:card"]', { name:'twitter:card', content:'summary_large_image' })
  upsertMeta('meta[name="twitter:title"]', { name:'twitter:title', content:seo.title || DEFAULT_SEO.title })
  upsertMeta('meta[name="twitter:description"]', { name:'twitter:description', content:seo.description || DEFAULT_SEO.description })
  upsertMeta('meta[name="twitter:image"]', { name:'twitter:image', content:seo.image })

  upsertCanonical(seo.canonical)
  upsertJsonLd(getStructuredData(seo))
}

export default function Seo() {
  const location = useLocation()

  useEffect(() => {
    applySeo(getSeoForLocation(location))
  }, [location])

  return null
}
