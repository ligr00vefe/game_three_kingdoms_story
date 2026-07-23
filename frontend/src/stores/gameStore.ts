import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

/**
 * 게임 상태 저장소. React UI는 selector로 필요한 값만 구독한다.
 * 고빈도 값(hp/mp/exp)은 HUD에서 subscribeWithSelector 기반 transient 구독을 사용해
 * React 리렌더를 최소화한다 (DEVELOPMENT_PLAN 문제 3).
 */
interface GameState {
  /** 하단 상태바/채팅에 표시되는 캐릭터 이름 (서버 연동 전 임시 고정) */
  characterName: string
  level: number
  /** 외형(직책) 티어 — 레벨과 분리. 관청 전직으로만 상승한다(자동 아님). 아트 준비 전까지 1 고정. */
  jobTier: number
  hp: number
  maxHp: number
  mp: number
  maxMp: number
  exp: number
  expToNext: number
  attackPower: number
  gold: number
  /** 1차 스탯 (스탯창 표시 — 관우는 STR 주스탯) */
  str: number
  dex: number
  int: number
  luk: number
  /** 크리티컬 확률(0~1), 크리티컬 데미지 배율(1.5 = +50%) */
  critChance: number
  critDamage: number
  /** 아티팩트 등 장비 효과 반영 이동속도 배율 (GAME_DESIGN 8.3) */
  moveSpeedMult: number
  playerDead: boolean
  serverStatus: 'checking' | 'ok' | 'down'
  setStats: (partial: Partial<Omit<GameState, 'setStats' | 'setServerStatus' | 'setPlayerDead'>>) => void
  setPlayerDead: (dead: boolean) => void
  setServerStatus: (s: GameState['serverStatus']) => void
}

export const useGameStore = create<GameState>()(
  subscribeWithSelector((set) => ({
    characterName: '관우',
    level: 1,
    jobTier: 1,
    hp: 100,
    maxHp: 100,
    mp: 50,
    maxMp: 50,
    exp: 0,
    expToNext: 100,
    attackPower: 10,
    gold: 0,
    str: 20,
    dex: 10,
    int: 5,
    luk: 5,
    critChance: 0.05,
    critDamage: 1.5,
    moveSpeedMult: 1,
    playerDead: false,
    serverStatus: 'checking',
    setStats: (partial) => set(partial),
    setPlayerDead: (playerDead) => set({ playerDead }),
    setServerStatus: (serverStatus) => set({ serverStatus }),
  })),
)
