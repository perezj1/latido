export const offerCombos = {
  '2x1': { label: '2x1', help: 'Se lleva 2 y paga 1.' },
  '3x2': { label: '3x2', help: 'Se lleva 3 y paga 2.' },
  second_half: {
    label: '2.ª unidad a mitad de precio',
    help: 'La segunda unidad cuesta la mitad.'
  }
}

export const initialOfferDraft = () => ({
  type: 'percent',
  value: '10',
  customValue: false,
  combo: '2x1',
  gift: '',
  benefit: '',
  scope: 'all',
  detail: '',
  description: '',
  legacy_title: '',
  minimum_spend: '0',
  requires_claim: false,
  stock_total: '',
  usage_period: 'month',
  usage_limit: 1,
  ends_at: ''
})

// Convert a calendar day to its last second in Zurich, independently of the browser zone.
export function zurichEndOfDay(day) {
  if (!day) return 'infinity'
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  if (!match) throw new Error('INVALID_DATE')
  const target = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 23, 59, 59)
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Zurich',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  })
  let instant = target
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(instant)).map((p) => [p.type, p.value])
    )
    const local = Date.UTC(
      +parts.year,
      +parts.month - 1,
      +parts.day,
      +parts.hour,
      +parts.minute,
      +parts.second
    )
    instant += target - local
  }
  return new Date(instant).toISOString()
}

export function offerToDraft(offer) {
  const saved = offer.original_draft
  const fallback = initialOfferDraft()
  const type = ['percent', 'fixed', 'gift'].includes(offer.benefit_type)
    ? offer.benefit_type
    : offer.benefit_type === 'two_for_one'
      ? 'combo'
      : 'other'
  const day =
    offer.ends_at && offer.ends_at !== 'infinity'
      ? new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Europe/Zurich',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).format(new Date(offer.ends_at))
      : ''
  return {
    ...fallback,
    type,
    value: String(offer.benefit_value || 10),
    customValue: true,
    gift: offer.title.replace(/^Regalo:\s*/i, ''),
    benefit: offer.title,
    // Legacy titles cannot always be reconstructed. Preserve them until the owner changes the offer.
    legacy_title: saved ? '' : offer.title,
    ...(saved && typeof saved === 'object' ? saved : {}),
    minimum_spend: String(offer.minimum_spend || 0),
    description: offer.description || '',
    requires_claim: Boolean(offer.requires_claim),
    stock_total: String(offer.stock_total || ''),
    usage_period: offer.usage_period,
    usage_limit: offer.usage_limit,
    ends_at: day
  }
}

const prefixed = (text, prefix) =>
  new RegExp(`^${prefix}\\s`, 'i').test(text.trim()) ? text.trim() : `${prefix} ${text.trim()}`

export function draftOfferName(draft) {
  if (draft.type === 'percent') return `${draft.value || '…'} %`
  if (draft.type === 'fixed') return `CHF ${draft.value || '…'}`
  if (draft.type === 'combo') return offerCombos[draft.combo].label
  if (draft.type === 'gift') return `Regalo: ${draft.gift.trim() || '…'}`
  const title = draft.benefit.trim()
  return title ? title[0].toLocaleUpperCase('es') + title.slice(1) : 'Tu beneficio'
}

export function draftOfferScope(draft) {
  if (draft.scope !== 'specific') return draft.type === 'gift' ? 'Con cualquier compra' : 'En todo'
  const scope = prefixed(draft.detail, draft.type === 'gift' ? 'con' : 'en')
  return scope[0].toLocaleUpperCase('es') + scope.slice(1)
}

export function createOfferPayload(draft) {
  const monetary = ['percent', 'fixed'].includes(draft.type)
  const specific = draft.scope === 'specific' && draft.detail.trim()
  const name = draftOfferName(draft)
  const title =
    draft.type === 'other'
      ? name
      : draft.type === 'gift'
        ? `${name} ${specific ? prefixed(draft.detail, 'con') : 'con tu compra'}`
        : draft.type === 'combo'
          ? `${name} ${specific ? prefixed(draft.detail, 'en') : 'en tus compras'}`
          : `${name} ${specific ? prefixed(draft.detail, 'en') : 'de descuento'}`
  return {
    title: draft.legacy_title || title,
    description: draft.description.trim(),
    // Other bundles are described benefits; never store 3x2 as a 2x1.
    benefit_type: monetary
      ? draft.type
      : draft.type === 'gift'
        ? 'gift'
        : draft.type === 'combo' && draft.combo === '2x1'
          ? 'two_for_one'
          : 'service',
    benefit_value: monetary ? Number(draft.value) : null,
    minimum_spend: Number(draft.minimum_spend || 0),
    requires_claim: draft.requires_claim,
    activation_mode: 'manual',
    stock_total: draft.requires_claim ? Number(draft.stock_total) : null,
    claim_days: 7,
    usage_period: draft.requires_claim ? 'lifetime' : draft.usage_period,
    usage_limit: draft.requires_claim ? 1 : Number(draft.usage_limit),
    // PostgreSQL infinity is a real unbounded end, compatible with the existing RPC.
    ends_at: zurichEndOfDay(draft.ends_at),
    original_draft: { ...draft }
  }
}
