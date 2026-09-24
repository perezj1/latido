import { GELATO_CATALOG, GELATO_STOREFRONT } from './gelatoCatalog.js'

const GELATO_ORDER_URL = 'https://order.gelatoapis.com/v4/orders'
const GELATO_QUOTE_URL = 'https://order.gelatoapis.com/v4/orders:quote'
const GELATO_STORES_URL = 'https://ecommerce.gelatoapis.com/v1/stores'
const MAX_ITEMS = 12
const MAX_QUANTITY = 10
const STOREFRONT_CACHE_MS = 5 * 60 * 1000
const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL']

let storefrontCache = null

function getBaseCatalog() {
  const raw = process.env.GELATO_PRODUCT_CATALOG_JSON
  if (!raw) return GELATO_CATALOG

  let catalog
  try {
    catalog = JSON.parse(raw)
  } catch {
    throw new Error('Gelato product catalog is not valid JSON')
  }

  if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) {
    throw new Error('Gelato product catalog is not valid')
  }
  // The env value adds or overrides entries; it must not remove the verified
  // variants bundled with the application. This also keeps existing carts
  // usable if the live storefront cannot be refreshed temporarily.
  return { ...GELATO_CATALOG, ...catalog }
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

async function gelatoGet(url, apiKey) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'X-API-KEY': apiKey,
    },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = payload?.message || payload?.error?.message || payload?.error
    const error = new Error(typeof detail === 'string' ? detail : 'Gelato no pudo cargar el catálogo.')
    error.statusCode = response.status >= 500 ? 502 : 400
    throw error
  }
  return payload
}

function getPresentation(product) {
  const exactMatch = GELATO_STOREFRONT.products.find(item => item.id === product.id)
  if (exactMatch) return exactMatch
  return GELATO_STOREFRONT.products.find(item => (
    item.matchByTitle === true
    && item.titleIncludes
    && String(product.title || '').toLowerCase().includes(item.titleIncludes.toLowerCase())
  ))
}

function getOptionDefinitions(product) {
  const definitions = Array.isArray(product.productVariantOptions)
    ? product.productVariantOptions
    : [product.productVariantOptions]
  return definitions
    .filter(definition => definition?.name && Array.isArray(definition.values) && definition.values.length)
    .map(definition => ({ name: definition.name, values: definition.values }))
}

function getVariantSelections(variant, optionDefinitions) {
  const titleParts = String(variant.title || '').split(' - ').map(item => item.trim())
  return Object.fromEntries(optionDefinitions.map(definition => [
    definition.name,
    definition.values.find(value => titleParts.includes(value))
      || (definition.values.length === 1 ? definition.values[0] : ''),
  ]).filter(([, value]) => value))
}

function variantRank(selections, optionDefinitions) {
  return optionDefinitions.reduce((rank, definition) => {
    const configuredRank = definition.values.indexOf(selections[definition.name])
    const sizeRank = SIZE_ORDER.indexOf(String(selections[definition.name] || '').toUpperCase())
    const valueRank = configuredRank !== -1
      ? configuredRank
      : definition.values.length + (sizeRank === -1 ? SIZE_ORDER.length : sizeRank)
    return rank * Math.max(definition.values.length, SIZE_ORDER.length) + valueRank
  }, 0)
}

function getPreviewScenes(product) {
  const entry = (Array.isArray(product.metadata) ? product.metadata : [])
    .find(item => item.key === 'previewScenes')
  if (!entry?.value) return []
  try {
    const scenes = JSON.parse(entry.value)
    return Array.isArray(scenes) ? scenes : []
  } catch {
    return []
  }
}

function sceneLabel(scene, index) {
  const normalized = String(scene || '').toLowerCase()
  if (normalized.includes('front')) return 'Frontal'
  if (normalized.includes('back')) return 'Trasera'
  if (normalized.includes('left')) return 'Lateral izquierdo'
  if (normalized.includes('right')) return 'Lateral derecho'
  return `Vista ${index + 1}`
}

async function imageFingerprint(url) {
  try {
    const response = await fetch(url)
    if (!response.ok) return url
    const bytes = await response.arrayBuffer()
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  } catch {
    return url
  }
}

async function getProductImages(product, presentation) {
    if (Array.isArray(presentation.galleryImages) && presentation.galleryImages.length) {
      return presentation.galleryImages
        .filter(image => image?.url || (image?.base && image?.overlay))
        .map((image, index) => ({
          url: image.url || image.base,
          label: image.label || `Vista ${index + 1}`,
          ...(image.selections ? { selections: image.selections } : {}),
          ...(image.background ? { background: image.background } : {}),
          ...(image.base ? { base: image.base } : {}),
          ...(image.overlay ? { overlay: image.overlay } : {}),
          ...(image.placement ? { placement: image.placement } : {}),
        }))
  }

  const candidates = (Array.isArray(product.productImages) ? product.productImages : [])
    .filter(item => item?.fileUrl && item.status !== 'failed')
    .sort((first, second) => Number(second.isPrimary) - Number(first.isPrimary))
    .slice(0, presentation.maxImages || 8)
  if (!candidates.length && product.previewUrl) candidates.push({ fileUrl: product.previewUrl, isPrimary: true })

  const scenes = getPreviewScenes(product)
  const images = []
  const fingerprints = new Set()
  for (const candidate of candidates) {
    const fingerprint = await imageFingerprint(candidate.fileUrl)
    if (fingerprints.has(fingerprint)) continue
    fingerprints.add(fingerprint)
    const index = images.length
    images.push({
      url: candidate.fileUrl,
      label: sceneLabel(scenes[index], index),
    })
  }

  for (const additionalImage of presentation.additionalImages || []) {
    if (additionalImage?.scene && scenes.some(scene => String(scene).toLowerCase().includes(additionalImage.scene))) continue
    if (!additionalImage?.url || images.some(image => image.url === additionalImage.url)) continue
    images.push({
      url: additionalImage.url,
      label: additionalImage.label || `Vista ${images.length + 1}`,
    })
  }

  if (!images.length && presentation.imageFallback) {
    images.push({ url: presentation.imageFallback, label: 'Vista del producto' })
  }
  return images
}

async function getStorefront(apiKey) {
  if (storefrontCache?.expiresAt > Date.now()) return storefrontCache.value

  const storesPayload = await gelatoGet(GELATO_STORES_URL, apiKey)
  const stores = Array.isArray(storesPayload?.stores) ? storesPayload.stores : []
  const configuredStoreId = clean(process.env.GELATO_STORE_ID, 80)
  const configuredStoreName = clean(process.env.GELATO_STORE_NAME, 100) || GELATO_STOREFRONT.storeName
  const store = stores.find(item => item.id === configuredStoreId)
    || stores.find(item => String(item.name || '').toLowerCase() === configuredStoreName.toLowerCase())

  if (!store) throw new Error(`No encontramos la tienda ${configuredStoreName} en Gelato.`)

  const listPayload = await gelatoGet(`${GELATO_STORES_URL}/${store.id}/products?offset=0&limit=100`, apiKey)
  const listedProducts = Array.isArray(listPayload?.products) ? listPayload.products : []
  const detailedProducts = await Promise.all(listedProducts.map(product => (
    gelatoGet(`${GELATO_STORES_URL}/${store.id}/products/${product.id}`, apiKey)
  )))

  const catalog = {}
  const productGroups = await Promise.all(detailedProducts.map(async product => {
    const presentation = getPresentation(product)
    if (!presentation) return []

    const optionGroups = getOptionDefinitions(product)

    const variants = (Array.isArray(product.variants) ? product.variants : [])
      .filter(variant => variant.connectionStatus === 'connected' && variant.productUid && !variant.isHidden)
      .map(variant => {
        const sku = `gelato:${product.id}:${variant.id}`
        const selections = getVariantSelections(variant, optionGroups)
        const configuredFiles = Array.isArray(presentation.files)
          ? presentation.files
          : [{ type: presentation.fileType || 'default', url: presentation.fileUrl }]
        const files = configuredFiles.filter(file => file?.url)
        // En el flujo manual basta con que la variante esté conectada en la
        // Custom Store. Los archivos imprimibles permanecen dentro de Gelato.
        const available = presentation.orderable !== false
        if (files.length > 0) catalog[sku] = { productUid: variant.productUid, files }
        return {
          label: optionGroups.map(group => selections[group.name]).filter(Boolean).join(' / ') || 'Única',
          selections,
          sku,
          available,
        }
      })
      .sort((first, second) => variantRank(first.selections, optionGroups) - variantRank(second.selections, optionGroups) || first.label.localeCompare(second.label))

    if (!variants.length) return []

    const images = await getProductImages(product, presentation)

    return [{
      id: product.id,
      name: presentation.name || product.title || presentation.shortName,
      shortName: presentation.shortName,
      eyebrow: presentation.eyebrow,
      description: presentation.description || stripHtml(product.description),
      price: presentation.price,
      currency: 'CHF',
      image: images[0]?.url || presentation.imageFallback,
      images,
      imageFallback: presentation.imageFallback,
      imageAlt: presentation.imageAlt,
      category: presentation.category || 'otros',
      optionLabel: optionGroups.map(group => group.name).join(' / ') || presentation.optionLabel || 'Opción',
      optionGroups,
      options: variants,
      variants,
      material: presentation.material,
      accent: presentation.accent,
      gelatoStatus: product.status,
      orderable: variants.some(variant => variant.available),
      availabilityMessage: presentation.availabilityMessage,
    }]
  }))
  const products = productGroups.flat()

  const value = { store: { id: store.id, name: store.name }, products, catalog }
  storefrontCache = { expiresAt: Date.now() + STOREFRONT_CACHE_MS, value }
  return value
}

function clean(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength)
}

function normalizeAddress(input = {}) {
  const address = {
    firstName: clean(input.firstName, 25),
    lastName: clean(input.lastName, 25),
    addressLine1: clean(input.addressLine1, 35),
    addressLine2: clean(input.addressLine2, 35),
    city: clean(input.city, 30),
    postCode: clean(input.postCode, 15),
    country: 'CH',
    email: clean(input.email, 120).toLowerCase(),
    phone: clean(input.phone, 25),
  }

  const required = ['firstName', 'lastName', 'addressLine1', 'city', 'postCode', 'email']
  if (required.some(field => !address[field])) throw new Error('Completa todos los campos obligatorios de la dirección.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address.email)) throw new Error('Introduce un email válido.')
  return Object.fromEntries(Object.entries(address).filter(([, value]) => value !== ''))
}

function normalizeItems(input, catalog) {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_ITEMS) {
    throw new Error('La bolsa no contiene una selección válida.')
  }

  return input.map((item, index) => {
    const sku = clean(item?.sku, 80)
    const quantity = Number.parseInt(item?.quantity, 10)
    const configured = catalog[sku]

    if (!configured?.productUid) throw new Error(`La variante ${sku || index + 1} todavía no está disponible.`)
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) throw new Error('La cantidad seleccionada no es válida.')

    const files = Array.isArray(configured.files)
      ? configured.files
      : configured.fileUrl
        ? [{ type: configured.fileType || 'default', url: configured.fileUrl }]
        : []

    if (!files.length || files.some(file => !file?.url || !/^https:\/\//i.test(file.url))) {
      throw new Error(`Falta el archivo de impresión para ${sku}.`)
    }

    return {
      itemReferenceId: `club-${sku}-${index + 1}`,
      productUid: configured.productUid,
      files: files.map(file => ({ type: file.type || 'default', url: file.url })),
      quantity,
    }
  })
}

function makeReference(prefix) {
  const random = globalThis.crypto?.randomUUID?.().slice(0, 8) || Math.random().toString(36).slice(2, 10)
  return `${prefix}-${Date.now()}-${random}`
}

async function gelatoRequest(url, apiKey, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey,
    },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    const detail = payload?.message || payload?.error?.message || payload?.error
    const error = new Error(typeof detail === 'string' ? detail : 'Gelato no pudo procesar la solicitud.')
    error.statusCode = response.status >= 500 ? 502 : 400
    throw error
  }
  return payload
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')

  const action = Array.isArray(req.query?.action) ? req.query.action[0] : req.query?.action
  const isProductsRequest = req.method === 'GET' && action === 'products'

  if (req.method !== 'POST' && !isProductsRequest) {
    res.setHeader('Allow', 'GET, POST')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  if (req.body?.website) {
    res.status(400).json({ error: 'Solicitud no válida.' })
    return
  }

  const apiKey = process.env.GELATO_API_KEY
  if (!apiKey) {
    res.status(503).json({ error: 'La tienda está casi lista. Falta conectar la cuenta de producción de Gelato.' })
    return
  }

  try {
    if (isProductsRequest) {
      const storefront = await getStorefront(apiKey)
      res.status(200).json({ store: storefront.store, products: storefront.products })
      return
    }

    const baseCatalog = getBaseCatalog()
    const storefront = await getStorefront(apiKey).catch(() => ({ catalog: {} }))
    const catalog = { ...baseCatalog, ...storefront.catalog }
    const address = normalizeAddress(req.body?.address)
    const items = normalizeItems(req.body?.items, catalog)

    if (action === 'quote') {
      const orderReferenceId = makeReference('latido-club-quote')
      const payload = await gelatoRequest(GELATO_QUOTE_URL, apiKey, {
        orderReferenceId,
        customerReferenceId: makeReference('latido-club-customer'),
        currency: 'CHF',
        allowMultipleQuotes: false,
        recipient: address,
        products: items,
      })

      const quotes = Array.isArray(payload.quotes) ? payload.quotes.map(quote => ({
        id: quote.id,
        fulfillmentCountry: quote.fulfillmentCountry,
        products: quote.products,
        shipmentMethods: quote.shipmentMethods,
      })) : []
      res.status(200).json({ orderReferenceId, quotes })
      return
    }

    if (action === 'order') {
      const shipmentMethodUid = clean(req.body?.shipmentMethodUid, 100)
      if (!shipmentMethodUid) throw new Error('Selecciona un método de envío.')

      const reference = makeReference('latido-club')
      const payload = await gelatoRequest(GELATO_ORDER_URL, apiKey, {
        orderType: 'draft',
        orderReferenceId: reference,
        customerReferenceId: makeReference('latido-club-customer'),
        currency: 'CHF',
        items,
        shipmentMethodUid,
        shippingAddress: address,
        metadata: [
          { key: 'storefront', value: 'latido-club' },
          { key: 'workflow', value: 'awaiting-payment' },
        ],
      })

      res.status(201).json({ id: payload.id, reference, status: 'draft' })
      return
    }

    res.status(400).json({ error: 'Acción no válida.' })
  } catch (error) {
    const configurationError = /catalog|archivo de impresión|variante/i.test(error?.message || '')
    res.status(error?.statusCode || (configurationError ? 503 : 400)).json({
      error: configurationError
        ? 'Esta variante todavía no está conectada al catálogo de Gelato.'
        : error?.message || 'No pudimos procesar la solicitud.',
    })
  }
}
