/**
 * 대기실(캐릭터 선택) 캐릭터 정의.
 * 지금은 관우만 선택 가능 — 장비/조운/하후돈 등은 슬롯만 예약 (comingSoon).
 * 능력치는 gameStore/config.PROGRESSION 초기값과 일치해야 한다.
 */
export interface CharacterDef {
  code: string
  name: string
  /** 병과 표기 (메이플의 직업명 위치) */
  clazz: string
  desc: string
  stats: { hp: number; mp: number; attack: number; speedPct: number }
  skill: { name: string; desc: string }
}

export const CHARACTERS: Record<string, CharacterDef> = {
  guanwu: {
    code: 'guanwu',
    name: '관우',
    clazz: '언월도 무장',
    desc: '무명소졸에서 시작해 무신(武神)에 이르는 촉나라의 맹장. 직책이 오를 때마다 외형과 스킬이 성장한다.',
    stats: { hp: 100, mp: 50, attack: 10, speedPct: 100 },
    skill: { name: '참마돌격', desc: '전방 돌진 베기 — 무명소졸(Lv2)에 해금되는 첫 스킬. 이후 언월난무·일격필살·청룡참·뇌신강림이 직책을 따라 순차 해금.' },
  },
}

/**
 * 대기실 슬롯 배열: 캐릭터 코드 | null(빈 자리 — 추후 캐릭터가 들어갈 자리).
 * 순서는 군막사 배경의 의자 4개와 1:1로 대응한다 (CharacterSelect의 SEATS와 같은 순서).
 */
export const LOBBY_SLOTS: ({ type: 'char'; code: string } | null)[] = [
  { type: 'char', code: 'guanwu' }, // 안쪽 왼쪽 의자
  null, // 앞쪽 왼쪽 의자
  null, // 안쪽 오른쪽 의자
  null, // 앞쪽 오른쪽 의자
]
