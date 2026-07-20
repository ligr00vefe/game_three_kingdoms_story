import { Suspense, lazy, useEffect } from 'react'
// Phaser(~1.2MB)를 포함한 게임 청크는 지연 로드 (DEVELOPMENT_PLAN 문제 4)
const PhaserGame = lazy(() => import('./game/PhaserGame'))
import { StatusBar } from './ui/StatusBar'
import { ExpBar } from './ui/ExpBar'
import { ChatBox } from './ui/ChatBox'
import { QuickSlots } from './ui/QuickSlots'
import { ActionBar } from './ui/ActionBar'
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
import { Launcher, GAME_WINDOW_NAME, GAME_WINDOW_WIDTH, GAME_WINDOW_HEIGHT } from './ui/Launcher'
import { CharacterSelect } from './ui/CharacterSelect'
import { LoadingScreen } from './ui/LoadingScreen'

/** 게임 창인지 판별: 런처가 window.open으로 띄우는 URL에 붙는 ?mode=game */
const isGameWindow = new URLSearchParams(location.search).get('mode') === 'game'

export default function App() {
  if (!isGameWindow) return <Launcher />
  return <GameApp />
}

function GameApp() {
  const serverStatus = useGameStore((s) => s.serverStatus)
  const screen = useScreenStore((s) => s.screen)

  // 게임 창 크기 잠금: 항상 내부(콘텐츠)를 GAME_WINDOW(1280×720)으로 유지한다.
  // 사용자가 창을 늘리면 그만큼 되돌린다. 팝업 resizable=no는 크롬이 무시하므로 여기서 강제한다.
  // (우리가 연 팝업이라 resizeBy가 허용된다. 직접 ?mode=game 탭으로 열면 브라우저가 막으므로
  //  try로 감싼다 — 그 경우엔 Scale.RESIZE가 탭 크기에 맞춰 그냥 꽉 채운다.)
  useEffect(() => {
    const enforce = () => {
      const dw = GAME_WINDOW_WIDTH - window.innerWidth
      const dh = GAME_WINDOW_HEIGHT - window.innerHeight
      if (Math.abs(dw) > 1 || Math.abs(dh) > 1) {
        try { window.resizeBy(dw, dh) } catch { /* 스크립트가 연 창이 아니면 무시 */ }
      }
    }
    enforce()
    window.addEventListener('resize', enforce)
    return () => window.removeEventListener('resize', enforce)
  }, [])

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
          // 작은 창에서도 전체 인터페이스가 다 보이도록 축소 — 좌표계는 그대로 두고
          // transform으로만 줄인다 (내부 각 패널의 px 절대값을 일일이 안 고쳐도 됨)
          <div className="ui-overlay">
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
            {/* 퀵슬롯(1~7키)을 단축키 안내바 바로 위에 세로로 쌓는다 */}
            <div className="qs-stack">
              <ActionBar />
              <QuickSlots />
            </div>
            <ExpBar />
            {/* ---- 모달 ---- */}
            <SettingsMenu />
            <KeySettingsPanel />
            <p className={`server-status server-status--${serverStatus}`}>
              {serverStatus === 'checking' ? '서버 확인 중…' : serverStatus === 'ok' ? '' : '서버 연결 안 됨 (진행 저장 안 됨)'}
            </p>
          </div>
        )}
        {screen === 'loading' && <LoadingScreen />}
      </div>
    </div>
  )
}
