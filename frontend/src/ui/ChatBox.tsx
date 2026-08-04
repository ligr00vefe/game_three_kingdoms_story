import { useEffect, useRef } from 'react'
import { useChatStore } from '../stores/chatStore'
import { useGameStore } from '../stores/gameStore'
import { useUiStore } from '../stores/uiStore'
import { useAuthStore } from '../stores/authStore'
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

  useEffect(() => {
    const onReply = (payload: { text: string }) => {
      useChatStore.getState().addMessage({ kind: 'guanYu', author: '관우', text: payload.text })
    }
    EventBus.on(GameEvents.GUAN_YU_REPLY, onReply)
    return () => { EventBus.off(GameEvents.GUAN_YU_REPLY, onReply) }
  }, [])

  // 전역 Enter → 채팅 입력 포커스 (모달이 열려 있으면 무시)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return
      const ui = useUiStore.getState()
      // 시네마틱 대화 중엔 Enter가 대화를 넘기는 키라 채팅으로 가져가지 않는다
      if (ui.settingsOpen || ui.keySettingsOpen || ui.chatFocused || ui.cinematicOpen) return
      e.preventDefault()
      inputRef.current?.focus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const releaseChatFocus = () => {
    // blur 이벤트에만 의존하면 Phaser가 잠든 프레임에서 입력 차단 해제가 늦어질 수 있다.
    useUiStore.getState().setChatFocused(false)
    inputRef.current?.blur()
  }

  const submit = () => {
    const input = inputRef.current
    if (!input) return
    const text = input.value.trim()
    input.value = ''
    // 명령을 게임에 보내기 전에 키 입력 차단과 브라우저 입력 포커스를 먼저 해제한다.
    releaseChatFocus()
    if (text) {
      useChatStore.getState().addMessage({
        kind: 'player',
        author: useAuthStore.getState().user?.displayName ?? useGameStore.getState().characterName,
        text,
      })
      if (text.startsWith('/')) {
        EventBus.emit(GameEvents.GUAN_YU_COMMAND, text.slice(1).trim())
      } else {
        EventBus.emit(GameEvents.GUAN_YU_CHAT, text)
      }
    }
  }

  return (
    <div className="chat-box">
      <div ref={logRef} className="chat-log">
        {messages.map((m) => (
          <p key={m.id} className={`chat-msg chat-msg--${m.kind}`}>
            {m.kind === 'system' ? m.text : `${m.author} : ${m.text}`}
          </p>
        ))}
      </div>
      <div className="chat-input-row">
        <input
          ref={inputRef}
          className="chat-input"
          maxLength={80}
          placeholder="/명령 또는 일반 대화"
          onFocus={() => useUiStore.getState().setChatFocused(true)}
          onBlur={() => useUiStore.getState().setChatFocused(false)}
          onKeyDown={(e) => {
            e.stopPropagation() // Phaser 전역 키 캡처로 전파 금지 (입력 중 preventDefault 방지)
            if (e.key === 'Enter') submit()
            else if (e.key === 'Escape') { e.currentTarget.value = ''; releaseChatFocus() }
          }}
        />
        <button className="chat-send" onClick={submit}>전송</button>
      </div>
    </div>
  )
}
