/**
 * Phaser ↔ React 간 유일한 통신 채널.
 * - Phaser → React: 상태 이벤트 (game:*)
 * - React → Phaser: 커맨드 이벤트 (ui:*)
 * 양쪽이 서로를 직접 참조하는 것은 금지 (sidescroller-game-dev 규칙 2)
 *
 * 의도적으로 Phaser에 의존하지 않는 자체 이미터 사용:
 * React UI가 EventBus를 import해도 Phaser(~1.2MB)가 초기 번들에 포함되지 않아야
 * 게임 청크 지연 로드가 성립한다 (DEVELOPMENT_PLAN 문제 4).
 */
type Listener = { fn: (...args: never[]) => void; ctx?: unknown }

class MiniEmitter {
  private listeners = new Map<string, Listener[]>()

  on(event: string, fn: (...args: never[]) => void, ctx?: unknown) {
    const list = this.listeners.get(event) ?? []
    list.push({ fn, ctx })
    this.listeners.set(event, list)
    return this
  }

  off(event: string, fn?: (...args: never[]) => void, ctx?: unknown) {
    if (!fn) {
      this.listeners.delete(event)
      return this
    }
    const list = this.listeners.get(event)
    if (list) {
      this.listeners.set(event, list.filter((l) => l.fn !== fn || (ctx !== undefined && l.ctx !== ctx)))
    }
    return this
  }

  emit(event: string, ...args: unknown[]) {
    const list = this.listeners.get(event)
    if (!list) return this
    // 순회 중 on/off에 안전하도록 복사본 사용
    for (const l of [...list]) {
      ;(l.fn as (...a: unknown[]) => void).apply(l.ctx, args)
    }
    return this
  }
}

export const EventBus = new MiniEmitter()

// 이벤트 이름 상수 — 오타 방지를 위해 반드시 여기 등록 후 사용
export const GameEvents = {
  // Phaser → React
  HP_CHANGED: 'game:hp-changed',
  MP_CHANGED: 'game:mp-changed',
  EXP_CHANGED: 'game:exp-changed',
  LEVEL_UP: 'game:level-up',
  SCENE_READY: 'game:scene-ready',
  PLAYER_DIED: 'game:player-died',
  TOGGLE_INVENTORY: 'game:toggle-inventory',
  TOGGLE_QUEST: 'game:toggle-quest',
  TOGGLE_MINIMAP: 'game:toggle-minimap',
  /** 하단 단축키 버튼 등에서 스크린샷 요청 (GameScene가 캡처) */
  REQUEST_SCREENSHOT: 'ui:request-screenshot',
  OPEN_DIALOG: 'game:open-dialog',
  /** 관청 전직 신청 창 열기 (레벨 조건 충족 시) — PromotionPanel이 구독 */
  OPEN_PROMOTION: 'game:open-promotion',
  ITEM_PICKED: 'game:item-picked',
  /** 미니맵용 맵 요약 정보 {name, worldWidth, worldHeight, groundY, platforms, ladders, npcs} */
  MAP_INFO: 'game:map-info',
  /** 미니맵용 플레이어 위치 (약 100ms 간격) {x, y} */
  PLAYER_MOVED: 'game:player-moved',
  /** 수문장 옆 포탈 선택 메뉴 열기 요청 (성밖 타깃 payload {targetMap, targetX, targetY}) */
  PORTAL_MENU: 'game:portal-menu',
  /** 디펜스 상태 브로드캐스트 (phase/타이머/스테이지/좀비수/기지HP) — DefenseHud가 구독 */
  DEFENSE_STATE: 'game:defense-state',
  /** 디펜스가 아닌 맵으로 진입 — 디펜스 HUD를 강제로 끈다 (성밖/감숙성엔 현황판·구매 버튼 없음) */
  DEFENSE_END: 'game:defense-end',
  // React → Phaser
  USE_ITEM: 'ui:use-item',
  REVIVE: 'ui:revive',
  /** 채팅 전송 시 플레이어 머리 위 말풍선 (string) */
  CHAT_BUBBLE: 'ui:chat-bubble',
  /** 퀵슬롯 스킬 발동 요청 */
  CAST_SKILL: 'ui:cast-skill',
  /** 채팅 입력/설정 패널이 열린 동안 게임 키 입력 차단 (boolean) */
  INPUT_BLOCK: 'ui:input-block',
  /** 포탈 메뉴에서 "성밖으로" 선택 — 보관된 타깃으로 이동 */
  PORTAL_GO_OUTSIDE: 'ui:portal-go-outside',
  /** 포탈 메뉴에서 "탐험하기" 선택 — 디펜스 게임 진입 */
  PORTAL_ENTER_DEFENSE: 'ui:portal-enter-defense',
  /** 바리케이트 배치 대기 모드 on/off (boolean) — 켜지면 게임 클릭으로 설치 */
  DEFENSE_PLACE_MODE: 'ui:defense-place-mode',
  /** 디펜스 종료 후 감숙성으로 복귀 */
  DEFENSE_EXIT: 'ui:defense-exit',
  /** 디펜스 ESC 일시정지 메뉴 on/off (boolean) — 씬을 pause/resume 한다 */
  DEFENSE_PAUSE: 'ui:defense-pause',
  // 음향 훅 (지금은 구현하지 않음 — 자리만 확보, DEVELOPMENT_PLAN "이후" 항목)
  SFX: 'sfx:play',
} as const
