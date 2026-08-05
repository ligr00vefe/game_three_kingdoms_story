import { useEffect } from 'react'
import { useDefenseStore } from '../stores/defenseStore'
import type { DefensePhase, DefeatReason, DefenseUpgrade } from '../stores/defenseStore'
import { useGameStore } from '../stores/gameStore'
import { useScreenStore } from '../stores/screenStore'
import { useUiStore } from '../stores/uiStore'
import { EventBus, GameEvents } from '../game/EventBus'
import { AutoCombatControls } from './AutoCombatControls'

interface DefenseStatePayload {
  phase: DefensePhase
  timeLeftMs: number
  stage: number
  zombiesLeft: number
  baseHp: number
  maxBaseHp: number
  defeatReason: DefeatReason
  archerCooldownMs: number
  combo: number
  supportGauge: number
  eventName: string | null
  rewardChoices: DefenseUpgrade[]
}

const DEFEAT_MSG: Record<'base' | 'death' | 'timeout', string> = {
  base: '기지가 파괴되었습니다',
  death: '캐릭터가 쓰러졌습니다',
  timeout: '시간 내 방어에 실패했습니다',
}

const BARRICADES = [
  { tier: 'low', name: '하급 방벽', cost: 30, hp: 100, icon: '🪵' },
  { tier: 'mid', name: '중급 방벽', cost: 150, hp: 240, icon: '🧱' },
  { tier: 'high', name: '상급 방벽', cost: 500, hp: 500, icon: '🏰' },
] as const
const OFFENSIVE_STRUCTURES = [
  { kind: 'watchtower' as const, name: '망루', cost: 220, hp: 260, desc: '자동 화살 공격' },
  { kind: 'bastion' as const, name: '성루', cost: 450, hp: 520, desc: '대포·스플래시 공격' },
] as const
const HP_POTION = { cost: 20, amount: 40 }
const MP_POTION = { cost: 15, amount: 30 }
const ARCHER_COST = 50
const UPGRADE_INFO: Record<DefenseUpgrade, { icon: string; name: string; desc: string }> = {
  attack: { icon: '⚔️', name: '청룡의 기세', desc: '공격력 +3' },
  vitality: { icon: '❤️', name: '강건한 육신', desc: '최대 HP +20' },
  mana: { icon: '💧', name: '무예의 깨달음', desc: '최대 MP +12' },
  salvage: { icon: '🪙', name: '전리품 수거', desc: '골드 +70' },
  fortify: { icon: '🏯', name: '성곽 보강', desc: '기지 최대 HP +35' },
  repair: { icon: '🔨', name: '긴급 정비', desc: '모든 구조물 완전 수리' },
}

/** Wave 임박 경고를 띄우기 시작하는 남은 대기시간(ms).
 *  DefenseManager의 DEFENSE.WAIT_MS와 같은 값이면 대기 단계 내내 경고가 울린다. */
const WAVE_WARNING_MS = 10_000

/** ms → "M:SS" */
function fmt(ms: number) {
  const total = Math.ceil(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * 디펜스 게임 HUD: 상단중앙 카운트다운/스테이지/기지HP, 하단 구매하기,
 * 구매 창(바리케이트), 승리 배너, 패배 오버레이.
 * Phaser의 DEFENSE_STATE / DEFENSE_PLACE_MODE 이벤트로 구동된다.
 */
export function DefenseHud() {
  const active = useDefenseStore((s) => s.active)
  const phase = useDefenseStore((s) => s.phase)
  const timeLeftMs = useDefenseStore((s) => s.timeLeftMs)
  const stage = useDefenseStore((s) => s.stage)
  const zombiesLeft = useDefenseStore((s) => s.zombiesLeft)
  const baseHp = useDefenseStore((s) => s.baseHp)
  const maxBaseHp = useDefenseStore((s) => s.maxBaseHp)
  const defeatReason = useDefenseStore((s) => s.defeatReason)
  const purchaseOpen = useDefenseStore((s) => s.purchaseOpen)
  const placing = useDefenseStore((s) => s.placing)
  const pauseOpen = useDefenseStore((s) => s.pauseOpen)
  const archerCooldownMs = useDefenseStore((s) => s.archerCooldownMs)
  const combo = useDefenseStore((s) => s.combo)
  const supportGauge = useDefenseStore((s) => s.supportGauge)
  const eventName = useDefenseStore((s) => s.eventName)
  const rewardChoices = useDefenseStore((s) => s.rewardChoices)
  const gold = useGameStore((s) => s.gold)
  const hp = useGameStore((s) => s.hp)
  const maxHp = useGameStore((s) => s.maxHp)
  const mp = useGameStore((s) => s.mp)
  const maxMp = useGameStore((s) => s.maxMp)

  useEffect(() => {
    const onState = (p: DefenseStatePayload) => useDefenseStore.getState().setFromEvent(p)
    const onPlaceMode = (v: boolean | string) => useDefenseStore.getState().setPlacing(v !== false)
    // 디펜스가 아닌 맵(성밖/감숙성)에 진입하면 HUD를 완전히 끈다
    const onEnd = () => useDefenseStore.getState().reset()
    EventBus.on(GameEvents.DEFENSE_STATE, onState)
    EventBus.on(GameEvents.DEFENSE_PLACE_MODE, onPlaceMode)
    EventBus.on(GameEvents.DEFENSE_END, onEnd)
    return () => {
      EventBus.off(GameEvents.DEFENSE_STATE, onState)
      EventBus.off(GameEvents.DEFENSE_PLACE_MODE, onPlaceMode)
      EventBus.off(GameEvents.DEFENSE_END, onEnd)
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const state = useDefenseStore.getState()
      const isBuyShortcut = event.code === 'KeyB' || event.key.toLowerCase() === 'b'
      if (!isBuyShortcut || !state.active || state.purchaseOpen || state.placing) return
      if (state.phase !== 'wait' && state.phase !== 'combat') return
      const ui = useUiStore.getState()
      if (ui.chatFocused || ui.settingsOpen || ui.keySettingsOpen || ui.cinematicOpen) return
      event.preventDefault()
      state.setPurchaseOpen(true)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])

  if (!active) return null

  const buyBarricade = (tier: 'low' | 'mid' | 'high', cost: number) => {
    if (gold < cost) return
    useDefenseStore.getState().setPurchaseOpen(false)
    useDefenseStore.getState().setPlacing(true)
    EventBus.emit(GameEvents.DEFENSE_PLACE_MODE, tier)
  }
  const buyOffensiveStructure = (kind: 'watchtower' | 'bastion', cost: number) => {
    if (gold < cost) return
    useDefenseStore.getState().setPurchaseOpen(false)
    useDefenseStore.getState().setPlacing(true)
    EventBus.emit(GameEvents.DEFENSE_PLACE_MODE, kind)
  }
  const buyRecovery = (kind: 'hp' | 'mp') => {
    const item = kind === 'hp' ? HP_POTION : MP_POTION
    const state = useGameStore.getState()
    const current = kind === 'hp' ? state.hp : state.mp
    const maximum = kind === 'hp' ? state.maxHp : state.maxMp
    if (state.gold < item.cost || current >= maximum) return
    state.setStats({
      gold: state.gold - item.cost,
      ...(kind === 'hp' ? { hp: Math.min(maximum, current + item.amount) } : { mp: Math.min(maximum, current + item.amount) }),
    })
  }
  const callArchers = () => EventBus.emit(GameEvents.DEFENSE_ARCHER_VOLLEY)
  const repair = (target: 'base' | 'barricades') => EventBus.emit(GameEvents.DEFENSE_REPAIR, target)
  const chooseUpgrade = (upgrade: DefenseUpgrade) => EventBus.emit(GameEvents.DEFENSE_CHOOSE_UPGRADE, upgrade)
  const cancelPlacing = () => {
    useDefenseStore.getState().setPlacing(false)
    EventBus.emit(GameEvents.DEFENSE_PLACE_MODE, false)
  }
  const exitDefense = () => {
    useDefenseStore.getState().reset()
    EventBus.emit(GameEvents.DEFENSE_EXIT)
  }

  // ESC 일시정지 메뉴
  const resumeGame = () => useDefenseStore.getState().setPauseOpen(false)
  const returnToLobby = () => {
    if (!window.confirm('대기실로 돌아가시겠습니까? 진행 중인 방어전은 사라집니다.')) return
    useDefenseStore.getState().setPauseOpen(false) // 씬 재개 후 언마운트 (pause 잔류 방지)
    useDefenseStore.getState().reset()
    useScreenStore.getState().setScreen('lobby')
  }
  const giveUp = () => {
    if (!window.confirm('방어전을 포기하고 감숙성으로 돌아가시겠습니까?')) return
    useDefenseStore.getState().setPauseOpen(false) // 씬 재개(트윈 복귀) 후 전환
    useDefenseStore.getState().reset()
    EventBus.emit(GameEvents.DEFENSE_EXIT)
  }

  const baseRatio = Math.max(0, Math.min(1, baseHp / maxBaseHp))

  return (
    <>
      {/* 상단중앙: 카운트다운 + 스테이지 정보 */}
      <div className="def-top">
        <div className="def-stage">STAGE {stage}</div>
        {eventName && <div className="def-event">{eventName}</div>}
        {phase === 'wait' && (
          <div className="def-timer def-timer--wait">
            대기 <span className="def-timer-num">{Math.ceil(timeLeftMs / 1000)}</span>
          </div>
        )}
        {phase === 'combat' && (
          <div className="def-timer def-timer--combat">{fmt(timeLeftMs)}</div>
        )}
        {(phase === 'combat' || phase === 'wait') && (
          <div className="def-info">
            <span className="def-zombies">🧟 남은 {zombiesLeft}</span>
            {combo >= 2 && <span className="def-combo">🔥 {combo} COMBO</span>}
            <span className="def-support">🏹 지원 {Math.round(supportGauge)}%</span>
            <div className="def-basehp">
              <span className="def-basehp-label">🏯 기지</span>
              <div className="def-basehp-track">
                <div className="def-basehp-fill" style={{ width: `${baseRatio * 100}%` }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Wave 임박 경고 — 깜빡이며 임박을 알린다 (대기 10초 내내) */}
      {phase === 'wait' && timeLeftMs > 0 && timeLeftMs <= WAVE_WARNING_MS && (
        <div className="def-wave-warning" role="alert">
          ⚠ 곧 Wave가 시작됩니다. Warning...!
        </div>
      )}

      {/* 배치 안내 (바리케이트 배치 대기 중) */}
      {placing && (
        <div className="def-place-hint">
          맵 하단을 클릭해 바리케이트를 설치하세요
          <button className="def-place-cancel" onClick={cancelPlacing}>취소</button>
        </div>
      )}

      {/* 하단중앙: 대기·전투 중 언제나 사용 가능한 보급소 */}
      {(phase === 'wait' || phase === 'combat') && !placing && (
        <button className="def-buy-btn" onClick={() => useDefenseStore.getState().setPurchaseOpen(true)}>
          <span>구매하기</span>
          <span className="def-buy-key">B</span>
        </button>
      )}

      {/* 구매 창 */}
      {purchaseOpen && (
        <div className="def-shop-backdrop" onClick={() => useDefenseStore.getState().setPurchaseOpen(false)}>
          <div className="def-shop" onClick={(e) => e.stopPropagation()}>
            <div className="def-shop-title">전장 보급소 · {gold} G</div>
            <div className="def-shop-section">방어 시설</div>
            <div className="def-shop-grid">
              {BARRICADES.map((item) => (
                <button key={item.tier} className="def-shop-item" onClick={() => buyBarricade(item.tier, item.cost)} disabled={gold < item.cost}>
                  <div className="def-shop-icon">{item.icon}</div>
                  <div className="def-shop-name">{item.name}</div>
                  <div className="def-shop-desc">HP {item.hp}</div>
                  <div className="def-shop-price">{item.cost} G</div>
                </button>
              ))}
            </div>
            <div className="def-shop-section">공격 방어 시설</div>
            <div className="def-shop-grid">
              {OFFENSIVE_STRUCTURES.map((item) => (
                <button key={item.kind} className="def-shop-item" onClick={() => buyOffensiveStructure(item.kind, item.cost)} disabled={gold < item.cost}>
                  <div className="def-shop-icon">{item.kind === 'watchtower' ? '🏹' : '💣'}</div>
                  <div className="def-shop-name">{item.name}</div>
                  <div className="def-shop-desc">HP {item.hp} · {item.desc}</div>
                  <div className="def-shop-price">{item.cost} G</div>
                </button>
              ))}
            </div>
            <div className="def-shop-section">회복 · 지원</div>
            <div className="def-shop-grid">
              <button className="def-shop-item" onClick={() => buyRecovery('hp')} disabled={gold < HP_POTION.cost || hp >= maxHp}>
                <div className="def-shop-icon">❤️</div><div className="def-shop-name">체력 물약</div>
                <div className="def-shop-desc">HP +{HP_POTION.amount}</div><div className="def-shop-price">{HP_POTION.cost} G</div>
              </button>
              <button className="def-shop-item" onClick={() => buyRecovery('mp')} disabled={gold < MP_POTION.cost || mp >= maxMp}>
                <div className="def-shop-icon">💧</div><div className="def-shop-name">마력 물약</div>
                <div className="def-shop-desc">MP +{MP_POTION.amount}</div><div className="def-shop-price">{MP_POTION.cost} G</div>
              </button>
              <button className="def-shop-item" onClick={callArchers} disabled={phase !== 'combat' || (supportGauge < 100 && gold < ARCHER_COST) || archerCooldownMs > 0 || zombiesLeft <= 0}>
                <div className="def-shop-icon">🏹</div><div className="def-shop-name">궁수 일제사격</div>
                <div className="def-shop-desc">전방 최대 5명{archerCooldownMs > 0 ? ` · ${Math.ceil(archerCooldownMs / 1000)}초` : ''}</div>
                <div className="def-shop-price">{supportGauge >= 100 ? '지원 게이지 사용' : `${ARCHER_COST} G`}</div>
              </button>
              <button className="def-shop-item" onClick={() => repair('base')} disabled={gold < 30 || baseHp >= maxBaseHp}>
                <div className="def-shop-icon">🏯</div><div className="def-shop-name">기지 수리</div>
                <div className="def-shop-desc">기지 HP +40</div><div className="def-shop-price">30 G</div>
              </button>
              <button className="def-shop-item" onClick={() => repair('barricades')} disabled={gold < 40}>
                <div className="def-shop-icon">🔨</div><div className="def-shop-name">방벽 정비</div>
                <div className="def-shop-desc">모든 방벽 35%</div><div className="def-shop-price">40 G</div>
              </button>
            </div>
            <button className="def-shop-close" onClick={() => useDefenseStore.getState().setPurchaseOpen(false)}>닫기</button>
          </div>
        </div>
      )}

      {/* 승리 배너 */}
      {phase === 'victory' && (
        <div className="def-banner def-banner--victory">
          <div className="def-banner-title">STAGE {stage} 클리어!</div>
          <div className="def-banner-sub">다음 전투를 위한 강화 하나를 선택하세요</div>
          <div className="def-upgrade-grid">
            {rewardChoices.map((upgrade) => {
              const info = UPGRADE_INFO[upgrade]
              return (
                <button className="def-upgrade" key={upgrade} onClick={() => chooseUpgrade(upgrade)}>
                  <span>{info.icon}</span><b>{info.name}</b><small>{info.desc}</small>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* 패배 오버레이 */}
      {phase === 'defeat' && (
        <div className="def-overlay">
          <div className="def-overlay-box">
            <div className="def-overlay-title">패배</div>
            <div className="def-overlay-sub">{(defeatReason && DEFEAT_MSG[defeatReason]) ?? '방어 실패'} · 도달 스테이지 {stage}</div>
            <button className="def-overlay-btn" onClick={exitDefense}>감숙성으로 나가기</button>
          </div>
        </div>
      )}

      {/* ESC 일시정지 메뉴 (디펜스 전용) */}
      {pauseOpen && (
        <div className="def-pause-backdrop">
          <div className="settings-menu">
            <div className="settings-title">일시정지</div>
            <button className="settings-item settings-item--dim" onClick={resumeGame}>게임으로 돌아가기 (ESC)</button>
            <details className="auto-settings-details">
              <summary>🤖 자동 전투 설정</summary>
              <AutoCombatControls />
            </details>
            <div className="settings-sep" />
            <button className="settings-item" onClick={returnToLobby}>🏠 대기실로 돌아가기</button>
            <button className="settings-item settings-item--danger" onClick={giveUp}>🏳 포기하기 (감숙성으로)</button>
          </div>
        </div>
      )}
    </>
  )
}
