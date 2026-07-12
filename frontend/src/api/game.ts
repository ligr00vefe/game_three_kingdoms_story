import { api } from './client'
import { EventBus, GameEvents } from '../game/EventBus'
import { useGameStore } from '../stores/gameStore'
import { useInventoryStore, INVENTORY_SIZE } from '../stores/inventoryStore'
import type { ItemDef, ItemType } from '../stores/inventoryStore'

interface ServerItemDef {
  code: string
  name: string
  itemType: ItemType
  iconKey: string
  effectJson: string | null
  description: string | null
}

interface ServerInventoryItem {
  itemCode: string
  quantity: number
  slotIndex: number
  equipped: boolean
}

interface GameStateResponse {
  character: {
    name: string; level: number; exp: number
    maxHp: number; hp: number; maxMp: number; mp: number
    attackPower: number; gold: number; stageCode: string
  }
  inventory: ServerInventoryItem[]
  itemDefinitions: ServerItemDef[]
}

/** 접속 시 서버 상태 로드 → 스토어 하이드레이트 (첫 Phaser↔React↔서버 3자 연동) */
export async function loadGameState(): Promise<void> {
  const { data } = await api.get<GameStateResponse>('/game/state')
  const c = data.character
  useGameStore.getState().setStats({
    level: c.level, exp: c.exp,
    maxHp: c.maxHp, hp: c.hp, maxMp: c.maxMp, mp: c.mp,
    attackPower: c.attackPower, gold: c.gold,
  })
  const defs: ItemDef[] = data.itemDefinitions.map((d) => ({
    code: d.code, name: d.name, itemType: d.itemType, iconKey: d.iconKey,
    effect: d.effectJson ? JSON.parse(d.effectJson) : null,
    description: d.description ?? '',
  }))
  useInventoryStore.getState().hydrate(data.inventory, defs)
}

function buildSaveRequest() {
  const g = useGameStore.getState()
  const inv = useInventoryStore.getState()
  const inventory: ServerInventoryItem[] = []
  for (let i = 0; i < INVENTORY_SIZE; i++) {
    const s = inv.slots[i]
    if (s) inventory.push({ itemCode: s.code, quantity: s.quantity, slotIndex: i, equipped: s.equipped })
  }
  return {
    level: g.level, exp: g.exp,
    maxHp: g.maxHp, hp: g.hp, maxMp: g.maxMp, mp: g.mp,
    attackPower: g.attackPower, gold: g.gold,
    inventory,
  }
}

export async function saveGameState(): Promise<void> {
  await api.post('/game/state', buildSaveRequest())
}

/**
 * 자동 저장: 10초 주기 + 탭 이탈 시 + 주요 이벤트(레벨업/사망) 직후 (Phase 5).
 * @returns 정리 함수
 */
export function startAutosave(intervalMs = 10_000): () => void {
  const timer = setInterval(() => {
    if (useGameStore.getState().serverStatus === 'ok') void saveGameState().catch(() => {})
  }, intervalMs)
  const onHide = () => {
    // 로드 완료(ok) 전에는 기본값을 저장해버리지 않도록 가드
    if (document.visibilityState === 'hidden' && useGameStore.getState().serverStatus === 'ok') {
      void saveGameState().catch(() => {})
    }
  }
  document.addEventListener('visibilitychange', onHide)

  // 주요 이벤트 직후 저장 (1초 디바운스 — 연속 레벨업 대비)
  let eventSaveTimer: ReturnType<typeof setTimeout> | null = null
  const saveSoon = () => {
    if (useGameStore.getState().serverStatus !== 'ok') return
    if (eventSaveTimer) clearTimeout(eventSaveTimer)
    eventSaveTimer = setTimeout(() => void saveGameState().catch(() => {}), 1000)
  }
  EventBus.on(GameEvents.LEVEL_UP, saveSoon)
  EventBus.on(GameEvents.PLAYER_DIED, saveSoon)

  return () => {
    clearInterval(timer)
    document.removeEventListener('visibilitychange', onHide)
    if (eventSaveTimer) clearTimeout(eventSaveTimer)
    EventBus.off(GameEvents.LEVEL_UP, saveSoon)
    EventBus.off(GameEvents.PLAYER_DIED, saveSoon)
  }
}
