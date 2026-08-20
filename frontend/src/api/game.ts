import { api } from './client'
import { EventBus, GameEvents } from '../game/EventBus'
import { useGameStore } from '../stores/gameStore'
import { useInventoryStore, INVENTORY_SIZE } from '../stores/inventoryStore'
import type { ItemDef, ItemType } from '../stores/inventoryStore'
import { useScreenStore } from '../stores/screenStore'
import { getFirstSkillForCharacter, getSkillsForCharacter, useSkillStore } from '../stores/skillStore'
import { QUICKSLOT_COUNT, useQuickslotStore } from '../stores/quickslotStore'
import { useAuthStore } from '../stores/authStore'
import { CHARACTERS } from '../data/characters'

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
    attackPower: number; gold: number; stageCode: string; defenseStage: number
    positionX: number | null; positionY: number | null
  }
  inventory: ServerInventoryItem[]
  itemDefinitions: ServerItemDef[]
  quickslots: { slotIndex: number; kind: 'item' | 'skill'; code: string }[]
}

export async function loadCharacterSummary(characterCode: string): Promise<GameStateResponse['character']> {
  const { data } = await api.get<GameStateResponse>('/game/state', { params: { characterCode, summary: true } })
  return data.character
}

/** 접속 시 서버 상태 로드 → 스토어 하이드레이트 (첫 Phaser↔React↔서버 3자 연동) */
export async function loadGameState(): Promise<void> {
  const characterCode = useScreenStore.getState().selectedCharacter
  const { data } = await api.get<GameStateResponse>('/game/state', { params: { characterCode } })
  const c = data.character
  useGameStore.getState().setStats({
    // The selected character definition is authoritative for UI identity. This
    // also corrects legacy Zhao Yun rows that may still contain Guan Yu's name.
    characterName: CHARACTERS[characterCode]?.name ?? c.name,
    level: c.level, exp: c.exp,
    maxHp: c.maxHp, hp: c.hp, maxMp: c.maxMp, mp: c.mp,
    // 서버 값에는 레벨업·보상 강화가 누적되어 있으므로 기본 스탯으로 덮어쓰지 않는다.
    attackPower: c.attackPower, gold: c.gold,
    stageCode: c.stageCode, defenseStage: c.defenseStage,
    playerX: c.positionX, playerY: c.positionY,
  })
  // 스킬 데이터는 계정+캐릭터별로 분리하고 현재 레벨보다 높은 스킬을 반드시 잠근다.
  const accountId = useAuthStore.getState().user?.accountId
  if (accountId !== undefined) {
    useSkillStore.getState().loadCharacterProfile(accountId, characterCode, c.level)
  } else {
    useSkillStore.getState().unlockScheduled(c.level)
  }
  const defs: ItemDef[] = data.itemDefinitions.map((d) => ({
    code: d.code, name: d.name, itemType: d.itemType, iconKey: d.iconKey,
    effect: d.effectJson ? JSON.parse(d.effectJson) : null,
    description: d.description ?? '',
  }))
  useInventoryStore.getState().hydrate(data.inventory, defs)
  const quickslots = Array(QUICKSLOT_COUNT).fill(null)
  const allowedSkillCodes = new Set(getSkillsForCharacter(characterCode).map((skill) => skill.code))
  let validQuickslotCount = 0
  for (const slot of data.quickslots ?? []) {
    if (slot.slotIndex >= 0 && slot.slotIndex < QUICKSLOT_COUNT) {
      if (slot.kind === 'skill' && !allowedSkillCodes.has(slot.code)) continue
      quickslots[slot.slotIndex] = { kind: slot.kind, code: slot.code }
      validQuickslotCount += 1
    }
  }

  // 각 캐릭터를 처음 플레이할 때 첫 액티브 스킬을 1번 슬롯에 자동 배치한다.
  // 계정·캐릭터별 초기화 표식을 남겨 사용자가 이후 슬롯을 비워도 다시 강제 등록하지 않는다.
  const defaultSkill = getFirstSkillForCharacter(characterCode)
  if (accountId !== undefined && defaultSkill) {
    const initializedKey = `tks-quickslot-default-v1-${accountId}-${characterCode}`
    let initialized = false
    try {
      initialized = localStorage.getItem(initializedKey) === '1'
    } catch {
      // 저장소 접근이 막혀도 서버 슬롯을 불러오는 기본 흐름은 유지한다.
    }
    if (!initialized && validQuickslotCount === 0) {
      quickslots[0] = { kind: 'skill', code: defaultSkill.code }
    }
    if (!initialized) {
      try { localStorage.setItem(initializedKey, '1') } catch { /* 다음 서버 저장으로도 기본 배치는 유지된다. */ }
    }
  }
  useQuickslotStore.getState().hydrate(quickslots)
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
    stageCode: g.stageCode, defenseStage: g.defenseStage,
    positionX: g.playerX, positionY: g.playerY,
    inventory,
    quickslots: useQuickslotStore.getState().slots.flatMap((entry, slotIndex) =>
      entry ? [{ slotIndex, kind: entry.kind, code: entry.code }] : []),
  }
}

export async function saveGameState(): Promise<void> {
  const characterCode = useScreenStore.getState().selectedCharacter
  await api.post('/game/state', buildSaveRequest(), { params: { characterCode } })
}

/** 탭/브라우저 종료 직전에도 마지막 좌표를 전송한다. */
function saveGameStateOnExit() {
  if (useGameStore.getState().serverStatus !== 'ok') return
  const characterCode = encodeURIComponent(useScreenStore.getState().selectedCharacter)
  const body = new Blob([JSON.stringify(buildSaveRequest())], { type: 'application/json' })
  navigator.sendBeacon(`/api/game/state?characterCode=${characterCode}`, body)
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
  const saveMapChange = () => {
    if (useGameStore.getState().serverStatus === 'ok') void saveGameState().catch(() => {})
  }
  document.addEventListener('visibilitychange', onHide)
  window.addEventListener('pagehide', saveGameStateOnExit)

  // 주요 이벤트 직후 저장 (1초 디바운스 — 연속 레벨업 대비)
  let eventSaveTimer: ReturnType<typeof setTimeout> | null = null
  const saveSoon = () => {
    if (useGameStore.getState().serverStatus !== 'ok') return
    if (eventSaveTimer) clearTimeout(eventSaveTimer)
    eventSaveTimer = setTimeout(() => void saveGameState().catch(() => {}), 1000)
  }
  EventBus.on(GameEvents.LEVEL_UP, saveSoon)
  EventBus.on(GameEvents.PLAYER_DIED, saveSoon)
  EventBus.on(GameEvents.DEFENSE_STATE, saveSoon)
  EventBus.on(GameEvents.MAP_CHANGED, saveMapChange)
  EventBus.on(GameEvents.QUICKSLOTS_CHANGED, saveMapChange)

  return () => {
    clearInterval(timer)
    document.removeEventListener('visibilitychange', onHide)
    window.removeEventListener('pagehide', saveGameStateOnExit)
    if (eventSaveTimer) clearTimeout(eventSaveTimer)
    EventBus.off(GameEvents.LEVEL_UP, saveSoon)
    EventBus.off(GameEvents.PLAYER_DIED, saveSoon)
    EventBus.off(GameEvents.DEFENSE_STATE, saveSoon)
    EventBus.off(GameEvents.MAP_CHANGED, saveMapChange)
    EventBus.off(GameEvents.QUICKSLOTS_CHANGED, saveMapChange)
  }
}
