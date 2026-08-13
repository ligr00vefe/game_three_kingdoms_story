import { useEffect, useState, type FormEvent, type RefObject } from 'react'
import {
  createBugReport,
  fetchBugReports,
  fetchDefenseRanking,
  type BugReport,
  type DefenseRankingEntry,
} from '../api/community'
import { useAuthStore } from '../stores/authStore'

type CommunityTab = 'ranking' | 'reports'

function formatDate(value: string) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value.slice(0, 10) : date.toLocaleDateString('ko-KR')
}

export function LauncherCommunity({ communityRef, hidden = false }: { communityRef?: RefObject<HTMLElement | null>; hidden?: boolean }) {
  const user = useAuthStore((state) => state.user)
  const [tab, setTab] = useState<CommunityTab>('ranking')
  const [ranking, setRanking] = useState<DefenseRankingEntry[]>([])
  const [reports, setReports] = useState<BugReport[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('BUG')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadCommunity = async () => {
    setLoading(true)
    try {
      const [nextRanking, nextReports] = await Promise.all([fetchDefenseRanking(), fetchBugReports()])
      setRanking(nextRanking)
      setReports(nextReports)
    } catch {
      setMessage('전장을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadCommunity() }, [])

  const submitReport = async (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim() || !content.trim() || submitting) return
    setSubmitting(true)
    setMessage('')
    try {
      await createBugReport(title.trim(), content.trim(), category)
      setTitle('')
      setContent('')
      setCategory('BUG')
      setShowForm(false)
      setTab('reports')
      await loadCommunity()
      setMessage('신고가 접수되었습니다. 제보해 주셔서 감사합니다.')
    } catch {
      setMessage('신고를 접수하지 못했습니다. 입력 내용을 확인해 주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  const visibleRanking = ranking.slice(0, 8)
  const myEntry = user ? ranking.find((entry) => entry.playerName === user.displayName) : undefined
  if (myEntry && !visibleRanking.some((entry) => entry.rank === myEntry.rank)) visibleRanking.push(myEntry)

  return (
    <aside ref={communityRef} className={'launcher-community' + (hidden ? ' launcher-community--hidden' : '')} aria-label="전장 소식">
      <div className="community-heading">
        <span className="community-eyebrow">FIELD RECORDS</span>
        <h2>전장의 기록</h2>
        <p>장수들의 수성과 새로운 소식을 확인하세요.</p>
      </div>
      <div className="community-tabs" role="tablist">
        <button className={tab === 'ranking' ? 'is-active' : ''} onClick={() => { setTab('ranking'); setMessage('') }}>
          등반 순위
        </button>
        <button className={tab === 'reports' ? 'is-active' : ''} onClick={() => { setTab('reports'); setMessage('') }}>
          버그 게시판
        </button>
      </div>

      {loading ? <p className="community-empty">기록을 불러오는 중...</p> : tab === 'ranking' ? (
        <div className="community-ranking">
          <div className="community-list-caption"><span>DEFENSE ARENA</span><b>TOP 20</b></div>
          {ranking.length === 0 ? <p className="community-empty">아직 기록된 등반 장수가 없습니다.</p> : visibleRanking.map((entry) => (
            <div className={`ranking-row ${entry.rank <= 3 ? 'ranking-row--top' : ''}${user?.displayName === entry.playerName ? ' ranking-row--me' : ''}`} key={`${entry.rank}-${entry.playerName}`}>
              <strong className={`ranking-rank ${entry.rank <= 3 ? `ranking-rank--${entry.rank}` : ''}`}>
                {entry.rank <= 3 ? <span className="ranking-medal" aria-label={`${entry.rank}위`}>{entry.rank}</span> : entry.rank}
              </strong>
              <span className="ranking-identity"><b>{entry.playerName}</b><small>{entry.characterName} · Lv.{entry.level}</small></span>
              <span className="ranking-stage">STAGE <b>{entry.defenseStage}</b></span>
            </div>
          ))}
        </div>
      ) : (
        <div className="community-reports">
          <div className="community-list-caption"><span>REPORT BOARD</span><button onClick={() => { setShowForm(!showForm); setMessage('') }}>{showForm ? '닫기' : '신고하기'}</button></div>
          {showForm && (
            <form className="bug-report-form" onSubmit={(event) => void submitReport(event)}>
              <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="신고 분류">
                <option value="BUG">버그</option>
                <option value="BALANCE">밸런스</option>
                <option value="UI">UI·편의</option>
                <option value="OTHER">기타</option>
              </select>
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="제목" maxLength={100} />
              <textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="어떤 상황에서 문제가 발생했는지 적어 주세요." maxLength={4000} rows={4} />
              <button type="submit" disabled={submitting || !title.trim() || !content.trim()}>{submitting ? '접수 중...' : '제보 접수'}</button>
            </form>
          )}
          {reports.length === 0 ? <p className="community-empty">첫 번째 제보를 남겨 주세요.</p> : reports.slice(0, 5).map((report) => (
            <article className="report-row" key={report.id}>
              <div><span className="report-category">{report.category}</span><strong>{report.title}</strong></div>
              <p>{report.content}</p>
              <small>{report.reporterName} · {formatDate(report.createdAt)}</small>
            </article>
          ))}
        </div>
      )}
      {message && <p className="community-message">{message}</p>}
    </aside>
  )
}
