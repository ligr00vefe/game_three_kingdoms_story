import { useEffect, useRef, useState } from 'react'
import { EventBus, GameEvents } from '../game/EventBus'

interface UnlockNotice { name: string; icon: string; level: number; id: number }

/** 레벨업으로 새 스킬을 얻었을 때 화면 상단에 잠깐 나타나는 알림. */
export function SkillUnlockNotice() {
  const [notice, setNotice] = useState<UnlockNotice | null>(null)
  const sequence = useRef(0)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const onUnlocked = (skill: Omit<UnlockNotice, 'id'>) => {
      if (timer) clearTimeout(timer)
      setNotice({ ...skill, id: ++sequence.current })
      timer = setTimeout(() => setNotice(null), 2600)
    }
    EventBus.on(GameEvents.SKILL_UNLOCKED, onUnlocked)
    return () => {
      if (timer) clearTimeout(timer)
      EventBus.off(GameEvents.SKILL_UNLOCKED, onUnlocked)
    }
  }, [])

  if (!notice) return null
  return (
    <div key={notice.id} className="skill-unlock-notice" role="status">
      <span className="skill-unlock-icon">{notice.icon}</span>
      <span><small>새로운 스킬 해금 · Lv.{notice.level}</small><b>{notice.name}</b></span>
    </div>
  )
}
