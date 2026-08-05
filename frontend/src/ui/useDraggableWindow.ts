import { useEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useUiStore } from '../stores/uiStore'
import type { UiWindowId } from '../stores/uiStore'

const MIN_VISIBLE = 80

export function useDraggableWindow(id: UiWindowId) {
  const position = useUiStore((state) => state.windowPositions[id])
  const setWindowPosition = useUiStore((state) => state.setWindowPosition)
  const dragRef = useRef<{ startX: number; startY: number; left: number; top: number } | null>(null)

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('button')) return
    event.preventDefault()
    dragRef.current = { startX: event.clientX, startY: event.clientY, left: position.left, top: position.top }
    const onMove = (move: PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      const maxLeft = Math.max(0, window.innerWidth - MIN_VISIBLE)
      const maxTop = Math.max(0, window.innerHeight - MIN_VISIBLE)
      setWindowPosition(id, {
        left: Math.max(0, Math.min(maxLeft, drag.left + move.clientX - drag.startX)),
        top: Math.max(0, Math.min(maxTop, drag.top + move.clientY - drag.startY)),
      })
    }
    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  useEffect(() => () => { dragRef.current = null }, [])

  return {
    style: { left: position.left, top: position.top, transform: 'none' as const },
    onPointerDown,
  }
}
