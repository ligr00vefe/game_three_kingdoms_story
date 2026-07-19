import Phaser from 'phaser'
import { PHYSICS } from './config'
import { BootScene } from './scenes/BootScene'
import { PreloadScene } from './scenes/PreloadScene'
import { GameScene } from './scenes/GameScene'

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
      // FIT: 비율(1024×576 = 16:9)을 유지한 채 창에 맞춰 확대/축소하고 남는 곳은 여백으로 둔다.
      // 예전엔 Phaser.Scale.FILL을 썼는데 Phaser에 없는 값이라 mode가 undefined가 됐고,
      // 그러면 캔버스가 창 크기에 비율 무시하고 그대로 늘어난다(16:9가 아닌 창에서 화면이 눌림).
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, PreloadScene, GameScene],
  })
  // 개발 편의: 콘솔에서 씬/로더 상태 점검용 (프로덕션 제외)
  if (import.meta.env.DEV) {
    ;(window as Window & { __tkGame?: Phaser.Game }).__tkGame = game
  }
  return game
}
