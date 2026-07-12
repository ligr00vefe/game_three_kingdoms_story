/**
 * 말풍선 그래픽 (본체 + 꼬리)을 하나의 이어진 윤곽선으로 그린다.
 * fillRoundedRect + fillTriangle을 따로 그리면 겹치는 선이 어긋나 보이므로,
 * 모서리 호를 포함한 단일 path로 본체와 꼬리를 연결해 그린다.
 */
export function drawSpeechBubble(g: Phaser.GameObjects.Graphics, w: number, h: number) {
  const r = Math.min(7, h / 2)
  const tailW = 10
  const tailH = 7

  g.clear()
  g.fillStyle(0xffffff, 0.95)
  g.lineStyle(2, 0x9e9e9e)
  g.beginPath()
  g.moveTo(-w / 2 + r, -h / 2)
  g.lineTo(w / 2 - r, -h / 2)
  g.arc(w / 2 - r, -h / 2 + r, r, -Math.PI / 2, 0)
  g.lineTo(w / 2, h / 2 - r)
  g.arc(w / 2 - r, h / 2 - r, r, 0, Math.PI / 2)
  g.lineTo(tailW / 2, h / 2)
  g.lineTo(0, h / 2 + tailH)
  g.lineTo(-tailW / 2, h / 2)
  g.lineTo(-w / 2 + r, h / 2)
  g.arc(-w / 2 + r, h / 2 - r, r, Math.PI / 2, Math.PI)
  g.lineTo(-w / 2, -h / 2 + r)
  g.arc(-w / 2 + r, -h / 2 + r, r, Math.PI, Math.PI * 1.5)
  g.closePath()
  g.fillPath()
  g.strokePath()
}
