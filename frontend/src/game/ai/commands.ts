/**
 * 관우가 실행할 수 있는 고수준 행동의 단일 명세.
 * 외부/로컬 모델을 붙이더라도 이 목록 밖의 행동은 게임 엔진이 거부한다.
 */
export const GUAN_YU_ACTIONS = [
  'CONTINUE_AUTO_COMBAT',
  'MOVE_TO',
  'RUSH_TO',
  'RETURN_TO_BASE',
  'GUARD_POSITION',
  'ADVANCE_AND_ATTACK',
  'ATTACK_TARGET',
  'FOLLOW_PLAYER',
  'RETREAT',
  'HOLD',
  'USE_SKILL',
  'PICKUP_ITEM',
  'JUMP',
  'PLACE_BARRICADE',
  'GUARD_BEHIND_BARRICADE',
  'HOLD_AND_ATTACK',
  'PURSUE_ENEMIES',
  'ELIMINATE_CASTLE_INFILTRATORS',
  'PRIORITIZE_CASTLE_DEFENSE',
  'TALK_TO_NPC',
  'STATUS',
  'ANSWER_GAME_QUESTION',
  'UNSUPPORTED',
] as const

export type GuanYuAction = (typeof GUAN_YU_ACTIONS)[number]
export type CommandPriority = 'LOW' | 'NORMAL' | 'HIGH'

export interface GuanYuCommand {
  action: GuanYuAction
  targetId?: string
  priority: CommandPriority
  reply: string
  reason?: string
}

const allowedActions = new Set<string>(GUAN_YU_ACTIONS)

/** 모델 출력도 반드시 이 검증기를 통과해야 한다. */
export function validateCommand(value: unknown): GuanYuCommand {
  if (!value || typeof value !== 'object') return unsupported('INVALID_COMMAND')
  const candidate = value as Partial<GuanYuCommand>
  if (!candidate.action || !allowedActions.has(candidate.action)) return unsupported('ACTION_NOT_ALLOWED')
  if (typeof candidate.reply !== 'string' || candidate.reply.trim().length === 0) {
    return unsupported('INVALID_REPLY')
  }
  return {
    action: candidate.action,
    targetId: typeof candidate.targetId === 'string' ? candidate.targetId : undefined,
    priority: candidate.priority === 'LOW' || candidate.priority === 'HIGH' ? candidate.priority : 'NORMAL',
    reply: candidate.reply.trim().slice(0, 80),
    reason: typeof candidate.reason === 'string' ? candidate.reason : undefined,
  }
}

export function unsupported(reason: string, reply = '명을 정확히 이해하지 못했습니다. 다시 말씀해 주십시오.'): GuanYuCommand {
  return { action: 'UNSUPPORTED', priority: 'NORMAL', reason, reply }
}
