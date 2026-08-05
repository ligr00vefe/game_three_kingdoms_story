import { useCallback, useEffect } from 'react'
import { useDefenseStore } from '../stores/defenseStore'
import { DEFENSE_TACTICS, useDefenseTacticsStore } from '../stores/defenseTacticsStore'
import type { DefenseTacticSlot } from '../stores/defenseTacticsStore'
import { useUiStore } from '../stores/uiStore'
import { EventBus, GameEvents } from '../game/EventBus'
import { useDraggableWindow } from './useDraggableWindow'

export function DefenseTacticsPanel() {
  const active = useDefenseStore((state) => state.active)
  const open = useDefenseStore((state) => state.tacticsOpen)
  const selectedSlot = useDefenseTacticsStore((state) => state.selectedSlot)
  const selectTacticStore = useDefenseTacticsStore((state) => state.selectTactic)
  const windowDrag = useDraggableWindow('tactics')

  const selectTactic = useCallback((slot: DefenseTacticSlot) => {
    selectTacticStore(slot)
    EventBus.emit(GameEvents.DEFENSE_TACTIC, slot)
  }, [selectTacticStore])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!useDefenseStore.getState().active) return
      const match = /^Digit([1-6])$/.exec(event.code)
      if (!match) return
      const ui = useUiStore.getState()
      if (ui.chatFocused || ui.settingsOpen || ui.keySettingsOpen || ui.cinematicOpen) return
      event.preventDefault()
      useDefenseStore.getState().setTacticsOpen(true)
      selectTactic(Number(match[1]) as DefenseTacticSlot)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectTactic])

  if (!active || !open) return null

  return (
    <div className="def-tactics ui-window" style={windowDrag.style} aria-label="디펜스 전술 및 명령">
      <div className="def-tactics__title ui-window__titlebar" onPointerDown={windowDrag.onPointerDown}>
        <span>전술·명령</span>
        <button className="def-tactics__close" onClick={() => useDefenseStore.getState().setTacticsOpen(false)} title="닫기">−</button>
      </div>
      <div className="def-tactics__list">
        {DEFENSE_TACTICS.map((tactic) => (
          <button key={tactic.slot} className={`def-tactic ${selectedSlot === tactic.slot ? 'def-tactic--active' : ''}`} onClick={() => selectTactic(tactic.slot)} title={`${tactic.name}: ${tactic.description}`}>
            <span className="def-tactic__key">{tactic.slot}</span>
            <span className="def-tactic__text"><b>{tactic.name}</b><small>{tactic.description}</small></span>
          </button>
        ))}
      </div>
    </div>
  )
}
