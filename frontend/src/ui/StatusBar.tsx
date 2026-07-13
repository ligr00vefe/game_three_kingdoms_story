import { useEffect, useRef } from 'react'
import { useGameStore } from '../stores/gameStore'
import { useUiStore } from '../stores/uiStore'

/**
 * 하단 중앙 상태바 (메이플 스타일): Lv 배지 + 이름 + HP/MP 바(수치 표기) + 메뉴 버튼.
 * 고빈도 값(hp/mp)은 transient 구독으로 DOM 직접 갱신 (Hud와 동일 패턴, DEVELOPMENT_PLAN 문제 3).
 */
export function StatusBar() {
  const name = useGameStore((s) => s.characterName)
  const hpFillRef = useRef<HTMLDivElement>(null)
  const hpTextRef = useRef<HTMLSpanElement>(null)
  const mpFillRef = useRef<HTMLDivElement>(null)
  const mpTextRef = useRef<HTMLSpanElement>(null)
  const levelRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const apply = () => {
      const s = useGameStore.getState()
      if (hpFillRef.current) hpFillRef.current.style.width = `${(s.hp / s.maxHp) * 100}%`
      if (hpTextRef.current) hpTextRef.current.textContent = `${Math.round(s.hp)} / ${s.maxHp}`
      if (mpFillRef.current) mpFillRef.current.style.width = `${(s.mp / s.maxMp) * 100}%`
      if (mpTextRef.current) mpTextRef.current.textContent = `${Math.round(s.mp)} / ${s.maxMp}`
      if (levelRef.current) levelRef.current.textContent = `${s.level}`
    }
    apply()
    const unsub = useGameStore.subscribe((s) => [s.hp, s.mp, s.level], apply)
    return unsub
  }, [])

  return (
    <div className="statusbar">
      <div className="statusbar-plate">
        <span className="statusbar-lv">Lv. <span ref={levelRef}>1</span></span>
        <span className="statusbar-name">{name}</span>
      </div>
      <div className="statusbar-bars">
        <div className="sbar sbar--hp">
          <span className="sbar-tag">HP</span>
          <div className="sbar-track"><div ref={hpFillRef} className="sbar-fill" /></div>
          <span ref={hpTextRef} className="sbar-text" />
        </div>
        <div className="sbar sbar--mp">
          <span className="sbar-tag">MP</span>
          <div className="sbar-track"><div ref={mpFillRef} className="sbar-fill" /></div>
          <span ref={mpTextRef} className="sbar-text" />
        </div>
      </div>
      <div className="statusbar-menu">
        <button className="menu-btn" title="스탯 (S)" onClick={() => useUiStore.getState().toggleStats()}>👤</button>
        <button className="menu-btn" title="스킬 (K)" onClick={() => useUiStore.getState().toggleSkillbook()}>📖</button>
        <button className="menu-btn" title="퀘스트 (Q)" onClick={() => useUiStore.getState().toggleQuest()}>📜</button>
        <button className="menu-btn" title="미니맵 (M)" onClick={() => useUiStore.getState().toggleMinimap()}>🗺</button>
        <button className="menu-btn" title="설정 (ESC)" onClick={() => useUiStore.getState().setSettingsOpen(true)}>⚙</button>
      </div>
    </div>
  )
}
