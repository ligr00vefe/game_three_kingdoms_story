import { unsupported, validateCommand, type GuanYuCommand } from './commands'

/** 공백/문장부호/호칭 차이를 흡수한다. 단어 자체가 다른 동의어 해석은 후속 로컬 모델이 담당한다. */
export function normalizeCommandText(input: string): string {
  return input
    .normalize('NFKC')
    .toLowerCase()
    .replace(/(관우야|관우 장군|장군|여보게)/g, '')
    .replace(/[\s\p{P}\p{S}]+/gu, '')
    .replace(/(해주세요|해주시오|해주게|해줘|하시오|해라|하라|하게)$/g, '')
}

function hasAny(text: string, words: readonly string[]) {
  return words.some((word) => text.includes(word))
}

/**
 * 비용이 전혀 들지 않는 1차 파서.
 * 명확한 명령과 고정 게임 지식만 처리하며, 애매한 입력을 억지로 실행하지 않는다.
 */
export function parseLocalCommand(input: string): GuanYuCommand {
  const text = normalizeCommandText(input)
  if (hasAny(text, ['아이템줍', '아이템주워', '동전줍', '동전주워', '돈주워', '돈줍'])) {
    return validateCommand({
      action: 'PICKUP_ITEM', priority: 'NORMAL',
      reply: '주변의 아이템과 동전을 줍겠습니다.',
    })
  }
  if (hasAny(text, ['방벽뒤', '바리케이드뒤', '바리케이트뒤']) &&
      hasAny(text, ['수비', '방어', '지켜', '대기', '싸', '전투', '공격'])) {
    return validateCommand({
      action: 'GUARD_BEHIND_BARRICADE', priority: 'HIGH',
      reply: '가까운 방벽 뒤에서 수비하겠습니다.',
    })
  }
  const skillNames: Array<[string, string]> = [
    ['돌격무쌍', 'skill_charge_slash'],
    ['용아일섬', 'skill_glaive_flurry'],
    ['창영난무', 'skill_decisive_strike'],
    ['백화연창', 'skill_dragon_slash'],
    ['비호관천', 'skill_lightning_descent'],
  ]
  const requestedSkill = skillNames.find(([name]) => text.includes(name))
  if (requestedSkill) {
    return validateCommand({
      action: 'USE_SKILL', targetId: requestedSkill[1], priority: 'HIGH',
      reply: `${requestedSkill[0]}을(를) 사용하겠습니다.`,
    })
  }
  const rush = hasAny(text, ['빨리', '빠르게', '대쉬', '대시', '전력'])
  if (rush && hasAny(text, ['마을', '본진', '성으로', '돌아'])) {
    return validateCommand({
      action: 'RUSH_TO', targetId: 'main_castle', priority: 'HIGH',
      reply: '대시를 섞어 본진으로 빠르게 돌아가겠습니다.',
    })
  }
  if (rush && hasAny(text, ['가', '이동', '전진', '앞'])) {
    return validateCommand({
      action: 'RUSH_TO', targetId: 'forward', priority: 'HIGH',
      reply: '대시를 섞어 빠르게 이동하겠습니다.',
    })
  }
  if (!text) return unsupported('EMPTY_INPUT', '명령을 말씀해 주십시오.')

  if (hasAny(text, ['전직', '승급', '직책'])) {
    return validateCommand({
      action: 'ANSWER_GAME_QUESTION', priority: 'LOW',
      reply: '동탁에게 가면 직책을 받을 수 있을 듯합니다.',
    })
  }
  if (hasAny(text, ['상태', '체력', '생명력', '보고'])) {
    return validateCommand({ action: 'STATUS', priority: 'LOW', reply: '현재 상태를 보고드리겠습니다.' })
  }
  if (hasAny(text, ['하늘을날', '비행', '폭격'])) {
    return unsupported('ABILITY_NOT_AVAILABLE', '소장은 그런 술법을 쓸 수 없습니다. 전투에 관한 명을 내려주십시오.')
  }
  if (hasAny(text, ['바리케이트', '방벽', '방책']) && hasAny(text, ['설치', '세워', '놓아', '배치'])) {
    return validateCommand({
      action: 'PLACE_BARRICADE', targetId: 'in_front_of_character', priority: 'HIGH',
      reply: '전방에 방벽을 설치하겠습니다.',
    })
  }
  if (hasAny(text, ['디펜스아레나', '방어전장', '좀비디펜스'])) {
    return validateCommand({
      action: 'MOVE_TO', targetId: 'defense_arena', priority: 'HIGH',
      reply: '성문으로 이동해 디펜스 아레나에 진입하겠습니다.',
    })
  }
  if (hasAny(text, ['성밖', '성외곽'])) {
    const fightAfterMove = hasAny(text, ['싸', '전투', '공격', '적을', '처치'])
    return validateCommand({
      action: 'MOVE_TO', targetId: fightAfterMove ? 'outside_combat' : 'castle_model_02', priority: 'HIGH',
      reply: fightAfterMove ? '성 밖으로 나가 적과 싸우겠습니다.' : '성 밖으로 이동하겠습니다.',
    })
  }
  if (hasAny(text, ['점프', '뛰어', '도약'])) {
    return validateCommand({ action: 'JUMP', priority: 'NORMAL', reply: '도약하겠습니다.' })
  }
  if (hasAny(text, ['수성최우선', '수성을최우선', '성을먼저지켜', '성방어최우선', '성부터지켜'])) {
    return validateCommand({
      action: 'PRIORITIZE_CASTLE_DEFENSE', targetId: 'castle_gate', priority: 'HIGH',
      reply: '성문 주변을 벗어나지 않고 수성을 최우선으로 하겠습니다.',
    })
  }
  if (hasAny(text, ['놓친적', '지나간적', '새어간적', '침투한적', '성으로가는적', '성쪽으로가는적']) &&
      hasAny(text, ['쫓아', '쫒아', '추격', '잡아', '섬멸'])) {
    return validateCommand({
      action: 'ELIMINATE_CASTLE_INFILTRATORS', priority: 'HIGH',
      reply: '성을 향해 침투하는 적을 끝까지 섬멸하겠습니다.',
    })
  }
  if ((hasAny(text, ['정지', '제자리', '여기서', '이자리']) && hasAny(text, ['싸', '전투', '공격'])) ||
      (hasAny(text, ['대기']) && hasAny(text, ['싸', '전투']))) {
    return validateCommand({
      action: 'HOLD_AND_ATTACK', targetId: 'current_position', priority: 'HIGH',
      reply: '이 자리를 벗어나지 않고 싸우겠습니다.',
    })
  }
  if (hasAny(text, ['동탁']) && hasAny(text, ['찾아', '가서', '만나', '말걸', '대화'])) {
    return validateCommand({
      action: 'TALK_TO_NPC', targetId: 'npc_castle_lord', priority: 'NORMAL',
      reply: '동탁을 찾아가 용무를 묻겠습니다.',
    })
  }

  const mentionsGate = hasAny(text, ['성문', '문앞', '성앞'])
  const guard = hasAny(text, ['지켜', '방어', '사수'])
  if (guard && hasAny(text, ['성', '성문', '본진', '수성'])) {
    return validateCommand({
      action: 'PRIORITIZE_CASTLE_DEFENSE', targetId: 'castle_gate', priority: 'HIGH',
      reply: '성문으로 이동해 성을 지키겠습니다.',
    })
  }
  if (guard) {
    return validateCommand({
      action: 'GUARD_POSITION', targetId: mentionsGate ? 'castle_gate' : 'current_position',
      priority: mentionsGate ? 'HIGH' : 'NORMAL',
      reply: mentionsGate ? '성문 앞으로 복귀해 방어하겠습니다.' : '이곳을 지키겠습니다.',
    })
  }
  if (hasAny(text, ['성으로', '본진', '복귀', '집으로', '마을로']) && hasAny(text, ['돌아', '가', '와', '복귀'])) {
    return validateCommand({
      action: 'RETURN_TO_BASE', targetId: 'main_castle', priority: 'HIGH',
      reply: '명을 받들어 성으로 복귀하겠습니다.',
    })
  }
  if (hasAny(text, ['후퇴', '물러', '뒤로빠', '퇴각'])) {
    return validateCommand({ action: 'RETREAT', priority: 'HIGH', reply: '대열을 정비하며 물러나겠습니다.' })
  }
  if (hasAny(text, ['멈춰', '정지', '가만히', '대기'])) {
    return validateCommand({ action: 'HOLD', priority: 'HIGH', reply: '이 자리에서 대기하겠습니다.' })
  }
  // 공격적 전진은 단순 이동보다 먼저 판정한다.
  if (hasAny(text, ['돌진', '돌격', '돌파', '진격', '밀어붙']) ||
      (hasAny(text, ['앞으로', '전방으로', '전진']) && hasAny(text, ['싸', '공격', '적을', '쓸어']))) {
    return validateCommand({
      action: 'ADVANCE_AND_ATTACK', targetId: 'forward', priority: 'NORMAL',
      reply: '전방의 적을 돌파하겠습니다.',
    })
  }
  if (hasAny(text, ['앞으로', '전방으로', '오른쪽으로', '우측으로', '전진']) &&
      hasAny(text, ['가', '와', '이동', '나아', '전진'])) {
    return validateCommand({
      action: 'MOVE_TO', targetId: 'forward', priority: 'NORMAL',
      reply: '앞으로 이동하겠습니다.',
    })
  }
  if (hasAny(text, ['뒤로', '왼쪽으로', '좌측으로', '후방으로']) && hasAny(text, ['가', '와', '이동'])) {
    return validateCommand({
      action: 'MOVE_TO', targetId: 'backward', priority: 'NORMAL',
      reply: '뒤로 이동하겠습니다.',
    })
  }
  if (hasAny(text, ['계속싸', '싸워', '전투', '공격'])) {
    return validateCommand({ action: 'CONTINUE_AUTO_COMBAT', priority: 'NORMAL', reply: '적을 찾아 물리치겠습니다.' })
  }

  return unsupported('LOCAL_PARSER_NO_MATCH')
}
