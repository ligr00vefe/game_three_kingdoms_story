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
      // RESIZE: 캔버스를 부모 컨테이너(창) 크기에 그대로 맞춘다 → 검은 여백 없음, 왜곡 없음.
      // 대신 게임이 "창 비율에 맞춰" 보여주는 월드 범위가 달라진다(넓은 창=좌우로 더, 좁은 창=세로로 더).
      // width/height는 초기값일 뿐 Phaser가 부모 크기에 맞춰 리사이즈한다.
      // FIT(16:9 고정+레터박스)이나 FILL(늘려 채움=찌그러짐)이 아니라 이 방식을 쓴다.
      // 카메라는 CAMERA.ZOOM(1.4) 고정이라 스프라이트 픽셀 크기는 일정 — 큰 창일수록 월드가 더 넓게 보인다.
      mode: Phaser.Scale.RESIZE,
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
