import { create } from 'zustand'
import { useGameStore } from './gameStore'
import { EventBus, GameEvents } from '../game/EventBus'
import { useEquipmentStore } from './equipmentStore'
import type { EquipCategory, EquipSlotId } from './equipmentStore'
import { SLOT_CATEGORY } from './equipmentStore'

export type ItemType = 'EQUIP' | 'CONSUME' | 'ETC' | 'ARTIFACT'

export interface ItemDef {
  code: string
  name: string
  itemType: ItemType
  /** 장비 부위 카테고리 (EQUIP/ARTIFACT만) — 장비창 칸 일치 검증에 사용 */
  category?: EquipCategory
  iconKey: string
  effect: { heal?: number; moveSpeedPct?: number; attackMultiplier?: number } | null
  description: string
}

export interface InvSlot {
  code: string
  quantity: number
  equipped: boolean
}

export const INVENTORY_SIZE = 24

/** 서버(item_definition) 미연결 시에도 동작하는 로컬 폴백 — V1__init.sql 시드와 동일해야 한다
 *  (category/두건 모자는 로컬 선행 추가 — 서버 시드 반영 필요) */
const FALLBACK_DEFS: ItemDef[] = [
  { code: 'weapon_green_dragon_blade', name: '청룡언월도', itemType: 'EQUIP', category: 'weapon', iconKey: 'icon_green_dragon_blade', effect: { attackMultiplier: 1.2 }, description: '관우의 시작 무기. 리치가 긴 대도.' },
  { code: 'consume_hp_potion_s', name: 'HP 물약(소)', itemType: 'CONSUME', iconKey: 'icon_hp_potion_s', effect: { heal: 30 }, description: '체력을 30 회복한다.' },
  { code: 'etc_yellow_turban_scrap', name: '누런 두건 조각', itemType: 'ETC', iconKey: 'icon_turban_scrap', effect: null, description: '황건당 좀비가 쓰던 두건 조각.' },
  { code: 'artifact_red_hare_shoe', name: '적토의 편자', itemType: 'ARTIFACT', category: 'accessory', iconKey: 'icon_red_hare_shoe', effect: { moveSpeedPct: 10 }, description: '착용 시 이동속도 +10%. (액세서리)' },
  { code: 'equip_yellow_turban_cap', name: '누런 두건', itemType: 'EQUIP', category: 'cap', iconKey: 'icon_turban_cap', effect: null, description: '황건당이 쓰던 낡은 두건. (모자)' },
]

interface InventoryState {
  open: boolean
  defs: Record<string, ItemDef>
  slots: (InvSlot | null)[]
  setOpen: (open: boolean) => void
  hydrate: (items: { itemCode: string; quantity: number; slotIndex: number; equipped: boolean }[], defs?: ItemDef[]) => void
  /** @returns 획득 성공 여부 (가득 차면 false) */
  addItem: (code: string, quantity?: number) => boolean
  useConsumable: (slotIndex: number) => void
  /** 퀵슬롯(숫자키)용: 코드로 소비 아이템 사용. @returns 사용 성공 여부 */
  useConsumableByCode: (code: string) => boolean
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  open: false,
  defs: Object.fromEntries(FALLBACK_DEFS.map((d) => [d.code, d])),
  slots: Array(INVENTORY_SIZE).fill(null),

  setOpen: (open) => set({ open }),

  hydrate: (items, serverDefs) => {
    const defs = serverDefs?.length
      ? Object.fromEntries(serverDefs.map((d) => [d.code, d]))
      : get().defs
    const slots: (InvSlot | null)[] = Array(INVENTORY_SIZE).fill(null)
    // 장착 중(equipped) 장비는 인벤토리가 아니라 장비창으로 (메이플 방식)
    const equippedByCategory: Partial<Record<EquipSlotId, string>> = {}
    for (const it of items) {
      const cat = defs[it.itemCode]?.category
      if (it.equipped && cat) {
        // 카테고리에 맞는 빈 장비칸 배정 (액세서리는 acc1~4 순)
        const slotIds = (Object.keys(SLOT_CATEGORY) as EquipSlotId[]).filter(
          (sid) => SLOT_CATEGORY[sid] === cat && !equippedByCategory[sid],
        )
        if (slotIds.length > 0) {
          equippedByCategory[slotIds[0]] = it.itemCode
          continue
        }
      }
      if (it.slotIndex >= 0 && it.slotIndex < INVENTORY_SIZE) {
        slots[it.slotIndex] = { code: it.itemCode, quantity: it.quantity, equipped: false }
      }
    }
    set({ defs, slots })
    useEquipmentStore.getState().setEquippedRaw(equippedByCategory)
  },

  addItem: (code, quantity = 1) => {
    const { slots, defs } = get()
    const def = defs[code]
    if (!def) return false
    const next = slots.slice()

    // 소비/기타는 스택 (GAME_DESIGN 8.2)
    if (def.itemType === 'CONSUME' || def.itemType === 'ETC') {
      const idx = next.findIndex((s) => s?.code === code)
      if (idx >= 0) {
        next[idx] = { ...next[idx]!, quantity: next[idx]!.quantity + quantity }
        set({ slots: next })
        return true
      }
    }
    const empty = next.findIndex((s) => s === null)
    if (empty < 0) return false // 인벤토리 가득
    next[empty] = { code, quantity, equipped: false }
    set({ slots: next })
    return true
  },

  useConsumable: (slotIndex) => {
    const { slots, defs } = get()
    const slot = slots[slotIndex]
    if (!slot) return
    const def = defs[slot.code]
    if (def?.itemType !== 'CONSUME') return

    const game = useGameStore.getState()
    if (game.playerDead) return
    if (def.effect?.heal) {
      if (game.hp >= game.maxHp) return // 가득이면 소모하지 않음
      game.setStats({ hp: Math.min(game.maxHp, game.hp + def.effect.heal) })
    }
    EventBus.emit(GameEvents.USE_ITEM, slot.code) // Phaser 연출 훅

    const next = slots.slice()
    next[slotIndex] = slot.quantity > 1 ? { ...slot, quantity: slot.quantity - 1 } : null
    set({ slots: next })
  },

  useConsumableByCode: (code) => {
    const { slots } = get()
    const idx = slots.findIndex((s) => s?.code === code && s.quantity > 0)
    if (idx < 0) return false
    const hpBefore = useGameStore.getState().hp
    get().useConsumable(idx)
    // 가득 참 등으로 미소모된 경우 실패 취급
    return useGameStore.getState().hp !== hpBefore || slots[idx]?.quantity !== get().slots[idx]?.quantity
  },
}))
