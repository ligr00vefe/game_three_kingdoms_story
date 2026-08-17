import { CHARACTERS } from './characters'
import { useScreenStore } from '../stores/screenStore'

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

export interface DialogueLine {
  text: string
  speaker?: string
  portrait?: string
}

export interface DialogueNode {
  /** 순서대로 한 줄씩 출력할 대사. 상태에 따라 달라지면 함수로 준다 */
  lines: (string | DialogueLine)[] | (() => (string | DialogueLine)[])
  /** 해금 완료 안내처럼 대화창 대신 화면 중앙 배너로 표시한다. */
  announcement?: boolean
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
  /** false면 ESC로 건너뛸 수 없는 필수 이벤트다. */
  dismissible?: boolean
}

export const CINEMATIC_DIALOGUES: Record<string, CinematicScript> = {
  unlock_zhaoyun: {
    start: 'meeting', dismissible: false,
    nodes: {
      meeting: {
        lines: [
          { speaker: '관우', portrait: '/assets/img/illustrator/char_big_guanwu_t2.png', text: '자룡! 지원을 청한 지 얼마 되지 않았거늘, 벌써 도착했는가.' },
          { speaker: '조운', portrait: '/assets/img/illustrator/char_big_zhaoyun_t2.png', text: '관 장군의 급보를 받고 곧장 달려왔습니다. 늦지는 않은 듯하군요.' },
          { speaker: '관우', portrait: '/assets/img/illustrator/char_big_guanwu_t2.png', text: '황건의 잔당이 좀비가 되어 성 밖을 어지럽히고 있네. 자네의 창이 필요하네.' },
          { speaker: '조운', portrait: '/assets/img/illustrator/char_big_zhaoyun_t2.png', text: '백성을 해치는 무리가 있다면 마다할 이유가 없습니다. 선봉은 제게 맡겨 주십시오.' },
          { speaker: '관우', portrait: '/assets/img/illustrator/char_big_guanwu_t2.png', text: '든든하군. 이제부터 한 편제로 움직이며 이 난세를 헤쳐 나가세.' },
          { speaker: '조운', portrait: '/assets/img/illustrator/char_big_zhaoyun_t2.png', text: '조자룡, 명을 받들겠습니다!' },
        ], next: 'unlocked',
      },
      unlocked: { announcement: true, lines: ['이제 조운을 사용할 수 있습니다.'] },
    },
  },
  unlock_lubu: {
    start: 'meeting', dismissible: false,
    nodes: {
      meeting: {
        lines: [
          { speaker: '여포', portrait: '/assets/img/illustrator/char_big_lubu_t2.png', text: '흥, 지나가던 길에 제법 시끄러운 싸움판이 보여 들렀더니 너희였군.' },
          { speaker: '관우', portrait: '/assets/img/illustrator/char_big_guanwu_t2.png', text: '여봉선인가. 이곳은 백성의 생사가 걸린 전장이다. 구경하러 왔다면 물러가라.' },
          { speaker: '조운', portrait: '/assets/img/illustrator/char_big_zhaoyun_t2.png', text: '하지만 그 무용이 소문과 같다면 힘을 보태는 것도 나쁘지 않겠지.' },
          { speaker: '여포', portrait: '/assets/img/illustrator/char_big_lubu_t2.png', text: '내게 힘을 보태 달라? 말은 바로 해라. 너희 편제가 내 뒤를 따르는 거다.' },
          { speaker: '관우', portrait: '/assets/img/illustrator/char_big_guanwu_t2.png', text: '오만함은 여전하군. 허나 창끝이 백성을 향하지 않는다면 함께 싸우지 못할 것도 없다.' },
          { speaker: '조운', portrait: '/assets/img/illustrator/char_big_zhaoyun_t2.png', text: '누가 앞서는지는 전장에서 가려 보도록 하지.' },
          { speaker: '여포', portrait: '/assets/img/illustrator/char_big_lubu_t2.png', text: '좋다. 특별히 너희 뒤편 편제에 내 이름을 올려 주마. 뒤처지지만 마라.' },
        ], next: 'unlocked',
      },
      unlocked: { announcement: true, lines: ['이제 여포를 사용할 수 있습니다.'] },
    },
  },
  // 동탁 — 감숙성의 군권을 쥔 성주. 전직(직책 임명) 창구를 겸한다.
  npc_castle_lord: {
    start: 'intro',
    nodes: {
      intro: {
        lines: () => [
          '동탁이 옥좌에 몸을 기댄 채 부채를 들어 그대를 가리킨다.',
          `${CHARACTERS[useScreenStore.getState().selectedCharacter]?.name ?? '관우'} 장군. 역병이 지나간 뒤 이 성의 안팎은 황건 잔당 좀비의 소굴이 되었소.`,
          '나 동탁이 감숙성의 군권을 쥐고 있으니, 무장의 직책도 내 인장에서 나오오.',
        ],
        next: 'hub',
      },
      hub: {
        lines: ['무슨 일로 왔는가?'],
        choices: [
          { label: '대화 종료', next: 'outro' },
        ],
      },
      // 마지막 대사 — 선택지도 next도 없으니 이 줄을 넘기면 대화가 닫힌다
      outro: {
        lines: ['동탁이 부채를 흔들어 물러가라는 뜻을 보인다.'],
      },
    },
  },
}
