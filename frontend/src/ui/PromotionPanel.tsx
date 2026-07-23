import { useEffect } from 'react'
import { usePromotionStore } from '../stores/promotionStore'
import { useGameStore } from '../stores/gameStore'
import { EventBus, GameEvents } from '../game/EventBus'
import { titleForTier } from '../game/systems/playerAnimations'

/**
 * 관청 전직 신청 창 (레벨 조건 충족 시 전공관 상호작용으로 열림).
 * 현재/다음 직책과 안내를 보여준다. 상위 티어 외형 아트가 아직 없어
 * 전직 버튼은 비활성(준비 중) 상태다 — 아트가 준비되면 활성화한다.
 */
export function PromotionPanel() {
  const open = usePromotionStore((s) => s.open)
  const jobTier = useGameStore((s) => s.jobTier)
  const level = useGameStore((s) => s.level)

  useEffect(() => {
    const onOpen = () => usePromotionStore.getState().setOpen(true)
    EventBus.on(GameEvents.OPEN_PROMOTION, onOpen)
    return () => { EventBus.off(GameEvents.OPEN_PROMOTION, onOpen) }
  }, [])

  if (!open) return null

  const close = () => usePromotionStore.getState().setOpen(false)
  const currentTitle = titleForTier(jobTier)
  const nextTitle = titleForTier(jobTier + 1)

  return (
    <div className="promo-backdrop" onClick={close}>
      <div className="promo-panel" onClick={(e) => e.stopPropagation()}>
        <div className="promo-title">관청 · 전직 신청</div>
        <p className="promo-story">
          전공관이 전공 명부를 펼쳐 든다. “관우 장군, 그대의 전공은 익히 들었네.
          허나 지금은 조정의 인준이 아직 내려오지 않았소.”
        </p>

        <div className="promo-ranks">
          <div className="promo-rank">
            <div className="promo-rank-label">현재 직책</div>
            <div className="promo-rank-name">{currentTitle}</div>
          </div>
          <div className="promo-arrow">▶</div>
          <div className="promo-rank promo-rank--next">
            <div className="promo-rank-label">다음 직책</div>
            <div className="promo-rank-name">{nextTitle}</div>
          </div>
        </div>

        <p className="promo-note">
          전직 외형 데이터를 준비 중입니다. 곧 이 자리에서 <b>{nextTitle}</b>으로 전직할 수 있습니다.
          (현재 레벨 {level})
        </p>

        <button className="promo-apply" disabled title="전직 준비 중 — 곧 열립니다">
          전직 (준비 중)
        </button>
        <button className="promo-close" onClick={close}>물러가기</button>
      </div>
    </div>
  )
}
