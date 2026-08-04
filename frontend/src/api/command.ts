import { validateCommand, type GuanYuCommand } from '../game/ai/commands'

interface CommandContext {
  mapKey: string
  mode: 'normal' | 'defense'
  characterState: string
  hp: number
  maxHp: number
}

export async function interpretWithLocalAi(text: string, context: CommandContext): Promise<GuanYuCommand> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 45_000)
  try {
    const response = await fetch('/api/game/command/interpret', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, context }),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`Local AI HTTP ${response.status}`)
    return validateCommand(await response.json())
  } catch {
    return validateCommand({
      action: 'UNSUPPORTED', priority: 'NORMAL', reason: 'LOCAL_AI_UNAVAILABLE',
      reply: '로컬 AI가 응답하지 않습니다. 기본 명령으로 다시 말씀해 주십시오.',
    })
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function chatWithLocalAi(text: string, context: CommandContext): Promise<string> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 120_000)
  try {
    const response = await fetch('/api/game/command/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, context }),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`Local AI chat HTTP ${response.status}`)
    const data = await response.json() as { reply?: string }
    return data.reply?.trim() || '무슨 말씀이신지 조금 더 자세히 말씀해 주십시오.'
  } catch {
    return '로컬 AI가 응답하지 않습니다. 잠시 후 다시 말씀해 주십시오.'
  } finally {
    window.clearTimeout(timeout)
  }
}

