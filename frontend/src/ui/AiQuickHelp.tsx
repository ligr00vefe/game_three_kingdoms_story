import { useAutoCombatStore } from '../stores/autoCombatStore'
import { useDraggableWindow } from './useDraggableWindow'

const COMMANDS = [
  ['적을 계속 공격해', '자동 사냥'],
  ['성을 최우선으로 지켜', '수비 전환'],
  ['침투하는 적을 처치해', '위험 적 추적'],
  ['방벽 뒤에서 지켜', '방벽 수비'],
  ['앞으로 이동해', '전방 이동'],
] as const

export function AiQuickHelp() {
  const visible = useAutoCombatStore((state) => state.quickHelpVisible)
  const windowDrag = useDraggableWindow('aiHelp')
  if (!visible) return null

  return (
    <aside className="ai-quick-help" style={windowDrag.style}>
      <div className="ai-quick-help__title" onPointerDown={windowDrag.onPointerDown}>
        <span>AI 명령어 예시</span>
        <button onClick={() => useAutoCombatStore.getState().setQuickHelpVisible(false)} aria-label="명령 안내 접기">−</button>
      </div>
      {COMMANDS.map(([command, description]) => (
        <div className="ai-quick-help__row" key={command}>
          <b>“{command}”</b><small>{description}</small>
        </div>
      ))}
    </aside>
  )
}
