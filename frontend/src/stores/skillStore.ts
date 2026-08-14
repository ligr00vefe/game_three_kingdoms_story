import { create } from 'zustand'

export interface SkillDef {
  code: string
  name: string
  icon: string
  iconImage?: string
  type: 'active' | 'passive'
  maxLevel: number
  unlockLevel: number
  desc: (lv: number) => string
}

export const SKILLS: SkillDef[] = [
  {
    code: 'skill_charge_slash', name: '돌격무쌍', icon: '🐎', type: 'active', maxLevel: 10, unlockLevel: 1,
    desc: (lv) => `전방으로 돌진하며 베기. 데미지 ${180 + lv * 20}%, MP 12, 쿨타임 8초.`,
  },
  {
    code: 'skill_glaive_flurry', name: '용아일섬', icon: '🐲', type: 'active', maxLevel: 10, unlockLevel: 7,
    desc: (lv) => `전방을 ${3 + Math.floor(lv / 4)}회 연속 타격. 타격당 데미지 ${90 + lv * 10}%, MP 20, 쿨타임 10초.`,
  },
  {
    code: 'skill_decisive_strike', name: '창영난무', icon: '🔱', type: 'active', maxLevel: 10, unlockLevel: 12,
    desc: (lv) => `전방 적 하나에 필살의 일격. 데미지 ${300 + lv * 30}%, 대상 HP 30% 이하면 데미지 2배. MP 25, 쿨타임 12초.`,
  },
  {
    code: 'skill_dragon_slash', name: '백화연창', icon: '🌸', type: 'active', maxLevel: 10, unlockLevel: 17,
    desc: (lv) => `전방 광역 참격. 데미지 ${250 + lv * 25}%, MP 15, 쿨타임 5초.`,
  },
  {
    code: 'skill_lightning_descent', name: '비호관천', icon: '🐯', type: 'active', maxLevel: 10, unlockLevel: 22,
    desc: (lv) => `하늘에서 뇌신의 벼락을 소환해 광역을 강타한다. 데미지 ${400 + lv * 40}%, MP 40, 쿨타임 25초.`,
  },
]

/** 관우는 기존 스킬명과 아이콘을 유지한다. 스킬 코드/레벨 저장 키는 공유하되 표시 프로필은 캐릭터별로 분리한다. */
const GUANWU_SKILLS: SkillDef[] = SKILLS.map((skill, index) => [
  { code: skill.code, name: '참마돌격', icon: '⚔️' },
  { code: skill.code, name: '언월난무', icon: '🌙' },
  { code: skill.code, name: '일격필살', icon: '💀' },
  { code: skill.code, name: '청룡참', icon: '🐉' },
  { code: skill.code, name: '뇌신강림', icon: '🌩️' },
][index]).map((visual, index) => ({ ...SKILLS[index], ...visual }))

export function getSkillsForCharacter(characterCode: string) {
  return characterCode === 'zhaoyun' ? SKILLS : GUANWU_SKILLS
}

interface SavedSkillProfile {
  levels: Record<string, number>
  points: number
}

interface SkillState extends SavedSkillProfile {
  profileKey: string | null
  addPoint: (code: string) => boolean
  removePoint: (code: string) => boolean
  grantPoints: (n: number) => void
  unlockScheduled: (characterLevel: number) => void
  /** 로그인 계정과 캐릭터별 스킬 데이터를 불러오고 현재 레벨에 맞게 잠금 상태를 교정한다. */
  loadCharacterProfile: (accountId: number, characterCode: string, characterLevel: number) => void
}

const INITIAL_LEVELS: Record<string, number> = Object.fromEntries(
  SKILLS.map((skill) => [skill.code, 1]),
)

const storageKey = (profileKey: string) => `tks-skills-v3-${profileKey}`

function saveProfile(profileKey: string | null, levels: Record<string, number>, points: number) {
  if (!profileKey) return
  localStorage.setItem(storageKey(profileKey), JSON.stringify({ levels, points }))
}

function levelsForCharacter(saved: Record<string, number>, _characterLevel: number) {
  return Object.fromEntries(SKILLS.map((def) => {
    return [def.code, Math.max(1, Math.min(def.maxLevel, saved[def.code] ?? 0))]
  }))
}

export const useSkillStore = create<SkillState>()((set, get) => ({
  levels: { ...INITIAL_LEVELS },
  points: 0,
  profileKey: null,

  loadCharacterProfile: (accountId, characterCode, characterLevel) => {
    const profileKey = `${accountId}-${characterCode}`
    let saved: SavedSkillProfile = { levels: { ...INITIAL_LEVELS }, points: 0 }
    try {
      const raw = localStorage.getItem(storageKey(profileKey))
      if (raw) saved = JSON.parse(raw) as SavedSkillProfile
    } catch {
      // 손상된 로컬 데이터는 안전한 초기값으로 복구한다.
    }
    const levels = levelsForCharacter(saved.levels ?? {}, characterLevel)
    const points = Math.max(0, saved.points ?? 0)
    set({ profileKey, levels, points })
    saveProfile(profileKey, levels, points)
  },

  addPoint: (code) => {
    const def = SKILLS.find((skill) => skill.code === code)
    const state = get()
    const current = state.levels[code] ?? 0
    if (!def || current <= 0 || state.points <= 0 || current >= def.maxLevel) return false
    const levels = { ...state.levels, [code]: current + 1 }
    const points = state.points - 1
    set({ levels, points })
    saveProfile(state.profileKey, levels, points)
    return true
  },

  removePoint: (code) => {
    const state = get()
    const current = state.levels[code] ?? 0
    if (current <= 1) return false
    const levels = { ...state.levels, [code]: current - 1 }
    const points = state.points + 1
    set({ levels, points })
    saveProfile(state.profileKey, levels, points)
    return true
  },

  grantPoints: (amount) => {
    const state = get()
    const points = Math.max(0, state.points + amount)
    set({ points })
    saveProfile(state.profileKey, state.levels, points)
  },

  unlockScheduled: (characterLevel) => {
    const state = get()
    const levels = levelsForCharacter(state.levels, characterLevel)
    set({ levels })
    saveProfile(state.profileKey, levels, state.points)
  },
}))
