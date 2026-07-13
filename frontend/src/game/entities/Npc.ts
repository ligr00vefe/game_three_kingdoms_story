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
// 플레이어(기본 depth 0)보다 뒤에 그려지도록 — 안 그러면 NPC가 캐릭터를 지나갈 때 캐릭터를 가림
const NPC_DEPTH = -10

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
  private hovered = false
  private playerOverlapping = false
  private glowFx?: Phaser.FX.Glow

  constructor(scene: Phaser.Scene, x: number, y: number, code: string, def: NpcDef) {
    super(scene, x, y, def.textureKey)
    this.code = code
    this.def = def
    // 동탁(npc_castle_lord)은 원본 이미지 해상도가 커서 더 큰 표시 크기가 필요, 나머지 NPC는 기본 64px
    if (def.textureKey === 'npc_castle_lord') {
      this.setDisplaySize(136, 136)
    } else {
      this.setDisplaySize(82, 82)
    }
    this.setDepth(NPC_DEPTH)
    scene.add.existing(this)

    // 호버/캐릭터 겹침 시 이미지 외곽에 테두리(글로우) 표시 — preFX는 WebGL 전용이라 없으면 무시
    this.setInteractive({ useHandCursor: true })
    this.on('pointerover', () => this.setHovered(true))
    this.on('pointerout', () => this.setHovered(false))

    // 이름표 (GAME_DESIGN 9장) — 발밑에 표시. padding.y가 음수면 Phaser 텍스트 높이 계산이
    // 깨져 이름표 자체가 안 보이는 버그가 있었어서 양수로 고정.
    const nameTagOffsetY = this.displayHeight / 2 + 10
    scene.add
      .text(x, y + nameTagOffsetY, def.name, {
        fontSize: '12px', color: '#ffff00', backgroundColor: '#00000088', padding: { x: 5, y: 2 },
      })
      .setOrigin(0.5)

    // 말풍선: NPC 실제 크기(발밑 이름표와 같은 기준)에 맞춰 머리 위 여백을 계산 —
    // 동탁(136px)은 자연히 더 높게, 작은 NPC(82px)는 더 낮게 위치한다.
    const bubbleOffsetY = this.displayHeight / 2 + 14
    this.bubbleText = scene.add
      .text(0, 0, '', { fontSize: '12px', color: '#333333', wordWrap: { width: 150 } })
      .setOrigin(0.5)
    const bg = scene.add.graphics()
    this.bubble = scene.add.container(x, y - bubbleOffsetY, [bg, this.bubbleText]).setVisible(false)
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

  private setHovered(hovered: boolean) {
    this.hovered = hovered
    this.updateHighlight()
  }

  /** 매 프레임 GameScene에서 호출 — 캐릭터가 겹쳐 있는 동안 테두리 표시 */
  setPlayerOverlap(overlapping: boolean) {
    if (this.playerOverlapping === overlapping) return
    this.playerOverlapping = overlapping
    this.updateHighlight()
  }

  private updateHighlight() {
    const active = this.hovered || this.playerOverlapping
    if (active && !this.glowFx) {
      this.glowFx = this.preFX?.addGlow(0xffee55, 3, 0, false)
    } else if (!active && this.glowFx) {
      this.preFX?.remove(this.glowFx)
      this.glowFx = undefined
    }
  }
}
