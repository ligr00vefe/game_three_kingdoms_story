import { useEffect, useState } from 'react'
import { useInventoryStore, INVENTORY_SIZE } from '../stores/inventoryStore'
import type { ItemType } from '../stores/inventoryStore'
import { useGameStore } from '../stores/gameStore'
import { useUiStore } from '../stores/uiStore'
import { EventBus, GameEvents } from '../game/EventBus'
import { CATEGORY_LABEL } from '../stores/equipmentStore'

type Tab = 'EQUIP' | 'CONSUME' | 'ETC'

/** 탭 분류 (GAME_DESIGN 8.2): 장비 탭에 아티팩트 포함 */
const TAB_TYPES: Record<Tab, ItemType[]> = {
  EQUIP: ['EQUIP', 'ARTIFACT'],
  CONSUME: ['CONSUME'],
  ETC: ['ETC'],
}

const TAB_LABEL: Record<Tab, string> = { EQUIP: '장비', CONSUME: '소비', ETC: '기타' }

/** 아이콘 placeholder 색 (Phase 7에서 실제 아이콘 이미지로 교체) */
const TYPE_COLOR: Record<ItemType, string> = {
  EQUIP: '#42a5f5', CONSUME: '#ef5350', ETC: '#ffb74d', ARTIFACT: '#ab47bc',
}

/**
 * 인벤토리 (GAME_DESIGN 8.2): I키 토글, 24칸 격자, 게임은 멈추지 않음.
 * - 장비: 장비창(부위 일치 칸)으로 드래그해 장착
 * - 소비: 클릭 사용 또는 퀵슬롯으로 드래그 등록
 * - 하단 스킬 칩: 퀵슬롯으로 드래그해 스킬 등록
 */
export function InventoryPanel() {
  const open = useInventoryStore((s) => s.open)
  const slots = useInventoryStore((s) => s.slots)
  const defs = useInventoryStore((s) => s.defs)
  const gold = useGameStore((s) => s.gold)
  const [tab, setTab] = useState<Tab>('EQUIP')

  useEffect(() => {
    const toggle = () => useInventoryStore.getState().setOpen(!useInventoryStore.getState().open)
    EventBus.on(GameEvents.TOGGLE_INVENTORY, toggle)
    return () => { EventBus.off(GameEvents.TOGGLE_INVENTORY, toggle) }
  }, [])

  if (!open) return null

  const onSlotClick = (index: number) => {
    const slot = slots[index]
    if (!slot) return
    const type = defs[slot.code]?.itemType
    if (type === 'CONSUME') useInventoryStore.getState().useConsumable(index)
    // 장비/아티팩트는 장비창으로 드래그해 장착 (부위 검증)
  }

  return (
    <div className="inv-panel">
      <div className="inv-header">
        <span className="inv-title">인벤토리</span>
        <button className="inv-equip-btn" onClick={() => useUiStore.getState().toggleEquip()}>장비창</button>
        <span className="inv-gold">{gold.toLocaleString()} G</span>
        <button className="inv-close" onClick={() => useInventoryStore.getState().setOpen(false)}>×</button>
      </div>
      <div className="inv-tabs">
        {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
          <button key={t} className={`inv-tab ${tab === t ? 'inv-tab--on' : ''}`} onClick={() => setTab(t)}>
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>
      <div className="inv-grid">
        {Array.from({ length: INVENTORY_SIZE }, (_, i) => {
          const slot = slots[i]
          const def = slot ? defs[slot.code] : undefined
          const visible = slot && def && TAB_TYPES[tab].includes(def.itemType)
          const catLabel = def?.category ? ` [${CATEGORY_LABEL[def.category]}]` : ''
          return (
            <button
              key={i}
              className="inv-slot"
              draggable={!!visible}
              onDragStart={(e) => {
                if (!visible || !slot) return
                e.dataTransfer.setData(
                  'text/plain',
                  JSON.stringify({ type: 'inv-item', index: i, code: slot.code, itemType: def!.itemType }),
                )
                e.dataTransfer.effectAllowed = 'move'
              }}
              onClick={() => visible && onSlotClick(i)}
              title={visible && def ? `${def.name}${catLabel}\n${def.description}` : undefined}
            >
              {visible && def && (
                <>
                  <span className="inv-icon" style={{ background: TYPE_COLOR[def.itemType] }}>
                    {def.name.charAt(0)}
                  </span>
                  {slot!.quantity > 1 && <span className="inv-qty">{slot!.quantity}</span>}
                </>
              )}
            </button>
          )
        })}
      </div>
      <p className="inv-hint">소비: 클릭 사용 · 장비: 장비창으로 드래그 · 아이템: 퀵슬롯으로 드래그 (스킬은 스킬창에서 등록)</p>
    </div>
  )
}
