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
// Phaser Text는 기본 resolution 1로 그려져, FIT 스케일로 화면이 확대되면 텍스트가 뿌옇게 늘어난다.
// 화면 배율(창/게임)×DPR만큼 고배율로 그려두면 확대돼도 선명하다. 작은 라벨이라 메모리 부담은 무시할 수준.
const TEXT_RESOLUTION = Math.max(2, Math.ceil(window.devicePixelRatio || 1) * 2)

/**
 * 말풍선 Y오프셋 미세조정(px, 기본 계산값에 더함). 원본 이미지의 여백/비율 차이로 특정
 * NPC만 말풍선이 머리와 어긋나 보일 때 여기서 그 NPC(textureKey)만 보정한다.
 * 양수 = 더 위로, 음수 = 더 아래로.
 */
const BUBBLE_OFFSET_ADJUST: Record<string, number> = {
  npc_castle_lord: 5, // 동탁 — 말풍선을 조금 더 위로 (양수 = 위로)
}
/**
 * 말풍선 X오프셋 미세조정(px, 머리 중앙 기준). 이미지 안에서 인물이 한쪽으로 치우쳐 그려져
 * 말풍선이 머리와 좌우로 어긋날 때 그 NPC(textureKey)만 보정한다.
 * 양수 = 오른쪽, 음수 = 왼쪽.
 */
const BUBBLE_OFFSET_X: Record<string, number> = {
  npc_castle_lord: 5, // 동탁 — 말풍선을 살짝 오른쪽으로 (양수 = 오른쪽)
}

/**
 * NPC별 표시 크기 override(px). 여기 없으면 아래 DEFAULT_NPC_SIZE(82px)를 쓴다.
 * 특정 NPC만 크게/작게 하려면 그 textureKey에 [width, height]를 지정한다.
 */
const NPC_DISPLAY_SIZE: Record<string, [number, number]> = {
  npc_castle_lord: [136, 136],  // 동탁 — 원본 해상도가 커서 크게
  npc_village_chief: [96, 96],  // 성 밖 수문장 — 크기 조정은 이 값에서
}
const DEFAULT_NPC_SIZE = 82

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
    // NPC별 표시 크기 — NPC_DISPLAY_SIZE에 있으면 그 값, 없으면 기본 82px
    const [dw, dh] = NPC_DISPLAY_SIZE[def.textureKey] ?? [DEFAULT_NPC_SIZE, DEFAULT_NPC_SIZE]
    this.setDisplaySize(dw, dh)
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
        resolution: TEXT_RESOLUTION,
      })
      .setOrigin(0.5)

    // 말풍선: NPC 실제 크기(발밑 이름표와 같은 기준)에 맞춰 머리 위 여백을 계산 —
    // 동탁(136px)은 자연히 더 높게, 작은 NPC(82px)는 더 낮게 위치한다.
    const bubbleOffsetY = this.displayHeight / 2 + 14 + (BUBBLE_OFFSET_ADJUST[def.textureKey] ?? 0)
    this.bubbleText = scene.add
      .text(0, 0, '', {
        fontSize: '10px', color: '#222222', wordWrap: { width: 130 }, resolution: TEXT_RESOLUTION,
      })
      .setOrigin(0.5)
    const bubbleOffsetX = BUBBLE_OFFSET_X[def.textureKey] ?? 0
    const bg = scene.add.graphics()
    this.bubble = scene.add.container(x + bubbleOffsetX, y - bubbleOffsetY, [bg, this.bubbleText]).setVisible(false)
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
