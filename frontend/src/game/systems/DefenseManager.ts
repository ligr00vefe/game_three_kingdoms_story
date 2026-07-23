import Phaser from 'phaser'
import type { Monster, MonsterTarget } from '../entities/Monster'
import { SpawnManager } from './SpawnManager'
import { EventBus, GameEvents } from '../EventBus'
import { useGameStore } from '../../stores/gameStore'

/** 디펜스 페이싱 상수 — 조작감 튜닝은 여기서만 (config.ts 규약과 동일 정신) */
const DEFENSE = {
  /** 대기 단계(바리케이트 설치) 시간 */
  WAIT_MS: 30_000,
  /** 본 전투 시간 */
  COMBAT_MS: 180_000,
  /** 스테이지 n의 좀비 수 = n + BASE_ZOMBIES (stage1 = 10, stage2 = 11 …) */
  BASE_ZOMBIES: 9,
  /** 좀비 순차 스폰 간격 */
  SPAWN_INTERVAL_MS: 1_800,
  /** 좀비 스폰 x (맨 오른쪽에서) — worldWidth 기준 offset */
  SPAWN_X_OFFSET: 80,
  /** 바리케이트 가격/체력 */
  BARRICADE_COST: 30,
  BARRICADE_HP: 100,
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
}

type Phase = 'idle' | 'wait' | 'combat' | 'victory' | 'defeat'
type DefeatReason = 'base' | 'death' | 'timeout'

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
  ) {
    this.scene = scene
    this.spawner = spawner
    this.groundY = groundY
    this.worldWidth = worldWidth
    this.group = group
    this.playerTarget = playerTarget

    const self = this
    this.structureTarget = {
      get x() { const s = self.rightmostStanding(); return s ? s.spr.x : DEFENSE.BASE_X },
      get y() { return self.groundY },
      get alive() { return true },
      receiveHit: (attack: number) => self.damageRightmost(attack),
    }

    // 기지(맨 왼쪽 미니어처) 생성
    this.base = this.addStructure(DEFENSE.BASE_X, DEFENSE.BASE_HP, true, 'ph_base', 70, 92, 50)

    // 매 100ms 카운트다운/전환 틱
    this.tickEvent = this.scene.time.addEvent({ delay: 100, loop: true, callback: () => this.tick() })

    this.startStage(1)
  }

  // ---- 스테이지 흐름 ----

  private startStage(n: number) {
    this.stage = n
    this.phase = 'wait'
    this.phaseEndsAt = this.scene.time.now + DEFENSE.WAIT_MS
    this.spawnedCount = 0
    this.waveTotal = n + DEFENSE.BASE_ZOMBIES
    this.waveRemaining = this.waveTotal
    this.emitState()
  }

  private startCombat() {
    this.phase = 'combat'
    this.phaseEndsAt = this.scene.time.now + DEFENSE.COMBAT_MS
    this.placing = false
    this.hidePlacementPreview()
    EventBus.emit(GameEvents.DEFENSE_PLACE_MODE, false)
    // 좀비 순차 스폰. 첫 마리는 아래에서 즉시 스폰하므로 타이머는 나머지(waveTotal-1)만 담당한다.
    // repeat=N은 콜백을 N+1회 실행하므로, 나머지 waveTotal-1회를 원하면 repeat=waveTotal-2.
    // (예전엔 repeat=waveTotal-1이라 타이머가 waveTotal회 + 즉시 1회 = waveTotal+1마리를 스폰,
    //  승리 조건(waveTotal 처치)은 1마리 남았는데 먼저 충족돼 조기 클리어되던 버그가 있었다.)
    this.spawnEvent = this.scene.time.addEvent({
      delay: DEFENSE.SPAWN_INTERVAL_MS,
      repeat: Math.max(0, this.waveTotal - 2),
      callback: () => this.spawnOne(),
    })
    // 첫 마리는 즉시
    this.spawnOne()
    this.emitState()
  }

  private spawnOne() {
    if (this.phase !== 'combat') return
    const x = this.worldWidth - DEFENSE.SPAWN_X_OFFSET
    this.spawner.spawnAt('zombie_defense', x, x - 30, x + 20, (m) => this.onZombieDied(m))
    this.spawnedCount += 1
  }

  private onZombieDied(_m: Monster) {
    this.waveRemaining -= 1
    this.emitState()
    if (this.phase === 'combat' && this.waveRemaining <= 0) this.victory()
  }

  private victory() {
    this.phase = 'victory'
    this.spawnEvent?.remove()
    this.spawnEvent = undefined
    this.emitState()
    this.scene.time.delayedCall(DEFENSE.VICTORY_DELAY_MS, () => {
      if (this.phase === 'victory') this.startStage(this.stage + 1)
    })
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

  // ---- 구조물(기지/바리케이트) ----

  private addStructure(
    x: number, hp: number, isBase: boolean, texKey: string, dispW: number, dispH: number, bodyW: number,
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
    const s: Structure = { spr, hpBar, hp, maxHp: hp, isBase, barW }
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

  /** 이 위치에 지금 바리케이트를 설치할 수 있는가 (대기 단계 + 배치 모드 + 배치존 안 + 골드 충분). */
  private canPlaceAt(worldX: number): boolean {
    if (this.phase !== 'wait' || !this.placing) return false
    if (worldX < this.placeMinX() || worldX > this.placeMaxX()) return false
    return useGameStore.getState().gold >= DEFENSE.BARRICADE_COST
  }

  /** 바리케이트 설치 (대기 단계 + 배치 모드 + 골드 충분 + 배치존 안). GameScene 포인터에서 호출. */
  placeBarricade(worldX: number): boolean {
    if (!this.canPlaceAt(worldX)) return false
    const gold = useGameStore.getState().gold
    useGameStore.getState().setStats({ gold: gold - DEFENSE.BARRICADE_COST })
    this.addStructure(worldX, DEFENSE.BARRICADE_HP, false, 'img_barricade', 44, 64, 40)
    this.placing = false
    this.hidePlacementPreview()
    EventBus.emit(GameEvents.DEFENSE_PLACE_MODE, false)
    return true
  }

  /** 배치 미리보기 갱신 — 마우스(월드 x) 위치에 반투명 바리케이트를 그려 설치 지점을 예고한다.
   *  배치존 밖/골드 부족이면 붉게, 설치 가능하면 초록빛으로 표시한다. */
  updatePlacementPreview(worldX: number) {
    if (!this.placing || this.phase !== 'wait') { this.hidePlacementPreview(); return }
    if (!this.ghost) {
      // origin을 밑변(0.5,1)에 둬 y=groundY면 실제 설치될 바리케이트와 바닥 정렬이 같다.
      this.ghost = this.scene.add.image(0, 0, 'img_barricade')
        .setOrigin(0.5, 1).setDisplaySize(44, 64).setDepth(6)
    }
    // 배치존을 벗어나도 고스트는 실제 커서 위치에 그려 "여긴 안 됨"을 색으로 알린다(범위 안내).
    const shownX = Phaser.Math.Clamp(worldX, this.placeMinX() - 40, this.placeMaxX() + 40)
    const valid = this.canPlaceAt(worldX)
    this.ghost.setVisible(true).setPosition(shownX, this.groundY)
      .setAlpha(valid ? 0.55 : 0.4).setTint(valid ? 0x8affa0 : 0xff6b6b)
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
