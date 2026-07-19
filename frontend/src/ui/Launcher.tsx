import { useState } from 'react'

export const GAME_WINDOW_NAME = 'threeKingdomsStory'

// 기본 시작 창 크기 — 게임 비율(16:9)에 맞춘다. 창이 16:9면 Scale.FIT이 여백 없이 꽉 채운다.
// 창 테두리(크롬) 때문에 내부는 정확히 16:9가 안 나오므로, 게임 창이 뜬 뒤 GameApp이 내부를
// 16:9로 미세 보정한다(App.tsx). 여기 값은 시작 근사치일 뿐이다.
const DEFAULT_WINDOW_WIDTH = 1280
const DEFAULT_WINDOW_HEIGHT = 720

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
