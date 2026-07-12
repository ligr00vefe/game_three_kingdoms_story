import { create } from 'zustand'

/**
 * 채팅(댓글)창 저장소 — 지금은 로컬 전용 (서버 채팅은 후순위).
 * 시스템 메시지(핑크)와 일반 메시지(흰색)를 구분한다.
 */
export interface ChatMessage {
  id: number
  kind: 'system' | 'player'
  author?: string
  text: string
}

const MAX_MESSAGES = 50
let nextId = 1

interface ChatState {
  messages: ChatMessage[]
  addMessage: (msg: Omit<ChatMessage, 'id'>) => void
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [
    { id: nextId++, kind: 'system', text: '삼국지 스토리에 오신 것을 환영합니다.' },
    { id: nextId++, kind: 'system', text: '업적 혜택을 받을 수 있습니다.' },
  ],
  addMessage: (msg) =>
    set((s) => ({ messages: [...s.messages, { ...msg, id: nextId++ }].slice(-MAX_MESSAGES) })),
}))
