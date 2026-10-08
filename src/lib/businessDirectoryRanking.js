import { BUSINESS_ROTATION_INTERVAL_MS, getEffectiveBusinessPromotionPlan } from './businessPromotion.js'
import { rotateItems } from './rotation.js'

// Shared by the business directory and the related businesses in guides.
// Every tier rotates equally within itself; paid tiers stay ahead of free ones.
export const BUSINESS_DIRECTORY_PLAN_ORDER = ['exclusive', 'premium', 'basic', 'featured', 'free']

export function getDirectoryBusinessPlan(business, now = Date.now()) {
  const plan = business.promotion_plan != null
    ? getEffectiveBusinessPromotionPlan(business, now)
    : business.promotionPlan || getEffectiveBusinessPromotionPlan(business, now)
  if (plan !== 'free' && BUSINESS_DIRECTORY_PLAN_ORDER.includes(plan)) return plan
  return business.featured ? 'featured' : 'free'
}

export function getDirectoryBusinessPriority(business, now = Date.now()) {
  return BUSINESS_DIRECTORY_PLAN_ORDER.indexOf(getDirectoryBusinessPlan(business, now))
}

export function compareDirectoryBusinesses(a, b, recommendations = {}, now = Date.now()) {
  const planDiff = getDirectoryBusinessPriority(a, now) - getDirectoryBusinessPriority(b, now)
  if (planDiff) return planDiff
  if (Boolean(a.featured) !== Boolean(b.featured)) return b.featured ? 1 : -1
  const recommendationDiff = Number(recommendations[b.id] || 0) - Number(recommendations[a.id] || 0)
  if (recommendationDiff) return recommendationDiff
  return String(b.created_at || '').localeCompare(String(a.created_at || ''))
    || String(b.id).localeCompare(String(a.id))
}

export function rotateDirectoryBusinesses(businesses = [], bucket = 0, now = Date.now()) {
  return BUSINESS_DIRECTORY_PLAN_ORDER.flatMap(plan => rotateItems(
    businesses.filter(business => getDirectoryBusinessPlan(business, now) === plan),
    bucket,
  ))
}

export function rankDirectoryBusinesses(businesses = [], recommendations = {}, now = Date.now()) {
  const sorted = [...businesses].sort((a, b) => compareDirectoryBusinesses(a, b, recommendations, now))
  return rotateDirectoryBusinesses(sorted, Math.floor(now / BUSINESS_ROTATION_INTERVAL_MS), now)
}
