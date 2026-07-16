import Phaser from 'phaser'
import { EffectManager } from '../systems/EffectManager'

export interface MonsterDef {
  name: string
  /** 대기 상태 텍스처(=기본 텍스처). 프레임이 2장 이상이면 애니메이션으로 재생된다. */
  textureKey: string
  /** 이동 상태 스프라이트시트. 없으면 이동 중에도 textureKey를 그대로 쓴다(아트 없는 몬스터 방어). */
  runTextureKey?: string
  maxHp: number
  attack: number
  defense: number
  exp: number
  moveSpeed: number
  detectRange: number
  attackRange: number
  attackCooldownMs: number
  attackWindupMs: number
}

type MonsterState = 'spawning' | 'wander' | 'chase' | 'windup' | 'hit' | 'dead' | 'inactive'

/** 공격이 닿는 세로 허용 거리 — 몸통(52px)이 실제로 겹치는 수준만 인정 (발판 위 플레이어 오폭 방지) */
const ATTACK_VERTICAL_RANGE = 48
/** 대기/이동 애니메이션 재생 속도(fps). 이동은 def.moveSpeed 기준 속도에 맞춘 값이고,
 *  실제 재생은 현재 속도 비율로 timeScale을 걸어 배회(절반 속도)에서 발이 미끄러지지 않게 한다. */
const IDLE_FRAME_RATE = 4
const RUN_FRAME_RATE = 12
/** 감지(추적 시작)의 세로 허용 거리 — 이보다 높이 차가 크면 없는 사람 취급 */
const DETECT_VERTICAL_RANGE = 90

export interface MonsterTarget {
  x: number
  y: number
  alive: boolean
  /** 몬스터의 공격 적중 시 호출 */
  receiveHit: (attack: number, fromX: number) => void
}

/**
 * 황건당 좀비 (GAME_DESIGN 6.2): 배회 → 감지 → 추적 → 근접 공격.
 * SpawnManager가 풀링으로 재사용한다 — destroy 금지, kill()로 비활성화만.
 */
export class Monster extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body

  def!: MonsterDef
  hp = 0
  private state_: MonsterState = 'inactive'
  private homeXMin = 0
  private homeXMax = 0
  private wanderDir: -1 | 1 = 1
  private nextAttackAt = 0
  private windupUntil = 0
  private hitStunUntil = 0
  private currentAnimKey: string | null = null
  onDied?: (m: Monster) => void

  constructor(scene: Phaser.Scene, def: MonsterDef) {
    super(scene, 0, 0, def.textureKey)
    this.def = def
    scene.add.existing(this)
    scene.physics.add.existing(this)
    this.body.setSize(36, 52)
    this.body.setOffset(14, 12)
    this.createAnims()
    this.deactivate()
  }

  /**
   * 대기/이동 애니메이션 등록. 아트가 없거나 단일 프레임이면 만들지 않고 정적 텍스처로 남는다
   * (도형 placeholder 방어) — 플레이어의 createPlayerAnims와 같은 규약.
   */
  private createAnims() {
    const specs: [key: string | undefined, frameRate: number][] = [
      [this.def.textureKey, IDLE_FRAME_RATE],
      [this.def.runTextureKey, RUN_FRAME_RATE],
    ]
    for (const [key, frameRate] of specs) {
      if (!key || !this.scene.textures.exists(key) || this.scene.anims.exists(key)) continue
      // frameTotal은 __BASE를 포함하므로 실제 프레임 수 = frameTotal - 1
      const frames = this.scene.textures.get(key).frameTotal - 1
      if (frames < 2) continue
      this.scene.anims.create({
        key,
        frames: this.scene.anims.generateFrameNumbers(key, { start: 0, end: frames - 1 }),
        frameRate,
        repeat: -1,
      })
    }
  }

  /** 스폰 (땅에서 기어나오는 연출, GAME_DESIGN 6.3) */
  spawnAt(x: number, groundY: number, xMin: number, xMax: number, riseMs: number) {
    this.homeXMin = xMin
    this.homeXMax = xMax
    this.hp = this.def.maxHp
    this.setActive(true).setVisible(true)
    // 풀에서 재사용되므로 이전 생의 애니메이션을 지우고 대기 모습으로 되돌린다
    this.anims.stop()
    this.anims.timeScale = 1
    this.setTexture(this.def.textureKey)
    this.currentAnimKey = null
    this.setPosition(x, groundY - 26)
    this.setAlpha(0).setScale(1, 0.2).setOrigin(0.5, 1)
    this.y = groundY
    this.body.enable = false
    this.state_ = 'spawning'
    this.setTint(0x9e9e9e)

    this.scene.tweens.add({
      targets: this, alpha: 1, scaleY: 1, duration: riseMs, ease: 'Back.easeOut',
      onComplete: () => {
        this.setOrigin(0.5, 0.5)
        this.y = groundY - 32
        this.clearTint()
        this.body.enable = true
        this.state_ = 'wander'
        this.wanderDir = Math.random() < 0.5 ? -1 : 1
      },
    })
  }

  update(target: MonsterTarget, now: number) {
    this.updateBehaviour(target, now)
    this.updateAnimation()
  }

  /** 이동 중이면 달리기, 멈춰 있으면 대기 (GAME_DESIGN 6.2의 배회/추적/공격 상태를 속도로 읽는다) */
  private updateAnimation() {
    if (!this.alive) return
    const speed = Math.abs(this.body.velocity.x)
    const runKey = this.def.runTextureKey
    const moving = speed > 1 && !!runKey && this.scene.anims.exists(runKey)

    const key = moving ? runKey! : this.def.textureKey
    if (key !== this.currentAnimKey) {
      this.currentAnimKey = key
      // 단일 프레임 아트는 애니메이션이 없다 — 텍스처만 바꿔 끼운다
      if (this.scene.anims.exists(key)) this.play(key, true)
      else { this.anims.stop(); this.setTexture(key) }
    }
    // 배회는 추적의 절반 속도라 같은 재생속도로 돌리면 발이 미끄러진다 — 속도에 비례시킨다
    this.anims.timeScale = moving ? Math.min(1, speed / this.def.moveSpeed) : 1
  }

  private updateBehaviour(target: MonsterTarget, now: number) {
    if (this.state_ === 'inactive' || this.state_ === 'dead' || this.state_ === 'spawning') return

    if (this.state_ === 'hit') {
      if (now < this.hitStunUntil) return
      this.clearTint()
      this.state_ = 'chase'
    }

    const dx = target.x - this.x
    const dist = Math.abs(dx)
    // 세로 거리 판정: 발판 위 등 높이가 다르면 감지/공격 대상이 아니다
    const dy = Math.abs(target.y - this.y)

    if (this.state_ === 'windup') {
      this.setVelocityX(0)
      if (now >= this.windupUntil) {
        this.clearTint()
        // 공격 판정: 윈드업 종료 시점에 사거리 안 + 몸통 높이가 겹칠 때만 적중 (GAME_DESIGN 6.2)
        if (target.alive && dist <= this.def.attackRange + 12 && dy <= ATTACK_VERTICAL_RANGE) {
          target.receiveHit(this.def.attack, this.x)
        }
        this.nextAttackAt = now + this.def.attackCooldownMs
        this.state_ = 'chase'
      }
      return
    }

    if (target.alive && dist <= this.def.detectRange && dy <= DETECT_VERTICAL_RANGE) {
      // 추적 (느릿하게, GAME_DESIGN 6.2)
      if (dist <= this.def.attackRange && dy <= ATTACK_VERTICAL_RANGE) {
        this.setVelocityX(0)
        if (now >= this.nextAttackAt) {
          this.state_ = 'windup'
          this.windupUntil = now + this.def.attackWindupMs
          this.setTint(0xffcc80) // 공격 전조
        }
      } else {
        this.state_ = 'chase'
        const dir = dx > 0 ? 1 : -1
        this.setVelocityX(this.def.moveSpeed * dir)
        this.setFlipX(dir === -1)
      }
    } else {
      // 배회: 스폰 지역 좌우 왕복
      this.state_ = 'wander'
      if (this.x <= this.homeXMin) this.wanderDir = 1
      if (this.x >= this.homeXMax) this.wanderDir = -1
      this.setVelocityX(this.def.moveSpeed * 0.5 * this.wanderDir)
      this.setFlipX(this.wanderDir === -1)
    }
  }

  /** 플레이어 공격 적중 (GameScene 전투 판정에서 호출) */
  /** @returns true면 이 공격으로 사망 (경험치 지급 트리거) */
  receiveHit(amount: number, crit: boolean, fromX: number, effects: EffectManager, now: number): boolean {
    if (this.state_ === 'inactive' || this.state_ === 'dead' || this.state_ === 'spawning') return false
    this.hp -= amount
    effects.damageNumber(this.x, this.y - 40, amount, 'deal', crit, this) // 연타 스택 키 = 몬스터 자신
    effects.hitSpark(this.x, this.y - 10)

    if (this.hp <= 0) {
      this.die()
      return true
    }
    this.state_ = 'hit'
    this.hitStunUntil = now + 200
    this.setTint(0xff8a80)
    this.setVelocityX(fromX < this.x ? 90 : -90) // 밀려남
    return false
  }

  private die() {
    this.state_ = 'dead'
    this.body.enable = false
    this.setVelocity(0, 0)
    this.anims.stop() // 쓰러지는 동안 달리기 사이클이 계속 돌지 않게
    this.setTint(0x616161)
    // 쓰러지는 모션 후 소멸 (GAME_DESIGN 6.2)
    this.scene.tweens.add({
      targets: this, angle: 90, alpha: 0, duration: 450, ease: 'Quad.easeIn',
      onComplete: () => {
        this.setAngle(0)
        this.deactivate()
        this.onDied?.(this)
      },
    })
  }

  private deactivate() {
    this.state_ = 'inactive'
    this.setActive(false).setVisible(false)
    this.body.enable = false
    this.clearTint()
    this.setAlpha(1)
  }

  get alive() {
    return this.state_ !== 'inactive' && this.state_ !== 'dead' && this.state_ !== 'spawning'
  }
}
