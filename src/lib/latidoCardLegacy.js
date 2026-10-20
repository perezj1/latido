// Discard retired capability credentials; never remove the user's Supabase login.
export function retireLegacyCardStorage() {
  for (const name of ['localStorage', 'sessionStorage']) {
    try {
      const storage = window[name]
      for (const key of Object.keys(storage)) {
        if (
          key.startsWith('latido_card_scanner_') ||
          key.startsWith('lc-business-qr:') ||
          key.startsWith('latido-card-appearance:') ||
          key === 'latido_card_pending_redemption'
        )
          storage.removeItem(key)
      }
    } catch {}
  }
}
