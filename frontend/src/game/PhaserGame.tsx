import { useEffect, useRef } from 'react'
import type Phaser from 'phaser'
import { startGame } from './main'

/**
 * Phaser 게임의 React 마운트 지점.
 * - 게임 인스턴스는 ref로 1회만 생성
 * - StrictMode 이중 마운트(dev)에서 중복 생성/파괴를 가드
 */
export function PhaserGame() {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)

  useEffect(() => {
    if (containerRef.current && gameRef.current === null) {
      gameRef.current = startGame(containerRef.current)
    }

    // 전체화면 폴백: 런처의 권한 위임이 실패한 브라우저에서 첫 입력(클릭/키) 시 전환.
    // 대상은 문서 전체 — 게임/HUD/대기실 어느 화면이든 포함된다
    const goFullscreen = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {}) // 사용자가 거부해도 게임은 계속
      }
      window.removeEventListener('pointerdown', goFullscreen)
      window.removeEventListener('keydown', goFullscreen)
    }
    window.addEventListener('pointerdown', goFullscreen)
    window.addEventListener('keydown', goFullscreen)

    return () => {
      window.removeEventListener('pointerdown', goFullscreen)
      window.removeEventListener('keydown', goFullscreen)
      gameRef.current?.destroy(true)
      gameRef.current = null
    }
  }, [])

  return <div ref={containerRef} id="game-container" />
}

export default PhaserGame
