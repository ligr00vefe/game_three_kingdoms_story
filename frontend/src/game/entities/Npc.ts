import Phaser from 'phaser'
import { drawSpeechBubble } from '../utils/bubble'

export interface NpcDef {
  name: string
  textureKey: string
  bubbles: string[]
  dialog: string[]
}

const BUBBLE_EVERY_MS = 8000
const BUBBLE_SHOW_MS = 3000
const INTERACT_RANGE = 60

/**
 * 비전투 NPC (GAME_DESIGN 9장): 이름표 + 주기적 말풍선(월드 좌표 부착 = Phaser 담당).
 * 대화창 UI는 React가 담당 — 여기서는 상호작용 이벤트만 발행한다.
 */
export class Npc extends Phaser.GameObjects.Sprite {
  readonly code: string
  readonly def: NpcDef
  private bubble: Phaser.GameObjects.Container
  private bubbleText: Phaser.GameObjects.Text
  private bubbleIndex = 0

  constructor(scene: Phaser.Scene, x: number, y: number, code: string, def: NpcDef) {
    super(scene, x, y, def.textureKey)
    this.code = code
    this.def = def
    scene.add.existing(this)

    // 이름표 (GAME_DESIGN 9장)
    scene.add
      .text(x, y - 44, def.name, {
        fontSize: '12px', color: '#ffffff', backgroundColor: '#00000088', padding: { x: 5, y: 2 },
      })
      .setOrigin(0.5)

    // 말풍선 (재사용 컨테이너 1개 — 생성/파괴 반복 없음)
    this.bubbleText = scene.add
      .text(0, 0, '', { fontSize: '12px', color: '#333333', wordWrap: { width: 150 } })
      .setOrigin(0.5)
    const bg = scene.add.graphics()
    this.bubble = scene.add.container(x, y - 78, [bg, this.bubbleText]).setVisible(false)
    ;(this.bubble as Phaser.GameObjects.Container & { bg?: Phaser.GameObjects.Graphics }).bg = bg

    if (def.bubbles.length > 0) {
      scene.time.addEvent({ delay: BUBBLE_EVERY_MS, loop: true, callback: () => this.showBubble() })
    }
  }

  private showBubble() {
    const msg = this.def.bubbles[this.bubbleIndex % this.def.bubbles.length]
    this.bubbleIndex += 1
    this.bubbleText.setText(msg)

    const bg = (this.bubble as Phaser.GameObjects.Container & { bg?: Phaser.GameObjects.Graphics }).bg!
    const w = this.bubbleText.width + 16
    const h = this.bubbleText.height + 10
    drawSpeechBubble(bg, w, h)

    this.bubble.setVisible(true)
    this.scene.time.delayedCall(BUBBLE_SHOW_MS, () => this.bubble.setVisible(false))
  }

  isPlayerNear(px: number, py: number): boolean {
    return Math.abs(px - this.x) < INTERACT_RANGE && Math.abs(py - this.y) < 70
  }
}
