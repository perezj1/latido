export function fmtPrice(price) {
  if (!price) return ''
  let s = price.trim()
  s = s.replace(/\s*\/\s*/g, '/')
  s = s.replace(/(\d)\s*[-–]\s*(\d)/g, '$1-$2')
  s = s.replace(/^([\d.,]+)\s+CHF\b(.*)/, 'CHF $1$2')
  s = s.replace(/^(CHF\s*[\d.,]+)\s+([^\s/].*)$/, '$1/$2')
  return s
}

function normalizePhotoUrls(value) {
  if (Array.isArray(value)) return value.filter(Boolean)

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.filter(Boolean)
    } catch {
      return value.split(',').map(url => url.trim()).filter(Boolean)
    }
  }

  return []
}

export function getAdPhotos(ad) {
  return Array.from(new Set([
    ...normalizePhotoUrls(ad.photo_urls),
    ad.img_url,
    ad.img,
  ].filter(Boolean)))
}

export function getPublicationCardPrice(row, employment=false) {
  const text = employment ? row.salary || row.price : row.price
  if (text) return String(text)
  const amount = employment ? row.salary_amount ?? row.price_amount : row.price_amount
  const unit = employment ? row.salary_unit || row.price_unit : row.price_unit
  if (amount == null || amount === '' || !Number.isFinite(Number(amount))) return ''
  const units = {hora:'hora',hour:'hora',dia:'día',day:'día',semana:'semana',mes:'mes',month:'mes',ano:'año',year:'año',once:'total'}
  const suffix = units[unit] || ''
  return `CHF ${new Intl.NumberFormat('de-CH',{maximumFractionDigits:2}).format(Number(amount))}${suffix ? ` / ${suffix}` : ''}`
}
