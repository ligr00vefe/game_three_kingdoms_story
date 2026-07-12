import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * 단축키 바인딩 저장소 (메이플 단축키 세팅 방식).
 * - 키는 KeyboardEvent.code 문자열 ('KeyZ', 'Space', 'ControlLeft' …)
 * - 하나의 기능을 여러 키에 배치할 수 있다 (예: 좌/우 Ctrl 모두 공격)
 * - ESC(설정)는 고정 키로, bindings에 포함하지 않는다
 * - localStorage에 영속화 — 게임 재접속 시 유지
 */
export type GameAction =
  | 'pickup'     // 줍기
  | 'sit'        // 앉기
  | 'attack'     // 공격
  | 'jump'       // 점프
  | 'quest'      // 퀘스트
  | 'minimap'    // 미니맵
  | 'item'       // 아이템(인벤토리)
  | 'equip'      // 장비창
  | 'stats'      // 스탯창
  | 'skillbook'  // 스킬창
  | 'screenshot' // 스크린샷

export interface ActionInfo {
  name: string
  /** 단축키 패널/퀵슬롯 배지 색 (메이플 계열 팔레트) */
  color: string
}

export const ACTION_INFO: Record<GameAction, ActionInfo> = {
  attack:     { name: '공격',   color: '#8d9099' },
  jump:       { name: '점프',   color: '#8d9099' },
  pickup:     { name: '줍기',   color: '#4db6ac' },
  sit:        { name: '앉기',   color: '#4db6ac' },
  item:       { name: '아이템', color: '#42a5f5' },
  equip:      { name: '장비',   color: '#5c6bc0' },
  stats:      { name: '스탯',   color: '#ec407a' },
  skillbook:  { name: '스킬창', color: '#66bb6a' },
  quest:      { name: '퀘스트', color: '#26a69a' },
  minimap:    { name: '미니맵', color: '#42a5f5' },
  screenshot: { name: '스샷',   color: '#ffb300' },
}

export const ALL_ACTIONS: GameAction[] = [
  'attack', 'jump', 'pickup', 'sit', 'item', 'equip', 'stats', 'skillbook', 'quest', 'minimap', 'screenshot',
]

/** UI 패널을 여는 토글형 액션 — 퀵슬롯(하단 안내키) 클릭 시 실제 기능 실행 대상 */
export const TOGGLE_ACTIONS: GameAction[] = ['item', 'equip', 'stats', 'skillbook', 'quest', 'minimap']

/** code → action. 기본 배치 (GAME_DESIGN 3장 키 배치 + 메이플 관례) */
export const DEFAULT_BINDINGS: Record<string, GameAction> = {
  ControlLeft: 'attack',
  ControlRight: 'attack',
  Space: 'jump',
  AltLeft: 'jump',
  AltRight: 'jump',
  KeyZ: 'pickup',
  KeyX: 'sit',
  KeyI: 'item',
  KeyE: 'equip',
  KeyS: 'stats',
  KeyK: 'skillbook',
  KeyQ: 'quest',
  KeyM: 'minimap',
  ScrollLock: 'screenshot',
}

interface KeybindingState {
  /** 저장된(적용 중인) 바인딩 */
  bindings: Record<string, GameAction>
  setBindings: (bindings: Record<string, GameAction>) => void
}

export const useKeybindingStore = create<KeybindingState>()(
  persist(
    (set) => ({
      bindings: { ...DEFAULT_BINDINGS },
      setBindings: (bindings) => set({ bindings: { ...bindings } }),
    }),
    { name: 'tks-keybindings-v1' },
  ),
)

/** 해당 기능이 배치된 첫 번째 키 (퀵슬롯 표시용). 없으면 null */
export function keyForAction(bindings: Record<string, GameAction>, action: GameAction): string | null {
  for (const [code, a] of Object.entries(bindings)) {
    if (a === action) return code
  }
  return null
}

/** KeyboardEvent.code → 화면 표시용 짧은 라벨 */
export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  if (code.startsWith('F') && /^F\d{1,2}$/.test(code)) return code
  const map: Record<string, string> = {
    Escape: 'ESC', Space: 'Space', Enter: 'Enter', Tab: 'Tab', Backspace: 'BS',
    ControlLeft: 'Ctrl', ControlRight: 'Ctrl', ShiftLeft: 'Shift', ShiftRight: 'Shift',
    AltLeft: 'Alt', AltRight: 'Alt',
    Insert: 'Ins', Home: 'Hm', PageUp: 'PUp', Delete: 'Del', End: 'End', PageDown: 'PDn',
    ScrollLock: 'SLk', PrintScreen: 'PSc', Pause: 'Brk',
    Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']',
    Backslash: '\\', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/',
  }
  return map[code] ?? code
}
