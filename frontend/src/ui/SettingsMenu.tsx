import { useState } from 'react'
import { useUiStore } from '../stores/uiStore'
import { useScreenStore } from '../stores/screenStore'
import { useAutoCombatStore } from '../stores/autoCombatStore'
import { logout } from '../api/auth'
import { useAuthStore } from '../stores/authStore'
import type { CombatPolicy } from '../stores/autoCombatStore'

/**
 * 설정 메뉴 (ESC): 단축키 세팅 진입 + 전체화면 전환 + 대기실 복귀/게임 종료.
 * ESC 키 처리(열기/닫기)는 App의 전역 keydown 핸들러가 담당한다.
 */
export function SettingsMenu() {
  const open = useUiStore((s) => s.settingsOpen)
  const [autoOpen, setAutoOpen] = useState(false)
  const auto = useAutoCombatStore()

  if (!open) return null

  // 대기실 복귀: 설정 닫고 화면을 lobby로 → PhaserGame 언마운트되며 게임 인스턴스 정리
  const returnToLobby = () => {
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

  const logoutGame = async () => {
    if (!window.confirm('로그아웃하고 로그인 화면으로 돌아가시겠습니까?')) return
    try {
      await logout()
    } finally {
      useAuthStore.getState().setUser(null)
      window.location.assign(location.pathname)
    }
  }

  return (
    <div className="ks-backdrop">
      <div className={`settings-menu${autoOpen ? ' settings-menu--wide' : ''}`}>
        <div className="settings-title">설정</div>
        <button className="settings-item settings-item--dim" onClick={() => useUiStore.getState().setSettingsOpen(false)}>
          게임으로 돌아가기 (ESC)
        </button>
        <div className="settings-sep" />
        <button className="settings-item" onClick={() => void logoutGame()}>로그아웃</button>
        <button
          className="settings-item"
          onClick={() => {
            useUiStore.getState().setSettingsOpen(false)
            useUiStore.getState().setCommandHelpOpen(true)
          }}
        >
          📜 AI 명령어 예시 (A/F1)
        </button>
        <button
          className="settings-item"
          onClick={() => {
            useUiStore.getState().setSettingsOpen(false)
            useUiStore.getState().setKeySettingsOpen(true)
          }}
        >
          ⌨ 단축키 세팅
        </button>
        <button className="settings-item" onClick={() => setAutoOpen((value) => !value)}>
          🤖 자동 전투 설정 {autoOpen ? '▲' : '▼'}
        </button>
        {autoOpen && (
          <div className="auto-settings">
            <label className="auto-setting-row">
              <span>자동 동작</span>
              <input type="checkbox" checked={auto.enabled} onChange={(e) => auto.setEnabled(e.target.checked)} />
            </label>
            <label className="auto-setting-row">
              <span>전투 방침</span>
              <select value={auto.policy} onChange={(e) => auto.setPolicy(e.target.value as CombatPolicy)}>
                <option value="nearest">공격 우선 · 가까운 적</option>
                <option value="defense">수비 우선 · 성에 가까운 적</option>
                <option value="elite">정예 우선 · 강한 적</option>
                <option value="danger">위험 우선 · 돌진/화약병</option>
                <option value="survival">생존 우선 · HP 35% 후퇴</option>
              </select>
            </label>
            <label className="auto-setting-row">
              <span>자동 스킬</span>
              <input type="checkbox" checked={auto.autoSkill} onChange={(e) => auto.setAutoSkill(e.target.checked)} />
            </label>
            <label className="auto-setting-row">
              <span>최소 MP {auto.minMpPercent}%</span>
              <input type="range" min="20" max="100" step="10" value={auto.minMpPercent} onChange={(e) => auto.setMinMpPercent(Number(e.target.value))} />
            </label>
            <label className="auto-setting-row">
              <span>적 {auto.minEnemyCount}명 이상</span>
              <input type="range" min="1" max="6" value={auto.minEnemyCount} onChange={(e) => auto.setMinEnemyCount(Number(e.target.value))} />
            </label>
            <label className="auto-setting-row">
              <span>보스에게 스킬 보존</span>
              <input type="checkbox" checked={auto.reserveSkillForBoss} onChange={(e) => auto.setReserveSkillForBoss(e.target.checked)} />
            </label>
            <label className="auto-setting-row">
              <span>우측 명령 안내 표시</span>
              <input type="checkbox" checked={auto.quickHelpVisible} onChange={(e) => auto.setQuickHelpVisible(e.target.checked)} />
            </label>
          </div>
        )}
        <div className="settings-sep" />
        <button className="settings-item" onClick={returnToLobby}>🏠 대기실로 돌아가기</button>
        <button className="settings-item settings-item--danger" onClick={exitGame}>✖ 게임 종료</button>
      </div>
    </div>
  )
}
