import { useEffect, type RefObject } from 'react'

const LOGO_WIDTH = 1390
const LOGO_HEIGHT = 1009
const INITIAL_DELAY = 1000
const CHARACTER_DELAY = 350
const CHARACTER_DURATION = 390
const CLOUD_X = 253
const CLOUD_Y = 743

const characterLayers = [
  { src: '/assets/img/logo/logo_char_01.png', x: 30, y: 525, startX: 140, startY: 300, coverBottom: 844 },
  { src: '/assets/img/logo/logo_char_02.png', x: 1036, y: 547, startX: -140, startY: 285, coverBottom: 844 },
  { src: '/assets/img/logo/logo_char_03.png', x: 543, y: 708, startX: 0, startY: 190, coverBottom: 865 },
]

function popProgress(progress: number) {
  const segment = (from: number, to: number, start: number, end: number) => {
    const t = Math.min(1, Math.max(0, (progress - start) / (end - start)))
    const snap = 1 - (1 - t) ** 3
    return from + (to - from) * snap
  }

  if (progress < 0.12) return 0
  if (progress < 0.38) return segment(0, 1.2, 0.12, 0.38)
  if (progress < 0.56) return segment(1.2, 0.88, 0.38, 0.56)
  if (progress < 0.72) return segment(0.88, 1.09, 0.56, 0.72)
  if (progress < 0.86) return segment(1.09, 0.97, 0.72, 0.86)
  return segment(0.97, 1, 0.86, 1)
}

function loadImage(src: string) {
  const image = new Image()
  image.src = src
  return image
}

export function LauncherLogo({ logoRef }: { logoRef: RefObject<HTMLCanvasElement | null> }) {
  useEffect(() => {
    const canvas = logoRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    const background = loadImage('/assets/img/logo/main_logo.png')
    const cloud = loadImage('/assets/img/logo/logo_cloud.png')
    const characters = characterLayers.map((layer) => ({ ...layer, image: loadImage(layer.src) }))
    const images = [background, cloud, ...characters.map(({ image }) => image)]
    let frame = 0
    let disposed = false

    canvas.width = LOGO_WIDTH
    canvas.height = LOGO_HEIGHT

    const draw = (startedAt: number, now: number) => {
      const elapsed = now - startedAt
      context.clearRect(0, 0, LOGO_WIDTH, LOGO_HEIGHT)
      context.drawImage(background, 0, 0)

      characters.forEach(({ image, x, y, startX, startY, coverBottom }, index) => {
        const progress = Math.min(1, Math.max(0, (elapsed - INITIAL_DELAY - index * CHARACTER_DELAY) / CHARACTER_DURATION))
        if (progress <= 0) return

        const movement = popProgress(progress)
        const drawX = x + startX * (1 - movement)
        const drawY = y + startY * (1 - movement)
        const impact = Math.max(0, Math.min(1, movement))
        const scaleX = 0.96 + impact * 0.04
        const scaleY = 0.9 + impact * 0.1
        const centerX = drawX + image.width / 2
        const centerY = drawY + image.height / 2

        context.save()
        // Keep the character hidden below its foreground prop while it springs out.
        if (progress < 1) {
          context.beginPath()
          context.rect(0, 0, LOGO_WIDTH, coverBottom)
          context.clip()
        }
        context.translate(centerX, centerY)
        context.scale(scaleX, scaleY)
        context.drawImage(image, -image.width / 2, -image.height / 2)
        context.restore()
      })

      // The cloud is a true foreground layer, so characters 01 and 02 pass behind it.
      context.drawImage(cloud, CLOUD_X, CLOUD_Y)

      const totalDuration = INITIAL_DELAY + CHARACTER_DURATION + CHARACTER_DELAY * (characters.length - 1)
      if (!disposed && elapsed < totalDuration) {
        frame = requestAnimationFrame((nextNow) => draw(startedAt, nextNow))
      }
    }

    const start = () => {
      if (disposed) return
      const startedAt = performance.now()
      frame = requestAnimationFrame((now) => draw(startedAt, now))
    }

    Promise.all(images.map((image) => image.complete
      ? Promise.resolve()
      : new Promise<void>((resolve) => image.addEventListener('load', () => resolve(), { once: true }))))
      .then(start)

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
    }
  }, [logoRef])

  return <canvas ref={logoRef} className="launcher-logo" aria-label="Three Kingdoms Defense logo" role="img" />
}
