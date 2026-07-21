import { useEffect, useState } from 'react'

export function useTimedRotationBucket(intervalMs) {
  const safeInterval = Math.max(1000, Number(intervalMs) || 1000)
  const [bucket, setBucket] = useState(() => Math.floor(Date.now() / safeInterval))

  useEffect(() => {
    const updateBucket = () => {
      setBucket(current => {
        const next = Math.floor(Date.now() / safeInterval)
        return next === current ? current : next
      })
    }
    const delayToNextBucket = safeInterval - (Date.now() % safeInterval) + 25
    let intervalId = null
    const timeoutId = window.setTimeout(() => {
      updateBucket()
      intervalId = window.setInterval(updateBucket, safeInterval)
    }, delayToNextBucket)

    document.addEventListener('visibilitychange', updateBucket)
    window.addEventListener('focus', updateBucket)

    return () => {
      window.clearTimeout(timeoutId)
      if (intervalId != null) window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', updateBucket)
      window.removeEventListener('focus', updateBucket)
    }
  }, [safeInterval])

  return bucket
}
