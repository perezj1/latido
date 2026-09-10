export default function CreatorNetworkIcon({ platformId, size=18 }) {
  const style = { width:size, height:size, display:'block' }

  if (platformId === 'youtube') {
    return <svg viewBox="0 0 24 24" aria-hidden="true" style={style}><rect x="2.5" y="6" width="19" height="12" rx="4" fill="currentColor" /><path d="m10 9 5 3-5 3Z" fill="#fff" /></svg>
  }
  if (platformId === 'instagram') {
    return <svg viewBox="0 0 24 24" aria-hidden="true" style={style}><rect x="4.5" y="4.5" width="15" height="15" rx="4.5" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="12" r="3.4" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="17.1" cy="6.9" r="1.1" fill="currentColor" /></svg>
  }
  if (platformId === 'facebook') {
    return <svg viewBox="0 0 24 24" aria-hidden="true" style={style}><path d="M13.6 21v-7h2.7l.4-3h-3.1V9.1c0-.9.3-1.5 1.6-1.5H17V4.9c-.5-.1-1.4-.2-2.4-.2-2.5 0-4.2 1.5-4.2 4.3v2H7.6v3h2.8v7Z" fill="currentColor" /></svg>
  }
  if (platformId === 'tiktok') {
    return <svg viewBox="0 0 24 24" aria-hidden="true" style={style}><path d="M14.4 4.2c.5 2.2 1.7 3.6 4 4.1v3.1a8.4 8.4 0 0 1-4-1.2v5.3a5.7 5.7 0 1 1-5.7-5.7h.8V13a2.6 2.6 0 1 0 1.7 2.5V4.2Z" fill="currentColor" /></svg>
  }
  if (platformId === 'linkedin') {
    return <svg viewBox="0 0 24 24" aria-hidden="true" style={style}><rect x="4" y="9.5" width="3.3" height="10.5" rx=".6" fill="currentColor" /><circle cx="5.65" cy="5.8" r="1.9" fill="currentColor" /><path d="M10 9.5h3.2v1.4c.8-1.1 2-1.8 3.6-1.8 3 0 3.7 2 3.7 4.7V20h-3.3v-5.5c0-1.3 0-2.9-1.8-2.9s-2.1 1.4-2.1 2.8V20H10Z" fill="currentColor" /></svg>
  }
  if (platformId === 'spotify') {
    return <svg viewBox="0 0 24 24" aria-hidden="true" style={style}><path d="M5 9.2c4.7-1.4 10.3-.9 14.1 1.2M6.1 13c3.9-1.1 8.7-.7 11.9 1M7.1 16.6c3.2-.8 7-.5 9.6.8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true" style={style}><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M4.5 12h15M12 4c2.3 2.2 3.5 4.9 3.5 8S14.3 17.8 12 20c-2.3-2.2-3.5-4.9-3.5-8S9.7 6.2 12 4Z" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
}
