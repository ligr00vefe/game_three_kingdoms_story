import { useEffect } from 'react'
import { useDialogStore } from '../stores/dialogStore'
import { EventBus, GameEvents } from '../game/EventBus'

/**
 * NPC 대화창 (GAME_DESIGN 9장): 화면 하단, 초상화 + 대사 + 다음 버튼.
 * 게임은 멈추지 않는다. 초상화 이미지는 Phase 7에서 AI 생성분으로 교체 (지금은 이니셜)
 */
export function DialogBox() {
  const npcName = useDialogStore((s) => s.npcName)
  const lines = useDialogStore((s) => s.lines)
  const index = useDialogStore((s) => s.index)

  useEffect(() => {
    const onOpen = (p: { name: string; lines: string[] }) => useDialogStore.getState().open(p.name, p.lines)
    EventBus.on(GameEvents.OPEN_DIALOG, onOpen)
    return () => { EventBus.off(GameEvents.OPEN_DIALOG, onOpen) }
  }, [])

  if (!npcName) return null
  const isLast = index + 1 >= lines.length

  return (
    <div className="dialog-box" onClick={() => useDialogStore.getState().next()}>
      <div className="dialog-portrait">{npcName.charAt(0)}</div>
      <div className="dialog-body">
        <div className="dialog-name">{npcName}</div>
        <p className="dialog-text">{lines[index]}</p>
      </div>
      <button className="dialog-next" onClick={(e) => { e.stopPropagation(); useDialogStore.getState().next() }}>
        {isLast ? '닫기' : '다음 ▶'}
      </button>
    </div>
  )
}
