import Phaser from 'phaser'
import { EffectManager } from '../systems/EffectManager'

export interface MonsterDef {
  name: string
  /** 대기 상태 텍스처(=기본 텍스처). 프레임이 2장 이상이면 애니메이션으로 재생된다. */
  textureKey: string
  idleFrameRate?: number
  /** 이동 상태 스프라이트시트. 없으면 이동 중에도 textureKey를 그대로 쓴다(아트 없는 몬스터 방어). */
  runTextureKey?: string
  runFrameRate?: number
  /** Optional shamble cadence: move for a while, then hesitate before advancing again. */
  shambleMoveMinMs?: number
  shambleMoveMaxMs?: number
  shamblePauseMinMs?: number
  shamblePauseMaxMs?: number
  /** Optional normal and heavy melee animations. */
  attackTextureKey?: string
  specialAttackTextureKey?: string
  attackFrameRate?: number
  specialAttackFrameRate?: number
  specialAttackEvery?: number
  attackLungeSpeed?: number
  attackCameraShake?: number
  hitTextureKey?: string
  hitStunMs?: number
  hitFrameRate?: number
  deathTextureKey?: string
  deathFrameRate?: number
  /** Ground contact line inside death frames, measured from the frame top (0..1). */
  deathSpriteFootYRatio?: number
  /** Optional aerial entrance and shield-charge presentation. */
  fallingTextureKey?: string
  fallingSpriteScale?: number
  dropEffectTextureKey?: string
  dropEffectScale?: number
  dropDamage?: number
  dropDamageRadius?: number
  dashEffectTextureKey?: string
  chargeSpeed?: number
  chargeTriggerRange?: number
  chargeCooldownMs?: number
  /** Render scale and foot-aligned origin for oversized source frames. */
  spriteScale?: number
  spriteOriginY?: number
  /** Actual foot line inside a frame, measured from its top (0..1). */
  spriteFootYRatio?: number
  /** True when the source artwork faces left without horizontal flipping. */
  facesLeftByDefault?: boolean
  maxHp: number
  attack: number
  defense: number
  exp: number
  moveSpeed: number
  detectRange: number
  attackRange: number
  attackCooldownMs: number
  attackWindupMs: number
  /** Complete the windup by launching a projectile instead of applying a melee hit. */
  rangedAttack?: boolean
}

type MonsterState = 'spawning' | 'wander' | 'chase' | 'charge' | 'windup' | 'hit' | 'dead' | 'inactive'

/** 공격이 닿는 세로 허용 거리 — 몸통(52px)이 실제로 겹치는 수준만 인정 (발판 위 플레이어 오폭 방지) */
const ATTACK_VERTICAL_RANGE = 48
/** 대기/이동 애니메이션 재생 속도(fps). 이동은 def.moveSpeed 기준 속도에 맞춘 값이고,
 *  실제 재생은 현재 속도 비율로 timeScale을 걸어 배회(절반 속도)에서 발이 미끄러지지 않게 한다. */
const IDLE_FRAME_RATE = 4
const RUN_FRAME_RATE = 12
const ATTACK_FRAME_RATE = 12
const HIT_FRAME_RATE = 16
const DEATH_FRAME_RATE = 7
/** 감지(추적 시작)의 세로 허용 거리 — 이보다 높이 차가 크면 없는 사람 취급 */
const DETECT_VERTICAL_RANGE = 90
/** 고체력 몬스터 체력바 한 층의 HP. 한 번의 타격은 한 층까지만 깎는다. */
const HP_BAR_LAYER_SIZE = 100
/** 아래층부터 위층 순서. 현재 층이 소진되면 바로 아래 색상의 체력바가 드러난다. */
const HP_BAR_LAYER_COLORS = [
  0xef5350, 0xffc107, 0xab47bc, 0x42a5f5, 0x66bb6a,
  0x26c6da, 0xff7043, 0x5c6bc0, 0xec407a, 0x8d6e63,
] as const

export interface MonsterTarget {
  x: number
  y: number
  alive: boolean
  /** 몬스터의 공격 적중 시 호출 */
  receiveHit: (attack: number, fromX: number) => void
  /** Bomb zombies deal extra damage to defensive structures. */
  bombDamageMultiplier?: number
  /** 대상 종류별 원거리 공격 사거리. 시설물과 캐릭터 사거리를 분리할 때 사용한다. */
  rangedAttackRange?: number
}

/**
 * 황건당 좀비 (GAME_DESIGN 6.2): 배회 → 감지 → 추적 → 근접 공격.
 * SpawnManager가 풀링으로 재사용한다 — destroy 금지, kill()로 비활성화만.
 */
export class Monster extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body

  def!: MonsterDef
  monsterCode = ''
  hp = 0
  maxHp = 0
  private hpBar: Phaser.GameObjects.Graphics
  private state_: MonsterState = 'inactive'
  private homeXMin = 0
  private homeXMax = 0
  private wanderDir: -1 | 1 = 1
  private facingDir: -1 | 1 = 1
  private nextAttackAt = 0
  private windupUntil = 0
  private hitStunUntil = 0
  private currentAnimKey: string | null = null
  private currentAttackKey: string | null = null
  private attackSequence = 0
  private nextChargeAt = 0
  private dashEffect?: Phaser.GameObjects.Sprite
  private nextShamblePauseAt = 0
  private shamblePauseUntil = 0
  onDied?: (m: Monster) => void
  onRangedAttack?: (m: Monster, impactX: number) => void
  onDropImpact?: (m: Monster, radius: number, damage: number) => void
  /** 원거리 공격 준비를 시작한 순간 고정한 지면 목표 좌표. */
  private windupAimX = 0

  constructor(scene: Phaser.Scene, def: MonsterDef) {
    super(scene, 0, 0, def.textureKey)
    this.def = def
    scene.add.existing(this)
    scene.physics.add.existing(this)
    this.hpBar = scene.add.graphics().setDepth(4)
    const spriteScale = def.spriteScale ?? 1
    const bodyWidth = 36 / spriteScale
    const bodyHeight = 52 / spriteScale
    this.body.setSize(bodyWidth, bodyHeight)
    this.body.setOffset(
      (this.width - bodyWidth) / 2,
      def.spriteScale ? this.height - bodyHeight - 16 : 12,
    )
    this.createAnims()
    this.deactivate()
  }

  /**
   * 대기/이동 애니메이션 등록. 아트가 없거나 단일 프레임이면 만들지 않고 정적 텍스처로 남는다
   * (도형 placeholder 방어) — 플레이어의 createPlayerAnims와 같은 규약.
   */
  private createAnims() {
    const specs: [key: string | undefined, frameRate: number, repeat: number][] = [
      [this.def.textureKey, this.def.idleFrameRate ?? IDLE_FRAME_RATE, -1],
      [this.def.runTextureKey, this.def.runFrameRate ?? RUN_FRAME_RATE, -1],
      [this.def.attackTextureKey, this.def.attackFrameRate ?? ATTACK_FRAME_RATE, 0],
      [this.def.specialAttackTextureKey, this.def.specialAttackFrameRate ?? ATTACK_FRAME_RATE, 0],
      [this.def.hitTextureKey, this.def.hitFrameRate ?? HIT_FRAME_RATE, 0],
      [this.def.deathTextureKey, this.def.deathFrameRate ?? DEATH_FRAME_RATE, 0],
    ]
    for (const [key, frameRate, repeat] of specs) {
      if (!key || !this.scene.textures.exists(key) || this.scene.anims.exists(key)) continue
      // frameTotal은 __BASE를 포함하므로 실제 프레임 수 = frameTotal - 1
      const frames = this.scene.textures.get(key).frameTotal - 1
      if (frames < 2) continue
      this.scene.anims.create({
        key,
        frames: this.scene.anims.generateFrameNumbers(key, { start: 0, end: frames - 1 }),
        frameRate,
        repeat,
      })
    }
    const dashKey = this.def.dashEffectTextureKey
    if (dashKey && this.scene.textures.exists(dashKey) && !this.scene.anims.exists(`${dashKey}_anim`)) {
      const frames = this.scene.textures.get(dashKey).frameTotal - 1
      if (frames > 1) {
        const generated = this.scene.anims.generateFrameNumbers(dashKey, { start: 0, end: frames - 1 })
        // 새 3×2 시트는 작은 먼지(우상단) → 확산 → 큰 먼지(좌하단) → 잔류 순서다.
        const order = [2, 1, 0, 3, 4, 5]
        this.scene.anims.create({
          key: `${dashKey}_anim`,
          frames: order.map((index) => generated[index]).filter(Boolean),
          frameRate: 14,
          repeat: -1,
        })
      }
    }
    const dropKey = this.def.dropEffectTextureKey
    if (dropKey && this.scene.textures.exists(dropKey) && !this.scene.anims.exists(`${dropKey}_anim`)) {
      const frames = this.scene.textures.get(dropKey).frameTotal - 1
      if (frames > 1) {
        this.scene.anims.create({
          key: `${dropKey}_anim`,
          frames: this.scene.anims.generateFrameNumbers(dropKey, { start: 0, end: frames - 1 }),
          frameRate: 14,
          repeat: 0,
        })
      }
    }
  }

  /** 스폰 (땅에서 기어나오는 연출, GAME_DESIGN 6.3) */
  spawnAt(x: number, groundY: number, xMin: number, xMax: number, riseMs: number) {
    // Pooled monsters can change archetype between waves, so register the new definition's animations here too.
    this.createAnims()
    this.homeXMin = xMin
    this.homeXMax = xMax
    this.hp = this.def.maxHp
    this.maxHp = this.def.maxHp
    this.setActive(true).setVisible(true)
    // 풀에서 재사용되므로 이전 생의 애니메이션을 지우고 대기 모습으로 되돌린다
    this.anims.stop()
    this.anims.timeScale = 1
    this.setTexture(this.def.textureKey)
    // Pooled instances can switch archetypes between waves. Recalculate the
    // body so 256px bomb-zombie frames never inherit normal-zombie offsets.
    const spriteScale = this.def.spriteScale ?? 1
    const bodyWidth = 36 / spriteScale
    const bodyHeight = 52 / spriteScale
    this.body.setSize(bodyWidth, bodyHeight)
    this.body.setOffset(
      (this.width - bodyWidth) / 2,
      this.def.spriteScale ? this.height - bodyHeight - 16 : 12,
    )
    this.currentAnimKey = null
    this.currentAttackKey = null
    this.attackSequence = 0
    this.nextChargeAt = 0
    this.stopDashEffect()
    this.shamblePauseUntil = 0
    this.scheduleNextShamble(this.scene.time.now)
    this.setPosition(x, groundY - 26)
    if (this.def.fallingTextureKey && this.scene.textures.exists(this.def.fallingTextureKey)) {
      const fallingScale = this.def.fallingSpriteScale ?? spriteScale
      this.setTexture(this.def.fallingTextureKey)
      this.setOrigin(0.5, 1).setScale(fallingScale).setAlpha(1).clearTint()
      this.setPosition(x, groundY - 430)
      this.body.enable = false
      this.state_ = 'spawning'
      this.scene.tweens.add({
        targets: this,
        y: groundY,
        duration: 850,
        ease: 'Quad.easeIn',
        onComplete: () => {
          this.playDropEffect(x, groundY)
          this.finishSpawn(groundY)
        },
      })
      return
    }
    this.setAlpha(0).setScale(spriteScale, spriteScale * 0.2).setOrigin(0.5, 1)
    this.y = groundY
    this.body.enable = false
    this.state_ = 'spawning'
    this.setTint(0x9e9e9e)

    this.scene.tweens.add({
      targets: this, alpha: 1, scaleY: spriteScale, duration: riseMs, ease: 'Back.easeOut',
      onComplete: () => {
        this.finishSpawn(groundY)
      },
    })
  }

  private finishSpawn(groundY: number) {
    const spriteScale = this.def.spriteScale ?? 1
    this.anims.stop()
    this.setTexture(this.def.textureKey).setScale(spriteScale).setAlpha(1)
    const originY = this.def.spriteOriginY ?? 0.5
    this.setOrigin(0.5, originY)
    const footY = this.def.spriteFootYRatio ?? 1
    this.y = groundY - this.height * (footY - originY) * spriteScale
    this.clearTint()
    this.body.enable = true
    this.state_ = 'wander'
    this.wanderDir = Math.random() < 0.5 ? -1 : 1
    this.currentAnimKey = null
  }

  private playDropEffect(x: number, groundY: number) {
    const key = this.def.dropEffectTextureKey
    if (!key || !this.scene.textures.exists(key)) return
    // 원본 프레임의 실제 바닥선은 y≈528/627이다. 이 지점을 groundY에 고정해
    // 투명 캔버스 하단 여백 때문에 폭발이 공중에 뜨거나 땅속으로 묻히지 않게 한다.
    const effect = this.scene.add.sprite(x, groundY, key, 0)
      .setOrigin(0.5, 528 / 627)
      .setScale(this.def.dropEffectScale ?? 0.55)
      .setDepth(this.depth + 1)
    const animKey = `${key}_anim`
    if (!this.scene.anims.exists(animKey)) {
      effect.destroy()
      return
    }
    effect.play(animKey)
    effect.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => effect.destroy())
    // 폭발이 충분히 펼쳐지는 세 번째 프레임 무렵에 주변 피해를 한 번만 적용한다.
    const radius = this.def.dropDamageRadius ?? 0
    const damage = this.def.dropDamage ?? 0
    if (radius > 0 && damage > 0) {
      this.scene.time.delayedCall(140, () => {
        if (this.state_ === 'inactive' || this.state_ === 'dead') return
        this.onDropImpact?.(this, radius, damage)
      })
    }
  }

  update(target: MonsterTarget, now: number) {
    this.updateBehaviour(target, now)
    this.updateAnimation()
    this.updateDashEffect()
    this.updateHpBar()
  }

  private updateHpBar() {
    const bar = this.hpBar
    if (!this.active || !this.visible || this.state_ === 'dead' || this.state_ === 'inactive') {
      bar.clear()
      return
    }
    const isBoss = this.monsterCode === 'zombie_boss'
    const width = isBoss ? 46 : 26
    const height = isBoss ? 5 : 3
    const totalLayers = Math.max(1, Math.ceil(this.maxHp / HP_BAR_LAYER_SIZE))
    const layerSize = Math.ceil(this.maxHp / totalLayers)
    const currentLayer = Math.max(1, Math.ceil(this.hp / layerSize))
    const hpInLayer = this.hp <= 0 ? 0 : ((this.hp - 1) % layerSize) + 1
    const layerCapacity = currentLayer === totalLayers
      ? ((this.maxHp - 1) % layerSize) + 1
      : layerSize
    const ratio = Phaser.Math.Clamp(hpInLayer / layerCapacity, 0, 1)
    const x = this.x - width / 2
    const y = this.getBounds().top - 5
    bar.clear()
    bar.fillStyle(0x111318, 0.82).fillRect(x - 1, y - 1, width + 2, height + 2)
    // 화면에는 체력바를 하나만 표시한다. 최상층은 빨강이며 한 층이 완전히 소진될 때
    // 노랑 → 보라 → 파랑 순으로 다음 색상의 가득 찬 바가 나타난다.
    const depletedLayers = totalLayers - currentLayer
    const color = HP_BAR_LAYER_COLORS[depletedLayers % HP_BAR_LAYER_COLORS.length]
    bar.fillStyle(color, 1)
    bar.fillRect(x, y, width * ratio, height)
    bar.setAlpha(this.alpha)
  }

  /** 이동 중이면 달리기, 멈춰 있으면 대기 (GAME_DESIGN 6.2의 배회/추적/공격 상태를 속도로 읽는다) */
  private updateAnimation() {
    if (!this.alive) return
    const speed = Math.abs(this.body.velocity.x)
    const runKey = this.def.runTextureKey
    const moving = speed > 1 && !!runKey && this.scene.anims.exists(runKey)

    const attacking = (this.state_ === 'windup' || this.state_ === 'charge') && !!this.currentAttackKey
    const reacting = this.state_ === 'hit' && !!this.def.hitTextureKey && this.scene.anims.exists(this.def.hitTextureKey)
    const key = reacting ? this.def.hitTextureKey! : (attacking ? this.currentAttackKey! : (moving ? runKey! : this.def.textureKey))
    if (key !== this.currentAnimKey) {
      this.currentAnimKey = key
      // 단일 프레임 아트는 애니메이션이 없다 — 텍스처만 바꿔 끼운다
      if (this.scene.anims.exists(key)) this.play(key, true)
      else { this.anims.stop(); this.setTexture(key) }
    }
    // 배회는 추적의 절반 속도라 같은 재생속도로 돌리면 발이 미끄러진다 — 속도에 비례시킨다
    this.anims.timeScale = this.state_ === 'charge'
      ? 2.5
      : moving && !attacking && !reacting ? Math.min(1, speed / this.def.moveSpeed) : 1
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
    const attackRange = this.def.rangedAttack
      ? (target.rangedAttackRange ?? this.def.attackRange)
      : this.def.attackRange
    // 세로 거리 판정: 발판 위 등 높이가 다르면 감지/공격 대상이 아니다
    const dy = Math.abs(target.y - this.y)

    if (this.state_ === 'charge') {
      const dir: -1 | 1 = dx >= 0 ? 1 : -1
      this.faceDirection(dir)
      if (!target.alive || dy > DETECT_VERTICAL_RANGE) {
        this.stopDashEffect()
        this.state_ = 'chase'
        return
      }
      if (dist <= attackRange) {
        this.setVelocityX(0)
        this.state_ = 'windup'
        this.windupUntil = now + this.def.attackWindupMs
        this.windupAimX = target.x
        return
      }
      this.setVelocityX((this.def.chargeSpeed ?? this.def.moveSpeed) * dir)
      return
    }

    if (this.state_ === 'windup') {
      // 원거리 공격은 준비를 시작한 순간의 위치와 방향을 끝까지 유지한다.
      const attackDx = this.def.rangedAttack ? this.windupAimX - this.x : dx
      if (Math.abs(attackDx) > 1) this.faceDirection(attackDx < 0 ? -1 : 1)
      const lungeSpeed = this.def.attackLungeSpeed ?? 0
      const remaining = this.windupUntil - now
      this.setVelocityX(lungeSpeed > 0 && remaining <= 180 ? (attackDx >= 0 ? lungeSpeed : -lungeSpeed) : 0)
      if (now >= this.windupUntil) {
        this.setVelocityX(0)
        this.clearTint()
        // 공격 판정: 윈드업 종료 시점에 사거리 안 + 몸통 높이가 겹칠 때만 적중 (GAME_DESIGN 6.2)
        if (this.def.rangedAttack) {
          // 대상이 준비 중 이동하거나 사망해도 이미 시작한 투척은 고정 좌표로 완료한다.
          this.onRangedAttack?.(this, this.windupAimX)
        } else if (target.alive && dist <= attackRange + 12 && dy <= ATTACK_VERTICAL_RANGE) {
          target.receiveHit(this.def.attack, this.x)
          if (this.currentAttackKey === this.def.specialAttackTextureKey && this.def.attackCameraShake) {
            this.scene.cameras.main.shake(140, this.def.attackCameraShake)
          }
        }
        this.nextAttackAt = now + this.def.attackCooldownMs
        this.nextChargeAt = now + (this.def.chargeCooldownMs ?? 0)
        this.stopDashEffect()
        this.state_ = 'chase'
      }
      return
    }

    if (target.alive && dist <= this.def.detectRange && dy <= DETECT_VERTICAL_RANGE) {
      // Face the detected target before an attack or shamble pause can return.
      const dir: -1 | 1 = dx >= 0 ? 1 : -1
      this.faceDirection(dir)
      if (this.def.chargeSpeed && dist <= (this.def.chargeTriggerRange ?? 0) && dist > attackRange && now >= this.nextChargeAt) {
        this.state_ = 'charge'
        this.currentAttackKey = this.def.runTextureKey ?? this.def.textureKey
        this.startDashEffect()
        this.setVelocityX(this.def.chargeSpeed * dir)
        return
      }
      // 추적 (느릿하게, GAME_DESIGN 6.2)
      if (dist <= attackRange && dy <= ATTACK_VERTICAL_RANGE) {
        this.setVelocityX(0)
        if (now >= this.nextAttackAt) {
          this.state_ = 'windup'
          this.windupUntil = now + this.def.attackWindupMs
          this.windupAimX = target.x
          this.attackSequence += 1
          this.currentAttackKey = this.attackSequence % (this.def.specialAttackEvery ?? 3) === 0
            ? (this.def.specialAttackTextureKey ?? this.def.attackTextureKey ?? null)
            : (this.def.attackTextureKey ?? null)
          this.setTint(0xffcc80) // 공격 전조
        }
      } else {
        this.state_ = 'chase'
        if (this.updateShamble(now)) {
          this.setVelocityX(0)
          return
        }
        this.setVelocityX(this.def.moveSpeed * dir)
      }
    } else {
      // 배회: 스폰 지역 좌우 왕복
      this.state_ = 'wander'
      if (this.x <= this.homeXMin) this.wanderDir = 1
      if (this.x >= this.homeXMax) this.wanderDir = -1
      this.setVelocityX(this.def.moveSpeed * 0.5 * this.wanderDir)
      this.faceDirection(this.wanderDir)
    }
  }

  private scheduleNextShamble(now: number) {
    const min = this.def.shambleMoveMinMs
    const max = this.def.shambleMoveMaxMs
    this.nextShamblePauseAt = min === undefined || max === undefined
      ? Infinity
      : now + Phaser.Math.Between(min, max)
  }

  /** Returns true while this monster is hesitating between shambling bursts. */
  private updateShamble(now: number): boolean {
    if (now < this.shamblePauseUntil) return true
    if (now < this.nextShamblePauseAt) return false
    const min = this.def.shamblePauseMinMs
    const max = this.def.shamblePauseMaxMs
    if (min === undefined || max === undefined) return false
    this.shamblePauseUntil = now + Phaser.Math.Between(min, max)
    this.scheduleNextShamble(this.shamblePauseUntil)
    return true
  }

  /** 플레이어 공격 적중 (GameScene 전투 판정에서 호출) */
  /** @returns true면 이 공격으로 사망 (경험치 지급 트리거) */
  receiveHit(amount: number, crit: boolean, fromX: number, effects: EffectManager, now: number): boolean {
    if (this.state_ === 'inactive' || this.state_ === 'dead' || this.state_ === 'spawning') return false
    const wasAttacking = this.state_ === 'charge' || this.state_ === 'windup'
    // 다중 체력층은 한 번의 큰 피해로 여러 색을 건너뛰지 않는다. 실제 적용 피해 숫자도 이에 맞춘다.
    const totalLayers = Math.max(1, Math.ceil(this.maxHp / HP_BAR_LAYER_SIZE))
    const layerSize = Math.ceil(this.maxHp / totalLayers)
    const damageToLayerEdge = totalLayers > 1
      ? ((this.hp - 1) % layerSize) + 1
      : this.hp
    const appliedDamage = Math.min(amount, Math.max(1, damageToLayerEdge))
    this.hp -= appliedDamage
    effects.damageNumber(this.x, this.y - 40, appliedDamage, 'deal', crit, this) // 연타 스택 키 = 몬스터 자신
    effects.hitSpark(this.x, this.y - 10)

    if (this.hp <= 0) {
      this.die()
      return true
    }
    // 공격 중 피격도 피해는 받되 진행 중인 공격 모션은 유지한다.
    if (!wasAttacking) {
      this.state_ = 'hit'
      this.hitStunUntil = now + (this.def.hitStunMs ?? 200)
    }
    this.setTint(0xff8a80)
    if (!wasAttacking) this.setVelocityX(fromX < this.x ? 90 : -90) // 밀려남
    return false
  }

  private die() {
    this.stopDashEffect()
    this.state_ = 'dead'
    this.body.enable = false
    this.setVelocity(0, 0)
    this.anims.stop() // 쓰러지는 동안 달리기 사이클이 계속 돌지 않게
    const deathKey = this.def.deathTextureKey
    if (deathKey && this.scene.anims.exists(deathKey)) {
      const spriteScale = Math.abs(this.scaleY)
      const currentOriginY = this.originY
      const currentFootY = this.def.spriteFootYRatio ?? 1
      const groundY = this.y + this.height * (currentFootY - currentOriginY) * spriteScale
      const deathFrame = this.scene.textures.get(deathKey).get(0)
      const deathOriginY = 1
      const deathFootY = this.def.deathSpriteFootYRatio ?? 1
      this.clearTint()
      this.setOrigin(0.5, deathOriginY)
      this.y = groundY - deathFrame.height * (deathFootY - deathOriginY) * spriteScale
      this.currentAnimKey = deathKey
      this.play(deathKey)
      this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        this.deactivate()
        this.onDied?.(this)
      })
      return
    }
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
    this.stopDashEffect()
    this.state_ = 'inactive'
    this.setActive(false).setVisible(false)
    this.body.enable = false
    this.hpBar.clear()
    this.clearTint()
    this.setAlpha(1)
  }

  get alive() {
    return this.state_ !== 'inactive' && this.state_ !== 'dead' && this.state_ !== 'spawning'
  }

  private startDashEffect() {
    const key = this.def.dashEffectTextureKey
    if (!key || !this.scene.textures.exists(key) || this.dashEffect?.active) return
    this.dashEffect = this.scene.add.sprite(this.x, this.y, key, 0)
      // 컷마다 원본 크기가 다르므로 고정 폭/높이로 찌그러뜨리지 않고 동일 배율을 적용한다.
      .setScale(0.24)
      .setOrigin(0.5, 390 / 470)
      .setAlpha(0.9)
      // 먼지가 방패와 몸에 가려지지 않도록 방패 좀비보다 한 단계 앞에 표시한다.
      .setDepth(this.depth + 1)
    const animKey = `${key}_anim`
    if (this.scene.anims.exists(animKey)) {
      const groundLines = [390, 396, 396, 234, 234, 232]
      this.dashEffect.on(Phaser.Animations.Events.ANIMATION_UPDATE, (
        _animation: Phaser.Animations.Animation,
        frame: Phaser.Animations.AnimationFrame,
      ) => {
        // 재배열된 애니메이션 프레임의 원본 인덱스로 실제 지면선을 선택한다.
        const sourceIndex = frame.textureFrame as number
        const frameHeight = this.dashEffect?.frame.height ?? 470
        this.dashEffect?.setOrigin(0.5, (groundLines[sourceIndex] ?? 396) / frameHeight)
      })
      this.dashEffect.play(animKey)
    }
  }

  private updateDashEffect() {
    if (!this.dashEffect?.active) return
    if (this.state_ !== 'charge' && this.state_ !== 'windup') {
      this.stopDashEffect()
      return
    }
    const dir = this.facingDir
    const groundY = this.y + this.height * ((this.def.spriteFootYRatio ?? 1) - this.originY) * this.scaleY
    this.dashEffect
      .setPosition(this.x - dir * 48, groundY)
      .setFlipX(dir > 0)
  }

  private stopDashEffect() {
    this.dashEffect?.destroy()
    this.dashEffect = undefined
  }

  private faceDirection(dir: -1 | 1) {
    this.facingDir = dir
    // 기본 왼쪽 원본은 오른쪽 이동 때 반전하고, 기존 오른쪽 원본은 왼쪽 이동 때 반전한다.
    this.setFlipX(this.def.facesLeftByDefault ? dir === 1 : dir === -1)
  }
}
