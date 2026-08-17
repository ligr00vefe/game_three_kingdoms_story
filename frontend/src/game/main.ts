import Phaser from 'phaser'
import { PHYSICS } from './config'
import { BootScene } from './scenes/BootScene'
import { PreloadScene } from './scenes/PreloadScene'
import { GameScene } from './scenes/GameScene'
import { useUiStore } from '../stores/uiStore'
import { useDefenseStore } from '../stores/defenseStore'
import { EventBus, GameEvents } from './EventBus'

export const GAME_WIDTH = 1024
export const GAME_HEIGHT = 576

/**
 * Phaser Game 인스턴스 생성. React 밖에서 모듈 수준으로 관리된다.
 * (React 리렌더가 게임 인스턴스를 재생성하지 못하게 하는 구조 — DEVELOPMENT_PLAN 4.2)
 */
export function startGame(parent: HTMLElement): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#000000',
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: PHYSICS.GRAVITY_Y }, // 튜닝은 config.ts에서 (GAME_DESIGN 3.1)
        debug: false,
      },
    },
    scale: {
      // RESIZE: 캔버스를 부모 컨테이너(창) 크기에 그대로 맞춘다 → 검은 여백 없음, 왜곡 없음.
      // 대신 게임이 "창 비율에 맞춰" 보여주는 월드 범위가 달라진다(넓은 창=좌우로 더, 좁은 창=세로로 더).
      // width/height는 초기값일 뿐 Phaser가 부모 크기에 맞춰 리사이즈한다.
      // FIT(16:9 고정+레터박스)이나 FILL(늘려 채움=찌그러짐)이 아니라 이 방식을 쓴다.
      // 카메라는 CAMERA.ZOOM(1.4) 고정이라 스프라이트 픽셀 크기는 일정 — 큰 창일수록 월드가 더 넓게 보인다.
      // 논리 해상도(1024x576)의 비율을 유지하면서 부모 영역을 빈틈없이 덮는다.
      // RESIZE는 전체화면에서 카메라가 맵 바깥 세로 영역까지 보여 배경 여백이 생길 수 있다.
      mode: Phaser.Scale.ENVELOP,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, PreloadScene, GameScene],
  })
  // 개발 편의: 콘솔에서 씬/로더 상태 점검용 (프로덕션 제외)
  if (import.meta.env.DEV) {
    ;(window as Window & { __tkGame?: Phaser.Game }).__tkGame = game
  }

  // Phaser 키보드 플러그인이 blur 이후 keydown을 놓쳐도 DOM 단계에서 코어 루프를 깨운다.
  // wake()는 내부 월드 pause를 해제하지 않으므로 ESC/시네마틱의 의도한 정지는 유지된다.
  const wakeGameLoop = () => {
    if (!game.loop.inFocus) game.loop.focus()
    if (!game.loop.running) game.loop.wake()
  }
  const resumeHiddenGame = () => {
    game.loop.resume()
    wakeGameLoop()
  }
  const wakeWhenVisible = () => {
    if (document.visibilityState === 'visible') wakeGameLoop()
  }
  window.addEventListener('focus', wakeGameLoop)
  window.addEventListener('keydown', wakeGameLoop, true)
  window.addEventListener('pointerdown', wakeGameLoop, true)
  document.addEventListener('visibilitychange', wakeWhenVisible)
  game.events.on(Phaser.Core.Events.BLUR, wakeGameLoop)
  game.events.on(Phaser.Core.Events.HIDDEN, resumeHiddenGame)

  let lastRuntimeError: { message: string; stack?: string; at: string } | null = null
  const recordRuntimeError = (event: ErrorEvent) => {
    lastRuntimeError = {
      message: event.message,
      stack: event.error instanceof Error ? event.error.stack : undefined,
      at: new Date().toISOString(),
    }
    EventBus.emit(GameEvents.FREEZE_DIAGNOSTIC, {
      kind: 'runtime-error',
      ...lastRuntimeError,
    })
  }
  const recordRejectedPromise = (event: PromiseRejectionEvent) => {
    const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason))
    lastRuntimeError = { message: error.message, stack: error.stack, at: new Date().toISOString() }
    EventBus.emit(GameEvents.FREEZE_DIAGNOSTIC, { kind: 'runtime-error', ...lastRuntimeError })
  }
  window.addEventListener('error', recordRuntimeError)
  window.addEventListener('unhandledrejection', recordRejectedPromise)

  // Scene.update 자체가 멈추면 씬 내부 코드는 복구를 실행할 수 없다. 브라우저 타이머에서
  // 의도된 UI pause 여부와 실제 Phaser 상태를 대조해 비정상 정지만 복구하고 원인을 남긴다.
  const watchdog = window.setInterval(() => {
    if (document.visibilityState !== 'visible') return
    const scene = game.scene.getScene('Game') as GameScene | null
    if (!scene?.sys.isActive()) return

    const ui = useUiStore.getState()
    const defense = useDefenseStore.getState()
    const intendedPause = ui.settingsOpen || ui.cinematicOpen || (defense.active && defense.pauseOpen)
    if (intendedPause) return

    const staleUpdate = performance.now() - scene.lastUpdateHeartbeat > 1500
    const abnormalPause = game.isPaused || scene.scene.isPaused() || scene.scene.isSleeping()
      || scene.physics.world.isPaused || scene.time.paused
    if (!staleUpdate && !abnormalPause) return

    const diagnostic = {
      at: new Date().toISOString(),
      character: (scene as unknown as { player?: { modelCode?: string } }).player?.modelCode,
      staleUpdate,
      heartbeatAgeMs: Math.round(performance.now() - scene.lastUpdateHeartbeat),
      gamePaused: game.isPaused,
      loopRunning: game.loop.running,
      loopInFocus: game.loop.inFocus,
      scenePaused: scene.scene.isPaused(),
      sceneSleeping: scene.scene.isSleeping(),
      physicsPaused: scene.physics.world.isPaused,
      timePaused: scene.time.paused,
      ui: {
        settingsOpen: ui.settingsOpen,
        cinematicOpen: ui.cinematicOpen,
        chatFocused: ui.chatFocused,
        defenseActive: defense.active,
        defensePauseOpen: defense.pauseOpen,
      },
      lastRuntimeError,
    }
    localStorage.setItem('tk_last_freeze_diagnostic', JSON.stringify(diagnostic))
    console.error('[game-freeze-recovery]', diagnostic)
    EventBus.emit(GameEvents.FREEZE_DIAGNOSTIC, {
      kind: 'freeze',
      at: diagnostic.at,
      message: lastRuntimeError?.message,
      stack: lastRuntimeError?.stack,
      state: diagnostic,
    })

    game.resume()
    if (scene.scene.isSleeping()) scene.scene.wake()
    if (scene.scene.isPaused()) scene.scene.resume()
    scene.physics.world.resume()
    scene.time.paused = false
    scene.tweens.resumeAll()
    scene.anims.resumeAll()
    wakeGameLoop()
  }, 500)

  game.events.once(Phaser.Core.Events.DESTROY, () => {
    window.removeEventListener('focus', wakeGameLoop)
    window.removeEventListener('keydown', wakeGameLoop, true)
    window.removeEventListener('pointerdown', wakeGameLoop, true)
    document.removeEventListener('visibilitychange', wakeWhenVisible)
    game.events.off(Phaser.Core.Events.BLUR, wakeGameLoop)
    game.events.off(Phaser.Core.Events.HIDDEN, resumeHiddenGame)
    window.removeEventListener('error', recordRuntimeError)
    window.removeEventListener('unhandledrejection', recordRejectedPromise)
    window.clearInterval(watchdog)
  })
  return game
}
