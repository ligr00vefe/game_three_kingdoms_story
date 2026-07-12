import { useEffect, useState } from 'react'

export const GAME_WINDOW_NAME = 'threeKingdomsStory'

function openGameWindow(): boolean {
  const url = `${location.pathname}?mode=game`
  // popup 지정 → 탭이 아닌 독립 새 창(화면 크기로 최대화). 같은 이름으로 다시 열면 기존 창 재사용
  const win = window.open(
    url,
    GAME_WINDOW_NAME,
    `popup=yes,left=0,top=0,width=${screen.availWidth},height=${screen.availHeight},resizable=yes`,
  )
  if (!win) return false
  win.focus()
  // 새 창은 스스로 전체화면이 될 수 없어(브라우저 보안) 열어준 쪽에서 전체화면 권한을 위임한다
  // (Chromium Capability Delegation — 클릭의 user activation이 유효한 ~5초 안에 전달).
  // 미지원 브라우저는 무시되고, 게임 창의 "첫 입력 시 전체화면" 폴백이 동작한다.
  for (const ms of [700, 1800, 3500]) {
    setTimeout(() => {
      try {
        win.postMessage('tk-fullscreen', { targetOrigin: location.origin, delegate: 'fullscreen' } as WindowPostMessageOptions)
      } catch {
        win.postMessage('tk-fullscreen', location.origin)
      }
    }, ms)
  }
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
