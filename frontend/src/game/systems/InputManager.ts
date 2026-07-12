import Phaser from 'phaser'
import { useKeybindingStore } from '../../stores/keybindingStore'
import type { GameAction } from '../../stores/keybindingStore'

/**
 * 키 입력 전담 (GAME_DESIGN 3장 키 배치).
 * - 이동(←→↑↓)은 고정, 나머지 액션 키는 keybindingStore 바인딩(KeyboardEvent.code)을 따른다
 *   → 단축키 세팅에서 저장하면 즉시 반영된다
 * - 공중 액션(점프 대쉬/이단 점프)은 점프키 재입력으로 발동 — 판정은 Player가 담당
 * 씬마다 새로 만들며, Player는 이 클래스의 판정 결과만 읽는다.
 */
export class InputManager {
  readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys
  /** 현재 눌려 있는 code 집합 */
  private pressed = new Set<string>()
  /** 프레임 사이에 들어온 keydown 버퍼 — update()에서 justPressed로 승격 */
  private pending = new Set<string>()
  /** 이번 프레임에 막 눌린 code 집합 */
  private justPressed = new Set<string>()

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard!
    this.cursors = kb.createCursorKeys()

    kb.on('keydown', this.handleKeyDown)
    kb.on('keyup', this.handleKeyUp)
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      kb.off('keydown', this.handleKeyDown)
      kb.off('keyup', this.handleKeyUp)
    })

    // 이동키가 브라우저 스크롤을 건드리지 않게 캡처 (액션 키는 handleKeyDown에서 preventDefault)
    kb.addCapture([
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
    ])
  }

  private handleKeyDown = (event: KeyboardEvent) => {
    // 바인딩된 키는 브라우저 기본 동작(스크롤/메뉴 포커스 등)을 막는다
    if (useKeybindingStore.getState().bindings[event.code]) event.preventDefault()
    if (event.repeat || this.pressed.has(event.code)) return
    this.pressed.add(event.code)
    this.pending.add(event.code)
  }

  private handleKeyUp = (event: KeyboardEvent) => {
    this.pressed.delete(event.code)
  }

  /** 채팅/설정 패널 진입 등으로 입력이 차단될 때 잔여 키 상태를 비운다 */
  clearAll() {
    this.pressed.clear()
    this.pending.clear()
    this.justPressed.clear()
  }

  /** 매 프레임 1회 호출 — justPressed 승격 */
  update(_now: number) {
    this.justPressed = this.pending
    this.pending = new Set()
  }

  private actionDown(action: GameAction): boolean {
    const bindings = useKeybindingStore.getState().bindings
    for (const code of this.pressed) {
      if (bindings[code] === action) return true
    }
    return false
  }

  private actionJustDown(action: GameAction): boolean {
    const bindings = useKeybindingStore.getState().bindings
    for (const code of this.justPressed) {
      if (bindings[code] === action) return true
    }
    return false
  }

  get left() { return this.cursors.left!.isDown }
  get right() { return this.cursors.right!.isDown }
  get up() { return this.cursors.up!.isDown }
  get upJustDown() { return Phaser.Input.Keyboard.JustDown(this.cursors.up!) }
  get down() { return this.cursors.down!.isDown }
  get jumpDown() { return this.actionDown('jump') }
  get jumpJustDown() { return this.actionJustDown('jump') }
  get attackJustDown() { return this.actionJustDown('attack') }
  get pickupJustDown() { return this.actionJustDown('pickup') }
  get sitJustDown() { return this.actionJustDown('sit') }
  get inventoryJustDown() { return this.actionJustDown('item') }
  get questJustDown() { return this.actionJustDown('quest') }
  get minimapJustDown() { return this.actionJustDown('minimap') }
  get screenshotJustDown() { return this.actionJustDown('screenshot') }
}
