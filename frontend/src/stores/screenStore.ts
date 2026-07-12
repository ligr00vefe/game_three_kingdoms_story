import { create } from 'zustand'

/**
 * 앱 화면 전환 상태: 대기실(캐릭터 선택) → 로딩 → 게임.
 * - lobby: 캐릭터 선택 화면 (Phaser 미기동)
 * - loading: Phaser 마운트 + 로딩 오버레이 (SCENE_READY + 최소 표시 시간 후 game 전환)
 * - game: 인게임 (HUD/패널 표시)
 */
export type Screen = 'lobby' | 'loading' | 'game'

interface ScreenState {
  screen: Screen
  /** 대기실에서 선택한 캐릭터 코드 (지금은 관우만) */
  selectedCharacter: string
  setScreen: (screen: Screen) => void
  selectCharacter: (code: string) => void
}

export const useScreenStore = create<ScreenState>((set) => ({
  screen: 'lobby',
  selectedCharacter: 'guanwu',
  setScreen: (screen) => set({ screen }),
  selectCharacter: (selectedCharacter) => set({ selectedCharacter }),
}))
