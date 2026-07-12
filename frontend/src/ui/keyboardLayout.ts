/**
 * 단축키 세팅 패널의 가상 키보드 배열 데이터 (텐키리스 표준 배열).
 * w: 키 너비(1u = 기본 키 1칸). gap: 빈 간격.
 * - fixed: 재배치 불가한 고정 기능 라벨 (ESC=설정, 방향키=이동)
 * - disabled: 배치 불가 키 (CapsLock, Win, PrtSc 등 브라우저 제약 키)
 */
export interface KeyDef {
  code: string
  label: string
  w?: number
  fixed?: string
  disabled?: boolean
}

export type LayoutItem = KeyDef | { gap: number }

export function isKeyDef(item: LayoutItem): item is KeyDef {
  return (item as KeyDef).code !== undefined
}

export const KEYBOARD_ROWS: LayoutItem[][] = [
  [
    { code: 'Escape', label: 'ESC', fixed: '설정' },
    { gap: 1 },
    { code: 'F1', label: 'F1' }, { code: 'F2', label: 'F2' }, { code: 'F3', label: 'F3' }, { code: 'F4', label: 'F4' },
    { gap: 0.5 },
    { code: 'F5', label: 'F5' }, { code: 'F6', label: 'F6' }, { code: 'F7', label: 'F7' }, { code: 'F8', label: 'F8' },
    { gap: 0.5 },
    { code: 'F9', label: 'F9' }, { code: 'F10', label: 'F10' }, { code: 'F11', label: 'F11' }, { code: 'F12', label: 'F12' },
    { gap: 0.5 },
    { code: 'PrintScreen', label: 'PSc', disabled: true },
    { code: 'ScrollLock', label: 'SLk' },
    { code: 'Pause', label: 'Brk' },
  ],
  [
    { code: 'Backquote', label: '`' },
    { code: 'Digit1', label: '1' }, { code: 'Digit2', label: '2' }, { code: 'Digit3', label: '3' },
    { code: 'Digit4', label: '4' }, { code: 'Digit5', label: '5' }, { code: 'Digit6', label: '6' },
    { code: 'Digit7', label: '7' }, { code: 'Digit8', label: '8' }, { code: 'Digit9', label: '9' },
    { code: 'Digit0', label: '0' }, { code: 'Minus', label: '-' }, { code: 'Equal', label: '=' },
    { code: 'Backspace', label: 'Bksp', w: 2 },
    { gap: 0.5 },
    { code: 'Insert', label: 'Ins' }, { code: 'Home', label: 'Hm' }, { code: 'PageUp', label: 'PUp' },
  ],
  [
    { code: 'Tab', label: 'Tab', w: 1.5 },
    { code: 'KeyQ', label: 'Q' }, { code: 'KeyW', label: 'W' }, { code: 'KeyE', label: 'E' },
    { code: 'KeyR', label: 'R' }, { code: 'KeyT', label: 'T' }, { code: 'KeyY', label: 'Y' },
    { code: 'KeyU', label: 'U' }, { code: 'KeyI', label: 'I' }, { code: 'KeyO', label: 'O' },
    { code: 'KeyP', label: 'P' }, { code: 'BracketLeft', label: '[' }, { code: 'BracketRight', label: ']' },
    { code: 'Backslash', label: '\\', w: 1.5 },
    { gap: 0.5 },
    { code: 'Delete', label: 'Del' }, { code: 'End', label: 'End' }, { code: 'PageDown', label: 'PDn' },
  ],
  [
    { code: 'CapsLock', label: 'Caps', w: 1.75, disabled: true },
    { code: 'KeyA', label: 'A' }, { code: 'KeyS', label: 'S' }, { code: 'KeyD', label: 'D' },
    { code: 'KeyF', label: 'F' }, { code: 'KeyG', label: 'G' }, { code: 'KeyH', label: 'H' },
    { code: 'KeyJ', label: 'J' }, { code: 'KeyK', label: 'K' }, { code: 'KeyL', label: 'L' },
    { code: 'Semicolon', label: ';' }, { code: 'Quote', label: "'" },
    { code: 'Enter', label: 'Enter', w: 2.25, fixed: '채팅' },
  ],
  [
    { code: 'ShiftLeft', label: 'Shift', w: 2.25 },
    { code: 'KeyZ', label: 'Z' }, { code: 'KeyX', label: 'X' }, { code: 'KeyC', label: 'C' },
    { code: 'KeyV', label: 'V' }, { code: 'KeyB', label: 'B' }, { code: 'KeyN', label: 'N' },
    { code: 'KeyM', label: 'M' }, { code: 'Comma', label: ',' }, { code: 'Period', label: '.' },
    { code: 'Slash', label: '/' },
    { code: 'ShiftRight', label: 'Shift', w: 2.75 },
    { gap: 1.5 },
    { code: 'ArrowUp', label: '▲', fixed: '이동' },
  ],
  [
    { code: 'ControlLeft', label: 'Ctrl', w: 1.25 },
    { code: 'MetaLeft', label: '', w: 1.25, disabled: true },
    { code: 'AltLeft', label: 'Alt', w: 1.25 },
    { code: 'Space', label: 'Space', w: 6.25 },
    { code: 'AltRight', label: 'Alt', w: 1.25 },
    { code: 'MetaRight', label: '', w: 1.25, disabled: true },
    { code: 'ControlRight', label: 'Ctrl', w: 2.5 },
    { gap: 0.5 },
    { code: 'ArrowLeft', label: '◀', fixed: '이동' },
    { code: 'ArrowDown', label: '▼', fixed: '이동' },
    { code: 'ArrowRight', label: '▶', fixed: '이동' },
  ],
]
