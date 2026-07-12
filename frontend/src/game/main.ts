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
