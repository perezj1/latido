import { findTextLinks } from '../lib/linkedText'
import './LinkedText.css'

export default function LinkedText({ children, inheritLinkColor = false }) {
  const text = String(children ?? '')
  const parts = []
  let cursor = 0
  for (const link of findTextLinks(text)) {
    const label = text.slice(link.start, link.end)
    parts.push(text.slice(cursor, link.start))
    parts.push(
      <a
        key={link.start}
        className={`linked-text-url${inheritLinkColor ? ' linked-text-url--inherit' : ''}`}
        href={link.href}
        target={link.type === 'url' ? '_blank' : undefined}
        rel={link.type === 'url' ? 'noopener noreferrer' : undefined}
        aria-label={link.type === 'phone' ? `Llamar al ${label}` : undefined}
        onClick={(event) => event.stopPropagation()}
      >
        {label}
      </a>
    )
    cursor = link.end
  }
  parts.push(text.slice(cursor))
  return <>{parts}</>
}
