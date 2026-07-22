import { create } from 'zustand'
import { EventBus, GameEvents } from '../game/EventBus'

export type DefensePhase = 'idle' | 'wait' | 'combat' | 'victory' | 'defeat'
export type DefeatReason = 'base' | 'death' | 'timeout' | null

/**
 * 디펜스 게임 HUD 상태. Phaser의 DEFENSE_STATE 브로드캐스트로 갱신되고,
 * 구매 창/배치 모드 같은 UI 로컬 상태도 함께 관리한다.
 */
interface DefenseState {
  active: boolean          // 디펜스 씬 진입 여부 (HUD 표시 게이트)
  phase: DefensePhase
  timeLeftMs: number
  stage: number
  zombiesLeft: number
  baseHp: number
  maxBaseHp: number
  defeatReason: DefeatReason  // 패배 사유 (기지 파괴/사망/시간 초과)
  purchaseOpen: boolean    // 구매 창 열림
  placing: boolean         // 바리케이트 배치 대기(클릭 설치)
  pauseOpen: boolean       // ESC 일시정지 메뉴 열림
  setFromEvent: (p: {
    phase: DefensePhase; timeLeftMs: number; stage: number
    zombiesLeft: number; baseHp: number; maxBaseHp: number; defeatReason: DefeatReason
  }) => void
  setPurchaseOpen: (open: boolean) => void
  setPlacing: (placing: boolean) => void
  setPauseOpen: (open: boolean) => void
  reset: () => void
}

export const useDefenseStore = create<DefenseState>((set) => ({
  active: false,
  phase: 'idle',
  timeLeftMs: 0,
  stage: 1,
  zombiesLeft: 0,
  baseHp: 100,
  maxBaseHp: 100,
  defeatReason: null,
  purchaseOpen: false,
  placing: false,
  pauseOpen: false,
  setFromEvent: (p) => set({ active: true, ...p }),
  setPurchaseOpen: (purchaseOpen) => set({ purchaseOpen }),
  setPlacing: (placing) => set({ placing }),
  // 일시정지 메뉴 열림/닫힘에 맞춰 Phaser 씬을 pause/resume 한다 (좀비·타이머 정지)
  setPauseOpen: (pauseOpen) => { set({ pauseOpen }); EventBus.emit(GameEvents.DEFENSE_PAUSE, pauseOpen) },
  reset: () => set({ active: false, phase: 'idle', defeatReason: null, purchaseOpen: false, placing: false, pauseOpen: false }),
}))
