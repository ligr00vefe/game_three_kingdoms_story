import Phaser from 'phaser'

/**
 * 플레이어(관우) 애니메이션 정의 + 티어별 스프라이트시트 연결.
 *
 * 설계 원칙 (character-progression-pivot + 2026-07-12 방향 확정):
 * - 캐릭터 외형은 레벨 구간별 "티어" 통짜 스프라이트 세트를 교체한다 (페이퍼돌 아님).
 * - **좌/우 방향은 별도 스프라이트를 사용한다 — setFlipX 반전 금지** (사용자 확정:
 *   반전 시 무기 잡는 손이 좌우로 바뀌어 어색함). climb(사다리)만 뒷모습 단일 시트.
 * - 텍스처 키 규칙: `guanwu_t{tier}_{action}_{r|l}` (예: guanwu_t1_walk_r). climb만 `guanwu_t{tier}_climb`.
 * - 아직 아트가 없는 액션/방향은 자동으로 같은 방향 idle → placeholder 순으로 폴백 —
 *   코드 수정 없이 파일만 추가하면 살아난다.
 */

/** 상태 머신과 무관한, 스프라이트시트 단위의 액션 이름 (sit은 기능 제거됨) */
export type AnimAction =
  | 'idle' | 'walk' | 'jump' | 'dash' | 'climb'
  | 'attack' | 'skill' | 'hit' | 'dead' | 'rally'

export interface AnimSpec {
  action: AnimAction
  /** 스프라이트시트 가로 프레임 수 (ASSET_SPEC 초기값) */
  frames: number
  /** 초당 프레임 — 액션 지속시간(config.COMBAT)과 맞춰 튜닝 */
  frameRate: number
  /** -1 = 무한 반복, 0 = 1회 재생 후 마지막 프레임 유지 */
  repeat: number
  /**
   * 프레임별 체류 시간(ms). 주면 frameRate 대신 이 타이밍으로 재생한다.
   * Phaser 애니메이션은 tween과 달리 프레임 타이밍에 easing을 걸 수 없어,
   * 완급은 이렇게 프레임마다 길이를 달리 줘서 만든다. 길이는 frames와 일치해야 하고
   * 합계는 해당 액션의 지속시간(config.COMBAT)과 맞춘다.
   */
  durations?: readonly number[]
}

/**
 * 액션별 프레임 규격. 공격/스킬의 frameRate는 config.COMBAT 지속시간에서 역산:
 * - attack 6f ÷ 0.55s ≈ 11fps, skill 8f ÷ 0.45s ≈ 18fps
 * walk는 명칭만 walk이고 실제 모션은 달리기(run) — 게임 이동속도가 달리기 속도라서.
 * attack은 2026-07-16 기준 창 찌르기 단일 모션 (대기→예비→찌르기→회수→대기 6프레임).
 */
export const PLAYER_ANIM_SPECS: readonly AnimSpec[] = [
  { action: 'idle',   frames: 4, frameRate: 6,  repeat: -1 },
  { action: 'walk',   frames: 6, frameRate: 10, repeat: -1 },
  { action: 'jump',   frames: 2, frameRate: 6,  repeat: 0  },
  { action: 'dash',   frames: 3, frameRate: 14, repeat: 0  },
  { action: 'climb',  frames: 2, frameRate: 6,  repeat: -1 },
  // 불균등 타이밍으로 완급을 만든다 — 합계 550ms = COMBAT.ATTACK_DURATION_MS.
  // 예비동작은 길게 끌고(tension) 타격은 짧게(snap) 최대 신장에서 멈칫(punch).
  { action: 'attack', frames: 6, frameRate: 11, repeat: 0,
    durations: [60, 150, 40, 130, 90, 80] },
  { action: 'skill',  frames: 8, frameRate: 18, repeat: 0  },
  { action: 'hit',    frames: 2, frameRate: 10, repeat: 0  },
  { action: 'dead',   frames: 5, frameRate: 8,  repeat: 0  },
  { action: 'rally',  frames: 4, frameRate: 8,  repeat: 0  },
] as const

/** placeholder 폴백용 단일 텍스처 (PreloadScene가 생성) */
export const PLAYER_FALLBACK_TEX = 'guanwu_idle'

/**
 * 관우 직책 스케줄 (character-progression-pivot) — 외형 티어와 1:1 대응.
 * 스킬 해금 레벨(skillStore.SKILLS)과는 별개 값이니 혼동 주의: 직책은 "구간의 시작 레벨".
 */
export const TITLES: readonly { tier: number; name: string; minLevel: number }[] = [
  { tier: 1, name: '무명소졸', minLevel: 1 },
  { tier: 2, name: '의병장', minLevel: 6 },
  { tier: 3, name: '장수', minLevel: 11 },
  { tier: 4, name: '한수정후', minLevel: 16 },
  { tier: 5, name: '무신', minLevel: 21 },
] as const

/**
 * 전직(외형 상승) 최소 레벨. 이 레벨 미만이면 관청에서 "아직 부족하다"고 돌려보낸다.
 * 외형 티어는 더 이상 레벨로 자동 상승하지 않고(gameStore.jobTier), 관청 전직으로만 오른다.
 */
export const PROMOTION_MIN_LEVEL = 5

/** 레벨 → 외형 티어 (1~5). 아트가 준비된 티어만 실제로 바뀐다. */
export function tierForLevel(level: number): number {
  let tier = TITLES[0].tier
  for (const t of TITLES) {
    if (level >= t.minLevel) tier = t.tier
  }
  return tier
}

/** 티어 → 직책 이름 (전직 패널 표시용). 범위를 벗어나면 마지막 직책. */
export function titleForTier(tier: number): string {
  const t = TITLES.find((x) => x.tier === tier)
  return t ? t.name : TITLES[TITLES.length - 1].name
}

/** 레벨 → 직책 이름 (UI 표시용) */
export function titleForLevel(level: number): string {
  let name = TITLES[0].name
  for (const t of TITLES) {
    if (level >= t.minLevel) name = t.name
  }
  return name
}

/** animId = "walk_r" 같은 방향 포함 식별자 (climb만 방향 없음) */
export const textureKey = (tier: number, animId: string) => `guanwu_t${tier}_${animId}`

/** 액션 → 이 액션이 가질 수 있는 animId 목록 (climb는 뒷모습 단일, 나머지는 좌/우) */
function variantsOf(action: AnimAction): string[] {
  return action === 'climb' ? ['climb'] : [`${action}_r`, `${action}_l`]
}

/**
 * 해당 티어의 스프라이트시트로 Phaser 애니메이션을 등록한다.
 * 아트가 실제로 로드된(=프레임 수가 충분한 스프라이트시트) animId만 생성하고,
 * 그 집합을 반환한다. 단일 placeholder 텍스처는 프레임이 1개뿐이라 자동 제외된다.
 */
export function createPlayerAnims(scene: Phaser.Scene, tier: number): Set<string> {
  const available = new Set<string>()
  for (const spec of PLAYER_ANIM_SPECS) {
    for (const animId of variantsOf(spec.action)) {
      const key = textureKey(tier, animId)
      if (!scene.textures.exists(key)) continue
      // frameTotal은 __BASE 프레임을 포함하므로 실제 프레임 수 = frameTotal - 1
      const realFrames = scene.textures.get(key).frameTotal - 1
      if (realFrames < spec.frames) continue // 단일 이미지/미완성 시트 방어

      if (!scene.anims.exists(key)) {
        scene.anims.create({
          key,
          // durations를 준 액션(attack)만 프레임별 완급을 쓰고, 나머지는 균등 frameRate
          frames: spec.durations
            ? spec.durations.map((duration, i) => ({ key, frame: i, duration }))
            : scene.anims.generateFrameNumbers(key, { start: 0, end: spec.frames - 1 }),
          frameRate: spec.frameRate,
          repeat: spec.repeat,
        })
      }
      available.add(animId)
    }
  }
  return available
}
