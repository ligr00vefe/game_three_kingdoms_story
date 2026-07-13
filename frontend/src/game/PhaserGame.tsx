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

    return () => {
      gameRef.current?.destroy(true)
      gameRef.current = null
    }
  }, [])

  return <div ref={containerRef} id="game-container" />
}

export default PhaserGame
