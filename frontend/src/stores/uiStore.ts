import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { EventBus, GameEvents } from '../game/EventBus'

/**
 * UI 패널 열림 상태 저장소.
 * - 설정(ESC)/단축키 세팅/채팅 입력 중에는 게임 키 입력을 차단한다 (INPUT_BLOCK)
 * - 퀘스트/미니맵은 게임을 막지 않는 비모달 (메이플 방식)
 */
interface UiState {
  settingsOpen: boolean
  keySettingsOpen: boolean
  questOpen: boolean
  minimapOpen: boolean
  equipOpen: boolean
  statsOpen: boolean
  skillbookOpen: boolean
  chatFocused: boolean
  setSettingsOpen: (open: boolean) => void
  setKeySettingsOpen: (open: boolean) => void
  toggleQuest: () => void
  toggleMinimap: () => void
  toggleEquip: () => void
  toggleStats: () => void
  toggleSkillbook: () => void
  setChatFocused: (focused: boolean) => void
}

export const useUiStore = create<UiState>()(
  subscribeWithSelector((set) => ({
    settingsOpen: false,
    keySettingsOpen: false,
    questOpen: false,
    minimapOpen: true,
    equipOpen: false,
    statsOpen: false,
    skillbookOpen: false,
    chatFocused: false,
    setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
    setKeySettingsOpen: (keySettingsOpen) => set({ keySettingsOpen }),
    toggleQuest: () => set((s) => ({ questOpen: !s.questOpen })),
    toggleMinimap: () => set((s) => ({ minimapOpen: !s.minimapOpen })),
    toggleEquip: () => set((s) => ({ equipOpen: !s.equipOpen })),
    toggleStats: () => set((s) => ({ statsOpen: !s.statsOpen })),
    toggleSkillbook: () => set((s) => ({ skillbookOpen: !s.skillbookOpen })),
    setChatFocused: (chatFocused) => set({ chatFocused }),
  })),
)

// 모달 상태 변화 → Phaser 키 입력 차단 통지
useUiStore.subscribe(
  (s) => s.settingsOpen || s.keySettingsOpen || s.chatFocused,
  (blocked) => EventBus.emit(GameEvents.INPUT_BLOCK, blocked),
)

// Phaser 단축키 → 패널 토글 (게임 쪽은 이벤트만 쏘고 UI 상태는 여기서 관리)
EventBus.on(GameEvents.TOGGLE_QUEST, () => useUiStore.getState().toggleQuest())
EventBus.on(GameEvents.TOGGLE_MINIMAP, () => useUiStore.getState().toggleMinimap())
