import { PROGRESSION } from '../config'
import { useGameStore } from '../../stores/gameStore'
import { useSkillStore } from '../../stores/skillStore'
import { EventBus, GameEvents } from '../EventBus'

/** GAME_DESIGN 5.1: 필요 경험치 = 100 × 1.2^(레벨-1) */
export function expToNext(level: number): number {
  return Math.round(PROGRESSION.BASE_EXP_TO_NEXT * Math.pow(PROGRESSION.EXP_GROWTH, level - 1))
}

/**
 * 경험치 획득 → 레벨업 처리. 상태의 단일 출처는 zustand store,
 * Phaser 연출은 LEVEL_UP 이벤트를 구독해서 재생한다.
 */
export function gainExp(exp: number) {
  const s = useGameStore.getState()
  let { level, exp: cur, maxHp, maxMp } = s
  let attack = s.attackPower
  cur += exp
  let levelsGained = 0

  while (cur >= expToNext(level)) {
    cur -= expToNext(level)
    level += 1
    maxHp += PROGRESSION.LEVELUP_HP_GAIN
    maxMp += PROGRESSION.LEVELUP_MP_GAIN
    attack += PROGRESSION.LEVELUP_ATK_GAIN
    levelsGained += 1
  }

  s.setStats({
    level, exp: cur, expToNext: expToNext(level), maxHp, maxMp, attackPower: attack,
    // 레벨업 시 HP/MP 전량 회복 (GAME_DESIGN 5.1)
    ...(levelsGained > 0 ? { hp: maxHp, mp: maxMp } : {}),
  })
  if (levelsGained > 0) {
    // 레벨업당 스킬 포인트 1 지급 + 직책 스케줄에 도달한 스킬 자동 해금 (character-progression-pivot)
    useSkillStore.getState().grantPoints(levelsGained)
    useSkillStore.getState().unlockScheduled(level)
    EventBus.emit(GameEvents.LEVEL_UP, level)
  }
}
