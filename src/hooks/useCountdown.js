import { useEffect, useState } from 'react'

export function countdownFrom(endAt, now = Date.now()) {
  const totalMs = Math.max(0, new Date(endAt).getTime() - now)
  const totalSeconds = Math.floor(totalMs / 1000)

  return {
    totalMs,
    expired:totalMs <= 0,
    days:Math.floor(totalSeconds / 86400),
    hours:Math.floor((totalSeconds % 86400) / 3600),
    minutes:Math.floor((totalSeconds % 3600) / 60),
    seconds:totalSeconds % 60,
  }
}

export function useCountdown(endAt) {
  const [remaining, setRemaining] = useState(() => countdownFrom(endAt))

  useEffect(() => {
    const update = () => setRemaining(countdownFrom(endAt))
    update()
    const interval = window.setInterval(update, 1000)
    document.addEventListener('visibilitychange', update)

    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', update)
    }
  }, [endAt])

  return remaining
}
