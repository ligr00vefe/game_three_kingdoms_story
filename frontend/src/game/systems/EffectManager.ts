import Phaser from 'phaser'
import { COMBAT } from '../config'

/**
 * 전투 이펙트/데미지 숫자 전담 — 전부 오브젝트 풀링 (DEVELOPMENT_PLAN 문제 1).
 * 새 이펙트가 필요하면 반드시 이 클래스에 풀을 추가한다. 씬에서 직접 생성 금지.
 */
export class EffectManager {
  private scene: Phaser.Scene
  private attackPool: Phaser.GameObjects.Group
  private skillPool: Phaser.GameObjects.Group
  private sparkPool: Phaser.GameObjects.Group
  private dashPool: Phaser.GameObjects.Group
  private jumpBurstPool: Phaser.GameObjects.Group
  private textPool: Phaser.GameObjects.Group

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.attackPool = scene.add.group({ defaultKey: 'fx_attack', maxSize: 12 })
    this.skillPool = scene.add.group({ defaultKey: 'fx_skill_dragon', maxSize: 4 })
    this.sparkPool = scene.add.group({ defaultKey: 'fx_hit_spark', maxSize: 20 })
    this.dashPool = scene.add.group({ defaultKey: 'fx_dash', maxSize: 8 })
    this.jumpBurstPool = scene.add.group({ defaultKey: 'fx_jump_burst', maxSize: 8 })
    this.textPool = scene.add.group({ maxSize: 30 })
  }

  /** 기본 공격 — 창 찌르기 직선 궤적 (2026-07-16 단일 모션 통합) */
  attack(x: number, y: number, facing: -1 | 1) {
    const img = this.attackPool.get(x, y) as Phaser.GameObjects.Image | null
    if (!img) return
    img.setActive(true).setVisible(true)
    img.setPosition(x, y).setAlpha(0.95).setScale(0.6, 1).setFlipX(facing === -1)
    // 전방으로 뻗어 나가는 연출: 가로 스케일 확장 + 약간 전진
    this.scene.tweens.add({
      targets: img, scaleX: 1.15, x: x + facing * 26, alpha: 0,
      duration: COMBAT.ATTACK_DURATION_MS * 0.55, ease: 'Cubic.easeOut',
      onComplete: () => { img.setActive(false).setVisible(false) },
    })
  }

  /** 점프 대쉬 잔상 (점프키 2연타) */
  dashTrail(x: number, y: number, facing: -1 | 1) {
    const img = this.dashPool.get(x - facing * 34, y) as Phaser.GameObjects.Image | null
    if (!img) return
    img.setActive(true).setVisible(true)
    img.setPosition(x - facing * 34, y).setAlpha(0.85).setScale(1).setFlipX(facing === -1)
    this.scene.tweens.add({
      targets: img, x: x - facing * 70, alpha: 0, scaleX: 1.3,
      duration: 240, ease: 'Quad.easeOut',
      onComplete: () => { img.setActive(false).setVisible(false) },
    })
  }

  /** 이단 점프 하강풍 (↑ + 점프 2연타) — 발밑에서 아래로 뿜어져 나간다 */
  doubleJumpBurst(x: number, y: number) {
    const img = this.jumpBurstPool.get(x, y) as Phaser.GameObjects.Image | null
    if (!img) return
    img.setActive(true).setVisible(true)
    img.setPosition(x, y).setAlpha(0.9).setScale(0.9).setFlipX(false)
    this.scene.tweens.add({
      targets: img, y: y + 34, alpha: 0, scaleX: 1.25, scaleY: 1.15,
      duration: 300, ease: 'Quad.easeOut',
      onComplete: () => { img.setActive(false).setVisible(false) },
    })
  }

  /** 청룡참 (GAME_DESIGN 4.2 — 푸른 용 형상 대형 참격) */
  skillDragon(x: number, y: number, facing: -1 | 1) {
    const img = this.skillPool.get(x, y) as Phaser.GameObjects.Image | null
    if (!img) return
    this.playOnce(img, x, y, facing, 1.15, COMBAT.SKILL_DURATION_MS * 0.9)
  }

  hitSpark(x: number, y: number) {
    const img = this.sparkPool.get(x, y) as Phaser.GameObjects.Image | null
    if (!img) return
    this.playOnce(img, x, y, 1, 0.8, 180)
  }

  /** 레벨업 빛 기둥 (GAME_DESIGN 5.1) — 저빈도라 풀 없이 생성/파괴 */
  levelUp(target: Phaser.GameObjects.Sprite) {
    const pillar = this.scene.add.rectangle(target.x, target.y - 20, 70, 180, 0xfff176, 0.55)
    const label = this.scene.add
      .text(target.x, target.y - 90, 'LEVEL UP!', {
        fontSize: '22px', fontStyle: 'bold', color: '#ffd600', stroke: '#7b5800', strokeThickness: 4,
      })
      .setOrigin(0.5)
    this.scene.tweens.add({
      targets: [pillar, label], alpha: 0, y: '-=40', duration: 1200, ease: 'Cubic.easeOut',
      onComplete: () => { pillar.destroy(); label.destroy() },
    })
  }

  /** 대상별 연타 스택 (최대 3단) — 같은 대상을 연속 타격하면 숫자가 위로 쌓인다 */
  private damageStacks = new WeakMap<object, { idx: number; lastAt: number }>()
  private playerStack = { idx: 0, lastAt: -Infinity }
  /** 이 시간 안에 재타격하면 연타로 취급해 위로 쌓음 */
  private static readonly STACK_WINDOW_MS = 700
  private static readonly STACK_GAP_PX = 22
  private static readonly STACK_MAX = 3

  /**
   * 데미지 숫자 (GAME_DESIGN 4.3). kind: 'deal' 내가 준 / 'taken' 받은
   * 크리티컬은 더 크고 화려하게.
   * stackKey를 주면 같은 대상 연타 시 숫자가 위로 쌓였다가 순서대로 사라진다 (최대 3단).
   */
  damageNumber(x: number, y: number, amount: number, kind: 'deal' | 'taken', crit = false, stackKey?: object) {
    let text = this.textPool.getFirstDead(false) as Phaser.GameObjects.Text | null
    if (!text) {
      if (this.textPool.getLength() >= 30) return
      text = this.scene.add.text(0, 0, '', {
        fontSize: '18px', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5)
      this.textPool.add(text)
    }

    // 연타 스택 오프셋 계산: 대상별로 최근 타격이면 한 단 위에 표시
    let stackOffset = 0
    if (stackKey) {
      const now = this.scene.time.now
      let s = kind === 'taken' ? this.playerStack : this.damageStacks.get(stackKey)
      if (!s) {
        s = { idx: 0, lastAt: -Infinity }
        this.damageStacks.set(stackKey, s)
      }
      if (now - s.lastAt > EffectManager.STACK_WINDOW_MS) s.idx = 0
      stackOffset = (s.idx % EffectManager.STACK_MAX) * EffectManager.STACK_GAP_PX
      s.idx += 1
      s.lastAt = now
    }

    text.setActive(true).setVisible(true)
    text.setPosition(
      stackKey ? x : x + Phaser.Math.Between(-8, 8), // 스택형은 같은 세로 열에 정렬
      y - stackOffset,
    )
    text.setText(String(amount))
    text.setColor(kind === 'taken' ? '#ff5252' : crit ? '#ffab00' : '#ffe082')
    text.setFontSize(crit ? 26 : kind === 'taken' ? 16 : 18)
    text.setAlpha(1).setScale(crit ? 1.15 : 1)

    this.scene.tweens.add({
      targets: text, y: y - stackOffset - 44, alpha: 0, duration: 650, ease: 'Cubic.easeOut',
      onComplete: () => { text!.setActive(false).setVisible(false) },
    })
  }

  /** 아이템 획득 라벨 (GAME_DESIGN 8.1) — 데미지 숫자 풀 재사용 */
  pickupLabel(x: number, y: number, label: string) {
    let text = this.textPool.getFirstDead(false) as Phaser.GameObjects.Text | null
    if (!text) {
      if (this.textPool.getLength() >= 30) return
      text = this.scene.add.text(0, 0, '', {
        fontSize: '13px', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5)
      this.textPool.add(text)
    }
    text.setActive(true).setVisible(true)
    text.setPosition(x, y).setText(label).setColor('#a5d6a7').setFontSize(13).setAlpha(1).setScale(1)
    this.scene.tweens.add({
      targets: text, y: y - 30, alpha: 0, duration: 700, ease: 'Cubic.easeOut',
      onComplete: () => { text!.setActive(false).setVisible(false) },
    })
  }

  private playOnce(
    img: Phaser.GameObjects.Image, x: number, y: number,
    facing: -1 | 1 | number, scale: number, durationMs: number,
  ) {
    img.setActive(true).setVisible(true)
    img.setPosition(x, y).setAlpha(0.95).setScale(scale)
    img.setFlipX(facing === -1)
    this.scene.tweens.add({
      targets: img, alpha: 0, scale: scale * 1.25, duration: durationMs, ease: 'Quad.easeOut',
      onComplete: () => { img.setActive(false).setVisible(false) },
    })
  }
}
