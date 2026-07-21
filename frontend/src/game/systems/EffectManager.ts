import Phaser from 'phaser'
import { COMBAT } from '../config'

/**
 * 전투 이펙트/데미지 숫자 전담 — 전부 오브젝트 풀링 (DEVELOPMENT_PLAN 문제 1).
 * 새 이펙트가 필요하면 반드시 이 클래스에 풀을 추가한다. 씬에서 직접 생성 금지.
 */
export class EffectManager {
  private scene: Phaser.Scene
  private attackPool: Phaser.GameObjects.Group
  private attackHitPool: Phaser.GameObjects.Group
  private skillPool: Phaser.GameObjects.Group
  private sparkPool: Phaser.GameObjects.Group
  private dashPool: Phaser.GameObjects.Group
  private jumpBurstPool: Phaser.GameObjects.Group
  private swingPool: Phaser.GameObjects.Group
  private dashThrustPool: Phaser.GameObjects.Group
  private textPool: Phaser.GameObjects.Group

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.attackPool = scene.add.group({ defaultKey: 'fx_attack', maxSize: 12 })
    this.attackHitPool = scene.add.group({ defaultKey: 'fx_attack_hit', maxSize: 12 })
    this.skillPool = scene.add.group({ defaultKey: 'fx_skill_charge', maxSize: 4 })
    this.sparkPool = scene.add.group({ defaultKey: 'fx_hit_spark', maxSize: 20 })
    this.dashPool = scene.add.group({ defaultKey: 'fx_dash', maxSize: 8 })
    this.jumpBurstPool = scene.add.group({ defaultKey: 'fx_jump_burst', maxSize: 8 })
    this.swingPool = scene.add.group({ defaultKey: 'fx_swing', maxSize: 8 })
    this.dashThrustPool = scene.add.group({ defaultKey: 'fx_dash_thrust', maxSize: 8 })
    this.textPool = scene.add.group({ maxSize: 30 })

    // 콤보 이펙트 프레임 애니메이션 등록.
    // effect_smash는 균등 격자(4×370)라 스프라이트시트로 그대로 쓰지만,
    // effect_deep_thrust / effect_dash는 프레임이 균등하지 않아(뒤로 갈수록 커짐) 통짜 이미지로 받아
    // "투명 간격 기준 실제 경계"로 프레임을 직접 정의한다. xs는 각 프레임의 좌우 분할선(픽셀).
    this.defineStripFrames('fx_dash_thrust', 328, [0, 132, 268, 426, 629, 858, 1121, 1452, 1725]) // 8프레임
    this.defineStripFrames('fx_dash', 232, [0, 208, 472, 810, 1160, 1526, 2109])                   // 6프레임
    this.registerAnim('fx_swing_anim', 'fx_swing', 22)             // 4프레임 휘두르기
    this.registerAnim('fx_dash_thrust_anim', 'fx_dash_thrust', 30) // 8프레임 깊게 찌르기
    this.registerAnim('fx_dash_anim', 'fx_dash', 30)               // 6프레임 돌진 잔상
  }

  /**
   * 통짜 스트립 이미지에 "세로 전체 높이" 프레임을 좌우 분할선(xs)대로 잘라 넣는다.
   * 프레임이 균등 격자가 아닌 이펙트용 — 각 프레임은 xs[i]~xs[i+1] 폭, 높이는 fullH 전체.
   * (세로 전체를 쓰므로 프레임마다 세로 정렬이 자동으로 맞고, 내용이 세로로 안 잘린다.)
   */
  private defineStripFrames(key: string, fullH: number, xs: number[]) {
    if (!this.scene.textures.exists(key)) return
    const tex = this.scene.textures.get(key)
    if (tex.has('0')) return // 이미 정의됨(재생성/HMR) → 중복 방지
    for (let i = 0; i < xs.length - 1; i++) {
      tex.add(i, 0, xs[i], 0, xs[i + 1] - xs[i], fullH)
    }
  }

  /** 여러 프레임(스프라이트시트 또는 defineStripFrames로 정의됨)이 있을 때만 1회 재생 애니를 만든다. */
  private registerAnim(key: string, texture: string, frameRate: number) {
    if (this.scene.anims.exists(key)) return
    const tex = this.scene.textures.exists(texture) ? this.scene.textures.get(texture) : null
    // frameTotal은 __BASE를 포함하므로 실제 프레임 수 = frameTotal - 1. 단일 이미지(폴백)면 부족 → 스킵.
    if (!tex || tex.frameTotal < 3) return
    this.scene.anims.create({
      key,
      // __BASE(전체 스트립)를 빼고 0 ~ (프레임수-1)만 사용
      frames: this.scene.anims.generateFrameNumbers(texture, { start: 0, end: tex.frameTotal - 2 }),
      frameRate,
      repeat: 0,
    })
  }

  /**
   * 기본 공격 이펙트의 "꼬리 → 타격 지점" 월드 길이(px) — 뻗기 전 → 뻗은 뒤.
   * 타격 지점이 ATTACK_REACH(96)를 크게 넘으면 안 닿는 거리까지 맞을 것처럼 보이므로
   * 시작 시 ≈ reach에 맞추고, 늘어나는 구간은 알파가 빠지는 동안으로 제한한다.
   */
  private static readonly ATTACK_FX_LEN_FROM = 110
  private static readonly ATTACK_FX_LEN_TO = 135

  /**
   * 기본 공격 이펙트 아트별 정렬 기준. 두 아트는 "타격 지점"이 그림 안에서 서로 다른 데 있어
   * (빗나감=스트리크가 수렴하는 끝 / 명중=방사형 폭발 코어) bbox 중앙으로 맞추면 폭발이
   * 엉뚱한 곳에서 터진다. 그래서 타격 지점을 origin으로 잡는다 — attack()에 넘기는 좌표의
   * 의미가 "타격 지점을 여기에 둬라"가 된다.
   *
   * 값은 원본 대비 비율이라 아트를 같은 구도로 다시 그려도 그대로 성립한다:
   * - originX/Y: 타격 지점의 위치 비율. 세로축(스트리크)은 두 아트 모두 ~53% 지점
   * - lenFrac: 꼬리→타격 지점이 전체 폭에서 차지하는 비율 (월드 길이 → 배율 환산용)
   */
  private static readonly ATTACK_FX = {
    miss: { key: 'fx_attack',     originX: 0.997, originY: 0.538, lenFrac: 0.983 },
    hit:  { key: 'fx_attack_hit', originX: 0.698, originY: 0.524, lenFrac: 0.691 },
  } as const

  /**
   * 기본 공격 — 창 찌르기 궤적 (2026-07-16 단일 모션 통합).
   * hit=true면 폭발이 붙은 명중 아트로 교체한다. 판정과 이펙트가 같은 틱(ATTACK_HIT_AT_MS)에
   * 일어나므로 "빗나감 → 명중"으로 전환할 필요 없이 처음부터 맞는 아트를 고른다.
   * (x, y)는 타격 지점 — 명중 시 적 위치, 빗나감 시 리치 끝.
   */
  attack(x: number, y: number, facing: -1 | 1, hit = false) {
    // 명중 아트가 아직 없으면 조용히 빗나감 아트로 폴백
    const useHit = hit && this.scene.textures.exists(EffectManager.ATTACK_FX.hit.key)
    const spec = useHit ? EffectManager.ATTACK_FX.hit : EffectManager.ATTACK_FX.miss
    const img = (useHit ? this.attackHitPool : this.attackPool).get(x, y) as Phaser.GameObjects.Image | null
    if (!img) return

    const srcW = img.frame.realWidth || img.width || 1
    const from = EffectManager.ATTACK_FX_LEN_FROM / (srcW * spec.lenFrac)
    const to = EffectManager.ATTACK_FX_LEN_TO / (srcW * spec.lenFrac)
    // 좌향은 flipX — origin도 같이 뒤집어야 타격 지점이 제자리에 온다
    img.setOrigin(facing === 1 ? spec.originX : 1 - spec.originX, spec.originY)
    img.setActive(true).setVisible(true)
    img.setPosition(x, y).setAlpha(0.95).setScale(from).setFlipX(facing === -1)

    this.scene.tweens.add({
      targets: img,
      // 명중은 폭발이 부풀도록 균등 확대, 빗나감은 궤적이 앞으로 뻗도록 가로만 확대
      ...(useHit ? { scale: to } : { scaleX: to, x: x + facing * 8 }),
      alpha: 0,
      duration: COMBAT.ATTACK_DURATION_MS * 0.55, ease: 'Cubic.easeOut',
      onComplete: () => { img.setActive(false).setVisible(false) },
    })
  }

  /** 스프라이트에 1회 재생 프레임 애니를 걸고, 끝나면 풀로 반환. 재사용 대비 이전 리스너를 먼저 제거한다.
   *  (이름 주의: 아래에 인자 시그니처가 다른 tween용 playOnce가 따로 있으므로 이 메서드는 별도 이름을 쓴다.) */
  private playAnimOnce(spr: Phaser.GameObjects.Sprite, animKey: string) {
    spr.removeAllListeners(Phaser.Animations.Events.ANIMATION_COMPLETE)
    spr.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => spr.setActive(false).setVisible(false))
    spr.play(animKey)
  }

  // 콤보 이펙트 크기: 프레임 "높이"를 이 목표 월드 높이(px)로 맞춰 축소한다.
  // 프레임을 세로 전체로 잘라서 높이가 프레임마다 같으므로, 높이 기준 스케일이 곧 균일 배율 →
  // 프레임별 폭(내용)이 비례로 커지며 자연스럽게 성장한다. origin은 분할선 기준 내용 중심.
  private static readonly SWING = { h: 120, ox: 0.5, oy: 0.48 } as const
  private static readonly DASH_THRUST = { h: 96, ox: 0.5, oy: 0.52 } as const
  private static readonly DASH = { h: 56, ox: 0.5, oy: 0.5 } as const

  /** 콤보 2단계 — 휘두르기(effect_smash 4프레임 참격 애니). 시트 미로드 시 찌르기로 폴백. */
  swingArc(x: number, y: number, facing: -1 | 1, hit = false) {
    if (!this.scene.anims.exists('fx_swing_anim')) { this.attack(x, y, facing, hit); return }
    const spr = this.swingPool.get(x, y) as Phaser.GameObjects.Sprite | null
    if (!spr) return
    const s = EffectManager.SWING
    spr.setActive(true).setVisible(true)
    spr.setOrigin(s.ox, s.oy)
    spr.setPosition(x, y).setAlpha(0.95).setFlipX(facing === -1).setAngle(0)
    this.playAnimOnce(spr, 'fx_swing_anim') // 프레임0 확정 후에 실제 프레임 높이로 스케일
    spr.setScale(s.h / (spr.frame.realHeight || 1))
  }

  /** 콤보 3단계 — 깊게 찌르기(effect_deep_thrust 8프레임 돌진 관통 애니). 시트 미로드 시 찌르기로 폴백. */
  dashThrust(x: number, y: number, facing: -1 | 1, hit = false) {
    if (!this.scene.anims.exists('fx_dash_thrust_anim')) { this.attack(x, y, facing, hit); return }
    const spr = this.dashThrustPool.get(x, y) as Phaser.GameObjects.Sprite | null
    if (!spr) return
    const s = EffectManager.DASH_THRUST
    spr.setActive(true).setVisible(true)
    spr.setOrigin(s.ox, s.oy)
    spr.setPosition(x, y).setAlpha(0.95).setFlipX(facing === -1).setAngle(0)
    this.playAnimOnce(spr, 'fx_dash_thrust_anim')
    spr.setScale(s.h / (spr.frame.realHeight || 1))
  }

  /**
   * 대쉬 잔상 (점프 2연타 / 깊게 찌르기 돌진) — effect_dash 6프레임 애니.
   * 시트 미로드(placeholder 단일 이미지) 시엔 정지 이미지를 짧게 뒤로 흘리는 기존 방식으로 폴백.
   */
  dashTrail(x: number, y: number, facing: -1 | 1) {
    const px = x - facing * 34
    const spr = this.dashPool.get(px, y) as Phaser.GameObjects.Sprite | null
    if (!spr) return
    const s = EffectManager.DASH
    spr.setActive(true).setVisible(true)
    spr.setOrigin(s.ox, s.oy)
    spr.setPosition(px, y).setAlpha(0.85).setFlipX(facing === -1).setAngle(0)
    if (this.scene.anims.exists('fx_dash_anim')) {
      this.playAnimOnce(spr, 'fx_dash_anim')
      spr.setScale(s.h / (spr.frame.realHeight || 1))
    } else {
      // 폴백: 단일 placeholder 이미지 — 뒤로 흘리며 사라짐
      const base = s.h / (spr.frame.realHeight || 1)
      spr.setScale(base)
      this.scene.tweens.add({
        targets: spr, x: x - facing * 70, alpha: 0, scaleX: base * 1.3,
        duration: 240, ease: 'Quad.easeOut',
        onComplete: () => { spr.setActive(false).setVisible(false) },
      })
    }
  }

  /** 이단 점프 하강풍 (↑ + 점프 2연타) — 발밑에서 아래로 뿜어져 나간다 */
  doubleJumpBurst(x: number, y: number) {
    const img = this.jumpBurstPool.get(x, y) as Phaser.GameObjects.Image | null
    if (!img) return
    img.setActive(true).setVisible(true)
    img.setPosition(x, y).setAlpha(0.9).setScale(0.9).setFlipX(false)
    this.scene.tweens.add({
      targets: img, y: y + 34, alpha: 0, scaleX: 1.25, scaleY: 1.15,
      duration: 300, ease: 'Quad.easeOut',
      onComplete: () => { img.setActive(false).setVisible(false) },
    })
  }

  /**
   * 참마돌격 이펙트 정렬 — attack()과 같은 "스트리크+폭발" 구조라 타격 지점을 origin으로 잡는다.
   * 원본(1422x613) 기준 폭발코어 x=1182 / 스트리크 축 y=289. 값은 비율이라 원본이 바뀌어도
   * 같은 구도면 성립한다. 꼬리→코어 길이를 SKILL_REACH(200)에 맞춘다.
   */
  private static readonly SKILL_FX = { originX: 0.831, originY: 0.471, lenFrac: 0.831 } as const
  private static readonly SKILL_FX_LEN_FROM = 200
  private static readonly SKILL_FX_LEN_TO = 240
  /**
   * ★ 참마돌격 이펙트 속도 조절값 — 이펙트가 퍼지며 사라지기까지의 시간(ms). 크게 잡을수록 느리다.
   * 시전 모션/판정(COMBAT.SKILL_DURATION_MS=450, SKILL_HIT_AT_MS)과는 분리돼 있어
   * 이 값만 바꾸면 게임 플레이 타이밍은 그대로고 보이는 속도만 바뀐다.
   * (기존엔 SKILL_DURATION_MS × 0.9 = 405ms라 너무 빨리 지나갔다.)
   */
  private static readonly SKILL_FX_DURATION_MS = 720

  /**
   * 참마돌격 (GAME_DESIGN 4.2) — 현재 게임에 시전 가능한 스킬은 이것 하나뿐이라
   * onSkill이 곧 참마돌격이다. 스킬별 분기가 생기면 여기서 갈라야 한다.
   * (x, y)는 타격 지점 — attack()과 같은 규약.
   */
  skillCharge(x: number, y: number, facing: -1 | 1) {
    const img = this.skillPool.get(x, y) as Phaser.GameObjects.Image | null
    if (!img) return
    const srcW = img.frame.realWidth || img.width || 1
    const spec = EffectManager.SKILL_FX
    const from = EffectManager.SKILL_FX_LEN_FROM / (srcW * spec.lenFrac)
    const to = EffectManager.SKILL_FX_LEN_TO / (srcW * spec.lenFrac)
    img.setOrigin(facing === 1 ? spec.originX : 1 - spec.originX, spec.originY)
    img.setActive(true).setVisible(true)
    img.setPosition(x, y).setAlpha(0.95).setScale(from).setFlipX(facing === -1)
    this.scene.tweens.add({
      targets: img, scale: to, alpha: 0,
      // Cubic.easeOut은 초반에 몰아서 끝나 알맹이를 놓친다 — Sine이 더 고르게 보인다
      duration: EffectManager.SKILL_FX_DURATION_MS, ease: 'Sine.easeOut',
      onComplete: () => { img.setActive(false).setVisible(false) },
    })
  }

  hitSpark(x: number, y: number) {
    const img = this.sparkPool.get(x, y) as Phaser.GameObjects.Image | null
    if (!img) return
    this.playOnce(img, x, y, 1, 0.8, 180)
  }

  /**
   * 레벨업 빛 기둥 정렬 — 원본(683x656)의 바닥 링이 y=526에 있어 그 지점을 발밑에 맞춘다.
   * 중앙 정렬하면 기둥이 공중에 뜬다.
   */
  private static readonly LEVELUP_FX = { originX: 0.488, originY: 0.802 } as const
  /** 기둥 목표 높이(월드 px) — 캐릭터(~51px)보다 확실히 크게 */
  private static readonly LEVELUP_FX_HEIGHT = 165
  /**
   * 기둥은 캐릭터 **뒤**에 깐다 (플레이어 depth 0). 앞에 두면 정작 레벨업한 관우가 안 보인다.
   * NPC(-10)보다는 앞이라 옆에 NPC가 있어도 기둥이 가려지지 않는다.
   */
  private static readonly LEVELUP_FX_DEPTH = -1

  /** 레벨업 빛 기둥 (GAME_DESIGN 5.1) — 저빈도라 풀 없이 생성/파괴 */
  levelUp(target: Phaser.GameObjects.Sprite) {
    // 발밑 = 스프라이트 프레임 하단. 캐릭터가 128 프레임에 하단 정렬돼 있어 둘이 사실상 같다
    // (캐릭터 바닥 y=127 vs 프레임 128) — target.y는 프레임 중심이라 그대로 쓰면 안 된다.
    const footY = target.getBounds().bottom
    const pillar = this.scene.add.image(target.x, footY, 'fx_level_up')
    pillar.setOrigin(EffectManager.LEVELUP_FX.originX, EffectManager.LEVELUP_FX.originY)
    pillar.setScale(EffectManager.LEVELUP_FX_HEIGHT / (pillar.frame.realHeight || 1))
    pillar.setDepth(EffectManager.LEVELUP_FX_DEPTH)
    // ADD 블렌드 — 아트에 반투명한 어두운 영역이 있어 일반 합성이면 배경 위에 검은 얼룩으로 남는다.
    // 빛 이펙트라 더하기 합성이 물리적으로도 맞고, 얼룩이 자연스럽게 사라진다.
    pillar.setBlendMode(Phaser.BlendModes.ADD)
    const label = this.scene.add
      .text(target.x, target.y - 90, 'LEVEL UP!', {
        fontSize: '22px', fontStyle: 'bold', color: '#ffd600', stroke: '#7b5800', strokeThickness: 4,
      })
      .setOrigin(0.5)
    this.scene.tweens.add({
      targets: [pillar, label], alpha: 0, y: '-=40', duration: 1200, ease: 'Cubic.easeOut',
      onComplete: () => { pillar.destroy(); label.destroy() },
    })
  }

  /**
   * 데미지 숫자용 둥근 폰트 (index.css의 @font-face). **숫자(U+30-39)만 서브셋한 3KB 파일**이라
   * 숫자 외 문자에 쓰면 조용히 폴백으로 샌다 — 한글/영문 라벨엔 LABEL_FONT를 쓸 것.
   */
  private static readonly DAMAGE_FONT = 'Baloo2Digits, system-ui, sans-serif'
  /** 한글이 섞이는 라벨용 (아이템 획득 등) */
  private static readonly LABEL_FONT = 'system-ui, "Malgun Gothic", sans-serif'

  /** 대상별 연타 스택 (최대 3단) — 같은 대상을 연속 타격하면 숫자가 위로 쌓인다 */
  private damageStacks = new WeakMap<object, { idx: number; lastAt: number }>()
  private playerStack = { idx: 0, lastAt: -Infinity }
  /** 이 시간 안에 재타격하면 연타로 취급해 위로 쌓음 */
  private static readonly STACK_WINDOW_MS = 700
  private static readonly STACK_GAP_PX = 22
  private static readonly STACK_MAX = 3

  /**
   * 데미지 숫자 (GAME_DESIGN 4.3). kind: 'deal' 내가 준 / 'taken' 받은
   * 크리티컬은 더 크고 화려하게.
   * stackKey를 주면 같은 대상 연타 시 숫자가 위로 쌓였다가 순서대로 사라진다 (최대 3단).
   */
  damageNumber(x: number, y: number, amount: number, kind: 'deal' | 'taken', crit = false, stackKey?: object) {
    let text = this.textPool.getFirstDead(false) as Phaser.GameObjects.Text | null
    if (!text) {
      if (this.textPool.getLength() >= 30) return
      text = this.scene.add.text(0, 0, '', {
        fontSize: '18px', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5)
      this.textPool.add(text)
    }

    // 연타 스택 오프셋 계산: 대상별로 최근 타격이면 한 단 위에 표시
    let stackOffset = 0
    if (stackKey) {
      const now = this.scene.time.now
      let s = kind === 'taken' ? this.playerStack : this.damageStacks.get(stackKey)
      if (!s) {
        s = { idx: 0, lastAt: -Infinity }
        this.damageStacks.set(stackKey, s)
      }
      if (now - s.lastAt > EffectManager.STACK_WINDOW_MS) s.idx = 0
      stackOffset = (s.idx % EffectManager.STACK_MAX) * EffectManager.STACK_GAP_PX
      s.idx += 1
      s.lastAt = now
    }

    text.setActive(true).setVisible(true)
    text.setPosition(
      stackKey ? x : x + Phaser.Math.Between(-8, 8), // 스택형은 같은 세로 열에 정렬
      y - stackOffset,
    )
    text.setText(String(amount))
    text.setColor(kind === 'taken' ? '#ff5252' : crit ? '#ffab00' : '#ffe082')
    // 폰트는 매번 지정한다 — textPool을 pickupLabel과 공유해서 생성 시점 스타일이 남아 있다
    text.setFontFamily(EffectManager.DAMAGE_FONT)
    text.setFontStyle('800')
    text.setFontSize(crit ? 26 : kind === 'taken' ? 16 : 18)
    text.setAlpha(1).setScale(crit ? 1.15 : 1)

    this.scene.tweens.add({
      targets: text, y: y - stackOffset - 44, alpha: 0, duration: 650, ease: 'Cubic.easeOut',
      onComplete: () => { text!.setActive(false).setVisible(false) },
    })
  }

  /** 아이템 획득 라벨 (GAME_DESIGN 8.1) — 데미지 숫자 풀 재사용 */
  pickupLabel(x: number, y: number, label: string) {
    let text = this.textPool.getFirstDead(false) as Phaser.GameObjects.Text | null
    if (!text) {
      if (this.textPool.getLength() >= 30) return
      text = this.scene.add.text(0, 0, '', {
        fontSize: '13px', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5)
      this.textPool.add(text)
    }
    text.setActive(true).setVisible(true)
    text.setPosition(x, y).setText(label).setColor('#a5d6a7').setAlpha(1).setScale(1)
    // 한글이 섞이므로 숫자 서브셋 폰트를 쓰면 안 된다 (damageNumber와 풀 공유 — 매번 되돌린다)
    text.setFontFamily(EffectManager.LABEL_FONT)
    text.setFontStyle('bold')
    text.setFontSize(13)
    this.scene.tweens.add({
      targets: text, y: y - 30, alpha: 0, duration: 700, ease: 'Cubic.easeOut',
      onComplete: () => { text!.setActive(false).setVisible(false) },
    })
  }

  private playOnce(
    img: Phaser.GameObjects.Image, x: number, y: number,
    facing: -1 | 1 | number, scale: number, durationMs: number,
  ) {
    img.setActive(true).setVisible(true)
    img.setPosition(x, y).setAlpha(0.95).setScale(scale)
    img.setFlipX(facing === -1)
    this.scene.tweens.add({
      targets: img, alpha: 0, scale: scale * 1.25, duration: durationMs, ease: 'Quad.easeOut',
      onComplete: () => { img.setActive(false).setVisible(false) },
    })
  }
}
