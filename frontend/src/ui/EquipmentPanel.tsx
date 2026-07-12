import { useState } from 'react'
import { useEquipmentStore, SLOT_LABEL, SLOT_CATEGORY, CATEGORY_LABEL } from '../stores/equipmentStore'
import type { EquipSlotId } from '../stores/equipmentStore'
import { useInventoryStore } from '../stores/inventoryStore'
import { useUiStore } from '../stores/uiStore'

/** 장비칸 배치 (메이플 EQUIPMENT INVENTORY 구도의 간략판): 3열 × 4행 */
const SLOT_LAYOUT: EquipSlotId[][] = [
  ['cap', 'cape', 'acc1'],
  ['clothes', 'gloves', 'acc2'],
  ['pants', 'shoes', 'acc3'],
  ['weapon', 'subweapon', 'acc4'],
]

/** 카테고리별 썸네일 색 (아이콘 아트 도입 전 placeholder) */
const CATEGORY_COLOR: Record<string, string> = {
  cap: '#f9a825', cape: '#8d6e63', clothes: '#42a5f5', gloves: '#7e57c2',
  pants: '#26a69a', shoes: '#5d4037', weapon: '#ef5350', subweapon: '#ff7043',
  accessory: '#ab47bc',
}

/**
 * 장비창 (EQUIPMENT INVENTORY).
 * - 인벤토리에서 장비를 드래그해 부위가 일치하는 칸에 놓으면 장착 (⑪ 부위 검증)
 * - 불일치 칸에 놓으면 붉게 번쩍이며 거부
 * - 장착된 칸 클릭 → 해제(인벤토리로), 칸에는 아이템 썸네일 표시 (⑨)
 */
export function EquipmentPanel() {
  const open = useUiStore((s) => s.equipOpen)
  const equipped = useEquipmentStore((s) => s.equipped)
  const defs = useInventoryStore((s) => s.defs)
  const [rejectSlot, setRejectSlot] = useState<EquipSlotId | null>(null)

  if (!open) return null

  const onDrop = (e: React.DragEvent, slotId: EquipSlotId) => {
    e.preventDefault()
    let data: { type?: string; index?: number } = {}
    try { data = JSON.parse(e.dataTransfer.getData('text/plain')) } catch { return }
    if (data.type !== 'inv-item' || data.index === undefined) return
    const ok = useEquipmentStore.getState().equipFromInventory(data.index, slotId)
    if (!ok) {
      setRejectSlot(slotId) // 부위 불일치 거부 연출
      setTimeout(() => setRejectSlot(null), 450)
    }
  }

  return (
    <div className="equip-panel">
      <div className="equip-titlebar">EQUIPMENT INVENTORY</div>
      <div className="inv-header">
        <span className="inv-title">장비창</span>
        <button className="inv-close" onClick={() => useUiStore.getState().toggleEquip()}>×</button>
      </div>
      <div className="equip-grid">
        {SLOT_LAYOUT.flat().map((slotId) => {
          const code = equipped[slotId]
          const def = code ? defs[code] : null
          return (
            <div
              key={slotId}
              className={`equip-slot ${def ? 'equip-slot--filled' : ''} ${rejectSlot === slotId ? 'equip-slot--reject' : ''}`}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
              onDrop={(e) => onDrop(e, slotId)}
              onClick={() => def && useEquipmentStore.getState().unequip(slotId)}
              title={def ? `${def.name}\n${def.description}\n(클릭: 해제)` : `${SLOT_LABEL[slotId]} — 인벤토리에서 드래그해 장착`}
            >
              {def ? (
                <span className="equip-thumb" style={{ background: CATEGORY_COLOR[SLOT_CATEGORY[slotId]] }}>
                  {def.name.charAt(0)}
                </span>
              ) : (
                <span className="equip-slot-label">{SLOT_LABEL[slotId]}</span>
              )}
            </div>
          )
        })}
      </div>
      <p className="inv-hint">부위가 일치하는 칸에만 장착됩니다 ({Object.values(CATEGORY_LABEL).join('·')})</p>
    </div>
  )
}
