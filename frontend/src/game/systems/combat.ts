import Phaser from 'phaser'
import { COMBAT } from '../config'

/**
 * 데미지 계산 — 순수 함수 (GAME_DESIGN 4.4).
 * 추후 서버 권위 전환 시 백엔드 서비스 계층과 동일 규칙을 유지해야 하므로
 * 여기서만 계산하고 다른 곳에서 수식을 중복 구현하지 않는다 (DEVELOPMENT_PLAN 4.2).
 */
export interface DamageResult {
  amount: number
  crit: boolean
}

export function rollBasicDamage(attackPower: number, defense: number): DamageResult {
  return roll(attackPower * COMBAT.WEAPON_MULTIPLIER, defense)
}

export function rollSkillDamage(attackPower: number, defense: number): DamageResult {
  return roll(attackPower * COMBAT.WEAPON_MULTIPLIER * COMBAT.SKILL_MULTIPLIER, defense)
}

function roll(base: number, defense: number): DamageResult {
  const variance = Phaser.Math.FloatBetween(0.9, 1.1)
  const crit = Math.random() < COMBAT.CRIT_CHANCE
  const raw = base * variance * (crit ? COMBAT.CRIT_MULTIPLIER : 1)
  return { amount: Math.max(1, Math.round(raw - defense)), crit }
}
