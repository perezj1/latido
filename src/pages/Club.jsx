import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Heart,
  Leaf,
  LoaderCircle,
  Maximize2,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import './Club.css'

const CART_STORAGE_KEY = 'latido-club-cart-v1'

const COLOR_SWATCHES = {
  blanco: '#ffffff',
  natural: '#e8d9bb',
  arena: '#d6c3a5',
  ash: '#c8c9c5',
  'ring spun sports grey': '#b8bab5',
  negro: '#171717',
  unico: '#eef1f7',
}

const OPTION_VALUE_LABELS = {
  ash: 'Gris claro',
  'ring spun sports grey': 'Gris jaspeado',
}

const optionValueLabel = value => String(value || '')
  .split(' / ')
  .map(part => OPTION_VALUE_LABELS[part.toLowerCase()] || part)
  .join(' / ')

const CATEGORY_FILTERS = [
  { id: 'camisetas', label: 'Camisetas' },
  { id: 'sudaderas', label: 'Sudaderas' },
  { id: 'bolsas', label: 'Bolsas' },
  { id: 'carcasas', label: 'Carcasas' },
]

const productPurchaseType = product => (
  product?.purchaseType === 'addon' || ['bolsas', 'carcasas'].includes(product?.category)
    ? 'addon'
    : 'base'
)

const cartHasGarment = cart => cart.some(item => item.purchaseType !== 'addon')

const COLOR_ORDER = ['Blanco', 'Natural', 'Arena', 'Ash', 'ring spun sports grey', 'Negro', 'Único']

const normalizeKey = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')

function productColors(product) {
  const colorGroup = product.optionGroups?.find(group => group.name.toLowerCase().includes('color'))
  if (colorGroup?.values?.length) return colorGroup.values

  const variantColors = [...new Set((product.variants || [])
    .map(variant => Object.entries(variant.selections || {}).find(([name]) => name.toLowerCase().includes('color'))?.[1])
    .filter(Boolean))]
  if (variantColors.length) return variantColors

  const description = `${product.name || ''} ${product.description || ''} ${product.image || ''} ${product.imageFallback || ''}`.toLowerCase()
  if (/\bnegra\b/.test(description)) return ['Negro']
  if (/\bblanca\b/.test(description)) return ['Blanco']
  if (product.category === 'bolsas' || /\bnatural\b/.test(description)) return ['Natural']
  return ['Único']
}

function productDesign(product) {
  if (product.category === 'carcasas') {
    const label = product.shortName || product.name
    return {
      id: `carcasa-${product.id}`,
      label,
      family: label,
    }
  }

  const cafeInk = String(product.name || '').match(/texto\s+(.+)$/i)?.[1]
  if (cafeInk) {
    return {
      id: `cafe-${normalizeKey(cafeInk)}`,
      label: `Café · Texto ${cafeInk.toLowerCase()}`,
      family: 'Café 6.50 CHF',
    }
  }

  const label = product.eyebrow || product.shortName || product.name
  return { id: normalizeKey(label), label, family: label }
}

function productSupportsColor(product, color) {
  return productColors(product).some(value => value === color)
}

const CLUB_DESIGNS = [
  {
    id: 'hablas-espanol',
    name: '¿Tú también hablas español?',
    image: '/club/products/hablas-espanol-granate-trasera.webp',
    alt: 'Diseño tipográfico granate ¿Tú también hablas español? de Latido Club',
    tone: '#F4F2EE',
  },
  {
    id: 'logo',
    name: 'Firma Latido Club',
    image: '/brand/latido-horizontal-black.webp',
    alt: 'Firma horizontal de Latido Club con corazón multicolor',
    tone: '#E8F1FF',
  },
  {
    id: 'latido-logo-camiseta',
    name: 'Símbolo Latido · Tu estilo también habla español',
    image: '/club/designs/latido-logo-camiseta.webp',
    alt: 'Símbolo multicolor de Latido Club con el lema Tu estilo también habla español',
    tone: '#E9FAF7',
  },
  {
    id: 'cafe',
    name: 'Café 6.50 CHF · Te despierta el precio',
    image: '/club/designs/cafe-trasera-negro-v2.png',
    alt: 'Diseño negro Café 6.50 CHF, te despierta el precio, de Latido Club',
    tone: '#ECEEF1',
  },
]

const hablasFallbackMockups = ({ colorLabel, garment, selection, exactFront, exactBack }) => {
  const selections = { Color: selection }
  const base = `/club/products/camiseta-base-${garment}.webp`
  return [
    exactFront
      ? { url: exactFront, label: `Frontal · ${colorLabel}`, selections }
      : {
          url: base,
          base,
          overlay: '/club/products/hablas-espanol-granate-frontal.webp',
          placement: 'hablas-front',
          label: `Frontal · ${colorLabel}`,
          selections,
        },
    exactBack
      ? { url: exactBack, label: `Trasera · ${colorLabel}`, selections }
      : {
          url: base,
          base,
          overlay: '/club/products/hablas-espanol-granate-trasera.webp',
          placement: 'hablas-back',
          label: `Trasera · ${colorLabel}`,
          selections,
        },
  ]
}

const HABLAS_FALLBACK_VARIANTS = [
  ['Blanco', 'S', '11ef009f-2859-4c9b-99ac-2819cc3cdfbc'],
  ['Blanco', 'M', '08b7a5de-37f5-471b-9f98-eab0ad3693fe'],
  ['Blanco', 'L', '2b498b98-1c0d-4af7-b90b-5a507ed3e18b'],
  ['Blanco', 'XL', 'c30ed3fb-af5d-4bca-86fd-b0eb7aef7924'],
  ['Blanco', '2XL', '07b3a9ea-1594-4264-81b9-20e6bb1672bc'],
  ['Natural', 'S', 'b88b4e79-9236-43c2-abe3-1ad8228e39ba'],
  ['Natural', 'M', '8c0b726b-5508-4c20-a826-bfd398a8c4bc'],
  ['Natural', 'L', 'ad5ad3ca-5a0e-4558-8e61-be8ce88f6038'],
  ['Natural', 'XL', '347e5c99-378d-4250-8909-09677d31ad53'],
  ['Natural', '2XL', '9aba98a6-b4fc-45f7-98cc-08151bbbfd8b'],
  ['Ash', 'S', 'fad51b09-58a1-4ba6-9229-2ff4c41df588'],
  ['Ash', 'M', '6d329ab4-93d4-41c5-bd3a-952094b6ce76'],
  ['Ash', 'L', 'dcd814d6-08e4-4cdf-9e72-c29556ad28e1'],
  ['Ash', 'XL', '4a73574b-b2f5-4475-8308-6aedcb83634d'],
  ['Ash', '2XL', 'd0960900-6dfe-4a4f-9aff-0be102931ddc'],
  ['Negro', 'S', '4cac5cfd-06e2-4aa3-82aa-ae6e59cf5b66'],
  ['Negro', 'M', '45367cbe-e854-43b1-bdce-67a9411ae053'],
  ['Negro', 'L', 'e9257c82-a216-4a52-958d-5d5a4d4f9ba1'],
  ['Negro', 'XL', 'f96f811c-83d0-41a8-9230-47e5db0fc0bd'],
  ['Negro', '2XL', 'b4dda10f-4f43-44bc-80aa-44a31028ffe6'],
].map(([color, size, id]) => ({
  label: `${color} / ${size}`,
  selections: { Color: color, Talla: size },
  sku: `gelato:c1b3d3ef-dd71-4d78-8712-4d7fea26880b:${id}`,
  available: true,
}))

const FALLBACK_PRODUCTS = [
  {
    id: 'c1b3d3ef-dd71-4d78-8712-4d7fea26880b',
    category: 'camisetas',
    name: 'Camiseta ¿Tú también hablas español?',
    shortName: 'Camiseta Hablas Español',
    eyebrow: 'Diseño tipográfico',
    description: 'Camiseta unisex de algodón de alto gramaje: mensaje minimalista delante y diseño granate grande en la espalda.',
    price: 36.9,
    compareAtPrice: 39.9,
    image: '/club/products/camiseta-hablas-blanca-frontal.webp',
    images: [
      ...hablasFallbackMockups({
        colorLabel: 'Blanco',
        garment: 'blanca',
        selection: 'Blanco',
        exactFront: '/club/products/camiseta-hablas-blanca-frontal.webp',
        exactBack: '/club/camiseta-hablas-espanol-espalda.png?v=2',
      }),
      ...hablasFallbackMockups({ colorLabel: 'Natural', garment: 'natural', selection: 'Natural' }),
      ...hablasFallbackMockups({ colorLabel: 'Gris claro', garment: 'gris', selection: 'Ash' }),
      ...hablasFallbackMockups({ colorLabel: 'Negro', garment: 'negra', selection: 'Negro' }),
    ],
    imageFallback: '/club/products/camiseta-hablas-blanca-frontal.webp',
    imageAlt: 'Camiseta con diseño granate de Latido Club',
    optionLabel: 'Color / Talla',
    optionGroups: [
      { name: 'Color', values: ['Blanco', 'Natural', 'Ash', 'Negro'] },
      { name: 'Talla', values: ['S', 'M', 'L', 'XL', '2XL'] },
    ],
    variants: HABLAS_FALLBACK_VARIANTS,
    material: 'Algodón de alto gramaje',
    accent: '#2161E8',
  },
  {
    id: 'bd807369-b74d-483d-9065-fb994ca7bb38',
    category: 'bolsas',
    name: 'Bolsa ¿Tú también hablas español?',
    shortName: 'Bolsa Hablas Español',
    eyebrow: 'Diseño tipográfico',
    description: 'Bolsa de algodón natural con el diseño granate, asas largas, costuras reforzadas y 10 litros de capacidad.',
    price: 24.9,
    purchaseType: 'addon',
    image: '/club/totebag-hablas-espanol-granate.jpg',
    images: [{ url: '/club/totebag-hablas-espanol-granate.jpg', label: 'Frontal' }],
    imageFallback: '/club/totebag-hablas-espanol-granate.jpg',
    imageAlt: 'Bolsa de tela natural Hablas Español de Latido Club',
    optionLabel: 'Color',
    options: [
      { label: 'Natural', sku: 'gelato:bd807369-b74d-483d-9065-fb994ca7bb38:9bb7a9f9-79c9-4bd6-b4e2-8c110c4dc65c' },
    ],
    material: '100% algodón · 10 litros',
    accent: '#9E1B20',
  },
]

const money = value => new Intl.NumberFormat('de-CH', {
  style: 'currency',
  currency: 'CHF',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(value)

function readCart() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function readCheckoutReturn() {
  const params = new URLSearchParams(window.location.search)
  const status = params.get('checkout')
  if (!['success', 'canceled'].includes(status)) return null
  const rawReference = params.get('order') || ''
  return {
    status,
    reference:/^LC-\d{6}$/.test(rawReference) ? rawReference : '',
  }
}

async function functionErrorCode(error, data) {
  if (data?.error) return data.error
  const response = error?.context
  if (response && typeof response.json === 'function') {
    try {
      const payload = await response.json()
      return payload?.error || ''
    } catch {}
  }
  return ''
}

function ProductArtwork({ image, alt, loading = 'lazy', fallback = '' }) {
  const applyFallback = event => {
    if (fallback && event.currentTarget.dataset.fallbackApplied !== 'true') {
      event.currentTarget.dataset.fallbackApplied = 'true'
      event.currentTarget.src = fallback
    }
  }

  if (image.base && image.overlay) {
    return (
      <span className={`club-product-artwork${image.placement ? ` club-product-artwork--${image.placement}` : ''}`}>
        <img
          className="club-product-artwork__base"
          src={image.base}
          alt={alt}
          loading={loading}
          decoding="async"
          onError={applyFallback}
        />
        <img
          className="club-product-artwork__overlay"
          src={image.overlay}
          alt=""
          aria-hidden="true"
          loading={loading}
          decoding="async"
        />
      </span>
    )
  }

  return (
    <img
      src={image.url}
      alt={alt}
      loading={loading}
      decoding="async"
      onError={applyFallback}
    />
  )
}

const isColorGroup = name => String(name || '').toLowerCase().includes('color')

const sortColors = colors => [...colors].sort((first, second) => {
  const firstIndex = COLOR_ORDER.indexOf(first)
  const secondIndex = COLOR_ORDER.indexOf(second)
  return (firstIndex === -1 ? 99 : firstIndex) - (secondIndex === -1 ? 99 : secondIndex)
})

const defaultColor = colors => (colors.includes('Blanco') ? 'Blanco' : colors[0] || '')

function productVariants(product) {
  const source = product.variants?.length ? product.variants : product.options || []
  return source.map(variant => ({
    ...variant,
    selections: variant.selections && Object.keys(variant.selections).length
      ? variant.selections
      : { [product.optionLabel || 'Opción']: variant.label },
  }))
}

function imagesForSelection(product, selections) {
  const all = product.images?.length ? product.images : [{ url: product.image, label: 'Vista del producto' }]
  const matching = all.filter(image => (
    !image.selections
    || Object.entries(image.selections).every(([name, value]) => selections[name] === value)
  ))
  return matching.length ? matching : all
}

// Las vistas traseras muestran el diseño a tamaño completo: son mejores miniaturas.
function designThumb(product, color) {
  const images = imagesForSelection(product, { Color: color })
  return images.find(image => /tras/i.test(image.label || '')) || images[0]
}

const productTitle = product => String(product?.name || '')
  .replace(/\s·\s(colores claros|negra|negro|clara)$/i, '')

function catalogChoices(products, predicate) {
  const groups = new Map()
  for (const product of products.filter(predicate)) {
    const design = productDesign(product)
    const key = `${product.category}:${design.id}`
    const colors = sortColors(productColors(product))
    const color = defaultColor(colors)
    const existing = groups.get(key)
    const candidate = {
      key,
      categoryId: product.category,
      categoryLabel: product.category === 'sudaderas'
        ? 'Sudadera'
        : product.category === 'camisetas'
          ? 'Camiseta'
          : product.category === 'bolsas'
            ? 'Bolsa'
            : 'Carcasa',
      designId: design.id,
      label: design.label,
      color,
      image: designThumb(product, color),
      price: product.price,
    }
    if (!existing || productSupportsColor(product, 'Blanco')) groups.set(key, candidate)
  }
  return [...groups.values()]
}

function cartLine(product, option, image) {
  return {
    sku: option.sku,
    productId: product.id,
    name: product.name,
    shortName: product.shortName,
    image,
    option: optionValueLabel(option.label),
    optionLabel: Object.keys(option.selections || {}).join(' / ') || product.optionLabel,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    purchaseType: productPurchaseType(product),
    quantity: 1,
  }
}

function addCartLine(cart, line) {
  const existing = cart.find(item => item.sku === line.sku)
  if (!existing) return [...cart, line]
  return cart.map(item => item.sku === line.sku
    ? { ...item, quantity: Math.min(10, item.quantity + 1) }
    : item)
}

function ClubConfigurator({ products, catalogStatus, hasGarment, selectionRequest, onAdd, onPreview }) {
  const [categoryId, setCategoryId] = useState('camisetas')
  const [designId, setDesignId] = useState('')
  const [color, setColor] = useState('')
  const [choices, setChoices] = useState({})
  const [imageIndex, setImageIndex] = useState(0)
  const [attempted, setAttempted] = useState(false)
  const [justAdded, setJustAdded] = useState(false)
  const [pendingAddon, setPendingAddon] = useState(null)
  const galleryRef = useRef(null)
  const optionsRef = useRef(null)

  const categories = useMemo(() => CATEGORY_FILTERS.map(category => {
    const matches = products.filter(product => product.category === category.id)
    const representative = matches.find(product => productSupportsColor(product, 'Blanco')) || matches[0]
    return {
      ...category,
      count: new Set(matches.map(product => productDesign(product).id)).size,
      image: representative ? designThumb(representative, defaultColor(productColors(representative))) : null,
      price: matches.length ? Math.min(...matches.map(product => product.price)) : 0,
    }
  }), [products])

  const garmentChoices = useMemo(() => (
    catalogChoices(products, item => productPurchaseType(item) === 'base')
  ), [products])

  const designs = useMemo(() => {
    const groups = new Map()
    for (const product of products.filter(item => item.category === categoryId)) {
      const design = productDesign(product)
      if (!groups.has(design.id)) groups.set(design.id, { ...design, products: [] })
      groups.get(design.id).products.push(product)
    }
    return [...groups.values()].map(design => ({
      ...design,
      colors: sortColors(new Set(design.products.flatMap(productColors))),
    }))
  }, [categoryId, products])

  const design = designs.find(item => item.id === designId)
    || designs.find(item => item.colors.includes('Blanco'))
    || designs[0]
  const activeColor = design?.colors.includes(color) ? color : defaultColor(design?.colors || [])
  const product = design?.products.find(item => productSupportsColor(item, activeColor)) || design?.products[0]

  const variants = useMemo(() => {
    if (!product) return []
    const all = productVariants(product)
    const matching = all.filter(variant => Object.entries(variant.selections)
      .some(([name, value]) => isColorGroup(name) && value === activeColor))
    return matching.length ? matching : all
  }, [activeColor, product])

  const optionGroups = useMemo(() => {
    if (!product) return []
    const groups = product.optionGroups?.length
      ? product.optionGroups
      : [{ name: product.optionLabel || 'Opción', values: [...new Set(variants.map(variant => variant.label))] }]
    return groups
      .filter(group => !isColorGroup(group.name))
      .map(group => ({
        ...group,
        values: group.values.filter(value => variants.some(variant => variant.selections[group.name] === value)),
      }))
      .filter(group => group.values.length)
  }, [product, variants])

  const resolved = Object.fromEntries(optionGroups.map(group => [
    group.name,
    group.values.length === 1 ? group.values[0] : (group.values.includes(choices[group.name]) ? choices[group.name] : ''),
  ]))
  const missingGroup = optionGroups.find(group => !resolved[group.name])
  const selectedVariant = missingGroup ? null : variants.find(variant => (
    optionGroups.every(group => variant.selections[group.name] === resolved[group.name])
  ))
  const orderable = product?.orderable !== false && selectedVariant?.available !== false
  const isAddon = productPurchaseType(product) === 'addon'
  const canAdd = orderable && (!isAddon || hasGarment)
  const images = product ? imagesForSelection(product, { Color: activeColor, ...resolved }) : []
  const currentImage = images[Math.min(imageIndex, images.length - 1)]

  useEffect(() => {
    setImageIndex(0)
    galleryRef.current?.scrollTo({ left: 0 })
  }, [product?.id, activeColor])

  useEffect(() => {
    if (!justAdded) return undefined
    const timer = setTimeout(() => setJustAdded(false), 2200)
    return () => clearTimeout(timer)
  }, [justAdded])

  useEffect(() => {
    if (!selectionRequest) return
    setCategoryId(selectionRequest.categoryId)
    setDesignId(selectionRequest.designId)
    setColor(selectionRequest.color)
    setChoices({})
    setPendingAddon(null)
    setAttempted(false)
  }, [selectionRequest])

  const chooseCategory = id => {
    setCategoryId(id)
    setDesignId('')
    setAttempted(false)
    if (['bolsas', 'carcasas'].includes(id)) setPendingAddon(null)
  }

  const chooseGarment = garment => {
    if (!selectedVariant) {
      setAttempted(true)
      optionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      optionsRef.current?.querySelector('button:not(:disabled), select')?.focus({ preventScroll: true })
      return
    }
    const addonImage = images.find(image => image.url && !image.overlay)?.url
      || images[0]?.base
      || product.image
    setPendingAddon({ product, option: selectedVariant, image: addonImage })
    setCategoryId(garment.categoryId)
    setDesignId(garment.designId)
    setColor(garment.color)
    setChoices({})
    setAttempted(false)
  }

  const chooseDesign = id => {
    setDesignId(id)
    setAttempted(false)
  }

  const chooseOption = (groupName, value) => {
    setChoices(current => ({ ...current, [groupName]: value }))
  }

  const isValueAvailable = (groupName, value) => variants.some(variant => (
    variant.selections[groupName] === value && variant.available !== false
  ))

  const showImage = index => {
    const nextIndex = Math.max(0, Math.min(images.length - 1, index))
    setImageIndex(nextIndex)
    const gallery = galleryRef.current
    if (gallery) gallery.scrollTo({ left: gallery.clientWidth * nextIndex, behavior: 'smooth' })
  }

  const updateImageFromScroll = event => {
    const gallery = event.currentTarget
    if (gallery.clientWidth) setImageIndex(Math.round(gallery.scrollLeft / gallery.clientWidth))
  }

  const handleAdd = () => {
    if (isAddon && !hasGarment) {
      toast.error('Añade primero una camiseta o sudadera para elegir este complemento.')
      return
    }
    if (!selectedVariant) {
      setAttempted(true)
      optionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      optionsRef.current?.querySelector('button:not(:disabled), select')?.focus({ preventScroll: true })
      return
    }
    const cartImage = images.find(image => image.url && !image.overlay)?.url
      || images[0]?.base
      || product.image
    const added = onAdd(product, selectedVariant, cartImage, isAddon ? null : pendingAddon)
    if (added !== false) {
      setPendingAddon(null)
      setJustAdded(true)
    }
  }

  if (!design || !product) {
    return (
      <div className="club-config club-config--empty">
        <LoaderCircle className="club-spin" size={20} /> Cargando la colección…
      </div>
    )
  }

  const categoryLabel = CATEGORY_FILTERS.find(category => category.id === categoryId)?.label || ''
  const summary = [
    categoryLabel.replace(/s$/, ''),
    design.colors.length > 1 || activeColor !== 'Único' ? optionValueLabel(activeColor) : '',
    ...optionGroups.filter(group => group.values.length > 1).map(group => resolved[group.name]),
  ].filter(Boolean)

  let buttonLabel = isAddon
    ? `Añadir como complemento · +${money(product.price)}`
    : `Añadir a la bolsa · ${money(product.price)}`
  if (!orderable) buttonLabel = product.availabilityMessage || 'Disponible próximamente'
  else if (isAddon && !hasGarment) buttonLabel = 'Añade primero una camiseta o sudadera'
  else if (missingGroup) buttonLabel = `Elige tu ${missingGroup.name.toLowerCase()} para continuar`
  else if (pendingAddon && !isAddon) buttonLabel = `Añadir los dos · ${money(product.price + pendingAddon.product.price)}`
  else if (justAdded) buttonLabel = 'Añadido a tu bolsa'

  return (
    <div className="club-shop">
      <div className="club-shop__tabs" role="tablist" aria-label="Tipo de artículo">
        {categories.map(category => (
          <button
            key={category.id}
            type="button"
            role="tab"
            aria-selected={categoryId === category.id}
            className={categoryId === category.id ? 'is-selected' : ''}
            disabled={category.count === 0}
            onClick={() => chooseCategory(category.id)}
          >
            <span className="club-shop__tab-image">
              {category.image && <ProductArtwork image={category.image} alt="" />}
            </span>
            <span className="club-shop__tab-copy">
              <strong>{category.label}</strong>
              <small>
                {category.count} {category.count === 1 ? 'diseño' : 'diseños'} · {['bolsas', 'carcasas'].includes(category.id) ? `+${money(category.price)} con tu prenda` : money(category.price)}
              </small>
            </span>
          </button>
        ))}
      </div>

      <div className="club-config" style={{ '--club-accent': product.accent || 'var(--club-blue)' }}>
        <div className="club-config__stage">
          <div className="club-config__media">
            <span className="club-config__badge">{product.eyebrow}</span>
            <div
              ref={galleryRef}
              className="club-config__gallery"
              onScroll={updateImageFromScroll}
              aria-label={`Galería de ${product.shortName}`}
            >
              {images.map((image, index) => (
                <button
                  key={`${product.id}:${activeColor}:${image.label}:${index}`}
                  type="button"
                  className="club-config__slide"
                  onClick={() => onPreview({ images, imageIndex: index, title: productTitle(product), alt: product.imageAlt })}
                  aria-label={`Ampliar vista ${String(image.label || '').toLowerCase()}`}
                >
                  <ProductArtwork
                    image={image}
                    alt={`${product.imageAlt} · ${image.label}`}
                    loading={index === 0 ? 'eager' : 'lazy'}
                    fallback={product.imageFallback}
                  />
                </button>
              ))}
            </div>
            <span className="club-config__zoom" aria-hidden="true"><Maximize2 size={14} /> Ampliar</span>
            {images.length > 1 && (
              <>
                <button type="button" className="club-config__arrow club-config__arrow--previous" onClick={() => showImage(imageIndex - 1)} disabled={imageIndex === 0} aria-label="Imagen anterior">
                  <ChevronLeft size={18} />
                </button>
                <button type="button" className="club-config__arrow club-config__arrow--next" onClick={() => showImage(imageIndex + 1)} disabled={imageIndex >= images.length - 1} aria-label="Imagen siguiente">
                  <ChevronRight size={18} />
                </button>
              </>
            )}
          </div>
          {images.length > 1 && (
            <div className="club-config__thumbs" aria-label="Vistas del producto">
              {images.map((image, index) => (
                <button
                  key={`${image.label}:${index}`}
                  type="button"
                  className={index === imageIndex ? 'is-selected' : ''}
                  onClick={() => showImage(index)}
                  aria-label={`Mostrar vista ${String(image.label || '').toLowerCase()}`}
                  aria-current={index === imageIndex ? 'true' : undefined}
                >
                  <ProductArtwork image={image} alt="" />
                  <span>{String(image.label || '').split(' · ')[0]}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="club-config__panel">
          <div className="club-config__heading">
            <p>{product.material}</p>
            <h3>{productTitle(product)}</h3>
            <div className="club-config__price">
              <strong>{isAddon ? '+' : ''}{money(product.price)}</strong>
              {Number(product.compareAtPrice) > Number(product.price) && (
                <del>{money(product.compareAtPrice)}</del>
              )}
              <span>{isAddon ? 'Complemento para tu camiseta o sudadera' : 'Precio de lanzamiento · IVA y envío a Suiza incluidos'}</span>
            </div>
            {isAddon && (
              <p className="club-config__addon-note">
                Solo se vende junto a una camiseta o sudadera: producirlo y enviarlo por separado encarecería demasiado su precio.
              </p>
            )}
            {currentImage && product.description && <p className="club-config__description">{product.description}</p>}
          </div>

          {designs.length > 1 && (
            <fieldset className="club-config__group">
              <legend><span>Diseño</span><b>{design.label}</b></legend>
              <div className="club-config__designs" role="radiogroup" aria-label="Diseño">
                {designs.map(item => {
                  const itemProduct = item.products.find(entry => productSupportsColor(entry, activeColor)) || item.products[0]
                  const itemColor = item.colors.includes(activeColor) ? activeColor : defaultColor(item.colors)
                  const selected = item.id === design.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={selected ? 'is-selected' : ''}
                      onClick={() => chooseDesign(item.id)}
                      title={item.label}
                    >
                      <span className="club-config__design-image">
                        <ProductArtwork image={designThumb(itemProduct, itemColor)} alt="" />
                        {selected && <i><Check size={12} strokeWidth={3} /></i>}
                      </span>
                      <span className="club-config__design-name">{item.label}</span>
                    </button>
                  )
                })}
              </div>
            </fieldset>
          )}

          {design.colors.length > 0 && activeColor !== 'Único' && (
            <fieldset className="club-config__group">
              <legend><span>Color</span><b>{optionValueLabel(activeColor)}</b></legend>
              <div className="club-config__swatches" role="radiogroup" aria-label="Color">
                {design.colors.map(value => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={activeColor === value}
                    aria-label={optionValueLabel(value)}
                    title={optionValueLabel(value)}
                    className={activeColor === value ? 'is-selected' : ''}
                    onClick={() => setColor(value)}
                    style={{ '--swatch-color': COLOR_SWATCHES[value.toLowerCase()] || '#dce2eb' }}
                  >
                    <i />
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          <div ref={optionsRef}>
            {optionGroups.filter(group => group.values.length > 1).map(group => {
              const needsChoice = attempted && !resolved[group.name]
              return (
                <fieldset className={`club-config__group${needsChoice ? ' needs-choice' : ''}`} key={group.name}>
                  <legend>
                    <span>{group.name}</span>
                    <b>{resolved[group.name] || `Elige tu ${group.name.toLowerCase()}`}</b>
                  </legend>
                  {group.values.length > 8 ? (
                    <div className="club-config__select">
                      <select
                        value={resolved[group.name]}
                        onChange={event => chooseOption(group.name, event.target.value)}
                        aria-label={group.name}
                        aria-invalid={needsChoice || undefined}
                      >
                        <option value="" disabled>Elige tu {group.name.toLowerCase()}</option>
                        {group.values.map(value => (
                          <option key={value} value={value} disabled={!isValueAvailable(group.name, value)}>{optionValueLabel(value)}</option>
                        ))}
                      </select>
                      <ChevronRight size={16} aria-hidden="true" />
                    </div>
                  ) : (
                    <div className="club-config__sizes" role="radiogroup" aria-label={group.name}>
                      {group.values.map(value => (
                        <button
                          key={value}
                          type="button"
                          role="radio"
                          aria-checked={resolved[group.name] === value}
                          className={resolved[group.name] === value ? 'is-selected' : ''}
                          disabled={!isValueAvailable(group.name, value)}
                          onClick={() => chooseOption(group.name, value)}
                        >
                          {optionValueLabel(value)}
                        </button>
                      ))}
                    </div>
                  )}
                  {needsChoice && <p className="club-config__hint" role="alert">Selecciona tu {group.name.toLowerCase()} para añadir el artículo a la bolsa.</p>}
                </fieldset>
              )
            })}
          </div>

          <div className="club-config__checkout">
            {pendingAddon && !isAddon && (
              <div className="club-pending-addon" role="status">
                <span className="club-pending-addon__image">
                  <ProductArtwork image={{ url: pendingAddon.image }} alt="" />
                </span>
                <span>
                  <small>Se añadirá con tu prenda</small>
                  <b>{pendingAddon.product.shortName}</b>
                  <strong>+{money(pendingAddon.product.price)}</strong>
                </span>
                <button type="button" onClick={() => setPendingAddon(null)} aria-label="Quitar complemento"><X size={15} /></button>
              </div>
            )}
            <p className="club-config__summary" aria-live="polite">
              {summary.map((part, index) => (
                <span key={`${part}:${index}`}>{index > 0 && <ChevronRight size={11} aria-hidden="true" />}{part}</span>
              ))}
            </p>
            {isAddon && !hasGarment && garmentChoices.length ? (
              <div className="club-companion-picker">
                <div className="club-companion-picker__heading">
                  <strong>Combínalo con una prenda</strong>
                  <span>{missingGroup ? `Elige primero tu ${missingGroup.name.toLowerCase()} y después la prenda.` : 'Elige la prenda y después su color y talla. Añadiremos los dos artículos juntos.'}</span>
                </div>
                <div className="club-companion-picker__grid">
                  {garmentChoices.map(garment => (
                    <button key={garment.key} type="button" onClick={() => chooseGarment(garment)}>
                      <span className="club-companion-picker__image">
                        <ProductArtwork image={garment.image} alt="" />
                      </span>
                      <span className="club-companion-picker__copy">
                        <b>{garment.label}</b>
                        <small>{garment.categoryLabel} · {money(garment.price)}</small>
                      </span>
                      <ChevronRight size={16} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <button
                type="button"
                className={`club-add-button${justAdded ? ' is-added' : ''}${missingGroup && orderable ? ' is-pending' : ''}`}
                disabled={!canAdd}
                onClick={handleAdd}
              >
                {justAdded ? <Check size={17} aria-hidden="true" /> : <ShoppingBag size={17} aria-hidden="true" />}
                {buttonLabel}
              </button>
            )}
            <div className="club-config__benefits" aria-label="Ventajas del producto">
              <span><Truck size={15} /><b>Envío incluido</b></span>
              <span><Clock size={15} /><b>Entrega en 10-15 días</b></span>
              <span><ShieldCheck size={15} /><b>Pago seguro con Stripe</b></span>
            </div>
            {catalogStatus === 'loading' && (
              <p className="club-config__sync"><LoaderCircle className="club-spin" size={13} /> Actualizando disponibilidad…</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function PreviewModal({ preview, onClose }) {
  const [imageIndex, setImageIndex] = useState(0)

  useEffect(() => {
    if (!preview) return undefined
    setImageIndex(preview.imageIndex || 0)
    const onKeyDown = event => { if (event.key === 'Escape') onClose() }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [preview, onClose])

  if (!preview) return null

  const images = preview.images?.length
    ? preview.images
    : [{ url: preview.image, label: 'Vista del producto' }]
  const currentImage = images[imageIndex] || images[0]
  const showPrevious = () => setImageIndex(current => (current - 1 + images.length) % images.length)
  const showNext = () => setImageIndex(current => (current + 1) % images.length)

  return (
    <div className="club-preview-layer" role="presentation" onMouseDown={onClose}>
      <section className="club-preview" role="dialog" aria-modal="true" aria-labelledby="club-preview-title" onMouseDown={event => event.stopPropagation()}>
        <header>
          <div>
            <span>Vista ampliada</span>
            <h2 id="club-preview-title">{preview.title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar vista ampliada"><X size={20} /></button>
        </header>
        <div className="club-preview__canvas" style={currentImage.background ? { background: currentImage.background } : undefined}>
          {images.length > 1 && <button type="button" className="club-preview__arrow club-preview__arrow--previous" onClick={showPrevious} aria-label="Vista anterior"><ChevronLeft size={22} /></button>}
            <ProductArtwork image={currentImage} alt={`${preview.alt} · ${currentImage.label}`} />
          {images.length > 1 && <button type="button" className="club-preview__arrow club-preview__arrow--next" onClick={showNext} aria-label="Vista siguiente"><ChevronRight size={22} /></button>}
        </div>
        {images.length > 1 && (
          <div className="club-preview__views" aria-label="Vistas del producto">
            {images.map((image, index) => (
              <button key={`${image.label}:${index}`} type="button" className={index === imageIndex ? 'is-selected' : ''} onClick={() => setImageIndex(index)}>
                  <ProductArtwork image={image} alt="" />
                <span>{image.label}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function QuantityControl({ item, onChange }) {
  return (
    <div className="club-quantity" aria-label={`Cantidad de ${item.name}`}>
      <button type="button" onClick={() => onChange(item.sku, item.quantity - 1)} aria-label="Restar una unidad">
        <Minus size={14} aria-hidden="true" />
      </button>
      <span aria-live="polite">{item.quantity}</span>
      <button type="button" onClick={() => onChange(item.sku, item.quantity + 1)} aria-label="Añadir una unidad">
        <Plus size={14} aria-hidden="true" />
      </button>
    </div>
  )
}

function CartSuggestionShelf({ title, choices, onChoose }) {
  if (!choices.length) return null
  return (
    <section className="club-cart-suggestions">
      <h4>{title}</h4>
      <div>
        {choices.map(choice => (
          <button key={choice.key} type="button" onClick={() => onChoose(choice)}>
            <span><ProductArtwork image={choice.image} alt="" /></span>
            <b>{choice.label}</b>
            <small>{choice.categoryLabel} · {choice.categoryId === 'bolsas' || choice.categoryId === 'carcasas' ? '+' : ''}{money(choice.price)}</small>
          </button>
        ))}
      </div>
    </section>
  )
}

function CartDrawer({ open, cart, products, onClose, onQuantity, onCheckout, onBrowse }) {
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const hasGarment = cartHasGarment(cart)
  const hasOrphanAddon = cart.some(item => item.purchaseType === 'addon') && !hasGarment
  const addonChoices = useMemo(() => (
    catalogChoices(products, item => productPurchaseType(item) === 'addon')
  ), [products])
  const garmentChoices = useMemo(() => (
    catalogChoices(products, item => productPurchaseType(item) === 'base')
  ), [products])

  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = event => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeyDown)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="club-drawer-layer" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <aside className="club-drawer" role="dialog" aria-modal="true" aria-labelledby="club-cart-title">
        <div className="club-drawer__header">
          <div>
            <span>Tu selección</span>
            <h2 id="club-cart-title">Bolsa Club</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar bolsa"><X size={20} /></button>
        </div>

        {cart.length === 0 ? (
          <div className="club-cart-empty">
            <span><ShoppingBag size={28} /></span>
            <h3>Tu bolsa está esperando</h3>
            <p>Elige tu prenda favorita de la nueva colección de Latido Club.</p>
            <button type="button" onClick={onClose}>Ver la colección</button>
          </div>
        ) : (
          <>
            <div className="club-cart-items">
              {cart.map(item => (
                <div className="club-cart-item" key={item.sku}>
                  <img src={item.image} alt="" />
                  <div className="club-cart-item__info">
                    <h3>{item.shortName}</h3>
                    <p>{item.optionLabel}: {optionValueLabel(item.option)}</p>
                    <div>
                      <QuantityControl item={item} onChange={onQuantity} />
                      <strong>{money(item.price * item.quantity)}</strong>
                    </div>
                  </div>
                </div>
              ))}
              <div className="club-cart-next">
                <div>
                  <span>Completa tu pedido</span>
                  <h3>Añade otra prenda o un complemento a juego.</h3>
                </div>
                <CartSuggestionShelf title="Complementos" choices={addonChoices} onChoose={onBrowse} />
                <CartSuggestionShelf title="Más prendas" choices={garmentChoices} onChoose={onBrowse} />
              </div>
            </div>
            <div className="club-drawer__summary">
              <div><span>Total</span><strong>{money(subtotal)}</strong></div>
              <p>IVA y envío a Suiza incluidos · Entrega estimada en 10-15 días.</p>
              {hasOrphanAddon && <p className="club-cart-error">Añade una camiseta o sudadera para poder comprar los complementos.</p>}
              <button type="button" onClick={onCheckout} disabled={hasOrphanAddon}>
                Continuar con el pedido <ChevronRight size={18} />
              </button>
              <small><ShieldCheck size={14} /> Pedido seguro · Producción bajo demanda</small>
            </div>
          </>
        )}
      </aside>
    </div>
  )
}

function CheckoutModal({ open, cart, onClose }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const total = subtotal
  const savings = cart.reduce((sum, item) => (
    Number(item.compareAtPrice) > Number(item.price)
      ? sum + (item.compareAtPrice - item.price) * item.quantity
      : sum
  ), 0)

  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = event => { if (event.key === 'Escape' && !loading) onClose() }
    document.addEventListener('keydown', onKeyDown)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previous
    }
  }, [loading, onClose, open])

  useEffect(() => {
    if (!open) setError('')
  }, [open])

  if (!open) return null

  const items = cart.map(item => ({ sku: item.sku, quantity: item.quantity }))
  const handleCheckout = async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error:invokeError } = await supabase.functions.invoke('create_club_checkout', {
        body:{ items, checkoutRequestId:crypto.randomUUID(), website:'' },
      })
      if (invokeError || !data?.url) {
        const code = await functionErrorCode(invokeError, data)
        const messages = {
          PRODUCT_NOT_AVAILABLE:'Una variante de tu bolsa ya no está disponible. Actualiza la página y vuelve a elegirla.',
          ADDON_REQUIRES_GARMENT:'Las bolsas y carcasas solo pueden comprarse junto con una camiseta o sudadera.',
          CLUB_CATALOG_UNAVAILABLE:'No pudimos comprobar la disponibilidad de los productos. Inténtalo de nuevo en unos minutos.',
          TOO_MANY_CHECKOUTS:'Has iniciado varios pagos. Espera unos minutos antes de volver a intentarlo.',
          CHECKOUT_NOT_CONFIGURED:'El pago seguro todavía no está configurado.',
        }
        throw new Error(messages[code] || 'No pudimos abrir el pago seguro. Inténtalo de nuevo.')
      }
      window.location.assign(data.url)
    } catch (requestError) {
      setError(requestError.message)
      setLoading(false)
    }
  }

  return (
    <div className="club-checkout-layer" role="presentation">
      <section className="club-checkout" role="dialog" aria-modal="true" aria-labelledby="club-checkout-title">
        <header>
          <div>
            <span>Pago y envío seguros</span>
            <h2 id="club-checkout-title">Revisa tu pedido</h2>
          </div>
          <button type="button" onClick={onClose} disabled={loading} aria-label="Cerrar pedido"><X size={20} /></button>
        </header>

        <div className="club-checkout__layout">
          <div className="club-checkout-payment">
            <h3>Así funciona tu compra</h3>
            <ol className="club-checkout-steps">
              <li className="is-current">
                <b>1</b>
                <span><strong>Revisa tu pedido</strong>Comprueba tallas, colores y cantidades: cada prenda se fabrica para ti.</span>
              </li>
              <li>
                <b>2</b>
                <span><strong>Paga de forma segura</strong>En Stripe indicarás tu email, teléfono, dirección de entrega y forma de pago. Latido nunca ve ni guarda los datos de tu tarjeta.</span>
              </li>
              <li>
                <b>3</b>
                <span><strong>Lo fabricamos y te lo enviamos</strong>Con el pago confirmado empezamos la producción. Recibirás tu pedido en un plazo estimado de 10 a 15 días.</span>
              </li>
            </ol>
            <p className="club-checkout-payment__trust"><ShieldCheck size={16} /> Pago cifrado con Stripe · Envío incluido · Entrega en 10-15 días</p>
          </div>

          <aside className="club-order-summary">
            <h3>Resumen</h3>
            {cart.map(item => (
              <div className="club-order-line" key={item.sku}>
                <span>{item.quantity} × {item.shortName}<small>{optionValueLabel(item.option)}</small></span>
                <strong>{money(item.price * item.quantity)}</strong>
              </div>
            ))}
            <div className="club-order-total"><span>Productos</span><strong>{money(subtotal)}</strong></div>
            <div className="club-order-line club-order-line--shipping"><span>Envío a Suiza<small>Entrega estimada en 10-15 días</small></span><strong>Incluido</strong></div>
            <div className="club-grand-total"><span>Total</span><strong>{money(total)}</strong></div>
            {savings > 0 && <p className="club-order-savings">Ahorras {money(savings)} con el precio de lanzamiento.</p>}

            {error && <p className="club-checkout-error" role="alert">{error}</p>}

            <button className="club-order-button" type="button" disabled={loading || !cart.length} onClick={handleCheckout}>
              {loading ? <LoaderCircle className="club-spin" size={18} /> : <CreditCard size={18} />}
              {loading ? 'Abriendo el pago seguro…' : 'Ir al pago seguro'}
            </button>
            <p className="club-order-note"><ShieldCheck size={13} /> Te llevaremos a Stripe para confirmar el pago de {money(total)}.</p>
          </aside>
        </div>
      </section>
    </div>
  )
}

export default function Club() {
  const [cart, setCart] = useState(readCart)
  const [products, setProducts] = useState(FALLBACK_PRODUCTS)
  const [catalogStatus, setCatalogStatus] = useState('loading')
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [preview, setPreview] = useState(null)
  const [selectionRequest, setSelectionRequest] = useState(null)
  const [paymentReturn, setPaymentReturn] = useState(readCheckoutReturn)
  const itemCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart])
  const hasGarment = useMemo(() => cartHasGarment(cart), [cart])

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart))
  }, [cart])

  useEffect(() => {
    if (catalogStatus !== 'connected') return
    setCart(current => {
      const refreshed = current.map(item => {
        const product = products.find(entry => entry.id === item.productId)
        if (!product) return item
        return {
          ...item,
          name: product.name,
          shortName: product.shortName,
          price: product.price,
          compareAtPrice: product.compareAtPrice,
          purchaseType: productPurchaseType(product),
        }
      })
      return cartHasGarment(refreshed)
        ? refreshed
        : refreshed.filter(item => item.purchaseType !== 'addon')
    })
  }, [catalogStatus, products])

  useEffect(() => {
    if (!paymentReturn) return
    if (paymentReturn.status === 'success') setCart([])
    const url = new URL(window.location.href)
    url.searchParams.delete('checkout')
    url.searchParams.delete('order')
    url.searchParams.delete('session_id')
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
  }, [paymentReturn])

  useEffect(() => {
    const controller = new AbortController()

    const loadProducts = async () => {
      try {
        const response = await fetch('/api/gelato?action=products', { signal: controller.signal })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || 'No pudimos actualizar el catálogo.')
        if (Array.isArray(payload.products) && payload.products.length) setProducts(payload.products)
        setCatalogStatus('connected')
      } catch (error) {
        if (error.name !== 'AbortError') setCatalogStatus('fallback')
      }
    }

    loadProducts()
    return () => controller.abort()
  }, [])

  const addToCart = (product, option, image = product.image, bundledAddon = null) => {
    if (product.orderable === false || option.available === false) {
      toast.error(product.availabilityMessage || 'Este producto estará disponible próximamente')
      return false
    }
    const purchaseType = productPurchaseType(product)
    if (purchaseType === 'addon' && !hasGarment) {
      toast.error('Las bolsas y carcasas solo están disponibles junto con una camiseta o sudadera.')
      return false
    }
    if (bundledAddon && (
      bundledAddon.product.orderable === false
      || bundledAddon.option.available === false
      || productPurchaseType(bundledAddon.product) !== 'addon'
    )) {
      toast.error('El complemento seleccionado ya no está disponible.')
      return false
    }
    const lines = [cartLine(product, option, image)]
    if (bundledAddon) {
      lines.push(cartLine(bundledAddon.product, bundledAddon.option, bundledAddon.image))
    }
    setCart(current => {
      return lines.reduce((next, line) => addCartLine(next, line), current)
    })
    setCartOpen(true)
    toast.success(bundledAddon ? 'Prenda y complemento añadidos a tu bolsa' : 'Artículo añadido a tu bolsa')
    return true
  }

  const browseChoice = choice => {
    setSelectionRequest({ ...choice, requestId: Date.now() })
    setCartOpen(false)
    window.setTimeout(() => {
      document.getElementById('coleccion')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  const changeQuantity = (sku, quantity) => {
    let next = quantity <= 0
      ? cart.filter(item => item.sku !== sku)
      : cart.map(item => item.sku === sku ? { ...item, quantity: Math.min(10, quantity) } : item)
    if (!cartHasGarment(next) && next.some(item => item.purchaseType === 'addon')) {
      next = next.filter(item => item.purchaseType !== 'addon')
      toast('También retiramos los complementos porque necesitan una camiseta o sudadera.')
    }
    setCart(next)
  }

  return (
    <div className="club-page">
      <header className="club-nav">
        <div className="club-nav__inner">
          <Link to="/" className="club-back"><ArrowLeft size={17} /> Volver a Latido</Link>
          <Link to="/club" className="club-brand" aria-label="Latido Club, inicio">
            <img src="/brand/latido-horizontal-black.webp" alt="Latido Club" />
          </Link>
          <button type="button" className="club-cart-button" onClick={() => setCartOpen(true)} aria-label={`Abrir bolsa, ${itemCount} artículos`}>
            <ShoppingBag size={18} />
            <span>Bolsa</span>
            {itemCount > 0 && <b>{itemCount}</b>}
          </button>
        </div>
      </header>

      <main>
        {paymentReturn && (
          <section className={`club-payment-return club-payment-return--${paymentReturn.status}`} role="status">
            <div>
              {paymentReturn.status === 'success' ? <Check size={20} /> : <ArrowLeft size={20} />}
              <span>
                <strong>{paymentReturn.status === 'success' ? 'Estamos confirmando tu pago' : 'Pago cancelado'}</strong>
                {paymentReturn.status === 'success'
                  ? `Recibirás la confirmación por email${paymentReturn.reference ? ` del pedido ${paymentReturn.reference}` : ''}. Tu pedido llegará en un plazo estimado de 10 a 15 días.`
                  : 'No se ha realizado ningún cargo. Tu selección sigue en la bolsa.'}
              </span>
              <button type="button" onClick={() => setPaymentReturn(null)} aria-label="Cerrar aviso"><X size={17} /></button>
            </div>
          </section>
        )}
        <section className="club-hero">
          <div className="club-hero__shape club-hero__shape--one" />
          <div className="club-hero__shape club-hero__shape--two" />
          <div className="club-hero__content">
            <p className="club-kicker"><Sparkles size={15} /> Nueva colección · 2026</p>
            <h1><span>Tu estilo</span><span>también habla</span><em>español.</em></h1>
            <p className="club-hero__copy">Camisetas, sudaderas y accesorios creados para llevar contigo el idioma, el humor y las conexiones que te hacen sentir en casa.</p>
            <a href="#coleccion" className="club-hero__cta">Descubrir la colección <ChevronRight size={18} /></a>
            <div className="club-hero__trust">
              <span><Leaf size={16} /> Diseñado por Latido Club</span>
              <span><Truck size={16} /> Producido bajo demanda</span>
            </div>
          </div>
          <div className="club-hero__collage" aria-hidden="true">
            <div className="club-hero-card club-hero-card--shirt"><img src="/club/hero-camiseta-logo-blanca.webp" alt="" /></div>
            <div className="club-hero-card club-hero-card--case"><img src="/club/totebag-hablas-espanol-granate.jpg" alt="" /></div>
            <span className="club-scribble">Diseños con<br />identidad.</span>
          </div>
        </section>

        <section className="club-manifesto" aria-label="El espíritu de Latido Club">
          <p>NO ES MERCH.</p>
          <span>Es una forma de reconocernos.</span>
          <Heart fill="currentColor" size={18} />
        </section>

        <section className="club-designs" aria-labelledby="club-designs-title">
          <div className="club-designs__heading">
            <span>El lenguaje de la colección</span>
            <h2 id="club-designs-title">Diseños para reconocernos.</h2>
            <p>La firma de Latido Club, nuestro símbolo multicolor y mensajes cotidianos que convierten una prenda en el comienzo de una conversación.</p>
          </div>
          <div className="club-designs__grid">
            {CLUB_DESIGNS.map(design => (
              <article key={design.id} className={`club-design-card club-design-card--${design.id}`} style={{ '--design-tone': design.tone }}>
                <button type="button" className="club-design-card__visual" onClick={() => setPreview({ image: design.image, title: design.name, alt: design.alt })} aria-label={`Ampliar ${design.name}`}>
                  <img src={design.image} alt={design.alt} loading="lazy" decoding="async" />
                  <span><Maximize2 size={15} /> Ampliar</span>
                </button>
                <h3>{design.name}</h3>
              </article>
            ))}
          </div>
        </section>

        <section className="club-collection" id="coleccion">
          <div className="club-section-heading">
            <div>
              <span>01 / La colección</span>
              <h2>Elige cómo<br />llevar tu Latido.</h2>
              <p>Elige el artículo, el diseño y el color. Los precios de las prendas incluyen el envío a Suiza.</p>
            </div>
            <div className="club-collection-benefits" aria-label="Ventajas de Latido Club">
              <div><Truck size={22} /><span><strong>Envío incluido</strong><small>En camisetas y sudaderas</small></span></div>
              <div><Leaf size={22} /><span><strong>Calidad premium</strong><small>Impresión duradera</small></span></div>
              <div><Sparkles size={22} /><span><strong>Diseños originales</strong><small>Hechos para conectar</small></span></div>
            </div>
          </div>
          <ClubConfigurator
            products={products}
            catalogStatus={catalogStatus}
            hasGarment={hasGarment}
            selectionRequest={selectionRequest}
            onAdd={addToCart}
            onPreview={setPreview}
          />
          <aside className="club-support-note" aria-labelledby="club-support-title">
            <span className="club-support-note__icon"><Heart fill="currentColor" size={20} aria-hidden="true" /></span>
            <div className="club-support-note__copy">
              <strong id="club-support-title">Tu compra también apoya a la comunidad.</strong>
              <p>Los beneficios de cada pedido ayudan a mantener Latido, la plataforma de la comunidad hispanohablante en Suiza. Y seguimos trabajando para mejorar la calidad y los precios de la colección. ¡Gracias por tu apoyo!</p>
            </div>
            <ul className="club-support-note__list" aria-label="Lo que ayudas a mantener">
              <li><Check size={14} aria-hidden="true" /> Encuentra todo lo que necesitas</li>
              <li><Check size={14} aria-hidden="true" /> Conecta con la comunidad</li>
              <li><Check size={14} aria-hidden="true" /> Vive Suiza más fácil y en español</li>
            </ul>
          </aside>
        </section>

        <section className="club-story">
          <div className="club-story__art">
            <img src="/club/club-lifestyle-horizonte-v4.webp" alt="Persona de espaldas con una camiseta blanca Latido Club mirando el horizonte alpino" loading="lazy" decoding="async" />
            <div className="club-story__caption"><span>LATIDO CLUB</span><strong>Llévalo como lo vives.</strong></div>
          </div>
          <div className="club-story__copy">
            <span>02 / Por qué existe</span>
            <h2>Una colección con propósito.</h2>
            <p>Latido Club nace para celebrar esa sensación de encontrar a alguien que comparte tu idioma, aunque estés lejos de casa.</p>
            <p>Cada pieza se produce solo cuando la pides: menos excedentes y una red de producción que busca fabricar cerca del destino.</p>
            <div className="club-story__points">
              <div><Leaf size={20} /><span><strong>Sin stock innecesario</strong>Producimos una a una.</span></div>
              <div><Truck size={20} /><span><strong>Producción cercana</strong>Fabricamos lo más cerca posible de ti.</span></div>
              <div><Heart size={20} /><span><strong>Hecho para conectar</strong>Diseños que hablan de nosotros.</span></div>
            </div>
          </div>
        </section>

        <section className="club-process">
          <div className="club-section-heading club-section-heading--light">
            <div><span>03 / De aquí a tus manos</span><h2>Hecho cuando tú lo eliges.</h2></div>
            <p>Selecciona producto, color y talla. Tras confirmar el pago, fabricamos tu pedido y lo enviamos a tu dirección en Suiza.</p>
          </div>
          <div className="club-process__steps">
            <div><b>1</b><h3>Eliges</h3><p>Producto, diseño, color, talla o modelo.</p></div>
            <div><b>2</b><h3>Producimos</h3><p>Fabricamos tu pieza bajo demanda.</p></div>
            <div><b>3</b><h3>Recibes</h3><p>Tu pedido llega en un plazo estimado de 10 a 15 días.</p></div>
          </div>
        </section>

        <section className="club-faq">
          <div><span>Antes de pedir</span><h2>Preguntas frecuentes</h2></div>
          <div className="club-faq__list">
            <details><summary>¿Cuánto tarda el envío?<Plus size={18} /></summary><p>El plazo de entrega estimado es de 10 a 15 días desde la confirmación del pago, incluyendo la fabricación bajo demanda y el envío a Suiza. Los envíos no incluyen número de seguimiento: si pasados 15 días no has recibido tu pedido, responde al email de confirmación y lo revisamos.</p></details>
            <details><summary>¿Dónde introduzco mi dirección?<Plus size={18} /></summary><p>Después de revisar la bolsa pasarás al pago seguro de Stripe. Allí indicarás tu email, teléfono y dirección de entrega una sola vez.</p></details>
            <details><summary>¿Dónde se fabrica?<Plus size={18} /></summary><p>Nuestro proveedor asigna cada pedido al centro de producción más cercano al destino, siempre que el producto y el color estén disponibles.</p></details>
            <details><summary>¿Puedo comprar una bolsa o carcasa por separado?<Plus size={18} /></summary><p>Por ahora solo se venden junto a una camiseta o sudadera, porque producirlas y enviarlas por separado encarecería demasiado su precio.</p></details>
            <details><summary>¿Puedo cambiar la talla?<Plus size={18} /></summary><p>Las prendas se producen bajo demanda, por eso conviene revisar bien la talla antes de pagar. Si recibes una pieza con un defecto de producción, escríbenos para revisarlo.</p></details>
          </div>
        </section>
      </main>

      <footer className="club-footer">
        <div><img src="/brand/latido-horizontal-white.webp" alt="Latido Club" /></div>
        <p>Hecho con corazón en Suiza · Producido bajo demanda</p>
        <Link to="/">latido.ch</Link>
      </footer>

      <button type="button" className={`club-floating-cart${itemCount ? ' is-visible' : ''}`} onClick={() => setCartOpen(true)}>
        <ShoppingBag size={18} /><span>Ver bolsa</span><b>{itemCount}</b>
      </button>

      <CartDrawer
        open={cartOpen}
        cart={cart}
        products={products}
        onClose={() => setCartOpen(false)}
        onQuantity={changeQuantity}
        onCheckout={() => { setCartOpen(false); setCheckoutOpen(true) }}
        onBrowse={browseChoice}
      />
      <CheckoutModal
        open={checkoutOpen}
        cart={cart}
        onClose={() => setCheckoutOpen(false)}
      />
      <PreviewModal preview={preview} onClose={() => setPreview(null)} />
    </div>
  )
}
