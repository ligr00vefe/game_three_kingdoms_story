import { useEffect } from 'react'
import { useDefenseStore } from '../stores/defenseStore'
import type { DefensePhase, DefeatReason } from '../stores/defenseStore'
import { useGameStore } from '../stores/gameStore'
import { useScreenStore } from '../stores/screenStore'
import { EventBus, GameEvents } from '../game/EventBus'

interface DefenseStatePayload {
  phase: DefensePhase
  timeLeftMs: number
  stage: number
  zombiesLeft: number
  baseHp: number
  maxBaseHp: number
  defeatReason: DefeatReason
}

const DEFEAT_MSG: Record<'base' | 'death' | 'timeout', string> = {
  base: '기지가 파괴되었습니다',
  death: '캐릭터가 쓰러졌습니다',
  timeout: '시간 내 방어에 실패했습니다',
}

const BARRICADE_COST = 30

/** ms → "M:SS" */
function fmt(ms: number) {
  const total = Math.ceil(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * 디펜스 게임 HUD: 상단중앙 카운트다운/스테이지/기지HP, 하단 구매하기,
 * 구매 창(바리케이트), 승리 배너, 패배 오버레이.
 * Phaser의 DEFENSE_STATE / DEFENSE_PLACE_MODE 이벤트로 구동된다.
 */
export function DefenseHud() {
  const active = useDefenseStore((s) => s.active)
  const phase = useDefenseStore((s) => s.phase)
  const timeLeftMs = useDefenseStore((s) => s.timeLeftMs)
  const stage = useDefenseStore((s) => s.stage)
  const zombiesLeft = useDefenseStore((s) => s.zombiesLeft)
  const baseHp = useDefenseStore((s) => s.baseHp)
  const maxBaseHp = useDefenseStore((s) => s.maxBaseHp)
  const defeatReason = useDefenseStore((s) => s.defeatReason)
  const purchaseOpen = useDefenseStore((s) => s.purchaseOpen)
  const placing = useDefenseStore((s) => s.placing)
  const pauseOpen = useDefenseStore((s) => s.pauseOpen)
  const gold = useGameStore((s) => s.gold)

  useEffect(() => {
    const onState = (p: DefenseStatePayload) => useDefenseStore.getState().setFromEvent(p)
    const onPlaceMode = (v: boolean) => useDefenseStore.getState().setPlacing(v)
    // 디펜스가 아닌 맵(성밖/감숙성)에 진입하면 HUD를 완전히 끈다
    const onEnd = () => useDefenseStore.getState().reset()
    EventBus.on(GameEvents.DEFENSE_STATE, onState)
    EventBus.on(GameEvents.DEFENSE_PLACE_MODE, onPlaceMode)
    EventBus.on(GameEvents.DEFENSE_END, onEnd)
    return () => {
      EventBus.off(GameEvents.DEFENSE_STATE, onState)
      EventBus.off(GameEvents.DEFENSE_PLACE_MODE, onPlaceMode)
      EventBus.off(GameEvents.DEFENSE_END, onEnd)
    }
  }, [])

  if (!active) return null

  const buyBarricade = () => {
    if (gold < BARRICADE_COST) return
    useDefenseStore.getState().setPurchaseOpen(false)
    useDefenseStore.getState().setPlacing(true)
    EventBus.emit(GameEvents.DEFENSE_PLACE_MODE, true)
  }
  const cancelPlacing = () => {
    useDefenseStore.getState().setPlacing(false)
    EventBus.emit(GameEvents.DEFENSE_PLACE_MODE, false)
  }
  const exitDefense = () => {
    useDefenseStore.getState().reset()
    EventBus.emit(GameEvents.DEFENSE_EXIT)
  }

  // ESC 일시정지 메뉴
  const resumeGame = () => useDefenseStore.getState().setPauseOpen(false)
  const returnToLobby = () => {
    if (!window.confirm('대기실로 돌아가시겠습니까? 진행 중인 방어전은 사라집니다.')) return
    useDefenseStore.getState().setPauseOpen(false) // 씬 재개 후 언마운트 (pause 잔류 방지)
    useDefenseStore.getState().reset()
    useScreenStore.getState().setScreen('lobby')
  }
  const giveUp = () => {
    if (!window.confirm('방어전을 포기하고 감숙성으로 돌아가시겠습니까?')) return
    useDefenseStore.getState().setPauseOpen(false) // 씬 재개(트윈 복귀) 후 전환
    useDefenseStore.getState().reset()
    EventBus.emit(GameEvents.DEFENSE_EXIT)
  }

  const baseRatio = Math.max(0, Math.min(1, baseHp / maxBaseHp))

  return (
    <>
      {/* 상단중앙: 카운트다운 + 스테이지 정보 */}
      <div className="def-top">
        <div className="def-stage">STAGE {stage}</div>
        {phase === 'wait' && (
          <div className="def-timer def-timer--wait">
            대기 <span className="def-timer-num">{Math.ceil(timeLeftMs / 1000)}</span>
          </div>
        )}
        {phase === 'combat' && (
          <div className="def-timer def-timer--combat">{fmt(timeLeftMs)}</div>
        )}
        {(phase === 'combat' || phase === 'wait') && (
          <div className="def-info">
            <span className="def-zombies">🧟 남은 {zombiesLeft}</span>
            <div className="def-basehp">
              <span className="def-basehp-label">🏯 기지</span>
              <div className="def-basehp-track">
                <div className="def-basehp-fill" style={{ width: `${baseRatio * 100}%` }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Wave 시작 5초 전 경고 — 깜빡이며 임박을 알린다 */}
      {phase === 'wait' && timeLeftMs > 0 && timeLeftMs <= 5000 && (
        <div className="def-wave-warning" role="alert">
          ⚠ 곧 Wave가 시작됩니다. Warning...!
        </div>
      )}

      {/* 배치 안내 (바리케이트 배치 대기 중) */}
      {placing && (
        <div className="def-place-hint">
          맵 하단을 클릭해 바리케이트를 설치하세요
          <button className="def-place-cancel" onClick={cancelPlacing}>취소</button>
        </div>
      )}

      {/* 하단중앙: 구매하기 (대기 단계에만) */}
      {phase === 'wait' && !placing && (
        <button className="def-buy-btn" onClick={() => useDefenseStore.getState().setPurchaseOpen(true)}>
          구매하기
        </button>
      )}

      {/* 구매 창 */}
      {purchaseOpen && (
        <div className="def-shop-backdrop" onClick={() => useDefenseStore.getState().setPurchaseOpen(false)}>
          <div className="def-shop" onClick={(e) => e.stopPropagation()}>
            <div className="def-shop-title">방어 시설 구매</div>
            <button className="def-shop-item" onClick={buyBarricade} disabled={gold < BARRICADE_COST}>
              <div className="def-shop-icon">🧱</div>
              <div className="def-shop-name">바리케이트</div>
              <div className="def-shop-price">{BARRICADE_COST} G</div>
            </button>
            {gold < BARRICADE_COST && <p className="def-shop-warn">골드가 부족합니다 (보유 {gold} G)</p>}
            <button className="def-shop-close" onClick={() => useDefenseStore.getState().setPurchaseOpen(false)}>닫기</button>
          </div>
        </div>
      )}

      {/* 승리 배너 */}
      {phase === 'victory' && (
        <div className="def-banner def-banner--victory">
          <div className="def-banner-title">STAGE {stage} 클리어!</div>
          <div className="def-banner-sub">잠시 후 다음 스테이지…</div>
        </div>
      )}

      {/* 패배 오버레이 */}
      {phase === 'defeat' && (
        <div className="def-overlay">
          <div className="def-overlay-box">
            <div className="def-overlay-title">패배</div>
            <div className="def-overlay-sub">{(defeatReason && DEFEAT_MSG[defeatReason]) ?? '방어 실패'} · 도달 스테이지 {stage}</div>
            <button className="def-overlay-btn" onClick={exitDefense}>감숙성으로 나가기</button>
          </div>
        </div>
      )}

      {/* ESC 일시정지 메뉴 (디펜스 전용) */}
      {pauseOpen && (
        <div className="def-pause-backdrop">
          <div className="settings-menu">
            <div className="settings-title">일시정지</div>
            <button className="settings-item settings-item--dim" onClick={resumeGame}>게임으로 돌아가기 (ESC)</button>
            <div className="settings-sep" />
            <button className="settings-item" onClick={returnToLobby}>🏠 대기실로 돌아가기</button>
            <button className="settings-item settings-item--danger" onClick={giveUp}>🏳 포기하기 (감숙성으로)</button>
          </div>
        </div>
      )}
    </>
  )
}
