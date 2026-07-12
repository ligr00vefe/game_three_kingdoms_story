import { useEffect, useState } from 'react'
import { api } from '../api/client'

const ROTATE_MS = 6000

/** 공지사항 배너 (GAME_DESIGN 9장): 서버 공지를 상단에서 롤링 표시 */
export function NoticeBanner() {
  const [notices, setNotices] = useState<string[]>([])
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    api.get<{ id: number; message: string }[]>('/notices')
      .then(({ data }) => setNotices(data.map((n) => n.message)))
      .catch(() => setNotices([])) // 서버 미연결 시 배너 숨김
  }, [])

  useEffect(() => {
    if (notices.length < 2) return
    const t = setInterval(() => setIdx((i) => (i + 1) % notices.length), ROTATE_MS)
    return () => clearInterval(t)
  }, [notices])

  if (notices.length === 0) return null
  return (
    <div className="notice-banner">
      <span className="notice-tag">공지</span>
      <span className="notice-msg">{notices[idx]}</span>
    </div>
  )
}
