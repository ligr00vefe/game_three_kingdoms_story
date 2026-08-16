import { useGameStore } from '../stores/gameStore'
import { useUiStore } from '../stores/uiStore'
import { CHARACTERS } from '../data/characters'
import { useScreenStore } from '../stores/screenStore'
import { useDraggableWindow } from './useDraggableWindow'
import { characterTitleForLevel } from '../data/characterTitles'

/** 전투력: 공격력·크리티컬·주스탯·레벨을 합산한 간이 지표 (표시용) */
function computeCombatPower(s: {
  attackPower: number; critChance: number; critDamage: number; str: number; level: number
}): number {
  const critFactor = 1 + s.critChance * (s.critDamage - 1)
  return Math.round((s.attackPower * critFactor + s.str * 3) * (1 + s.level * 0.08) + s.level * 12)
}

/**
 * 캐릭터 스탯창 (CHARACTER INFO) — 첨부 레퍼런스 구도.
 * 전투력 + 1차 스탯 + 상세 전투 스탯. HP/MP는 최대치(총량)를 표시한다.
 */
export function CharacterInfoPanel() {
  const open = useUiStore((s) => s.statsOpen)
  const g = useGameStore()
  const char = CHARACTERS[useScreenStore.getState().selectedCharacter] ?? CHARACTERS.guanwu
  const windowDrag = useDraggableWindow('stats')

  if (!open) return null

  const cp = computeCombatPower(g)
  const rows: [string, string, boolean?][] = [
    ['공격력', g.attackPower.toLocaleString(), true],
    ['치명타 확률', `${(g.critChance * 100).toFixed(1)}%`],
    ['치명타 데미지', `+${Math.round((g.critDamage - 1) * 100)}%`],
    ['이동속도', `${Math.round(g.moveSpeedMult * 100)}%`],
    ['경험치', `${g.exp.toLocaleString()} / ${g.expToNext.toLocaleString()}`],
    ['보유 금화', g.gold.toLocaleString()],
  ]

  return (
    <div className="ci-panel ui-window" style={windowDrag.style}>
      <div className="ci-titlebar ui-window__titlebar" onPointerDown={windowDrag.onPointerDown}>
        CHARACTER INFO
        <button className="inv-close ci-close" onClick={() => useUiStore.getState().toggleStats()} title="접기">−</button>
      </div>

      {/* 상단: 프리뷰 + 레벨/이름 */}
      <div className="ci-hero">
        <span className="ci-lv">Lv. {g.level}</span>
        {/* 대기실과 같은 관우 t1 idle 첫 프레임 — 도형 placeholder를 실제 아트로 교체 */}
        <span className={`ci-avatar ci-avatar--${char.code}`} />
        <span className="ci-name">{g.characterName}</span>
        <span className="ci-class">🏅 {characterTitleForLevel(char.code, g.level)}</span>
      </div>

      {/* 전투력 */}
      <div className="ci-cp">
        <span className="ci-cp-label">전투력</span>
        <span className="ci-cp-value">{cp.toLocaleString()}</span>
      </div>

      {/* 1차 스탯 */}
      <div className="ci-primary">
        <div className="ci-stat"><span>HP</span><b>{g.hp.toLocaleString()} / {g.maxHp.toLocaleString()}</b></div>
        <div className="ci-stat"><span>MP</span><b>{g.mp.toLocaleString()} / {g.maxMp.toLocaleString()}</b></div>
        <div className="ci-stat"><span>STR</span><b>{g.str}</b></div>
        <div className="ci-stat"><span>DEX</span><b>{g.dex}</b></div>
        <div className="ci-stat"><span>INT</span><b>{g.int}</b></div>
        <div className="ci-stat"><span>LUK</span><b>{g.luk}</b></div>
      </div>

      {/* 상세 전투 스탯 */}
      <div className="ci-detail">
        {rows.map(([label, val, hi]) => (
          <div className="ci-detail-row" key={label}>
            <span className="ci-detail-label">{label}</span>
            <span className={`ci-detail-val ${hi ? 'ci-detail-val--hi' : ''}`}>{val}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
