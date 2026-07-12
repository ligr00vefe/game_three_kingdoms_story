import { useUiStore } from '../stores/uiStore'

/**
 * 퀘스트 창 (Q 토글) — 퀘스트 시스템 서버 연동 전 placeholder.
 * 게임을 멈추지 않는 비모달 (메이플 방식).
 */
const SAMPLE_QUESTS = [
  { title: '황건적 소탕', desc: '황건당 좀비 10마리 처치', progress: '0 / 10', accent: '#e8b64c' },
  { title: '촌장의 부탁', desc: '마을 촌장과 대화하기 (근처에서 ↑)', progress: '진행 가능', accent: '#66bb6a' },
]

export function QuestPanel() {
  const open = useUiStore((s) => s.questOpen)
  if (!open) return null

  return (
    <div className="quest-panel">
      <div className="quest-header">
        <span className="quest-title">퀘스트</span>
        <button className="inv-close" onClick={() => useUiStore.getState().toggleQuest()}>×</button>
      </div>
      {SAMPLE_QUESTS.map((q) => (
        <div className="quest-item" key={q.title}>
          <div className="quest-item-title" style={{ color: q.accent }}>{q.title}</div>
          <div className="quest-item-desc">{q.desc}</div>
          <div className="quest-item-progress">{q.progress}</div>
        </div>
      ))}
      <p className="inv-hint">퀘스트 수락/완료는 서버 연동 후 지원됩니다</p>
    </div>
  )
}
