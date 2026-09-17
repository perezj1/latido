import { useCallback, useMemo, useState } from 'react'
import { getSavedSearchFingerprint } from '../lib/savedSearches'
import SavedSearchButton from './SavedSearchButton'

export default function SavedSearchPrompt({
  draft,
  className = 'saved-search-prompt saved-search-prompt--toolbar',
  message = 'Avísame cuando haya nuevos resultados.',
}) {
  const fingerprint = useMemo(() => getSavedSearchFingerprint(draft), [draft])
  const [savedFingerprint, setSavedFingerprint] = useState('')
  const hidden = Boolean(fingerprint && savedFingerprint === fingerprint)
  const handleSavedStateChange = useCallback((isSaved) => {
    setSavedFingerprint(current => {
      if (isSaved) return fingerprint
      return current === fingerprint ? '' : current
    })
  }, [fingerprint])

  if (!draft || !fingerprint) return null

  return (
    <div className={className} hidden={hidden} style={hidden ? { display:'none' } : undefined}>
      <span>{message}</span>
      <SavedSearchButton
        key={fingerprint}
        draft={draft}
        compact
        onSavedStateChange={handleSavedStateChange}
      />
    </div>
  )
}
