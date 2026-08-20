import { useAutoCombatStore } from '../stores/autoCombatStore'
import type { CombatPolicy } from '../stores/autoCombatStore'

export function AutoCombatControls() {
  const auto = useAutoCombatStore()
  return (
    <div className="auto-settings">
      <label className="auto-setting-row"><span>자동 동작</span><input type="checkbox" checked={auto.enabled} onChange={(e) => auto.setEnabled(e.target.checked)} /></label>
      <label className="auto-setting-row"><span>전투 방침</span>
        <select value={auto.policy} onChange={(e) => auto.setPolicy(e.target.value as CombatPolicy)}>
          <option value="nearest">공격 우선 · 가까운 적</option><option value="defense">수비 우선 · 성에 가까운 적</option>
          <option value="elite">정예 우선 · 강한 적</option><option value="danger">위험 우선 · 돌진/화약병</option>
          <option value="survival">생존 우선 · HP 35% 후퇴</option>
        </select>
      </label>
      <label className="auto-setting-row"><span>자동 스킬</span><input type="checkbox" checked={auto.autoSkill} onChange={(e) => auto.setAutoSkill(e.target.checked)} /></label>
      <label className="auto-setting-row"><span>최소 HP {auto.minHpPercent}%</span><input type="range" min="20" max="100" step="10" value={auto.minHpPercent} onChange={(e) => auto.setMinHpPercent(Number(e.target.value))} /></label>
      <label className="auto-setting-row"><span>최소 MP {auto.minMpPercent}%</span><input type="range" min="20" max="100" step="10" value={auto.minMpPercent} onChange={(e) => auto.setMinMpPercent(Number(e.target.value))} /></label>
      <label className="auto-setting-row"><span>적 {auto.minEnemyCount}명 이상</span><input type="range" min="1" max="6" value={auto.minEnemyCount} onChange={(e) => auto.setMinEnemyCount(Number(e.target.value))} /></label>
      <label className="auto-setting-row"><span>보스에게 스킬 보존</span><input type="checkbox" checked={auto.reserveSkillForBoss} onChange={(e) => auto.setReserveSkillForBoss(e.target.checked)} /></label>
      <label className="auto-setting-row"><span>우측 명령 안내 표시</span><input type="checkbox" checked={auto.quickHelpVisible} onChange={(e) => auto.setQuickHelpVisible(e.target.checked)} /></label>
    </div>
  )
}
