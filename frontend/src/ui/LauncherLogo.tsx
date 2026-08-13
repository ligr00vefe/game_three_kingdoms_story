import { useEffect, type RefObject } from 'react'

type Point = [number, number]

const LOGO_WIDTH = 1408
const LOGO_HEIGHT = 1024
const characterMasks: Point[][] = [
  [[22, 505], [320, 505], [350, 832], [90, 850]],
  [[1088, 505], [1388, 505], [1370, 850], [1090, 832]],
  [[500, 700], [950, 700], [950, 875], [500, 875]],
]

function drawMask(context: CanvasRenderingContext2D, points: Point[]) {
  context.beginPath()
  context.moveTo(points[0][0], points[0][1])
  points.slice(1).forEach(([x, y]) => context.lineTo(x, y))
  context.closePath()
}

function popScale(progress: number) {
  if (progress <= 0.18) return 0.34 + progress / 0.18 * 0.84
  if (progress <= 0.32) return 1.18 - (progress - 0.18) / 0.14 * 0.26
  if (progress <= 0.47) return 0.92 + (progress - 0.32) / 0.15 * 0.14
  return 1
}

export function LauncherLogo({ logoRef }: { logoRef: RefObject<HTMLCanvasElement | null> }) {
  useEffect(() => {
    const canvas = logoRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    const image = new Image()
    image.src = '/assets/img/logo/main_logo.png'
    let frame = 0
    let startedAt = 0
    const duration = 460

    const render = (now: number) => {
      if (!startedAt) startedAt = now
      const elapsed = now - startedAt
      context.clearRect(0, 0, LOGO_WIDTH, LOGO_HEIGHT)
      context.drawImage(image, 0, 0, LOGO_WIDTH, LOGO_HEIGHT)

      // 정적 레이어에서는 캐릭터 영역을 비워 글자와 배경만 고정한다.
      context.save()
      context.globalCompositeOperation = 'destination-out'
      characterMasks.forEach((mask) => {
        drawMask(context, mask)
        context.fill()
      })
      context.restore()

      characterMasks.forEach((mask, index) => {
        const progress = Math.max(0, Math.min(1, (elapsed - index * 105) / duration))
        if (progress === 0) return
        const scale = popScale(progress)
        const bounds = mask.reduce((result, [x, y]) => ({
          left: Math.min(result.left, x), right: Math.max(result.right, x),
          top: Math.min(result.top, y), bottom: Math.max(result.bottom, y),
        }), { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity })
        const centerX = (bounds.left + bounds.right) / 2
        const centerY = (bounds.top + bounds.bottom) / 2

        context.save()
        drawMask(context, mask)
        context.clip()
        context.translate(centerX, centerY)
        context.scale(scale, scale)
        context.translate(-centerX, -centerY)
        context.drawImage(image, 0, 0, LOGO_WIDTH, LOGO_HEIGHT)
        context.restore()
      })

      if (elapsed < duration + 260) frame = requestAnimationFrame(render)
    }

    const start = () => {
      canvas.width = LOGO_WIDTH
      canvas.height = LOGO_HEIGHT
      startedAt = 0
      frame = requestAnimationFrame(render)
    }
    if (image.complete) start()
    else image.addEventListener('load', start, { once: true })
    return () => {
      cancelAnimationFrame(frame)
      image.removeEventListener('load', start)
    }
  }, [logoRef])

  return <canvas ref={logoRef} className="launcher-logo" aria-label="삼국지 스토리" role="img" />
}
