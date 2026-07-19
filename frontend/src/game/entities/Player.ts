import Phaser from 'phaser'
import { COMBAT, PLAYER } from '../config'
import { EventBus, GameEvents } from '../EventBus'
import { useGameStore } from '../../stores/gameStore'
import { InputManager } from '../systems/InputManager'
import {
  createPlayerAnims, tierForLevel, textureKey, PLAYER_FALLBACK_TEX,
  type AnimAction,
} from '../systems/playerAnimations'

/** 캐릭터 상태 머신 (sidescroller-game-dev 컨벤션). attack/skill/hit/dead는 Phase 2에서 추가 */
export type PlayerState =
  | 'idle' | 'walk' | 'jump' | 'jumpdash' | 'climb' | 'sit'
  | 'attack' | 'skill' | 'hit' | 'dead'

/** 앉기(휴식) 기능 — 2026-07-12 기획에서 제거. 코드 보존용 플래그 (차후 부활 시 true) */
const SIT_ENABLED = false

/**
 * ↓로 사다리를 잡을 때 발바닥을 발판 표면보다 이만큼 아래로 내린다(px).
 * 꼭대기 이탈 판정(body.bottom <= yTop + 2)보다 커야 잡자마자 튕겨 나오지 않는다.
 */
const LADDER_ENTER_DROP = 10

/** 스프라이트 프레임 크기 — 아트 규격(CHARACTER_ART_SPEC 3장). 바디 오프셋 계산의 기준. */
const FRAME = 128

/**
 * 스프라이트 y(=프레임 중심)에서 발바닥(body.bottom)까지의 거리(px, 월드).
 * 생성자의 body.setOffset 규약과 한 쌍이다 — 바디는 프레임 하단에 정렬되고 발끝은
 * 바디 하단보다 FOOT_SINK만큼 아래다. **BODY_HEIGHT/2가 아니다**(그렇게 계산하면
 * 캐릭터가 발판 아래로 박힌다).
 */
const FEET_FROM_Y = (FRAME * PLAYER.VISUAL_SCALE) / 2 - PLAYER.FOOT_SINK

interface Ladder {
  zone: Phaser.GameObjects.Zone
  x: number
  yTop: number
  yBottom: number
}

/**
 * 관우 (placeholder 텍스처 'guanwu_idle').
 * 이동/점프/대쉬/점프대쉬/사다리 — GAME_DESIGN 3장.
 * 모든 시간 판정은 scene.time.now 기반(델타타임 규칙과 함께 프레임 의존 금지).
 */
export class Player extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body

  state_: PlayerState = 'idle'
  facing: -1 | 1 = 1

  private dashUntil = 0
  /** 이단 점프는 착지 전 1회 */
  private airJumpUsed = false
  /** 점프 대쉬는 공중당 1회 — 좌/우 방향키를 누른 채 공중 점프 재입력 시에만 (③④) */
  private airDashUsed = false
  /** 퀵슬롯(숫자키) 스킬 발동 요청 — 다음 프레임 updateNormal에서 소비 */
  private skillQueued = false
  /** 대쉬 무적 (GAME_DESIGN 3.2 — Phase 2 전투에서 피격 판정에 사용) */
  invincible = false
  /** 원웨이 발판 통과 중이면 true (GameScene의 collider process에서 참조) */
  droppingUntil = 0
  /** GameScene 주입: 계단 스텝업 가능 여부(해당 rect에 지형 없음) — GAME_DESIGN 10.2 계단형 이동 */
  canStepUp?: (x: number, y: number, w: number, h: number) => boolean

  private ladders: Ladder[] = []
  private currentLadder: Ladder | null = null

  // ---- 애니메이션 (레벨 티어별 스프라이트시트, playerAnimations) ----
  /** 현재 외형 티어 — 레벨업 시 refreshTier로 갱신 */
  private tier = 1
  /** 이 티어에서 실제 아트가 로드돼 재생 가능한 animId("walk_r" 등) 집합 (없으면 idle→placeholder 폴백) */
  private availableAnims: Set<string> = new Set()
  private currentAnimKey: string | null = null

  // ---- 전투 (Phase 2) ----
  /** GameScene이 주입: 히트박스 안 몬스터 판정. comboStep(0:찌르기/1:휘두르기/2:대쉬찌르기)로
   *  단계별 이펙트를 고른다 */
  onBasicAttack?: (hitbox: Phaser.Geom.Rectangle, facing: -1 | 1, comboStep: number) => void
  onSkill?: (hitbox: Phaser.Geom.Rectangle, facing: -1 | 1) => void
  /** GameScene이 주입: 공중 액션 이펙트 훅 */
  onAirDash?: (x: number, y: number, facing: -1 | 1) => void
  onDoubleJump?: (x: number, y: number) => void
  private actionUntil = 0
  private actionHitAt = 0
  private actionHitDone = false
  /** 콤보: 지금 재생 중인 단계(0~2). 예약 없이 모션이 끝나면 0으로 리셋 */
  private comboStep = 0
  /** 콤보: 현재 모션 중 공격키가 눌려 다음 단계가 예약됨 (선입력 버퍼) */
  private comboQueued = false
  /** 대쉬찌르기(2단계) 전진을 이 시각까지 유지 — 이후 정지 */
  private dashLungeUntil = 0
  private skillReadyAt = 0
  private invincibleUntil = 0
  /** 자연 회복 판정용 — 마지막 전투 행동 시각 (GAME_DESIGN 5.2) */
  lastCombatAt = -Infinity

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'guanwu_idle')
    scene.add.existing(this)
    scene.physics.add.existing(this)
    // 128px T1 아트 기준 (2026-07-12): 캐릭터 실체는 프레임 하단 정렬 ~68px로 구워져 있다.
    // 시각은 VISUAL_SCALE로 줄이되(캐릭터가 너무 커 보임), 월드 충돌 바디는 배율과 무관하게
    // BODY_WIDTH×BODY_HEIGHT로 유지한다 — 소스 크기를 1/S로 역보정하면 updateBounds가 다시 S배로
    // 줄여 최종 월드 크기가 그대로다. 몬스터 64/타일 32와의 충돌 비율을 유지하기 위함.
    // offsetY는 발끝이 바디 하단보다 FOOT_SINK만큼 아래(잔디 안쪽)에 오도록 잡는다 — 그래야
    // 지면(잔디 경계)에 서 있어 보인다. 오프셋은 항상 128 프레임 기준 고정(placeholder 64px 방어).
    const S = PLAYER.VISUAL_SCALE
    this.setScale(S)
    this.body.setSize(PLAYER.BODY_WIDTH / S, PLAYER.BODY_HEIGHT / S)
    this.body.setOffset(
      FRAME / 2 - (PLAYER.BODY_WIDTH / 2) / S,
      FRAME - (PLAYER.BODY_HEIGHT + PLAYER.FOOT_SINK) / S,
    )
    this.setCollideWorldBounds(true)
    this.refreshTier()
  }

  /** 현재 레벨에 맞는 외형 티어로 애니메이션을 재구성 (생성 시 + 레벨업 시 호출) */
  refreshTier() {
    this.tier = tierForLevel(useGameStore.getState().level)
    this.availableAnims = createPlayerAnims(this.scene, this.tier)
    this.currentAnimKey = null // 다음 updateAnimation에서 새 티어 텍스처로 강제 갱신
  }

  setLadders(ladders: Ladder[]) {
    this.ladders = ladders
  }

  /**
   * 발바닥(body.bottom)이 월드 worldY에 오도록 순간이동시킨다 (속도도 0으로).
   *
   * setY()를 쓰면 안 된다 — 씬 update 중에 스프라이트만 옮겨도 Arcade의 postUpdate가
   * 바디 이동분을 다시 더해버려 최종 위치가 어긋난다(사다리 꼭대기 무한루프의 원인).
   * 바디까지 한 번에 맞추는 body.reset()이 정석이다.
   */
  private setFeetY(worldY: number) {
    this.body.reset(this.x, worldY - FEET_FROM_Y)
  }

  update(input: InputManager, now: number) {
    switch (this.state_) {
      case 'climb':
        this.updateClimb(input)
        break
      case 'jumpdash':
        this.updateDash(now)
        break
      case 'attack':
      case 'skill':
        this.updateAction(input, now)
        break
      case 'sit':
        this.updateSit(input, now)
        break
      case 'dead':
        this.setVelocityX(0)
        break
      default:
        this.updateNormal(input, now)
    }
    // 좌우 반전(setFlipX) 금지 — 방향별 스프라이트(_r/_l)를 그대로 사용 (2026-07-12 확정:
    // 반전하면 무기 잡는 손이 바뀌어 어색함. 좌/우 아트가 별도로 존재함)
    this.updateAnimation()
  }

  // ---------- 애니메이션 재생 ----------
  /** 이 티어에 해당 액션의 **현재 방향** 아트가 실제로 로드돼 있는지 */
  private hasAnim(action: AnimAction): boolean {
    return this.availableAnims.has(`${action}_${this.facing === 1 ? 'r' : 'l'}`)
  }

  /**
   * 현재 상태 머신 상태 → 스프라이트시트 액션 이름 (sit은 기능 제거 — idle 폴백).
   * 대쉬(jumpdash)는 별도 아트 없이 **점프와 같은 모션**을 쓴다 (2026-07-12 확정:
   * 대쉬는 점프 자세 + 뒤 잔상 이펙트(onAirDash)로 표현). → 'jump' 반환.
   * 스킬도 같은 방식으로 **기본 공격 모션을 빌려 쓴다** — 스킬 전용 아트가 아직 없는데,
   * 그냥 두면 폴백 체인이 idle로 떨어져 시전 중 가만히 서 있게 된다(2026-07-16).
   * skill 아트가 들어오면 자동으로 그쪽을 쓴다 — 이 코드는 손댈 필요 없다.
   */
  private resolveAction(): AnimAction {
    switch (this.state_) {
      case 'walk': return 'walk'
      case 'jump': return 'jump'
      case 'jumpdash': return 'jump'
      case 'climb': return 'climb'
      case 'attack': return 'attack'
      case 'skill': return this.hasAnim('skill') ? 'skill' : 'attack'
      case 'hit': return 'hit'
      case 'dead': return 'dead'
      default: return 'idle'
    }
  }

  /**
   * 상태+방향에 맞는 애니메이션을 재생한다 (animId = "walk_r" 등, climb만 방향 없음).
   * 해당 동작 아트가 없으면 같은 방향 idle로 폴백 — placeholder와 128px 아트가 교대로
   * 나타나며 깜빡이던 버그 방지. 방향 idle조차 없으면 최후에 placeholder.
   * play(key, true)로 이미 재생 중인 동일 액션은 재시작하지 않는다(1회성 공격/스킬 보호).
   */
  private updateAnimation() {
    const dir = this.facing === 1 ? 'r' : 'l'
    let action = this.resolveAction()
    let animId = action === 'climb' ? 'climb' : `${action}_${dir}`

    if (!this.availableAnims.has(animId)) {
      action = 'idle'
      animId = `idle_${dir}`
    }
    if (!this.availableAnims.has(animId)) {
      if (this.currentAnimKey !== null) {
        this.anims.stop()
        this.currentAnimKey = null
      }
      if (this.texture.key !== PLAYER_FALLBACK_TEX) this.setTexture(PLAYER_FALLBACK_TEX)
      return
    }

    const key = textureKey(this.tier, animId)

    // 점프: 2프레임을 속도로 선택 (상승=0 / 하강=1) — 반복 재생보다 반응성이 좋다
    if (action === 'jump') {
      if (this.texture.key !== key) this.setTexture(key)
      this.anims.stop()
      this.setFrame(this.body.velocity.y < 0 ? 0 : 1)
      this.currentAnimKey = key
      return
    }

    this.play(key, true)

    // 스킬이 기본 공격 모션을 빌려 쓰는 동안은 재생 속도를 스킬 지속시간에 맞춘다 —
    // attack 시트는 550ms(ATTACK_DURATION_MS)인데 스킬은 450ms라 그냥 두면 회수 동작이 잘린다.
    // 스킬 전용 아트가 들어오면 action이 'skill'이 되어 자동으로 등배속으로 돌아온다.
    this.anims.timeScale =
      this.state_ === 'skill' && action === 'attack'
        ? COMBAT.ATTACK_DURATION_MS / COMBAT.SKILL_DURATION_MS
        : 1

    // 사다리: 오르내리는 중에만 프레임 진행, 멈추면 정지
    if (action === 'climb') {
      if (this.body.velocity.y === 0) this.anims.pause()
      else this.anims.resume()
    }

    this.currentAnimKey = key
  }

  // ---------- 일반 상태 (idle / walk / jump) ----------
  private updateNormal(input: InputManager, now: number) {
    const onGround = this.body.blocked.down
    if (onGround) {
      this.airJumpUsed = false
      this.airDashUsed = false
    }

    // 사다리 진입 (GAME_DESIGN 3.3)
    if ((input.up || input.down) && this.tryEnterLadder(input.down)) return

    // 하강 점프: ↓+점프로 원웨이 발판 통과 (GAME_DESIGN 3장 표)
    if (onGround && input.down && input.jumpJustDown) {
      this.droppingUntil = now + PLAYER.DROP_THROUGH_MS
      this.setVelocityY(80)
      this.state_ = 'jump'
      return
    }

    // 점프 (GAME_DESIGN 3.1)
    if (onGround && input.jumpJustDown) {
      this.setVelocityY(PLAYER.JUMP_VELOCITY)
    }

    // 공중에서 점프키 재입력 (GAME_DESIGN 3.2 개정):
    // - 좌/우 방향키 유지: 그 방향으로 점프 대쉬 (공중당 1회, ④ 중복 방지)
    // - 방향키 없음(=위 입력): 이단 점프 (아래로 바람 이펙트). 대쉬는 발동하지 않음 (③)
    if (!onGround && input.jumpJustDown) {
      const dirHeld: -1 | 0 | 1 = input.left ? -1 : input.right ? 1 : 0
      if (dirHeld !== 0 && !this.airDashUsed) {
        this.airDashUsed = true
        this.startAirDash(dirHeld, now)
        return
      }
      if (dirHeld === 0 && !this.airJumpUsed) {
        this.airJumpUsed = true
        this.setVelocityY(PLAYER.DOUBLE_JUMP_VELOCITY)
        this.onDoubleJump?.(this.x, this.y)
        return
      }
      // 남은 공중 액션 없음(대쉬/이단점프 소진) → 무시하고 통상 공중 이동 유지
    }

    // 앉기 기능 제거(2026-07-12): 이동은 달리기/대쉬/점프로만 구성. 코드는 보존, 진입만 차단.
    if (SIT_ENABLED && onGround && input.sitJustDown) {
      this.enterSit()
      return
    }

    // 기본 공격 (GAME_DESIGN 4.1) — 지상은 정지, 공중은 관성 유지. 콤보 0단계부터 시작.
    if (input.attackJustDown) {
      this.comboStep = 0
      this.startAction('attack', now)
      return
    }
    // 스킬 (GAME_DESIGN 4.2) — MP 체크. 퀵슬롯(숫자키 1~7) 요청만 여기서 소비 (전용 스킬 키 없음)
    const wantSkill = this.skillQueued
    this.skillQueued = false
    if (wantSkill && now >= this.skillReadyAt) {
      const s = useGameStore.getState()
      if (s.mp >= COMBAT.SKILL_MP_COST) {
        s.setStats({ mp: s.mp - COMBAT.SKILL_MP_COST })
        this.skillReadyAt = now + COMBAT.SKILL_COOLDOWN_MS
        this.startAction('skill', now)
        return
      }
    }

    // 좌우 이동: 가속 없는 일정 속도 (아티팩트 이속 배율 반영, GAME_DESIGN 8.3)
    const speed = PLAYER.MOVE_SPEED * useGameStore.getState().moveSpeedMult
    if (input.left) {
      this.setVelocityX(-speed)
      this.facing = -1
    } else if (input.right) {
      this.setVelocityX(speed)
      this.facing = 1
    } else {
      this.setVelocityX(0)
    }

    // 계단 자동 스텝업: 옆이 막혔고 16px 위가 비어 있으면 걸어 오른다
    if (onGround && this.canStepUp) {
      const dir = input.left ? -1 : input.right ? 1 : 0
      const blocked = (dir === -1 && this.body.blocked.left) || (dir === 1 && this.body.blocked.right)
      if (dir !== 0 && blocked) {
        const STEP = 18
        const b = this.body
        if (this.canStepUp(b.x + dir * 6, b.y - STEP, b.width, b.height - 2)) {
          this.y -= STEP
          this.setVelocityX(PLAYER.MOVE_SPEED * useGameStore.getState().moveSpeedMult * dir)
        }
      }
    }

    this.state_ = onGround ? (this.body.velocity.x !== 0 ? 'walk' : 'idle') : 'jump'
  }

  // ---------- 점프 대쉬 (점프 → 공중에서 점프 재입력) ----------
  private startAirDash(dir: -1 | 1, now: number) {
    this.facing = dir
    this.state_ = 'jumpdash'
    this.invincible = true // GAME_DESIGN 3.2: 대쉬 중 무적
    this.dashUntil = now + PLAYER.AIR_DASH_DURATION_MS
    this.setVelocity(PLAYER.AIR_DASH_SPEED * dir, 0)
    this.body.setAllowGravity(false) // 수평 돌진 (메이플 감성)
    this.onAirDash?.(this.x, this.y, dir)
  }

  private updateDash(now: number) {
    if (now >= this.dashUntil) {
      this.body.setAllowGravity(true)
      this.invincible = false
      this.setVelocityX(0)
      this.state_ = this.body.blocked.down ? 'idle' : 'jump'
    }
  }

  // ---------- 앉기 ----------
  private enterSit() {
    this.state_ = 'sit'
    this.setVelocityX(0)
    // 앉기 전용 아트가 아직 없어 살짝 눌린 실루엣으로 표현 (Phase 7에서 sit 프레임 교체)
    this.setScale(1, 0.85)
  }

  private exitSit() {
    this.setScale(1, 1)
    this.state_ = 'idle'
  }

  private updateSit(input: InputManager, now: number) {
    this.setVelocityX(0)
    // 발판이 사라지는 등 공중에 뜨면 해제
    if (!this.body.blocked.down) {
      this.exitSit()
      this.state_ = 'jump'
      return
    }
    if (input.sitJustDown || input.left || input.right) {
      this.exitSit()
      return
    }
    if (input.jumpJustDown) {
      this.exitSit()
      this.setVelocityY(PLAYER.JUMP_VELOCITY)
      this.state_ = 'jump'
      return
    }
    if (input.attackJustDown) {
      this.exitSit()
      this.startAction('attack', now)
    }
  }

  // ---------- 줄/사다리 ----------
  private tryEnterLadder(goingDown: boolean): boolean {
    for (const ladder of this.ladders) {
      const withinX = Math.abs(this.x - ladder.x) < 20
      const top = ladder.yTop
      const bottom = ladder.yBottom
      // 아래로 진입: 발판 위에서 사다리 꼭대기 근처일 때
      const canEnterDown = goingDown && Math.abs(this.body.bottom - top) < 8 && withinX
      // 위로 진입: 사다리 구간과 몸이 겹칠 때
      const overlapY = this.body.bottom > top + 4 && this.y < bottom
      const canEnterUp = !goingDown && withinX && overlapY
      if (canEnterDown || canEnterUp) {
        this.currentLadder = ladder
        this.state_ = 'climb'
        this.body.setAllowGravity(false)
        if (canEnterDown) {
          // 발바닥을 발판 표면보다 조금 내려 꼭대기 이탈 판정(yTop+2)을 벗어나게 한다 —
          // 안 그러면 잡자마자 그 자리에서 다시 튕겨 나온다.
          this.setFeetY(top + LADDER_ENTER_DROP)
        } else {
          // 위로 진입은 위치를 유지한 채 사다리 중앙으로만 스냅한다. 여기서 body.reset을 쓰면
          // 안 된다 — 진입 직전 프레임의 상승 속도까지 지워져 사다리 맨 아래에서 영영 못 오른다.
          this.setVelocity(0, 0)
          this.setX(ladder.x)
        }
        return true
      }
    }
    return false
  }

  private updateClimb(input: InputManager) {
    const ladder = this.currentLadder!
    if (input.up) this.setVelocityY(-PLAYER.CLIMB_SPEED)
    else if (input.down) this.setVelocityY(PLAYER.CLIMB_SPEED)
    else this.setVelocityY(0)

    // 점프로 이탈 (GAME_DESIGN 3.3) — 좌/우 방향키를 누르면 그 방향으로 뛰어내림 (⑧)
    if (input.jumpJustDown) {
      this.exitLadder()
      const dir = input.left ? -1 : input.right ? 1 : 0
      this.setVelocityY(PLAYER.JUMP_VELOCITY * (dir !== 0 ? 0.6 : 0.7))
      if (dir !== 0) {
        this.setVelocityX(PLAYER.MOVE_SPEED * dir)
        this.facing = dir
      }
      return
    }
    // 꼭대기 도달 → 발판 위로. 발바닥을 발판 표면(=yTop)에 정확히 올려야 한다.
    // 조금이라도 아래에 놓으면 중력으로 떨어지는 동안 ↑ 유지 입력이 tryEnterLadder의
    // 재진입 조건(overlapY)에 걸려 climb으로 되돌아가고, 그 상태가 매 프레임 반복되며
    // 꼭대기에 갇힌다(좌우 입력은 climb에서 무시되므로 빠져나올 수도 없음).
    if (this.body.bottom <= ladder.yTop + 2) {
      this.exitLadder()
      this.setFeetY(ladder.yTop)
      return
    }
    // 바닥 도달
    if (this.body.bottom >= ladder.yBottom - 2) {
      this.exitLadder()
    }
  }

  private exitLadder() {
    this.currentLadder = null
    this.body.setAllowGravity(true)
    this.state_ = 'jump'
  }

  /** 사다리 오르는 중인지 (GameScene 충돌 판정에서 사용) */
  get climbing() {
    return this.state_ === 'climb'
  }

  // ---------- 공격/스킬 ----------
  private startAction(kind: 'attack' | 'skill', now: number) {
    this.state_ = kind
    this.lastCombatAt = now
    this.comboQueued = false // 새 모션 시작 — 이전 예약은 소비됐거나 무효
    const duration = kind === 'attack' ? COMBAT.ATTACK_DURATION_MS : COMBAT.SKILL_DURATION_MS
    const hitAt = kind === 'attack' ? COMBAT.ATTACK_HIT_AT_MS : COMBAT.SKILL_HIT_AT_MS
    this.actionUntil = now + duration
    this.actionHitAt = now + hitAt
    this.actionHitDone = false
    // 대쉬찌르기(콤보 2단계)는 지상에서 앞으로 짧게 돌진한다. 그 외 지상 공격은 제자리 정지.
    const isDashLunge = kind === 'attack' && this.comboStep === 2
    if (this.body.blocked.down) {
      if (isDashLunge) {
        this.dashLungeUntil = now + COMBAT.COMBO_DASH_MS
        this.setVelocityX(this.facing * COMBAT.COMBO_DASH_VX)
      } else {
        this.dashLungeUntil = 0
        this.setVelocityX(0) // 공격 중 이동 불가 (지상)
      }
    }
  }

  private updateAction(input: InputManager, now: number) {
    // 대쉬찌르기 돌진 구간에는 전진 속도를 유지, 그 외에는 지상에서 정지
    if (this.body.blocked.down && now >= this.dashLungeUntil) this.setVelocityX(0)

    // 선입력 버퍼: 기본 공격 모션 중 공격키를 누르면 다음 콤보 단계를 예약한다(마지막 단계 제외).
    if (this.state_ === 'attack' && input.attackJustDown && this.comboStep < COMBAT.COMBO_MAX - 1) {
      this.comboQueued = true
    }

    if (!this.actionHitDone && now >= this.actionHitAt) {
      this.actionHitDone = true
      const hitbox = this.buildHitbox(this.state_ === 'skill')
      if (this.state_ === 'skill') this.onSkill?.(hitbox, this.facing)
      else this.onBasicAttack?.(hitbox, this.facing, this.comboStep)
    }
    if (now >= this.actionUntil) {
      // 예약된 다음 콤보 단계가 있으면 이어서 재생, 없으면 콤보 종료(0단계로 리셋)
      if (this.state_ === 'attack' && this.comboQueued && this.comboStep < COMBAT.COMBO_MAX - 1) {
        this.comboStep += 1
        this.startAction('attack', now)
        return
      }
      this.comboStep = 0
      this.state_ = this.body.blocked.down ? 'idle' : 'jump'
    }
  }

  private buildHitbox(isSkill: boolean): Phaser.Geom.Rectangle {
    // 대쉬찌르기(2단계)는 돌진하며 찔러 리치가 더 길다
    const reach = isSkill
      ? COMBAT.SKILL_REACH
      : this.comboStep === 2 ? COMBAT.COMBO_DASH_REACH : COMBAT.ATTACK_REACH
    const h = isSkill ? COMBAT.SKILL_HEIGHT : COMBAT.ATTACK_HEIGHT
    const x = this.facing === 1 ? this.x : this.x - reach
    return new Phaser.Geom.Rectangle(x, this.y - h / 2, reach, h)
  }

  /** 스킬 쿨타임 잔여 (HUD 표시용, Phase 3+) */
  skillCooldownLeft(now: number) {
    return Math.max(0, this.skillReadyAt - now)
  }

  /** 퀵슬롯(숫자키) 스킬 발동 요청 — 다음 updateNormal에서 키 입력과 동일하게 처리 */
  queueSkill() {
    this.skillQueued = true
  }

  // ---------- 피격/사망 (GAME_DESIGN 4.3, 5.2) ----------
  receiveHit(attack: number, fromX: number) {
    const now = this.scene.time.now
    if (this.state_ === 'dead' || this.invincible || now < this.invincibleUntil) return
    if (this.state_ === 'sit') this.exitSit() // 앉은 채 피격 → 자세 복구
    const store = useGameStore.getState()
    const amount = Math.max(1, Math.round(attack))
    const hp = Math.max(0, store.hp - amount)
    store.setStats({ hp })
    this.lastCombatAt = now

    // 사다리를 타던 중이면 떨어뜨린다 (중력 복원)
    this.currentLadder = null
    this.body.setAllowGravity(true)

    // 뒤로 밀림 + 붉은 점멸 + 1초 무적
    this.invincibleUntil = now + COMBAT.HIT_INVINCIBLE_MS
    this.setVelocity(fromX < this.x ? COMBAT.HIT_KNOCKBACK_X : -COMBAT.HIT_KNOCKBACK_X, COMBAT.HIT_KNOCKBACK_Y)
    this.setTintFill(0xff5252)
    this.scene.time.delayedCall(120, () => this.clearTint())
    this.scene.tweens.add({ targets: this, alpha: 0.4, yoyo: true, repeat: 4, duration: 100,
      onComplete: () => this.setAlpha(1) })

    if (hp <= 0) {
      this.state_ = 'dead'
      this.setVelocityX(0)
      EventBus.emit(GameEvents.PLAYER_DIED)
    } else {
      this.state_ = this.body.blocked.down ? 'idle' : 'jump'
    }
  }

  /** 부활: 시작 지점, HP/MP 전량 (GAME_DESIGN 5.2 — 초기 페널티 없음) */
  revive(x: number, y: number) {
    const store = useGameStore.getState()
    store.setStats({ hp: store.maxHp, mp: store.maxMp })
    this.setPosition(x, y)
    this.setVelocity(0, 0)
    this.setAlpha(1)
    this.state_ = 'idle'
  }

  get isHittable() {
    return this.state_ !== 'dead' && !this.invincible && this.scene.time.now >= this.invincibleUntil
  }
}
