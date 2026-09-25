import Stripe from 'npm:stripe@22.6.0'
import { createClient } from 'npm:@supabase/supabase-js@2.101.1'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_CLUB_SECRET_KEY') || Deno.env.get('STRIPE_SECRET_KEY') || ''
const GELATO_API_KEY = Deno.env.get('GELATO_API_KEY') || ''
const GELATO_STORE_ID = Deno.env.get('GELATO_STORE_ID') || ''
const APP_URL = (Deno.env.get('LATIDO_APP_URL') || 'https://www.latido.ch').replace(/\/+$/, '')
const CATALOG_URL = Deno.env.get('CLUB_CATALOG_URL') || `${APP_URL}/api/gelato?action=products`
const GELATO_STORES_URL = 'https://ecommerce.gelatoapis.com/v1/stores'
const SHIPPING_AMOUNT = 0
const MAX_ITEMS = 20
const MAX_QUANTITY = 10

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion:'2026-08-26.dahlia',
  httpClient:Stripe.createFetchHttpClient(),
})
const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth:{ persistSession:false, autoRefreshToken:false },
})

const allowedOrigins = new Set(['https://latido.ch', 'https://www.latido.ch', 'https://latidoch.vercel.app'])

type StorefrontVariant = { sku?:string; label?:string; available?:boolean }
type StorefrontProduct = {
  id?:string
  name?:string
  shortName?:string
  optionLabel?:string
  price?:number
  purchaseType?:PurchaseType
  orderable?:boolean
  variants?:StorefrontVariant[]
  options?:StorefrontVariant[]
}
type GelatoVariant = {
  id?:string
  title?:string
  connectionStatus?:string
  isHidden?:boolean
  productUid?:string
}
type GelatoProduct = {
  id?:string
  title?:string
  variants?:GelatoVariant[]
}
type ClubCheckoutItem = {
  sku:string
  gelato_product_id:string
  gelato_variant_id:string
  product_name:string
  product_title:string
  option_label:string
  option:string
  unit_amount:number
  quantity:number
  line_total:number
  purchase_type:PurchaseType
}

type PurchaseType = 'base' | 'addon'
type ProductConfig = {
  shortName:string
  price:number
  optionLabel:string
  purchaseType:PurchaseType
}

const PRODUCT_CONFIG:Record<string, ProductConfig> = {
  '5dd70f64-e112-4cfb-88b1-5cdc18d257c3': {
    shortName:'Camiseta Café · Blanco', price:36.9, optionLabel:'Talla', purchaseType:'base',
  },
  '588088c0-6780-41c2-a67f-201ecf5f0eb2': {
    shortName:'Camiseta Café · Lavanda', price:36.9, optionLabel:'Color / Talla', purchaseType:'base',
  },
  'b6b8be91-6cfd-42d2-88f3-bed61406fe2f': {
    shortName:'Camiseta Café · Negro', price:36.9, optionLabel:'Color / Talla', purchaseType:'base',
  },
  'c5fe22ad-0172-4582-83ec-b713487b18fb': {
    shortName:'Camiseta Café · Granate', price:36.9, optionLabel:'Color / Talla', purchaseType:'base',
  },
  '1759e8a1-03e1-40eb-947b-de41f50490c3': {
    shortName:'Sudadera Latido Logo · Negra', price:46.9, optionLabel:'Talla', purchaseType:'base',
  },
  'e2a521ea-ebab-4709-80c1-12b173b13271': {
    shortName:'Sudadera Latido Logo · Clara', price:46.9, optionLabel:'Color / Talla', purchaseType:'base',
  },
  'e922400e-27f5-410e-83bd-ef4647215e41': {
    shortName:'Sudadera Atardecer', price:46.9, optionLabel:'Color / Talla', purchaseType:'base',
  },
  '9b2e0872-ffc6-4bbe-8615-eec669e36da4': {
    shortName:'Bolsa Latido Logo', price:24.9, optionLabel:'Color', purchaseType:'addon',
  },
  'e23cd355-eb48-4844-862a-98592e7757f7': {
    shortName:'Camiseta Latido Logo · Negra', price:36.9, optionLabel:'Talla', purchaseType:'base',
  },
  '0541177c-34b6-4fb4-bd91-64bd5a087c08': {
    shortName:'Camiseta Latido Logo · Clara', price:36.9, optionLabel:'Color / Talla', purchaseType:'base',
  },
  'c1b3d3ef-dd71-4d78-8712-4d7fea26880b': {
    shortName:'Camiseta Latido Club', price:36.9, optionLabel:'Color / Talla', purchaseType:'base',
  },
  'f3ff3398-9981-496f-b9d3-4602be85b15b': {
    shortName:'Sudadera Latido Club', price:46.9, optionLabel:'Color / Talla', purchaseType:'base',
  },
  'bd807369-b74d-483d-9065-fb994ca7bb38': {
    shortName:'Bolsa de tela Latido Club', price:24.9, optionLabel:'Color', purchaseType:'addon',
  },
  '7e2bab53-6962-4fc7-ab8c-f8009c6f5754': {
    shortName:'Carcasa Hablas Español', price:21.9, optionLabel:'Modelo', purchaseType:'addon',
  },
  'c578978a-3f07-41e9-b715-e71af2e84070': {
    shortName:'Carcasa Latido Club', price:21.9, optionLabel:'Modelo', purchaseType:'addon',
  },
  '2f6d7770-e062-471d-8966-a0877be0b212': {
    shortName:'Carcasa Samsung Latido Club', price:21.9, optionLabel:'Modelo', purchaseType:'addon',
  },
  '150f2628-a409-4b1b-ae40-810a53225d9f': {
    shortName:'Carcasa Samsung Hablas Español', price:21.9, optionLabel:'Modelo', purchaseType:'addon',
  },
}

let gelatoCatalogCache:{ expiresAt:number; products:StorefrontProduct[] } | null = null

function cors(req:Request) {
  const origin = req.headers.get('origin') || ''
  const local = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  return {
    'Access-Control-Allow-Origin':allowedOrigins.has(origin) || local ? origin : 'https://www.latido.ch',
    'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods':'POST, OPTIONS',
    Vary:'Origin',
  }
}

function json(req:Request, body:Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers:{ ...cors(req), 'Content-Type':'application/json' } })
}

function errorText(error:unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object') {
    const value = error as Record<string, unknown>
    return [value.message, value.details, value.hint, value.code].filter(item => typeof item === 'string').join(' | ')
  }
  return String(error)
}

function isUuid(value:unknown):value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function randomLetters(length:number) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz'
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('')
}

async function fingerprint(req:Request) {
  const forwarded = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim()
  const userAgent = req.headers.get('user-agent') || ''
  const source = `${forwarded}|${userAgent}|${SERVICE_ROLE_KEY.slice(-16)}`
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source))
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('')
}

function gelatoVariantLabel(variant:GelatoVariant) {
  return String(variant.title || 'Única')
    .replace(/\s+-\s+Impresión directa sobre la prenda.*$/i, '')
    .replace(/^Apple\s+-\s+/i, '')
    .trim() || 'Única'
}

async function gelatoGet(url:string, stage:string) {
  const response = await fetch(url, {
    headers:{ Accept:'application/json', 'X-API-KEY':GELATO_API_KEY },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = typeof payload?.message === 'string'
      ? payload.message
      : typeof payload?.error === 'string'
        ? payload.error
        : ''
    throw new Error(`CLUB_CATALOG_UNAVAILABLE:${stage}:HTTP_${response.status}:${message.slice(0, 160)}`)
  }
  return payload
}

async function gelatoStorefrontProducts() {
  if (!GELATO_API_KEY) throw new Error('CLUB_CATALOG_UNAVAILABLE')
  if (gelatoCatalogCache?.expiresAt && gelatoCatalogCache.expiresAt > Date.now()) {
    return gelatoCatalogCache.products
  }

  let storeId = GELATO_STORE_ID
  if (!storeId) {
    const storesPayload = await gelatoGet(GELATO_STORES_URL, 'stores')
    const stores = Array.isArray(storesPayload?.stores) ? storesPayload.stores : []
    const store = stores.find((item:{ name?:string }) => String(item.name || '').toLowerCase() === 'latido club')
    storeId = store?.id || ''
  }
  if (!storeId) throw new Error('CLUB_CATALOG_UNAVAILABLE:store:not_found')

  const listPayload = await gelatoGet(`${GELATO_STORES_URL}/${storeId}/products?offset=0&limit=100`, 'products')
  const listed = Array.isArray(listPayload?.products) ? listPayload.products : []
  const detailed = await Promise.all(listed.map((product:{ id?:string }) => (
    gelatoGet(`${GELATO_STORES_URL}/${storeId}/products/${product.id}`, `product_${product.id || 'unknown'}`)
  ))) as GelatoProduct[]

  const products:StorefrontProduct[] = detailed.flatMap(product => {
    const id = product.id || ''
    const config = PRODUCT_CONFIG[id]
    if (!config) return []
    const variants = (Array.isArray(product.variants) ? product.variants : [])
      .filter(variant => variant.connectionStatus === 'connected' && variant.productUid && !variant.isHidden && variant.id)
      .map(variant => ({
        sku:`gelato:${id}:${variant.id}`,
        label:gelatoVariantLabel(variant),
        available:true,
      }))
    if (!variants.length) return []
    return [{
      id,
      name:product.title || config.shortName,
      shortName:config.shortName,
      optionLabel:config.optionLabel,
      price:config.price,
      purchaseType:config.purchaseType,
      orderable:true,
      variants,
    }]
  })
  if (!products.length) throw new Error('CLUB_CATALOG_UNAVAILABLE:products:none_configured')
  gelatoCatalogCache = { expiresAt:Date.now() + 5 * 60 * 1000, products }
  return products
}

async function storefrontProducts() {
  if (GELATO_API_KEY) return await gelatoStorefrontProducts()
  const response = await fetch(CATALOG_URL, { headers:{ Accept:'application/json' } })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || !Array.isArray(payload?.products)) throw new Error('CLUB_CATALOG_UNAVAILABLE')
  return payload.products as StorefrontProduct[]
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers:cors(req) })
  if (req.method !== 'POST') return json(req, { ok:false, error:'METHOD_NOT_ALLOWED' }, 405)

  const origin = req.headers.get('origin') || ''
  if (origin && !allowedOrigins.has(origin) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return json(req, { ok:false, error:'ORIGIN_NOT_ALLOWED' }, 403)
  }

  let orderId = ''
  let sessionId = ''
  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !STRIPE_SECRET_KEY) throw new Error('CHECKOUT_NOT_CONFIGURED')
    const body = await req.json().catch(() => ({}))
    if (body?.website) return json(req, { ok:false, error:'INVALID_REQUEST' }, 400)
    if (!isUuid(body?.checkoutRequestId)) return json(req, { ok:false, error:'INVALID_CHECKOUT_REQUEST' }, 400)
    if (!Array.isArray(body?.items) || !body.items.length || body.items.length > MAX_ITEMS) {
      return json(req, { ok:false, error:'INVALID_CART' }, 400)
    }

    const { data: existing } = await service
      .from('club_orders')
      .select('reference,stripe_checkout_url,status')
      .eq('checkout_request_id', body.checkoutRequestId)
      .maybeSingle()
    if (existing?.stripe_checkout_url && existing.status === 'checkout_open') {
      return json(req, { ok:true, url:existing.stripe_checkout_url, reference:existing.reference })
    }
    if (existing) return json(req, { ok:false, error:'CHECKOUT_ALREADY_USED' }, 409)

    const products = await storefrontProducts()
    const variants = new Map<string, { product:StorefrontProduct; variant:StorefrontVariant }>()
    for (const product of products) {
      for (const variant of product.variants || product.options || []) {
        if (variant.sku) variants.set(variant.sku, { product, variant })
      }
    }

    const normalizedItems:ClubCheckoutItem[] = body.items.map((input:Record<string, unknown>) => {
      const sku = typeof input?.sku === 'string' ? input.sku.slice(0, 180) : ''
      const quantity = Number.parseInt(String(input?.quantity || ''), 10)
      const configured = variants.get(sku)
      if (!configured || configured.product.orderable === false || configured.variant.available === false) {
        throw new Error('PRODUCT_NOT_AVAILABLE')
      }
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) throw new Error('INVALID_QUANTITY')
      const unitAmount = Math.round(Number(configured.product.price) * 100)
      if (!Number.isInteger(unitAmount) || unitAmount < 100 || unitAmount > 100000) throw new Error('INVALID_PRODUCT_PRICE')
      return {
        sku,
        gelato_product_id:configured.product.id || sku.split(':')[1] || '',
        gelato_variant_id:sku.split(':')[2] || '',
        product_name:configured.product.shortName || configured.product.name || 'Producto Latido Club',
        product_title:configured.product.name || configured.product.shortName || 'Producto Latido Club',
        option_label:configured.product.optionLabel || 'Opción',
        option:configured.variant.label || 'Única',
        unit_amount:unitAmount,
        quantity,
        line_total:unitAmount * quantity,
        purchase_type:configured.product.purchaseType === 'addon' ? 'addon' : 'base',
      }
    })

    if (
      normalizedItems.some(item => item.purchase_type === 'addon')
      && !normalizedItems.some(item => item.purchase_type === 'base')
    ) {
      throw new Error('ADDON_REQUIRES_GARMENT')
    }

    const subtotalAmount = normalizedItems.reduce((sum:number, item:{ line_total:number }) => sum + item.line_total, 0)
    const totalAmount = subtotalAmount + SHIPPING_AMOUNT
    const requestFingerprint = await fingerprint(req)
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count } = await service
      .from('club_orders')
      .select('id', { count:'exact', head:true })
      .eq('request_fingerprint', requestFingerprint)
      .gte('created_at', since)
    if ((count || 0) >= 10) return json(req, { ok:false, error:'TOO_MANY_CHECKOUTS' }, 429)

    const { data:order, error:insertError } = await service
      .from('club_orders')
      .insert({
        checkout_request_id:body.checkoutRequestId,
        status:'checkout_open',
        payment_status:'unpaid',
        currency:'chf',
        subtotal_amount:subtotalAmount,
        shipping_amount:SHIPPING_AMOUNT,
        total_amount:totalAmount,
        items:normalizedItems,
        request_fingerprint:requestFingerprint,
      })
      .select('id,reference')
      .single()
    if (insertError || !order) throw insertError || new Error('ORDER_CREATE_FAILED')
    orderId = order.id

    const metadata = {
      latido_product:'club_order',
      latido_order_id:order.id,
      latido_order_reference:order.reference,
    }
    const lineItems:Stripe.Checkout.SessionCreateParams.LineItem[] = normalizedItems.map(item => ({
      quantity:item.quantity,
      price_data:{
        currency:'chf',
        unit_amount:item.unit_amount,
        product_data:{
          name:item.product_name.slice(0, 120),
          description:`${item.product_title} · ${item.option_label}: ${item.option}`.slice(0, 500),
          metadata:{ gelato_sku:item.sku },
        },
      },
    }))
    const expiresAt = Math.floor(Date.now() / 1000) + 30 * 60
    const session = await stripe.checkout.sessions.create({
      mode:'payment',
      line_items:lineItems,
      client_reference_id:order.id,
      customer_creation:'always',
      shipping_address_collection:{ allowed_countries:['CH'] },
      phone_number_collection:{ enabled:true },
      locale:'es',
      success_url:`${APP_URL}/club?checkout=success&order=${encodeURIComponent(order.reference)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:`${APP_URL}/club?checkout=canceled&order=${encodeURIComponent(order.reference)}`,
      expires_at:expiresAt,
      metadata,
      payment_intent_data:{ metadata, description:`Pedido ${order.reference} de Latido Club` },
      custom_text:{ submit:{ message:'Gelato producirá el pedido bajo demanda después de confirmarse el pago.' } },
      integration_identifier:`latido_club_${randomLetters(8)}`,
    }, { idempotencyKey:`latido-club-checkout-v1-${order.id}` })
    if (!session.url) throw new Error('CHECKOUT_URL_MISSING')
    sessionId = session.id

    const { error:updateError } = await service
      .from('club_orders')
      .update({ stripe_checkout_session_id:session.id, stripe_checkout_url:session.url })
      .eq('id', order.id)
    if (updateError) throw updateError

    return json(req, { ok:true, url:session.url, reference:order.reference })
  } catch (error) {
    const detail = errorText(error)
    if (sessionId) await stripe.checkout.sessions.expire(sessionId).catch(() => {})
    if (orderId) {
      await service.from('club_orders').update({ status:'failed', notification_last_error:detail.slice(0, 1000) }).eq('id', orderId)
    }
    const known:Record<string, number> = {
      CHECKOUT_NOT_CONFIGURED:503,
      CLUB_CATALOG_UNAVAILABLE:503,
      PRODUCT_NOT_AVAILABLE:409,
      ADDON_REQUIRES_GARMENT:409,
      INVALID_QUANTITY:400,
      INVALID_PRODUCT_PRICE:500,
      CHECKOUT_ALREADY_USED:409,
    }
    const code = Object.keys(known).find(value => detail.includes(value)) || 'CHECKOUT_CREATE_FAILED'
    console.error('club_checkout_failed', { code, detail:detail.slice(0, 500) })
    return json(req, { ok:false, error:code }, known[code] || 400)
  }
})
