import { create } from 'zustand'

/**
 * 수문장 옆 포탈 선택 메뉴 상태.
 * Phaser가 PORTAL_MENU를 emit하면 열리고, 선택 시 PORTAL_GO_OUTSIDE / PORTAL_ENTER_DEFENSE를 되쏜다.
 * (실제 이동/씬 전환은 GameScene이 담당 — 여기선 열림 상태만 관리)
 */
interface PortalMenuState {
  open: boolean
  openMenu: () => void
  close: () => void
}

export const usePortalMenuStore = create<PortalMenuState>((set) => ({
  open: false,
  openMenu: () => set({ open: true }),
  close: () => set({ open: false }),
}))
