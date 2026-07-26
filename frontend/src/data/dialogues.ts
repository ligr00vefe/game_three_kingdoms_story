import { useGameStore } from '../stores/gameStore'
import { EventBus, GameEvents } from '../game/EventBus'
import { nextPromotion, titleForTier } from '../game/systems/playerAnimations'

/**
 * 메인 NPC 시네마틱 대화 스크립트 (GAME_DESIGN 9장).
 *
 * 문지기·수문장 같은 단순 NPC는 npcs.json의 `dialog` 배열(하단 한 줄 대화)로 끝나고,
 * 동탁처럼 npcs.json에 `main: true`가 붙은 NPC만 여기 정의된 노드 그래프를 따른다.
 * 대사 텍스트는 npcs.json이 아니라 이 파일에 둔다 — 선택지 분기와 전직 같은
 * 상태 변화가 대사와 한 몸이라 데이터/로직을 쪼개면 오히려 따라가기 어렵다.
 */
export interface DialogueChoice {
  /** 선택지 문구 — 화면에는 "1. 전직 문의" 처럼 번호가 붙어 나온다 */
  label: string
  /** 고정 분기: 이동할 노드 id. null이면 대화 종료 */
  next?: string | null
  /** 조건 분기: 고른 순간의 상태(레벨/직책)를 보고 노드를 정한다. next보다 우선 */
  resolve?: () => string
}

export interface DialogueNode {
  /** 순서대로 한 줄씩 출력할 대사. 상태에 따라 달라지면 함수로 준다 */
  lines: string[] | (() => string[])
  /** 대사를 다 읽은 뒤 뜨는 선택지 (대화창 위에 표시). 없으면 next로 넘어가거나 대화가 끝난다 */
  choices?: DialogueChoice[]
  /** 노드 진입 순간 1회 실행되는 효과 (전직 처리 등) — lines 평가보다 먼저 돌아간다 */
  onEnter?: () => void
  /** 선택지 없이 이어질 다음 노드 (없으면 대화 종료) */
  next?: string
}

export interface CinematicScript {
  /** 대화 시작 노드 id */
  start: string
  nodes: Record<string, DialogueNode>
}

/**
 * 전직 처리: 직책 티어를 1 올리고 외형 갱신을 요청한다.
 * 상위 티어 외형 아트가 아직 없으면 Player.refreshTier가 1티어 외형으로 폴백하므로
 * (큐빅 추락 버그 방지) 직책만 오르고 겉모습은 그대로다 — 아트가 들어오면 자동으로 살아난다.
 */
function promote() {
  const g = useGameStore.getState()
  g.setStats({ jobTier: g.jobTier + 1 })
  EventBus.emit(GameEvents.PROMOTED)
}

/** 전직 문의 결과 분기 — 최고 직책 / 레벨 부족 / 전직 성사 */
function resolvePromotion(): string {
  const { jobTier, level } = useGameStore.getState()
  const next = nextPromotion(jobTier)
  if (!next) return 'promo_max'
  return level >= next.minLevel ? 'promo_grant' : 'promo_deny'
}

export const CINEMATIC_DIALOGUES: Record<string, CinematicScript> = {
  // 동탁 — 감숙성의 군권을 쥔 성주. 전직(직책 임명) 창구를 겸한다.
  npc_castle_lord: {
    start: 'intro',
    nodes: {
      intro: {
        lines: [
          '동탁이 옥좌에 몸을 기댄 채 부채를 들어 그대를 가리킨다.',
          '관우 장군. 역병이 지나간 뒤 이 성의 안팎은 황건 잔당 좀비의 소굴이 되었소.',
          '나 동탁이 감숙성의 군권을 쥐고 있으니, 무장의 직책도 내 인장에서 나오오.',
        ],
        next: 'hub',
      },
      hub: {
        lines: ['무슨 일로 왔는가?'],
        choices: [
          { label: '전직 문의', resolve: resolvePromotion },
          { label: '대화 종료', next: 'outro' },
        ],
      },
      promo_deny: {
        lines: () => {
          const { jobTier, level } = useGameStore.getState()
          const next = nextPromotion(jobTier)!
          return [
            '동탁이 전공 명부를 훑어보더니 부채를 접는다.',
            `${next.name}의 인준은 아직 이르오. 전공을 더 쌓고 오시오.`,
            `— 필요 조건: Lv ${next.minLevel} 이상 (현재 Lv ${level})`,
          ]
        },
        next: 'hub',
      },
      promo_grant: {
        onEnter: promote,
        lines: () => {
          const { jobTier } = useGameStore.getState() // promote()로 이미 올라간 티어
          return [
            '동탁이 인준 문서에 인장을 눌러 그대에게 내민다.',
            `오늘부터 그대를 ${titleForTier(jobTier)}(으)로 봉하노라!`,
            '전공을 더 쌓으면 다시 나를 찾아오시오.',
          ]
        },
        next: 'hub',
      },
      promo_max: {
        lines: () => [
          `그대는 이미 ${titleForTier(useGameStore.getState().jobTier)}. 이 위의 직책은 조정에도 없소.`,
          '그 무예로 성 밖의 좀비들을 정리해 주시오.',
        ],
        next: 'hub',
      },
      // 마지막 대사 — 선택지도 next도 없으니 이 줄을 넘기면 대화가 닫힌다
      outro: {
        lines: ['동탁이 부채를 흔들어 물러가라는 뜻을 보인다.'],
      },
    },
  },
}
