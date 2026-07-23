import { create } from 'zustand'

/**
 * 관청 전직 신청 창 상태.
 * 레벨 조건(PROMOTION_MIN_LEVEL) 충족 시 관청 전공관과 상호작용하면 열린다.
 * 아직 상위 티어 외형 아트가 없어 실제 전직 버튼은 비활성 상태다(준비 중).
 */
interface PromotionState {
  open: boolean
  setOpen: (open: boolean) => void
}

export const usePromotionStore = create<PromotionState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}))
