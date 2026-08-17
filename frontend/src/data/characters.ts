/** Save-slot character data. Visual models are selected independently by modelCode. */
export interface CharacterDef {
  code: string
  modelCode: string
  name: string
  clazz: string
  desc: string
  stats: { hp: number; mp: number; attack: number; speedPct: number }
  /** Character-specific combat effect module. */
  skillStyle: 'guanwu' | 'zhaoyun' | 'none'
}

const GUANWU_STATS = { hp: 220, mp: 120, attack: 95, speedPct: 100 }
const ZHAOYUN_STATS = { hp: 200, mp: 150, attack: 90, speedPct: 120 }

export const CHARACTERS: Record<string, CharacterDef> = {
  guanwu: {
    code: 'guanwu', modelCode: 'guanwu_t2', name: '관우', clazz: '균형형 무장',
    desc: '유비와 생사를 함께한 의형제로 알려졌으며,\n만 명도 능히 상대한다 하여,\n‘만인지적(萬人之敵), 세지호신(世之虎臣)’이라 평가 받은 문무겸전의 명장.',
    stats: GUANWU_STATS, skillStyle: 'guanwu',
  },
  zhaoyun: {
    code: 'zhaoyun', modelCode: 'zhaoyun_t2', name: '조운', clazz: '기동형 무장',
    desc: '장판에서 유비의 아들을 구해낸 충의의 장수로,\n유비가 ‘일신시담(一身是膽), 온몸에 담력을 둘렀다’라 칭송할 만큼\n용맹과 침착함을 겸비한 무장.',
    stats: ZHAOYUN_STATS, skillStyle: 'zhaoyun',
  },
  lubu: {
    code: 'lubu', modelCode: 'lubu_t2', name: '여포', clazz: '강공형 무장',
    desc: '전장을 누비는 모습이 마치 날아다니는 듯하다 하여 ‘비장(飛將)’이라 불렸으며,\n‘마중적토, 인중여포’라 일컬어진 당대 최고의 맹장.',
    stats: { hp: 250, mp: 100, attack: 100, speedPct: 90 }, skillStyle: 'none',
  },
}

export type LobbySlot = { type: 'char'; code: string; name: string; locked?: boolean } | null

export const LOBBY_SLOTS: LobbySlot[] = [
  { type: 'char', code: 'guanwu', name: '관우' },
  { type: 'char', code: 'zhaoyun', name: '조운' },
  { type: 'char', code: 'lubu', name: '여포' },
  null,
]
