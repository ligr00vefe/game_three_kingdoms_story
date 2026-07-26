import { create } from 'zustand'
import type { DialogueChoice, DialogueNode } from '../data/dialogues'

/**
 * 메인 NPC 시네마틱 대화 진행 상태 (노드 그래프 워커).
 * 대사 텍스트/분기는 data/dialogues.ts가 정의하고, 여기서는 "지금 어느 노드의 몇 번째 줄인지"만 다룬다.
 * 대화 중에는 게임 키 입력을 막는다 — 차단은 CinematicDialog가 uiStore.cinematicOpen으로 전달.
 */
interface OpenPayload {
  code: string
  speaker: string
  /** 우하단 전신 일러스트 경로 (없으면 일러스트 없이 대화만) */
  portrait?: string
  start: string
  nodes: Record<string, DialogueNode>
}

interface CinematicState {
  /** 진행 중인 NPC code — null이면 대화창 닫힘 */
  code: string | null
  speaker: string
  portrait?: string
  nodes: Record<string, DialogueNode>
  nodeId: string
  /** 현재 노드의 대사(함수형 lines를 평가한 결과) */
  lines: string[]
  lineIndex: number
  /** 마지막 대사까지 읽어 선택지가 뜬 상태 */
  choicesVisible: boolean
  open: (p: OpenPayload) => void
  /** 다음 대사 → (마지막이면) 선택지 표시 / 다음 노드 / 대화 종료 */
  advance: () => void
  choose: (index: number) => void
  close: () => void
}

/** 선택지 없는 노드용 고정 빈 배열 — 셀렉터가 매번 새 배열을 만들지 않게 공유한다 */
export const NO_CHOICES: DialogueChoice[] = []

export const useCinematicStore = create<CinematicState>((set, get) => {
  /** 노드 진입: onEnter 실행 → lines 평가 → 첫 줄부터 재생 */
  const goto = (nodeId: string) => {
    const node = get().nodes[nodeId]
    if (!node) {
      get().close()
      return
    }
    node.onEnter?.()
    const lines = typeof node.lines === 'function' ? node.lines() : node.lines
    set({
      nodeId,
      lines,
      lineIndex: 0,
      // 대사가 없는 선택지 전용 노드도 허용 (바로 선택지 표시)
      choicesVisible: lines.length === 0 && (node.choices?.length ?? 0) > 0,
    })
    if (lines.length === 0 && !node.choices?.length) get().close()
  }

  return {
    code: null,
    speaker: '',
    portrait: undefined,
    nodes: {},
    nodeId: '',
    lines: [],
    lineIndex: 0,
    choicesVisible: false,

    open: (p) => {
      set({ code: p.code, speaker: p.speaker, portrait: p.portrait, nodes: p.nodes })
      goto(p.start)
    },

    advance: () => {
      const { code, lines, lineIndex, choicesVisible, nodes, nodeId } = get()
      if (!code || choicesVisible) return // 선택지가 떠 있으면 선택만 받는다
      if (lineIndex + 1 < lines.length) {
        set({ lineIndex: lineIndex + 1 })
        return
      }
      const node = nodes[nodeId]
      if (node?.choices?.length) set({ choicesVisible: true })
      else if (node?.next) goto(node.next)
      else get().close()
    },

    choose: (index) => {
      const s = get()
      if (!s.code || !s.choicesVisible) return
      const choice = (s.nodes[s.nodeId]?.choices ?? NO_CHOICES)[index]
      if (!choice) return
      const target = choice.resolve ? choice.resolve() : choice.next
      if (!target) s.close()
      else goto(target)
    },

    close: () => set({
      code: null, speaker: '', portrait: undefined,
      nodes: {}, nodeId: '', lines: [], lineIndex: 0, choicesVisible: false,
    }),
  }
})
