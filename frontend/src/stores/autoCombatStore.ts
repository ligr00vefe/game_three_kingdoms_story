import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type CombatPolicy = 'nearest' | 'defense' | 'elite' | 'danger' | 'survival'

interface AutoCombatState {
  enabled: boolean
  policy: CombatPolicy
  autoSkill: boolean
  minMpPercent: number
  minEnemyCount: number
  reserveSkillForBoss: boolean
  quickHelpVisible: boolean
  setEnabled: (enabled: boolean) => void
  setPolicy: (policy: CombatPolicy) => void
  setAutoSkill: (enabled: boolean) => void
  setMinMpPercent: (value: number) => void
  setMinEnemyCount: (value: number) => void
  setReserveSkillForBoss: (enabled: boolean) => void
  setQuickHelpVisible: (visible: boolean) => void
}

export const useAutoCombatStore = create<AutoCombatState>()(
  persist(
    (set) => ({
      enabled: false,
      policy: 'nearest',
      autoSkill: false,
      minMpPercent: 70,
      minEnemyCount: 3,
      reserveSkillForBoss: false,
      quickHelpVisible: true,
      setEnabled: (enabled) => set({ enabled }),
      setPolicy: (policy) => set({ policy }),
      setAutoSkill: (autoSkill) => set({ autoSkill }),
      setMinMpPercent: (minMpPercent) => set({ minMpPercent }),
      setMinEnemyCount: (minEnemyCount) => set({ minEnemyCount }),
      setReserveSkillForBoss: (reserveSkillForBoss) => set({ reserveSkillForBoss }),
      setQuickHelpVisible: (quickHelpVisible) => set({ quickHelpVisible }),
    }),
    { name: 'tks-auto-combat-v1' },
  ),
)
