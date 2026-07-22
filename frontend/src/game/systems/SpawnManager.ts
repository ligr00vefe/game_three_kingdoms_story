import Phaser from 'phaser'
import { Monster } from '../entities/Monster'
import type { MonsterDef } from '../entities/Monster'
import { SPAWN } from '../config'

interface SpawnArea {
  code: string
  xMin: number
  xMax: number
  max: number
  aliveCount: number
}

/**
 * 몬스터 스폰/리젠 (GAME_DESIGN 6.3): 지역당 최대 마릿수 유지,
 * 처치 후 5~10초 랜덤 리젠. 몬스터 인스턴스는 풀링으로 재사용.
 */
export class SpawnManager {
  private scene: Phaser.Scene
  private defs: Record<string, MonsterDef>
  private groundY: number
  readonly monsters: Monster[] = []
  private pool: Monster[] = []
  private areas: SpawnArea[] = []

  private collideWith: Phaser.Physics.Arcade.StaticGroup[]

  constructor(
    scene: Phaser.Scene,
    defs: Record<string, MonsterDef>,
    groundY: number,
    collideWith: Phaser.Physics.Arcade.StaticGroup[],
  ) {
    this.scene = scene
    this.defs = defs
    this.groundY = groundY
    this.collideWith = collideWith
  }

  registerArea(code: string, xMin: number, xMax: number, max: number) {
    const area: SpawnArea = { code, xMin, xMax, max, aliveCount: 0 }
    this.areas.push(area)
    for (let i = 0; i < max; i++) {
      // 첫 스폰은 시간차를 두고 순차 등장
      this.scene.time.delayedCall(400 + i * 500, () => this.spawnInto(area))
    }
  }

  /**
   * 지정 위치에 몬스터 1마리를 즉시 스폰하고 반환한다 (디펜스 웨이브용).
   * registerArea의 자동 리젠 경로를 타지 않고, 호출부(DefenseManager)가 onDied로 웨이브를 관리한다.
   * acquire를 재사용하므로 스폰된 몬스터는 spawner.monsters에 포함되어 전투 판정(resolveAttack)에 잡힌다.
   */
  spawnAt(code: string, x: number, xMin: number, xMax: number, onDied: (m: Monster) => void): Monster {
    const m = this.acquire(code)
    m.def = this.defs[code]
    m.onDied = onDied
    m.spawnAt(x, this.groundY, xMin, xMax, SPAWN.RISE_DURATION_MS)
    return m
  }

  private acquire(code: string): Monster {
    const idle = this.pool.pop()
    if (idle) return idle
    const m = new Monster(this.scene, this.defs[code])
    for (const group of this.collideWith) {
      this.scene.physics.add.collider(m, group)
    }
    this.monsters.push(m)
    return m
  }

  private spawnInto(area: SpawnArea) {
    const m = this.acquire(area.code)
    m.def = this.defs[area.code]
    const x = Phaser.Math.Between(area.xMin, area.xMax)
    m.onDied = (dead) => this.onMonsterDied(dead, area)
    m.spawnAt(x, this.groundY, area.xMin, area.xMax, SPAWN.RISE_DURATION_MS)
    area.aliveCount += 1
  }

  private onMonsterDied(m: Monster, area: SpawnArea) {
    area.aliveCount -= 1
    this.pool.push(m)
    const delay = Phaser.Math.Between(SPAWN.RESPAWN_MIN_MS, SPAWN.RESPAWN_MAX_MS)
    this.scene.time.delayedCall(delay, () => {
      if (area.aliveCount < area.max) this.spawnInto(area)
    })
  }
}
