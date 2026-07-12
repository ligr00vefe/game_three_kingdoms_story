import { Suspense, lazy, useEffect } from 'react'
// Phaser(~1.2MB)를 포함한 게임 청크는 지연 로드 (DEVELOPMENT_PLAN 문제 4)
const PhaserGame = lazy(() => import('./game/PhaserGame'))
import { StatusBar } from './ui/StatusBar'
import { ExpBar } from './ui/ExpBar'
import { ChatBox } from './ui/ChatBox'
import { QuickSlots } from './ui/QuickSlots'
import { Minimap } from './ui/Minimap'
import { DeathOverlay } from './ui/DeathOverlay'
import { fetchHealth } from './api/health'
import { loadGameState, startAutosave } from './api/game'
import { useGameStore } from './stores/gameStore'
import { useUiStore } from './stores/uiStore'
import { useScreenStore } from './stores/screenStore'
import { FEATURES } from './features'
import { InventoryPanel } from './ui/InventoryPanel'
import { EquipmentPanel } from './ui/EquipmentPanel'
import { CharacterInfoPanel } from './ui/CharacterInfoPanel'
import { SkillPanel } from './ui/SkillPanel'
import { useKeybindingStore } from './stores/keybindingStore'
import { DialogBox } from './ui/DialogBox'
import { NoticeBanner } from './ui/NoticeBanner'
import { QuestPanel } from './ui/QuestPanel'
import { SettingsMenu } from './ui/SettingsMenu'
import { KeySettingsPanel } from './ui/KeySettingsPanel'
import { Launcher, GAME_WINDOW_NAME } from './ui/Launcher'
import { CharacterSelect } from './ui/CharacterSelect'
import { LoadingScreen } from './ui/LoadingScreen'

/** 게임 창인지 판별: window.open(name) 또는 ?mode=game */
const isGameWindow =
  window.name === GAME_WINDOW_NAME ||
  new URLSearchParams(location.search).get('mode') === 'game'

export default function App() {
  if (!isGameWindow) return <Launcher />
  return <GameApp />
}

function GameApp() {
  const serverStatus = useGameStore((s) => s.serverStatus)
  const screen = useScreenStore((s) => s.screen)

  useEffect(() => {
    document.title = GAME_WINDOW_NAME
    fetchHealth()
      .then(async () => {
        await loadGameState() // 캐릭터/인벤토리 서버 로드 (Phase 3)
        useGameStore.getState().setServerStatus('ok')
      })
      .catch(() => useGameStore.getState().setServerStatus('down'))
    const stopAutosave = startAutosave()
    return stopAutosave
  }, [])

  // 런처가 위임한 전체화면 권한 수신 (Capability Delegation) → 새 창이 뜨자마자 전체화면
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.data !== 'tk-fullscreen') return
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {}) // 미지원/거부 시 첫 입력 폴백
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  // 전체화면 중 ESC가 전체화면을 끄지 않고 설정 메뉴를 열도록 Keyboard Lock (Chromium 계열).
  // 잠금 상태에서는 ESC keydown이 게임으로 전달되고, ESC를 길게 누르면 브라우저가 전체화면을 해제한다.
  useEffect(() => {
    const nav = navigator as Navigator & {
      keyboard?: { lock?: (keys?: string[]) => Promise<void>; unlock?: () => void }
    }
    const onFsChange = () => {
      if (document.fullscreenElement) nav.keyboard?.lock?.(['Escape'])?.catch(() => {})
      else nav.keyboard?.unlock?.()
    }
    document.addEventListener('fullscreenchange', onFsChange)
    onFsChange()
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange)
      nav.keyboard?.unlock?.()
    }
  }, [])

  // ESC: 단축키 세팅 → 설정 순으로 닫고, 아무것도 없으면 설정 메뉴 열기 (인게임에서만)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (useScreenStore.getState().screen !== 'game') return
      const ui = useUiStore.getState()
      if (ui.keySettingsOpen) ui.setKeySettingsOpen(false)
      else if (ui.settingsOpen) ui.setSettingsOpen(false)
      else if (ui.questOpen) ui.toggleQuest()
      else if (ui.statsOpen) ui.toggleStats()
      else if (ui.skillbookOpen) ui.toggleSkillbook()
      else if (ui.equipOpen) ui.toggleEquip()
      else if (!ui.chatFocused) ui.setSettingsOpen(true)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // 장비창/스탯창/스킬창 토글 단축키 (키바인딩 반영, InputManager 미경유 신규 액션)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (useScreenStore.getState().screen !== 'game') return
      const ui = useUiStore.getState()
      if (ui.chatFocused || ui.settingsOpen || ui.keySettingsOpen) return
      const action = useKeybindingStore.getState().bindings[e.code]
      if (action === 'equip') { if (FEATURES.equipment) { e.preventDefault(); ui.toggleEquip() } }
      else if (action === 'stats') { e.preventDefault(); ui.toggleStats() }
      else if (action === 'skillbook') { e.preventDefault(); ui.toggleSkillbook() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // 대기실: Phaser 미기동 — 캐릭터 선택 후 loading에서 마운트
  if (screen === 'lobby') return <CharacterSelect />

  return (
    <div className="app">
      <div className="game-wrap">
        <Suspense fallback={<div className="game-loading">게임 불러오는 중…</div>}>
          <PhaserGame />
        </Suspense>
        {screen === 'game' && (
          <>
            <Minimap />
            <NoticeBanner />
            {FEATURES.equipment && <InventoryPanel />}
            {FEATURES.equipment && <EquipmentPanel />}
            <CharacterInfoPanel />
            <SkillPanel />
            <QuestPanel />
            <DialogBox />
            <DeathOverlay />
            {/* ---- 하단 인터페이스 (메이플 스타일) ---- */}
            <ChatBox />
            <StatusBar />
            <QuickSlots />
            <ExpBar />
            {/* ---- 모달 ---- */}
            <SettingsMenu />
            <KeySettingsPanel />
            <p className={`server-status server-status--${serverStatus}`}>
              {serverStatus === 'checking' ? '서버 확인 중…' : serverStatus === 'ok' ? '' : '서버 연결 안 됨 (진행 저장 안 됨)'}
            </p>
          </>
        )}
        {screen === 'loading' && <LoadingScreen />}
      </div>
    </div>
  )
}
