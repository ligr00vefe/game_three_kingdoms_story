export type RecoveryKind = 'hp' | 'mp'

const RECOVERY = {
  hp: { baseCost: 20, baseAmount: 40, costPerLevel: 8, amountPerLevel: 20 },
  mp: { baseCost: 15, baseAmount: 30, costPerLevel: 6, amountPerLevel: 15 },
} as const

/** 수동 구매와 AUTO 구매가 동일한 전장 보급소 가격·회복량을 사용한다. */
export function defenseRecovery(kind: RecoveryKind, supplyLevel: number) {
  const value = RECOVERY[kind]
  return {
    cost: value.baseCost + supplyLevel * value.costPerLevel,
    amount: value.baseAmount + supplyLevel * value.amountPerLevel,
  }
}
