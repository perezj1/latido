import { useCallback, useEffect, useState } from 'react'
import { getPushStatus, PUSH_STATUS_EVENT } from '../lib/pushNotifications'

const EMPTY_STATUS = { supported: false, permission: 'default', subscribed: false }

export function usePushActivation(userId) {
  const [status, setStatus] = useState(EMPTY_STATUS)

  const refresh = useCallback(async () => {
    if (!userId) {
      setStatus(EMPTY_STATUS)
      return
    }

    try {
      setStatus(await getPushStatus())
    } catch {
      setStatus({ supported: false, permission: 'unsupported', subscribed: false })
    }
  }, [userId])

  useEffect(() => {
    refresh()

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refresh()
    }

    window.addEventListener(PUSH_STATUS_EVENT, refresh)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.removeEventListener(PUSH_STATUS_EVENT, refresh)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [refresh])

  return {
    status,
    needsActivation: Boolean(userId && status.supported && !status.subscribed),
    refresh,
  }
}
