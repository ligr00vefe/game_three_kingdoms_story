import { useEffect, useState } from 'react'

export const GAME_WINDOW_NAME = 'threeKingdomsStory'

// 기본 시작 창 크기 — 전체화면이 아닌 적당한 사이즈로 시작 (전체화면은 ESC 설정에서 수동 전환)
const DEFAULT_WINDOW_WIDTH = 1280
const DEFAULT_WINDOW_HEIGHT = 800

function openGameWindow(): boolean {
  const url = `${location.pathname}?mode=game`
  const width = Math.min(DEFAULT_WINDOW_WIDTH, screen.availWidth)
  const height = Math.min(DEFAULT_WINDOW_HEIGHT, screen.availHeight)
  const left = Math.max(0, Math.round((screen.availWidth - width) / 2))
  const top = Math.max(0, Math.round((screen.availHeight - height) / 2))
  // popup 지정 → 탭이 아닌 독립 새 창(적당한 사이즈, 화면 중앙). 같은 이름으로 다시 열면 기존 창 재사용
  const win = window.open(
    url,
    GAME_WINDOW_NAME,
    `popup=yes,left=${left},top=${top},width=${width},height=${height},resizable=yes`,
  )
  if (!win) return false
  win.focus()
  return true
}

/**
 * 첫 접속 탭용 런처: 게임을 threeKingdomsStory 새 창(팝업)으로 띄우고 이 탭은 빈 화면이 된다.
 * 브라우저 팝업 차단 정책상 자동 열기가 막히면 시작 버튼 클릭 1회로 연다.
 */
export function Launcher() {
  const [launched, setLaunched] = useState(false)

  // 자동 열기 시도 — 팝업 차단 시 버튼 대기
  useEffect(() => {
    if (openGameWindow()) setLaunched(true)
  }, [])

  if (launched) {
    // 요구사항: 게임 실행 후 기존 탭은 빈 화면
    return <div className="launcher launcher--blank" />
  }

  return (
    <div className="launcher">
      <h1 className="launcher-title">threeKingdomsStory</h1>
      <p className="launcher-desc">게임은 새 창에서 실행됩니다</p>
      <button
        className="launcher-btn"
        onClick={() => { if (openGameWindow()) setLaunched(true) }}
      >
        게임 시작
      </button>
      <p className="launcher-hint">창이 열리지 않으면 브라우저의 팝업 차단을 해제해 주세요</p>
    </div>
  )
}
