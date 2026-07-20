import { useEffect, useRef } from 'react'
import type Phaser from 'phaser'
import { startGame } from './main'

/**
 * Phaser 게임의 React 마운트 지점.
 * - StrictMode(dev)는 effect를 mount→cleanup→remount로 두 번 돌린다. 이때 이전 게임이
 *   부팅 도중 destroy되면 캔버스가 컨테이너에 남아(orphan) 실제 캔버스와 크기가 어긋난 채
 *   겹친다 → 화면 위/아래 여백처럼 보인다. 그래서 생성 전후로 남은 캔버스를 직접 청소한다.
 * - Scale.RESIZE는 원래 window 'resize'로 캔버스를 부모 크기에 맞추는데, 팝업/프리뷰 등
 *   일부 임베드 환경에선 그 이벤트가 안 와서 캔버스가 초기 크기에 멈춘다. ResizeObserver로
 *   컨테이너 크기를 직접 감시해 game.scale.resize()를 호출하면 항상 여백 없이 꽉 찬다.
 */
export function PhaserGame() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // 생성 전 남은 캔버스 정리 (StrictMode 재마운트 대비)
    container.querySelectorAll('canvas').forEach((c) => c.remove())

    const game = startGame(container)

    // 컨테이너 크기 변화를 직접 감시 → 캔버스를 부모에 정확히 맞춘다 (여백 0).
    // RESIZE 모드에선 scale.resize()가 무시되고 scale.refresh()가 부모 크기를 다시 읽어 적용한다.
    const ro = new ResizeObserver(() => {
      if (container.clientWidth > 0 && container.clientHeight > 0) game.scale.refresh()
    })
    ro.observe(container)

    return () => {
      ro.disconnect()
      game.destroy(true)
      // destroy가 부팅 중이면 캔버스를 못 지우는 경우가 있어 직접 제거
      container.querySelectorAll('canvas').forEach((c) => c.remove())
    }
  }, [])

  return <div ref={containerRef} id="game-container" />
}

export default PhaserGame
