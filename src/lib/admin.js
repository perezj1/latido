export const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || 'jose13hue@gmail.com')
  .split(',')
  .map(email => email.trim().toLowerCase())
  .filter(Boolean)

export function isAdminEmail(email) {
  return !!email && ADMIN_EMAILS.includes(String(email).trim().toLowerCase())
}

export function isAdminUser(user) {
  return isAdminEmail(user?.email)
}
