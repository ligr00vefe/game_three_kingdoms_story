# AI 이미지 생성 프롬프트 (배경/장애물)

작성일: 2026-07-10 | 대상: GPT(DALL-E) 등 AI 이미지 생성기
레퍼런스: 삼국지풍 성 외곽 컨셉(첨부 1), 메이플스토리 맵 구조(첨부 2) 분석 기반.
**규격은 ASSET_SPEC.md와 일치해야 하며, 생성 후 반드시 후처리 체크리스트(7장)를 거친다.**

---

## 1. 레퍼런스 분석 결과 (프롬프트에 반영된 기준)

| 항목 | 분석 | 게임 적용 기준 |
|---|---|---|
| 캐릭터 스케일 | 화면(1266px) 대비 캐릭터 약 70px = 세로의 ~11% | **64×64px** (화면 1024×576 기준 동일 비율). 건물 문 높이 = 캐릭터 2.2~2.5배 |
| 바닥(walkway) | 캐릭터가 화면 최하단에 직접 닿지 않고, 돌로 쌓은 보행로 위를 걸음. 보행로 아래로 물/연꽃 장식 밴드가 존재 | 지면선 아래 **underFloor 장식 밴드(96~128px)** 필수. 캐릭터 발이 뷰포트 bottom에 닿는 구조 금지 |
| 층 구조 | 2~3개 층이 발판으로 분리, 층 사이는 사다리/줄/점프로 연결 | 층 간격 = 점프 높이 이내(96~110px) 또는 사다리 연결 |
| 이동 경로 유형 | ① 점프 이동(분리형 발판) ② 계단형 ③ 경사형 ④ 줄/사다리 | 맵 데이터 스키마에 4유형 반영 (GAME_DESIGN 10장) |
| 배경 레이어 | 하늘/구름(원경) → 떠 있는 봉우리·먼 산(중원경) → 성·나무(중경) → 보행로(전경) → 수면 장식(최전경 하단) | **레이어 5분리**, 각각 별도 이미지로 생성해 패럴랙스 적용 |

## 2. 공통 스타일 가이드 (모든 프롬프트 앞에 붙일 프리픽스)

> **STYLE PREFIX (영문, 복사용)**
> ```
> Korean MMORPG side-scroller game art in the style of a cute 2.5-head-proportion cartoon platformer,
> hand-painted texture, soft cel shading, vivid but harmonious pastel-rich palette,
> ancient Chinese Three Kingdoms period fantasy setting,
> strict 2D side view (orthographic, no perspective vanishing point),
> clean silhouettes, game-asset quality, no text, no watermark, no UI, no characters.
> ```

공통 금지(네거티브) 지시:
```
Do NOT include: any people or creatures, UI elements, text, logos, photorealism,
3D perspective floor, strong film grain, frame or border.
```

색 팔레트 고정(전 에셋 공통 — 톤 통일):
```
Palette anchors: sky teal #a8dde0, cloud cream #f6f1e3, roof plum #6d5a86, roof red #c14b3a,
wood brown #8a5a3b, stone gray #8d8fa0, grass green #7cb45b, water jade #7fc8b0, accent gold #e8b64c.
```

## 3. 배경 레이어 (패럴랙스용, 레이어별 개별 생성)

### A1. 하늘 + 구름 (최원경, 스크롤 0.05배)
- **크기**: 2048×1024 생성 → 1024×640으로 다운스케일 / **가로 무한 반복(tileable)** / 불투명
```
[STYLE PREFIX]
Seamless horizontally tileable sky background for a side-scrolling game.
Soft teal-to-warm-peach gradient sky at golden hour, large fluffy cream clouds
with subtle pink rim light, a few tiny distant floating islands as faint silhouettes.
Bottom 20% must stay uncluttered (it will be covered by other layers).
The left and right edges must connect seamlessly when tiled side by side.
```

### A2. 먼 산·떠 있는 봉우리 (원경, 스크롤 0.2배)
- **크기**: 2048×800 생성 → 2048×400 / **가로 tileable** / **상단 투명 PNG**
```
[STYLE PREFIX]
Seamless horizontally tileable distant mountain layer, transparent background PNG.
Misty blue-violet karst peaks and floating rock islands with tiny pagoda silhouettes
and pine trees, atmospheric haze fading toward the bottom, low saturation so it reads
as far background. Only the mountain band is painted; everything above is transparent.
Left/right edges tile seamlessly.
```

### A3. 성곽 중경 (중경, 스크롤 0.5배)
- **크기**: 2048×900 생성 → 2048×450 / **가로 tileable** / **투명 PNG**
```
[STYLE PREFIX]
Seamless horizontally tileable midground castle layer, transparent background PNG.
An ancient Three Kingdoms fortress exterior built on layered dark rock: stacked
Chinese pavilion roofs (plum-purple and red tiles with gold trim), round gates,
hanging paper lanterns, stone walls, big fluffy round-canopy trees hugging the rocks,
small clouds drifting between towers. Whimsical cartoon proportions (roofs slightly
oversized). Only silhouette band is painted, transparent above. Bottom edge ends in
rocky base that will sit behind the walkway. Left/right edges tile seamlessly.
```

## 4. 지형/바닥

### B1. 보행로(바닥) 스트립 — 캐릭터가 걷는 지면
- **크기**: 1024×192 생성 → 512×96 / **가로 tileable** / 상단 투명
- 상단 표면선이 y=12px 위치에 평평하게 와야 함 (충돌 지면선과 일치)
```
[STYLE PREFIX]
Seamless horizontally tileable ground walkway strip for a side-scroller, transparent PNG.
A raised stone-block walkway path: flat walkable grass-topped surface on top edge,
front face made of stacked gray stone bricks with moss patches and small glowing
stone lanterns embedded sparsely. The walkable top surface must be a perfectly
straight horizontal line near the top edge. Left/right edges tile seamlessly.
No perspective: pure side view.
```

### B2. 바닥 아래 장식 밴드 (underFloor — 캐릭터 이동 불가 영역)
- **크기**: 1024×256 생성 → 512×128 / **가로 tileable** / 불투명
```
[STYLE PREFIX]
Seamless horizontally tileable decorative water band shown BELOW the walkway of
a side-scrolling stage. Calm jade-green pond water with soft ripples, glowing pink
lotus flowers and lily pads, a few mossy rock bases sinking into the water,
gentle sparkle highlights. Top edge slightly darkened as if shadowed by the walkway
above. Left/right edges tile seamlessly.
```

### B3. 돌 발판 (분리형/점프 이동용, 3-slice)
- **크기**: 512×128 생성 → 256×64 / **투명 PNG** / 좌끝·중앙·우끝 구조(중앙 반복 가능)
```
[STYLE PREFIX]
A single floating stone platform ledge for a side-scroller, transparent PNG.
Flat grass-topped walkable surface, stone brick edge with rounded carved ends,
small hanging vines and one tiny lantern under the ledge. The top surface must be
perfectly flat and horizontal. Designed so the middle section can be stretched:
decorative details only near the two ends.
```

### B4. 나무 비계 발판 (변형, 성 공사장 느낌)
- **크기**: 512×128 → 256×64 / **투명 PNG**
```
[STYLE PREFIX]
A single wooden scaffold platform for a side-scroller, transparent PNG.
Dark timber planks lashed with rope on top of two wooden support brackets,
Three Kingdoms construction style, flat horizontal walkable top, small red banner
tied on one end. Clean silhouette, no background.
```

### B5. 돌계단 (계단형 이동)
- **크기**: 512×384 → 256×192 / **투명 PNG** / 계단 1단 = 32px(가로)×16px(세로) 비율 준수
```
[STYLE PREFIX]
A stone staircase ascending to the right for a side-scroller, transparent PNG.
Six broad stone steps with grass tufts on each tread, mossy edges, carved stone
side wall. Each step tread must be flat and horizontal; step rise:run ratio 1:2
(each step twice as wide as tall). Pure side view, no background.
```
(왼쪽 오름 계단은 좌우 반전으로 재사용)

### B6. 잔디 경사면 (경사형 이동)
- **크기**: 512×256 → 256×128 / **투명 PNG** / 경사도 약 26도(1:2)
```
[STYLE PREFIX]
A gentle grassy slope hill piece for a side-scroller, transparent PNG.
Smooth 26-degree incline rising to the right, grass surface with small flowers,
stone-brick front face below the grass line matching a stone walkway style.
The slope surface must be a straight incline (no bumps). Pure side view.
```

## 5. 이동 오브젝트 (줄/사다리)

### C1. 나무 사다리
- **크기**: 128×512 → 64×256 / **투명 PNG** / **세로 tileable** (상하 반복)
```
[STYLE PREFIX]
A vertical wooden ladder for a side-scroller, transparent PNG, vertically tileable.
Two bamboo side rails with evenly spaced wooden rungs (rung every 32 pixels
at final scale), slightly weathered, small rope bindings at joints.
Top and bottom edges must connect seamlessly when stacked vertically.
```

### C2. 등나무 줄 (rope)
- **크기**: 64×512 → 32×256 / **투명 PNG** / **세로 tileable**
```
[STYLE PREFIX]
A single hanging climbing vine rope for a side-scroller, transparent PNG,
vertically tileable. Thick twisted green-brown vine with small leaves sprouting
sparsely, gentle S-curve but overall vertical. Top/bottom edges tile seamlessly.
```

## 6. 장애물 (점프로 넘는 오브젝트, 전부 투명 PNG)

### D1. 이끼 낀 바위
- **크기**: 144×104 → 72×52
```
[STYLE PREFIX]
A single mossy gray boulder obstacle for a side-scroller, transparent PNG.
Rounded rock with moss patches and tiny mushrooms at its base, sitting flat
on the ground line. Clean silhouette, pure side view.
```

### D2. 부서진 보급 수레
- **크기**: 192×120 → 96×60
```
[STYLE PREFIX]
A broken wooden supply cart obstacle for a side-scroller, transparent PNG.
Tilted two-wheel ancient Chinese cart with spilled rice sacks and a torn
yellow cloth banner, one wheel cracked. Sits flat on the ground line. Side view.
```

### D3. 황건적 바리케이드 (신규 — 스테이지 테마 강화)
- **크기**: 192×128 → 96×64
```
[STYLE PREFIX]
A rebel barricade obstacle for a side-scroller, transparent PNG.
Crossed sharpened wooden stakes lashed with rope, a tattered yellow turban cloth
and a small yellow banner tied on top, scattered straw at the base.
Sits flat on the ground line. Side view.
```

## 7. 생성 후 처리 체크리스트 (필수)

1. **투명 배경 확인** — 투명 지정 에셋에 흰 배경이 섞였으면 재생성 또는 rembg로 제거
2. **타일링 검사** — 가로/세로 반복 에셋은 2장 이어붙여 이음새 확인 (어긋나면 재생성 요청: "make left/right edges connect seamlessly")
3. **다운스케일** — 지정 크기로 리사이즈(2배 생성 → 1/2 축소가 선명함)
4. **지면선 정렬** — B1/B3/B5/B6는 보행 표면이 정확히 수평(계단은 단별 수평)인지 확인. 어긋나면 상단 몇 px 크롭으로 보정
5. **팔레트 점검** — 2장의 팔레트 앵커와 크게 어긋난 색이면 색보정
6. **manifest 등록** — `frontend/public/assets/manifest.json`의 images에 키 추가 (키 이름은 아래 표)
7. **CREDITS 기록** — `frontend/public/assets/CREDITS.md`에 "AI 생성(도구명/날짜)" 기록

### 텍스처 키 매핑 (코드가 이미 참조하는 키 — 이 이름으로 저장)

| 에셋 | 파일명 제안 | manifest 키 |
|---|---|---|
| A1 하늘 | bg/stage1_sky.png | `bg_sky` |
| A2 먼 산 | bg/stage1_mountains.png | `bg_mountains` |
| A3 성곽 중경 | bg/stage1_castle.png | `bg_hills` (기존 키 재사용) |
| B1 보행로 | terrain/walkway.png | `tile_ground` |
| B2 수면 밴드 | terrain/underfloor.png | `tile_underfloor` |
| B3 돌 발판 | terrain/platform_stone.png | `tile_platform` |
| B4 나무 발판 | terrain/platform_wood.png | `tile_platform_wood` |
| B5 돌계단 | terrain/stairs_stone.png | `tile_stairs` |
| B6 경사면 | terrain/slope_grass.png | `tile_slope` |
| C1 사다리 | terrain/ladder.png | `tile_ladder` |
| C2 줄 | terrain/rope.png | `tile_rope` |
| D1 바위 | obstacle/rock.png | `obstacle_rock` |
| D2 수레 | obstacle/cart.png | `obstacle_cart` |
| D3 바리케이드 | obstacle/barricade.png | `obstacle_barricade` |

## 8. 전투 이펙트 — 기본 공격 3연 콤보 (신규)

기본 공격이 **찌르기 → 휘두르기 → 대쉬찌르기** 3연타로 나뉜다. 1타(찌르기)는 기존
`fx_attack`(effect_basic_attack.png — 오른쪽 한 점으로 수렴하는 백청색 창격)을 그대로 쓴다.
2·3타 전용 아트만 새로 만든다. **전용 아트가 없으면 코드가 찌르기 이펙트로 자동 폴백**하므로
게임은 지금도 돌아간다 — 아래는 콤보를 시각적으로 완성하기 위한 아트다.

**이펙트 공통 규칙**(기존 `fx_attack`과 반드시 통일):
- **오른쪽을 향한다**(facing=1 기준). 코드가 좌향일 때 flipX로 뒤집는다.
- **완전 투명 PNG**, 흰 배경 금지. 색은 기존 창격과 같은 **백색~청록(cyan-white) 에너지 광휘**.
- 캐릭터·무기·배경 없이 **에너지 궤적만**. 텍스트·테두리 없음.
- "타격 지점"(적에게 닿는 앞끝)이 그림 안 어디인지 **일관돼야** 정렬이 맞는다 — 아래 지정 위치를 지킬 것.
  아트가 나오면 EffectManager의 `SWING_FX`/`DASH_THRUST_FX` originX/Y를 실측해 맞춘다.

### E1. 휘두르기 참격 호 (콤보 2타)
- **크기**: 1024×1024 생성 → 512×512 / **투명 PNG**
- 적용: `fx_swing`. 타격 지점 = **호의 오른쪽 앞끝(볼록한 바깥 가장자리)**
```
[STYLE PREFIX — 이펙트용: no characters, no weapon, no background]
A single crescent slash arc energy effect, transparent PNG, facing RIGHT.
A wide sweeping sabre slash shaped like a bright cyan-white crescent moon, thick glowing
leading edge on the RIGHT (outer) side tapering to a thin wispy tail on the inner side,
soft motion-blur streaks following the curve, tiny sparkle particles flying off the leading edge.
White-hot core fading to translucent teal at the edges. Clean energy only — no blade, no hand.
The bright convex edge (the hit point) sits on the RIGHT third of the canvas.
Do NOT include: any character, weapon, hand, background, text, frame.
```

### E2. 대쉬찌르기 관통 궤적 (콤보 3타)
- **크기**: 1280×512 생성 → 640×256 / **투명 PNG** (가로로 긴 캔버스)
- 적용: `fx_dash_thrust`. 타격 지점 = **오른쪽 끝의 창끝 한 점**
```
[STYLE PREFIX — 이펙트용: no characters, no weapon, no background]
A long horizontal lunging thrust energy streak, transparent PNG, facing RIGHT.
A sharp piercing spear-thrust trail: many thin cyan-white speed lines rushing to the RIGHT
and converging to a single brilliant white-hot point at the far RIGHT tip, with a bright
elongated core and faint after-images/echo streaks trailing to the LEFT to convey a fast dash.
Longer and sharper than a normal thrust. Clean energy only — no blade, no hand.
The converging tip (the hit point) touches the RIGHT edge of the canvas.
Do NOT include: any character, weapon, hand, background, text, frame.
```

### 전투 이펙트 키 매핑

| 에셋 | 파일명 제안 | manifest 키 | 폴백 |
|---|---|---|---|
| E1 휘두르기 호 | fx/effect_swing_arc.png | `fx_swing` | 없으면 `fx_attack`(찌르기)로 자동 대체 |
| E2 대쉬찌르기 | fx/effect_dash_thrust.png | `fx_dash_thrust` | 없으면 `fx_attack`(찌르기)로 자동 대체 |

> 등록 후: manifest에 위 키 추가 → 게임이 자동으로 폴백 대신 전용 아트를 쓴다. 그 다음
> EffectManager의 `SWING_FX`/`DASH_THRUST_FX` originX/Y를 아트 실측값으로 조정해 타격 지점을 맞춘다.
