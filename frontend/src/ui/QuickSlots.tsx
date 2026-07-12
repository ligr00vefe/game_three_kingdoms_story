import { useKeybindingStore, ACTION_INFO, ALL_ACTIONS, keyForAction, keyLabel } from '../stores/keybindingStore'
import type { GameAction } from '../stores/keybindingStore'
import { useUiStore } from '../stores/uiStore'
import { EventBus, GameEvents } from '../game/EventBus'

/**
 * 우하단 단축키 안내바 (메이플 하단 키 표시).
 * 현재 키바인딩을 실시간 반영하며, 각 버튼을 누르면 그 키의 실제 기능이 실행된다 (②).
 * - 패널 토글류(아이템/장비/스탯/스킬창/퀘스트/미니맵): 해당 창 토글
 * - 스샷: 캡처 요청
 * - 순수 조작키(공격/점프/줍기/앉기): 안내 표시만 (클릭 동작 없음)
 * - 전투 스킬은 여기 없음: 스킬창에서 퀵슬롯(숫자키 1~7)으로 드래그해 등록/발동한다
 */
const ACTION_HANDLERS: Partial<Record<GameAction, () => void>> = {
  item: () => EventBus.emit(GameEvents.TOGGLE_INVENTORY),
  equip: () => useUiStore.getState().toggleEquip(),
  stats: () => useUiStore.getState().toggleStats(),
  skillbook: () => useUiStore.getState().toggleSkillbook(),
  quest: () => useUiStore.getState().toggleQuest(),
  minimap: () => useUiStore.getState().toggleMinimap(),
  screenshot: () => EventBus.emit(GameEvents.REQUEST_SCREENSHOT),
}

export function QuickSlots() {
  const bindings = useKeybindingStore((s) => s.bindings)

  return (
    <div className="quickslots" title="단축키 안내 — 누르면 해당 기능이 실행됩니다">
      {ALL_ACTIONS.map((action) => {
        const code = keyForAction(bindings, action)
        const info = ACTION_INFO[action]
        const handler = ACTION_HANDLERS[action]
        return (
          <button
            key={action}
            className={`qslot ${code ? '' : 'qslot--empty'} ${handler ? 'qslot--clickable' : ''}`}
            disabled={!handler}
            onClick={() => handler?.()}
            title={code ? `${info.name} (${keyLabel(code)})` : `${info.name} (미배치)`}
          >
            <span className="qslot-key">{code ? keyLabel(code) : '—'}</span>
            <span className="qslot-name" style={{ background: code ? info.color : '#44454d' }}>
              {info.name}
            </span>
          </button>
        )
      })}
    </div>
  )
}
