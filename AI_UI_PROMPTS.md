# AI 이미지 생성 프롬프트 (대기실 / 로딩 / 업성 안전지대)

작성일: 2026-07-11 | 대상: GPT(DALL-E) 등 AI 이미지 생성기
**공통 스타일 프리픽스·팔레트·후처리 체크리스트는 `AI_IMAGE_PROMPTS.md` 2장·7장을 그대로 따른다.**

> **STYLE PREFIX (AI_IMAGE_PROMPTS.md 2장과 동일 — 모든 프롬프트 앞에 붙임)**
> ```
> Korean MMORPG side-scroller game art in the style of a cute 2.5-head-proportion cartoon platformer,
> hand-painted texture, soft cel shading, vivid but harmonious pastel-rich palette,
> ancient Chinese Three Kingdoms period fantasy setting,
> strict 2D side view (orthographic, no perspective vanishing point),
> clean silhouettes, game-asset quality, no text, no watermark, no UI, no characters.
> ```
> 캐릭터/NPC 프롬프트(L2, N1~N2, P1)에서는 마지막 구절을 `no text, no watermark, no UI`로 바꾼다 (캐릭터 자체가 대상이므로).

색 팔레트 앵커(AI_IMAGE_PROMPTS.md와 동일): sky teal `#a8dde0`, cloud cream `#f6f1e3`, roof plum `#6d5a86`,
roof red `#c14b3a`, wood brown `#8a5a3b`, stone gray `#8d8fa0`, grass green `#7cb45b`, water jade `#7fc8b0`, accent gold `#e8b64c`.

---

## 1. 대기실 (캐릭터 선택 화면)

### L1. 대기실 배경 (풀스크린 1장)
- **크기**: 2560×1440 생성 → 1920×1080 / 불투명
- 적용: `.lobby` CSS background 교체 (React 배경 이미지)
```
[STYLE PREFIX]
A full-screen character-selection lobby background for a side-scrolling MMORPG.
A giant ancient tree trunk in the center with two wide wooden shelf branches
growing horizontally across it (flat horizontal planks where characters can stand),
lush green canopy filling the top, soft god-rays falling from upper left,
distant pastel meadow with tiny mushroom houses and rainbow at the bottom sides.
The two shelf planks must be clearly flat and evenly spaced vertically,
center 60% of the image kept visually calm so character slots remain readable.
```

### L2. 관우 대기 일러스트 (선택 슬롯용)
- **크기**: 512×640 생성 → 128×160 / **투명 PNG**
- 적용: `.lobby-char` placeholder 교체, 키(파일) 제안: `frontend/src/assets/lobby_guanwu.png` (React 정적 import)
```
[STYLE PREFIX — 캐릭터 허용 버전]
A single idle character illustration for a character-select screen, transparent PNG.
A cute 2.5-head-proportion Guan Yu: long black beard, deep green ancient Chinese
war robe with gold trim, small green hat, holding a tall Green Dragon Crescent Blade
(guandao) planted on the ground beside him, calm proud expression, subtle idle pose
facing slightly left. Full body, feet on an invisible flat ground line.
```

### L3. 빈 슬롯 실루엣 (미공개 캐릭터)
- **크기**: 256×320 → 64×80 / **투명 PNG**
```
[STYLE PREFIX — 캐릭터 허용 버전]
A glowing white character silhouette placeholder for a locked character slot,
transparent PNG. Soft featureless humanoid silhouette filled with warm white light,
gentle golden sparkle aura at the feet, dreamy and inviting. No facial features.
```

### L4. 능력치 카드 프레임 (우측 패널)
- **크기**: 672×1024 → 224×~340 / **투명 PNG** (9-slice 사용 가능하게 모서리 장식은 가장자리만)
```
[STYLE PREFIX]
A vertical UI card frame for a character stats panel, transparent PNG.
Soft ivory parchment panel with rounded corners, thin sky-blue border,
small gold Three Kingdoms seal ornament at the top center, subtle paper texture.
Decorative details only near corners and edges; center must stay plain
so it can be stretched (9-slice).
```

## 2. 로딩 화면

### L5. 관우 걷기 스프라이트시트 (로딩 모션 + 추후 인게임 재사용)
- **크기**: 프레임당 128×128 × 8프레임 가로 1열 (1024×128) → 최종 64×64 ×8 (512×64)
- 적용: manifest `spritesheets`에 `guanwu_walk` (frameWidth 64, frameHeight 64) 등록 → 로딩 화면 CSS `steps(8)` 애니메이션/인게임 걷기 공용
```
[STYLE PREFIX — 캐릭터 허용 버전]
A horizontal 8-frame walk-cycle sprite sheet, transparent PNG, one row,
each frame exactly the same square size and character scale.
Cute 2.5-head-proportion Guan Yu walking to the right: deep green war robe,
long black beard, Green Dragon Crescent Blade resting on his shoulder.
Standard walk cycle (contact, down, pass, up positions ×2), feet aligned
to the same baseline in every frame, no motion blur, no background.
```

### L6. 로딩 배경 (선택 — 없으면 현재 그라데이션 유지)
- **크기**: 2560×1440 → 1920×1080 / 불투명, 하단 30%는 어두운 지면 밴드
```
[STYLE PREFIX]
A dim atmospheric loading-screen background for a side-scrolling MMORPG.
Night road to a distant fortress: dark blue-teal sky with soft stars,
faint silhouette of castle walls and gate towers on the horizon with tiny warm
lantern lights, a flat dirt road strip across the bottom third.
Very low contrast overall so centered white text stays readable.
```

## 3. 업성 (안전지대) 맵

### Y1. 성 내부 배경 성벽 밴드 (중경, 스크롤 0.5배)
- **크기**: 2048×880 → 2048×440 / **가로 tileable** / **상단 투명 PNG**
- manifest 키: `img_castle_wall` (`assets/img/castle_wall.png`)
```
[STYLE PREFIX]
Seamless horizontally tileable inner-castle-wall layer, transparent background PNG.
The inside face of an ancient Chinese fortress wall enclosing a courtyard:
gray stone brick wall with crenellated battlements on top, red wooden support
pillars at regular intervals, hanging red lanterns, small guard-tower roofs
(plum-purple tiles with gold trim) peeking above the battlements, some climbing
ivy. Bottom edge ends in a stone base that sits behind the walkway.
Left/right edges tile seamlessly.
```

### Y2. 성 내부 원경 (전각 지붕 + 하늘, 선택)
- **크기**: 2048×1024 → 1024×640 / **가로 tileable** / 불투명
- manifest 키: `bg_castle_interior` (`assets/img/bg_castle_interior.png`) — 있으면 Y1 대신 통짜 배경으로 사용됨
```
[STYLE PREFIX]
Seamless horizontally tileable background of the interior skyline of an ancient
Chinese fortress city at daytime: soft teal sky, layered pavilion rooftops
(plum and red tiles), banners, distant pagoda towers rising above a gray stone
wall line across the lower third. Bottom 25% stays simple (covered by gameplay
layers). Left/right edges tile seamlessly.
```

### Y3. 관청 건물 (성주가 지키는 관아)
- **크기**: 1520×1080 → 380×270 / **투명 PNG** / 바닥이 정확히 수평
- manifest 키: `img_gwan` (`assets/img/gwan_office.png`)
```
[STYLE PREFIX]
A single ancient Chinese government office building (guan/yamen) for a
side-scroller, transparent PNG. Stone platform base, vermilion pillars,
ivory plaster walls, a grand double-tier plum-purple tiled roof with upturned
eaves and gold trim, a large dark-wood double door at center with a golden
name plaque above (plaque left BLANK, no letters), two small stone lion statues
flanking the door, red lanterns under the eaves. The building must sit flat
on a horizontal ground line. Pure side view, whimsical cartoon proportions.
```

### Y4. 성문 (동쪽 출구)
- **크기**: 1040×1360 → 260×340 / **투명 PNG**
- manifest 키: `img_gate` (`assets/img/castle_gate.png`)
```
[STYLE PREFIX]
A single fortress gate tower seen from inside the castle, for a side-scroller,
transparent PNG. Massive gray stone gatehouse with a tall arched passage,
heavy dark-wood double doors reinforced with gold studs standing OPEN just a
crack of darkness, crenellated battlements and a small plum-purple roofed
watch pavilion on top, red banners on both sides. Sits flat on a horizontal
ground line. Pure side view.
```

### Y5. 포탈
- **크기**: 384×480 → 96×120 / **투명 PNG**
- manifest 키: `img_portal` (`assets/img/portal.png`)
```
[STYLE PREFIX]
A single magical portal for a side-scroller, transparent PNG.
Upright glowing oval swirl of translucent blue and cyan energy with soft white
core, faint sparkle particles around the rim, slight golden ring frame at the
outer edge. Bottom of the oval touches the ground line. No background.
```

### Y6. 석재 안뜰 하단 장식 밴드 (underFloor)
- **크기**: 1024×256 → 512×128 / **가로 tileable** / 불투명
- manifest 키: `img_courtyard` (`assets/img/underfloor_courtyard.png`)
```
[STYLE PREFIX]
Seamless horizontally tileable decorative stone-courtyard band shown BELOW the
walkway of a side-scrolling stage set inside a castle. Large flat paving stones
in cool gray with subtle moss in the seams, a fallen ginkgo leaf here and there,
top edge slightly darkened as if shadowed by the walkway above.
Left/right edges tile seamlessly.
```

### N1. 성주 NPC
- **크기**: 256×256 → 64×64 / **투명 PNG** / 발이 프레임 하단선에 정렬
- manifest 키: `npc_castle_lord` (`assets/img/npc_castle_lord.png`)
```
[STYLE PREFIX — 캐릭터 허용 버전]
A single idle NPC sprite for a side-scroller, transparent PNG, 64x64 game frame
composition. A dignified middle-aged Chinese castle lord (prefect) in a
plum-purple official robe with wide sleeves and a gold waist sash, black
official's hat with side wings, short neat beard, hands folded in his sleeves,
gentle wise expression. Full body, feet on the bottom frame line, side view
facing left.
```

### N2. 문지기 NPC
- **크기**: 256×256 → 64×64 / **투명 PNG**
- manifest 키: `npc_gatekeeper` (`assets/img/npc_gatekeeper.png`)
```
[STYLE PREFIX — 캐릭터 허용 버전]
A single idle NPC sprite for a side-scroller, transparent PNG, 64x64 game frame
composition. A young Chinese city-gate guard soldier: gray lamellar armor with
a red shoulder sash, simple iron helmet with a small red plume, holding a tall
spear upright in one hand, standing at attention, earnest expression.
Full body, feet on the bottom frame line, side view facing left.
```

---

## 3-B. 3단 패럴랙스 배경 (원근 완만 + 심리스 타일, ⑤⑥)

멀미를 줄이기 위해 배경을 **3개 스크롤 레이어**로 분리한다. 코드는 `GameScene.addLayer(key, scroll, depth, height, topY)`로
tileSprite를 가로 무한 반복하며, 아래 스크롤 계수를 사용한다 (실제 아트가 없으면 `ph_bg_far`/`ph_bg_mid`/`ph_wall` placeholder 폴백).

| 레이어 | 스크롤 계수 | 성 밖 키 | 업성 키 | 특징 |
|---|---|---|---|---|
| far (원경) | 0.1 | `bg_sky` | `bg_castle_interior` | 하늘·먼 봉우리. 거의 정지 |
| mid (중경) | 0.3~0.35 | `bg_mountains` | `img_castle_mid` | 멀리 작게 보이는 성벽·망루, 반복 |
| near (근경) | 0.55~0.6 | `bg_castle`/`bg_hills` | `img_castle_wall` | 가까운 성벽/언덕 |

### 심리스 타일 3분할 (edge + middle + edge)

각 레이어 이미지는 **좌측 모서리 / 반복 가능한 중앙 패턴 / 우측 모서리**로 나눠 제작한다.
중앙 패턴만 있으면 맵 폭에 맞춰 무한 반복하고, 모서리 이미지가 있으면 월드 양끝에 1회 배치해 마감한다.
가장 중요한 것은 **중앙 패턴의 좌/우 끝이 이음새 없이 맞물리는 것**(가로 tileable)이다.

- 파일 3종 예: `bg/castle_mid_left.png`, `bg/castle_mid_tile.png`(반복), `bg/castle_mid_right.png`
- 생성 프롬프트 공통 지시(각 레이어 프롬프트 끝에 부착):
```
Provide as a horizontally tileable strip: the LEFT and RIGHT edges must connect
seamlessly so the pattern can repeat infinitely without visible seams.
Keep lighting flat and even across the whole width (no vignette, no corner darkening),
otherwise repeats will show banding. Middle section must be a clean repeatable pattern.
```
- mid 레이어 프롬프트 예 (업성 `img_castle_mid`):
```
[STYLE PREFIX]
Seamless horizontally tileable MIDGROUND layer of small distant fortress walls and
watchtowers seen from inside a castle, transparent background PNG. Muted blue-gray
stone with tiny plum-purple tower roofs and gold banner dots, low detail so it reads
as far midground. Flat even lighting. Left/right edges connect seamlessly for infinite tiling.
```

> 현재는 도형 placeholder(`ph_bg_far`, `ph_bg_mid`)가 자동 폴백된다. 위 키로 파일만 넣으면 교체된다.
> 코드 렌더 순서(depth): far(-100) → mid(-80) → near(-60) → 건물(-52) → 돌바닥(-50) → **연못(-40)** → 캐릭터/몬스터(0).
> 연못(바닥 아래 장식)이 돌바닥 위로 오도록 depth를 조정했다 (⑦).

## 4. 생성 후 처리 (요약 — 상세는 AI_IMAGE_PROMPTS.md 7장)

1. 투명 배경/타일링/지면선 정렬 검사 → 2배 생성 후 1/2 다운스케일
2. `frontend/public/assets/manifest.json`에 위 표의 키로 등록 (L1/L2/L6은 React 정적 에셋이라 manifest 불필요)
3. 게임 코드는 이미 위 키들을 참조하고 있어 **파일만 넣으면 placeholder가 자동 교체**된다
4. `frontend/public/assets/CREDITS.md`에 AI 생성(도구/날짜) 기록

### 키 매핑 요약

| 에셋 | 파일 경로 | 키 / 적용 위치 |
|---|---|---|
| L1 대기실 배경 | src/assets/lobby_bg.png | `.lobby` CSS background |
| L2 관우 일러스트 | src/assets/lobby_guanwu.png | `.lobby-char` 교체 |
| L3 슬롯 실루엣 | src/assets/lobby_silhouette.png | `.lobby-silhouette` 교체 |
| L4 카드 프레임 | src/assets/lobby_card.png | `.lobby-card` 9-slice |
| L5 걷기 시트 | public/assets/img/guanwu_walk.png | manifest `guanwu_walk` (64×64×8) |
| L6 로딩 배경 | src/assets/loading_bg.png | `.loading` CSS background |
| Y1 성벽 밴드 | public/assets/img/castle_wall.png | `img_castle_wall` |
| Y2 성 내부 원경 | public/assets/img/bg_castle_interior.png | `bg_castle_interior` |
| Y3 관청 | public/assets/img/gwan_office.png | `img_gwan` |
| Y4 성문 | public/assets/img/castle_gate.png | `img_gate` |
| Y5 포탈 | public/assets/img/portal.png | `img_portal` |
| Y6 석재 안뜰 | public/assets/img/underfloor_courtyard.png | `img_courtyard` |
| N1 성주 | public/assets/img/npc_castle_lord.png | `npc_castle_lord` |
| N2 문지기 | public/assets/img/npc_gatekeeper.png | `npc_gatekeeper` |
