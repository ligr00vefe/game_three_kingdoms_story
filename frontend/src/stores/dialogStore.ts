import { create } from 'zustand'

/** NPC 대화창 상태 (GAME_DESIGN 9장 — 대화 중에도 게임은 계속) */
interface DialogState {
  npcName: string | null
  lines: string[]
  index: number
  open: (name: string, lines: string[]) => void
  next: () => void
  close: () => void
}

export const useDialogStore = create<DialogState>((set, get) => ({
  npcName: null,
  lines: [],
  index: 0,
  open: (npcName, lines) => set({ npcName, lines, index: 0 }),
  next: () => {
    const { index, lines } = get()
    if (index + 1 >= lines.length) set({ npcName: null, lines: [], index: 0 })
    else set({ index: index + 1 })
  },
  close: () => set({ npcName: null, lines: [], index: 0 }),
}))
