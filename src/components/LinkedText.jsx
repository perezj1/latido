import './LinkedText.css'

// Recognize web addresses with or without a scheme, while keeping all other text as text.
const WEB_URL = /https?:\/\/[^\s<>"“”]+|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:[/?#][^\s<>"“”]*)?/gi

function withoutPunctuation(value) {
  let url = value.replace(/[.,;:!?]+$/, '')
  for (const [opening, closing] of [['(', ')'], ['[', ']'], ['{', '}']]) {
    while (url.endsWith(closing) && url.split(closing).length > url.split(opening).length)
      url = url.slice(0, -1)
  }
  return url.replace(/[.,;:!?]+$/, '')
}

export default function LinkedText({ children }) {
  const text = String(children ?? '')
  const parts = []
  let cursor = 0
  for (const match of text.matchAll(WEB_URL)) {
    // Do not turn fragments of email addresses or non-web schemes into links.
    if (match.index > 0 && /[\p{L}\p{N}_@./:+-]/u.test(text[match.index - 1])) continue
    const label = withoutPunctuation(match[0])
    let url
    try {
      url = new URL(/^https?:\/\//i.test(label) ? label : `https://${label}`)
      if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || url.username || url.password)
        continue
    } catch {
      continue
    }
    parts.push(text.slice(cursor, match.index))
    parts.push(
      <a
        key={match.index}
        className="linked-text-url"
        href={url.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(event) => event.stopPropagation()}
      >
        {label}
      </a>
    )
    cursor = match.index + label.length
  }
  parts.push(text.slice(cursor))
  return <>{parts}</>
}
