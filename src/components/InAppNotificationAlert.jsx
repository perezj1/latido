import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppNotifications } from '../hooks/useAppNotifications'

const ALERT_DURATION_MS = 5000
const SWIPE_THRESHOLD_PX = 38

export default function InAppNotificationAlert() {
  const navigate = useNavigate()
  const { groups, markSeen, markGroupRead } = useAppNotifications()
  const [queue, setQueue] = useState([])
  const [dragOffset, setDragOffset] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const shownIdsRef = useRef(new Set())
  const pointerStartRef = useRef(null)
  const dragOffsetRef = useRef(0)
  const suppressClickRef = useRef(false)
  const dismissTimerRef = useRef(null)

  useEffect(() => {
    for (const group of groups) {
      const freshIds = group.unseenIds.filter(id => !shownIdsRef.current.has(id))
      if (!freshIds.length) continue

      freshIds.forEach(id => shownIdsRef.current.add(id))
      setQueue(currentQueue => {
        const existingIndex = currentQueue.findIndex(item => item.kind === group.kind)
        if (existingIndex < 0) return [...currentQueue, group]
        return currentQueue.map((item, index) => index === existingIndex ? group : item)
      })
      void markSeen(group, freshIds)
    }
  }, [groups, markSeen])

  useEffect(() => {
    setQueue(currentQueue => currentQueue
      .map(queuedGroup => groups.find(group => group.kind === queuedGroup.kind) || null)
      .filter(Boolean))
  }, [groups])

  const current = queue[0] || null
  const currentKey = current ? `${current.kind}:${current.latestAt}:${current.count}` : ''

  const showNext = useCallback(() => {
    if (!current || leaving) return
    window.clearTimeout(dismissTimerRef.current)
    setLeaving(true)
    dragOffsetRef.current = -72
    setDragOffset(-72)
    window.setTimeout(() => {
      setQueue(currentQueue => currentQueue.slice(1))
      dragOffsetRef.current = 0
      setDragOffset(0)
      setLeaving(false)
    }, 170)
  }, [current, leaving])

  useEffect(() => {
    if (!current) return undefined
    window.clearTimeout(dismissTimerRef.current)
    dismissTimerRef.current = window.setTimeout(showNext, ALERT_DURATION_MS)
    return () => window.clearTimeout(dismissTimerRef.current)
  }, [current, currentKey, showNext])

  useEffect(() => () => {
    window.clearTimeout(dismissTimerRef.current)
  }, [])

  const progressLabel = useMemo(() => {
    if (queue.length <= 1) return ''
    return `Quedan ${queue.length} alertas`
  }, [queue.length])

  if (!current) return null

  const handlePointerDown = event => {
    if (leaving) return
    suppressClickRef.current = false
    pointerStartRef.current = { pointerId:event.pointerId, y:event.clientY }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    window.clearTimeout(dismissTimerRef.current)
  }

  const handlePointerMove = event => {
    if (pointerStartRef.current?.pointerId !== event.pointerId) return
    const offset = Math.min(0, event.clientY - pointerStartRef.current.y)
    if (Math.abs(offset) > 6) suppressClickRef.current = true
    dragOffsetRef.current = offset
    setDragOffset(offset)
  }

  const handlePointerEnd = event => {
    if (pointerStartRef.current?.pointerId !== event.pointerId) return
    pointerStartRef.current = null
    if (dragOffsetRef.current <= -SWIPE_THRESHOLD_PX) {
      showNext()
      return
    }
    dragOffsetRef.current = 0
    setDragOffset(0)
    dismissTimerRef.current = window.setTimeout(showNext, ALERT_DURATION_MS)
    window.setTimeout(() => { suppressClickRef.current = false }, 0)
  }

  const openNotification = () => {
    if (suppressClickRef.current || Math.abs(dragOffsetRef.current) > 6 || leaving) return
    void markGroupRead(current)
    setQueue(currentQueue => currentQueue.slice(1))
    dragOffsetRef.current = 0
    setDragOffset(0)
    navigate(current.href)
  }

  return (
    <div className="latido-alert-stack" aria-live="polite" aria-atomic="true">
      <div
        className="latido-in-app-alert"
        role="status"
        style={{
          opacity:leaving ? 0 : Math.max(.35, 1 + dragOffset / 110),
          transform:`translate3d(0, ${dragOffset}px, 0) scale(${leaving ? .98 : 1})`,
          transition:pointerStartRef.current ? 'none' : 'transform 170ms ease, opacity 170ms ease',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        <button type="button" className="latido-in-app-alert__content" onClick={openNotification}>
          <span className="latido-in-app-alert__icon" aria-hidden="true">{current.icon}</span>
          <span className="latido-in-app-alert__copy">
            <span className="latido-in-app-alert__brand">LATIDO</span>
            <strong>{current.title}</strong>
            <span>{current.body}</span>
          </span>
        </button>
        <button type="button" className="latido-in-app-alert__close" onClick={showNext} aria-label={queue.length > 1 ? 'Siguiente alerta' : 'Cerrar alerta'}>
          ×
        </button>
        {progressLabel && <span className="sr-only">{progressLabel}</span>}
      </div>
    </div>
  )
}
