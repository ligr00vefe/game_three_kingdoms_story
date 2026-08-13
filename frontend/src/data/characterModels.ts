/** Visual-only character model data. Progression, inventory and skills stay elsewhere. */
export interface CharacterModelDef {
  code: string
  assetPrefix: string
  fallbackTexture: string
  frameSize: number
  /** Raise the rendered model relative to its collision body's ground line (world px). */
  groundLift: number
  /** Visual size multiplier; collision dimensions remain unchanged. */
  visualScale: number
  animations: Partial<Record<CharacterModelAction, number>>
  /** Source sheet action aliases, e.g. the common skill state uses a slash sheet. */
  assetAction?: Partial<Record<CharacterModelAction, string>>
}

export type CharacterModelAction =
  | 'idle' | 'walk' | 'jump' | 'dash' | 'climb'
  | 'attack' | 'skill' | 'hit' | 'dead' | 'rally'

export const CHARACTER_MODELS: Record<string, CharacterModelDef> = {
  // Kept so promotion or skin selection can restore the original model later.
  guanwu_t1: {
    code: 'guanwu_t1', assetPrefix: 'guanwu_t1', fallbackTexture: 'guanwu_idle', frameSize: 128, groundLift: 0, visualScale: 1,
    animations: {
      idle: 4, walk: 6, jump: 2, dash: 3, climb: 2,
      attack: 6, skill: 8, hit: 2, dead: 5, rally: 4,
    },
  },
  guanwu_t2: {
    code: 'guanwu_t2', assetPrefix: 'guanwu_t2', fallbackTexture: 'guanwu_idle', frameSize: 192, groundLift: -10, visualScale: 1.15,
    animations: { idle: 6, walk: 8, jump: 6, climb: 6, attack: 6, skill: 6 },
    assetAction: { skill: 'slash' },
  },
  zhaoyun_t2: {
    code: 'zhaoyun_t2', assetPrefix: 'zhaoyun_t2', fallbackTexture: 'guanwu_idle', frameSize: 192, groundLift: -10, visualScale: 1.15,
    animations: { idle: 6, walk: 8, jump: 8, climb: 8, attack: 8, skill: 8 },
    // Zhao Yun shares Guan Yu's skills for now, using his own attack motion.
    assetAction: { skill: 'attack' },
  },
}

export function getCharacterModel(modelCode: string): CharacterModelDef {
  return CHARACTER_MODELS[modelCode] ?? CHARACTER_MODELS.guanwu_t1
}
