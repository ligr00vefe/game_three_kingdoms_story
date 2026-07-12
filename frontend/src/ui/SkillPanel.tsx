import { useSkillStore, SKILLS } from '../stores/skillStore'
import { useUiStore } from '../stores/uiStore'
import { useGameStore } from '../stores/gameStore'
import { titleForLevel } from '../game/systems/playerAnimations'

/**
 * 스킬창 (SKILL) — 직책 스케줄에 따라 자동 해금되는 5개 액티브 스킬.
 * 미해금 스킬은 잠금 표시, 해금된 스킬은 +/-로 포인트 배분해 강화한다.
 */
export function SkillPanel() {
  const open = useUiStore((s) => s.skillbookOpen)
  const levels = useSkillStore((s) => s.levels)
  const points = useSkillStore((s) => s.points)
  const charLevel = useGameStore((s) => s.level)

  if (!open) return null

  return (
    <div className="sk-panel">
      <div className="sk-titlebar">
        SKILL
        <button className="inv-close sk-close" onClick={() => useUiStore.getState().toggleSkillbook()}>×</button>
      </div>

      <div className="sk-header">
        <span className="sk-tree">📖 {titleForLevel(charLevel)}의 무예</span>
        <span className="sk-points">SKILL POINT <b>{points}</b></span>
      </div>

      <div className="sk-grid">
        {SKILLS.map((def) => {
          const lv = levels[def.code] ?? 0
          const locked = lv <= 0
          const maxed = lv >= def.maxLevel
          return (
            <div
              className={`sk-cell ${lv > 0 ? 'sk-cell--learned' : ''} ${locked ? 'sk-cell--locked' : ''}`}
              key={def.code}
              draggable={!locked}
              onDragStart={(e) => {
                if (locked) return
                e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'skill', code: def.code }))
                e.dataTransfer.effectAllowed = 'move'
              }}
              title={locked ? `Lv ${def.unlockLevel}에 해금` : `${def.desc(lv)}\n퀵슬롯으로 드래그해 등록`}
            >
              <span className="sk-icon" data-type={def.type}>{locked ? '🔒' : def.icon}</span>
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
      <p className="inv-hint">직책이 오르면 자동으로 새 스킬이 해금됩니다 · ＋/− 로 포인트를 배분해 강화 · 스킬 칸을 퀵슬롯으로 드래그해 등록 후 숫자키(1~7)로 발동</p>
    </div>
  )
}
