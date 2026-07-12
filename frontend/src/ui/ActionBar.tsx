import { useEffect, useRef, useState } from 'react'
import { useQuickslotStore, QUICKSLOT_COUNT } from '../stores/quickslotStore'
import type { QSEntry } from '../stores/quickslotStore'
import { useInventoryStore } from '../stores/inventoryStore'
import { useUiStore } from '../stores/uiStore'

const SKILL_INFO: Record<string, { name: string; icon: string }> = {
  skill_charge_slash: { name: '참마돌격', icon: '⚡' },
  skill_glaive_flurry: { name: '언월난무', icon: '🌀' },
  skill_decisive_strike: { name: '일격필살', icon: '💀' },
  skill_dragon_slash: { name: '청룡참', icon: '🐉' },
  skill_lightning_descent: { name: '뇌신강림', icon: '🌩️' },
}

/**
 * 퀵슬롯 액션바 (체력바 오른쪽, 1~7 숫자키).
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

  // 숫자키 1~7 (채팅/설정 중에는 무시)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const m = /^Digit([1-7])$/.exec(e.code)
      if (!m) return
      const ui = useUiStore.getState()
      if (ui.chatFocused || ui.settingsOpen || ui.keySettingsOpen) return
      const idx = Number(m[1]) - 1
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
      const info = SKILL_INFO[entry.code]
      return { label: info?.name ?? entry.code, icon: info?.icon ?? '✦', color: '#66bb6a', count: null as number | null }
    }
    const def = defs[entry.code]
    const count = invSlots.reduce((n, s) => (s?.code === entry.code ? n + s.quantity : n), 0)
    return { label: def?.name ?? entry.code, icon: def?.name.charAt(0) ?? '?', color: '#ef5350', count }
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
          return (
            <div
              key={i}
              className={`aqs-slot ${flash === i ? 'aqs-slot--flash' : ''}`}
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
                else if (entry) useQuickslotStore.getState().trigger(i)
              }}
              title={v ? `${v.label} (${i + 1}키)` : `빈 슬롯 — 아이템/스킬을 드래그해 등록 (${i + 1}키)`}
            >
              <span className="aqs-num">{i + 1}</span>
              {v && (
                <span className="aqs-icon" style={{ background: v.color }}>
                  {v.icon}
                  {v.count !== null && <em className="aqs-count">{v.count}</em>}
                </span>
              )}
            </div>
          )
        })}
      </div>
      {/* 마우스에 붙은(교체로 밀려난) 항목 */}
      {held && (
        <div ref={heldRef} className="aqs-held">
          <span className="aqs-icon" style={{ background: entryView(held).color }}>{entryView(held).icon}</span>
        </div>
      )}
    </>
  )
}
