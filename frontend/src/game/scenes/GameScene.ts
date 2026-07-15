import Phaser from 'phaser'
import { EventBus, GameEvents } from '../EventBus'
import { Player } from '../entities/Player'
import { Npc } from '../entities/Npc'
import type { NpcDef } from '../entities/Npc'
import type { MonsterDef, MonsterTarget } from '../entities/Monster'
import { InputManager } from '../systems/InputManager'
import { EffectManager } from '../systems/EffectManager'
import { SpawnManager } from '../systems/SpawnManager'
import { ItemDropManager } from '../systems/ItemDropManager'
import type { DropDef } from '../systems/ItemDropManager'
import { rollBasicDamage, rollSkillDamage } from '../systems/combat'
import { gainExp } from '../systems/progression'
import { useGameStore } from '../../stores/gameStore'
import { useInventoryStore } from '../../stores/inventoryStore'
import { CAMERA, COMBAT, PLAYER } from '../config'
import { FEATURES } from '../../features'
import { drawSpeechBubble } from '../utils/bubble'

/**
 * 플레이어 머리 꼭대기의 월드 y 오프셋 (Player.y 기준). Player.ts 생성자 주석대로
 * 128px 프레임에 캐릭터 실체가 하단 정렬 68px로 구워져 있어 (프레임중심-68)*VISUAL_SCALE만큼
 * 머리가 프레임 중심보다 위에 있다.
 */
const PLAYER_HEAD_TOP_OFFSET = (128 / 2 - 68) * PLAYER.VISUAL_SCALE
/** 말풍선 꼬리 끝과 머리 사이 여백(px) */
const CHAT_BUBBLE_GAP = 6

interface PortalDef {
  x: number
  name: string
  targetMap: string
  targetX: number
  targetY?: number
}

interface MapData {
  name: string
  /** 지도(미니맵)에 표시되는 정식 명칭 */
  displayName?: string
  /** 배경 연출 테마 — castle_interior는 성벽/전각 배경 (기본: 야외 초원) */
  theme?: 'castle_interior'
  /** 바닥 아래 장식 밴드 스타일 (기본 water) */
  underFloorStyle?: 'water' | 'stone'
  worldWidth: number
  worldHeight: number
  groundY: number
  playerSpawn: { x: number; y: number }
  platforms: { x: number; y: number; width: number; kind?: 'stone' | 'wood' }[]
  obstacles: { x: number; width: number; height: number; kind: string }[]
  ladders: { x: number; yTop: number; yBottom: number; kind?: 'ladder' | 'rope' }[]
  stairs?: { x: number; baseY: number; dir: 1 | -1; steps: number }[]
  underFloorHeight?: number
  npcSpawns: { code: string; x: number; y: number }[]
  monsterSpawns: { code: string; xMin: number; xMax: number; max: number }[]
  /** 장식 건물 (충돌 없음): 관청/거리 상가/우측 성벽 마감 등 — groundY에 바닥을 맞춰 배치.
   * yOffset: 밑변 기준선을 groundY에서 위/아래로 옮긴다 (양수=아래로, 음수=위로, px). */
  decor?: { kind: 'gwan' | 'buildings' | 'rightWall'; x: number; width: number; height: number; yOffset?: number }[]
  /** 포탈: 근처에서 ↑키로 targetMap으로 이동 (GAME_DESIGN 맵 이동) */
  portals?: PortalDef[]
}

/** decor kind → 아트 키 매핑. 실제 아트가 없으면 도형 placeholder 대신 생략한다. */
const DECOR_TEXTURES: Record<string, { art: string }> = {
  gwan: { art: 'img_gwan' },
  buildings: { art: 'img_buildings' },
  rightWall: { art: 'img_right_wall' },
}

/** 포탈 상호작용 반경 (px) */
const PORTAL_RANGE = 44

/**
 * 보행로 텍스처별 발디딤 면(캐릭터가 서는 지면선) 보정치(px, 월드 좌표, 아래로 +).
 * walkway_01/02는 같은 캔버스 크기(1536×325)이지만 원본 그림에서 "밟는 면"이 그려진
 * 픽셀 행이 서로 달라(01≈y106, 02≈y128 — 약 22px 차이) groundY에 원점을 맞춰도
 * 화면상 지면선이 어긋난다. FOOT_SINK(캐릭터 발 깊이, config.ts)와는 무관 — 여기서만 보정한다.
 * 원본 PNG에서 밟는 면 행을 맞추는 게 근본 해결책이고, 이 값은 그전까지의 보정용이다.
 */
const WALKWAY_SURFACE_ADJUST: Record<string, number> = {
  img_walkway_inside: -35,
  img_walkway_outside: -5,
}

/**
 * 감숙성 내부(castle_interior) 근경 성벽(bg_inside_wall) 렌더 높이.
 * 건물(decor, 화면 앞) 중 가장 높은 gwan(270px)보다 커야 지붕 위로 성벽이 보인다.
 * addLayer(..., topY)는 map.groundY - wallH로 계산되므로 이 값을 키우면 성벽 상단이
 * 위로 올라가면서(topY 감소) 건물 뒤에서 위쪽으로 삐져나와 보이게 된다.
 */
const CASTLE_WALL_H = 201

/**
 * 렌더 깊이 레이어. 배경은 음수, 액터(플레이어/몬스터/NPC/드랍/이펙트)는 기본 0.
 * 바닥 아래 장식(연못/안뜰)은 돌바닥(walkway)보다 위, 액터보다 아래에 둔다 (⑦).
 */
const DEPTH = {
  BG_FAR: -100,   // 먼 배경(하늘/원경)
  BG_MID: -80,    // 중경(성벽/산/건물 실루엣)
  BG_NEAR: -60,   // 근경(반복 성벽/나무)
  DECOR: -52,     // 관청 등 건물 (액터 뒤)
  GROUND: -50,    // 보행로/발판/장애물/사다리
  FOREGROUND: -40, // 바닥 아래 장식(연못) — 돌바닥 위, 액터 아래
} as const

/**
 * 스테이지 1: 초원 (GAME_DESIGN 7장). 맵은 JSON 데이터 주도.
 * Phase 2 범위 추가: 전투(참격/청룡참), 황건당 좀비, 데미지/경험치/레벨업, 피격/사망.
 */
export class GameScene extends Phaser.Scene {
  private player!: Player
  private input_!: InputManager
  private effects!: EffectManager
  private spawner!: SpawnManager
  private drops!: ItemDropManager
  private npcs: Npc[] = []
  private map!: MapData
  /** 현재 맵 캐시 키 — 포탈 이동 시 scene.restart({ mapKey })로 교체 */
  private mapKey = 'map_ye_castle'
  private spawnOverride: { x: number; y: number } | null = null
  private portals: PortalDef[] = []
  private transitioning = false
  /** Monster가 참조하는 타깃 뷰 — 매 프레임 객체 재생성 방지용 단일 인스턴스 */
  private playerTarget!: MonsterTarget
  private fpsText?: Phaser.GameObjects.Text
  /** 채팅 말풍선 (재사용 컨테이너 1개, 플레이어를 따라다닌다) */
  private chatBubble?: Phaser.GameObjects.Container
  private chatBubbleText?: Phaser.GameObjects.Text
  private chatBubbleBg?: Phaser.GameObjects.Graphics
  private chatBubbleUntil = 0
  private chatBubbleH = 0

  /** AI 생성 아트가 로드됐는지 — 없으면 placeholder 폴백 (Phase 7) */
  private art(key: string) {
    return this.textures.exists(key)
  }

  private tileScaleFor(key: string, targetH: number) {
    const img = this.textures.get(key).getSourceImage() as HTMLImageElement
    return targetH / img.height
  }

  /** tileScaleFor와 달리 스프라이트시트의 개별 프레임 높이 기준으로 스케일을 계산한다
   * (스프라이트시트는 getSourceImage()가 시트 전체 크기를 반환해 tileScaleFor를 못 쓴다). */
  private tileScaleForFrame(key: string, frame: number, targetH: number) {
    const f = this.textures.get(key).get(frame)
    return targetH / f.height
  }

  constructor() {
    super('Game')
  }

  /** 게임 시작(기본: 감숙성 내부 안전지대) 또는 포탈 이동(scene.restart)의 진입 데이터 */
  init(data: { mapKey?: string; spawnX?: number; spawnY?: number }) {
    this.mapKey = data.mapKey ?? 'map_ye_castle'
    this.spawnOverride =
      data.spawnX !== undefined ? { x: data.spawnX, y: data.spawnY ?? 440 } : null
    this.transitioning = false
    this.npcs = []
    this.portals = []
  }

  create() {
    const map = this.cache.json.get(this.mapKey) as MapData
    this.map = map
    const { width } = this.scale

    this.physics.world.setBounds(0, 0, map.worldWidth, map.worldHeight)
    this.cameras.main.setBounds(0, 0, map.worldWidth, map.worldHeight)
    this.cameras.main.setBackgroundColor(0x87ceeb)
    // 메이플 비율: 줌으로 캐릭터/지형을 크게 (config.CAMERA.ZOOM)
    this.cameras.main.setZoom(CAMERA.ZOOM)
    this.cameras.main.setRoundPixels(true)

    // 줌 적용 후 실제 보이는 월드 크기 — 배경 커버 폭 계산용
    const viewW = width / CAMERA.ZOOM
    const cover = (factor: number) => Math.ceil(viewW + factor * map.worldWidth) + 256

    // ---- 3단 패럴랙스 배경 (원근 완만 + 심리스 타일, ⑤⑥) ----
    // tileSprite로 가로 무한 반복 → 중앙 패턴이 이음새 없이 이어진다.
    // 스크롤 계수를 far/mid/near로 나눠 2단일 때의 급격한 시차(멀미)를 줄인다.
    // 실제 아트 도입 시 manifest 키만 채우면 같은 자리에 교체된다.
    const addLayer = (key: string, scroll: number, depth: number, heightPx: number, topY: number) => {
      if (!this.art(key)) return undefined
      const yScroll = scroll < 0.2 ? scroll : 1 // 먼 배경만 세로 시차, 지면 기준 레이어는 세로 고정
      const layer = this.add
        .tileSprite(0, topY, cover(scroll), heightPx, key)
        .setOrigin(0, 0)
        .setScrollFactor(scroll, yScroll)
        .setDepth(depth)
      const sc = this.tileScaleFor(key, heightPx)
      layer.setTileScale(sc, sc)
      // WebGL tileSprite는 텍스처를 REPEAT로 감싸는데, LINEAR 필터가 타일 경계(위/아래 끝)에서
      // 반대쪽 끝 픽셀과 섞어 얇은 가로 선(seam)을 만든다. NEAREST로 바꾸면 그 보간이 없어져
      // 경계에서 엉뚱한 색이 섞이지 않는다 (성벽 위쪽에 계속 보이던 검은 줄의 원인).
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST)
      return layer
    }

    /**
     * addLayer와 달리 tileSprite(GPU REPEAT) 대신 타일 폭만큼 개별 Image를 나란히 배치한다.
     * tileSprite는 반복 단위를 통째로 같은 텍스처로만 채우기 때문에 "특정 칸만 다른 그림"이
     * 불가능해서, 성벽 중간 칸에 성문(gate) 변형을 끼워 넣으려면 이 방식이 필요하다.
     * count/gateIndex는 호출부에서 직접 지정한다 — cover(scroll) 기준으로 자동 계산하면
     * parallax(스크롤계수 0.6) 여유분 때문에 카메라를 끝까지 밀어도 화면에 거의/전혀 안 잡히는
     * 칸까지 만들어져(마지막 칸은 화면에 아예 안 잡히고, 그 앞 칸도 가장자리 일부만 잠깐 보임)
     * 값을 눈으로 확인하며 맞추는 게 낫다.
     * 타일 폭을 정수로 반올림해 배치해야 setRoundPixels(true)에서 칸마다 독립적으로 반올림되며
     * 생기는 1px 이음새를 막을 수 있다.
     */
    const addTiledWall = (
      key: string, gateKey: string, scroll: number, depth: number, heightPx: number, topY: number,
      count: number, gateIndex: number,
    ) => {
      if (!this.art(key)) return
      const yScroll = scroll < 0.2 ? scroll : 1
      const sc = this.tileScaleFor(key, heightPx)
      const tileW = Math.round((this.textures.get(key).getSourceImage() as HTMLImageElement).width * sc)
      const hasGate = this.art(gateKey)
      for (let i = 0; i < count; i++) {
        const texKey = hasGate && i === gateIndex ? gateKey : key
        this.add
          .image(i * tileW, topY, texKey)
          .setOrigin(0, 0)
          .setScrollFactor(scroll, yScroll)
          .setDepth(depth)
          .setDisplaySize(tileW, heightPx)
        this.textures.get(texKey).setFilter(Phaser.Textures.FilterMode.NEAREST)
      }
    }

    if (map.theme === 'castle_interior') {
      this.cameras.main.setBackgroundColor(0xa8dde0)
      // far: 하늘 + 먼 원경 (아주 느림)
      addLayer(this.art('bg_castle_interior') ? 'bg_castle_interior' : 'ph_bg_far', 0.1, DEPTH.BG_FAR, map.worldHeight, 0)
      // 제일 먼 배경: 성벽 위로 아스라이 보이는 산 능선 (반복, 아주 느린 시차 — 하늘보다도 느리진 않되 성벽/건물보다 훨씬 느리게)
      // topY=0 → 화면 맨 꼭대기에 밀착 (스크롤계수가 낮아 카메라가 움직여도 거의 고정으로 보인다)
      if (this.art('bg_mountain')) {
        addLayer('bg_mountain', 0.08, DEPTH.BG_FAR, 300, 80)
      }
      // mid: 멀리 보이는 성벽/망루 (반복) — 실제 아트(img_castle_mid)가 있을 때만.
      // placeholder(ph_bg_mid)는 near 성벽과 겹쳐 "성벽이 둘"로 보여서 castle_interior에선 생략.
      if (this.art('img_castle_mid')) {
        addLayer('img_castle_mid', 0.35, DEPTH.BG_MID, 300, map.groundY - 280)
      }
      // near: 안뜰을 두른 성벽 — bg_inside_wall 5칸 반복, 4번째 칸만 bg_inside_wall_gate.
      // CASTLE_WALL_H를 건물보다 크게 잡아 성벽 상단이 건물 지붕 위로 드러나 보이게 한다.
      const wallH = CASTLE_WALL_H
      if (this.art('img_castle_wall')) {
        addTiledWall('img_castle_wall', 'img_castle_wall_gate', 0.7, DEPTH.BG_NEAR, wallH + 25, map.groundY - wallH - 33, 5, 3)
      } else {
        addLayer('ph_wall', 0.7, DEPTH.BG_NEAR, wallH + 25, map.groundY - wallH - 33)
      }
    } else {
      // 야외(성 밖): 하늘 → 먼 산 → 언덕/성곽
      addLayer(this.art('bg_sky') ? 'bg_sky' : 'ph_bg_far', 0.1, DEPTH.BG_FAR, map.worldHeight, 0)
      // 감숙성 내부와 동일한 원경 산 능선을 성 밖에도 적용 (⑤⑥ 톤 일관성)
      if (this.art('bg_mountain')) {
        addLayer('bg_mountain', 0.08, DEPTH.BG_FAR, 300, 80)
      }
      // 예전엔 중경에 'bg_mountains'(도형 placeholder — PreloadScene에 삼각형 산으로 무조건 생성됨)를
      // 폴백으로 썼는데, 그 키로 실제 아트가 로드되는 일이 없어 항상 삼각형이 보였다. 실제 아트가
      // 생기기 전까진 이 레이어를 아예 생략 — 삼각형 placeholder보다 없는 게 낫다.
      const nearKey = this.art('bg_castle') ? 'bg_castle' : this.art('bg_hills') ? 'bg_hills' : 'ph_wall'
      addLayer(nearKey, 0.55, DEPTH.BG_NEAR, 220, map.groundY - 200)
    }

    // ---- 지형 ----
    const solids = this.physics.add.staticGroup()
    const oneWays = this.physics.add.staticGroup()

    // 보행로(바닥): 지면선 아래 1줄만 물리 충돌. 그 아래는 장식 밴드 (GAME_DESIGN 10.1)
    // 감숙성 내부 내부는 walkway_01(석재), 성 밖은 walkway_02(흙/잔디 길)로 별도 텍스처를 쓴다.
    const walkwayKey = map.theme === 'castle_interior' ? 'img_walkway_inside' : 'img_walkway_outside'
    const walkwayArt = this.art(walkwayKey)
    for (let x = 0; x < map.worldWidth; x += 32) {
      const t = solids.create(x + 16, map.groundY + 16, 'tile_ground') as Phaser.Physics.Arcade.Sprite
      t.setDepth(DEPTH.GROUND)
      if (walkwayArt) t.setVisible(false) // 충돌만 담당, 시각은 이미지로
    }
    // 바닥 아래 장식 밴드 — 캐릭터가 화면 bottom에 직접 닿지 않는다 (성 내부는 석재 안뜰)
    const underH = map.underFloorHeight ?? 96
    const underArtKey = map.underFloorStyle === 'stone' ? 'img_courtyard' : 'bg_river'
    const underFallback = map.underFloorStyle === 'stone' ? 'tile_underfloor_stone' : 'tile_underfloor'
    // 바닥 아래 장식(연못/안뜰)은 돌바닥보다 위 depth — 돌바닥 하단 가림 없이 앞에 보인다 (⑦)
    if (this.art(underArtKey)) {
      const wh = underH + 40
      const bandY = map.worldHeight - wh
      this.add.tileSprite(0, bandY, map.worldWidth, wh, underArtKey).setOrigin(0, 0)
        .setTileScale(this.tileScaleFor(underArtKey, wh))
        .setDepth(DEPTH.FOREGROUND)
      // 물결 애니메이션 오버레이 — 연못 전체가 아니라 물이 실제로 움직이는 "일부 구간"에만 얹는다.
      // 정지 이미지 bg_river.png(원본 926px) 안에서 움직이는 물은 위에서 RIVER_ANIM_SRC_TOP(470px)
      // 지점부터 RIVER_ANIM_SRC_H(220px) 높이 구간이다. 연못은 화면에서 wh 높이로 축소돼 그려지므로
      // (스케일 = wh/926), 오버레이도 같은 스케일로 그 부분 구간에만 맞춰 위치·크기를 잡는다.
      // (예전엔 연못과 1:1 크기라 가정해 밴드 전체를 덮어 물이 지나치게 크게 나왔다.)
      if (map.underFloorStyle !== 'stone' && this.art('bg_river_anim')) {
        const RIVER_SRC_H = 926     // bg_river.png 원본 세로
        const RIVER_ANIM_SRC_TOP = 265 // 연못 원본 기준 물 애니메이션 시작 y
        const RIVER_ANIM_SRC_H = 460   // 연못 원본 기준 물 애니메이션 높이
        const scale = wh / RIVER_SRC_H
        const animY = bandY + RIVER_ANIM_SRC_TOP * scale
        const animH = RIVER_ANIM_SRC_H * scale
        const frameCount = this.textures.get('bg_river_anim').frameTotal - 1 // frameTotal은 __BASE 포함
        // 프레임을 즉시 setTexture로 바꾸면 뚝뚝 끊긴다 → 레이어 2장을 겹쳐놓고 알파를 크로스페이드해
        // 스르륵 녹아들 듯 교체한다. 한 장(top)이 서서히 사라지는 동안 다른 장(back)에 다음 프레임을
        // 깔아 서서히 띄운다. 둘 다 반투명 물이라 겹치는 순간에도 자연스러운 디졸브가 된다.
        const makeLayer = () => {
          const o = this.add.tileSprite(0, animY, map.worldWidth, animH, 'bg_river_anim', 0).setOrigin(0, 0)
          o.setTileScale(this.tileScaleForFrame('bg_river_anim', 0, animH))
          o.setDepth(DEPTH.FOREGROUND + 1)
          return o
        }
        const DEPTH_BASE = DEPTH.FOREGROUND + 1
        // base: 항상 불투명하게 깔려 있는 현재 프레임. incoming: 그 위에 다음 프레임을 0→1로 페이드인.
        // 아래를 계속 불투명하게 두므로 전환 중간에 물이 옅어지는 "꺼짐" 없이 스르륵 덮인다.
        let base = makeLayer()
        let incoming = makeLayer().setAlpha(0).setDepth(DEPTH_BASE + 1)
        let frame = 0
        const HOLD = 390 // 프레임 교체 주기 (잔잔하게)
        const FADE = 50 // 페이드인 시간 (길수록 easing이 뚜렷하게 보인다)
        const EASE = 'Quad.InOut' // 'Cubic.InOut', 'Quad.Out', 'Linear' 등으로 교체 가능
        this.time.addEvent({
          delay: HOLD,
          loop: true,
          callback: () => {
            frame = (frame + 1) % frameCount
            incoming.setTexture('bg_river_anim', frame).setAlpha(0).setDepth(DEPTH_BASE + 1)
            base.setDepth(DEPTH_BASE)
            this.tweens.add({
              targets: incoming, alpha: 1, duration: FADE, ease: EASE,
              onComplete: () => { const t = base; base = incoming; incoming = t }, // 역할 교대
            })
          },
        })
      }
    } else {
      this.add.tileSprite(0, map.groundY + 32, map.worldWidth, underH, underFallback)
        .setOrigin(0, 0).setDepth(DEPTH.FOREGROUND)
    }
    if (walkwayArt) {
      const wwH = 84
      const walkwayY = map.groundY + (WALKWAY_SURFACE_ADJUST[walkwayKey] ?? 0)
      const walkway = this.add.tileSprite(0, walkwayY, map.worldWidth, wwH, walkwayKey).setOrigin(0, 0)
      walkway.setTileScale(this.tileScaleFor(walkwayKey, wwH))
      walkway.setDepth(DEPTH.GROUND)
    }

    // 계단형 이동 (GAME_DESIGN 10.2): 1단 = 32x16 솔리드 + 플레이어 자동 스텝업
    for (const st of map.stairs ?? []) {
      for (let i = 0; i < st.steps; i++) {
        const sx = st.x + i * 32 * st.dir
        const top = st.baseY - (i + 1) * 16
        // 아래 단부터 현재 단 높이까지 채워 옆면이 막히게
        for (let y = top; y < st.baseY; y += 16) {
          solids.create(sx + 16 * st.dir, y + 8, 'tile_step')
        }
      }
    }
    for (const p of map.platforms) {
      const artKey = p.kind === 'wood' ? 'img_platform_wood' : 'img_platform_stone'
      const hasArt = this.art(artKey)
      for (let x = 0; x < p.width; x += 32) {
        const tile = oneWays.create(p.x + x + 16, p.y + 8, 'tile_platform') as Phaser.Physics.Arcade.Sprite
        const body = tile.body as Phaser.Physics.Arcade.StaticBody
        body.checkCollision.down = false
        body.checkCollision.left = false
        body.checkCollision.right = false
        if (hasArt) tile.setVisible(false)
      }
      if (hasArt) {
        // 발판 이미지: 상단 잔디선이 충돌면(p.y)과 일치하도록 배치
        this.add.image(p.x + p.width / 2, p.y - 7, artKey).setDisplaySize(p.width + 28, 58).setOrigin(0.5, 0).setDepth(DEPTH.GROUND)
      }
    }
    for (const o of map.obstacles) {
      const artKey = o.kind === 'rock' ? 'img_rock' : o.kind === 'barricade' ? 'img_barricade' : ''
      const fallback = o.kind === 'cart' ? 'obstacle_cart' : 'obstacle_rock'
      const key = artKey && this.art(artKey) ? artKey : fallback
      const spr = solids.create(o.x + o.width / 2, map.groundY - o.height / 2, key) as Phaser.Physics.Arcade.Sprite
      spr.setDepth(DEPTH.GROUND)
      if (key === artKey) {
        spr.setDisplaySize(o.width, o.height)
        ;(spr.body as Phaser.Physics.Arcade.StaticBody).setSize(o.width, o.height)
        spr.refreshBody()
      }
    }

    // ---- 장식 건물 (관청 — 충돌 없음, 지면에 바닥 정렬) ----
    // 실제 아트가 없으면 도형 placeholder로 대체하지 않고 아예 생략한다 (건물이 안 보이는 편이
    // 삼각형 지붕 도형이 보이는 것보다 낫다 — img_castle_mid와 동일한 정책).
    for (const d of map.decor ?? []) {
      const tex = DECOR_TEXTURES[d.kind]
      if (!tex || !this.art(tex.art)) continue
      // 밑변 기준선: 기본 groundY, yOffset이 있으면 위/아래로 이동 (양수=아래, 음수=위)
      this.add.image(d.x, map.groundY + (d.yOffset ?? 0), tex.art).setOrigin(0.5, 1).setDisplaySize(d.width, d.height).setDepth(DEPTH.DECOR)
    }

    const ladders = map.ladders.map((l) => {
      const artKey = l.kind === 'rope' ? 'img_rope' : 'img_ladder'
      if (this.art(artKey)) {
        const w = l.kind === 'rope' ? 26 : 50
        this.add.image(l.x, l.yTop, artKey).setOrigin(0.5, 0).setDisplaySize(w, l.yBottom - l.yTop + 8).setDepth(DEPTH.GROUND)
      } else {
        const tex = l.kind === 'rope' ? 'tile_rope' : 'tile_ladder'
        for (let y = l.yTop; y < l.yBottom; y += 32) {
          this.add.image(l.x, y + 16, tex).setDepth(DEPTH.GROUND)
        }
      }
      const zone = this.add.zone(l.x, (l.yTop + l.yBottom) / 2, 32, l.yBottom - l.yTop)
      return { zone, x: l.x, yTop: l.yTop, yBottom: l.yBottom }
    })

    // ---- 포탈 (↑키로 맵 이동) ----
    this.portals = map.portals ?? []
    for (const p of this.portals) {
      // 상호작용은 this.portals(좌표) 기준이라 이미지 유무와 무관 — 실제 아트 없으면
      // 도형 소용돌이 placeholder 대신 안내 텍스트만 표시한다.
      if (this.art('img_portal')) {
        const portal = this.add.image(p.x, map.groundY - 4, 'img_portal').setOrigin(0.5, 1)
        this.tweens.add({
          targets: portal, scaleX: 0.86, alpha: 0.75,
          duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        })
      }
      this.add
        .text(p.x, map.groundY - 128, `${p.name} ▲`, {
          fontSize: '12px', color: '#e3f2fd', backgroundColor: '#1a237e99', padding: { x: 6, y: 2 },
        })
        .setOrigin(0.5)
    }

    // ---- 플레이어 / 이펙트 ----
    const spawn = this.spawnOverride ?? map.playerSpawn
    this.effects = new EffectManager(this)
    this.player = new Player(this, spawn.x, spawn.y)
    this.player.setLadders(ladders)
    this.input_ = new InputManager(this)

    this.physics.add.collider(this.player, solids, undefined, () => !this.player.climbing)
    // 계단 자동 스텝업용: 해당 영역에 정적 바디가 없는지 검사 (Player가 사용)
    this.player.canStepUp = (x, y, w, h) =>
      this.physics.overlapRect(x, y, w, h, false, true).length === 0
    this.physics.add.collider(this.player, oneWays, undefined, () => {
      return !this.player.climbing && this.time.now >= this.player.droppingUntil
    })

    // ---- 전투 판정 주입 (Player는 몬스터를 직접 모른다) ----
    this.player.onBasicAttack = (hitbox, facing) => {
      // 기본 공격은 창 찌르기 단일 모션 (2026-07-16 통합 — 휘두르기 분기 폐지)
      this.effects.attack(this.player.x + facing * 62, this.player.y - 6, facing)
      this.resolveAttack(hitbox, COMBAT.ATTACK_MAX_TARGETS, false)
    }
    // 공중 액션 이펙트 (점프 대쉬 잔상 / 이단 점프 하강풍)
    this.player.onAirDash = (x, y, facing) => this.effects.dashTrail(x, y, facing)
    this.player.onDoubleJump = (x, y) => this.effects.doubleJumpBurst(x, y + 24)
    this.player.onSkill = (hitbox, facing) => {
      this.effects.skillDragon(this.player.x + facing * 100, this.player.y - 10, facing)
      this.resolveAttack(hitbox, COMBAT.SKILL_MAX_TARGETS, true)
      // 히트스톱 (GAME_DESIGN 4.2 — 짧은 타격 정지감)
      this.physics.pause()
      this.cameras.main.shake(90, 0.004)
      this.time.delayedCall(COMBAT.SKILL_HITSTOP_MS, () => this.physics.resume())
    }

    // ---- 몬스터 타깃 뷰 ----
    const self = this
    this.playerTarget = {
      get x() { return self.player.x },
      get y() { return self.player.y },
      get alive() { return self.player.isHittable },
      receiveHit: (attack: number, fromX: number) => {
        self.player.receiveHit(attack, fromX)
        self.effects.damageNumber(self.player.x, self.player.y - 46, attack, 'taken', false, self.player)
      },
    }

    // ---- 드랍 ----
    this.drops = new ItemDropManager(this, [solids])

    // ---- 몬스터 ----
    const defs = this.cache.json.get('monster_defs') as Record<string, MonsterDef & { drops?: DropDef[] }>
    this.spawner = new SpawnManager(this, defs, map.groundY, [solids])
    for (const area of map.monsterSpawns) {
      this.spawner.registerArea(area.code, area.xMin, area.xMax, area.max)
    }

    // ---- 카메라 ----
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12)
    this.cameras.main.setDeadzone(120, 80)

    // ---- NPC (GAME_DESIGN 9장) ----
    const npcDefs = this.cache.json.get('npc_defs') as Record<string, NpcDef>
    this.npcs = []
    for (const n of map.npcSpawns) {
      const def = npcDefs[n.code]
      if (def) this.npcs.push(new Npc(this, n.x, n.y, n.code, def))
    }

    // ---- 성장/사망 이벤트 ----
    EventBus.on(GameEvents.LEVEL_UP, this.handleLevelUp, this)
    EventBus.on(GameEvents.PLAYER_DIED, this.handleDeath, this)
    EventBus.on(GameEvents.REVIVE, this.handleRevive, this)
    EventBus.on(GameEvents.USE_ITEM, this.handleUseItem, this)
    EventBus.on(GameEvents.ITEM_PICKED, this.handleItemPicked, this)
    EventBus.on(GameEvents.INPUT_BLOCK, this.handleInputBlock, this)
    EventBus.on(GameEvents.CHAT_BUBBLE, this.handleChatBubble, this)
    EventBus.on(GameEvents.CAST_SKILL, this.handleCastSkill, this)
    EventBus.on(GameEvents.REQUEST_SCREENSHOT, this.takeScreenshot, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off(GameEvents.LEVEL_UP, this.handleLevelUp, this)
      EventBus.off(GameEvents.PLAYER_DIED, this.handleDeath, this)
      EventBus.off(GameEvents.REVIVE, this.handleRevive, this)
      EventBus.off(GameEvents.USE_ITEM, this.handleUseItem, this)
      EventBus.off(GameEvents.ITEM_PICKED, this.handleItemPicked, this)
      EventBus.off(GameEvents.INPUT_BLOCK, this.handleInputBlock, this)
      EventBus.off(GameEvents.CHAT_BUBBLE, this.handleChatBubble, this)
      EventBus.off(GameEvents.CAST_SKILL, this.handleCastSkill, this)
      EventBus.off(GameEvents.REQUEST_SCREENSHOT, this.takeScreenshot, this)
    })

    // ---- 미니맵 데이터 (React Minimap이 구독) ----
    EventBus.emit(GameEvents.MAP_INFO, {
      name: map.name,
      displayName: map.displayName ?? map.name,
      worldWidth: map.worldWidth,
      worldHeight: map.worldHeight,
      groundY: map.groundY,
      platforms: map.platforms.map((p) => ({ x: p.x, y: p.y, width: p.width })),
      ladders: map.ladders.map((l) => ({ x: l.x, yTop: l.yTop, yBottom: l.yBottom })),
      npcs: map.npcSpawns.map((n) => ({ x: n.x, y: map.groundY - 32 })),
      portals: this.portals.map((p) => ({ x: p.x, y: map.groundY - 40 })),
    })
    // 플레이어 위치는 100ms 간격 스로틀 전송 — React 리렌더 부담 최소화
    this.time.addEvent({
      delay: 100, loop: true, callback: () => {
        EventBus.emit(GameEvents.PLAYER_MOVED, { x: this.player.x, y: this.player.y })
      },
    })

    // ---- 자연 회복 (GAME_DESIGN 5.2): 비전투 3초 후 초당 회복 ----
    this.time.addEvent({
      delay: 1000, loop: true, callback: () => {
        const s = useGameStore.getState()
        if (s.playerDead) return
        if (this.time.now - this.player.lastCombatAt < COMBAT.REGEN_IDLE_AFTER_MS) return
        s.setStats({
          hp: Math.min(s.maxHp, s.hp + COMBAT.REGEN_HP_PER_SEC),
          mp: Math.min(s.maxMp, s.mp + COMBAT.REGEN_MP_PER_SEC),
        })
      },
    })

    // FPS 계측 (F3 토글, Phase 6 검증용)
    this.fpsText = this.add
      .text(8, 8, '', { fontSize: '12px', color: '#00e676', backgroundColor: '#00000088', padding: { x: 4, y: 2 } })
      .setDepth(1000).setVisible(false).setScale(1 / CAMERA.ZOOM)
    this.input.keyboard!.on('keydown-F3', () => this.fpsText!.setVisible(!this.fpsText!.visible))
    this.time.addEvent({
      delay: 500, loop: true, callback: () => {
        if (this.fpsText!.visible) this.fpsText!.setText(`FPS ${this.game.loop.actualFps.toFixed(0)}`)
      },
    })

    this.cameras.main.fadeIn(300, 0, 0, 0)
    EventBus.emit(GameEvents.SCENE_READY, this.scene.key)
  }

  /** 포탈 이동: 페이드아웃 후 대상 맵으로 씬 재시작 (안전지대 ↔ 사냥터) */
  private usePortal(p: PortalDef) {
    if (this.transitioning) return
    this.transitioning = true
    this.player.setVelocityX(0)
    this.cameras.main.fadeOut(300, 0, 0, 0)
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.restart({ mapKey: p.targetMap, spawnX: p.targetX, spawnY: p.targetY ?? 440 })
    })
  }

  /** 히트박스 안의 몬스터에게 데미지 — 가까운 순 maxTargets마리 (GAME_DESIGN 4.1) */
  private resolveAttack(hitbox: Phaser.Geom.Rectangle, maxTargets: number, isSkill: boolean) {
    const attackPower = useGameStore.getState().attackPower
    const candidates = this.spawner.monsters
      .filter((m) => m.alive && hitbox.contains(m.x, m.y))
      .sort((a, b) => Math.abs(a.x - this.player.x) - Math.abs(b.x - this.player.x))
      .slice(0, maxTargets)

    for (const m of candidates) {
      const dmg = isSkill
        ? rollSkillDamage(attackPower, m.def.defense)
        : rollBasicDamage(attackPower, m.def.defense)
      const died = m.receiveHit(dmg.amount, dmg.crit, this.player.x, this.effects, this.time.now)
      if (died) {
        gainExp(m.def.exp)
        // 드랍 판정 (GAME_DESIGN 8.1) — 장비 숨김 중엔 골드 외 아이템은 인벤토리로 못 가니 제외
        const allDrops = (m.def as MonsterDef & { drops?: DropDef[] }).drops
        const drops = FEATURES.equipment ? allDrops : allDrops?.filter((d) => d.code === 'coin')
        if (drops) this.drops.rollDrops(m.x, m.y - 10, drops)
      }
    }
  }

  private handleLevelUp = () => {
    this.effects.levelUp(this.player)
    // 레벨 구간이 바뀌면 외형 티어 스프라이트로 교체 (character-progression-pivot)
    this.player.refreshTier()
  }

  private handleItemPicked = (p: { code: string; quantity: number; x: number; y: number }) => {
    const name = p.code === 'coin' ? `+${p.quantity} G` : `+${p.quantity} ${useInventoryStore.getState().defs[p.code]?.name ?? p.code}`
    this.effects.pickupLabel(p.x, p.y - 20, name)
  }

  /** 물약 사용 연출 (GAME_DESIGN 8.2) — 회복 로직은 inventoryStore가 처리 */
  private handleUseItem = () => {
    this.player.setTint(0x81c784)
    this.time.delayedCall(150, () => this.player.clearTint())
  }

  /** 채팅 전송 → 플레이어 머리 위 말풍선 (NPC 말풍선과 동일한 스타일, 3초 표시) */
  private handleChatBubble = (text: string) => {
    if (!this.chatBubble) {
      this.chatBubbleText = this.add
        .text(0, 0, '', { fontSize: '12px', color: '#333333', wordWrap: { width: 170 } })
        .setOrigin(0.5)
      this.chatBubbleBg = this.add.graphics()
      this.chatBubble = this.add
        .container(0, 0, [this.chatBubbleBg, this.chatBubbleText])
        .setDepth(900)
        .setVisible(false)
    }
    const msg = text.length > 60 ? `${text.slice(0, 60)}…` : text
    this.chatBubbleText!.setText(msg)
    const w = this.chatBubbleText!.width + 16
    const h = this.chatBubbleText!.height + 10
    this.chatBubbleH = h
    drawSpeechBubble(this.chatBubbleBg!, w, h)
    this.chatBubble.setVisible(true)
    this.chatBubbleUntil = this.time.now + 3000
  }

  /** 퀵슬롯 스킬 발동 요청 (숫자키) — 실제 시전 가능 여부는 Player가 판정 */
  private handleCastSkill = () => {
    this.player.queueSkill()
  }

  /** 채팅 입력·설정 패널이 열린 동안 게임 키 입력을 차단한다 */
  private handleInputBlock = (blocked: boolean) => {
    const kb = this.input.keyboard
    if (!kb) return
    kb.enabled = !blocked
    if (blocked) {
      kb.resetKeys()
      this.input_.clearAll()
    }
  }

  /** 스크린샷: 게임 캔버스를 PNG로 저장 (메이플 Scroll Lock 스샷) */
  private takeScreenshot() {
    this.game.renderer.snapshot((image) => {
      const src = (image as HTMLImageElement).src
      const a = document.createElement('a')
      const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
      a.href = src
      a.download = `threeKingdomsStory_${ts}.png`
      a.click()
    })
    this.cameras.main.flash(120, 255, 255, 255) // 촬영 피드백
  }

  private handleDeath = () => {
    useGameStore.getState().setPlayerDead(true)
    this.cameras.main.fadeOut(400, 60, 60, 60)
  }

  private handleRevive = () => {
    useGameStore.getState().setPlayerDead(false)
    this.player.revive(this.map.playerSpawn.x, this.map.playerSpawn.y)
    this.cameras.main.fadeIn(400)
  }

  update(_time: number, _delta: number) {
    this.input_.update(this.time.now)
    this.player.update(this.input_, this.time.now)

    // UI 토글 단축키 — UI는 React가 담당 (렌더링 분리 원칙)
    if (this.input_.inventoryJustDown) EventBus.emit(GameEvents.TOGGLE_INVENTORY)
    if (this.input_.questJustDown) EventBus.emit(GameEvents.TOGGLE_QUEST)
    if (this.input_.minimapJustDown) EventBus.emit(GameEvents.TOGGLE_MINIMAP)
    if (this.input_.screenshotJustDown) this.takeScreenshot()

    // 캐릭터가 NPC와 겹쳐 있는 동안 테두리(글로우) 표시
    for (let i = 0; i < this.npcs.length; i++) {
      this.npcs[i].setPlayerOverlap(this.npcs[i].isPlayerNear(this.player.x, this.player.y))
    }

    // ↑ 상호작용: 포탈 우선, 그다음 NPC 대화 (포탈/NPC는 맵에서 겹치지 않게 배치)
    if (this.input_.upJustDown && !this.player.climbing && !this.transitioning) {
      const portal = this.portals.find((p) => Math.abs(this.player.x - p.x) < PORTAL_RANGE)
      if (portal && this.player.body.blocked.down) {
        this.usePortal(portal)
      } else {
        for (let i = 0; i < this.npcs.length; i++) {
          const npc = this.npcs[i]
          if (npc.isPlayerNear(this.player.x, this.player.y)) {
            EventBus.emit(GameEvents.OPEN_DIALOG, { code: npc.code, name: npc.def.name, lines: npc.def.dialog })
            break
          }
        }
      }
    }

    // 드랍 아이템: 만료/자동획득/Z 줍기
    this.drops.update(this.player.x, this.player.y, this.input_.pickupJustDown, this.time.now)

    // 몬스터 AI — update() 안에서 할당/클로저 생성 최소화 (성능 규칙 3)
    const monsters = this.spawner.monsters
    const now = this.time.now
    for (let i = 0; i < monsters.length; i++) {
      const m = monsters[i]
      if (m.active) m.update(this.playerTarget, now)
    }

    // 채팅 말풍선: 플레이어를 따라다니다 시간이 되면 숨김
    if (this.chatBubble?.visible) {
      if (this.time.now >= this.chatBubbleUntil) this.chatBubble.setVisible(false)
      else {
        const tailTipY = this.player.y + PLAYER_HEAD_TOP_OFFSET - CHAT_BUBBLE_GAP
        this.chatBubble.setPosition(this.player.x, tailTipY - this.chatBubbleH / 2 - 7)
      }
    }

    // 배경 패럴랙스는 scrollFactor가 처리 — 여기서는 FPS 오버레이 위치만 보정
    if (this.fpsText?.visible) {
      const v = this.cameras.main.worldView
      this.fpsText.setPosition(v.x + 6, v.y + 6)
    }
  }

}
