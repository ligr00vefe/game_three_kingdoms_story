import { useGameStore } from '../stores/gameStore'
import { EventBus, GameEvents } from '../game/EventBus'

/** 사망 UI (GAME_DESIGN 5.2): 회색 화면 + 부활 버튼 → 시작 지점 부활 */
export function DeathOverlay() {
  const dead = useGameStore((s) => s.playerDead)
  if (!dead) return null
  return (
    <div className="death-overlay">
      <p className="death-title">쓰러졌습니다…</p>
      <button className="death-revive" onClick={() => EventBus.emit(GameEvents.REVIVE)}>
        부활하기
      </button>
    </div>
  )
}
