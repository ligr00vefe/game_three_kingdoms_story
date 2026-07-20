import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { CHARACTERS, LOBBY_SLOTS } from '../data/characters'
import { useScreenStore } from '../stores/screenStore'

/**
 * 두루마리가 말리거나 펴지는 데 걸리는 시간(ms).
 * CSS에 --roll-ms로 내려보내 transition 시간으로 쓰므로 **여기 한 곳만 고치면 된다**
 * (CSS에 숫자를 따로 적으면 둘이 어긋나 내용이 덜 펴진 채로 바뀐다).
 */
const ROLL_MS = 420

/**
 * 군막사 배경(bg_barracks.jpg, 1536×1024)의 의자 좌석 위치 — **배경 이미지 기준 백분율**.
 * .lobby-stage를 배경과 같은 3:2로 고정해 두었으므로 이 %가 곧 의자 위치가 된다
 * (배경에 background-size:cover를 쓰면 잘리는 양만큼 좌표가 어긋나 의자를 벗어난다).
 *
 * **캐릭터를 옮기려면 여기 x/y만 고치면 된다.**
 *   x: 좌우 — 배경 가로 1536 기준. 원본 픽셀 → % 는 `x / 1536 * 100`. 키우면 오른쪽.
 *   y: 상하 — 배경 세로 1024 기준. 원본 픽셀 → % 는 `y / 1024 * 100`. 키우면 아래.
 *      **캐릭터의 발바닥이 이 지점에 온다** (요소 밑변 정렬, translate(-50%,-100%)).
 *   scale: 원근 보정 — 안쪽 벤치는 좌석면 폭이 190px, 앞쪽은 245px이라 안쪽만 0.8배.
 *
 * 좌표는 벤치 **윗면(좌석면)의 중심**을 실측한 값이다(각 줄 주석의 좌석면 범위가 실측 bbox).
 * 뒤쪽 가장자리(예: 1번의 y=505)에 맞추면 벤치 뒤에 걸터앉은 것처럼 보이고,
 * 앞쪽 가장자리(y≈553)에 맞추면 벤치 앞에 서 있는 것처럼 보인다.
 * 좌우는 완전 대칭이 아니라 네 자리 모두 개별 실측했다.
 */
const SEATS = [
  { x: 21.50, y: 52.00, scale: 0.8 }, // 안쪽 왼쪽  — 원본 (338, 524) · 좌석면 x 253~425, y 491~555
  { x: 10.94, y: 68.36, scale: 1 },   // 앞쪽 왼쪽  — 원본 (168, 700) · 좌석면 x  45~290, y 655~745
  { x: 79.30, y: 51.07, scale: 0.8 }, // 안쪽 오른쪽 — 원본 (1218, 523) · 좌석면 x 1136~1300, y 497~549
  { x: 89.45, y: 68.36, scale: 1 },   // 앞쪽 오른쪽 — 원본 (1374, 700) · 좌석면 x 1250~1497, y 655~745
] as const

/**
 * 배경의 화로대 2개 — 횃불 스프라이트(effect_torch_flame.png)를 통째로 덮어씌울 자리.
 * 스프라이트에 그릇+받침까지 들어 있어 **배경의 화로 그릇은 이 아트로 가려지고**,
 * 배경에 그려진 삼각대 다리만 아래로 이어져 보인다.
 *
 * **횃불을 옮기거나 키우려면 여기 세 값만 고치면 된다.** 모두 SEATS와 같은 배경(1536×1024) % 기준.
 *   x: 좌우 — `원본px / 1536 * 100`. 키우면 오른쪽.
 *   y: 상하 — `원본px / 1024 * 100`. 키우면 아래. **스프라이트 받침 밑동이 이 지점에 온다**
 *      (밑변 정렬). 지금 값은 그릇 테두리가 배경 화로 테두리(좌 y=233, 우 y=238)에 닿도록 역산한 것 —
 *      즉 `y = (테두리y + 86.7) / 1024 * 100`. 86.7 = 셀 하단~그릇 테두리 132px × 현재 배율.
 *   w: 크기 — 폭(%)만 주면 높이는 CSS의 aspect-ratio가 셀 비율(152:332)대로 따라온다.
 *      키우면 횃불 전체가 비율 그대로 커진다. **w를 바꾸면 위 86.7도 같이 변하므로 y도 다시 잡아야 한다**
 *      (배율 = w% × 1536 / 152 → 테두리 오프셋 = 132 × 배율).
 *
 * w가 px이 아니라 %인 이유: 그릇이 배경 화로에 딱 맞아야 해서 배경과 같이 늘어나야 한다.
 * px으로 두면 창 크기를 바꿀 때 배경만 커지고 횃불은 그대로라 그릇 밖으로 삐져나온다.
 */
const TORCHES = [
  { x: 27.67, y: 27.78, w: 4.2}, // 왼쪽  — 그릇 테두리 원본 (429, 233)
  { x: 72.15, y: 27.78, w: 4.2 }, // 오른쪽 — 그릇 테두리 원본 (1104, 238)
] as const

/**
 * 대기실(캐릭터 선택) 화면 — 군막사 작전 천막 구도.
 * - 배경의 의자 4개가 곧 캐릭터 슬롯: 관우는 안쪽 왼쪽, 나머지는 빈 자리(장비/조운/하후돈 예정)
 * - 캐릭터 선택 시 우측에 능력치 카드, 게임 시작 → 로딩 화면
 * 캐릭터 일러스트는 AI 아트 도입 전 CSS placeholder (AI_UI_PROMPTS.md 참조).
 */
export function CharacterSelect() {
  const [selected, setSelected] = useState<string | null>('guanwu')
  /** 두루마리에 실제로 그려진 캐릭터 — selected와 갈라져 있어야 "다 말린 뒤 교체"가 가능하다 */
  const [shown, setShown] = useState<string | null>('guanwu')
  const [open, setOpen] = useState(false)
  const char = shown ? CHARACTERS[shown] : null

  // 두루마리 축과 종이가 **같은 속도**로 열리도록, 뷰포트 높이를 fr이 아니라 측정된 px로 여닫는다.
  // (grid fr 전환은 픽셀 기준으로 선형이 아니라 축 이동과 내용 노출이 어긋나 보였다.)
  // 축은 종이 아래에 이어져 있어 뷰포트 height 하나에 함께 묶인다 → 완벽 동기화.
  const contentRef = useRef<HTMLDivElement>(null)
  const [contentH, setContentH] = useState(0)
  // shown(내용)이 바뀔 때마다 종이 자연 높이를 다시 잰다 — 캐릭터마다 글 길이가 달라서.
  useLayoutEffect(() => {
    if (contentRef.current) setContentH(contentRef.current.offsetHeight)
  }, [shown])

  // 대기실 진입: 처음엔 말린 상태(open=false)로 그린 뒤 곧바로 펼친다.
  // 처음부터 open=true면 브라우저가 높이 0 상태를 한 번도 안 그려서 전환이 생략된다.
  // rAF가 아니라 타이머인 이유: 탭이 백그라운드면 rAF가 fire되지 않아 두루마리가 말린 채로 남는다.
  useEffect(() => {
    const t = setTimeout(() => setOpen(true), 30)
    return () => clearTimeout(t)
  }, [])

  // 캐릭터 변경: 말고(open=false) → 다 말리면 내용 교체 → 다시 편다.
  // 교체를 말리는 도중에 하면 바뀐 글자가 펼쳐진 종이에 그대로 비쳐 보인다.
  useEffect(() => {
    if (selected === shown) return
    setOpen(false)
    const t = setTimeout(() => {
      setShown(selected)
      setOpen(true)
    }, ROLL_MS)
    return () => clearTimeout(t) // 말리는 중에 또 바꾸면 이전 예약을 버리고 다시 센다
  }, [selected, shown])

  const startGame = () => {
    if (!selected) return
    useScreenStore.getState().selectCharacter(selected)
    useScreenStore.getState().setScreen('loading')
  }

  return (
    <div className="lobby">
      {/* 군막사 배경 + 의자 좌석 — 스테이지는 배경과 같은 3:2라 좌석 %가 의자에 그대로 맞는다.
          UI(상단/제목/카드)보다 앞에 둬야 뒤로 깔린다 — 모두 absolute라 DOM 순서가 곧 z축이다. */}
      <div className="lobby-stage">
        {/* 화로대 횃불 — 좌석보다 먼저 그려 캐릭터 뒤로 깔리게 한다.
            두 불꽃이 같은 박자로 흔들리면 복사한 티가 나서 오른쪽만 재생 위상을 어긋나게 준다. */}
        {TORCHES.map((t, i) => (
          <span
            key={i}
            className="lobby-torch"
            style={{
              left: `${t.x}%`,
              top: `${t.y}%`,
              width: `${t.w}%`,
              '--torch-delay': `${i * -0.28}s`,
            } as CSSProperties}
          />
        ))}
        {LOBBY_SLOTS.map((slot, i) => {
          // 빈 자리는 배경의 의자를 그대로 비워 둔다 (실루엣 없이)
          if (slot?.type !== 'char') return null
          const seat = SEATS[i]
          const on = selected === slot.code
          // 예고 캐릭터(locked)는 선택·게임시작 불가 — 클릭을 막고 무채색(CSS)으로만 보여 준다.
          return (
            <button
              key={i}
              className={`lobby-seat lobby-seat--${slot.code} ${on ? 'lobby-seat--on' : ''} ${slot.locked ? 'lobby-seat--locked' : ''}`}
              style={{ left: `${seat.x}%`, top: `${seat.y}%`, '--seat-scale': seat.scale } as CSSProperties}
              onClick={slot.locked ? undefined : () => setSelected(slot.code)}
              disabled={slot.locked}
            >
              {/* 캐릭터별 standBy 일러스트 — 코드마다 다른 배경 이미지를 CSS 변형 클래스로 건다 */}
              <span className={`lobby-char lobby-char--${slot.code}`} />
              <span className="lobby-slot-name">
                <b className="lobby-slot-title">{slot.name}</b>
                <small className="lobby-slot-lv">{slot.locked ? 'Coming Soon' : 'Lv.1'}</small>
              </span>
            </button>
          )
        })}
      </div>

      {/* 상단 서버/타이틀 장식 */}
      <div className="lobby-top">
        <span className="lobby-server">삼국 서버 · CH. 1</span>
        <span className="lobby-slots-info">캐릭터 슬롯 1 / {LOBBY_SLOTS.length}</span>
      </div>
      <h1 className="lobby-title">캐릭터 선택</h1>

      {/* 우측 능력치 두루마리 — 축(rod) 2개는 종이 위/아래에 이어져 있고, 가운데 뷰포트 높이만
          0↔측정높이(px)로 여닫는다. 뷰포트가 자라면 아래 축이 그만큼 밀려나 축과 종이가 한 몸으로
          움직인다. 게임 시작 버튼은 두루마리 밖(아래)이라 말려도 같이 접히지 않는다. */}
      {char && (
        <aside className="lobby-side" style={{ '--roll-ms': `${ROLL_MS}ms` } as CSSProperties}>
          <div className="lobby-scroll">
            <span className="scroll-rod scroll-rod--top" />
            <div className="scroll-viewport" style={{ height: open ? contentH : 0 }}>
              <div className="scroll-content" ref={contentRef}>
                <div className="lobby-card-lv">Lv. <b>1</b></div>
                <div className="lobby-card-name">{char.name}</div>
                <div className="lobby-card-class">⚔ {char.clazz}</div>
                <p className="lobby-card-desc">{char.desc}</p>
                <div className="lobby-card-stats">
                  <div className="lobby-stat"><span>HP</span><b>{char.stats.hp}</b></div>
                  <div className="lobby-stat"><span>MP</span><b>{char.stats.mp}</b></div>
                  <div className="lobby-stat"><span>공격력</span><b>{char.stats.attack}</b></div>
                  <div className="lobby-stat"><span>이동속도</span><b>{char.stats.speedPct}%</b></div>
                </div>
                <div className="lobby-card-skill">
                  <span className="lobby-skill-tag">스킬</span>
                  <b>{char.skill.name}</b>
                  <small>{char.skill.desc}</small>
                </div>
              </div>
            </div>
            <span className="scroll-rod scroll-rod--bottom" />
          </div>
          <button className="lobby-start" onClick={startGame}>게임 시작</button>
        </aside>
      )}
    </div>
  )
}
