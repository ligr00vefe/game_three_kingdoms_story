import { useState } from 'react'

export const GAME_WINDOW_NAME = 'threeKingdomsStory'

// 게임 창 고정 크기(16:9). 이 크기로 열고, GameApp이 리사이즈를 이 크기로 되돌려 잠근다(App.tsx).
// window.open의 width/height는 내부(콘텐츠) 크기 기준이라 게임 화면이 정확히 이 크기가 된다.
export const GAME_WINDOW_WIDTH = 1280
export const GAME_WINDOW_HEIGHT = 720

function openGameWindow(): boolean {
  const url = `${location.pathname}?mode=game`
  const width = Math.min(GAME_WINDOW_WIDTH, screen.availWidth)
  const height = Math.min(GAME_WINDOW_HEIGHT, screen.availHeight)
  const left = Math.max(0, Math.round((screen.availWidth - width) / 2))
  const top = Math.max(0, Math.round((screen.availHeight - height) / 2))
  // popup 지정 → 탭이 아닌 독립 새 창(화면 중앙). 같은 이름으로 다시 열면 기존 창 재사용.
  // resizable=no는 크롬이 대체로 무시하므로 실제 잠금은 App.tsx의 resize 핸들러가 담당한다.
  const win = window.open(
    url,
    GAME_WINDOW_NAME,
    `popup=yes,left=${left},top=${top},width=${width},height=${height},resizable=no`,
  )
  if (!win) return false
  win.focus()
  return true
}

/**
 * 첫 접속 화면: 로고 + 시작 버튼. 게임은 threeKingdomsStory 새 창(팝업)에서 실행되고,
 * 이 화면은 "실행중…"으로 바뀐다. 팝업이 차단되면 버튼 화면에 그대로 머문다.
 */
export function Launcher() {
  const [launched, setLaunched] = useState(false)

  return (
    <div className="launcher">
      <img className="launcher-logo" src="/assets/img/logo/main_logo.png" alt="삼국지 스토리" />
      {launched ? (
        <p className="launcher-running">실행중…</p>
      ) : (
        <>
          <button
            className="launcher-btn"
            onClick={() => { if (openGameWindow()) setLaunched(true) }}
          >
            게임 시작
          </button>
          <p className="launcher-hint">창이 열리지 않으면 브라우저의 팝업 차단을 해제해 주세요</p>
        </>
      )}
    </div>
  )
}
