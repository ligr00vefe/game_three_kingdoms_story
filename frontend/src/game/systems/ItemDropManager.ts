import Phaser from 'phaser'
import { EventBus, GameEvents } from '../EventBus'
import { useGameStore } from '../../stores/gameStore'
import { useInventoryStore } from '../../stores/inventoryStore'

export interface DropDef {
  code: string
  chance: number
  min?: number
  max?: number
}

interface Dropped extends Phaser.Physics.Arcade.Sprite {
  itemCode?: string
  quantity?: number
  expiresAt?: number
}

const ICON_BY_CODE: Record<string, string> = {
  coin: 'icon_coin',
  consume_hp_potion_s: 'icon_hp_potion_s',
  etc_yellow_turban_scrap: 'icon_turban_scrap',
  artifact_red_hare_shoe: 'icon_red_hare_shoe',
  equip_yellow_turban_cap: 'icon_turban_cap',
}

const EXPIRE_MS = 60_000 // 드랍 60초 후 소멸 (GAME_DESIGN 8.1)

/**
 * 바닥 드랍 아이템 (GAME_DESIGN 8.1): 통통 튀는 연출, 동전 자동 획득, Z 줍기.
 * 스프라이트는 풀링 재사용 (DEVELOPMENT_PLAN 문제 1).
 */
export class ItemDropManager {
  private scene: Phaser.Scene
  private group: Phaser.Physics.Arcade.Group

  constructor(scene: Phaser.Scene, collideWith: Phaser.Physics.Arcade.StaticGroup[]) {
    this.scene = scene
    this.group = scene.physics.add.group({ maxSize: 40, bounceY: 0.45, bounceX: 0.3 })
    for (const g of collideWith) scene.physics.add.collider(this.group, g)
  }

  /** 몬스터 처치 시 드랍 테이블 판정 */
  rollDrops(x: number, y: number, drops: DropDef[]) {
    for (const d of drops) {
      if (Math.random() > d.chance) continue
      const qty = d.min !== undefined ? Phaser.Math.Between(d.min, d.max ?? d.min) : 1
      this.spawn(x, y, d.code, qty)
    }
  }

  private spawn(x: number, y: number, code: string, quantity: number) {
    const icon = ICON_BY_CODE[code] ?? 'icon_coin'
    let item = this.group.getFirstDead(false) as Dropped | null
    if (!item) {
      if (this.group.getLength() >= 40) return
      item = this.group.create(x, y, icon) as Dropped
      item.setSize(20, 20)
    }
    item.setActive(true).setVisible(true)
    item.enableBody(true, x + Phaser.Math.Between(-12, 12), y - 10, true, true)
    item.setTexture(icon)
    item.setDisplaySize(28, 28) // 실제 아트(예: coin 962px)를 아이콘 규격으로 축소 — 물리 바디(setSize)와 별개
    item.itemCode = code
    item.quantity = quantity
    item.expiresAt = this.scene.time.now + EXPIRE_MS
    // 통통 튀며 떨어짐
    item.setVelocity(Phaser.Math.Between(-60, 60), Phaser.Math.Between(-260, -180))
  }

  /** 매 프레임: 만료 처리 + 동전 자동 획득 + Z 줍기 (GAME_DESIGN 8.1) */
  update(playerX: number, playerY: number, pickupPressed: boolean, now: number) {
    const children = this.group.getChildren() as Dropped[]
    for (let i = 0; i < children.length; i++) {
      const item = children[i]
      if (!item.active) continue

      if (now >= (item.expiresAt ?? 0)) {
        this.despawn(item)
        continue
      }
      const dx = Math.abs(item.x - playerX)
      const dy = Math.abs(item.y - playerY)
      const overlapping = dx < 34 && dy < 44

      if (item.itemCode === 'coin') {
        if (overlapping) this.collectCoin(item) // 동전은 자동 획득
      } else if (pickupPressed && overlapping) {
        this.collectItem(item)
      }
    }
  }

  private collectCoin(item: Dropped) {
    const s = useGameStore.getState()
    s.setStats({ gold: s.gold + (item.quantity ?? 1) })
    EventBus.emit(GameEvents.ITEM_PICKED, { code: 'coin', quantity: item.quantity ?? 1, x: item.x, y: item.y })
    this.despawn(item)
  }

  private collectItem(item: Dropped) {
    const ok = useInventoryStore.getState().addItem(item.itemCode!, item.quantity ?? 1)
    if (!ok) return // 인벤토리 가득 — 바닥에 남김
    EventBus.emit(GameEvents.ITEM_PICKED, { code: item.itemCode, quantity: item.quantity ?? 1, x: item.x, y: item.y })
    this.despawn(item)
  }

  private despawn(item: Dropped) {
    item.disableBody(true, true)
    item.setActive(false).setVisible(false)
  }
}
