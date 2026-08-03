import { COMBAT } from '../config'
import type { Monster } from '../entities/Monster'
import type { Player, PlayerControl } from '../entities/Player'
import type { GuanYuCommand } from './commands'

export type GuanYuState =
  | 'STANDBY'
  | 'MOVING_TO_TARGET'
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

  readonly control: PlayerControl = {
    left: false, right: false, up: false, down: false,
    jumpJustDown: false, attackJustDown: false, sitJustDown: false,
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

  update(player: Player, monsters: readonly Monster[]) {
    this.resetControl()
    if (this.jumpQueued) {
      this.control.jumpJustDown = true
      this.jumpQueued = false
    }
    if (player.state_ === 'dead') { this.state = 'DEAD'; return }

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
      const enemy = this.nearestEnemy(player, monsters)
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
    this.state = 'HOLDING'
    this.resetControl()
  }

  consumeArrival(): string | null {
    const targetId = this.arrivedTargetId
    this.arrivedTargetId = null
    return targetId
  }

  private nearestEnemy(player: Player, monsters: readonly Monster[], maxDistance = Infinity): Monster | null {
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
    return nearest
  }

  private attackOrApproach(player: Player, enemy: Monster) {
    const dx = enemy.x - player.x
    if (Math.abs(dx) <= COMBAT.ATTACK_REACH * 0.82) this.control.attackJustDown = true
    else if (dx < 0) this.control.left = true
    else this.control.right = true
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
  }
}
