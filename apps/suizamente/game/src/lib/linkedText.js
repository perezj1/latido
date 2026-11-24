import { findPhoneNumbersInText } from 'libphonenumber-js/min'

const WEB_URL = /https?:\/\/[^\s<>"“”]+|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:[/?#][^\s<>"“”]*)?/gi
// Numbers inside email addresses or URLs must never become telephone links.
const PROTECTED_TOKEN = /[^\s<>"“”]*@[^\s<>"“”]+|\b[a-z][a-z\d+.-]*:\/\/[^\s<>"“”]+/gi

function withoutPunctuation(value) {
  let url = value.replace(/[.,;:!?]+$/, '')
  for (const [opening, closing] of [['(', ')'], ['[', ']'], ['{', '}']]) {
    while (url.endsWith(closing) && url.split(closing).length > url.split(opening).length)
      url = url.slice(0, -1)
  }
  return url.replace(/[.,;:!?]+$/, '')
}

export function findTextLinks(text) {
  const links = []
  const protectedRanges = [...text.matchAll(PROTECTED_TOKEN)].map(match => ({
    start:match.index,
    end:match.index + match[0].length,
  }))

  for (const match of text.matchAll(WEB_URL)) {
    protectedRanges.push({ start:match.index, end:match.index + match[0].length })
    // Do not turn fragments of email addresses or non-web schemes into links.
    if (match.index > 0 && /[\p{L}\p{N}_@./:+-]/u.test(text[match.index - 1])) continue
    const label = withoutPunctuation(match[0])
    try {
      const url = new URL(/^https?:\/\//i.test(label) ? label : `https://${label}`)
      if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || url.username || url.password)
        continue
      links.push({ start:match.index, end:match.index + label.length, href:url.href, type:'url' })
    } catch {
      continue
    }
  }

  // Local numbers use Switzerland's numbering plan; explicit country codes are preserved.
  for (const { startsAt:start, endsAt:end, number } of findPhoneNumbersInText(text, 'CH')) {
    if (protectedRanges.some(range => start < range.end && end > range.start)) continue
    links.push({ start, end, href:number.getURI(), type:'phone' })
  }

  return links.sort((a, b) => a.start - b.start)
}
