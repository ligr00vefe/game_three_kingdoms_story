import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { DEFAULT_WINDOW_POSITIONS, useUiStore } from '../stores/uiStore'
import type { UiWindowId } from '../stores/uiStore'

const MIN_VISIBLE = 80
const EDGE_GAP = 8

const RESPONSIVE_DEFAULT_STYLE: Record<UiWindowId, CSSProperties> = {
  minimap: { left: EDGE_GAP, top: EDGE_GAP },
  stats: { left: EDGE_GAP, top: 110 },
  // Character info is 272px wide plus borders; keep the same 8px gap between windows.
  skillbook: { left: 292, top: 110 },
  aiHelp: { right: EDGE_GAP, top: 54 },
}

export function useDraggableWindow(id: UiWindowId) {
  const position = useUiStore((state) => state.windowPositions[id])
  const setWindowPosition = useUiStore((state) => state.setWindowPosition)
  const dragRef = useRef<{ startX: number; startY: number; left: number; top: number } | null>(null)
  const initial = DEFAULT_WINDOW_POSITIONS[id]
  const untouched = position.left === initial.left && position.top === initial.top

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('button')) return
    event.preventDefault()
    const windowElement = event.currentTarget.parentElement
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      left: windowElement?.offsetLeft ?? position.left,
      top: windowElement?.offsetTop ?? position.top,
    }
    const boundsElement = windowElement?.offsetParent as HTMLElement | null
    const onMove = (move: PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      // UI 오버레이는 화면에 축소되어 보이지만 CSS 좌표계는 더 넓다.
      // 브라우저 viewport가 아니라 창의 offsetParent(대개 .ui-overlay)를 기준으로 제한한다.
      const maxLeft = Math.max(0, (boundsElement?.clientWidth ?? window.innerWidth) - (windowElement?.offsetWidth ?? MIN_VISIBLE))
      const maxTop = Math.max(0, (boundsElement?.clientHeight ?? window.innerHeight) - (windowElement?.offsetHeight ?? MIN_VISIBLE))
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
    style: untouched
      ? { ...RESPONSIVE_DEFAULT_STYLE[id], transform: 'none' as const }
      : { left: position.left, top: position.top, transform: 'none' as const },
    onPointerDown,
  }
}
