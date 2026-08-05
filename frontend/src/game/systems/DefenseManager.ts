import Phaser from 'phaser'
import type { Monster, MonsterTarget } from '../entities/Monster'
import { SpawnManager } from './SpawnManager'
import { EventBus, GameEvents } from '../EventBus'
import { useGameStore } from '../../stores/gameStore'
import { EffectManager } from './EffectManager'

export type BarricadeTier = 'low' | 'mid' | 'high'
export type DefenseBuildType = 'barricade' | 'watchtower' | 'bastion'
export type DefenseUpgrade = 'attack' | 'vitality' | 'mana' | 'salvage' | 'fortify' | 'repair'

export const BARRICADE_TIERS: Record<BarricadeTier, {
  name: string; cost: number; hp: number; width: number; height: number; tint: number
}> = {
  low: { name: '하급', cost: 30, hp: 100, width: 44, height: 64, tint: 0xffffff },
  mid: { name: '중급', cost: 150, hp: 240, width: 54, height: 72, tint: 0xd7e8ff },
  high: { name: '상급', cost: 500, hp: 500, width: 66, height: 82, tint: 0xffd778 },
}

export const OFFENSIVE_STRUCTURES: Record<Exclude<DefenseBuildType, 'barricade'>, {
  name: string; cost: number; hp: number; width: number; height: number; tint: number
  damage: number; range: number; cooldownMs: number; splashRadius?: number
}> = {
  watchtower: { name: '망루', cost: 220, hp: 260, width: 70, height: 126, tint: 0x9ad7ff, damage: 18, range: 820, cooldownMs: 2_200 },
  bastion: { name: '성루', cost: 450, hp: 520, width: 92, height: 118, tint: 0xffb74d, damage: 44, range: 900, cooldownMs: 4_800, splashRadius: 92 },
}

/** 디펜스 페이싱 상수 — 조작감 튜닝은 여기서만 (config.ts 규약과 동일 정신) */
const DEFENSE = {
  /** 대기 단계(바리케이트 설치) 시간. DefenseHud의 WAVE_WARNING_MS와 맞물린다 —
   *  이 값을 늘리면 경고가 대기 후반에만 뜨고, 줄이면 대기 내내 떠 있는다. */
  WAIT_MS: 10_000,
  /** 본 전투 시간 */
  COMBAT_MS: 180_000,
  /** 스테이지 n의 좀비 수 = n + BASE_ZOMBIES (stage1 = 10, stage2 = 11 …) */
  BASE_ZOMBIES: 9,
  /** 좀비 순차 스폰 간격 */
  SPAWN_INTERVAL_MS: 1_800,
  /** 좀비 스폰 x (맨 오른쪽에서) — worldWidth 기준 offset */
  SPAWN_X_OFFSET: 80,
  /** 바리케이트 사이 최소 간격 */
  BARRICADE_GAP: 12,
  /** 궁수 지원 */
  ARCHER_COST: 50,
  ARCHER_COOLDOWN_MS: 8_000,
  ARCHER_TARGETS: 5,
  WATCHTOWER_PROJECTILE_COLOR: 0xfff3a6,
  BASTION_PROJECTILE_COLOR: 0xff8a65,
  /** 기지 체력 */
  BASE_HP: 100,
  /** 좀비가 플레이어를 우선 추적하는 근접 범위 (넘어서면 기지로 진격) */
  PLAYER_AGGRO_X: 200,
  PLAYER_AGGRO_Y: 70,
  /** 좀비가 구조물(바리케이트/기지) 바로 앞에서 막혀 있으면 플레이어보다 그 구조물을 우선 공격하는 거리.
   *  이게 없으면 플레이어를 쫓다 바리케이트에 막힌 좀비가 바리케이트를 안 때려 HP가 안 깎인다. */
  STRUCT_AGGRO_X: 62,
  /** 기지 x (맨 왼쪽) */
  BASE_X: 130,
  /** 기지(성 모형) 렌더 깊이. 액터(플레이어·좀비, 기본 depth 0)보다 **뒤**, 배경/보행로
   *  (GameScene DEPTH.GROUND=-50 이하)보다는 앞. 성 모형이 캐릭터를 가리지 않고
   *  캐릭터가 성문 앞에 서 있는 것처럼 보인다. 바리케이트는 플레이어가 뒤에 숨는 엄폐물이라
   *  액터와 같은 깊이(0)로 그대로 둔다. */
  BASE_DEPTH: -10,
  /** 승리 후 다음 스테이지 대기까지의 연출 여유 */
  VICTORY_DELAY_MS: 2_500,
} as const

interface Structure {
  spr: Phaser.Physics.Arcade.Sprite
  hpBar: Phaser.GameObjects.Graphics
  hp: number
  maxHp: number
  isBase: boolean
  barW: number
  kind: 'base' | DefenseBuildType
  attackReadyAt: number
  tier?: BarricadeTier
}

type Phase = 'idle' | 'wait' | 'combat' | 'victory' | 'defeat'
type DefeatReason = 'base' | 'death' | 'timeout'
export type BarricadeCommandResult = 'PLACED' | 'NOT_WAIT_PHASE' | 'NOT_ENOUGH_GOLD'

/**
 * 스테이지 디펜스 게임 오케스트레이션.
 * - 대기(바리케이트 설치) → 본전투(좀비 웨이브) → 승리(다음 스테이지) / 패배 루프
 * - 좀비는 SpawnManager 풀을 통해 스폰되어 GameScene.resolveAttack(플레이어 공격)에 정상 잡힌다.
 * - 좀비 타깃은 GameScene.update가 매 프레임 updateMonsters로 위임해 좀비별로 골라 넘긴다.
 * GameScene은 mode==='defense'일 때만 이 매니저를 생성한다.
 */
export class DefenseManager {
  private scene: Phaser.Scene
  private spawner: SpawnManager
  private groundY: number
  private worldWidth: number
  private group: Phaser.Physics.Arcade.StaticGroup
  private playerTarget: MonsterTarget
  private effects: EffectManager

  private stage = 1
  private phase: Phase = 'idle'
  private defeatReason: DefeatReason | null = null
  private phaseEndsAt = 0
  private structures: Structure[] = []
  private base!: Structure
  /** 아직 죽지 않은 좀비 수(미스폰 + 생존) */
  private waveRemaining = 0
  private spawnedCount = 0
  private waveTotal = 0
  private tickEvent?: Phaser.Time.TimerEvent
  private spawnEvent?: Phaser.Time.TimerEvent
  /** 바리케이트 배치 대기 모드 (구매 창에서 바리케이트 선택 시 on) */
  placing = false
  selectedStructure: DefenseBuildType = 'barricade'
  selectedTier: BarricadeTier = 'low'
  private archerReadyAt = 0
  private archerCooldownMs = DEFENSE.ARCHER_COOLDOWN_MS
  private combo = 0
  private comboExpiresAt = 0
  private supportGauge = 0
  private eventName: string | null = null
  private spawnIntervalMs: number = DEFENSE.SPAWN_INTERVAL_MS
  private rewardChoices: DefenseUpgrade[] = []
  /** 배치 미리보기 고스트(마우스를 따라다니는 반투명 바리케이트). 배치 모드에서만 표시. */
  private ghost?: Phaser.GameObjects.Image

  /** structureTarget: 좀비가 진격/공격하는 "맨 오른쪽 생존 구조물". 매 프레임 재생성 방지용 단일 객체. */
  private structureTarget: MonsterTarget

  constructor(
    scene: Phaser.Scene,
    spawner: SpawnManager,
    groundY: number,
    worldWidth: number,
    group: Phaser.Physics.Arcade.StaticGroup,
    playerTarget: MonsterTarget,
    effects: EffectManager,
  ) {
    this.scene = scene
    this.spawner = spawner
    this.groundY = groundY
    this.worldWidth = worldWidth
    this.group = group
    this.playerTarget = playerTarget
    this.effects = effects

    const self = this
    this.structureTarget = {
      get x() { const s = self.rightmostStanding(); return s ? s.spr.x : DEFENSE.BASE_X },
      get y() { return self.groundY },
      get alive() { return true },
      receiveHit: (attack: number) => self.damageRightmost(attack),
    }

    // 기지(맨 왼쪽 성 아티팩트) 생성 — 실제 아트(castle_model_01, 404×286)가 있으면 원본 비율
    // (92 × 404/286 ≈ 130)로 그리고, 없으면 도형 placeholder(ph_base) 폴백.
    // bodyW는 표시 폭보다 좁게 유지 — 좀비가 STRUCT_AGGRO_X(62px) 안에서 멈춰야 기지를 때린다.
    const baseArt = this.scene.textures.exists('img_castle_base')
    this.base = this.addStructure(
      DEFENSE.BASE_X, DEFENSE.BASE_HP, true, baseArt ? 'img_castle_base' : 'ph_base', baseArt ? 130 : 70, 92, 50,
    )
    // HP바(depth 5)는 그대로 액터 위에 남겨 성 모형 뒤로 숨지 않게 한다.
    this.base.spr.setDepth(DEFENSE.BASE_DEPTH)

    // 매 100ms 카운트다운/전환 틱
    this.tickEvent = this.scene.time.addEvent({ delay: 100, loop: true, callback: () => this.tick() })

    this.startStage(Math.max(1, useGameStore.getState().defenseStage))
  }

  // ---- 스테이지 흐름 ----

  private startStage(n: number) {
    this.stage = n
    useGameStore.getState().setStats({ stageCode: 'map_defense', defenseStage: n })
    this.phase = 'wait'
    this.phaseEndsAt = this.scene.time.now + DEFENSE.WAIT_MS
    this.spawnedCount = 0
    this.waveTotal = n + DEFENSE.BASE_ZOMBIES
    this.waveRemaining = this.waveTotal
    this.combo = 0
    this.rollStageEvent()
    this.emitState()
  }

  private rollStageEvent() {
    this.spawnIntervalMs = DEFENSE.SPAWN_INTERVAL_MS
    if (this.stage % 5 === 0) {
      this.eventName = '대장 출현: 보스 웨이브'
      return
    }
    const roll = Phaser.Math.Between(0, 3)
    if (roll === 0) {
      this.eventName = '야습: 적이 빠르게 몰려옵니다'
      this.spawnIntervalMs = 1_050
    } else if (roll === 1) {
      this.eventName = '보급 마차: 군자금 40G 획득'
      const store = useGameStore.getState()
      store.setStats({ gold: store.gold + 40 })
    } else if (roll === 2) {
      this.eventName = '정예 부대: 특수병 출현 증가'
    } else {
      this.eventName = '평온한 전운'
    }
  }

  private startCombat() {
    this.phase = 'combat'
    this.phaseEndsAt = this.scene.time.now + DEFENSE.COMBAT_MS
    EventBus.emit(GameEvents.DEFENSE_WAVE_START)
    // 좀비 순차 스폰. 첫 마리는 아래에서 즉시 스폰하므로 타이머는 나머지(waveTotal-1)만 담당한다.
    // repeat=N은 콜백을 N+1회 실행하므로, 나머지 waveTotal-1회를 원하면 repeat=waveTotal-2.
    // (예전엔 repeat=waveTotal-1이라 타이머가 waveTotal회 + 즉시 1회 = waveTotal+1마리를 스폰,
    //  승리 조건(waveTotal 처치)은 1마리 남았는데 먼저 충족돼 조기 클리어되던 버그가 있었다.)
    this.spawnEvent = this.scene.time.addEvent({
      delay: this.spawnIntervalMs,
      repeat: Math.max(0, this.waveTotal - 2),
      callback: () => this.spawnOne(),
    })
    // 첫 마리는 즉시
    this.spawnOne()
    this.emitState()
  }

  private spawnOne() {
    if (this.phase !== 'combat') return
    const x = this.worldWidth - DEFENSE.SPAWN_X_OFFSET - Phaser.Math.Between(0, 180)
    const code = this.monsterCodeFor(this.spawnedCount)
    const monster = this.spawner.spawnAt(code, x, x - 30, x + 20, (m) => this.onZombieDied(m))
    this.scene.time.delayedCall(700, () => {
      if (!monster.active) return
      if (code === 'zombie_runner') monster.setTint(0xffcc80)
      else if (code === 'zombie_shield') monster.setTint(0x90caf9)
      else if (code === 'zombie_exploder') monster.setTint(0xff8a80)
      else if (code === 'zombie_boss') monster.setTint(0xce93d8).setScale(1.45)
    })
    this.spawnedCount += 1
  }

  private monsterCodeFor(index: number): string {
    if (this.stage % 5 === 0 && index === this.waveTotal - 1) return 'zombie_boss'
    const eliteBoost = this.eventName?.startsWith('정예') ? 2 : 1
    if (this.stage >= 4 && index % Math.max(3, 7 - eliteBoost) === 2) return 'zombie_exploder'
    if (this.stage >= 3 && index % Math.max(3, 6 - eliteBoost) === 1) return 'zombie_shield'
    if (this.stage >= 2 && index % Math.max(2, 5 - eliteBoost) === 0) return 'zombie_runner'
    return 'zombie_defense'
  }

  private onZombieDied(_m: Monster) {
    this.waveRemaining -= 1
    const now = this.scene.time.now
    this.combo = now <= this.comboExpiresAt ? this.combo + 1 : 1
    this.comboExpiresAt = now + 3_000
    this.supportGauge = Math.min(100, this.supportGauge + Math.min(20, 8 + this.combo))
    this.emitState()
    if (this.phase === 'combat' && this.waveRemaining <= 0) this.victory()
  }

  private victory() {
    this.phase = 'victory'
    this.spawnEvent?.remove()
    this.spawnEvent = undefined
    EventBus.emit(GameEvents.DEFENSE_WAVE_COMPLETE)
    this.rewardChoices = Phaser.Utils.Array.Shuffle<DefenseUpgrade>(
      ['attack', 'vitality', 'mana', 'salvage', 'fortify', 'repair'],
    ).slice(0, 3)
    this.emitState()
  }

  /** 패배 처리. reason: 'base'=기지 파괴 / 'death'=캐릭터 사망 / 'timeout'=시간 초과 */
  private defeat(reason: DefeatReason) {
    if (this.phase === 'defeat') return
    this.phase = 'defeat'
    this.defeatReason = reason
    this.spawnEvent?.remove()
    this.spawnEvent = undefined
    // 남은 좀비 정리 — 화면에서 정지
    for (const m of this.spawner.monsters) {
      if (m.active) m.setVelocity(0, 0)
    }
    this.emitState()
  }

  /** 캐릭터 사망 = 패배 (GameScene.handleDeath에서 호출). 이미 끝났으면 무시. */
  playerDied() {
    if (this.phase === 'victory' || this.phase === 'defeat') return
    this.defeat('death')
  }

  private tick() {
    if (this.combo > 0 && this.scene.time.now > this.comboExpiresAt) this.combo = 0
    if (this.phase === 'wait') {
      if (this.scene.time.now >= this.phaseEndsAt) { this.startCombat(); return }
    } else if (this.phase === 'combat') {
      if (this.scene.time.now >= this.phaseEndsAt) {
        // 시간 초과: 좀비가 남아 있으면 패배
        if (this.waveRemaining > 0) { this.defeat('timeout'); return }
      }
    } else {
      return
    }
    this.emitState()
  }

  // ---- 좀비 타깃 위임 (GameScene.update → 매 프레임) ----

  /** 각 좀비의 타깃을 골라 update. 플레이어가 근접하면 플레이어, 아니면 기지 방향 구조물. */
  updateMonsters(monsters: Monster[], now: number) {
    // 패배 후에는 좀비를 정지시킨 채 AI를 돌리지 않는다 (오버레이 아래에서 계속 진격하지 않게)
    if (this.phase === 'defeat') {
      for (let i = 0; i < monsters.length; i++) {
        if (monsters[i].active) monsters[i].setVelocityX(0)
      }
      return
    }
    this.updateOffensiveStructures(monsters, now)
    const struct = this.rightmostStanding()
    const structX = struct ? struct.spr.x : null
    for (let i = 0; i < monsters.length; i++) {
      const m = monsters[i]
      if (!m.active) continue
      let target = this.structureTarget
      // 좀비가 맨 앞 구조물 바로 오른쪽(막힌 위치)에 있으면 그 구조물을 우선 공격해 돌파한다.
      // 그래야 플레이어가 뒤에 서 있어도 바리케이트/기지 HP가 깎인다.
      const blockedByStruct = structX !== null && m.x > structX && (m.x - structX) < DEFENSE.STRUCT_AGGRO_X
      if (!blockedByStruct && this.playerTarget.alive) {
        const dx = Math.abs(this.playerTarget.x - m.x)
        const dy = Math.abs(this.playerTarget.y - m.y)
        if (dx < DEFENSE.PLAYER_AGGRO_X && dy < DEFENSE.PLAYER_AGGRO_Y) target = this.playerTarget
      }
      m.update(target, now)
    }
  }

  private updateOffensiveStructures(monsters: Monster[], now: number) {
    if (this.phase !== 'combat') return
    for (const structure of this.structures) {
      if (structure.isBase || structure.hp <= 0 || structure.kind === 'base' || structure.kind === 'barricade' || now < structure.attackReadyAt) continue
      const spec = OFFENSIVE_STRUCTURES[structure.kind]
      const target = monsters
        .filter((monster) => monster.active && monster.alive && monster.x > structure.spr.x && monster.x - structure.spr.x <= spec.range)
        .sort((a, b) => a.x - b.x)[0]
      if (!target) continue
      structure.attackReadyAt = now + spec.cooldownMs
      if (structure.kind === 'watchtower') this.fireWatchtower(structure, target, spec.damage, now)
      else this.fireBastion(structure, target, spec.damage, spec.splashRadius ?? 0)
    }
  }

  private fireWatchtower(structure: Structure, target: Monster, damage: number, now: number) {
    const arrow = this.scene.add.rectangle(structure.spr.x + 22, structure.spr.y - structure.spr.displayHeight * 0.65, 28, 4, DEFENSE.WATCHTOWER_PROJECTILE_COLOR)
      .setDepth(8).setRotation(0.08)
    this.scene.tweens.add({
      targets: arrow, x: target.x, y: target.y - 18, duration: 300, ease: 'Quad.easeIn',
      onComplete: () => {
        arrow.destroy()
        if (target.alive) target.receiveHit(damage, false, structure.spr.x, this.effects, now)
      },
    })
  }

  private fireBastion(structure: Structure, target: Monster, damage: number, splashRadius: number) {
    const shell = this.scene.add.circle(structure.spr.x + 26, structure.spr.y - structure.spr.displayHeight * 0.72, 7, DEFENSE.BASTION_PROJECTILE_COLOR)
      .setDepth(8)
    this.scene.tweens.add({
      targets: shell, x: target.x, y: target.y - 20, duration: 620, ease: 'Quad.easeIn',
      onComplete: () => {
        shell.destroy()
        const impact = this.scene.add.circle(target.x, target.y - 18, splashRadius, 0xff7043, 0.28).setDepth(7)
        this.scene.tweens.add({ targets: impact, scale: 1.25, alpha: 0, duration: 260, onComplete: () => impact.destroy() })
        for (const monster of this.spawner.monsters) {
          if (!monster.active || !monster.alive) continue
          const distance = Phaser.Math.Distance.Between(target.x, target.y, monster.x, monster.y)
          if (distance <= splashRadius) {
            const falloff = distance <= splashRadius * 0.45 ? 1 : 0.65
            monster.receiveHit(Math.ceil(damage * falloff), false, structure.spr.x, this.effects, this.scene.time.now)
          }
        }
      },
    })
  }

  // ---- 구조물(기지/바리케이트) ----

  private addStructure(
    x: number, hp: number, isBase: boolean, texKey: string, dispW: number, dispH: number, bodyW: number,
    kind: 'base' | DefenseBuildType = isBase ? 'base' : 'barricade',
  ): Structure {
    const spr = this.group.create(x, this.groundY - dispH / 2, texKey) as Phaser.Physics.Arcade.Sprite
    spr.setDisplaySize(dispW, dispH)
    // 표시 크기로 바디를 먼저 동기화(위치·크기)한 뒤, setSize(center=true)로 좁은 충돌 폭을 다시 지정한다.
    // 순서를 바꾸면 refreshBody가 바디를 표시 폭으로 되돌려 좁은 폭이 무효화된다(좀비 공격 사거리 밖으로 밀림).
    spr.refreshBody()
    const body = spr.body as Phaser.Physics.Arcade.StaticBody
    body.setSize(bodyW, dispH, true)
    const barW = dispW
    const hpBar = this.scene.add.graphics().setDepth(5)
    const s: Structure = { spr, hpBar, hp, maxHp: hp, isBase, barW, kind, attackReadyAt: 0 }
    this.structures.push(s)
    this.drawHpBar(s)
    return s
  }

  private drawHpBar(s: Structure) {
    const g = s.hpBar
    g.clear()
    if (s.hp <= 0) return
    const w = s.barW
    const h = 6
    const x = s.spr.x - w / 2
    const y = s.spr.y - s.spr.displayHeight / 2 - 12
    g.fillStyle(0x000000, 0.6); g.fillRect(x - 1, y - 1, w + 2, h + 2)
    g.fillStyle(0x424242, 1); g.fillRect(x, y, w, h)
    const ratio = Phaser.Math.Clamp(s.hp / s.maxHp, 0, 1)
    const color = s.isBase ? 0x42a5f5 : (ratio > 0.3 ? 0x66bb6a : 0xef5350)
    g.fillStyle(color, 1); g.fillRect(x, y, w * ratio, h)
  }

  private rightmostStanding(): Structure | null {
    let best: Structure | null = null
    for (const s of this.structures) {
      if (s.hp <= 0) continue
      if (!best || s.spr.x > best.spr.x) best = s
    }
    return best
  }

  private damageRightmost(attack: number) {
    const s = this.rightmostStanding()
    if (!s) return
    s.hp -= attack
    if (s.hp <= 0) {
      s.hp = 0
      this.destroyStructure(s)
    }
    this.drawHpBar(s)
    this.emitState()
    if (s.isBase && s.hp <= 0) this.defeat('base')
  }

  private destroyStructure(s: Structure) {
    const body = s.spr.body as Phaser.Physics.Arcade.StaticBody
    body.enable = false
    s.hpBar.clear()
    this.scene.tweens.add({
      targets: s.spr, alpha: 0, angle: s.isBase ? 0 : 12, duration: 400, ease: 'Quad.easeIn',
      onComplete: () => s.spr.setVisible(false),
    })
  }

  /** 바리케이트 배치 가능 x 범위 (기지 앞쪽~스폰존 앞). placeBarricade와 미리보기가 공유한다. */
  private placeMinX() { return DEFENSE.BASE_X + 70 }
  private placeMaxX() { return this.worldWidth - 120 }

  private selectedBuildSpec() {
    return this.selectedStructure === 'barricade'
      ? BARRICADE_TIERS[this.selectedTier]
      : OFFENSIVE_STRUCTURES[this.selectedStructure]
  }

  private structureTexture(kind: DefenseBuildType) {
    if (kind === 'bastion' && this.scene.textures.exists('img_castle_base')) return 'img_castle_base'
    return 'img_barricade'
  }

  /** 이 위치에 지금 바리케이트를 설치할 수 있는가. 전투 중에도 가능하며 기존 방벽과 겹칠 수 없다. */
  private canPlaceAt(worldX: number): boolean {
    if ((this.phase !== 'wait' && this.phase !== 'combat') || !this.placing) return false
    if (worldX < this.placeMinX() || worldX > this.placeMaxX()) return false
    const def = this.selectedBuildSpec()
    if (useGameStore.getState().gold < def.cost) return false
    return !this.structures.some((structure) => {
      if (structure.isBase || structure.hp <= 0) return false
      const otherWidth = structure.barW
      return Math.abs(structure.spr.x - worldX) < (def.width + otherWidth) / 2 + DEFENSE.BARRICADE_GAP
    })
  }

  /** 바리케이트 설치 (대기 단계 + 배치 모드 + 골드 충분 + 배치존 안). GameScene 포인터에서 호출. */
  placeBarricade(worldX: number): boolean {
    this.selectedStructure = 'barricade'
    if (!this.canPlaceAt(worldX)) return false
    const def = BARRICADE_TIERS[this.selectedTier]
    const gold = useGameStore.getState().gold
    useGameStore.getState().setStats({ gold: gold - def.cost })
    const structure = this.addStructure(worldX, def.hp, false, 'img_barricade', def.width, def.height, def.width - 4)
    structure.tier = this.selectedTier
    structure.spr.setTint(def.tint)
    this.placing = false
    this.hidePlacementPreview()
    EventBus.emit(GameEvents.DEFENSE_PLACE_MODE, false)
    return true
  }

  placeSelectedStructure(worldX: number): boolean {
    if (this.selectedStructure === 'barricade') return this.placeBarricade(worldX)
    if (!this.canPlaceAt(worldX)) return false
    const def = OFFENSIVE_STRUCTURES[this.selectedStructure]
    const gold = useGameStore.getState().gold
    useGameStore.getState().setStats({ gold: gold - def.cost })
    const structure = this.addStructure(
      worldX, def.hp, false, this.structureTexture(this.selectedStructure), def.width, def.height, def.width - 6, this.selectedStructure,
    )
    structure.spr.setTint(def.tint)
    this.placing = false
    this.hidePlacementPreview()
    EventBus.emit(GameEvents.DEFENSE_PLACE_MODE, false)
    return true
  }

  /** 자연어 명령용 설치 경로. UI 배치 모드를 열지 않고 현재 캐릭터 앞의 안전 범위에 즉시 설치한다. */
  placeBarricadeByCommand(worldX: number): BarricadeCommandResult {
    if (this.phase !== 'wait' && this.phase !== 'combat') return 'NOT_WAIT_PHASE'
    this.selectedTier = 'low'
    this.selectedStructure = 'barricade'
    if (useGameStore.getState().gold < BARRICADE_TIERS.low.cost) return 'NOT_ENOUGH_GOLD'
    const safeX = Phaser.Math.Clamp(worldX, this.placeMinX(), this.placeMaxX())
    this.placing = true
    return this.placeBarricade(safeX) ? 'PLACED' : 'NOT_WAIT_PHASE'
  }

  getNearestBarricadeX(playerX: number): number | null {
    const barricades = this.structures.filter((structure) => !structure.isBase && structure.hp > 0)
    if (barricades.length === 0) return null
    return barricades.sort((a, b) => Math.abs(a.spr.x - playerX) - Math.abs(b.spr.x - playerX))[0].spr.x
  }

  /** 관우가 성벽 앞에서 수비할 기준 위치. 성 바로 앞을 비워 두고 첫 방어선 안쪽에 잡는다. */
  getWallGuardX(): number {
    return this.base.spr.x + 180
  }

  /** 배치 미리보기 갱신 — 마우스(월드 x) 위치에 반투명 바리케이트를 그려 설치 지점을 예고한다.
   *  배치존 밖/골드 부족이면 붉게, 설치 가능하면 초록빛으로 표시한다. */
  updatePlacementPreview(worldX: number) {
    if (!this.placing || (this.phase !== 'wait' && this.phase !== 'combat')) { this.hidePlacementPreview(); return }
    const def = this.selectedBuildSpec()
    if (!this.ghost) {
      // origin을 밑변(0.5,1)에 둬 y=groundY면 실제 설치될 바리케이트와 바닥 정렬이 같다.
      this.ghost = this.scene.add.image(0, 0, this.structureTexture(this.selectedStructure))
        .setOrigin(0.5, 1).setDepth(6)
    }
    const texture = this.structureTexture(this.selectedStructure)
    if (this.ghost.texture.key !== texture) this.ghost.setTexture(texture)
    this.ghost.setDisplaySize(def.width, def.height)
    // 배치존을 벗어나도 고스트는 실제 커서 위치에 그려 "여긴 안 됨"을 색으로 알린다(범위 안내).
    const shownX = Phaser.Math.Clamp(worldX, this.placeMinX() - 40, this.placeMaxX() + 40)
    const valid = this.canPlaceAt(worldX)
    this.ghost.setVisible(true).setPosition(shownX, this.groundY)
      .setAlpha(valid ? 0.55 : 0.4).setTint(valid ? 0x8affa0 : 0xff6b6b)
  }

  /** 플레이어 전방의 적 최대 5명에게 궁수 지원 사격. */
  callArcherVolley(): boolean {
    if (this.phase !== 'combat' && this.phase !== 'wait') return false
    if (this.scene.time.now < this.archerReadyAt) return false
    const targets = this.spawner.monsters
      .filter((monster) => monster.alive && monster.x > this.playerTarget.x)
      .sort((a, b) => a.x - b.x)
      .slice(0, DEFENSE.ARCHER_TARGETS)
    const store = useGameStore.getState()
    const charged = this.supportGauge >= 100
    if (targets.length === 0 || (!charged && store.gold < DEFENSE.ARCHER_COST)) return false
    if (charged) this.supportGauge = 0
    else store.setStats({ gold: store.gold - DEFENSE.ARCHER_COST })
    this.archerReadyAt = this.scene.time.now + this.archerCooldownMs
    const damage = 24 + this.stage * 2
    targets.forEach((target, index) => {
      const arrow = this.scene.add.rectangle(target.x + 90, target.y - 150 - index * 8, 28, 4, 0xffe082)
        .setDepth(8).setRotation(2.2)
      this.scene.tweens.add({
        targets: arrow,
        x: target.x,
        y: target.y - 18,
        duration: 260 + index * 45,
        ease: 'Quad.easeIn',
        onComplete: () => {
          arrow.destroy()
          if (target.alive) target.receiveHit(damage, false, target.x + 80, this.effects, this.scene.time.now)
        },
      })
    })
    this.emitState()
    return true
  }

  repair(target: 'base' | 'barricades'): boolean {
    const store = useGameStore.getState()
    const cost = target === 'base' ? 30 : 40
    if (store.gold < cost) return false
    const structures = target === 'base'
      ? [this.base]
      : this.structures.filter((structure) => !structure.isBase && structure.hp > 0)
    if (structures.length === 0 || structures.every((structure) => structure.hp >= structure.maxHp)) return false
    store.setStats({ gold: store.gold - cost })
    for (const structure of structures) {
      const amount = target === 'base' ? 40 : Math.ceil(structure.maxHp * 0.35)
      structure.hp = Math.min(structure.maxHp, structure.hp + amount)
      this.drawHpBar(structure)
    }
    this.emitState()
    return true
  }

  chooseUpgrade(upgrade: DefenseUpgrade) {
    if (this.phase !== 'victory' || !this.rewardChoices.includes(upgrade)) return
    const store = useGameStore.getState()
    if (upgrade === 'attack') store.setStats({ attackPower: store.attackPower + 3 })
    else if (upgrade === 'vitality') store.setStats({ maxHp: store.maxHp + 20, hp: store.hp + 20 })
    else if (upgrade === 'mana') store.setStats({ maxMp: store.maxMp + 12, mp: store.mp + 12 })
    else if (upgrade === 'salvage') store.setStats({ gold: store.gold + 70 })
    else if (upgrade === 'fortify') {
      this.base.maxHp += 35; this.base.hp = Math.min(this.base.maxHp, this.base.hp + 35); this.drawHpBar(this.base)
    } else if (upgrade === 'repair') {
      for (const structure of this.structures) { if (structure.hp > 0) { structure.hp = structure.maxHp; this.drawHpBar(structure) } }
    }
    this.rewardChoices = []
    this.scene.time.delayedCall(DEFENSE.VICTORY_DELAY_MS, () => this.startStage(this.stage + 1))
    this.emitState()
  }

  /** 배치 미리보기 숨김 (배치 모드 종료/전투 시작 시). */
  hidePlacementPreview() {
    this.ghost?.setVisible(false)
  }

  // ---- 상태 브로드캐스트 ----

  private emitState() {
    const timeLeftMs = (this.phase === 'wait' || this.phase === 'combat')
      ? Math.max(0, this.phaseEndsAt - this.scene.time.now)
      : 0
    EventBus.emit(GameEvents.DEFENSE_STATE, {
      phase: this.phase,
      timeLeftMs,
      stage: this.stage,
      zombiesLeft: Math.max(0, this.waveRemaining),
      baseHp: this.base.hp,
      maxBaseHp: this.base.maxHp,
      defeatReason: this.defeatReason,
      archerCooldownMs: Math.max(0, this.archerReadyAt - this.scene.time.now),
      combo: this.combo,
      supportGauge: this.supportGauge,
      eventName: this.eventName,
      rewardChoices: this.rewardChoices,
    })
  }

  destroy() {
    this.tickEvent?.remove()
    this.spawnEvent?.remove()
    this.ghost?.destroy()
    this.ghost = undefined
    for (const s of this.structures) { s.hpBar.destroy() }
    this.structures = []
  }
}
