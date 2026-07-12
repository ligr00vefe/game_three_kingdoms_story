import { useEffect, useRef } from 'react'
import { useGameStore } from '../stores/gameStore'

/**
 * 최하단 경험치 바 (메이플 스타일): 화면 폭 전체 + "누적치 [퍼센트%]" 텍스트.
 * transient 구독으로 DOM 직접 갱신 — React 리렌더 없음.
 */
export function ExpBar() {
  const fillRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const apply = () => {
      const s = useGameStore.getState()
      const pct = (s.exp / s.expToNext) * 100
      if (fillRef.current) fillRef.current.style.width = `${pct}%`
      if (textRef.current) textRef.current.textContent = `${s.exp} [${pct.toFixed(2)}%]`
    }
    apply()
    const unsub = useGameStore.subscribe((s) => [s.exp, s.expToNext], apply)
    return unsub
  }, [])

  return (
    <div className="expbar">
      <div ref={fillRef} className="expbar-fill" />
      <span ref={textRef} className="expbar-text" />
    </div>
  )
}
