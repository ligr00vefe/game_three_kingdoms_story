import { useState } from 'react'
import { useUiStore } from '../stores/uiStore'

const GAME_CONTROLS = [
  { title: '이동', commands: [['방향키 / WASD', '캐릭터 이동'], ['Space', '점프'], ['S', '앉기 또는 상호작용'], ['K', '스킬 창 열기']] },
  { title: '전투', commands: [['J', '기본 공격'], ['1 - 7', '퀵슬롯 스킬 사용'], ['자동 전투', '가까운 적 공격 및 스킬 자동 사용']] },
  { title: '인터페이스', commands: [['F1', '전체 도움말 열기'], ['A', 'AI 명령어 예시 열기'], ['M', '미니맵 전환'], ['ESC', '현재 창 닫기 또는 설정 열기']] },
] as const

const COMMAND_GROUPS = [
  {
    title: '이동과 전투',
    commands: [
      ['앞으로 가 / 뒤로 가', '해당 방향으로 일정 거리 이동한 뒤 멈춥니다.'],
      ['점프 / 뛰어 / 도약해', '현재 진행 명령을 유지하면서 한 번 점프합니다.'],
      ['돌진 / 돌격 / 진격해', '앞으로 전진하며 적을 공격합니다.'],
      ['정지해서 싸워 / 여기서 대기하고 싸워', '이동하지 않고 공격 범위 안의 적만 공격합니다.'],
      ['놓친 적을 쫓아 / 쫒아', '디펜스에서 성으로 침투하는 적을 가까운 순서로 계속 섬멸합니다.'],
      ['계속 싸워 / 공격해', '현재 맵에서 가까운 적을 찾아 싸웁니다.'],
      ['후퇴해 / 물러나', '현재 위치에서 왼쪽으로 후퇴합니다.'],
      ['멈춰 / 대기해', '현재 행동을 중단하고 멈춥니다.'],
    ],
  },
  {
    title: '장소 이동',
    commands: [
      ['성 밖으로 가', '성문까지 이동한 뒤 성 밖 맵으로 나갑니다.'],
      ['성 밖으로 나가서 싸워', '성 밖으로 이동한 뒤 자동전투를 시작합니다.'],
      ['디펜스 아레나로 가', '성문까지 이동한 뒤 좀비 디펜스에 입장합니다.'],
    ],
  },
  {
    title: '디펜스 전용',
    commands: [
      ['앞에 바리케이트 설치', '관우가 바라보는 방향 앞에 바리케이트를 설치합니다.'],
      ['방벽 설치 / 방책 세워', '대기 시간·골드 조건을 확인한 뒤 방벽을 설치합니다.'],
    ],
  },
  {
    title: '방어와 복귀',
    commands: [
      ['성으로 돌아가 / 마을로 가', '현재 맵의 본진 방향으로 복귀합니다.'],
      ['성문을 지켜 / 성 앞을 사수해', '성문으로 이동한 뒤 주변을 방어합니다.'],
      ['여기를 지켜 / 이곳을 방어해', '현재 위치를 중심으로 주변을 방어합니다.'],
      ['수성을 최우선으로 해 / 성을 먼저 지켜', '성문 주변 제한 범위만 출전하고 멀어지면 복귀합니다.'],
    ],
  },
  {
    title: '대화와 정보',
    commands: [
      ['동탁에게 가서 말 걸어', '동탁에게 이동해 기존 NPC 대화를 시작합니다.'],
      ['상태 알려줘 / 체력 보고', '관우의 체력과 현재 행동 상태를 알려줍니다.'],
      ['전직은 어디서 해?', '게임 안의 전직 위치를 안내합니다.'],
    ],
  },
] as const

export function CommandHelpPanel() {
  const open = useUiStore((s) => s.commandHelpOpen)
  const [activeTab, setActiveTab] = useState<'controls' | 'ai'>('controls')
  if (!open) return null

  const close = () => useUiStore.getState().setCommandHelpOpen(false)

  return (
    <div className="ks-backdrop" onClick={close}>
      <div className="command-help" onClick={(event) => event.stopPropagation()}>
        <div className="command-help__header">
          <div>
            <span className="command-help__key">F1</span>
            <strong>게임 도움말</strong>
          </div>
          <button className="ks-close" onClick={close}>×</button>
        </div>

        <div className="command-help__tabs">
          <button className={activeTab === 'controls' ? 'command-help__tab command-help__tab--active' : 'command-help__tab'} onClick={() => setActiveTab('controls')}>게임 조작</button>
          <button className={activeTab === 'ai' ? 'command-help__tab command-help__tab--active' : 'command-help__tab'} onClick={() => setActiveTab('ai')}>AI 명령어</button>
        </div>
        {activeTab === 'controls' && (
          <div className="command-help__groups command-help__controls">
            {GAME_CONTROLS.map((group) => (
              <section key={group.title} className="command-help__group">
                <h3>{group.title}</h3>
                {group.commands.map(([command, description]) => (
                  <div key={command} className="command-help__row"><code>{command}</code><span>{description}</span></div>
                ))}
              </section>
            ))}
          </div>
        )}
        <div className={activeTab === 'ai' ? '' : 'command-help__panel-hidden'}>
        <p className="command-help__intro">
          <b>방향키·공격키로 직접 조작</b>하거나, <b>Enter</b>를 누르고 채팅창에 명령할 수 있습니다.
          키보드를 조작하면 진행 중이던 자동 명령은 취소되고 직접 조작으로 전환됩니다.
          공백과 느낌표는 달라도 됩니다. 예: <em>돌 진!!!</em>
        </p>

        <div className="command-help__groups">
          {COMMAND_GROUPS.map((group) => (
            <section key={group.title} className="command-help__group">
              <h3>{group.title}</h3>
              {group.commands.map(([command, description]) => (
                <div key={command} className="command-help__row">
                  <code>{command}</code>
                  <span>{description}</span>
                </div>
              ))}
            </section>
          ))}
        </div>

        <p className="command-help__note">
          ↑키로 기존 NPC·포탈에 상호작용할 수 있습니다. 마을에는 적이 없어 “계속 싸워”는 대기할 수 있으니 이동 명령은 “돌진”으로 확인하십시오.
        </p>
        </div>
        <div className="command-help__actions">
          <button className="command-help__key-settings" onClick={() => { close(); useUiStore.getState().setKeySettingsOpen(true) }}>단축키 설정</button>
          <button className="command-help__close" onClick={close}>확인 (A, F1 또는 ESC)</button>
        </div>
      </div>
    </div>
  )
}
