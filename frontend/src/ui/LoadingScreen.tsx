import { useEffect, useState } from 'react'
import { EventBus, GameEvents } from '../game/EventBus'
import { useScreenStore } from '../stores/screenStore'

/** 로딩 화면 최소 표시 시간 — 씬이 순식간에 떠도 깜빡임 없이 보이게 */
const MIN_SHOW_MS = 1600
/** 페이드아웃 시간 (CSS transition과 일치) */
const FADE_MS = 450

/**
 * 로딩 중 보여주는 게임 안내 문구 — 매 로딩마다 하나를 무작위로 뽑는다.
 * 조작·수치는 실제 구현에 맞춰둔 값이라 사양이 바뀌면 여기도 같이 고쳐야 한다
 * (키: keybindingStore.DEFAULT_BINDINGS / 해금 레벨: skillStore.SKILLS / 직책: playerAnimations.TITLES).
 */
const TIPS: readonly string[] = [
  '전공을 쌓은 뒤 감숙성 관청의 전공관에게 전직을 신청하면 직책과 외형이 오릅니다.',
  '무명소졸에서 시작해 의병장·장수·한수정후를 거쳐 무신에 이릅니다.',
  '첫 스킬 참마돌격은 레벨 2에 해금됩니다. 이후 언월난무·일격필살·청룡참·뇌신강림이 차례로 열립니다.',
  '사다리와 줄은 ↑/↓로 오르내립니다. 점프키를 누르면 뛰어내릴 수 있습니다.',
  '사다리에서 방향키와 점프키를 함께 누르면 그 방향으로 몸을 던집니다.',
  '포탈 앞에서 ↑키를 누르면 다른 지역으로 이동합니다.',
  '공중에서 점프키를 한 번 더 누르면 이단 점프, 방향키와 함께 누르면 점프 대쉬가 나갑니다.',
  '성 밖은 역병 이후 황건 잔당 좀비들의 소굴이 되었습니다. 몸조심하십시오.',
  '감숙성 안은 안전지대입니다. 좀비가 성벽을 넘지 못합니다.',
  'ESC를 누르면 설정 메뉴가 열립니다. 단축키는 원하는 대로 바꿀 수 있습니다.',
  'K를 누르면 스킬창, S를 누르면 능력치창이 열립니다.',
  '게임 속 재화로 새로운 캐릭터를 고용할 수 있습니다.',
]

/** 로딩 1회당 문구 하나 — 리렌더마다 바뀌지 않도록 마운트 시점에 한 번만 뽑는다 */
const pickTip = () => TIPS[Math.floor(Math.random() * TIPS.length)]

/**
 * 로딩 화면: 가운데 'Now Loading…' + 무작위 게임 안내 문구.
 * Phaser가 뒤에서 마운트/부팅되고, SCENE_READY + 최소 표시 시간이 지나면
 * 페이드아웃 후 game 화면으로 전환한다.
 */
export function LoadingScreen() {
  const [fading, setFading] = useState(false)
  const [tip] = useState(pickTip)

  useEffect(() => {
    let sceneReady = false
    let minElapsed = false
    let done = false

    const tryFinish = () => {
      if (done || !sceneReady || !minElapsed) return
      done = true
      setFading(true)
      setTimeout(() => useScreenStore.getState().setScreen('game'), FADE_MS)
    }

    const onReady = () => { sceneReady = true; tryFinish() }
    EventBus.on(GameEvents.SCENE_READY, onReady)
    const timer = setTimeout(() => { minElapsed = true; tryFinish() }, MIN_SHOW_MS)

    return () => {
      EventBus.off(GameEvents.SCENE_READY, onReady)
      clearTimeout(timer)
    }
  }, [])

  return (
    <div className={`loading ${fading ? 'loading--fade' : ''}`}>
      <div className="loading-center">
        <p className="loading-text">
          Now Loading<span className="loading-dots"><i>.</i><i>.</i><i>.</i></span>
        </p>
        <div className="loading-tip-box">
          <span className="loading-tip-label">TIP</span>
          <p className="loading-tip">{tip}</p>
        </div>
      </div>
    </div>
  )
}
