import { useEffect, useRef } from 'react'
import { useGameStore } from '../stores/gameStore'

/**
 * 우상단 보유 엽전(gold) 표시. 엽전은 획득/소비 시에만 바뀌는 저빈도 값이라
 * transient 구독으로 DOM만 직접 갱신하고, 값이 늘면 잠깐 강조(pop) 애니메이션을 준다.
 */
export function GoldDisplay() {
  const amountRef = useRef<HTMLSpanElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const prev = useRef<number>(useGameStore.getState().gold)

  useEffect(() => {
    const apply = (gold: number) => {
      if (amountRef.current) amountRef.current.textContent = gold.toLocaleString()
      if (boxRef.current && gold > prev.current) {
        boxRef.current.classList.remove('gold-hud--pop')
        void boxRef.current.offsetWidth // 리플로우로 애니메이션 재시작
        boxRef.current.classList.add('gold-hud--pop')
      }
      prev.current = gold
    }
    apply(useGameStore.getState().gold)
    return useGameStore.subscribe((s) => s.gold, apply)
  }, [])

  return (
    <div ref={boxRef} className="gold-hud" title="보유 엽전">
      <img className="gold-hud-icon" src="/assets/img/items/coin.png" alt="엽전" />
      <span ref={amountRef} className="gold-hud-amount">0</span>
    </div>
  )
}
