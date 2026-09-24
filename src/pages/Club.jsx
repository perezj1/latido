import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
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
const CLUB_SHIPPING_CHF = Math.max(0, Number(import.meta.env.VITE_CLUB_SHIPPING_CHF || 7.9))

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
    id: 'cafe',
    name: 'Café 6.50 CHF · ¡Qué ruina!',
    image: '/club/designs/cafe-granate.webp',
    alt: 'Diseño granate Café 6.50 CHF, qué ruina, de Latido Club',
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
    id: 'hablas-espanol',
    name: '¿Tú también hablas español?',
    image: '/club/products/hablas-espanol-granate-trasera.webp',
    alt: 'Diseño tipográfico granate ¿Tú también hablas español? de Latido Club',
    tone: '#FFF0F2',
  },
]

const FALLBACK_PRODUCTS = [
  {
    id: 'c1b3d3ef-dd71-4d78-8712-4d7fea26880b',
    category: 'camisetas',
    name: 'Camiseta ¿Tú también hablas español?',
    shortName: 'Camiseta Hablas Español',
    eyebrow: 'Diseño tipográfico',
    description: 'Camiseta unisex de algodón de alto gramaje: mensaje minimalista delante y diseño granate grande en la espalda.',
    price: 34,
    image: '/club/camiseta-hablas-espanol-chica.webp',
    images: [
      { url: '/club/camiseta-hablas-espanol-chica.webp', label: 'Frontal' },
      { url: '/club/camiseta-hablas-espanol-espalda.png?v=2', label: 'Trasera' },
    ],
    imageFallback: '/club/products/camiseta-hablas-blanca-frontal.webp',
    imageAlt: 'Camiseta blanca con diseño granate de Latido Club',
    optionLabel: 'Talla',
    options: [
      { label: 'S', sku: 'gelato:c1b3d3ef-dd71-4d78-8712-4d7fea26880b:11ef009f-2859-4c9b-99ac-2819cc3cdfbc' },
      { label: 'M', sku: 'gelato:c1b3d3ef-dd71-4d78-8712-4d7fea26880b:08b7a5de-37f5-471b-9f98-eab0ad3693fe' },
      { label: 'L', sku: 'gelato:c1b3d3ef-dd71-4d78-8712-4d7fea26880b:2b498b98-1c0d-4af7-b90b-5a507ed3e18b' },
      { label: 'XL', sku: 'gelato:c1b3d3ef-dd71-4d78-8712-4d7fea26880b:c30ed3fb-af5d-4bca-86fd-b0eb7aef7924' },
      { label: '2XL', sku: 'gelato:c1b3d3ef-dd71-4d78-8712-4d7fea26880b:07b3a9ea-1594-4264-81b9-20e6bb1672bc' },
    ],
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
    price: 29,
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
  minimumFractionDigits: 0,
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

function ClubConfigurator({ products, catalogStatus, onAdd, onPreview }) {
  const [categoryId, setCategoryId] = useState('camisetas')
  const [designId, setDesignId] = useState('')
  const [color, setColor] = useState('')
  const [choices, setChoices] = useState({})
  const [imageIndex, setImageIndex] = useState(0)
  const [attempted, setAttempted] = useState(false)
  const [justAdded, setJustAdded] = useState(false)
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

  const chooseCategory = id => {
    setCategoryId(id)
    setDesignId('')
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
    if (!selectedVariant) {
      setAttempted(true)
      optionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      optionsRef.current?.querySelector('button:not(:disabled), select')?.focus({ preventScroll: true })
      return
    }
    const cartImage = images.find(image => image.url && !image.overlay)?.url
      || images[0]?.base
      || product.image
    onAdd(product, selectedVariant, cartImage)
    setJustAdded(true)
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

  let buttonLabel = `Añadir a la bolsa · ${money(product.price)}`
  if (!orderable) buttonLabel = product.availabilityMessage || 'Disponible próximamente'
  else if (missingGroup) buttonLabel = `Elige tu ${missingGroup.name.toLowerCase()} para continuar`
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
              <small>{category.count} {category.count === 1 ? 'diseño' : 'diseños'} · desde {money(category.price)}</small>
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
              <strong>{money(product.price)}</strong>
              <span>IVA incluido · {CLUB_SHIPPING_CHF > 0 ? `envío a Suiza ${money(CLUB_SHIPPING_CHF)}` : 'envío gratuito a Suiza'}</span>
            </div>
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
            <p className="club-config__summary" aria-live="polite">
              {summary.map((part, index) => (
                <span key={`${part}:${index}`}>{index > 0 && <ChevronRight size={11} aria-hidden="true" />}{part}</span>
              ))}
            </p>
            <button
              type="button"
              className={`club-add-button${justAdded ? ' is-added' : ''}${missingGroup && orderable ? ' is-pending' : ''}`}
              disabled={!orderable}
              onClick={handleAdd}
            >
              {justAdded ? <Check size={17} aria-hidden="true" /> : <ShoppingBag size={17} aria-hidden="true" />}
              {buttonLabel}
            </button>
            <div className="club-config__benefits" aria-label="Ventajas del producto">
              <span><Leaf size={15} /><b>Producido bajo demanda</b></span>
              <span><Truck size={15} /><b>Envío a Suiza</b></span>
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

function CartDrawer({ open, cart, onClose, onQuantity, onCheckout }) {
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)

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
            <p>Elige una pieza de la nueva colección de Latido Club.</p>
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
            </div>
            <div className="club-drawer__summary">
              <div><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
              <p>Envío estándar a Suiza: {money(CLUB_SHIPPING_CHF)}.</p>
              <button type="button" onClick={onCheckout}>
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
  const total = subtotal + CLUB_SHIPPING_CHF

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
          CLUB_CATALOG_UNAVAILABLE:'No pudimos comprobar el catálogo de Gelato. Inténtalo de nuevo en unos minutos.',
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
            <span className="club-checkout-payment__icon"><CreditCard size={25} /></span>
            <h3>Completarás tus datos en Stripe</h3>
            <p>En el siguiente paso introducirás tu email, teléfono, dirección de entrega y forma de pago. Latido no recibe ni almacena los datos de tu tarjeta.</p>
            <div><ShieldCheck size={18} /><span><strong>Pago verificado</strong>Solo prepararemos el pedido cuando Stripe confirme el cobro.</span></div>
            <div><Truck size={18} /><span><strong>Envío a Suiza</strong>Stripe validará la dirección y la guardaremos junto al pedido confirmado.</span></div>
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
            <div className="club-order-line club-order-line--shipping"><span>Envío estándar a Suiza</span><strong>{money(CLUB_SHIPPING_CHF)}</strong></div>
            <div className="club-grand-total"><span>Total</span><strong>{money(total)}</strong></div>

            {error && <p className="club-checkout-error" role="alert">{error}</p>}

            <button className="club-order-button" type="button" disabled={loading || !cart.length} onClick={handleCheckout}>
              {loading ? <LoaderCircle className="club-spin" size={18} /> : <CreditCard size={18} />}
              {loading ? 'Abriendo pago seguro…' : 'Continuar al pago'}
            </button>
            <p className="club-order-note"><ShieldCheck size={13} /> El siguiente paso es el pago seguro en Stripe. Allí confirmarás el cobro de {money(total)}.</p>
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
  const [paymentReturn, setPaymentReturn] = useState(readCheckoutReturn)
  const itemCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart])

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart))
  }, [cart])

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
        if (!response.ok) throw new Error(payload.error || 'No pudimos actualizar el catálogo de Gelato.')
        if (Array.isArray(payload.products) && payload.products.length) setProducts(payload.products)
        setCatalogStatus('connected')
      } catch (error) {
        if (error.name !== 'AbortError') setCatalogStatus('fallback')
      }
    }

    loadProducts()
    return () => controller.abort()
  }, [])

  const addToCart = (product, option, image = product.image) => {
    if (product.orderable === false || option.available === false) {
      toast.error(product.availabilityMessage || 'Este producto estará disponible próximamente')
      return
    }
    setCart(current => {
      const existing = current.find(item => item.sku === option.sku)
      if (existing) return current.map(item => item.sku === option.sku ? { ...item, quantity: Math.min(10, item.quantity + 1) } : item)
      return [...current, {
        sku: option.sku,
        productId: product.id,
        name: product.name,
        shortName: product.shortName,
        image,
        option: optionValueLabel(option.label),
        optionLabel: Object.keys(option.selections || {}).join(' / ') || product.optionLabel,
        price: product.price,
        quantity: 1,
      }]
    })
    toast.success(`${product.shortName} añadida a tu bolsa`)
  }

  const changeQuantity = (sku, quantity) => {
    setCart(current => quantity <= 0
      ? current.filter(item => item.sku !== sku)
      : current.map(item => item.sku === sku ? { ...item, quantity: Math.min(10, quantity) } : item))
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
                  ? `Stripe nos avisará automáticamente y recibirás la confirmación por email${paymentReturn.reference ? ` para el pedido ${paymentReturn.reference}` : ''}.`
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
              <span><Truck size={16} /> Producido bajo demanda por Gelato</span>
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
              <p>Elige el artículo, el diseño y el color. Ves cómo queda antes de añadirlo a tu bolsa.</p>
            </div>
            <div className="club-collection-benefits" aria-label="Ventajas de Latido Club">
              <div><Truck size={22} /><span><strong>Envío a Suiza</strong><small>Rápido y fiable</small></span></div>
              <div><Leaf size={22} /><span><strong>Calidad premium</strong><small>Impresión duradera</small></span></div>
              <div><Sparkles size={22} /><span><strong>Diseños originales</strong><small>Hechos para conectar</small></span></div>
            </div>
          </div>
          <ClubConfigurator
            products={products}
            catalogStatus={catalogStatus}
            onAdd={addToCart}
            onPreview={setPreview}
          />
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
              <div><Truck size={20} /><span><strong>Producción local</strong>Gelato busca el centro más cercano.</span></div>
              <div><Heart size={20} /><span><strong>Hecho para conectar</strong>Diseños que hablan de nosotros.</span></div>
            </div>
          </div>
        </section>

        <section className="club-process">
          <div className="club-section-heading club-section-heading--light">
            <div><span>03 / De aquí a tus manos</span><h2>Hecho cuando tú lo eliges.</h2></div>
            <p>Selecciona producto, color y talla. Tras confirmar el pago, Gelato fabrica el pedido y lo envía a tu dirección en Suiza.</p>
          </div>
          <div className="club-process__steps">
            <div><b>1</b><h3>Eliges</h3><p>Producto, diseño, color, talla o modelo.</p></div>
            <div><b>2</b><h3>Producimos</h3><p>Gelato fabrica tu pieza bajo demanda.</p></div>
            <div><b>3</b><h3>Recibes</h3><p>Te avisamos cuando el pedido esté en camino.</p></div>
          </div>
        </section>

        <section className="club-faq">
          <div><span>Antes de pedir</span><h2>Preguntas frecuentes</h2></div>
          <div className="club-faq__list">
            <details><summary>¿Cuánto tarda el envío?<Plus size={18} /></summary><p>El plazo depende del producto, la disponibilidad y el destino. Recibirás un email de seguimiento cuando el pedido esté preparado para el envío.</p></details>
            <details><summary>¿Dónde introduzco mi dirección?<Plus size={18} /></summary><p>Después de revisar la bolsa pasarás al pago seguro de Stripe. Allí indicarás tu email, teléfono y dirección de entrega una sola vez.</p></details>
            <details><summary>¿Dónde se fabrica?<Plus size={18} /></summary><p>Gelato asigna el pedido a un centro de producción cercano al destino siempre que el producto y el color estén disponibles.</p></details>
            <details><summary>¿Puedo cambiar la talla?<Plus size={18} /></summary><p>Las prendas se producen bajo demanda, por eso conviene revisar bien la talla antes de pagar. Si recibes una pieza con un defecto de producción, escríbenos para revisarlo.</p></details>
          </div>
        </section>
      </main>

      <footer className="club-footer">
        <div><img src="/brand/latido-horizontal-white.webp" alt="Latido Club" /></div>
        <p>Hecho con corazón en Suiza · Producido bajo demanda con Gelato</p>
        <Link to="/">latido.ch</Link>
      </footer>

      <button type="button" className={`club-floating-cart${itemCount ? ' is-visible' : ''}`} onClick={() => setCartOpen(true)}>
        <ShoppingBag size={18} /><span>Ver bolsa</span><b>{itemCount}</b>
      </button>

      <CartDrawer
        open={cartOpen}
        cart={cart}
        onClose={() => setCartOpen(false)}
        onQuantity={changeQuantity}
        onCheckout={() => { setCartOpen(false); setCheckoutOpen(true) }}
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
