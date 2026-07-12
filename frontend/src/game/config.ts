/**
 * 게임플레이 튜닝 상수 (GAME_DESIGN.md 초기값의 코드 반영).
 * 조작감 튜닝은 전부 이 파일에서만 한다 — 로직 안에 숫자 하드코딩 금지.
 */
export const PHYSICS = {
  GRAVITY_Y: 1600,
} as const

export const CAMERA = {
  /**
   * 메이플 비율 맞춤 (캐릭터 ≈ 화면 세로의 12~13%).
   * 1.0 = 기존(작게 보임). 크게/작게 보이면 이 값만 조정.
   */
  ZOOM: 1.4,
} as const

export const PLAYER = {
  /** 좌우 이동: 가속 없는 일정 속도 (메이플 감성, GAME_DESIGN 3.1) */
  MOVE_SPEED: 240,
  JUMP_VELOCITY: -620,

  /**
   * 공중 액션 (GAME_DESIGN 3.2 개정): 공중에서 점프키 재입력 시 1회
   * - 점프 대쉬: 수평 돌진 (점프 → 점프)
   * - 이단 점프: ↑ 유지 + 점프 → 점프 (아래로 바람 이펙트)
   */
  AIR_DASH_SPEED: 700,
  AIR_DASH_DURATION_MS: 220,
  DOUBLE_JUMP_VELOCITY: -560,

  /** 줄/사다리 (GAME_DESIGN 3.3) */
  CLIMB_SPEED: 150,

  /** 원웨이 발판 하강(↓+점프) 시 통과 유지 시간 */
  DROP_THROUGH_MS: 300,

  /** 히트박스(허트박스) 크기 — 64x64 프레임 안의 실제 몸통 */
  BODY_WIDTH: 36,
  BODY_HEIGHT: 54,

  /**
   * 캐릭터 시각 배율 (1 = 128px 프레임 원본). 캐릭터가 너무 크면 이 값만 낮춘다.
   * 월드 충돌 바디(BODY_*)는 배율과 무관하게 유지된다 — Player 생성자에서 소스 크기를 역보정.
   */
  VISUAL_SCALE: 0.7,
  /**
   * 발끝을 잔디 경계(충돌면)보다 안쪽으로 내리는 양(px, 월드). 0이면 잔디 맨 윗선에 발이 닿아
   * 공중에 뜬 것처럼 보인다 — 잔디 중앙에 발이 오도록 양수로. 높이면 더 깊이 내려간다.
   */
  FOOT_SINK: 4,
} as const

export const COMBAT = {
  /** 기본 공격 (GAME_DESIGN 4.1) */
  ATTACK_DURATION_MS: 350,
  ATTACK_HIT_AT_MS: 120,        // 모션 중 판정 발생 시점
  ATTACK_REACH: 96,             // 전방 약 1.5캐릭터 폭 (언월도 리치)
  ATTACK_HEIGHT: 70,
  ATTACK_MAX_TARGETS: 3,
  WEAPON_MULTIPLIER: 1.2,       // 청룡언월도 (item_definition effect_json과 일치)

  /** 크리티컬 (GAME_DESIGN 4.3) */
  CRIT_CHANCE: 0.05,
  CRIT_MULTIPLIER: 1.5,

  /** 스킬: 청룡참 (GAME_DESIGN 4.2) */
  SKILL_MP_COST: 15,
  SKILL_MULTIPLIER: 2.5,
  SKILL_COOLDOWN_MS: 5000,
  SKILL_REACH: 200,
  SKILL_HEIGHT: 110,
  SKILL_MAX_TARGETS: 8,
  SKILL_DURATION_MS: 450,
  SKILL_HIT_AT_MS: 150,
  SKILL_HITSTOP_MS: 70,

  /** 피격 (GAME_DESIGN 4.3) */
  HIT_INVINCIBLE_MS: 1000,
  HIT_KNOCKBACK_X: 220,
  HIT_KNOCKBACK_Y: -220,

  /** 자연 회복 (GAME_DESIGN 5.2) — 비전투(마지막 피격/공격 후 3초) 시 초당 회복 */
  REGEN_HP_PER_SEC: 1,
  REGEN_MP_PER_SEC: 2,
  REGEN_IDLE_AFTER_MS: 3000,
} as const

export const PROGRESSION = {
  /** GAME_DESIGN 5.1 */
  BASE_EXP_TO_NEXT: 100,
  EXP_GROWTH: 1.2,
  LEVELUP_HP_GAIN: 10,
  LEVELUP_MP_GAIN: 5,
  LEVELUP_ATK_GAIN: 2,
  BASE_ATTACK: 10,
} as const

export const SPAWN = {
  /** 리젠 (GAME_DESIGN 6.3) */
  RESPAWN_MIN_MS: 5000,
  RESPAWN_MAX_MS: 10000,
  RISE_DURATION_MS: 900,        // 땅에서 기어나오는 연출 시간
} as const
