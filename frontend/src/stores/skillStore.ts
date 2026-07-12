import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * 스킬창 (SKILL) — 빠르고 강력한 액션 RPG 컨셉의 직책별 해금 스케줄.
 * - 각 스킬은 캐릭터 레벨이 unlockLevel에 도달하면 자동으로 1레벨 해금된다(포인트 소모 없음).
 * - 해금 이후엔 레벨업으로 받는 스킬 포인트로 maxLevel까지 추가 강화 가능.
 * - 직책(외형 티어)과의 대응은 playerAnimations.ts의 tierForLevel/titleForLevel 참고.
 *
 * ⚠️ 데이터/UI만 구현됨: 실제 전투 동작(돌진 물리·다단히트·즉사·광역·소환 등)은 아직 배선 전이다
 * (GameScene.handleCastSkill이 스킬 코드와 무관하게 항상 같은 상태머신만 재생함). 동작 구현은 별도 작업.
 */
export interface SkillDef {
  code: string
  name: string
  /** 아이콘 placeholder 이모지 (아트 도입 전) */
  icon: string
  type: 'active' | 'passive'
  maxLevel: number
  /** 이 레벨이 되면 자동으로 1레벨 해금 (character-progression-pivot 직책 스케줄) */
  unlockLevel: number
  /** 레벨별 설명 생성 */
  desc: (lv: number) => string
}

export const SKILLS: SkillDef[] = [
  {
    code: 'skill_charge_slash', name: '참마돌격', icon: '⚡', type: 'active', maxLevel: 10, unlockLevel: 2,
    desc: (lv) => `전방으로 돌진하며 베기. 데미지 ${180 + lv * 20}%, MP 12, 쿨타임 8초.`,
  },
  {
    code: 'skill_glaive_flurry', name: '언월난무', icon: '🌀', type: 'active', maxLevel: 10, unlockLevel: 7,
    desc: (lv) => `전방을 ${3 + Math.floor(lv / 4)}회 연속 타격. 타격당 데미지 ${90 + lv * 10}%, MP 20, 쿨타임 10초.`,
  },
  {
    code: 'skill_decisive_strike', name: '일격필살', icon: '💀', type: 'active', maxLevel: 10, unlockLevel: 12,
    desc: (lv) => `전방 적 하나에 필살의 일격. 데미지 ${300 + lv * 30}%, 대상 HP 30% 이하면 데미지 2배. MP 25, 쿨타임 12초.`,
  },
  {
    code: 'skill_dragon_slash', name: '청룡참', icon: '🐉', type: 'active', maxLevel: 10, unlockLevel: 17,
    desc: (lv) => `전방 광역 참격. 데미지 ${250 + lv * 25}%, MP 15, 쿨타임 5초.`,
  },
  {
    code: 'skill_lightning_descent', name: '뇌신강림', icon: '🌩️', type: 'active', maxLevel: 10, unlockLevel: 22,
    desc: (lv) => `하늘에서 뇌신의 벼락을 소환해 광역을 강타한다. 데미지 ${400 + lv * 40}%, MP 40, 쿨타임 25초.`,
  },
]

interface SkillState {
  /** 스킬 코드별 현재 레벨 (0 = 미해금) */
  levels: Record<string, number>
  /** 배분 가능한 스킬 포인트 */
  points: number
  /** @returns 성공 여부 (포인트 부족/최대치/미해금이면 false) */
  addPoint: (code: string) => boolean
  /** 레벨 1 감소, 포인트 환불. 해금 레벨(1) 밑으로는 못 내림 */
  removePoint: (code: string) => boolean
  /** 레벨업 등으로 스킬 포인트 지급 */
  grantPoints: (n: number) => void
  /** 캐릭터 레벨이 unlockLevel에 도달한 스킬을 자동 1레벨 해금 (포인트 소모 없음) */
  unlockScheduled: (characterLevel: number) => void
}

const INITIAL_LEVELS: Record<string, number> = Object.fromEntries(SKILLS.map((s) => [s.code, 0]))

export const useSkillStore = create<SkillState>()(
  persist(
    (set, get) => ({
      levels: { ...INITIAL_LEVELS },
      points: 0,

      addPoint: (code) => {
        const def = SKILLS.find((s) => s.code === code)
        if (!def) return false
        const cur = get().levels[code] ?? 0
        if (cur <= 0 || get().points <= 0 || cur >= def.maxLevel) return false // 미해금 스킬은 포인트로 못 올림
        set((st) => ({ levels: { ...st.levels, [code]: cur + 1 }, points: st.points - 1 }))
        return true
      },

      removePoint: (code) => {
        const cur = get().levels[code] ?? 0
        if (cur <= 1) return false // 해금된 스킬은 1 미만으로 못 내림(잠그려면 별도 기능 필요)
        set((st) => ({ levels: { ...st.levels, [code]: cur - 1 }, points: st.points + 1 }))
        return true
      },

      grantPoints: (n) => set((st) => ({ points: st.points + n })),

      unlockScheduled: (characterLevel) => {
        set((st) => {
          const levels = { ...st.levels }
          for (const def of SKILLS) {
            if (characterLevel >= def.unlockLevel && (levels[def.code] ?? 0) <= 0) {
              levels[def.code] = 1
            }
          }
          return { levels }
        })
      },
    }),
    { name: 'tks-skills-v2' }, // v1(청룡참 상시 해금 + 구 스킬 6종) 대비 스키마 변경으로 버전업
  ),
)
