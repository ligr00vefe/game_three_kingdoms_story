import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useInventoryStore } from './inventoryStore'
import { EventBus, GameEvents } from '../game/EventBus'
import { getSkillsForCharacter } from './skillStore'

/**
 * 퀵슬롯 (체력바 오른쪽 7칸, 숫자키 1~7).
 * - 아이템/스킬을 드래그로 등록, 바깥에 드롭하면 해제
 * - 점유 칸에 드롭하면 기존 항목이 마우스에 붙고(held) 새 항목이 등록됨
 *   → held는 다른 칸 클릭 시 배치/교체, 바깥 클릭 시 소멸 (메이플 방식)
 * - 슬롯 배열은 localStorage에 영속화 (held는 세션 한정)
 */
export interface QSEntry {
  kind: 'item' | 'skill'
  code: string
}

export const QUICKSLOT_COUNT = 7

const normalizeSlots = (characterCode: string, source: readonly (QSEntry | null)[]) =>
  Array.from({ length: QUICKSLOT_COUNT }, (_, index) => {
    const entry = source[index] ?? null
    if (characterCode === 'zhaoyun' && entry?.kind === 'skill' && entry.code === 'skill_decisive_strike') {
      return { ...entry, code: 'skill_meteor_spear' }
    }
    return entry
  })

interface QuickslotState {
  characterCode: string
  savedSlots: Record<string, (QSEntry | null)[]>
  slots: (QSEntry | null)[]
  /** 마우스에 붙어 있는(교체로 밀려난) 항목 */
  held: QSEntry | null
  /** 드래그 드롭 등록 — 점유 칸이면 기존 항목이 held로 이동 */
  dropOn: (index: number, entry: QSEntry) => void
  /** held를 칸에 배치 — 점유 칸이면 서로 교체 */
  placeHeld: (index: number) => void
  discardHeld: () => void
  clearSlot: (index: number) => void
  hydrate: (slots: (QSEntry | null)[]) => void
  switchCharacter: (characterCode: string) => void
  /** 슬롯 간 이동(드래그) — 대상이 점유면 서로 교체 */
  moveSlot: (from: number, to: number) => void
  /** 숫자키/클릭 발동: 아이템 사용 또는 스킬 시전 */
  trigger: (index: number) => void
}

export const useQuickslotStore = create<QuickslotState>()(
  persist(
    (set, get) => ({
      characterCode: 'guanwu',
      savedSlots: {},
      slots: Array(QUICKSLOT_COUNT).fill(null),
      held: null,

      dropOn: (index, entry) => {
        const slots = get().slots.slice()
        const prev = slots[index]
        slots[index] = entry
        const state = get()
        set({ slots, held: prev ?? state.held, savedSlots: { ...state.savedSlots, [state.characterCode]: slots } })
        EventBus.emit(GameEvents.QUICKSLOTS_CHANGED)
      },

      placeHeld: (index) => {
        const held = get().held
        if (!held) return
        const slots = get().slots.slice()
        const prev = slots[index]
        slots[index] = held
        const state = get()
        set({ slots, held: prev ?? null, savedSlots: { ...state.savedSlots, [state.characterCode]: slots } })
        EventBus.emit(GameEvents.QUICKSLOTS_CHANGED)
      },

      discardHeld: () => set({ held: null }),

      clearSlot: (index) => {
        const slots = get().slots.slice()
        slots[index] = null
        const state = get()
        set({ slots, savedSlots: { ...state.savedSlots, [state.characterCode]: slots } })
        EventBus.emit(GameEvents.QUICKSLOTS_CHANGED)
      },

      hydrate: (saved) => {
        const state = get()
        const slots = normalizeSlots(state.characterCode, saved)
        set({ slots, held: null, savedSlots: { ...state.savedSlots, [state.characterCode]: slots } })
      },

      switchCharacter: (characterCode) => {
        const state = get()
        const slots = normalizeSlots(characterCode, state.savedSlots[characterCode] ?? [])
        set({ characterCode, slots, held: null, savedSlots: { ...state.savedSlots, [characterCode]: slots } })
      },

      moveSlot: (from, to) => {
        if (from === to) return
        const slots = get().slots.slice()
        const tmp = slots[to]
        slots[to] = slots[from]
        slots[from] = tmp // 대상 점유 시 교체
        const state = get()
        set({ slots, savedSlots: { ...state.savedSlots, [state.characterCode]: slots } })
        EventBus.emit(GameEvents.QUICKSLOTS_CHANGED)
      },

      trigger: (index) => {
        const state = get()
        const entry = state.slots[index]
        if (!entry) return
        if (entry.kind === 'skill') {
          if (!getSkillsForCharacter(state.characterCode).some((skill) => skill.code === entry.code)) return
          EventBus.emit(GameEvents.CAST_SKILL, entry.code)
        } else {
          useInventoryStore.getState().useConsumableByCode(entry.code)
        }
      },
    }),
    {
      name: 'tks-quickslots-v2',
      partialize: (s) => ({ characterCode: s.characterCode, savedSlots: s.savedSlots }),
      merge: (persisted, current) => {
        const saved = (persisted as Partial<QuickslotState> | undefined)?.savedSlots ?? {}
        const characterCode = (persisted as Partial<QuickslotState> | undefined)?.characterCode ?? 'guanwu'
        const slots = normalizeSlots(characterCode, saved[characterCode] ?? [])
        return {
          ...current,
          characterCode,
          savedSlots: { ...saved, [characterCode]: slots },
          slots,
        }
      },
    },
  ),
)
