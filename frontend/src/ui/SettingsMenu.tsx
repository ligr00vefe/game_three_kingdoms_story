import { useUiStore } from '../stores/uiStore'
import { useScreenStore } from '../stores/screenStore'

/**
 * 설정 메뉴 (ESC): 단축키 세팅 진입 + 전체화면 전환 + 대기실 복귀/게임 종료.
 * ESC 키 처리(열기/닫기)는 App의 전역 keydown 핸들러가 담당한다.
 */
export function SettingsMenu() {
  const open = useUiStore((s) => s.settingsOpen)
  if (!open) return null

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen().catch(() => {})
  }

  // 대기실 복귀: 설정 닫고 화면을 lobby로 → PhaserGame 언마운트되며 게임 인스턴스 정리
  const returnToLobby = () => {
    if (!window.confirm('대기실로 돌아가시겠습니까?')) return
    useUiStore.getState().setSettingsOpen(false)
    useUiStore.getState().setKeySettingsOpen(false)
    useScreenStore.getState().setScreen('lobby')
  }

  // 게임 종료: 런처가 window.open으로 띄운 게임 창이므로 스스로 닫을 수 있다
  const exitGame = () => {
    if (!window.confirm('게임을 종료하시겠습니까?')) return
    if (document.fullscreenElement) void document.exitFullscreen()
    window.close()
  }

  return (
    <div className="ks-backdrop">
      <div className="settings-menu">
        <div className="settings-title">설정</div>
        <button className="settings-item settings-item--dim" onClick={() => useUiStore.getState().setSettingsOpen(false)}>
          게임으로 돌아가기 (ESC)
        </button>
        <div className="settings-sep" />
        <button
          className="settings-item"
          onClick={() => {
            useUiStore.getState().setSettingsOpen(false)
            useUiStore.getState().setKeySettingsOpen(true)
          }}
        >
          ⌨ 단축키 세팅
        </button>
        <button className="settings-item" onClick={toggleFullscreen}>⛶ 전체화면 전환</button>
        <div className="settings-sep" />
        <button className="settings-item" onClick={returnToLobby}>🏠 대기실로 돌아가기</button>
        <button className="settings-item settings-item--danger" onClick={exitGame}>✖ 게임 종료</button>
      </div>
    </div>
  )
}
