import Phaser from 'phaser'
import { COMBAT } from '../config'

/**
 * 전투 이펙트/데미지 숫자 전담 — 전부 오브젝트 풀링 (DEVELOPMENT_PLAN 문제 1).
 * 새 이펙트가 필요하면 반드시 이 클래스에 풀을 추가한다. 씬에서 직접 생성 금지.
 */
export class EffectManager {
  /** Player is depth 10; combat effects must render over characters and scenery. */
  private static readonly COMBAT_FX_DEPTH = 20
  /** Bottom-most visible alpha row in fixed_v5 frames 1-13. */
  private static readonly GLAIVE_ALPHA_BOTTOM = [404, 409, 409, 409, 420, 355, 355, 359, 361, 364, 380, 390, 420] as const
  private scene: Phaser.Scene
  private attackPool: Phaser.GameObjects.Group
  private attackHitPool: Phaser.GameObjects.Group
  private skillPool: Phaser.GameObjects.Group
  private zhaoChargePool: Phaser.GameObjects.Group
  private meteorPool: Phaser.GameObjects.Group
  private spearPool: Phaser.GameObjects.Group
  private flowerPool: Phaser.GameObjects.Group
  private flowerAttackPool: Phaser.GameObjects.Group
  private tigerPool: Phaser.GameObjects.Group
  private glaivePool: Phaser.GameObjects.Group
  private decisivePool: Phaser.GameObjects.Group
  private dragonPool: Phaser.GameObjects.Group
  private zhaoDragonPool: Phaser.GameObjects.Group
  private lightningPool: Phaser.GameObjects.Group
  private lightningSmallPool: Phaser.GameObjects.Group
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
    this.zhaoChargePool = scene.add.group({ classType: Phaser.GameObjects.Sprite, defaultKey: 'fx_skill_zhao_charge', maxSize: 2 })
    this.meteorPool = scene.add.group({ classType: Phaser.GameObjects.Sprite, defaultKey: 'fx_skill_zhao_meteor', maxSize: 2 })
    this.spearPool = scene.add.group({ classType: Phaser.GameObjects.Sprite, defaultKey: 'fx_skill_zhao_spear', maxSize: 8 })
    this.flowerPool = scene.add.group({ classType: Phaser.GameObjects.Sprite, defaultKey: 'fx_skill_zhao_flower', maxSize: 2 })
    this.flowerAttackPool = scene.add.group({ classType: Phaser.GameObjects.Sprite, defaultKey: 'fx_skill_zhao_flower_attack', maxSize: 2 })
    this.tigerPool = scene.add.group({ classType: Phaser.GameObjects.Sprite, defaultKey: 'fx_skill_zhao_tiger', maxSize: 2 })
    this.glaivePool = scene.add.group({ defaultKey: 'fx_skill_glaive', maxSize: 4 })
    this.decisivePool = scene.add.group({ defaultKey: 'fx_decisive_strike', maxSize: 3 })
    this.dragonPool = scene.add.group({ defaultKey: 'fx_skill_dragon', maxSize: 2 })
    this.zhaoDragonPool = scene.add.group({ classType: Phaser.GameObjects.Sprite, defaultKey: 'fx_skill_zhao_dragon', maxSize: 2 })
    this.lightningPool = scene.add.group({ defaultKey: 'fx_skill_lightning', maxSize: 14 })
    this.lightningSmallPool = scene.add.group({ defaultKey: 'fx_skill_lightning_small', maxSize: 6 })
    this.sparkPool = scene.add.group({ defaultKey: 'fx_hit_spark', maxSize: 20 })
    this.dashPool = scene.add.group({ defaultKey: 'fx_dash', maxSize: 8 })
    this.jumpBurstPool = scene.add.group({ defaultKey: 'fx_jump_effect', maxSize: 8 })
    this.swingPool = scene.add.group({ defaultKey: 'fx_swing', maxSize: 8 })
    this.dashThrustPool = scene.add.group({ defaultKey: 'fx_dash_thrust', maxSize: 8 })
    this.textPool = scene.add.group({ maxSize: 30 })

    // 콤보 이펙트 프레임 정의/애니 등록.
    // 휘두르기(fx_swing)만 프레임 애니 대신 "마지막(가장 큰) 프레임 한 장"을 찌르기처럼 키우며
    // 페이드아웃한다(comboBurst) — 균등-분할 셀 경계가 그림을 잘라 네모 테두리처럼 보이던 문제 회피.
    // 깊게 찌르기(fx_dash_thrust)·돌진 잔상(fx_dash)은 프레임 애니로 재생한다(단일 이미지는 대쉬
    // 동작과 속도가 안 맞았다). 둘 다 단일 이미지라 프레임을 주소로 집으려면 분할선 정의가 필요하다.
    // fx_dash_thrust: 좌→우로 커지는 관통 시퀀스. 프레임 폭이 f0~f6까지 132→331px로 커지다가
    //   마지막 프레임(1452~1725)만 273px로 도로 좁아져 "찔렀다 돌아오는" 것처럼 보인다 → 그 끝
    //   프레임을 빼고 7프레임(f0~f6) 단조 성장으로만 재생한다. 최대 신장(f6)에서 끝나 마무리가 시원하다.
    this.defineStripFrames('fx_dash_thrust', 328, [0, 132, 268, 426, 629, 858, 1121, 1452]) // 7프레임(끝 프레임 제외)
    this.defineDashFrames()
    // 깊게 찌르기: 성장 프레임을 빠르게(frameRate 130) 지나가고 마지막 임팩트 프레임을 6슬롯 더 붙잡아
    //   "팍!" 하고 꽂히는 타격감을 준다(균등 성장의 '카펫 펴지는' 느낌 제거). 총 ~100ms.
    this.registerAnimPunch('fx_dash_thrust_anim', 'fx_dash_thrust', 130, 6)
    this.registerAnim('fx_dash_anim', 'fx_dash', 36)               // 12프레임 돌진 먼지
    this.defineJumpFrames()
    this.registerAnim('fx_jump_effect_anim', 'fx_jump_effect', 18)
    this.defineLevelUpFrames()
    this.defineGlaiveFrames()
    this.defineDecisiveFrames()
    this.defineDragonFrames()
    this.defineZhaoYunFrames()
    this.defineZhaoDragonFrames()
    this.defineLightningFrames()
  }

  private defineGlaiveFrames() {
    if (!this.scene.textures.exists('fx_skill_glaive')) return
    for (const [key, start, length, frameRate] of [
      ['fx_skill_glaive_slash_left', 0, 5, 28],
      ['fx_skill_glaive_slash_right', 5, 5, 28],
      ['fx_skill_glaive_slam', 10, 3, 18],
    ] as const) {
      if (this.scene.anims.exists(key)) this.scene.anims.remove(key)
      this.scene.anims.create({
        key,
        frames: Array.from({ length }, (_, i) => ({ key: 'fx_skill_glaive', frame: start + i })),
        frameRate,
        repeat: 0,
      })
    }
  }

  private defineDecisiveFrames() {
    if (!this.scene.textures.exists('fx_decisive_strike')) return
    if (this.scene.anims.exists('fx_decisive_scope_anim')) this.scene.anims.remove('fx_decisive_scope_anim')
    if (this.scene.anims.exists('fx_decisive_thrust_anim')) this.scene.anims.remove('fx_decisive_thrust_anim')
    this.scene.anims.create({
      key: 'fx_decisive_scope_anim',
      frames: Array.from({ length: 9 }, (_, i) => ({ key: 'fx_decisive_strike', frame: i })),
      frameRate: 14,
      repeat: 0,
    })
    this.scene.anims.create({
      key: 'fx_decisive_thrust_anim',
      // Frames 14-16 in the source contact sheet contain pixels spilled from
      // their neighbours. Skip those dirty panels; the remaining six frames
      // form a clean, straight punch with no eased tween.
      frames: [9, 10, 11, 12, 16, 17].map((frame) => ({ key: 'fx_decisive_strike', frame })),
      frameRate: 60,
      repeat: 0,
    })
  }

  private defineDragonFrames() {
    if (!this.scene.textures.exists('fx_skill_dragon')) return
    if (this.scene.anims.exists('fx_skill_dragon_slam')) this.scene.anims.remove('fx_skill_dragon_slam')
    this.scene.anims.create({
      key: 'fx_skill_dragon_slam',
      frames: Array.from({ length: 10 }, (_, frame) => ({ key: 'fx_skill_dragon', frame })),
      frameRate: 12,
      repeat: 0,
    })
  }

  private defineZhaoYunFrames() {
    const definitions = [
      ['fx_skill_horse_charge_anim', 'fx_skill_zhao_charge', 7, 18],
      ['fx_skill_meteor_anim', 'fx_skill_zhao_meteor', 7, 18],
      ['fx_skill_spear_flurry_anim', 'fx_skill_zhao_spear', 10, 60],
      ['fx_skill_flower_anim', 'fx_skill_zhao_flower', 9, 10],
      ['fx_skill_flower_attack_anim', 'fx_skill_zhao_flower_attack', 3, 12],
      ['fx_skill_tiger_anim', 'fx_skill_zhao_tiger', 9, 60],
    ] as const
    for (const [key, texture, length, frameRate] of definitions) {
      if (!this.scene.textures.exists(texture)) continue
      if (this.scene.anims.exists(key)) this.scene.anims.remove(key)
      this.scene.anims.create({ key, frames: Array.from({ length }, (_, frame) => ({ key: texture, frame })), frameRate, repeat: 0 })
    }
  }

  private defineZhaoDragonFrames() {
    if (!this.scene.textures.exists('fx_skill_zhao_dragon')) return
    if (this.scene.anims.exists('fx_skill_zhao_dragon_anim')) this.scene.anims.remove('fx_skill_zhao_dragon_anim')
    this.scene.anims.create({
      key: 'fx_skill_zhao_dragon_anim',
      frames: Array.from({ length: 8 }, (_, frame) => ({ key: 'fx_skill_zhao_dragon', frame })),
      frameRate: 14,
      repeat: 0,
    })
  }

  private defineDashFrames() {
    if (!this.scene.textures.exists('fx_dash')) return
    const texture = this.scene.textures.get('fx_dash')
    for (let i = 0; i < 12; i++) {
      if (texture.has(String(i))) texture.remove(String(i))
      const col = i % 6
      const topRow = i < 6
      texture.add(i, 0, col * 256, topRow ? 245 : 535, 256, topRow ? 210 : 165)
    }
  }

  private defineLevelUpFrames() {
    if (!this.scene.textures.exists('fx_level_up')) return
    const texture = this.scene.textures.get('fx_level_up')
    const beamFrames: Phaser.Types.Animations.AnimationFrame[] = []
    const labelFrames: Phaser.Types.Animations.AnimationFrame[] = []
    for (let i = 0; i < 12; i++) {
      const beamName = `level_beam_${i}`
      const labelName = `level_label_${i}`
      if (texture.has(beamName)) texture.remove(beamName)
      if (texture.has(labelName)) texture.remove(labelName)
      texture.add(beamName, 0, i * 128, 80, 128, 460)
      texture.add(labelName, 0, i * 128, 630, 128, 190)
      beamFrames.push({ key: 'fx_level_up', frame: beamName })
      labelFrames.push({ key: 'fx_level_up', frame: labelName })
    }
    if (this.scene.anims.exists('fx_level_beam_anim')) this.scene.anims.remove('fx_level_beam_anim')
    if (this.scene.anims.exists('fx_level_label_anim')) this.scene.anims.remove('fx_level_label_anim')
    this.scene.anims.create({ key: 'fx_level_beam_anim', frames: beamFrames, frameRate: 14, repeat: 0 })
    this.scene.anims.create({ key: 'fx_level_label_anim', frames: labelFrames, frameRate: 14, repeat: 0 })
  }

  private defineJumpFrames() {
    if (!this.scene.textures.exists('fx_jump_effect')) return
    const texture = this.scene.textures.get('fx_jump_effect')
    for (let i = 0; i < 8; i++) {
      const x = (i % 4) * 384
      const y = i < 4 ? 230 : 650
      const height = i < 4 ? 282 : 374
      if (!texture.has(String(i))) texture.add(i, 0, x, y, 384, height)
    }
  }

  /**
   * 통짜 스트립 이미지에 "세로 전체 높이" 프레임을 좌우 분할선(xs)대로 잘라 넣는다.
   * 프레임이 균등 격자가 아닌 이펙트용 — 각 프레임은 xs[i]~xs[i+1] 폭, 높이는 fullH 전체.
   * (세로 전체를 쓰므로 프레임마다 세로 정렬이 자동으로 맞고, 내용이 세로로 안 잘린다.)
   */
  private defineStripFrames(key: string, fullH: number, xs: number[]) {
    if (!this.scene.textures.exists(key)) return
    const tex = this.scene.textures.get(key)
    // 이미 정의돼 있으면(재생성/HMR) 지우고 다시 넣는다 — 프레임 수/경계 변경이 항상 반영되게.
    // (전역 TextureManager는 게임 수명 내내 유지돼, 그냥 두면 예전 프레임이 캐시로 남는다.)
    for (let i = 0; tex.has(String(i)); i++) tex.remove(String(i))
    for (let i = 0; i < xs.length - 1; i++) {
      tex.add(i, 0, xs[i], 0, xs[i + 1] - xs[i], fullH)
    }
  }

  /** 여러 프레임(스프라이트시트 또는 defineStripFrames로 정의됨)이 있을 때만 1회 재생 애니를 만든다. */
  private registerAnim(key: string, texture: string, frameRate: number) {
    // 이미 있으면 지우고 다시 만든다 — HMR/씬 재시작 후에도 frameRate·프레임 변경이 반영되게.
    // (전역 anims는 게임 수명 내내 유지돼, 그냥 두면 예전 애니가 그대로 캐시된다.)
    if (this.scene.anims.exists(key)) this.scene.anims.remove(key)
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
   * 임팩트 강조형 1회 재생 애니 — 성장 프레임을 frameRate로 빠르게 지나간 뒤, 마지막(임팩트) 프레임을
   * holdFrames만큼 더 붙잡아 "팍!" 하고 꽂히는 타격감을 준다(균등 성장의 '카펫 펴지는' 느낌 제거).
   * 프레임 애니는 이징이 없으므로, 임팩트 프레임을 여러 슬롯 복제해 '멈춤(hold)'으로 강약을 만든다.
   */
  private registerAnimPunch(key: string, texture: string, frameRate: number, holdFrames: number) {
    if (this.scene.anims.exists(key)) this.scene.anims.remove(key)
    const tex = this.scene.textures.exists(texture) ? this.scene.textures.get(texture) : null
    if (!tex || tex.frameTotal < 3) return
    const last = tex.frameTotal - 2 // __BASE 제외한 마지막 실제 프레임(임팩트)
    const growth = this.scene.anims.generateFrameNumbers(texture, { start: 0, end: last })
    const hold = Array.from({ length: holdFrames }, () => ({ key: texture, frame: last }))
    this.scene.anims.create({ key, frames: [...growth, ...hold], frameRate, repeat: 0 })
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

  // 콤보 이펙트 파라미터. h=목표 월드 높이(px), ox/oy=origin.
  // 휘두르기(SWING)만 마지막 프레임 한 장을 from→to로 키우며 사라진다(comboBurst). oy=0.99는
  //   마지막 참격 프레임에서 그림 아래 끝이 프레임 높이의 ~99.3%라, 그 지점을 origin으로 잡고
  //   y를 발밑(지면)으로 주면 아래 끝이 바닥에 붙고 성장은 위로만 자란다.
  // 깊게 찌르기(DASH_THRUST)는 8프레임 관통 애니를 재생한다. 대쉬로 이미 전진하므로 멀리 띄우지 않고
  //   몸 앞(front px)에서 시작해 앞으로 뻗는다. ox=꼬리(왼끝) 기준이라 앞으로 자라고, stretch로 가로만
  //   더 늘여 얇고 긴 찌르기로 보이게 한다(세로 h는 그대로 → 과하지 않게).
  private static readonly SWING = { h: 128, ox: 0.5, oy: 0.99, from: 0.9, to: 1.15 } as const
  private static readonly DASH_THRUST = { h: 59, ox: 0.05, oy: 0.5, stretch: 1.8, front: 14 } as const
  // 돌진 잔상(dashTrail)은 프레임 애니라 성장 트윈값이 필요 없다. back=몸 중심에서 뒤로 뺀 거리(px).
  private static readonly DASH = { h: 56, ox: 0.5, oy: 0.5, back: 12 } as const

  /**
   * 콤보 단일-이미지 이펙트 — 스트립/시트의 "마지막(가장 큰) 프레임" 한 장을 찌르기(attack)처럼
   * 키우며 페이드아웃한다. 프레임 애니 대신 통짜 한 장이라 균등-분할 셀 경계가 그림을 잘라
   * 네모 테두리처럼 보이던 문제가 없다. 텍스처 미로드/폴백(프레임 부족) 시 찌르기로 폴백.
   */
  private comboBurst(
    pool: Phaser.GameObjects.Group, textureKey: string,
    s: { h: number; ox: number; oy: number; from: number; to: number },
    x: number, y: number, facing: -1 | 1, hit: boolean,
  ) {
    const tex = this.scene.textures.exists(textureKey) ? this.scene.textures.get(textureKey) : null
    // frameTotal은 __BASE(전체 이미지)를 포함 → 실제 프레임이 2개 미만이면 아직 미로드/placeholder
    if (!tex || tex.frameTotal < 3) { this.attack(x, y, facing, hit); return }
    const spr = pool.get(x, y) as Phaser.GameObjects.Sprite | null
    if (!spr) return
    spr.setActive(true).setVisible(true)
    spr.setFrame(tex.frameTotal - 2) // __BASE 제외한 마지막 실제 프레임(가장 큰 그림)
    spr.setOrigin(s.ox, s.oy).setAngle(0).setFlipX(facing === -1)
    const base = s.h / (spr.frame.realHeight || 1)
    spr.setPosition(x, y).setAlpha(0.95).setScale(base * s.from)
    this.scene.tweens.add({
      targets: spr, scale: base * s.to, alpha: 0,
      duration: COMBAT.ATTACK_DURATION_MS * 0.55, ease: 'Cubic.easeOut',
      onComplete: () => { spr.setActive(false).setVisible(false) },
    })
  }

  /** 콤보 2단계 — 휘두르기. effect_smash의 마지막 참격 프레임 한 장을 키우며 사라지게 한다. */
  swingArc(x: number, y: number, facing: -1 | 1, hit = false) {
    this.comboBurst(this.swingPool, 'fx_swing', EffectManager.SWING, x, y, facing, hit)
  }

  /** 콤보 3단계 — 깊게 찌르기(effect_deep_thrust 8프레임 돌진 관통 애니). 시트 미로드 시 찌르기로 폴백.
   *  GameScene에서 dashTrail 없이 이 하나만 호출한다 — 이펙트 1개. */
  dashThrust(x: number, y: number, facing: -1 | 1, hit = false) {
    if (!this.scene.anims.exists('fx_dash_thrust_anim')) { this.attack(x, y, facing, hit); return }
    const spr = this.dashThrustPool.get(x, y) as Phaser.GameObjects.Sprite | null
    if (!spr) return
    const s = EffectManager.DASH_THRUST
    const px = x + facing * s.front // 몸 중심(x)에서 앞으로 살짝 — 꼬리를 앞손 위치에 둔다
    spr.setActive(true).setVisible(true)
    // 꼬리(왼끝) origin. 좌향은 flipX와 함께 origin도 뒤집어(1-ox) 꼬리가 앞손에 오게 한다(attack와 동일 규약).
    spr.setOrigin(facing === 1 ? s.ox : 1 - s.ox, s.oy)
    spr.setPosition(px, y).setAlpha(0.95).setFlipX(facing === -1).setAngle(0)
    this.playAnimOnce(spr, 'fx_dash_thrust_anim')
    // 세로는 h에 맞추고 가로만 stretch배 늘여 얇고 긴 찌르기로 (8프레임 모두 세로 전체라 높이 동일)
    const base = s.h / (spr.frame.realHeight || 1)
    spr.setScale(base * s.stretch, base)
  }

  /**
   * 대쉬 잔상 (점프 2연타 / 깊게 찌르기 돌진) — effect_dash 6프레임 애니.
   * 시트 미로드(placeholder 단일 이미지) 시엔 정지 이미지를 짧게 뒤로 흘리는 기존 방식으로 폴백.
   */
  dashTrail(x: number, y: number, facing: -1 | 1) {
    const s = EffectManager.DASH
    const px = x - facing * s.back // 몸통 뒤로 살짝 — 잔상이 몸에서 너무 떨어지지 않게
    const spr = this.dashPool.get(px, y) as Phaser.GameObjects.Sprite | null
    if (!spr) return
    spr.setActive(true).setVisible(true)
    spr.setOrigin(s.ox, s.oy)
    // 현재 대시 아트의 기본 방향이 게임 이동 방향과 반대이므로 양쪽 방향 모두 반전한다.
    spr.setPosition(px, y).setAlpha(0.85).setFlipX(facing === 1).setAngle(0)
    if (this.scene.anims.exists('fx_dash_anim')) {
      this.playAnimOnce(spr, 'fx_dash_anim')
      // 프레임 갱신으로 표시 크기를 다시 맞출 때도 좌측 대시의 반전을 유지한다.
      const normalizeDashSize = () => spr.setDisplaySize(92, s.h).setFlipX(facing === 1)
      spr.removeAllListeners(Phaser.Animations.Events.ANIMATION_UPDATE)
      spr.on(Phaser.Animations.Events.ANIMATION_UPDATE, normalizeDashSize)
      normalizeDashSize()
    } else {
      // 폴백: 단일 placeholder 이미지 — 뒤로 흘리며 사라짐
      const base = s.h / (spr.frame.realHeight || 1)
      spr.setScale(base).setFlipX(facing === 1)
      this.scene.tweens.add({
        targets: spr, x: x - facing * 70, alpha: 0, scaleX: base * 1.3,
        duration: 240, ease: 'Quad.easeOut',
        onComplete: () => { spr.setActive(false).setVisible(false) },
      })
    }
  }

  /** 이단 점프 하강풍 (↑ + 점프 2연타) — 발밑에서 아래로 뿜어져 나간다 */
  doubleJumpBurst(x: number, y: number) {
    this.jumpBurst(x, y, 1.15)
  }

  jumpBurst(x: number, y: number, scale = 1) {
    const spr = this.jumpBurstPool.get(x, y) as Phaser.GameObjects.Sprite | null
    if (!spr) return
    spr.setActive(true).setVisible(true).setPosition(x, y).setOrigin(0.5, 1).setAlpha(0.9).setFlipX(false)
    if (this.scene.anims.exists('fx_jump_effect_anim')) {
      // 원본 각 셀 안의 실제 이펙트 중심. 칸 중앙(192)이 아닌 이 좌표를 원점으로 써야
      // 프레임이 바뀌어도 효과가 캐릭터 정중앙에서 좌우로 흔들리지 않는다.
      const centers = [260, 190, 161, 149, 220, 185, 82, 192]
      const normalizeFrame = () => {
        const index = Math.max(0, (spr.anims.currentFrame?.index ?? 1) - 1)
        spr.setOrigin((centers[index] ?? 192) / 384, 1)
        spr.setDisplaySize(82 * scale, 64 * scale)
      }
      spr.removeAllListeners(Phaser.Animations.Events.ANIMATION_UPDATE)
      spr.on(Phaser.Animations.Events.ANIMATION_UPDATE, normalizeFrame)
      this.playAnimOnce(spr, 'fx_jump_effect_anim')
      normalizeFrame()
    }
    else this.scene.tweens.add({
      targets: spr, alpha: 0, duration: 280,
      onComplete: () => { spr.setActive(false).setVisible(false) },
    })
  }

  /**
   * 참마돌격 이펙트 정렬 — attack()과 같은 "스트리크+폭발" 구조라 타격 지점을 origin으로 잡는다.
   * 원본(1422x613) 기준 폭발코어 x=1182 / 스트리크 축 y=289. 값은 비율이라 원본이 바뀌어도
   * 같은 구도면 성립한다. 꼬리→코어 길이를 SKILL_REACH(200)에 맞춘다.
   */
  private static readonly SKILL_FX = { originX: 0.831, originY: 0.471, lenFrac: 0.831 } as const
  private static readonly SKILL_FX_LEN_TO = 160
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
    const fixedScale = EffectManager.SKILL_FX_LEN_TO / (srcW * spec.lenFrac)
    // 단일 효과 이미지는 중심을 고정한다. 스케일을 키우며 한쪽으로 미는 연출을 제거한다.
    img.setOrigin(0.5, spec.originY)
    img.setActive(true).setVisible(true)
    img.setPosition(x, y).setAlpha(0.95).setScale(fixedScale).setFlipX(facing === -1)
      .setDepth(EffectManager.COMBAT_FX_DEPTH)
    this.scene.tweens.add({
      targets: img, alpha: 0,
      // Cubic.easeOut은 초반에 몰아서 끝나 알맹이를 놓친다 — Sine이 더 고르게 보인다
      duration: EffectManager.SKILL_FX_DURATION_MS, ease: 'Sine.easeOut',
      onComplete: () => { img.setActive(false).setVisible(false) },
    })
  }

  skillHorseCharge(x: number, y: number, facing: -1 | 1) {
    const sprite = this.zhaoChargePool.get(x, y) as Phaser.GameObjects.Sprite | null
    if (!sprite || !this.scene.anims.exists('fx_skill_horse_charge_anim')) return
    this.scene.tweens.killTweensOf(sprite)
    sprite.removeAllListeners(Phaser.Animations.Events.ANIMATION_COMPLETE)
    sprite.setActive(true).setVisible(true).setPosition(x + facing * 20, y + 14).setOrigin(0.5, 0.5)
      .setFlipX(facing === -1).setAlpha(0.98).setScale(1.44).setDepth(EffectManager.COMBAT_FX_DEPTH)
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => sprite.setActive(false).setVisible(false))
    sprite.play('fx_skill_horse_charge_anim')
    // Move the complete effect object; animation frames and their timing stay untouched.
    this.scene.tweens.add({
      targets: sprite,
      x: x + facing * 140,
      duration: 390,
      ease: 'Linear',
    })
  }

  meteorSpear(x: number, y: number, facing: -1 | 1) {
    const sprite = this.meteorPool.get(x, y) as Phaser.GameObjects.Sprite | null
    if (!sprite || !this.scene.anims.exists('fx_skill_meteor_anim')) return
    sprite.removeAllListeners(Phaser.Animations.Events.ANIMATION_COMPLETE)
    sprite.removeAllListeners(Phaser.Animations.Events.ANIMATION_UPDATE)
    sprite.setActive(true).setVisible(true).setPosition(x + facing * 120, y + 8)
      .setOrigin(0.5, 0.5)
      .setFlipX(facing === -1).setAlpha(1).setDepth(EffectManager.COMBAT_FX_DEPTH + 1)
    const normalizeSize = () => {
      const scale = 120 / (sprite.frame.realHeight || 1)
      sprite.setScale(scale).setFlipX(facing === -1)
    }
    sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, normalizeSize)
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      sprite.removeAllListeners(Phaser.Animations.Events.ANIMATION_UPDATE)
      sprite.setActive(false).setVisible(false)
    })
    sprite.play('fx_skill_meteor_anim')
    normalizeSize()
  }

  spearFlurry(x: number, y: number, facing: -1 | 1) {
    const sprite = this.spearPool.get(x, y) as Phaser.GameObjects.Sprite | null
    if (!sprite || !this.scene.anims.exists('fx_skill_spear_flurry_anim')) return
    let thrust = 0
    const playNext = () => {
      if (!sprite.active) return
      sprite.removeAllListeners(Phaser.Animations.Events.ANIMATION_COMPLETE)
      sprite.setActive(true).setVisible(true).setPosition(
        x + facing * 72,
        y + Phaser.Math.Between(-10, 10),
      ).setOrigin(0.5, 0.5).setFlipX(facing === -1).setAlpha(1)
        .setDisplaySize(190, 64).setDepth(EffectManager.COMBAT_FX_DEPTH)
      sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        thrust += 1
        if (thrust < 7) this.scene.time.delayedCall(32, playNext)
        else sprite.setActive(false).setVisible(false)
      })
      sprite.play('fx_skill_spear_flurry_anim')
    }
    playNext()
  }

  flowerBloom(x: number, y: number, facing: -1 | 1) {
    const sprite = this.flowerPool.get(x, y) as Phaser.GameObjects.Sprite | null
    if (!sprite || !this.scene.anims.exists('fx_skill_flower_anim')) return
    sprite.removeAllListeners(Phaser.Animations.Events.ANIMATION_COMPLETE)
    sprite.setActive(true).setVisible(true).setPosition(x, y - 88).setOrigin(0.5, 0.5)
      .setAlpha(0.92).setDisplaySize(920, 74).setDepth(EffectManager.COMBAT_FX_DEPTH - 1)
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => sprite.setActive(false).setVisible(false))
    sprite.play('fx_skill_flower_anim')

    // 꽃잎 배경이 먼저 퍼진 뒤 공격 궤적이 전경을 가르도록 짧게 시차를 둔다.
    this.scene.time.delayedCall(220, () => {
      const attack = this.flowerAttackPool.get(x, y) as Phaser.GameObjects.Sprite | null
      if (!attack || !this.scene.anims.exists('fx_skill_flower_attack_anim')) return
      attack.removeAllListeners(Phaser.Animations.Events.ANIMATION_COMPLETE)
      attack.setActive(true).setVisible(true).setPosition(x + facing * 72, y - 82).setOrigin(0.5, 0.5)
        .setFlipX(facing === -1).setAlpha(1).setDisplaySize(520, 210).setDepth(EffectManager.COMBAT_FX_DEPTH + 1)
      attack.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => attack.setActive(false).setVisible(false))
      attack.play('fx_skill_flower_attack_anim')
    })
  }

  spearFlurryZhao(x: number, y: number, facing: -1 | 1) {
    if (!this.scene.anims.exists('fx_skill_spear_flurry_anim')) return
    const sprite = this.spearPool.get(x, y) as Phaser.GameObjects.Sprite | null
    if (!sprite) return
    this.scene.tweens.killTweensOf(sprite)
    sprite.removeAllListeners(Phaser.Animations.Events.ANIMATION_COMPLETE)
    sprite.setActive(true).setVisible(true).setPosition(x + facing * 52, y)
      .setOrigin(facing === 1 ? 0.08 : 0.92, 0.5)
      .setFlipX(facing === -1).setAlpha(1).setScale(1)
      .setDepth(EffectManager.COMBAT_FX_DEPTH + 1)
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      sprite.setActive(false).setVisible(false)
    })
    sprite.play('fx_skill_spear_flurry_anim')
  }

  flowerAttackOnly(x: number, y: number, facing: -1 | 1) {
    const attack = this.flowerAttackPool.get(x, y) as Phaser.GameObjects.Sprite | null
    if (!attack || !this.scene.anims.exists('fx_skill_flower_attack_anim')) return
    attack.removeAllListeners(Phaser.Animations.Events.ANIMATION_COMPLETE)
    attack.setActive(true).setVisible(true).setPosition(x + facing * 72, y - 82).setOrigin(0.5, 0.5)
      .setFlipX(facing === -1).setAlpha(1).setDisplaySize(520, 210).setDepth(EffectManager.COMBAT_FX_DEPTH)
    attack.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => attack.setActive(false).setVisible(false))
    attack.play('fx_skill_flower_attack_anim')
  }

  tigerTears(x: number, y: number, facing: -1 | 1) {
    const sprite = this.tigerPool.get(x, y) as Phaser.GameObjects.Sprite | null
    if (!sprite || !this.scene.anims.exists('fx_skill_tiger_anim')) return
    this.scene.tweens.killTweensOf(sprite)
    sprite.removeAllListeners(Phaser.Animations.Events.ANIMATION_COMPLETE)
    sprite.setActive(true).setVisible(true).setPosition(x + facing * 48, y + 4).setOrigin(0.5, 1)
      .setFlipX(facing === -1).setAlpha(1).setAngle(0).setScale(2.2)
      .setDepth(EffectManager.COMBAT_FX_DEPTH)
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => sprite.setActive(false).setVisible(false))
    sprite.play('fx_skill_tiger_anim')
  }

  skillGlaive(
    x: number,
    facing: -1 | 1,
    groundY: number,
    onJump?: () => void,
    isGrounded?: () => boolean,
    impactYOffset = 0,
  ) {
    const spr = this.glaivePool.get(x, groundY) as Phaser.GameObjects.Sprite | null
    if (!spr) return
    this.scene.tweens.killTweensOf(spr)
    spr.removeAllListeners(Phaser.Animations.Events.ANIMATION_COMPLETE)
    spr.setActive(true).setVisible(true).setPosition(x, groundY).setOrigin(0.5, 1)
      .setFlipX(facing === -1).setAngle(0).setAlpha(0.98).setScale(0.64)
      .setDepth(EffectManager.COMBAT_FX_DEPTH)
    const pinPaintedFrameToGround = (_animation: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      const textureFrame = Number(frame.textureFrame)
      const visibleBottom = EffectManager.GLAIVE_ALPHA_BOTTOM[textureFrame] ?? 420
      const impactOffset = textureFrame >= 10 ? impactYOffset : 0
      spr.setY(groundY + (420 - visibleBottom) * Math.abs(spr.scaleY) + impactOffset)
    }
    spr.on(Phaser.Animations.Events.ANIMATION_UPDATE, pinPaintedFrameToGround)
    // One opening slash is enough; playing both left/right sequences made the
    // character motion fight the effect before the jump-and-slam payoff.
    const sequence = ['fx_skill_glaive_slash_left']
    let sequenceIndex = 0
    const playNext = (animation: string) => {
      spr.removeAllListeners(Phaser.Animations.Events.ANIMATION_COMPLETE)
      spr.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        sequenceIndex += 1
        if (sequenceIndex < sequence.length) playNext(sequence[sequenceIndex])
        else {
          // 두 번의 지상 베기가 끝난 뒤 점프하고, 낙하 시점에 바닥 고정 내려찍기를 재생한다.
          spr.setVisible(false)
          onJump?.()
          let hasLeftGround = false
          const waitForLanding = () => {
            if (!spr.active) return
            const grounded = isGrounded?.() ?? true
            if (!grounded) hasLeftGround = true
            // Never play the impact in mid-air: wait until the body has first
            // left the surface and then reports an actual landing.
            if (!hasLeftGround || !grounded) {
              this.scene.time.delayedCall(16, waitForLanding)
              return
            }
            spr.setVisible(true).setPosition(x, groundY).setOrigin(0.5, 1)
            spr.removeAllListeners(Phaser.Animations.Events.ANIMATION_COMPLETE)
            spr.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
              spr.off(Phaser.Animations.Events.ANIMATION_UPDATE, pinPaintedFrameToGround)
              spr.setActive(false).setVisible(false)
            })
            spr.play('fx_skill_glaive_slam')
          }
          this.scene.time.delayedCall(16, waitForLanding)
        }
      })
      spr.play(animation)
    }
    playNext(sequence[sequenceIndex])
  }

  /** 조준 스코프가 먼저 나타난 뒤, 타격 시점에 창 찌르기로 이어지는 일격필살 이펙트. */
  decisiveStrike(x: number, y: number, facing: -1 | 1, onThrustStart?: () => void) {
    const scope = this.decisivePool.get(x, y) as Phaser.GameObjects.Sprite | null
    const thrust = this.decisivePool.get(x, y) as Phaser.GameObjects.Sprite | null
    if (!scope || !thrust) return
    const scopeX = x + facing * 52
    // 찌르기 창끝이 캐릭터 뒤쪽에서 시작해 보이지 않도록 전방으로 조금 이동한다.
    const thrustX = x + facing * 112
    const hide = (sprite: Phaser.GameObjects.Sprite) => {
      sprite.removeAllListeners(Phaser.Animations.Events.ANIMATION_COMPLETE)
      this.scene.tweens.killTweensOf(sprite)
      sprite.setActive(false).setVisible(false)
    }
    hide(scope)
    hide(thrust)
    scope.setActive(true).setVisible(true).setPosition(scopeX, y).setOrigin(0.5, 0.55)
      // 원본 시트의 창은 왼쪽을 향하므로 오른쪽 공격일 때 반전한다.
      .setFlipX(facing === 1).setAngle(0).setAlpha(0.98).setDisplaySize(192, 192)
      .setDepth(EffectManager.COMBAT_FX_DEPTH)
    scope.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      hide(scope)
      onThrustStart?.()
      thrust.setActive(true).setVisible(true).setPosition(thrustX, y).setOrigin(0.5, 0.55)
        .setFlipX(facing === 1).setAngle(0).setAlpha(0.98).setDisplaySize(345, 230)
        .setDepth(EffectManager.COMBAT_FX_DEPTH)
      thrust.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => hide(thrust))
      thrust.play('fx_decisive_thrust_anim')
    })
    scope.play('fx_decisive_scope_anim')
  }

  /** 청룡참: 시전 좌표에 고정된 용이 내려와 마지막 컷을 지면에 맞춘다. */
  dragonSlash(x: number, groundY: number, facing: -1 | 1) {
    const sprite = this.dragonPool.get(x, groundY) as Phaser.GameObjects.Sprite | null
    if (!sprite) return
    this.scene.tweens.killTweensOf(sprite)
    sprite.removeAllListeners(Phaser.Animations.Events.ANIMATION_COMPLETE)
    sprite.setActive(true).setVisible(true)
      .setPosition(x, groundY).setOrigin(0.5, 1)
      .setScale(1.1, 0.8).setFlipX(facing === -1)
      .setAlpha(0.96).setDepth(EffectManager.COMBAT_FX_DEPTH)
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      sprite.setActive(false).setVisible(false)
    })
    sprite.play('fx_skill_dragon_slam')
  }

  zhaoDragonSlash(x: number, groundY: number, facing: -1 | 1) {
    const sprite = this.zhaoDragonPool.get(x, groundY) as Phaser.GameObjects.Sprite | null
    if (!sprite || !this.scene.anims.exists('fx_skill_zhao_dragon_anim')) return
    this.scene.tweens.killTweensOf(sprite)
    sprite.removeAllListeners(Phaser.Animations.Events.ANIMATION_COMPLETE)
    sprite.setActive(true).setVisible(true).setPosition(x, groundY).setOrigin(0.5, 0.5)
      .setFlipX(facing === -1).setAlpha(0.98).setDisplaySize(470, 760)
      .setDepth(EffectManager.COMBAT_FX_DEPTH)
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => sprite.setActive(false).setVisible(false))
    sprite.play('fx_skill_zhao_dragon_anim')
  }

  private defineLightningFrames() {
    if (!this.scene.textures.exists('fx_skill_lightning')) return
    if (this.scene.anims.exists('fx_skill_lightning_anim')) this.scene.anims.remove('fx_skill_lightning_anim')
    this.scene.anims.create({
      key: 'fx_skill_lightning_anim',
      frames: Array.from({ length: 8 }, (_, frame) => ({ key: 'fx_skill_lightning', frame })),
      frameRate: 30,
      repeat: 0,
    })
    if (!this.scene.textures.exists('fx_skill_lightning_small')) return
    if (this.scene.anims.exists('fx_skill_lightning_small_anim')) this.scene.anims.remove('fx_skill_lightning_small_anim')
    this.scene.anims.create({
      key: 'fx_skill_lightning_small_anim',
      frames: Array.from({ length: 8 }, (_, frame) => ({ key: 'fx_skill_lightning_small', frame })),
      frameRate: 30,
      repeat: 0,
    })
  }

  lightningDescent(x: number, groundY: number) {
    if (!this.scene.anims.exists('fx_skill_lightning_anim')) return
    const offsets = [-120, -96, -72, -48, -24, 0, 24, 48, 72, 96, 120]
    const order = Phaser.Utils.Array.Shuffle(Array.from({ length: 11 }, (_, index) => index + 1))
    order.forEach((position, index) => {
      // 작은 번개는 양끝이 아니라 중앙의 큰 낙뢰 사이에 배치해
      // 한곳으로 몰아치는 듯한 원근감을 만든다.
      const isSmall = position === 5 || position === 7
      const jitter = Phaser.Math.Between(0, 8)
      this.scene.time.delayedCall(index * 78 + jitter + (isSmall ? 16 : 0), () => {
        const pool = isSmall ? this.lightningSmallPool : this.lightningPool
        const animation = isSmall ? 'fx_skill_lightning_small_anim' : 'fx_skill_lightning_anim'
        const sprite = pool.get(x + offsets[position - 1], groundY) as Phaser.GameObjects.Sprite | null
        if (!sprite) return
        const floorPadding = isSmall ? 23 : 46
        sprite.setActive(true).setVisible(true).setPosition(x + offsets[position - 1], groundY + floorPadding)
          .setOrigin(0.5, 1)
          .setDisplaySize(isSmall ? 100 : 150, isSmall ? 230 : 340)
          .setAlpha(isSmall ? 0.86 : 1)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(isSmall ? 35 : 40)
        sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
          sprite.setActive(false).setVisible(false)
        })
        sprite.play(animation)
      })
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
    if (!this.scene.anims.exists('fx_level_beam_anim')) return
    const pillar = this.scene.add.sprite(target.x, footY, 'fx_level_up', 'level_beam_0')
      .setOrigin(0.5, 1).setDepth(EffectManager.LEVELUP_FX_DEPTH).setBlendMode(Phaser.BlendModes.ADD)
    const label = this.scene.add.sprite(target.x, target.y - 80, 'fx_level_up', 'level_label_0')
      .setOrigin(0.5).setDepth(1)
    const normalizePillar = () => pillar.setDisplaySize(130, EffectManager.LEVELUP_FX_HEIGHT)
    const normalizeLabel = () => label.setDisplaySize(112, 58)
    pillar.on(Phaser.Animations.Events.ANIMATION_UPDATE, normalizePillar)
    label.on(Phaser.Animations.Events.ANIMATION_UPDATE, normalizeLabel)
    pillar.play('fx_level_beam_anim'); normalizePillar()
    label.play('fx_level_label_anim'); normalizeLabel()
    pillar.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => pillar.destroy())
    label.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => label.destroy())
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
        fontSize: '30px', fontStyle: 'bold', stroke: '#2a1600', strokeThickness: 6,
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

    this.scene.tweens.killTweensOf(text)
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
    const targetScale = crit ? 1.2 : kind === 'taken' ? 1.02 : 1
    text.setFontSize(crit ? 40 : kind === 'taken' ? 28 : 32)
    text.setStroke('#2a1600', crit ? 8 : 6)
    text.setShadow(0, 4, '#000000', 5, true, true)
    text.setAlpha(1).setScale(targetScale * 0.7)

    this.scene.tweens.add({
      targets: text, y: y - stackOffset - 56, scale: targetScale, alpha: 0, duration: 720, ease: 'Back.easeOut',
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
