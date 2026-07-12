import { useState } from 'react'
import { CHARACTERS, LOBBY_SLOTS } from '../data/characters'
import { useScreenStore } from '../stores/screenStore'

/**
 * 대기실(캐릭터 선택) 화면 — 메이플 캐릭터 선택 화면 구도.
 * - 슬롯 선반 2단: 관우 1명 + 예약 슬롯(장비/조운/하후돈) + 빈 슬롯
 * - 캐릭터 선택 시 우측에 능력치 카드, 게임 시작 → 로딩 화면
 * 배경/캐릭터 일러스트는 AI 아트 도입 전 CSS placeholder (AI_UI_PROMPTS.md 참조).
 */
export function CharacterSelect() {
  const [selected, setSelected] = useState<string | null>('guanwu')
  const char = selected ? CHARACTERS[selected] : null

  const startGame = () => {
    if (!selected) return
    useScreenStore.getState().selectCharacter(selected)
    useScreenStore.getState().setScreen('loading')
  }

  return (
    <div className="lobby">
      {/* 상단 서버/타이틀 장식 */}
      <div className="lobby-top">
        <span className="lobby-server">삼국 서버 · CH. 1</span>
        <span className="lobby-slots-info">캐릭터 슬롯 1 / {LOBBY_SLOTS.length}</span>
      </div>
      <h1 className="lobby-title">캐릭터 선택</h1>

      {/* 슬롯 선반 (2단 × 4칸) */}
      <div className="lobby-shelves">
        {[0, 1].map((row) => (
          <div className="lobby-shelf" key={row}>
            <div className="lobby-shelf-slots">
              {LOBBY_SLOTS.slice(row * 4, row * 4 + 4).map((slot, i) => {
                if (slot?.type === 'char') {
                  const def = CHARACTERS[slot.code]
                  const on = selected === slot.code
                  return (
                    <button
                      key={i}
                      className={`lobby-slot lobby-slot--char ${on ? 'lobby-slot--on' : ''}`}
                      onClick={() => setSelected(slot.code)}
                    >
                      {/* CSS placeholder 관우 (녹색 전포 + 붉은 얼굴) */}
                      <span className="lobby-char">
                        <span className="lobby-char-face" />
                        <span className="lobby-char-beard" />
                        <span className="lobby-char-body" style={{ background: def.color }} />
                        <span className="lobby-char-blade" />
                      </span>
                      <span className="lobby-slot-name">{def.name}<small>Lv.1</small></span>
                    </button>
                  )
                }
                return (
                  <span key={i} className="lobby-slot lobby-slot--empty">
                    <span className="lobby-silhouette lobby-silhouette--dim" />
                  </span>
                )
              })}
            </div>
            <div className="lobby-shelf-board" />
          </div>
        ))}
      </div>

      {/* 우측 능력치 카드 */}
      {char && (
        <aside className="lobby-card">
          <div className="lobby-card-lv">Lv. <b>1</b></div>
          <div className="lobby-card-name">{char.name}</div>
          <div className="lobby-card-class">⚔ {char.clazz}</div>
          <p className="lobby-card-desc">{char.desc}</p>
          <div className="lobby-card-stats">
            <div className="lobby-stat"><span>HP</span><b>{char.stats.hp}</b></div>
            <div className="lobby-stat"><span>MP</span><b>{char.stats.mp}</b></div>
            <div className="lobby-stat"><span>공격력</span><b>{char.stats.attack}</b></div>
            <div className="lobby-stat"><span>이동속도</span><b>{char.stats.speedPct}%</b></div>
          </div>
          <div className="lobby-card-skill">
            <span className="lobby-skill-tag">스킬</span>
            <b>{char.skill.name}</b>
            <small>{char.skill.desc}</small>
          </div>
          <button className="lobby-start" onClick={startGame}>게임 시작</button>
        </aside>
      )}
    </div>
  )
}
