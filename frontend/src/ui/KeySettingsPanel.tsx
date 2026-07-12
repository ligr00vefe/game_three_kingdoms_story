import { useMemo, useState } from 'react'
import { useUiStore } from '../stores/uiStore'
import {
  useKeybindingStore, DEFAULT_BINDINGS, ACTION_INFO, ALL_ACTIONS, keyLabel,
} from '../stores/keybindingStore'
import type { GameAction } from '../stores/keybindingStore'
import { KEYBOARD_ROWS, isKeyDef } from './keyboardLayout'

const KEY_UNIT = 46 // 1u 키 너비(px)

function sameBindings(a: Record<string, GameAction>, b: Record<string, GameAction>) {
  const ka = Object.keys(a)
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k])
}

/**
 * 단축키 세팅 패널 (메이플 키보드 UI).
 * 사용법: 아래 기능 배지를 클릭해 든 뒤 키를 클릭해 배치.
 * 배치된 키를 클릭하면 기능을 집어들어 옮기거나(다른 키 클릭) 해제(배지 다시 클릭)할 수 있다.
 * 저장하기 전까지는 게임에 반영되지 않는다 (draft 방식).
 */
export function KeySettingsPanel() {
  const open = useUiStore((s) => s.keySettingsOpen)
  const saved = useKeybindingStore((s) => s.bindings)
  const [draft, setDraft] = useState<Record<string, GameAction>>(saved)
  const [picked, setPicked] = useState<GameAction | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)

  const dirty = useMemo(() => !sameBindings(draft, saved), [draft, saved])

  if (!open) return null

  const close = () => {
    useUiStore.getState().setKeySettingsOpen(false)
    setDraft(useKeybindingStore.getState().bindings) // 미저장 변경 폐기
    setPicked(null)
  }

  const onKeyClick = (code: string) => {
    if (picked) {
      setDraft({ ...draft, [code]: picked })
      setPicked(null)
      return
    }
    const current = draft[code]
    if (current) {
      const next = { ...draft }
      delete next[code]
      setDraft(next)
      setPicked(current) // 집어들기 — 다른 키에 놓거나 배지를 눌러 취소(해제)
    }
  }

  const onPaletteClick = (action: GameAction) => {
    setPicked(picked === action ? null : action)
  }

  const keysOf = (action: GameAction) =>
    Object.entries(draft).filter(([, a]) => a === action).map(([code]) => keyLabel(code))

  const save = () => {
    useKeybindingStore.getState().setBindings(draft)
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1500)
  }

  return (
    <div className="ks-backdrop">
      <div className="ks-panel">
        <div className="ks-titlebar">KEYBOARD SHORTCUTS</div>
        <div className="ks-header">
          <span className="ks-title">단축키 세팅</span>
          <span className="ks-title-en">KEYBOARD SHORTCUTS</span>
          <button className="ks-close" onClick={close}>×</button>
        </div>

        <div className="ks-keyboard">
          {KEYBOARD_ROWS.map((row, ri) => (
            <div className="ks-row" key={ri}>
              {row.map((item, i) => {
                if (!isKeyDef(item)) {
                  return <span key={i} style={{ width: item.gap * KEY_UNIT }} />
                }
                const w = (item.w ?? 1) * KEY_UNIT - 4
                if (item.disabled) {
                  return (
                    <span key={item.code} className="ks-key ks-key--disabled" style={{ width: w }}>
                      <span className="ks-key-label">{item.label}</span>
                    </span>
                  )
                }
                const action = draft[item.code]
                const info = action ? ACTION_INFO[action] : null
                return (
                  <button
                    key={item.code}
                    className={`ks-key ${item.fixed ? 'ks-key--fixed' : ''} ${info ? 'ks-key--bound' : ''}`}
                    style={{ width: w }}
                    onClick={() => !item.fixed && onKeyClick(item.code)}
                    title={item.fixed ? `${item.label} — ${item.fixed} (고정)` : item.label}
                  >
                    <span className="ks-key-label">{item.label}</span>
                    {item.fixed && <span className="ks-badge ks-badge--fixed">{item.fixed}</span>}
                    {info && <span className="ks-badge" style={{ background: info.color }}>{info.name}</span>}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        <div className="ks-palette">
          <span className="ks-palette-hint">
            {picked
              ? <>배치할 기능: <b style={{ color: ACTION_INFO[picked].color }}>{ACTION_INFO[picked].name}</b> — 원하는 키를 클릭하세요 (배지를 다시 누르면 취소)</>
              : '기능 배지를 클릭한 뒤 키보드의 키를 클릭해 배치합니다. 배치된 키를 클릭하면 옮기거나 해제할 수 있습니다.'}
          </span>
          <div className="ks-chips">
            {ALL_ACTIONS.map((action) => {
              const info = ACTION_INFO[action]
              const keys = keysOf(action)
              return (
                <button
                  key={action}
                  className={`ks-chip ${picked === action ? 'ks-chip--picked' : ''}`}
                  onClick={() => onPaletteClick(action)}
                >
                  <span className="ks-chip-badge" style={{ background: info.color }}>{info.name}</span>
                  <span className="ks-chip-keys">{keys.length ? keys.join(' ') : '미배치'}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="ks-footer">
          <div className="ks-footer-left">
            <button className="ks-btn" onClick={() => { setDraft({ ...DEFAULT_BINDINGS }); setPicked(null) }}>초기화</button>
            <button className="ks-btn" onClick={() => { setDraft({}); setPicked(null) }}>비우기</button>
          </div>
          <div className="ks-footer-right">
            {savedFlash && <span className="ks-saved">저장 완료!</span>}
            <button className="ks-btn" disabled={!dirty} onClick={() => { setDraft(saved); setPicked(null) }}>원래대로</button>
            <button className="ks-btn ks-btn--save" disabled={!dirty} onClick={save}>저장하기</button>
          </div>
        </div>
      </div>
    </div>
  )
}
