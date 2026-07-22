import { useEffect } from 'react'
import { usePortalMenuStore } from '../stores/portalMenuStore'
import { EventBus, GameEvents } from '../game/EventBus'

/**
 * 감숙성 수문장 옆 포탈 선택 메뉴.
 * Phaser가 PORTAL_MENU를 emit하면 열리고, 선택에 따라 커맨드를 되쏜다:
 * - 성밖으로 → PORTAL_GO_OUTSIDE (기존 성 밖 이동)
 * - 탐험하기 → PORTAL_ENTER_DEFENSE (디펜스 게임 진입)
 */
export function PortalMenu() {
  const open = usePortalMenuStore((s) => s.open)

  useEffect(() => {
    const onOpen = () => usePortalMenuStore.getState().openMenu()
    EventBus.on(GameEvents.PORTAL_MENU, onOpen)
    return () => { EventBus.off(GameEvents.PORTAL_MENU, onOpen) }
  }, [])

  if (!open) return null

  const goOutside = () => {
    usePortalMenuStore.getState().close()
    EventBus.emit(GameEvents.PORTAL_GO_OUTSIDE)
  }
  const enterDefense = () => {
    usePortalMenuStore.getState().close()
    EventBus.emit(GameEvents.PORTAL_ENTER_DEFENSE)
  }
  const close = () => usePortalMenuStore.getState().close()

  return (
    <div className="portal-menu-backdrop" onClick={close}>
      <div className="portal-menu" onClick={(e) => e.stopPropagation()}>
        <div className="portal-menu-title">성문 앞</div>
        <p className="portal-menu-desc">어디로 향하시겠습니까?</p>
        <button className="portal-menu-btn" onClick={goOutside}>🏞️ 성밖으로</button>
        <button className="portal-menu-btn portal-menu-btn--accent" onClick={enterDefense}>⚔️ 디펜스 아레나</button>
        <button className="portal-menu-close" onClick={close}>닫기</button>
      </div>
    </div>
  )
}
