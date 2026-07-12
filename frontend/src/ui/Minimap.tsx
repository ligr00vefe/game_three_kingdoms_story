import { useEffect, useRef } from 'react'
import { EventBus, GameEvents } from '../game/EventBus'
import { useUiStore } from '../stores/uiStore'

interface MapInfo {
  name: string
  displayName: string
  worldWidth: number
  worldHeight: number
  groundY: number
  platforms: { x: number; y: number; width: number }[]
  ladders: { x: number; yTop: number; yBottom: number }[]
  npcs: { x: number; y: number }[]
  portals: { x: number; y: number }[]
}

// GameScene.create()가 React 마운트 타이밍과 무관하게 emit해도 잃지 않도록 모듈 수준에서 캐시
let lastMapInfo: MapInfo | null = null
EventBus.on(GameEvents.MAP_INFO, (info: MapInfo) => { lastMapInfo = info })

const W = 200
const H = 64

/**
 * 미니맵 (좌상단, 메이플 스타일 프레임).
 * 맵 지형(JSON)은 정적으로 1회 그리고, 플레이어 점만 PLAYER_MOVED(100ms)마다 갱신.
 * canvas 직접 드로우 — React 리렌더 없음.
 */
export function Minimap() {
  const open = useUiStore((s) => s.minimapOpen)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const nameRef = useRef<HTMLSpanElement>(null)
  const baseRef = useRef<HTMLCanvasElement | null>(null) // 지형만 그려둔 오프스크린
  const playerPos = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (!open) return

    const drawBase = (info: MapInfo) => {
      const base = document.createElement('canvas')
      base.width = W
      base.height = H
      const ctx = base.getContext('2d')!
      const sx = W / info.worldWidth
      const sy = H / info.worldHeight

      ctx.fillStyle = 'rgba(20, 34, 24, 0.88)'
      ctx.fillRect(0, 0, W, H)
      // 지면
      ctx.fillStyle = '#5d8a4a'
      ctx.fillRect(0, info.groundY * sy, W, H - info.groundY * sy)
      ctx.fillStyle = '#8bc34a'
      ctx.fillRect(0, info.groundY * sy, W, 2)
      // 발판
      ctx.fillStyle = '#a1887f'
      for (const p of info.platforms) {
        ctx.fillRect(p.x * sx, p.y * sy, Math.max(2, p.width * sx), 2)
      }
      // 사다리/줄
      ctx.strokeStyle = '#d7ccc8'
      ctx.lineWidth = 1
      for (const l of info.ladders) {
        ctx.beginPath()
        ctx.moveTo(l.x * sx, l.yTop * sy)
        ctx.lineTo(l.x * sx, l.yBottom * sy)
        ctx.stroke()
      }
      // NPC (초록 점)
      ctx.fillStyle = '#69f0ae'
      for (const n of info.npcs) {
        ctx.beginPath()
        ctx.arc(n.x * sx, n.y * sy, 2, 0, Math.PI * 2)
        ctx.fill()
      }
      // 포탈 (하늘색 점)
      ctx.fillStyle = '#40c4ff'
      for (const p of info.portals ?? []) {
        ctx.beginPath()
        ctx.arc(p.x * sx, p.y * sy, 2.5, 0, Math.PI * 2)
        ctx.fill()
      }
      baseRef.current = base
      if (nameRef.current) nameRef.current.textContent = info.displayName
    }

    const render = () => {
      const canvas = canvasRef.current
      const base = baseRef.current
      const info = lastMapInfo
      if (!canvas || !base || !info) return
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, W, H)
      ctx.drawImage(base, 0, 0)
      // 플레이어 (노란 점 + 흰 테두리)
      const px = (playerPos.current.x / info.worldWidth) * W
      const py = (playerPos.current.y / info.worldHeight) * H
      ctx.beginPath()
      ctx.arc(px, py, 2.5, 0, Math.PI * 2)
      ctx.fillStyle = '#ffd835'
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 0.8
      ctx.stroke()
    }

    if (lastMapInfo) {
      drawBase(lastMapInfo)
      render()
    }
    const onMapInfo = (info: MapInfo) => { drawBase(info); render() }
    const onMoved = (p: { x: number; y: number }) => { playerPos.current = p; render() }
    EventBus.on(GameEvents.MAP_INFO, onMapInfo)
    EventBus.on(GameEvents.PLAYER_MOVED, onMoved)
    return () => {
      EventBus.off(GameEvents.MAP_INFO, onMapInfo)
      EventBus.off(GameEvents.PLAYER_MOVED, onMoved)
    }
  }, [open])

  if (!open) return null

  return (
    <div className="minimap">
      <div className="minimap-titlebar">
        <span className="minimap-title">MINI MAP</span>
        <span ref={nameRef} className="minimap-name" />
        <button
          className="minimap-btn"
          title="접기 (M)"
          onClick={() => useUiStore.getState().toggleMinimap()}
        >
          −
        </button>
      </div>
      <canvas ref={canvasRef} width={W} height={H} className="minimap-canvas" />
    </div>
  )
}
