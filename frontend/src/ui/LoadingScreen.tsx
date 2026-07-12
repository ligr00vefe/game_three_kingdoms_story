import { useEffect, useState } from 'react'
import { EventBus, GameEvents } from '../game/EventBus'
import { useScreenStore } from '../stores/screenStore'
import { CHARACTERS } from '../data/characters'

/** 로딩 화면 최소 표시 시간 — 씬이 순식간에 떠도 깜빡임 없이 보이게 */
const MIN_SHOW_MS = 1600
/** 페이드아웃 시간 (CSS transition과 일치) */
const FADE_MS = 450

/**
 * 로딩 화면: 선택한 캐릭터가 가운데서 걷고 머리 위에 Now Loading… 표시.
 * Phaser가 뒤에서 마운트/부팅되고, SCENE_READY + 최소 표시 시간이 지나면
 * 페이드아웃 후 game 화면으로 전환한다.
 */
export function LoadingScreen() {
  const [fading, setFading] = useState(false)
  const charName = CHARACTERS[useScreenStore.getState().selectedCharacter]?.name ?? '관우'

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
        {/* 걷기 모션 placeholder — AI 걷기 스프라이트 도입 시 교체 (AI_UI_PROMPTS.md L2) */}
        <div className="load-char">
          <span className="load-char-face" />
          <span className="load-char-beard" />
          <span className="load-char-body" />
          <span className="load-char-blade" />
          <span className="load-char-leg load-char-leg--l" />
          <span className="load-char-leg load-char-leg--r" />
        </div>
        <div className="loading-ground" />
        <p className="loading-tip">{charName} 장군이 업성으로 향하는 중…</p>
      </div>
    </div>
  )
}
