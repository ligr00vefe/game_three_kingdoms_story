import { useSkillStore, getSkillsForCharacter } from '../stores/skillStore'
import { useScreenStore } from '../stores/screenStore'
import { useUiStore } from '../stores/uiStore'
import { CHARACTERS } from '../data/characters'
import { useDraggableWindow } from './useDraggableWindow'
import { COMBAT } from '../game/config'

/**
 * 스킬창 (SKILL) — 처음부터 사용할 수 있는 5개 액티브 스킬.
 * 모든 스킬은 +/-로 포인트를 배분해 강화한다.
 */
export function SkillPanel() {
  const open = useUiStore((s) => s.skillbookOpen)
  const levels = useSkillStore((s) => s.levels)
  const points = useSkillStore((s) => s.points)
  const selectedCharacter = useScreenStore((s) => s.selectedCharacter)
  const skills = getSkillsForCharacter(selectedCharacter)
  const windowDrag = useDraggableWindow('skillbook')

  if (!open) return null

  return (
    <div className="sk-panel ui-window" style={windowDrag.style}>
      <div className="sk-titlebar ui-window__titlebar" onPointerDown={windowDrag.onPointerDown}>
        SKILL
        <button className="inv-close sk-close" onClick={() => useUiStore.getState().toggleSkillbook()} title="접기">−</button>
      </div>

      <div className="sk-header">
        <span className="sk-tree">📖 {(CHARACTERS[selectedCharacter] ?? CHARACTERS.guanwu).name}의 무예</span>
        <span className="sk-points">SKILL POINT <b>{points}</b></span>
      </div>

      <div className="sk-grid">
        {skills.length === 0 && (
          <p className="sk-empty">아직 사용할 수 있는 스킬이 없습니다.</p>
        )}
        {skills.map((def, index) => {
          const lv = levels[def.code] ?? 0
          const locked = lv <= 0
          const maxed = lv >= def.maxLevel
          const rank = Math.min(index, COMBAT.SKILL_MP_COST_BY_RANK.length - 1)
          const mpCost = COMBAT.SKILL_MP_COST_BY_RANK[rank]
          const targets = COMBAT.SKILL_TARGETS_BY_RANK[rank]
          const attackPercent = Math.round(COMBAT.WEAPON_MULTIPLIER * COMBAT.SKILL_MULTIPLIER * COMBAT.SKILL_POWER_BY_RANK[rank] * 100)
          return (
            <div
              className={`sk-cell ${lv > 0 ? 'sk-cell--learned' : ''} ${locked ? 'sk-cell--locked' : ''}`}
              key={def.code}
              draggable={!locked}
              onDragStart={(e) => {
                if (locked) return
                e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'skill', code: def.code }))
                e.dataTransfer.effectAllowed = 'move'
                // 기본 드래그 이미지는 셀 전체(이름·레벨·버튼 포함) — 아이콘만 커서를 따라오게 교체.
                // 크기는 CSS 상수가 아니라 실측으로 — 패널이 스케일 변형을 받으면 34px이 아니다.
                const icon = e.currentTarget.querySelector('.sk-icon')
                if (icon) {
                  const r = icon.getBoundingClientRect()
                  e.dataTransfer.setDragImage(icon, r.width / 2, r.height / 2)
                }
              }}
              title={locked ? `Lv ${def.unlockLevel}에 해금` : `공격력 ${attackPercent}% · MP ${mpCost} · 최대 ${targets}명\n${def.desc(lv)}\n퀵슬롯으로 드래그해 등록`}
            >
              <span className="sk-icon" data-type={def.type}>
                {locked ? '🔒' : def.iconImage ? <img src={def.iconImage} alt="" /> : def.icon}
              </span>
              <div className="sk-info">
                <span className="sk-name">{def.name}</span>
                <span className="sk-lv">{locked ? `Lv ${def.unlockLevel} 해금` : `${lv} / ${def.maxLevel}`}</span>
              </div>
              {!locked && (
                <div className="sk-btns">
                  <button
                    className="sk-btn sk-btn--minus"
                    disabled={lv <= 1}
                    onClick={() => useSkillStore.getState().removePoint(def.code)}
                  >−</button>
                  <button
                    className="sk-btn sk-btn--plus"
                    disabled={maxed || points <= 0}
                    onClick={() => useSkillStore.getState().addPoint(def.code)}
                  >＋</button>
                </div>
              )}
            </div>
          )
        })}
      </div>
      {skills.length > 0 && <p className="inv-hint">직책이 오르면 자동으로 새 스킬이 해금됩니다 · ＋/− 로 포인트를 배분해 강화 · 스킬 칸을 퀵슬롯으로 드래그해 등록 후 숫자키(1~7)로 발동</p>}
    </div>
  )
}
