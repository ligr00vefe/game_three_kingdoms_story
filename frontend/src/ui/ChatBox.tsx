import { useEffect, useRef } from 'react'
import { useChatStore } from '../stores/chatStore'
import { useGameStore } from '../stores/gameStore'
import { useUiStore } from '../stores/uiStore'
import { EventBus, GameEvents } from '../game/EventBus'

/**
 * 좌하단 채팅(댓글)창 — 메이플 하단 채팅 인터페이스.
 * - Enter: 입력창 포커스 (게임 키 입력은 uiStore.chatFocused → INPUT_BLOCK으로 차단)
 * - Enter(입력 중): 전송 후 포커스 해제 / ESC: 입력 취소
 * - 지금은 로컬 전용, 서버 채팅 연동은 후순위
 */
export function ChatBox() {
  const messages = useChatStore((s) => s.messages)
  const inputRef = useRef<HTMLInputElement>(null)
  const logRef = useRef<HTMLDivElement>(null)

  // 새 메시지 → 항상 맨 아래로
  useEffect(() => {
    const log = logRef.current
    if (log) log.scrollTop = log.scrollHeight
  }, [messages])

  // 전역 Enter → 채팅 입력 포커스 (모달이 열려 있으면 무시)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return
      const ui = useUiStore.getState()
      if (ui.settingsOpen || ui.keySettingsOpen || ui.chatFocused) return
      e.preventDefault()
      inputRef.current?.focus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const submit = () => {
    const input = inputRef.current
    if (!input) return
    const text = input.value.trim()
    if (text) {
      useChatStore.getState().addMessage({
        kind: 'player',
        author: useGameStore.getState().characterName,
        text,
      })
      EventBus.emit(GameEvents.CHAT_BUBBLE, text) // 플레이어 머리 위 말풍선
    }
    input.value = ''
    input.blur()
  }

  return (
    <div className="chat-box">
      <div ref={logRef} className="chat-log">
        {messages.map((m) => (
          <p key={m.id} className={`chat-msg chat-msg--${m.kind}`}>
            {m.kind === 'player' ? `${m.author} : ${m.text}` : m.text}
          </p>
        ))}
      </div>
      <div className="chat-input-row">
        <input
          ref={inputRef}
          className="chat-input"
          maxLength={80}
          placeholder="Enter 키로 채팅"
          onFocus={() => useUiStore.getState().setChatFocused(true)}
          onBlur={() => useUiStore.getState().setChatFocused(false)}
          onKeyDown={(e) => {
            e.stopPropagation() // Phaser 전역 키 캡처로 전파 금지 (입력 중 preventDefault 방지)
            if (e.key === 'Enter') submit()
            else if (e.key === 'Escape') { e.currentTarget.value = ''; e.currentTarget.blur() }
          }}
        />
        <button className="chat-send" onClick={submit}>전송</button>
      </div>
    </div>
  )
}
