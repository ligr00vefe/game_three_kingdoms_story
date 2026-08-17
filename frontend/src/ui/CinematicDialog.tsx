import { useCallback, useEffect, useRef, useState } from 'react'
import { useCinematicStore, NO_CHOICES } from '../stores/cinematicStore'
import { useUiStore } from '../stores/uiStore'
import { CINEMATIC_DIALOGUES } from '../data/dialogues'
import { EventBus, GameEvents } from '../game/EventBus'

/** 타자기 효과 글자 간격(ms) */
const TYPE_MS = 22
/**
 * 대화를 여는 ↑ 키가 이 창의 "다음" 입력으로도 먹혀 첫 줄을 건너뛰는 것을 막는 유예(ms).
 * Phaser는 keydown 다음 프레임(update)에 대화를 열기 때문에 같은 키가 두 번 쓰일 수 있다.
 */
const OPEN_GRACE_MS = 250

/**
 * 메인 NPC 시네마틱 대화창 (GAME_DESIGN 9장).
 * 화면 암전 → 우하단에 전신 일러스트가 fade-left로 등장 → 하단 대화창 + (필요 시) 그 위에 선택지.
 * - 진행: ↑ / Enter / Space / 클릭 (타자기 진행 중이면 먼저 그 줄을 끝까지 표시)
 * - 선택: 숫자키 1~9 · ↑↓ 이동 후 Enter · 클릭
 * - ESC: 대화 종료
 * 단순 NPC(문지기·수문장)는 이 창을 쓰지 않고 DialogBox(하단 한 줄)로 처리한다.
 */
export function CinematicDialog() {
  const code = useCinematicStore((s) => s.code)
  const speaker = useCinematicStore((s) => s.speaker)
  const portrait = useCinematicStore((s) => s.portrait)
  const lines = useCinematicStore((s) => s.lines)
  const lineIndex = useCinematicStore((s) => s.lineIndex)
  const nodeId = useCinematicStore((s) => s.nodeId)
  const choicesVisible = useCinematicStore((s) => s.choicesVisible)
  const dismissible = useCinematicStore((s) => s.dismissible)
  const choices = useCinematicStore((s) => s.nodes[s.nodeId]?.choices ?? NO_CHOICES)
  const announcement = useCinematicStore((s) => s.nodes[s.nodeId]?.announcement ?? false)

  const [typedLen, setTypedLen] = useState(0)
  const [selected, setSelected] = useState(0)
  // 키 입력 핸들러에서 최신 선택 위치를 읽기 위한 거울 (state 갱신 함수 안에서 부수효과를 내지 않도록)
  const selectedRef = useRef(0)
  const openedAt = useRef(0)

  const entry = lines[lineIndex] ?? ''
  const line = typeof entry === 'string' ? entry : entry.text
  const activeSpeaker = typeof entry === 'string' ? speaker : (entry.speaker ?? speaker)
  const activePortrait = typeof entry === 'string' ? portrait : (entry.portrait ?? portrait)
  const typing = typedLen < line.length

  const pick = useCallback((index: number) => {
    setSelected(index)
    selectedRef.current = index
  }, [])

  /** 타자기 진행 중이면 우선 그 줄을 끝까지 보여주고, 아니면 다음으로 넘긴다 */
  const advance = useCallback(() => {
    if (typing) setTypedLen(line.length)
    else useCinematicStore.getState().advance()
  }, [typing, line])

  // Phaser의 상호작용 → 대화 시작. 스크립트가 없는 메인 NPC는 npcs.json의 dialog를 한 노드로 쓴다.
  useEffect(() => {
    const onOpen = (p: { code: string; name: string; portrait?: string; fallbackLines?: string[] }) => {
      const script = CINEMATIC_DIALOGUES[p.code]
      useCinematicStore.getState().open({
        code: p.code,
        speaker: p.name,
        portrait: p.portrait,
        start: script?.start ?? 'intro',
        nodes: script?.nodes ?? { intro: { lines: p.fallbackLines ?? [] } },
        dismissible: script?.dismissible,
      })
    }
    EventBus.on(GameEvents.OPEN_CINEMATIC, onOpen)
    return () => { EventBus.off(GameEvents.OPEN_CINEMATIC, onOpen) }
  }, [])

  // 대화 중에는 게임 키 입력 차단 (uiStore가 INPUT_BLOCK으로 Phaser에 전달)
  useEffect(() => {
    useUiStore.getState().setCinematicOpen(code !== null)
    if (code !== null) openedAt.current = performance.now()
    return () => { useUiStore.getState().setCinematicOpen(false) }
  }, [code])

  // 타자기 효과 — 줄이 바뀔 때마다 처음부터 다시 찍는다
  useEffect(() => {
    if (announcement) {
      setTypedLen(line.length)
      return
    }
    setTypedLen(0)
    if (!line) return
    let n = 0
    const timer = setInterval(() => {
      n += 1
      setTypedLen(n)
      if (n >= line.length) clearInterval(timer)
    }, TYPE_MS)
    return () => clearInterval(timer)
  }, [line, lineIndex, nodeId, announcement])

  // 선택지가 새로 뜨면 항상 첫 항목부터
  useEffect(() => { pick(0) }, [nodeId, choicesVisible, pick])

  useEffect(() => {
    if (code === null) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      // 대화를 연 그 키 입력이 곧바로 첫 줄을 넘기지 않도록
      if (performance.now() - openedAt.current < OPEN_GRACE_MS) return
      const store = useCinematicStore.getState()

      if (e.key === 'Escape') {
        e.preventDefault()
        if (store.dismissible) store.close()
        return
      }

      if (store.choicesVisible) {
        const list = store.nodes[store.nodeId]?.choices ?? NO_CHOICES
        if (list.length === 0) return
        const num = Number(e.key)
        if (Number.isInteger(num) && num >= 1 && num <= list.length) {
          e.preventDefault()
          store.choose(num - 1)
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          pick((selectedRef.current - 1 + list.length) % list.length)
        } else if (e.key === 'ArrowDown') {
          e.preventDefault()
          pick((selectedRef.current + 1) % list.length)
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          store.choose(selectedRef.current)
        }
        return
      }

      if (e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        advance()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [code, advance, pick])

  if (code === null) return null

  return (
    <div className={`cine-overlay${announcement ? ' cine-overlay--announcement' : ''}`} onClick={advance}>
      {!announcement && activePortrait && <img className="cine-portrait" src={activePortrait} alt={activeSpeaker} draggable={false} />}
      {announcement ? (
        <div className="cine-unlock-banner">
          <span className="cine-unlock-title">새로운 무장 해금</span>
          <p>{line}</p>
          <small>Enter / 클릭으로 확인</small>
        </div>
      ) : <div className="cine-bottom">
        {choicesVisible && choices.length > 0 && (
          <ul className="cine-choices">
            {choices.map((c, i) => (
              <li key={c.label}>
                <button
                  className={`cine-choice${i === selected ? ' cine-choice--on' : ''}`}
                  onMouseEnter={() => pick(i)}
                  onClick={(e) => { e.stopPropagation(); useCinematicStore.getState().choose(i) }}
                >
                  <span className="cine-choice-no">{i + 1}.</span> {c.label}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="cine-box">
          <div className="cine-name">{activeSpeaker}</div>
          <p className="cine-text">{line.slice(0, typedLen)}</p>
          <span className="cine-hint">
            {choicesVisible
              ? '숫자키 · ↑↓ + Enter · 클릭으로 선택'
              : typing ? '' : `↑ / Enter / 클릭 — 계속${dismissible ? ' (ESC 대화 종료)' : ''}`}
          </span>
        </div>
      </div>}
    </div>
  )
}
