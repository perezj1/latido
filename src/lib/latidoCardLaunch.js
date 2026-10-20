// Keep the member experience dormant while businesses publish their first offers.
// Enable explicitly when Latido is ready to open the program to members.
export const CARD_MEMBERS_ENABLED = import.meta.env?.VITE_LATIDO_CARD_MEMBERS_ENABLED === 'true'

const MEMBER_ACTIONS = new Set([
  'lc_member_home', 'lc_use_offer', 'lc_claim_offer', 'lc_validation',
  'lc_notification_preferences', 'lc_delete_offer', 'lc_reverse_redemption'
])

export function cardActionAvailable(name) {
  return CARD_MEMBERS_ENABLED || !MEMBER_ACTIONS.has(name)
}
