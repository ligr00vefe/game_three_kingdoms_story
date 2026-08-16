/** Save-slot character data. Visual models are selected independently by modelCode. */
export interface CharacterDef {
  code: string
  modelCode: string
  name: string
  clazz: string
  desc: string
  stats: { hp: number; mp: number; attack: number; speedPct: number }
  /** 전투 스킬 연출 모듈. 스킬 미구현 캐릭터는 none으로 명시한다. */
  skillStyle: 'guanwu' | 'zhaoyun' | 'none'
}

const BALANCED_STATS = { hp: 100, mp: 50, attack: 95, speedPct: 100 }
const MOBILE_STATS = { hp: 100, mp: 50, attack: 90, speedPct: 120 }
export const CHARACTERS: Record<string, CharacterDef> = {
  guanwu: {
    code: 'guanwu', modelCode: 'guanwu_t2', name: '관우', clazz: '균형형 무장',
    desc: '청룡언월도를 휘두르는 촉한의 명장입니다.',
    stats: BALANCED_STATS, skillStyle: 'guanwu',
  },
  zhaoyun: {
    code: 'zhaoyun', modelCode: 'zhaoyun_t2', name: '조운', clazz: '기동형 무장',
    desc: '날렵한 창술로 전장을 누비는 촉한의 명장입니다.',
    stats: MOBILE_STATS, skillStyle: 'zhaoyun',
  },
  lubu: {
    code: 'lubu', modelCode: 'lubu_t2', name: '여포', clazz: '강공형 무장',
    desc: '압도적인 힘으로 전장을 휩쓰는 강공형 무장입니다.',
    stats: { hp: 120, mp: 40, attack: 100, speedPct: 90 }, skillStyle: 'none',
  },
}

export type LobbySlot = { type: 'char'; code: string; name: string; locked?: boolean } | null

export const LOBBY_SLOTS: LobbySlot[] = [
  { type: 'char', code: 'guanwu', name: '관우' },
  { type: 'char', code: 'zhaoyun', name: '조운' },
  { type: 'char', code: 'lubu', name: '여포' },
  null,
]
