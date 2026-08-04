import { COMBAT } from '../config'
import type { Monster } from '../entities/Monster'
import type { Player, PlayerControl } from '../entities/Player'
import type { GuanYuCommand } from './commands'
import type { CombatPolicy } from '../../stores/autoCombatStore'

export type GuanYuState =
  | 'STANDBY'
  | 'MOVING_TO_TARGET'
  | 'RUSHING'
  | 'RETURNING_TO_BASE'
  | 'GUARDING'
  | 'ADVANCING'
  | 'AUTO_COMBAT'
  | 'RETREATING'
  | 'HOLDING'
  | 'MOVING_TO_NPC'
  | 'HOLDING_COMBAT'
  | 'PURSUING_ENEMIES'
  | 'ELIMINATING_CASTLE_INFILTRATORS'
  | 'DEFENDING_CASTLE'
  | 'DEAD'

const ARRIVAL_DISTANCE = 18
const GUARD_RADIUS = 190
/** 수성 최우선 명령에서 성문을 기준으로 허용하는 최대 출전 거리. */
const CASTLE_PATROL_RADIUS = 520
/** “앞으로/뒤로 가” 한 번에 이동하는 기본 거리(px). */
const BASIC_MOVE_DISTANCE = 420

export class GuanYuController {
  state: GuanYuState = 'STANDBY'
  private targetX: number | null = null
  private guardX: number | null = null
  private stateAfterArrival: GuanYuState = 'HOLDING'
  private arrivalTargetId: string | null = null
  private arrivedTargetId: string | null = null
  private jumpQueued = false
  private rushJumpStarted = false
  private rushDashTriggered = false
  private counterTarget: Monster | null = null
  private counterUntil = 0
  private counterAttackQueued = false
  private combatTarget: Monster | null = null
  private combatTargetUntil = 0

  readonly control: PlayerControl = {
    left: false, right: false, up: false, down: false,
    jumpJustDown: false, attackJustDown: false, sitJustDown: false,
    preventCombo: false,
  }

  execute(command: GuanYuCommand, playerX: number, targets: Record<string, number>): boolean {
    this.resetControl()
    switch (command.action) {
      case 'CONTINUE_AUTO_COMBAT': this.state = 'AUTO_COMBAT'; return true
      case 'ADVANCE_AND_ATTACK': this.state = 'ADVANCING'; return true
      case 'MOVE_TO': {
        const x = command.targetId === 'forward'
          ? playerX + BASIC_MOVE_DISTANCE
          : command.targetId === 'backward'
            ? playerX - BASIC_MOVE_DISTANCE
            : targets[command.targetId ?? '']
        if (x === undefined) return false
        this.targetX = Math.max(targets.world_min ?? x, Math.min(targets.world_max ?? x, x))
        this.guardX = null
        this.arrivalTargetId = command.targetId ?? null
        this.stateAfterArrival = 'HOLDING'
        this.state = 'MOVING_TO_TARGET'
        return true
      }
      case 'RUSH_TO': {
        const x = command.targetId === 'forward'
          ? playerX + BASIC_MOVE_DISTANCE
          : command.targetId === 'backward'
            ? playerX - BASIC_MOVE_DISTANCE
            : targets[command.targetId ?? '']
        if (x === undefined) return false
        this.targetX = Math.max(targets.world_min ?? x, Math.min(targets.world_max ?? x, x))
        this.guardX = null
        this.arrivalTargetId = command.targetId ?? null
        this.stateAfterArrival = 'HOLDING'
        this.rushJumpStarted = false
        this.rushDashTriggered = false
        this.state = 'RUSHING'
        return true
      }
      case 'RETURN_TO_BASE':
        if (targets.main_castle === undefined) return false
        this.targetX = targets.main_castle
        this.guardX = null
        this.arrivalTargetId = 'main_castle'
        // 맵 전환 후 성문 앞에서 정지해야 하므로 내부 방어 지점으로 이어가지 않는다.
        this.stateAfterArrival = 'HOLDING'
        this.state = 'RETURNING_TO_BASE'
        return true
      case 'GUARD_POSITION': {
        const x = command.targetId === 'current_position' ? playerX : targets[command.targetId ?? '']
        if (x === undefined) return false
        this.targetX = x
        this.guardX = x
        this.stateAfterArrival = 'GUARDING'
        this.state = Math.abs(playerX - x) <= ARRIVAL_DISTANCE ? 'GUARDING' : 'MOVING_TO_TARGET'
        return true
      }
      case 'TALK_TO_NPC':
        if (!command.targetId || targets[command.targetId] === undefined) return false
        this.targetX = targets[command.targetId]
        this.state = 'MOVING_TO_NPC'
        return true
      case 'JUMP': this.jumpQueued = true; return true
      case 'HOLD_AND_ATTACK':
        this.guardX = playerX
        this.state = 'HOLDING_COMBAT'
        return true
      case 'GUARD_BEHIND_BARRICADE':
        return false
      case 'PURSUE_ENEMIES': this.state = 'PURSUING_ENEMIES'; return true
      case 'ELIMINATE_CASTLE_INFILTRATORS':
        this.state = 'ELIMINATING_CASTLE_INFILTRATORS'
        return true
      case 'PRIORITIZE_CASTLE_DEFENSE': {
        const x = targets.castle_gate
        if (x === undefined) return false
        this.targetX = x
        this.guardX = x
        this.stateAfterArrival = 'DEFENDING_CASTLE'
        this.state = Math.abs(playerX - x) <= ARRIVAL_DISTANCE ? 'DEFENDING_CASTLE' : 'MOVING_TO_TARGET'
        return true
      }
      case 'RETREAT': this.state = 'RETREATING'; return true
      case 'HOLD': this.state = 'HOLDING'; return true
      case 'UNSUPPORTED':
      case 'STATUS':
      case 'ANSWER_GAME_QUESTION': return true
      default: return false
    }
  }

  update(player: Player, monsters: readonly Monster[], policy: CombatPolicy = 'nearest', hpRatio = 1) {
    this.resetControl()
    if (this.jumpQueued) {
      this.control.jumpJustDown = true
      this.jumpQueued = false
    }
    if (player.state_ === 'dead') { this.state = 'DEAD'; return }

    // 피격 직후에는 원래 이동 명령보다 공격자를 우선한다.
    // 뒤를 보고 싸우는 중 앞에서 맞는 상황에서도 방향을 전환하고 반격한다.
    if (this.counterUntil > player.scene.time.now) {
      const target = this.counterTarget?.active && this.counterTarget.alive ? this.counterTarget : null
      if (target) this.attackOrApproach(player, target)
      else if (this.counterAttackQueued) {
        this.counterAttackQueued = false
        this.control.attackJustDown = true
      }
      return
    }
    this.counterTarget = null

    if (this.state === 'MOVING_TO_TARGET' || this.state === 'RETURNING_TO_BASE' || this.state === 'MOVING_TO_NPC') {
      if (this.targetX === null) { this.state = 'STANDBY'; return }
      if (this.moveToward(player.x, this.targetX)) {
        if (this.state !== 'MOVING_TO_NPC' && this.arrivalTargetId) {
          this.arrivedTargetId = this.arrivalTargetId
          this.arrivalTargetId = null
        }
        if (this.state === 'MOVING_TO_NPC') this.state = 'HOLDING'
        else this.state = this.stateAfterArrival
      }
      return
    }

    if (this.state === 'RUSHING') {
      if (this.targetX === null || Math.abs(player.x - this.targetX) <= ARRIVAL_DISTANCE) {
        this.state = this.stateAfterArrival
        return
      }
      const dx = this.targetX - player.x
      if (player.body?.blocked.down && !this.rushJumpStarted) {
        this.rushJumpStarted = true
        this.control.jumpJustDown = true
      } else if (!player.body?.blocked.down && this.rushJumpStarted && !this.rushDashTriggered) {
        this.rushDashTriggered = true
        this.control.jumpJustDown = true
      }
      if (dx < 0) this.control.left = true
      else this.control.right = true
      return
    }

    if (this.state === 'RETREATING') {
      this.control.left = true
      return
    }
    if (this.state === 'ADVANCING') {
      const enemy = this.nearestEnemy(player, monsters, COMBAT.ATTACK_REACH + 30)
      if (enemy) this.attackOrApproach(player, enemy)
      else this.control.right = true
      return
    }
    if (this.state === 'AUTO_COMBAT') {
      if (policy === 'survival' && hpRatio < 0.35) {
        this.control.left = true
        return
      }
      const enemy = this.policyTarget(player, monsters, policy)
      if (enemy) this.attackOrApproach(player, enemy)
      return
    }
    if (this.state === 'GUARDING') {
      const anchor = this.guardX ?? player.x
      if (Math.abs(player.x - anchor) > GUARD_RADIUS) { this.moveToward(player.x, anchor); return }
      const enemy = this.nearestEnemy(player, monsters, GUARD_RADIUS)
      if (enemy) this.attackOrApproach(player, enemy)
    }
    if (this.state === 'HOLDING_COMBAT') {
      const enemy = this.nearestEnemy(player, monsters, COMBAT.ATTACK_REACH * 0.82)
      if (enemy) {
        player.facing = enemy.x < player.x ? -1 : 1
        this.control.attackJustDown = true
      }
      return
    }
    if (this.state === 'PURSUING_ENEMIES') {
      const enemy = this.mostUrgentEnemy(monsters)
      if (enemy) this.attackOrApproach(player, enemy)
      return
    }
    if (this.state === 'ELIMINATING_CASTLE_INFILTRATORS') {
      // 디펜스 좀비는 오른쪽에서 성(왼쪽)으로 진격한다. 가장 x가 작은 적이 가장 깊이 침투한 적이다.
      // 한 마리를 처치하면 다음 침투자를 다시 골라, 명령이 취소될 때까지 섬멸을 계속한다.
      const infiltrator = this.mostUrgentEnemy(monsters)
      if (infiltrator) this.attackOrApproach(player, infiltrator)
      return
    }
    if (this.state === 'DEFENDING_CASTLE') {
      const anchor = this.guardX ?? player.x
      if (Math.abs(player.x - anchor) > CASTLE_PATROL_RADIUS) {
        this.moveToward(player.x, anchor)
        return
      }
      const urgent = this.mostUrgentEnemy(monsters, anchor + CASTLE_PATROL_RADIUS)
      if (urgent) this.attackOrApproach(player, urgent)
      else if (Math.abs(player.x - anchor) > 60) this.moveToward(player.x, anchor)
    }
  }

  activateAutoCombat() {
    if (this.state === 'STANDBY' || this.state === 'HOLDING') this.state = 'AUTO_COMBAT'
  }

  private policyTarget(player: Player, monsters: readonly Monster[], policy: CombatPolicy): Monster | null {
    if (policy === 'defense') return this.mostUrgentEnemy(monsters)
    if (policy === 'elite') {
      let elite: Monster | null = null
      let eliteScore = -1
      for (const monster of monsters) {
        if (!monster.active || !monster.alive) continue
        const score = monster.def.maxHp + monster.def.defense * 10
        if (score > eliteScore) { elite = monster; eliteScore = score }
      }
      return elite
    }
    if (policy === 'danger') {
      let dangerous: Monster | null = null
      let distance = Infinity
      for (const monster of monsters) {
        if (!monster.active || !monster.alive ||
            (!monster.def.name.includes('화약') && !monster.def.name.includes('돌진'))) continue
        const candidateDistance = Math.abs(monster.x - player.x)
        if (candidateDistance < distance) { dangerous = monster; distance = candidateDistance }
      }
      return dangerous ?? this.nearestEnemy(player, monsters)
    }
    return this.nearestEnemy(player, monsters)
  }

  /** 디펜스에서 x가 작을수록 성에 가까운, 즉 가장 급한 적이다. */
  private mostUrgentEnemy(monsters: readonly Monster[], maxX = Infinity): Monster | null {
    let urgent: Monster | null = null
    for (const monster of monsters) {
      if (!monster.active || !monster.alive || monster.x > maxX) continue
      if (!urgent || monster.x < urgent.x) urgent = monster
    }
    return urgent
  }

  /** 직접 조작이 들어오면 자동 명령을 취소하고 제자리에 남는다. */
  cancelForManualControl() {
    this.targetX = null
    this.guardX = null
    this.arrivalTargetId = null
    this.arrivedTargetId = null
    this.jumpQueued = false
    this.rushJumpStarted = false
    this.rushDashTriggered = false
    this.counterTarget = null
    this.counterUntil = 0
    this.counterAttackQueued = false
    this.combatTarget = null
    this.combatTargetUntil = 0
    this.state = 'HOLDING'
    this.resetControl()
  }

  /** 몬스터에게 맞은 방향의 적을 짧게 최우선 반격 대상으로 지정한다. */
  reactToHit(player: Player, monsters: readonly Monster[], fromX: number) {
    const direction: -1 | 1 = fromX < player.x ? -1 : 1
    player.facing = direction
    this.counterTarget = monsters
      .filter((monster) => monster.active && monster.alive &&
        (monster.x - player.x) * direction >= -24 &&
        Math.abs(monster.y - player.y) < 100)
      .sort((a, b) => Math.abs(a.x - player.x) - Math.abs(b.x - player.x))[0] ?? null
    this.counterUntil = player.scene.time.now + 900
    this.counterAttackQueued = true
  }

  guardBehindPosition(positionX: number, playerX: number) {
    this.targetX = positionX
    this.guardX = positionX
    this.arrivalTargetId = null
    this.stateAfterArrival = 'GUARDING'
    this.state = Math.abs(playerX - positionX) <= ARRIVAL_DISTANCE ? 'GUARDING' : 'MOVING_TO_TARGET'
  }

  consumeArrival(): string | null {
    const targetId = this.arrivedTargetId
    this.arrivedTargetId = null
    return targetId
  }

  private nearestEnemy(player: Player, monsters: readonly Monster[], maxDistance = Infinity): Monster | null {
    const now = player.scene.time.now
    if (this.combatTarget && now < this.combatTargetUntil && this.combatTarget.active && this.combatTarget.alive) {
      const lockedDistance = Math.abs(this.combatTarget.x - player.x)
      if (lockedDistance < maxDistance && Math.abs(this.combatTarget.y - player.y) < 90) return this.combatTarget
    }
    let nearest: Monster | null = null
    let nearestDistance = maxDistance
    for (const monster of monsters) {
      if (!monster.active || !monster.alive) continue
      const distance = Math.abs(monster.x - player.x)
      if (distance < nearestDistance && Math.abs(monster.y - player.y) < 90) {
        nearest = monster
        nearestDistance = distance
      }
    }
    this.combatTarget = nearest
    this.combatTargetUntil = nearest ? now + 350 : 0
    return nearest
  }

  private attackOrApproach(player: Player, enemy: Monster) {
    const dx = enemy.x - player.x
    const attackDistance = COMBAT.ATTACK_REACH * 0.82
    const guardMode = this.state === 'GUARDING' || this.state === 'HOLDING_COMBAT' || this.state === 'DEFENDING_CASTLE'
    this.control.preventCombo = guardMode
    if (guardMode && this.guardX !== null && Math.abs(player.x - this.guardX) > 8) {
      this.moveToward(player.x, this.guardX)
      return
    }
    if (Math.abs(dx) <= attackDistance) {
      // 공격 거리 안에서는 좌우 이동을 끄고 방향만 유지해 경계에서 앞뒤 진동을 막는다.
      this.control.left = false
      this.control.right = false
      player.facing = dx < 0 ? -1 : 1
      this.control.attackJustDown = true
    } else if (!guardMode) {
      if (dx < 0) this.control.left = true
      else this.control.right = true
    } else {
      player.facing = dx < 0 ? -1 : 1
    }
  }

  private moveToward(currentX: number, targetX: number): boolean {
    const dx = targetX - currentX
    if (Math.abs(dx) <= ARRIVAL_DISTANCE) return true
    if (dx < 0) this.control.left = true
    else this.control.right = true
    return false
  }

  private resetControl() {
    this.control.left = false
    this.control.right = false
    this.control.up = false
    this.control.down = false
    this.control.jumpJustDown = false
    this.control.attackJustDown = false
    this.control.sitJustDown = false
    this.control.preventCombo = false
  }
}
