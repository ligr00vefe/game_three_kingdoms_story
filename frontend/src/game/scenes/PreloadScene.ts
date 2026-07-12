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
    // 몬스터 정의 (데이터 주도 — GAME_DESIGN 6장)
    this.load.json('monster_defs', 'assets/data/monsters.json')
    this.load.json('npc_defs', 'assets/data/npcs.json')
    // manifest 등록 에셋 일괄 로드 (아직 비어 있음 — 이미지 도입 시 여기만 통과하면 됨)
    this.load.json('asset_manifest', 'assets/manifest.json')
  }

  create() {
    this.loadManifestAssets().then(() => {
      this.generatePlaceholders()
      this.scene.start('Game')
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

    // 패럴랙스 배경 레이어 (가로 타일링)
    g.clear(); g.fillStyle(0x9e9e9e)
    g.fillTriangle(0, 200, 120, 40, 240, 200)
    g.fillTriangle(160, 200, 300, 70, 440, 200)
    g.fillTriangle(360, 200, 460, 100, 512, 200)
    g.generateTexture('bg_mountains', 512, 200)

    g.clear(); g.fillStyle(0x66bb6a)
    g.fillEllipse(100, 120, 320, 160)
    g.fillEllipse(360, 130, 380, 180)
    g.generateTexture('bg_hills', 512, 140)

    // 황건당 좀비: 64x64, 회녹색 몸 + 누런 두건 (GAME_DESIGN 6.2)
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

    // ---- 업성(안전지대) placeholder — manifest에 실제 아트가 오면 같은 키로 대체되므로 exists 가드 ----
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
    if (!this.textures.exists('ph_gwan')) {
      // 관청: 돌 기단 + 붉은 기둥 + 자주색 2단 기와지붕
      g.clear()
      g.fillStyle(0x8d8fa0); g.fillRect(10, 240, 360, 30)          // 기단
      g.fillStyle(0xf6f1e3); g.fillRect(40, 130, 300, 110)         // 벽
      g.fillStyle(0xc14b3a)                                          // 기둥
      g.fillRect(52, 130, 16, 110); g.fillRect(182, 130, 16, 110); g.fillRect(312, 130, 16, 110)
      g.fillStyle(0x5d4037); g.fillRect(150, 168, 80, 72)          // 대문
      g.fillStyle(0xe8b64c); g.fillRect(150, 200, 80, 4)
      g.fillStyle(0x6d5a86)                                          // 지붕 2단
      g.fillTriangle(0, 130, 380, 130, 190, 70)
      g.fillRect(0, 122, 380, 12)
      g.fillTriangle(60, 70, 320, 70, 190, 20)
      g.fillRect(60, 64, 260, 10)
      g.fillStyle(0xe8b64c); g.fillRect(176, 96, 28, 18)           // 현판
      g.generateTexture('ph_gwan', 380, 270)
    }
    if (!this.textures.exists('ph_gate')) {
      // 성문: 성벽 아치 + 나무 문 + 총안 흉벽
      g.clear()
      g.fillStyle(0x8d8fa0); g.fillRect(0, 60, 260, 280)           // 성벽 몸체
      g.fillStyle(0x7a7c8c)
      for (let y = 70; y < 330; y += 24) {
        for (let x = (y / 24) % 2 === 0 ? 0 : 20; x < 260; x += 40) g.fillRect(x, y, 36, 10)
      }
      g.fillStyle(0x37474f); g.fillRect(60, 160, 140, 180)         // 아치 그늘
      g.fillStyle(0x5d4037); g.fillRect(70, 180, 120, 160)         // 나무 문
      g.fillStyle(0xe8b64c); g.fillRect(70, 250, 120, 6)
      g.fillStyle(0x6d5a86); g.fillRect(-6, 30, 272, 34)           // 문루 지붕
      g.fillTriangle(0, 30, 260, 30, 130, 0)
      g.fillStyle(0x8d8fa0)                                          // 흉벽(총안)
      for (let x = 8; x < 260; x += 44) g.fillRect(x, 44, 28, 18)
      g.generateTexture('ph_gate', 260, 340)
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
      // 먼 배경: 하늘 + 옅은 안개 + 아주 흐린 봉우리 실루엣
      g.clear()
      g.fillStyle(0xa8dde0); g.fillRect(0, 0, 512, 400)
      g.fillStyle(0xc9e9ec); g.fillRect(0, 250, 512, 150)
      g.fillStyle(0xf6f1e3); g.fillEllipse(90, 78, 120, 44); g.fillEllipse(300, 120, 150, 50); g.fillEllipse(452, 66, 108, 38)
      g.fillStyle(0x9fb6c9); g.fillTriangle(30, 250, 150, 150, 260, 250); g.fillTriangle(300, 250, 410, 168, 512, 250); g.fillTriangle(-40, 250, 60, 176, 150, 250)
      g.generateTexture('ph_bg_far', 512, 400)
    }
    if (!this.textures.exists('ph_bg_mid')) {
      // 중경: 멀리 작게 보이는 반복 성벽 + 망루 (좌우 패턴 동일 → 심리스)
      g.clear()
      g.fillStyle(0x7e93a6); g.fillRect(0, 130, 256, 170)
      g.fillStyle(0x8b6f8f)
      for (let x = 0; x < 256; x += 64) { g.fillRect(x + 10, 78, 44, 56); g.fillTriangle(x + 4, 78, x + 60, 78, x + 32, 54) }
      g.fillStyle(0x6f8497)
      for (let x = 0; x < 256; x += 32) { g.fillRect(x + 6, 118, 20, 12) }
      g.fillStyle(0xe8b64c); for (let x = 0; x < 256; x += 64) { g.fillRect(x + 26, 96, 12, 10) }
      g.generateTexture('ph_bg_mid', 256, 300)
    }
    if (!this.textures.exists('ph_portal')) {
      // 포탈: 푸른 소용돌이 타원 (메이플 포탈 느낌)
      g.clear()
      g.fillStyle(0x1565c0, 0.5); g.fillEllipse(48, 60, 84, 108)
      g.fillStyle(0x42a5f5, 0.7); g.fillEllipse(48, 60, 62, 84)
      g.fillStyle(0xbbdefb, 0.9); g.fillEllipse(48, 60, 34, 52)
      g.fillStyle(0xffffff, 0.95); g.fillEllipse(48, 60, 14, 26)
      g.generateTexture('ph_portal', 96, 120)
    }
    // 성 내부 바닥 아래 장식(석재 안뜰) — 물 대신 사용
    g.clear()
    g.fillStyle(0x84869a); g.fillRect(0, 0, 64, 96)
    g.fillStyle(0x9496a6); g.fillRect(0, 0, 64, 6)
    g.fillStyle(0x6f7182); g.fillRect(4, 22, 26, 8); g.fillRect(36, 52, 22, 8); g.fillRect(10, 74, 30, 8)
    g.generateTexture('tile_underfloor_stone', 64, 96)

    // 촌장 NPC: 갈색 도포의 노인 (GAME_DESIGN 7장)
    g.clear()
    g.fillStyle(0x8a5a3b); g.fillRect(16, 24, 32, 40)   // 도포
    g.fillStyle(0xf3d5b5); g.fillRect(22, 8, 20, 18)    // 얼굴
    g.fillStyle(0xffffff); g.fillRect(26, 22, 12, 8)    // 흰 수염
    g.fillStyle(0x5d4037); g.fillRect(20, 4, 24, 6)     // 두건
    g.fillStyle(0x4e342e); g.fillRect(44, 28, 4, 34)    // 지팡이
    g.generateTexture('npc_village_chief', 64, 64)

    // 참격 이펙트: 초승달 궤적 (GAME_DESIGN 4.1) — 128 규격 (ASSET_SPEC)
    g.clear()
    g.fillStyle(0xffffff, 0.9)
    g.slice(64, 64, 56, Phaser.Math.DegToRad(-70), Phaser.Math.DegToRad(70), false)
    g.fillPath()
    g.fillStyle(0x87ceeb, 1)
    g.slice(52, 64, 48, Phaser.Math.DegToRad(-70), Phaser.Math.DegToRad(70), false)
    g.fillPath()
    g.generateTexture('fx_slash', 128, 128)

    // 청룡참: 푸른 대형 참격 (GAME_DESIGN 4.2)
    g.clear()
    g.fillStyle(0x1565c0, 0.85)
    g.slice(110, 64, 100, Phaser.Math.DegToRad(-80), Phaser.Math.DegToRad(80), false)
    g.fillPath()
    g.fillStyle(0x64b5f6, 0.9)
    g.slice(90, 64, 80, Phaser.Math.DegToRad(-75), Phaser.Math.DegToRad(75), false)
    g.fillPath()
    g.fillStyle(0xe3f2fd, 0.95)
    g.fillCircle(150, 40, 10); g.fillCircle(160, 64, 8) // 용의 눈/비늘 힌트
    g.generateTexture('fx_skill_dragon', 224, 128)

    // 찌르기 이펙트: 창끝 직선 궤적 (기본 공격 랜덤 모션 2, GAME_DESIGN 4.1 개정)
    g.clear()
    g.fillStyle(0x87ceeb, 0.55); g.fillRect(0, 24, 130, 16)
    g.fillStyle(0xffffff, 0.95); g.fillRect(0, 28, 138, 8)
    g.fillStyle(0xe3f2fd, 1); g.fillTriangle(130, 18, 130, 46, 160, 32) // 창끝
    g.generateTexture('fx_thrust', 160, 64)

    // 점프 대쉬 잔상: 수평 스피드라인
    g.clear()
    g.fillStyle(0xffffff, 0.9); g.fillRect(0, 10, 76, 5)
    g.fillStyle(0x81d4fa, 0.75); g.fillRect(10, 22, 86, 6)
    g.fillStyle(0xffffff, 0.6); g.fillRect(0, 36, 60, 4)
    g.generateTexture('fx_dash', 96, 48)

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
    g.clear()
    g.fillStyle(0xffc107); g.fillCircle(16, 16, 10)
    g.fillStyle(0xffe082); g.fillCircle(13, 13, 4)
    g.generateTexture('icon_coin', 32, 32)

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

    g.destroy()
  }
}
