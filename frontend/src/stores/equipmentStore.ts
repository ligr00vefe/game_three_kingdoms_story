import { create } from 'zustand'
import { useInventoryStore } from './inventoryStore'
import { useGameStore } from './gameStore'

/**
 * 장비창 (메이플 EQUIPMENT INVENTORY).
 * - 부위(카테고리)가 일치하는 칸에만 장착 가능 — cap 모자를 gloves 칸에 넣을 수 없다
 * - 인벤토리에서 드래그 앤 드롭으로 장착, 기존 장비는 같은 인벤 칸으로 돌아간다
 * - 액세서리는 4칸 (acc1~acc4)
 */
export type EquipCategory =
  | 'cap' | 'cape' | 'clothes' | 'gloves' | 'pants' | 'shoes'
  | 'weapon' | 'subweapon' | 'accessory'

export type EquipSlotId =
  | 'cap' | 'cape' | 'clothes' | 'gloves' | 'pants' | 'shoes'
  | 'weapon' | 'subweapon' | 'acc1' | 'acc2' | 'acc3' | 'acc4'

export const SLOT_CATEGORY: Record<EquipSlotId, EquipCategory> = {
  cap: 'cap', cape: 'cape', clothes: 'clothes', gloves: 'gloves',
  pants: 'pants', shoes: 'shoes', weapon: 'weapon', subweapon: 'subweapon',
  acc1: 'accessory', acc2: 'accessory', acc3: 'accessory', acc4: 'accessory',
}

export const SLOT_LABEL: Record<EquipSlotId, string> = {
  cap: '모자', cape: '망토', clothes: '옷', gloves: '장갑',
  pants: '바지', shoes: '신발', weapon: '무기', subweapon: '보조무기',
  acc1: '액세서리', acc2: '액세서리', acc3: '액세서리', acc4: '액세서리',
}

export const CATEGORY_LABEL: Record<EquipCategory, string> = {
  cap: '모자', cape: '망토', clothes: '옷', gloves: '장갑', pants: '바지',
  shoes: '신발', weapon: '무기', subweapon: '보조무기', accessory: '액세서리',
}

const EMPTY_EQUIPPED: Record<EquipSlotId, string | null> = {
  cap: null, cape: null, clothes: null, gloves: null, pants: null, shoes: null,
  weapon: null, subweapon: null, acc1: null, acc2: null, acc3: null, acc4: null,
}

interface EquipmentState {
  equipped: Record<EquipSlotId, string | null>
  /**
   * 인벤토리 invIndex의 장비를 slotId에 장착.
   * @returns false = 부위 불일치 등으로 거부 (UI가 거부 연출)
   */
  equipFromInventory: (invIndex: number, slotId: EquipSlotId) => boolean
  /** 장착 해제 → 인벤토리로. @returns false = 인벤토리 가득 */
  unequip: (slotId: EquipSlotId) => boolean
  /** 서버 hydrate용 — 장착 상태 통째로 교체 */
  setEquippedRaw: (equipped: Partial<Record<EquipSlotId, string | null>>) => void
}

/** 장착 장비 효과 재계산 (이속 등 — GAME_DESIGN 8.3) */
function recomputeEffects(equipped: Record<EquipSlotId, string | null>) {
  const defs = useInventoryStore.getState().defs
  let moveSpeedMult = 1
  for (const code of Object.values(equipped)) {
    if (!code) continue
    const pct = defs[code]?.effect?.moveSpeedPct
    if (pct) moveSpeedMult *= 1 + pct / 100
  }
  useGameStore.getState().setStats({ moveSpeedMult })
}

export const useEquipmentStore = create<EquipmentState>((set, get) => ({
  equipped: { ...EMPTY_EQUIPPED },

  equipFromInventory: (invIndex, slotId) => {
    const inv = useInventoryStore.getState()
    const slot = inv.slots[invIndex]
    if (!slot) return false
    const def = inv.defs[slot.code]
    // 부위 일치 검증: 카테고리 없는 아이템(소비/기타) 또는 다른 부위는 거부
    if (!def?.category || def.category !== SLOT_CATEGORY[slotId]) return false

    const prev = get().equipped[slotId]
    const newSlots = inv.slots.slice()
    // 기존 장비는 드래그해 온 아이템이 있던 인벤 칸으로 (자리 교환)
    newSlots[invIndex] = prev ? { code: prev, quantity: 1, equipped: false } : null
    useInventoryStore.setState({ slots: newSlots })

    const equipped = { ...get().equipped, [slotId]: slot.code }
    set({ equipped })
    recomputeEffects(equipped)
    return true
  },

  unequip: (slotId) => {
    const code = get().equipped[slotId]
    if (!code) return true
    if (!useInventoryStore.getState().addItem(code, 1)) return false // 인벤 가득
    const equipped = { ...get().equipped, [slotId]: null }
    set({ equipped })
    recomputeEffects(equipped)
    return true
  },

  setEquippedRaw: (partial) => {
    const equipped = { ...EMPTY_EQUIPPED, ...partial }
    set({ equipped })
    recomputeEffects(equipped)
  },
}))
