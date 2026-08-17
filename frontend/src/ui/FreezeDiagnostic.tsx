import { useEffect, useState } from 'react'
import { EventBus, GameEvents } from '../game/EventBus'

export interface FreezeDiagnosticPayload {
  kind: 'runtime-error' | 'freeze'
  at: string
  message?: string
  stack?: string
  state?: Record<string, unknown>
}

export function FreezeDiagnostic() {
  const [diagnostic, setDiagnostic] = useState<FreezeDiagnosticPayload | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const show = (payload: FreezeDiagnosticPayload) => {
      setCopied(false)
      setDiagnostic(payload)
    }
    EventBus.on(GameEvents.FREEZE_DIAGNOSTIC, show)
    return () => { EventBus.off(GameEvents.FREEZE_DIAGNOSTIC, show) }
  }, [])

  if (!diagnostic) return null
  const report = JSON.stringify(diagnostic, null, 2)

  return (
    <div className="freeze-diagnostic" role="alert">
      <div className="freeze-diagnostic__title">
        오류 발생 로그 출력
        <button onClick={() => window.location.reload()} aria-label="새로고침" title="게임 새로고침">×</button>
      </div>
      <p>아래의 비정상적인 게임 증상을 감지하고 로그를 출력했습니다.</p>
      <pre>{report}</pre>
      <button onClick={() => void navigator.clipboard.writeText(report).then(() => setCopied(true))}>
        {copied ? '복사됨' : '진단 내용 복사'}
      </button>
    </div>
  )
}
