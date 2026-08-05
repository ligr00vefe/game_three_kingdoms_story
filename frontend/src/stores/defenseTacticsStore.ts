import { create } from 'zustand'
import type { CombatPolicy } from './autoCombatStore'
import { useAutoCombatStore } from './autoCombatStore'

export type DefenseTacticSlot = 1 | 2 | 3 | 4 | 5

export interface DefenseTactic {
  slot: DefenseTacticSlot
  name: string
  description: string
  policy: CombatPolicy
  autoSkill: boolean
  minMpPercent: number
  minEnemyCount: number
  reserveSkillForBoss: boolean
}

export const DEFENSE_TACTICS: readonly DefenseTactic[] = [
  { slot: 1, name: '돌격', description: '웨이브 소탕 후 성벽 복귀', policy: 'nearest', autoSkill: true, minMpPercent: 50, minEnemyCount: 2, reserveSkillForBoss: false },
  { slot: 2, name: '성벽 수비', description: '성에 접근한 적 우선', policy: 'defense', autoSkill: true, minMpPercent: 70, minEnemyCount: 3, reserveSkillForBoss: false },
  { slot: 3, name: '위험 제거', description: '위험한 적 우선', policy: 'danger', autoSkill: true, minMpPercent: 60, minEnemyCount: 2, reserveSkillForBoss: false },
  { slot: 4, name: '생존 우선', description: 'HP 35% 이하 후퇴', policy: 'survival', autoSkill: false, minMpPercent: 90, minEnemyCount: 3, reserveSkillForBoss: true },
  { slot: 5, name: '긴급 복귀', description: '성벽 앞으로 빠르게 복귀', policy: 'defense', autoSkill: true, minMpPercent: 70, minEnemyCount: 3, reserveSkillForBoss: false },
]

interface DefenseTacticsState {
  selectedSlot: DefenseTacticSlot
  selectTactic: (slot: DefenseTacticSlot) => void
}

export const useDefenseTacticsStore = create<DefenseTacticsState>((set) => ({
  selectedSlot: 2,
  selectTactic: (slot) => {
    const tactic = DEFENSE_TACTICS.find((candidate) => candidate.slot === slot)
    if (!tactic) return
    const auto = useAutoCombatStore.getState()
    auto.setEnabled(true)
    auto.setPolicy(tactic.policy)
    auto.setAutoSkill(tactic.autoSkill)
    auto.setMinMpPercent(tactic.minMpPercent)
    auto.setMinEnemyCount(tactic.minEnemyCount)
    auto.setReserveSkillForBoss(tactic.reserveSkillForBoss)
    set({ selectedSlot: slot })
  },
}))
