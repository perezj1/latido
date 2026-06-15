const HOUR_MS = 60 * 60 * 1000
const NEW_FREE_BUSINESS_WINDOW_MS = 72 * HOUR_MS

export const BUSINESS_PROMOTION_PLANS = [
  {
    key:'free',
    label:'Gratuito',
    shortLabel:'Gratuito',
    priority:0,
    rotationWeight:1,
    color:'#64748B',
    background:'#F1F5F9',
  },
  {
    key:'featured',
    label:'Negocio Destacado',
    shortLabel:'Destacado',
    priority:1,
    rotationWeight:2,
    color:'#2563EB',
    background:'#EFF6FF',
  },
  {
    key:'basic',
    label:'Partner Básico',
    shortLabel:'Básico',
    priority:2,
    rotationWeight:4,
    color:'#1D4ED8',
    background:'#DBEAFE',
  },
  {
    key:'premium',
    label:'Partner Premium',
    shortLabel:'Premium',
    priority:3,
    rotationWeight:7,
    color:'#DC2626',
    background:'#FEE2E2',
  },
  {
    key:'exclusive',
    label:'Partner Exclusivo',
    shortLabel:'Exclusivo',
    priority:4,
    rotationWeight:10,
    color:'#B45309',
    background:'#FEF3C7',
  },
]

const PLAN_BY_KEY = new Map(BUSINESS_PROMOTION_PLANS.map(plan => [plan.key, plan]))

function toTimestamp(value) {
  if (!value) return null
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

function deterministicUnit(value) {
  let hash = 2166136261
  const input = String(value)

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return ((hash >>> 0) + 1) / 4294967297
}

function getRotationBucket(now, hours = 6) {
  return Math.floor(now / (hours * HOUR_MS))
}

export function getBusinessPromotionMeta(planKey) {
  return PLAN_BY_KEY.get(planKey) || PLAN_BY_KEY.get('free')
}

export function getEffectiveBusinessPromotionPlan(business, now = Date.now()) {
  const hasPromotionFields = business?.promotion_plan != null
  if (!hasPromotionFields) return business?.featured ? 'featured' : 'free'

  const planKey = PLAN_BY_KEY.has(business.promotion_plan) ? business.promotion_plan : 'free'
  if (planKey === 'free') return 'free'

  const startsAt = toTimestamp(business.promotion_starts_at)
  const endsAt = toTimestamp(business.promotion_ends_at)
  if (!startsAt || !endsAt || startsAt > now || endsAt <= now) return 'free'

  return planKey
}

export function isBusinessPromotionActive(business, now = Date.now()) {
  return getEffectiveBusinessPromotionPlan(business, now) !== 'free'
}

export function mergeBusinessPromotionPlans(rows = []) {
  const rowByKey = new Map((rows || []).map(row => [row.plan_key || row.key, row]))

  return BUSINESS_PROMOTION_PLANS.map(defaultPlan => {
    const row = rowByKey.get(defaultPlan.key)
    if (!row) return defaultPlan

    return {
      ...defaultPlan,
      label:row.label || defaultPlan.label,
      priority:Number.isFinite(Number(row.priority)) ? Number(row.priority) : defaultPlan.priority,
      rotationWeight:Number.isFinite(Number(row.rotation_weight))
        ? Math.max(1, Number(row.rotation_weight))
        : defaultPlan.rotationWeight,
      maxActive:row.max_active == null ? null : Number(row.max_active),
      activeCount:Number(row.active_count || 0),
      availableSlots:row.available_slots == null ? null : Number(row.available_slots),
      enabled:row.enabled !== false,
    }
  })
}

export function rotateHomeBusinesses(businesses = [], planRows = [], now = Date.now()) {
  if (!Array.isArray(businesses) || businesses.length < 2) return businesses || []

  const plans = mergeBusinessPromotionPlans(planRows)
  const planByKey = new Map(plans.map(plan => [plan.key, plan]))
  const bucket = getRotationBucket(now)
  const enriched = businesses.map(business => {
    const planKey = getEffectiveBusinessPromotionPlan(business, now)
    const plan = planByKey.get(planKey) || getBusinessPromotionMeta(planKey)
    const unit = deterministicUnit(`${bucket}:${business.id}:${planKey}`)
    const weightedScore = -Math.log(unit) / Math.max(1, plan.rotationWeight || 1)

    return {
      business:{
        ...business,
        effectivePromotionPlan:planKey,
      },
      plan,
      unit,
      weightedScore,
    }
  })

  const paid = enriched.filter(item => item.plan.key !== 'free')
  const highestPriority = paid.reduce(
    (highest, item) => Math.max(highest, item.plan.priority || 0),
    -1,
  )
  const firstCandidates = paid
    .filter(item => item.plan.priority === highestPriority)
    .sort((a, b) => a.unit - b.unit)
  const first = firstCandidates[0] || null
  const remaining = enriched
    .filter(item => item !== first)
    .sort((a, b) =>
      a.weightedScore - b.weightedScore ||
      b.plan.priority - a.plan.priority ||
      String(a.business.id).localeCompare(String(b.business.id))
    )

  const ordered = first ? [first, ...remaining] : remaining
  const recentFreeIndex = ordered.findIndex((item, index) => {
    if (index < 1 || item.plan.key !== 'free') return false
    const createdAt = toTimestamp(item.business.created_at)
    return createdAt && now - createdAt <= NEW_FREE_BUSINESS_WINDOW_MS
  })

  if (recentFreeIndex > 2) {
    const [recentFree] = ordered.splice(recentFreeIndex, 1)
    ordered.splice(Math.min(2, ordered.length), 0, recentFree)
  }

  return ordered.map(item => item.business)
}

export function formatPromotionEndDate(value) {
  const timestamp = toTimestamp(value)
  if (!timestamp) return ''

  return new Intl.DateTimeFormat('es-CH', {
    day:'2-digit',
    month:'2-digit',
    year:'numeric',
  }).format(new Date(timestamp))
}
