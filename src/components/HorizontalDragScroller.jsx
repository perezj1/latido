import { forwardRef, useCallback, useEffect, useRef } from 'react'

const DRAG_THRESHOLD = 5

const HorizontalDragScroller = forwardRef(function HorizontalDragScroller({
  children,
  className='',
  onScroll,
  style,
  ...props
}, forwardedRef) {
  const scrollerRef = useRef(null)
  const dragRef = useRef({
    active:false,
    dragged:false,
    pointerId:null,
    startX:0,
    startScrollLeft:0,
    resetTimer:null,
  })

  const assignRef = useCallback(node => {
    scrollerRef.current = node
    if (typeof forwardedRef === 'function') forwardedRef(node)
    else if (forwardedRef) forwardedRef.current = node
  }, [forwardedRef])

  useEffect(() => () => {
    if (dragRef.current.resetTimer) window.clearTimeout(dragRef.current.resetTimer)
  }, [])

  const finishDrag = (node, pointerId, cancel=false) => {
    const drag = dragRef.current
    if (!drag.active || drag.pointerId !== pointerId) return

    drag.active = false
    node.classList.remove('is-dragging')
    if (node.hasPointerCapture?.(pointerId)) node.releasePointerCapture(pointerId)

    if (cancel) {
      drag.dragged = false
      return
    }

    if (drag.dragged) {
      if (drag.resetTimer) window.clearTimeout(drag.resetTimer)
      drag.resetTimer = window.setTimeout(() => {
        drag.dragged = false
        drag.resetTimer = null
      }, 0)
    }
  }

  return (
    <div
      {...props}
      ref={assignRef}
      className={['latido-drag-scroll', className].filter(Boolean).join(' ')}
      style={style}
      onScroll={onScroll}
      onDragStart={event => event.preventDefault()}
      onPointerDown={event => {
        if (event.pointerType !== 'mouse' || event.button !== 0) return
        if (event.currentTarget.scrollWidth <= event.currentTarget.clientWidth) return

        const drag = dragRef.current
        if (drag.resetTimer) window.clearTimeout(drag.resetTimer)
        drag.active = true
        drag.dragged = false
        drag.pointerId = event.pointerId
        drag.startX = event.clientX
        drag.startScrollLeft = event.currentTarget.scrollLeft
      }}
      onPointerMove={event => {
        const drag = dragRef.current
        if (!drag.active || drag.pointerId !== event.pointerId) return

        const distance = event.clientX - drag.startX
        if (!drag.dragged && Math.abs(distance) < DRAG_THRESHOLD) return

        if (!drag.dragged) {
          drag.dragged = true
          event.currentTarget.classList.add('is-dragging')
          event.currentTarget.setPointerCapture?.(event.pointerId)
        }

        event.preventDefault()
        event.currentTarget.scrollLeft = drag.startScrollLeft - distance
      }}
      onPointerUp={event => finishDrag(event.currentTarget, event.pointerId)}
      onPointerCancel={event => finishDrag(event.currentTarget, event.pointerId, true)}
      onPointerLeave={event => {
        if (!dragRef.current.dragged) finishDrag(event.currentTarget, event.pointerId, true)
      }}
      onClickCapture={event => {
        const drag = dragRef.current
        if (!drag.dragged) return
        event.preventDefault()
        event.stopPropagation()
        drag.dragged = false
        if (drag.resetTimer) window.clearTimeout(drag.resetTimer)
        drag.resetTimer = null
      }}
    >
      {children}
    </div>
  )
})

export default HorizontalDragScroller
