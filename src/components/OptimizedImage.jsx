import { useEffect, useMemo, useState } from 'react'
import { getOptimizedImageSrcSet, getOptimizedImageUrl } from '../lib/images'

export default function OptimizedImage({
  src,
  alt = '',
  width,
  height,
  resize = 'contain',
  quality = 72,
  srcSetWidths,
  sizes,
  loading = 'lazy',
  decoding = 'async',
  fetchPriority,
  onError,
  ...props
}) {
  const originalSrc = src || ''
  const optimizedSrc = useMemo(
    () => getOptimizedImageUrl(originalSrc, { width, height, resize, quality }),
    [originalSrc, width, height, resize, quality],
  )
  const srcSet = useMemo(
    () => getOptimizedImageSrcSet(originalSrc, {
      widths: srcSetWidths,
      resize,
      quality,
    }),
    [originalSrc, srcSetWidths, resize, quality],
  )
  const [useOriginal, setUseOriginal] = useState(false)
  const currentSrc = useOriginal ? originalSrc : (optimizedSrc || originalSrc || undefined)

  useEffect(() => {
    setUseOriginal(false)
  }, [originalSrc, optimizedSrc])

  const fallbackAvailable = optimizedSrc && optimizedSrc !== originalSrc
  const imageProps = fetchPriority ? { fetchPriority } : {}

  return (
    <img
      {...props}
      {...imageProps}
      src={currentSrc}
      srcSet={!useOriginal && fallbackAvailable ? srcSet : undefined}
      sizes={!useOriginal && fallbackAvailable ? sizes : undefined}
      alt={alt}
      loading={loading}
      decoding={decoding}
      onError={event => {
        if (fallbackAvailable && !useOriginal) {
          setUseOriginal(true)
          return
        }
        onError?.(event)
      }}
    />
  )
}
