import Phaser from 'phaser'
import { EventBus, GameEvents } from '../EventBus'
import { Player } from '../entities/Player'
import { Npc } from '../entities/Npc'
import type { NpcDef } from '../entities/Npc'
import type { Monster, MonsterDef, MonsterTarget } from '../entities/Monster'
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
  /** 바닥 아래 장식 밴드 스타일 (기본 water — 성 밖의 수면) */
  underFloorStyle?: 'water' | 'stone' | 'river'
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
  decor?: { kind: 'gwan' | 'buildings' | 'rightWall' | 'castleOutside'; x: number; width: number; height: number; yOffset?: number }[]
  /** 포탈: 근처에서 ↑키로 targetMap으로 이동 (GAME_DESIGN 맵 이동) */
  portals?: PortalDef[]
}

/** decor kind → 아트 키 매핑. 실제 아트가 없으면 도형 placeholder 대신 생략한다. */
const DECOR_TEXTURES: Record<string, { art: string }> = {
  gwan: { art: 'img_gwan' },
  buildings: { art: 'img_buildings' },
  rightWall: { art: 'img_right_wall' },
  castleOutside: { art: 'img_castle_outside' }, // 성 밖 왼쪽 포탈 옆 성 모형
}

/**
 * underFloorStyle → 바닥 아래 장식 밴드 아트 키.
 * river(감숙성 연못)만 물결 애니메이션 오버레이를 얹는다 — 오버레이 좌표가 bg_river.png
 * 원본 크기(926px) 기준으로 계산되므로 다른 아트에 쓰면 위치·크기가 어긋난다.
 * water(성 밖)는 이름과 달리 지금은 **물이 마른 연못** 아트다(bg_dried_up_pond.jpg).
 * 스타일 이름은 맵 JSON(stage1_grassland)과 맞물려 있어 그대로 두었다.
 */
const UNDER_FLOOR_TEXTURES: Record<string, string> = {
  stone: 'img_courtyard',
  river: 'bg_river',
  water: 'img_water',
}

/**
 * 성 밖 근경(폐허 건물) 배치.
 * bg_broken_buildings.png는 1536×1024 캔버스지만 **실제 건물은 y 386~712에만** 있고 위아래가
 * 투명 여백이다. 그래서 캔버스 높이로 배치하면 건물이 지면선에서 40px쯤 떠 보인다.
 * 캔버스가 아니라 **콘텐츠 기준**으로 배율·위치를 잡는다.
 */
const NEAR_ART = {
  /** 원본 캔버스 세로 */
  canvasH: 1024,
  /** 불투명(건물) 영역의 위/아래 행 — 실측값 */
  contentTop: 386,
  contentBottom: 712,
  /** 화면에 보일 건물 높이(px). 키우면 건물이 커지고 가로 반복 주기도 함께 늘어난다. */
  screenH: 150,
  /** 건물 밑동을 지면선보다 이만큼 아래로 내려 잔디에 묻는다 — 잘린 단면이 보이지 않게 */
  sink: 10,
  /** 폐허 건물 반복을 성 모형(왼쪽 castle_outside)에서 이만큼 오른쪽으로 띄워 시작한다(월드 px).
   *  이 값보다 왼쪽(0~startX)은 폐허 건물이 안 깔려, 성 모형과 겹치지 않는 빈 간격이 생긴다.
   *  키우면 성 모형과 더 멀어지고, 줄이면 가까워진다. (near 레이어는 scrollFactor 0.55라
   *  성 모형과 1:1로 붙지 않고 시차가 있으니, 눈으로 보며 맞추는 값이다.) */
  startX: 480,
} as const

/**
 * 성 밖 마른 연못(bg_dried_up_pond.jpg, 2172×724) 배치.
 *
 * 이 아트는 위가 지면 → 바위 둑 → 마른 바닥(floorTop~724) 구조다. 성 밖에서 지면과 둑은
 * 보행로(bg_walkway_03)가 이미 그리므로 **floorTop 아래(마른 바닥)만 잘라 써서** 길 아랫변에
 * 이어 붙인다. 위쪽까지 같이 그리면 길과 둑이 이중으로 겹친다 — 예전엔 밴드를 worldHeight
 * 기준으로 잡아 길보다 위에서 시작하는 바람에 길이 통째로 가려졌다.
 *
 * 감숙성 내부(river)는 이 경로를 타지 않는다 — 아래 else 분기에서 종전대로 그린다.
 */
const POND = {
  /** 원본 대비 배율. 소품(짐승 뼈·바위) 크기와 가로 반복 주기를 함께 정한다
   *  — 0.188이면 주기 2172×0.188 ≈ 408px(worldWidth 3200 기준 약 8번)로 타일 티가 가장 덜 난다.
   *  **가로/세로를 같은 값으로 써야** 비율이 유지된다(가로만 줄이면 세로로 늘어난다). */
  scale: 0.188,
  /** 원본에서 마른 바닥이 시작하는 행 — 이 위(지면·둑)는 길이 대신하므로 잘라낸다.
   *  남는 원본은 724-70=654행 = 화면 654×0.188 ≈ 123px. 밴드가 그보다 높아지면 세로로
   *  반복되어 바닥 한가운데 둑이 다시 나타난다. */
  floorTop: 70,
  /** 연못을 길 아랫변보다 이만큼 위로 끌어올려 겹친다(px). 보행로 아트 밑동이 반투명하거나
   *  살짝 떠서 길과 연못 사이에 뒤 배경(밝은 하늘 등)이 비쳐 보일 때, 그 이음새를 연못으로 덮는다.
   *  연못이 길보다 앞(depth)이라 겹쳐도 자연스럽다. 0이면 딱 맞닿고, 키울수록 연못이 위로 올라온다. */
  rise: 15,
} as const

/** 보행로 밴드 렌더 높이(px). tileScale이 가로·세로 공용이라 이 값이 가로 반복 주기도 정한다
 *  — 84면 bg_walkway_03(2172×369) 기준 주기 2172×84/369 ≈ 494px. 줄이면 반복 티가 늘어난다.
 *  키우면 길이 두꺼워지는 만큼 그 아래 연못 몫이 줄어든다(월드 바닥 worldHeight는 고정). */
const WALKWAY_H = 55

/**
 * 발판(platforms) 종류별 아트 배치값. **발판을 손보려면 여기와 맵 JSON만 보면 된다.**
 *
 * - 맵 JSON(platforms[])의 x, y, width  → 발판의 **위치와 가로 길이**. y가 곧 밟는 선(충돌면).
 * - 여기 screenH                        → 발판 **그림 두께**. 판정(y)은 그대로 두고 그림만 두꺼워진다.
 * - 여기 overhang                       → 판정 폭보다 그림을 좌우로 넓히는 양.
 *
 * surfaceRow는 "원본 그림에서 밟는 면이 몇 번째 행에 그려져 있나"를 실측한 값이다. 이것만 맞으면
 * screenH를 아무리 바꿔도 캐릭터 발이 상판에 딱 붙는다 — 예전처럼 오프셋(-7)을 손으로 다시
 * 맞출 필요가 없다. 아트를 교체할 때만 srcH/surfaceRow를 다시 재면 된다.
 */
const PLATFORM_ART = {
  /** 성 밖 — 돌 발판 (아래로 초롱/뿌리가 늘어진 아트) */
  stone: {
    key: 'img_platform_stone_02',
    /** 원본 캔버스 세로 */
    srcH: 368,
    /** 원본에서 밟는 면(상판 윗면)이 그려진 행 — 실측값 */
    surfaceRow: 40,
    /** 화면에 그릴 높이(px) — 늘리면 발판이 두꺼워지고 늘어진 장식도 함께 길어진다 */
    screenH: 62,
    /** 좌우로 이만큼씩 넓게 그린다(px) — 그림이 판정보다 살짝 넓어야 끝이 잘려 보이지 않는다 */
    overhang: 14,
  },
  /** 감숙성 내부 — 나무 발판 (우측에 붉은 깃발) */
  wood: {
    key: 'img_platform_wood',
    srcH: 336,
    surfaceRow: 68,
    screenH: 72,
    overhang: 14,
  },
} as const

/** 포탈 상호작용 반경 (px) */
const PORTAL_RANGE = 44

/**
 * 보행로 텍스처별 발디딤 면(캐릭터가 서는 지면선) 보정치(px, 월드 좌표, 아래로 +).
 * 원본마다 캔버스 높이도, "밟는 면"이 그려진 픽셀 행도 달라 groundY에 원점을 그냥 맞추면
 * 화면상 지면선이 어긋난다. FOOT_SINK(캐릭터 발 깊이, config.ts)와는 무관 — 여기서만 보정한다.
 *
 * 값 구하는 법: 화면 y = walkwayY + (밟는 면 행 × wwH / 캔버스 높이) 이므로
 *   보정치 = -(밟는 면 행 × wwH / 캔버스 높이)   ← 이러면 밟는 면이 정확히 groundY에 온다.
 *   - inside  = bg_walkway_01 (1536×325)
 *   - outside = bg_walkway_03 (2172×369): 밝은 길 표면이 y24~72행, 중심 48행.
 *               48 × 84 / 369 ≈ 10.9 → -11 (발이 길 폭 한가운데를 밟는다)
 */
const WALKWAY_SURFACE_ADJUST: Record<string, number> = {
  img_walkway_inside: -30,
  img_walkway_outside: -3,
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

// 감숙성 내부 산 능선 depth. 하늘(BG_FAR=-100)보다 살짝 앞에 둬서 느린 구름(-98)이 산 뒤·하늘 앞,
// 빠른 구름(-90)이 산 앞에 오도록 셋 사이에 간격을 준다 (셋 다 -100이면 낄 틈이 없다).
const MOUNTAIN_DEPTH = -96
const CLOUD_DEPTH_BEHIND = -98 // 느린 구름 — 산 뒤
const CLOUD_DEPTH_FRONT = -90 // 빠른 구름 — 산 앞
// 산·구름의 패럴랙스 계수(공유). 구름을 산과 같은 값으로 묶어 카메라 이동 시 산과 함께 거의
// 정지한 듯 움직이게 한다 (구름만 크면 걸을 때 산보다 빨리 미끄러져 "빠르다"고 느껴진다).
const MOUNTAIN_SCROLL = 0.08

/**
 * 감숙성 중경: 언덕+숲 (bg_hill.png, 1983×300, 좌우로 무한 반복).
 * 먼 산(MOUNTAIN)보다 앞(depth BG_MID), 근경 성벽(bg_inside_wall, BG_NEAR)보다 뒤에 깔린다.
 * **여기 두 값만 만지면 조절된다:**
 *   HEIGHT : 화면상 띠 높이(px) = 크기. tileScaleFor가 HEIGHT/원본높이(300)로 균일 배율을 잡으므로,
 *            300이면 원본 배율, 키우면 언덕·숲이 통째로 커진다(가로도 같이 커져 반복 간격이 넓어짐).
 *   TOP_Y  : 띠 윗변의 월드 Y(작을수록 위로). 산 아래 하늘 여백을 덮도록 위치를 잡는다.
 * SCROLL은 시차(산 0.08 < 이 값 < 성벽 0.7). 보통 손댈 필요 없다.
 */
const HILL = { SCROLL: 0.15, HEIGHT: 200, TOP_Y: 250 } as const

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
  /** 하늘에 떠서 가로로 흘러가는 구름들 — update()에서 x를 밀고 band 밖으로 나가면 반대쪽에서 재진입 */
  private clouds: { img: Phaser.GameObjects.Image; speed: number; halfW: number }[] = []
  /** 구름이 화면에 잡힐 수 있는 월드 X 우측 한계 (스크롤계수·뷰포트로 산출, 순환 기준) */
  private cloudBandRight = 0
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
    // scene.restart로 재진입해도 이전 구름 참조가 남지 않도록 초기화 (필드 초기값은 생성자에서 한 번만 실행됨)
    this.clouds = []
    this.cloudBandRight = 0
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
    const addLayer = (key: string, scroll: number, depth: number, heightPx: number, topY: number, startX = 0) => {
      if (!this.art(key)) return undefined
      const yScroll = scroll < 0.2 ? scroll : 1 // 먼 배경만 세로 시차, 지면 기준 레이어는 세로 고정
      // startX>0이면 그 왼쪽엔 타일을 깔지 않아 빈 간격이 생긴다 (성 밖 폐허 건물을 성 모형에서 띄우는 용도).
      const layer = this.add
        .tileSprite(startX, topY, cover(scroll), heightPx, key)
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

    /**
     * addLayer(tileSprite)와 달리 낱개 Image를 overlap(px)만큼 **겹쳐** 나란히 깐다.
     * tileSprite는 텍스처를 연속 REPEAT하므로 타일 경계를 정확히 맞대는데, 원본 좌우 끝이
     * 완전히 안 맞거나 반올림 오차가 있으면 반복 경계에 얇은 세로 이음매가 보인다. 낱개로 깔고
     * 다음 타일을 overlap만큼 왼쪽으로 당겨 이전 타일의 오른쪽 끝을 덮으면 그 이음매가 사라진다.
     * count는 cover(scroll) 폭을 채우도록 자동 계산 (산처럼 스크롤계수가 낮아 여유분이 적을 때만 쓴다).
     */
    const addTiledLayer = (
      key: string, scroll: number, depth: number, heightPx: number, topY: number, overlap: number,
    ) => {
      if (!this.art(key)) return
      const yScroll = scroll < 0.2 ? scroll : 1
      const sc = this.tileScaleFor(key, heightPx)
      const tileW = Math.round((this.textures.get(key).getSourceImage() as HTMLImageElement).width * sc)
      const step = tileW - overlap // 다음 타일을 이만큼만 전진 → overlap px 겹침
      const count = Math.ceil(cover(scroll) / step) + 1
      for (let i = 0; i < count; i++) {
        this.add
          .image(i * step, topY, key)
          .setOrigin(0, 0)
          .setScrollFactor(scroll, yScroll)
          .setDepth(depth)
          .setDisplaySize(tileW, heightPx)
      }
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST)
    }

    if (map.theme === 'castle_interior') {
      this.cameras.main.setBackgroundColor(0x88badb)
      // far: 하늘 + 먼 원경 (아주 느림)
      addLayer(this.art('bg_castle_interior') ? 'bg_castle_interior' : 'ph_bg_far', 0.1, DEPTH.BG_FAR, map.worldHeight, 0)
      // 제일 먼 배경: 성벽 위로 아스라이 보이는 산 능선 (반복, 아주 느린 시차 — 하늘보다도 느리진 않되 성벽/건물보다 훨씬 느리게)
      // topY=0 → 화면 맨 꼭대기에 밀착 (스크롤계수가 낮아 카메라가 움직여도 거의 고정으로 보인다)
      // depth를 하늘(-100)보다 살짝 앞(-96)으로 올려, 느린 구름(-98)이 산 뒤·하늘 앞에 낄 틈을 만든다.
      if (this.art('bg_mountain')) {
        // tileSprite 대신 낱개 이미지를 1px 겹쳐 깔아 반복 이음매를 없앤다
        addTiledLayer('bg_mountain', MOUNTAIN_SCROLL, MOUNTAIN_DEPTH, 140, 150, 1)
      }
      // 하늘에 흘러가는 구름 (감숙성 내부) — 개별 이미지 배치 후 update()에서 가로로 흘린다.
      // 느린 큰 구름은 산 뒤, 조금 빠른 작은 구름은 산 앞에 배치 (spawnClouds 내부 depth 지정).
      this.spawnClouds(map.worldWidth, viewW)
      // mid: 멀리 보이는 성벽/망루 (반복) — 실제 아트(img_castle_mid)가 있을 때만.
      // placeholder(ph_bg_mid)는 near 성벽과 겹쳐 "성벽이 둘"로 보여서 castle_interior에선 생략.
      if (this.art('img_castle_mid')) {
        addLayer('img_castle_mid', 0.35, DEPTH.BG_MID, 250, map.groundY - 280)
      }
      // mid: 산과 성벽 사이 중경 언덕+숲 (좌우 무한 반복). 산(BG_FAR/MOUNTAIN_DEPTH)보다 앞,
      // 성벽(BG_NEAR)보다 뒤라 성벽이 아랫부분을 가리고 산 아래 하늘 여백을 덮는다.
      // 크기/높이 조절은 위의 HILL 상수에서. addLayer=tileSprite라 가로로 이어 반복된다.
      if (this.art('bg_hill')) {
        addLayer('bg_hill', HILL.SCROLL, DEPTH.BG_MID, HILL.HEIGHT, HILL.TOP_Y)
      }
      // near: 안뜰을 두른 성벽 — bg_inside_wall 5칸 반복, 4번째 칸만 bg_inside_wall_gate.
      // CASTLE_WALL_H를 건물보다 크게 잡아 성벽 상단이 건물 지붕 위로 드러나 보이게 한다.
      const wallH = CASTLE_WALL_H
      if (this.art('img_castle_wall')) {
        addTiledWall('img_castle_wall', 'img_castle_wall_gate', 0.7, DEPTH.BG_NEAR, wallH + 30, map.groundY - wallH - 43, 5, 3)
      } else {
        addLayer('ph_wall', 0.7, DEPTH.BG_NEAR, wallH + 25, map.groundY - wallH - 33)
      }
    } else {
      // 야외(성 밖): 하늘 → 먼 산 → 언덕/성곽
      addLayer(this.art('bg_sky') ? 'bg_sky' : 'ph_bg_far', 0.1, DEPTH.BG_FAR, map.worldHeight, 0)
      // 감숙성 내부와 동일한 원경 산 능선을 성 밖에도 적용 (⑤⑥ 톤 일관성)
      if (this.art('bg_mountain')) {
        addTiledLayer('bg_mountain', 0.08, DEPTH.BG_FAR, 300, 80, 1)
      }
      // 예전엔 중경에 'bg_mountains'(도형 placeholder — PreloadScene에 삼각형 산으로 무조건 생성됨)를
      // 폴백으로 썼는데, 그 키로 실제 아트가 로드되는 일이 없어 항상 삼각형이 보였다. 실제 아트가
      // 생기기 전까진 이 레이어를 아예 생략 — 삼각형 placeholder보다 없는 게 낫다.
      const nearKey = this.art('bg_broken_buildings')
        ? 'bg_broken_buildings'
        : this.art('bg_hills')
          ? 'bg_hills'
          : 'ph_wall'
      if (nearKey === 'bg_broken_buildings') {
        // 투명 여백을 뺀 **건물 실물 높이**를 기준으로 배율을 잡고, 밑동을 지면선(잔디)에 붙인다.
        // addLayer의 tileScale = 레이어높이/원본높이 이므로 캔버스 높이를 역산해서 넘긴다.
        const s = NEAR_ART.screenH / (NEAR_ART.contentBottom - NEAR_ART.contentTop)
        const layerH = NEAR_ART.canvasH * s
        const topY = map.groundY + NEAR_ART.sink - NEAR_ART.contentBottom * s
        // NEAR_ART.startX만큼 오른쪽에서 반복 시작 → 왼쪽 성 모형(castle_outside)과 간격을 둔다.
        addLayer(nearKey, 0.55, DEPTH.BG_NEAR, layerH, topY, NEAR_ART.startX)
      } else {
        addLayer(nearKey, 0.55, DEPTH.BG_NEAR, 220, map.groundY - 200)
      }
    }

    // ---- 지형 ----
    const solids = this.physics.add.staticGroup()
    const oneWays = this.physics.add.staticGroup()

    // 보행로(바닥): 지면선 아래 1줄만 물리 충돌. 그 아래는 장식 밴드 (GAME_DESIGN 10.1)
    // 감숙성 내부는 walkway_01(석재), 성 밖은 walkway_03(석벽 위 흙길)으로 별도 텍스처를 쓴다.
    const walkwayKey = map.theme === 'castle_interior' ? 'img_walkway_inside' : 'img_walkway_outside'
    const walkwayArt = this.art(walkwayKey)
    const walkwayY = map.groundY + (WALKWAY_SURFACE_ADJUST[walkwayKey] ?? 0)
    /** 길 아랫변 — 성 밖 연못이 여기에 붙는다. 아트가 없으면(placeholder 폴백) 붙일 데가 없다. */
    const walkwayBottom = walkwayArt ? walkwayY + WALKWAY_H : null
    for (let x = 0; x < map.worldWidth; x += 32) {
      const t = solids.create(x + 16, map.groundY + 16, 'tile_ground') as Phaser.Physics.Arcade.Sprite
      t.setDepth(DEPTH.GROUND)
      if (walkwayArt) t.setVisible(false) // 충돌만 담당, 시각은 이미지로
    }
    // 바닥 아래 장식 밴드 — 캐릭터가 화면 bottom에 직접 닿지 않는다 (성 내부는 석재 안뜰)
    const underH = map.underFloorHeight ?? 96
    const underStyle = map.underFloorStyle ?? 'water'
    const underArtKey = UNDER_FLOOR_TEXTURES[underStyle]
    const underFallback = underStyle === 'stone' ? 'tile_underfloor_stone' : 'tile_underfloor'
    // 바닥 아래 장식(연못/안뜰)은 돌바닥보다 위 depth — 돌바닥 하단 가림 없이 앞에 보인다 (⑦)
    if (this.art(underArtKey)) {
      const wh = underH + 40
      const bandY = map.worldHeight - wh
      const baseScale = this.tileScaleFor(underArtKey, wh) // 밴드를 꽉 채우는 배율
      if (underStyle === 'water') {
        // 성 밖: 길 아랫변부터 월드 바닥까지를 마른 연못이 잇는다. tilePositionY로 원본 위쪽
        // (지면·둑)을 잘라내 floorTop 행부터 그리므로, 길이 그린 둑과 겹치지 않는다.
        // POND.rise만큼 위로 끌어올려 길-연못 이음새(뒤 배경이 비치는 틈)를 덮는다.
        const pondY = (walkwayBottom ?? bandY) - POND.rise
        const pond = this.add
          .tileSprite(0, pondY, map.worldWidth, map.worldHeight - pondY, underArtKey)
          .setOrigin(0, 0)
          .setDepth(DEPTH.FOREGROUND) // 길 위 — 길 하단이 연못에 자연스럽게 묻힌다
        pond.setTileScale(POND.scale, POND.scale)
        pond.tilePositionY = POND.floorTop // 텍스처 좌표(배율 적용 전) 기준
      } else {
        this.add.tileSprite(0, bandY, map.worldWidth, wh, underArtKey).setOrigin(0, 0)
          .setTileScale(baseScale, baseScale)
          .setDepth(DEPTH.FOREGROUND)
      }
      // 물결 애니메이션 오버레이 — 연못 전체가 아니라 물이 실제로 움직이는 "일부 구간"에만 얹는다.
      // 정지 이미지 bg_river.png(원본 926px) 안에서 움직이는 물은 위에서 RIVER_ANIM_SRC_TOP(470px)
      // 지점부터 RIVER_ANIM_SRC_H(220px) 높이 구간이다. 연못은 화면에서 wh 높이로 축소돼 그려지므로
      // (스케일 = wh/926), 오버레이도 같은 스케일로 그 부분 구간에만 맞춰 위치·크기를 잡는다.
      // (예전엔 연못과 1:1 크기라 가정해 밴드 전체를 덮어 물이 지나치게 크게 나왔다.)
      if (underStyle === 'river' && this.art('bg_river_anim')) {
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
      const walkway = this.add.tileSprite(0, walkwayY, map.worldWidth, WALKWAY_H, walkwayKey).setOrigin(0, 0)
      walkway.setTileScale(this.tileScaleFor(walkwayKey, WALKWAY_H))
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
      const art = PLATFORM_ART[p.kind ?? 'stone']
      const hasArt = this.art(art.key)
      for (let x = 0; x < p.width; x += 32) {
        const tile = oneWays.create(p.x + x + 16, p.y + 8, 'tile_platform') as Phaser.Physics.Arcade.Sprite
        const body = tile.body as Phaser.Physics.Arcade.StaticBody
        body.checkCollision.down = false
        body.checkCollision.left = false
        body.checkCollision.right = false
        if (hasArt) tile.setVisible(false)
      }
      if (hasArt) {
        // 원본의 밟는 면(surfaceRow)이 충돌선(p.y)에 오도록 그림 상단을 그만큼 끌어올린다
        const scale = art.screenH / art.srcH
        this.add
          .image(p.x + p.width / 2, p.y - art.surfaceRow * scale, art.key)
          .setDisplaySize(p.width + art.overhang * 2, art.screenH)
          .setOrigin(0.5, 0)
          .setDepth(DEPTH.GROUND)
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
    this.player.onBasicAttack = (hitbox, facing, comboStep) => {
      // 기본 공격 3연 콤보 — 0:찌르기 / 1:휘두르기 / 2:깊게 찌르기. 단계마다 이펙트만 다르고
      // 판정 로직은 공통이다. 판정을 **먼저** 돌려 명중 여부를 알아낸 뒤 이펙트를 고른다 — 둘 다
      // 같은 틱(ATTACK_HIT_AT_MS)이라 "빗나감 → 명중" 전환 없이 바로 맞는 아트를 쓸 수 있다.
      const reach = comboStep === 2 ? COMBAT.COMBO_DASH_REACH : COMBAT.ATTACK_REACH
      const hits = this.resolveAttack(hitbox, COMBAT.ATTACK_MAX_TARGETS, false)
      // 타격 지점: 명중이면 가장 가까운 적(리치 안으로 클램프), 빗나가면 리치 끝.
      // y 오프셋 주의: 캐릭터는 128 프레임 하단 정렬이라 창끝이 sprite 중심(player.y)보다 아래다.
      // 창끝은 프레임 y≈95.5 = 중심 대비 +31.5px → VISUAL_SCALE(0.7) 적용 시 월드 +22px.
      const dist = hits.length > 0
        ? Phaser.Math.Clamp((hits[0].x - this.player.x) * facing, 50, reach)
        : reach
      const fxX = this.player.x + facing * dist
      const fxY = this.player.y + 22
      const hit = hits.length > 0
      // 전용 아트(fx_swing / fx_dash_thrust)가 없으면 EffectManager가 찌르기 이펙트로 폴백한다.
      if (comboStep === 1) this.effects.swingArc(fxX, fxY, facing, hit)
      else if (comboStep === 2) {
        // 깊게 찌르기: 무기 궤적(dashThrust) + 돌진하는 몸에 붙는 이동 잔상(dashTrail)
        this.effects.dashThrust(fxX, fxY, facing, hit)
        this.effects.dashTrail(this.player.x, this.player.y, facing)
      } else this.effects.attack(fxX, fxY, facing, hit)
    }
    // 공중 액션 이펙트 (점프 대쉬 잔상 / 이단 점프 하강풍)
    this.player.onAirDash = (x, y, facing) => this.effects.dashTrail(x, y, facing)
    this.player.onDoubleJump = (x, y) => this.effects.doubleJumpBurst(x, y + 24)
    this.player.onSkill = (hitbox, facing) => {
      // 시전 가능한 스킬이 참마돌격 하나뿐이라 분기 없이 바로 호출한다 (skillStore의 5종은
      // 스킬트리 UI 데이터일 뿐 아직 시전 경로가 없음). 스킬별 분기가 생기면 여기서 갈라야 한다.
      // 좌표는 타격 지점 — 기본 공격과 같은 규약(창끝 높이 = player.y + 22, 리치 끝).
      this.effects.skillCharge(this.player.x + facing * COMBAT.SKILL_REACH, this.player.y + 22, facing)
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
  /** 히트박스에 걸린 몬스터에 데미지를 적용하고, **실제로 맞은 대상**을 거리순으로 반환한다 */
  private resolveAttack(hitbox: Phaser.Geom.Rectangle, maxTargets: number, isSkill: boolean): Monster[] {
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
    return candidates
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

  /**
   * 하늘에 구름 6개를 띄운다 (실제 이동은 update()). 낱개 구름 이미지(bg_cloud_01~03)를 크기·속도·
   * 높이를 달리해 재사용한다 — tileSprite 반복 대신 개별 Image라 특정 구름만 다르게 움직일 수 있다.
   * scrollFactor를 하늘 수준(0.15)으로 낮춰 먼 하늘에 떠 있는 느낌을 준다.
   *
   * 산(bg_mountain)은 worldY 80(꼭대기)부터 아래로 불투명하게 깔린다. 구름이 산과 겹치지 않도록
   * **모든 구름을 산 꼭대기 위 하늘**에 둔다 — 각 구름의 아랫변(y + 표시높이/2)이 80을 넘지 않게 y를 잡음.
   * 산·구름이 같은 scrollFactor(MOUNTAIN_SCROLL)라 이 월드 좌표 비교가 화면에서도 그대로 성립한다.
   * (표시높이 = w × 원본세로/원본가로. cloud_01·02 ≈ w×0.39, cloud_03 ≈ w×0.35)
   * speed(px/초)는 자체 드리프트 — 아주 작게 잡아 "거의 멈춘 듯" 서서히 흐르게 한다.
   */
  private spawnClouds(worldWidth: number, viewW: number) {
    // 패럴랙스는 산과 동일(MOUNTAIN_SCROLL) — 걸을 때 산과 함께 거의 정지한 듯 움직인다.
    const scroll = MOUNTAIN_SCROLL
    // 이 스크롤계수에서 구름이 화면에 잡힐 수 있는 월드 X 범위는 [0, bandRight] — 순환(wrap) 기준.
    this.cloudBandRight = scroll * (worldWidth - viewW) + viewW
    // x·y = 시작 위치. x는 대략 0~viewW(≈731) 안이면 스폰 즉시 화면에 보인다(그보다 크면 오른쪽
    // 밖에서 시작). y는 아랫변(y + 표시높이/2)이 산 꼭대기(80)를 넘지 않게 잡음(주석 ≈값=아랫변).
    // w=폭px, speed=자체 드리프트(px/초), depth=산 앞(FRONT)/뒤(BEHIND).
    const specs = [
      { key: 'bg_cloud_01', x: 61, y: 118, w: 80, speed: 0.15, depth: CLOUD_DEPTH_FRONT }, //  아랫변 ≈74
      { key: 'bg_cloud_03', x: 183, y: 116, w: 33, speed: 0.05, depth: CLOUD_DEPTH_BEHIND }, // 아랫변 ≈72
      { key: 'bg_cloud_02', x: 304, y: 120, w: 70, speed: 0.06, depth: CLOUD_DEPTH_FRONT }, //  아랫변 ≈74
      { key: 'bg_cloud_01', x: 426, y: 112, w: 63, speed: 0.07, depth: CLOUD_DEPTH_BEHIND }, // 아랫변 ≈74
      { key: 'bg_cloud_03', x: 548, y: 114, w: 47, speed: 0.08, depth: CLOUD_DEPTH_FRONT }, //  아랫변 ≈72
      { key: 'bg_cloud_02', x: 670, y: 123, w: 55, speed: 0.03, depth: CLOUD_DEPTH_BEHIND }, // 아랫변 ≈74
    ]
    specs.forEach((s) => {
      if (!this.art(s.key)) return
      const src = this.textures.get(s.key).getSourceImage() as HTMLImageElement
      const dispH = s.w * (src.height / src.width)
      const img = this.add
        .image(s.x, s.y, s.key)
        .setOrigin(0.5)
        .setDisplaySize(s.w, dispH)
        .setScrollFactor(scroll, scroll)
        .setDepth(s.depth)
        .setAlpha(0.9)
      this.clouds.push({ img, speed: s.speed, halfW: s.w / 2 })
    })
  }

  update(_time: number, delta: number) {
    this.input_.update(this.time.now)
    this.player.update(this.input_, this.time.now)

    // 하늘 구름 흘리기 — band 우측 끝을 완전히 벗어나면 왼쪽 밖으로 되돌려 반대쪽에서 재진입(심리스 순환)
    if (this.clouds.length > 0) {
      const dt = delta / 1000
      for (let i = 0; i < this.clouds.length; i++) {
        const c = this.clouds[i]
        c.img.x += c.speed * dt
        if (c.img.x - c.halfW > this.cloudBandRight) c.img.x = -c.halfW
      }
    }

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
