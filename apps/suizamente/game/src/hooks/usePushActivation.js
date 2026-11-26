import { useCallback, useEffect, useRef, useState } from 'react'
import { getPushStatus, PUSH_STATUS_EVENT } from '../lib/pushNotifications'

const EMPTY_STATUS = { supported: false, permission: 'default', subscribed: false }

export function usePushActivation(userId) {
  const [resolved, setResolved] = useState(null),owner=useRef(userId)
  owner.current=userId
  const ready=!!resolved&&resolved.owner===userId,status=ready?resolved.status:EMPTY_STATUS

  const refresh = useCallback(async () => {
    if (!userId) {
      setResolved({owner:userId,status:EMPTY_STATUS})
      return
    }

    try {
      const next=await getPushStatus(userId)
      if(owner.current===userId)setResolved({owner:userId,status:next})
      return next
    } catch {
      if(owner.current===userId)setResolved({owner:userId,status:{ supported: false, permission: 'unsupported', subscribed: false }})
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
    ready,
    needsActivation: Boolean(userId && status.supported && !status.subscribed),
    refresh,
  }
}
