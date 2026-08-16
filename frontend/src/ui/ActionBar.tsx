import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuickslotStore, QUICKSLOT_COUNT } from '../stores/quickslotStore'
import type { QSEntry } from '../stores/quickslotStore'
import { useInventoryStore } from '../stores/inventoryStore'
import { useUiStore } from '../stores/uiStore'
import { EventBus, GameEvents } from '../game/EventBus'
import { getSkillsForCharacter } from '../stores/skillStore'
import { useScreenStore } from '../stores/screenStore'

const QUICKSLOT_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7'] as const
const QUICKSLOT_LABELS = ['1', '2', '3', '4', '5', '6', '7'] as const

type SkillStatus = { cooldownLeftMs: number; cooldownMs: number; mp: number; mpCost: number; available: boolean }

/**
 * 퀵슬롯 액션바 (우하단, 단축키 안내바 위, 1~7 숫자키).
 * - 인벤토리 아이템/스킬 칩을 드래그해 등록 (④)
 * - 등록된 칸을 드래그해 바깥에 놓으면 해제 (⑤)
 * - 점유 칸에 드롭하면 기존 항목이 마우스에 붙음 → 다른 칸 클릭 배치/교체, 바깥 클릭 소멸 (⑥)
 * - 숫자키 1~7로 사용/발동 (⑦)
 */
export function ActionBar() {
  const slots = useQuickslotStore((s) => s.slots)
  const held = useQuickslotStore((s) => s.held)
  const invSlots = useInventoryStore((s) => s.slots)
  const defs = useInventoryStore((s) => s.defs)
  const [flash, setFlash] = useState<number | null>(null)
  const heldRef = useRef<HTMLDivElement>(null)
  const [skillStatuses, setSkillStatuses] = useState<Record<string, SkillStatus>>({})
  const selectedCharacter = useScreenStore((s) => s.selectedCharacter)

  useEffect(() => {
    const onSkillStatus = (status: { skills?: Record<string, SkillStatus> }) => setSkillStatuses(status.skills ?? {})
    EventBus.on(GameEvents.SKILL_STATUS, onSkillStatus)
    return () => {
      EventBus.off(GameEvents.SKILL_STATUS, onSkillStatus)
    }
  }, [])

  // 숫자키 1~7 (채팅/설정 중에는 무시)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const idx = QUICKSLOT_KEYS.indexOf(e.code as typeof QUICKSLOT_KEYS[number])
      if (idx < 0) return
      const ui = useUiStore.getState()
      if (ui.chatFocused || ui.settingsOpen || ui.keySettingsOpen) return
      e.preventDefault()
      useQuickslotStore.getState().trigger(idx)
      setFlash(idx)
      setTimeout(() => setFlash(null), 180)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // held 항목: 마우스를 따라다니고, 퀵슬롯 밖을 클릭하면 소멸 (⑥)
  useEffect(() => {
    if (!held) return
    const onMove = (e: MouseEvent) => {
      const el = heldRef.current
      if (el) {
        el.style.left = `${e.clientX + 10}px`
        el.style.top = `${e.clientY + 10}px`
      }
    }
    const onClick = (e: MouseEvent) => {
      if ((e.target as Element | null)?.closest?.('.aqs-slot')) return // 칸 클릭은 placeHeld가 처리
      useQuickslotStore.getState().discardHeld()
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('click', onClick)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('click', onClick)
    }
  }, [held])

  const entryView = (entry: QSEntry) => {
    if (entry.kind === 'skill') {
      const info = getSkillsForCharacter(selectedCharacter).find((skill) => skill.code === entry.code)
      return { label: info?.name ?? entry.code, icon: info?.icon ?? '✦', iconImage: info?.iconImage, rotated: false, color: '#66bb6a', count: null as number | null }
    }
    const def = defs[entry.code]
    const count = invSlots.reduce((n, s) => (s?.code === entry.code ? n + s.quantity : n), 0)
    return { label: def?.name ?? entry.code, icon: def?.name.charAt(0) ?? '?', iconImage: undefined, rotated: false, color: '#ef5350', count }
  }

  const onDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.stopPropagation()
    let data: { type?: string; code?: string; index?: number; itemType?: string } = {}
    try { data = JSON.parse(e.dataTransfer.getData('text/plain')) } catch { return }
    const qs = useQuickslotStore.getState()
    if (data.type === 'quickslot' && data.index !== undefined) {
      qs.moveSlot(data.index, index)
    } else if (data.type === 'skill' && data.code) {
      qs.dropOn(index, { kind: 'skill', code: data.code })
    } else if (data.type === 'inv-item' && data.code && data.itemType === 'CONSUME') {
      qs.dropOn(index, { kind: 'item', code: data.code }) // 소비 아이템만 퀵슬롯 등록
    }
  }

  return (
    <>
      <div className="actionbar">
        {Array.from({ length: QUICKSLOT_COUNT }, (_, i) => {
          const entry = slots[i]
          const v = entry ? entryView(entry) : null
          const skillStatus = entry?.kind === 'skill' ? skillStatuses[entry.code] : undefined
          const skillBlocked = entry?.kind === 'skill' && !!skillStatus && !skillStatus.available
          const cooldownProgress = skillStatus && skillStatus.cooldownMs > 0
            ? Math.max(0, Math.min(1, skillStatus.cooldownLeftMs / skillStatus.cooldownMs))
            : 0
          return (
            <div
              key={i}
              className={`aqs-slot ${flash === i ? 'aqs-slot--flash' : ''} ${skillBlocked ? 'aqs-slot--skill-disabled' : ''}`}
              draggable={!!entry && !held}
              onDragStart={(e) => {
                if (!entry) return
                e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'quickslot', index: i }))
                e.dataTransfer.effectAllowed = 'move'
              }}
              onDragEnd={(e) => {
                // 퀵슬롯 밖(유효 드롭 대상 없음)에 놓으면 등록 해제 (⑤)
                if (e.dataTransfer.dropEffect === 'none') useQuickslotStore.getState().clearSlot(i)
              }}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
              onDrop={(e) => onDrop(e, i)}
              onClick={() => {
                if (held) useQuickslotStore.getState().placeHeld(i)
                else if (entry && !skillBlocked) useQuickslotStore.getState().trigger(i)
              }}
              title={v ? `${v.label} (${QUICKSLOT_LABELS[i]}키)` : `빈 슬롯 — 아이템/스킬을 드래그해 등록 (${QUICKSLOT_LABELS[i]}키)`}
            >
              <span className="aqs-num">{QUICKSLOT_LABELS[i]}</span>
              {v && (
                <span className={`aqs-icon ${v.rotated ? 'aqs-icon--rotated-spear' : ''}`} style={{ background: v.color }}>
                  {v.iconImage ? <img src={v.iconImage} alt="" /> : v.icon.startsWith('/') ? <img src={v.icon} alt="" /> : v.icon}
                  {v.count !== null && <em className="aqs-count">{v.count}</em>}
                  {entry?.kind === 'skill' && skillBlocked && (
                    <span
                      className="aqs-cooldown"
                      style={{ background: `conic-gradient(rgba(8, 10, 15, 0.78) ${cooldownProgress * 360}deg, transparent 0)` }}
                    >
                      <em>{skillStatus && skillStatus.cooldownLeftMs > 0 ? Math.ceil(skillStatus.cooldownLeftMs / 1000) : 'MP'}</em>
                    </span>
                  )}
                </span>
              )}
            </div>
          )
        })}
      </div>
      {/* 마우스에 붙은(교체로 밀려난) 항목 — 인터페이스 축소 래퍼(.ui-overlay)의 transform 영향을
          받지 않도록 body에 직접 포탈링 (그 안에 있으면 fixed 좌표 기준이 뒤틀림) */}
      {held && createPortal(
        <div ref={heldRef} className="aqs-held">
          <span className={`aqs-icon ${entryView(held).rotated ? 'aqs-icon--rotated-spear' : ''}`} style={{ background: entryView(held).color }}>
            {entryView(held).iconImage ? <img src={entryView(held).iconImage} alt="" /> : entryView(held).icon}
          </span>
        </div>,
        document.body,
      )}
    </>
  )
}
