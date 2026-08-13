/** Save-slot character data. Visual models are selected independently by modelCode. */
export interface CharacterDef {
  code: string
  modelCode: string
  name: string
  clazz: string
  desc: string
  stats: { hp: number; mp: number; attack: number; speedPct: number }
  skill: { name: string; desc: string }
}

const SHARED_STATS = { hp: 100, mp: 50, attack: 10, speedPct: 100 }
const GUANWU_SKILL = {
  name: '참마대격',
  desc: '전방 돌진 베기 후 무쌍난무(Lv2)로 이어지는 첫 무장 스킬.',
}

export const CHARACTERS: Record<string, CharacterDef> = {
  guanwu: {
    code: 'guanwu', modelCode: 'guanwu_t2', name: '관우', clazz: '촉한의 용장',
    desc: '청룡언월도를 휘두르는 촉한의 명장입니다.',
    stats: SHARED_STATS, skill: GUANWU_SKILL,
  },
  zhaoyun: {
    code: 'zhaoyun', modelCode: 'zhaoyun_t2', name: '조운', clazz: '촉한의 창장',
    desc: '날렵한 창술로 전장을 누비는 촉한의 명장입니다.',
    stats: SHARED_STATS,
    // Character-specific skills can replace this later without changing selection code.
    skill: GUANWU_SKILL,
  },
}

export type LobbySlot = { type: 'char'; code: string; name: string; locked?: boolean } | null

export const LOBBY_SLOTS: LobbySlot[] = [
  { type: 'char', code: 'guanwu', name: '관우' },
  { type: 'char', code: 'zhaoyun', name: '조운' },
  { type: 'char', code: 'lubu', name: '여포', locked: true },
  null,
]
