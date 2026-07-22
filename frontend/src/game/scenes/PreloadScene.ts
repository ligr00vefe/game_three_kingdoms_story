import Phaser from 'phaser'

/**
 * 에셋 로딩 전담 씬. manifest 기반 로딩 + 진행바 (DEVELOPMENT_PLAN 문제 2).
 * Phase 1: 맵 JSON + manifest 등록 에셋 로드. 이미지 에셋이 아직 없어
 * placeholder 텍스처는 create()에서 도형으로 생성한다 (ASSET_SPEC 5장).
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload')
  }

  preload() {
    const { width, height } = this.scale
    const barWidth = Math.min(320, width * 0.6)

    const barBg = this.add.rectangle(width / 2, height / 2, barWidth, 14, 0x333333)
    const bar = this.add
      .rectangle(barBg.x - barWidth / 2, height / 2, 1, 10, 0x4caf50)
      .setOrigin(0, 0.5)

    this.load.on('progress', (value: number) => {
      bar.width = Math.max(1, barWidth * value)
    })
    // manifest에 등록됐지만 아직 없는 아트 파일은 무시 — placeholder 폴백 (Phase 7)
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.warn(`[assets] 아직 없는 에셋: ${file.key} — placeholder 사용`)
    })

    // 맵 데이터 (데이터 주도 — 스테이지 추가는 JSON 추가만으로)
    this.load.json('map_stage1', 'assets/maps/stage1_grassland.json')
    this.load.json('map_ye_castle', 'assets/maps/ye_castle.json')
    this.load.json('map_defense', 'assets/maps/defense_arena.json')
    // 몬스터 정의 (데이터 주도 — GAME_DESIGN 6장)
    this.load.json('monster_defs', 'assets/data/monsters.json')
    this.load.json('npc_defs', 'assets/data/npcs.json')
    // manifest 등록 에셋 일괄 로드 (아직 비어 있음 — 이미지 도입 시 여기만 통과하면 됨)
    this.load.json('asset_manifest', 'assets/manifest.json')
  }

  create() {
    Promise.all([this.loadManifestAssets(), this.loadFonts()]).then(() => {
      this.generatePlaceholders()
      this.scene.start('Game')
    })
  }

  /**
   * 웹폰트 선로딩. Phaser Text는 **생성 시점에 캔버스로 구워지므로**, 폰트가 준비되기 전에
   * 만든 텍스트는 폴백 글꼴 그대로 굳는다(다시 setText 하기 전까지 안 고쳐짐).
   * 숫자만 서브셋한 폰트라 로드 트리거 문자열도 숫자여야 한다.
   * 폰트를 못 받아도 게임은 폴백 글꼴로 계속 진행한다 — 로딩을 막지 않는다.
   */
  private loadFonts(): Promise<void> {
    if (!document.fonts?.load) return Promise.resolve()
    return document.fonts
      .load('800 18px Baloo2Digits', '0123456789')
      .then(() => undefined)
      .catch(() => {
        console.warn('[fonts] Baloo2Digits 로드 실패 — 기본 글꼴로 진행')
      })
  }

  /** manifest.json에 등록된 이미지/스프라이트시트 로드 (2차 로드) */
  private loadManifestAssets(): Promise<void> {
    const manifest = this.cache.json.get('asset_manifest') as {
      images?: Record<string, string>
      spritesheets?: Record<string, { url: string; frameWidth: number; frameHeight: number }>
    }
    let queued = false
    for (const [key, url] of Object.entries(manifest?.images ?? {})) {
      this.load.image(key, url)
      queued = true
    }
    for (const [key, def] of Object.entries(manifest?.spritesheets ?? {})) {
      this.load.spritesheet(key, def.url, { frameWidth: def.frameWidth, frameHeight: def.frameHeight })
      queued = true
    }
    if (!queued) return Promise.resolve()
    return new Promise((resolve) => {
      this.load.once(Phaser.Loader.Events.COMPLETE, () => resolve())
      this.load.start()
    })
  }

  /** 도형 placeholder 텍스처 생성 — 실제 아트는 Phase 7에서 같은 키로 교체 */
  private generatePlaceholders() {
    const g = this.add.graphics()

    // 관우: 64x64 프레임, 녹색 전포 + 붉은 얼굴 (GAME_DESIGN 2장)
    g.clear()
    g.fillStyle(0x2e7d32) // 녹색 전포
    g.fillRect(14, 22, 36, 42)
    g.fillStyle(0xc62828) // 붉은 얼굴
    g.fillRect(20, 6, 24, 20)
    g.fillStyle(0x1b1b1b) // 수염
    g.fillRect(24, 20, 16, 8)
    g.fillStyle(0xffffff) // 눈 (방향 표시)
    g.fillRect(38, 12, 4, 4)
    g.generateTexture('guanwu_idle', 64, 64)

    // 지형 타일 (32px 규격)
    g.clear(); g.fillStyle(0x4a8f3c); g.fillRect(0, 0, 32, 32)
    g.fillStyle(0x6db85a); g.fillRect(0, 0, 32, 6)
    g.generateTexture('tile_ground', 32, 32)

    g.clear(); g.fillStyle(0x8d6e63); g.fillRect(0, 0, 32, 16)
    g.fillStyle(0xa1887f); g.fillRect(0, 0, 32, 4)
    g.generateTexture('tile_platform', 32, 16)

    // 수면 장식 밴드 (underFloor — 이동 불가, GAME_DESIGN 10.1)
    g.clear()
    g.fillStyle(0x2e7d6e); g.fillRect(0, 0, 64, 96)
    g.fillStyle(0x7fc8b0); g.fillRect(0, 0, 64, 6)
    g.fillStyle(0xec407a); g.fillCircle(16, 30, 5); g.fillCircle(48, 60, 6)
    g.fillStyle(0x66bb6a); g.fillEllipse(34, 44, 18, 6)
    g.generateTexture('tile_underfloor', 64, 96)

    // 계단 1단 (32x16, GAME_DESIGN 10.2)
    g.clear()
    g.fillStyle(0x8d8fa0); g.fillRect(0, 0, 32, 16)
    g.fillStyle(0xa6a8b8); g.fillRect(0, 0, 32, 4)
    g.generateTexture('tile_step', 32, 16)

    // 줄(rope) — 사다리와 조작 동일, 시각만 다름
    g.clear()
    g.fillStyle(0x6d4c41); g.fillRect(13, 0, 6, 32)
    g.fillStyle(0x8bc34a); g.fillCircle(11, 8, 3); g.fillCircle(21, 22, 3)
    g.generateTexture('tile_rope', 32, 32)

    g.clear(); g.fillStyle(0x795548); g.fillRect(6, 0, 4, 32); g.fillRect(22, 0, 4, 32)
    for (let y = 4; y < 32; y += 10) { g.fillRect(6, y, 20, 3) }
    g.generateTexture('tile_ladder', 32, 32)

    g.clear(); g.fillStyle(0x757575); g.fillRoundedRect(0, 8, 72, 44, 10)
    g.generateTexture('obstacle_rock', 72, 52)

    g.clear(); g.fillStyle(0x8d6e63); g.fillRect(0, 16, 96, 32)
    g.fillStyle(0x5d4037); g.fillCircle(24, 52, 8); g.fillCircle(72, 52, 8)
    g.generateTexture('obstacle_cart', 96, 60)

    g.clear(); g.fillStyle(0x66bb6a)
    g.fillEllipse(100, 120, 320, 160)
    g.fillEllipse(360, 130, 380, 180)
    g.generateTexture('bg_hills', 512, 140)

    // 황건당 좀비: 64x64, 회녹색 몸 + 누런 두건 (GAME_DESIGN 6.2)
    // manifest에 실제 아트가 오면 같은 키로 로드되므로 exists 가드 — 없으면 도형이 아트를 덮어쓴다.
    if (!this.textures.exists('zombie_yellow_idle')) {
      g.clear()
      g.fillStyle(0x7a8a6d)
      g.fillRect(14, 18, 36, 46)
      g.fillStyle(0x8a9b7c)
      g.fillRect(20, 4, 24, 22)
      g.fillStyle(0xf9a825) // 누런 두건
      g.fillRect(18, 2, 28, 8)
      g.fillStyle(0xb71c1c)
      g.fillRect(26, 14, 4, 4); g.fillRect(36, 14, 4, 4)
      g.generateTexture('zombie_yellow_idle', 64, 64)
    }

    // ---- 감숙성 내부(안전지대) placeholder — manifest에 실제 아트가 오면 같은 키로 대체되므로 exists 가드 ----
    if (!this.textures.exists('npc_castle_lord')) {
      // 성주: 자주색 관복 + 관모의 문관
      g.clear()
      g.fillStyle(0x6d5a86); g.fillRect(14, 22, 36, 42)   // 관복
      g.fillStyle(0xe8b64c); g.fillRect(14, 40, 36, 4)    // 금띠
      g.fillStyle(0xf3d5b5); g.fillRect(22, 8, 20, 16)    // 얼굴
      g.fillStyle(0x1b1b1b); g.fillRect(26, 20, 12, 5)    // 수염
      g.fillStyle(0x37474f); g.fillRect(18, 2, 28, 8)     // 관모
      g.fillRect(30, 0, 4, 4)
      g.generateTexture('npc_castle_lord', 64, 64)
    }
    if (!this.textures.exists('npc_gatekeeper')) {
      // 문지기: 병사 갑주 + 장창
      g.clear()
      g.fillStyle(0x8d8fa0); g.fillRect(16, 24, 32, 40)   // 갑옷
      g.fillStyle(0xc14b3a); g.fillRect(16, 24, 32, 6)    // 붉은 어깨띠
      g.fillStyle(0xf3d5b5); g.fillRect(23, 10, 18, 14)   // 얼굴
      g.fillStyle(0x546e7a); g.fillRect(21, 4, 22, 8)     // 투구
      g.fillStyle(0x4e342e); g.fillRect(50, 4, 4, 58)     // 창대
      g.fillStyle(0xcfd8dc); g.fillTriangle(48, 4, 56, 4, 52, -6) // 창날
      g.generateTexture('npc_gatekeeper', 64, 64)
    }
    if (!this.textures.exists('ph_wall')) {
      // 성벽 배경 밴드 (가로 타일링, 중경 패럴랙스)
      g.clear()
      g.fillStyle(0x9496a6); g.fillRect(0, 40, 256, 180)
      g.fillStyle(0x84869a)
      for (let y = 52; y < 220; y += 26) {
        for (let x = (y / 26) % 2 === 0 ? 0 : 22; x < 256; x += 44) g.fillRect(x, y, 40, 11)
      }
      g.fillStyle(0x9496a6)                                          // 흉벽
      for (let x = 4; x < 256; x += 42) g.fillRect(x, 16, 26, 26)
      g.generateTexture('ph_wall', 256, 220)
    }
    // 3단 패럴랙스 far/mid placeholder (⑤⑥) — 가로 심리스 반복
    if (!this.textures.exists('ph_bg_far')) {
      // 먼 배경: 단색 하늘만 (구름/봉우리 실루엣 placeholder는 제거 — bg_mountain.png 실제 아트가 그 역할을 대신한다.
      // 예전엔 안개띠(fillRect)와 산 실루엣(fillTriangle)이 있었는데, 색 경계가 성벽 흉벽(총안) 틈으로 비쳐
      // 가로 선/삼각형 도형처럼 보였다 — 카메라 배경색(0xa8dde0)과 동일한 단색으로 통일해 그 경계를 없앤다.
      g.clear()
      g.fillStyle(0xa8dde0); g.fillRect(0, 0, 512, 400)
      g.generateTexture('ph_bg_far', 512, 400)
    }
    // 성 내부 바닥 아래 장식(석재 안뜰) — 물 대신 사용
    g.clear()
    g.fillStyle(0x84869a); g.fillRect(0, 0, 64, 96)
    g.fillStyle(0x9496a6); g.fillRect(0, 0, 64, 6)
    g.fillStyle(0x6f7182); g.fillRect(4, 22, 26, 8); g.fillRect(36, 52, 22, 8); g.fillRect(10, 74, 30, 8)
    g.generateTexture('tile_underfloor_stone', 64, 96)

    // 수문장 NPC(성 밖): 실제 아트(npc_gatekeeper_02) 로드 실패 시 폴백 — 갈색 도포 노인 도형
    if (!this.textures.exists('npc_village_chief')) {
      g.clear()
      g.fillStyle(0x8a5a3b); g.fillRect(16, 24, 32, 40)   // 도포
      g.fillStyle(0xf3d5b5); g.fillRect(22, 8, 20, 18)    // 얼굴
      g.fillStyle(0xffffff); g.fillRect(26, 22, 12, 8)    // 흰 수염
      g.fillStyle(0x5d4037); g.fillRect(20, 4, 24, 6)     // 두건
      g.fillStyle(0x4e342e); g.fillRect(44, 28, 4, 34)    // 지팡이
      g.generateTexture('npc_village_chief', 64, 64)
    }

    // 점프 대쉬 잔상: 수평 스피드라인 — 실제 아트(effect_dash) 로드 실패 시에만 폴백
    if (!this.textures.exists('fx_dash')) {
      g.clear()
      g.fillStyle(0xffffff, 0.9); g.fillRect(0, 10, 76, 5)
      g.fillStyle(0x81d4fa, 0.75); g.fillRect(10, 22, 86, 6)
      g.fillStyle(0xffffff, 0.6); g.fillRect(0, 36, 60, 4)
      g.generateTexture('fx_dash', 96, 48)
    }

    // 이단 점프 하강풍: 아래로 뿜는 바람 (V자 + 구름)
    g.clear()
    g.fillStyle(0xe1f5fe, 0.9)
    g.fillTriangle(14, 6, 46, 6, 30, 34)
    g.fillTriangle(50, 6, 82, 6, 66, 34)
    g.fillStyle(0xffffff, 0.85)
    g.fillTriangle(30, 14, 66, 14, 48, 48)
    g.fillStyle(0xb3e5fc, 0.8)
    g.fillEllipse(20, 50, 22, 10); g.fillEllipse(76, 50, 22, 10); g.fillEllipse(48, 58, 26, 11)
    g.generateTexture('fx_jump_burst', 96, 64)

    // 타격 스파크
    g.clear()
    g.fillStyle(0xfff176, 0.95)
    g.fillCircle(16, 16, 7)
    g.fillStyle(0xffffff, 0.9)
    g.fillCircle(16, 16, 3)
    g.generateTexture('fx_hit_spark', 32, 32)

    // 아이템 아이콘 (32px, ASSET_SPEC) — icon_key와 동일한 텍스처 키
    // 코인은 실제 아트(items/coin.png) 로드 성공 시 그대로 두고, 실패 시에만 도형 폴백
    if (!this.textures.exists('icon_coin')) {
      g.clear()
      g.fillStyle(0xffc107); g.fillCircle(16, 16, 10)
      g.fillStyle(0xffe082); g.fillCircle(13, 13, 4)
      g.generateTexture('icon_coin', 32, 32)
    }

    g.clear()
    g.fillStyle(0xd32f2f); g.fillRoundedRect(9, 12, 14, 16, 4)
    g.fillStyle(0x90a4ae); g.fillRect(12, 6, 8, 7)
    g.generateTexture('icon_hp_potion_s', 32, 32)

    g.clear()
    g.fillStyle(0xf9a825); g.fillTriangle(6, 26, 16, 6, 26, 26)
    g.generateTexture('icon_turban_scrap', 32, 32)

    g.clear()
    g.lineStyle(5, 0x8e24aa)
    g.beginPath(); g.arc(16, 18, 9, Math.PI, 0, false); g.strokePath()
    g.fillStyle(0xce93d8); g.fillRect(5, 16, 5, 5); g.fillRect(22, 16, 5, 5)
    g.generateTexture('icon_red_hare_shoe', 32, 32)

    g.clear()
    g.fillStyle(0x616161); g.fillRect(14, 4, 4, 20)
    g.fillStyle(0x2196f3); g.fillTriangle(10, 4, 22, 4, 16, 14) // 청룡언월도 날
    g.fillStyle(0x8d6e63); g.fillRect(13, 22, 6, 6)
    g.generateTexture('icon_green_dragon_blade', 32, 32)

    // 누런 두건(모자 장비) 아이콘
    g.clear()
    g.fillStyle(0xf9a825); g.fillEllipse(16, 18, 22, 12)
    g.fillStyle(0xfbc02d); g.fillEllipse(16, 13, 16, 9)
    g.fillStyle(0xf57f17); g.fillRect(4, 18, 8, 3)
    g.generateTexture('icon_turban_cap', 32, 32)

    // 디펜스: 바리케이트(나무 방벽) — 실제 아트(img_barricade)가 오면 같은 키로 대체되므로 exists 가드
    if (!this.textures.exists('img_barricade')) {
      g.clear()
      g.fillStyle(0x6d4c41); g.fillRect(0, 8, 72, 44)              // 통나무 벽
      g.fillStyle(0x8d6e63); g.fillRect(0, 8, 72, 6)               // 윗면 하이라이트
      g.fillStyle(0x4e342e)                                        // 세로 통나무 이음새
      for (let x = 8; x < 72; x += 16) g.fillRect(x, 8, 3, 44)
      g.fillStyle(0x5d4037); g.fillRect(0, 26, 72, 6)              // 가로 지지대
      g.fillStyle(0x3e2723); g.fillTriangle(4, 8, 14, 8, 9, -2)   // 뾰족한 상단 말뚝
      g.fillTriangle(58, 8, 68, 8, 63, -2)
      g.generateTexture('img_barricade', 72, 60)
    }

    // 디펜스: 기지 미니어처(임시 도형) — 성 모형 + 붉은 깃발
    g.clear()
    g.fillStyle(0x9e9e9e); g.fillRect(6, 40, 76, 60)               // 성벽 몸체
    g.fillStyle(0xbdbdbd); g.fillRect(6, 40, 76, 8)               // 윗면
    g.fillStyle(0x757575)                                          // 흉벽(총안)
    for (let x = 6; x < 82; x += 20) g.fillRect(x, 28, 12, 12)
    g.fillStyle(0x6d4c41); g.fillRect(38, 60, 14, 40)            // 성문
    g.fillStyle(0x4e342e); g.fillRect(60, 6, 4, 34)              // 깃대
    g.fillStyle(0xd32f2f); g.fillTriangle(64, 8, 64, 24, 84, 16) // 붉은 깃발
    g.generateTexture('ph_base', 90, 100)

    g.destroy()
  }
}
