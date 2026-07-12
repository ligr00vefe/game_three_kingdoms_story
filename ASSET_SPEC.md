# 에셋 규격 (ASSET_SPEC.md)

Phase 0에서 고정하는 규격. **이 규격을 지킨 에셋만 구매/생성/적용한다** (DEVELOPMENT_PLAN 6.1).
placeholder와 최종 아트가 같은 규격이면 코드 수정 없이 파일 교체만으로 아트 업그레이드가 가능하다.

## 1. 해상도 규격 (초기 확정값)

| 대상 | 규격 | 비고 |
|---|---|---|
| 플레이어(관우) 프레임 | **128×128px** | 2026-07-12 상향(64px는 저해상도 픽셀아트에서 장비 인식 불가 판정). CAMERA.ZOOM/히트박스 오프셋과 연동 필요 |
| 몬스터 프레임 | **64×64px** | 황건당 좀비 등. 대형 몬스터는 128×128 (추후) |
| 타일 | **32×32px** | 타일맵 기준 단위 |
| 아이콘 (아이템/장비/아티팩트) | **32×32px** | 인벤토리 슬롯 크기와 일치 |
| 이펙트 프레임 | 128×128px | 참격/스킬 이펙트는 캐릭터보다 큰 캔버스 필요 |
| 배경: 하늘 | 1024×640px | 가로 tileable, 불투명 |
| 배경: 먼 산 / 성곽 중경 | 2048×400 / 2048×450px | 가로 tileable, 상단 투명 PNG |
| 바닥 보행로 스트립 | 512×96px | 가로 tileable, 보행 표면은 상단 수평선 |
| 바닥 아래 장식 밴드(underFloor) | 512×128px | 가로 tileable. 캐릭터가 화면 bottom에 직접 닿지 않게 하는 필수 레이어 |
| 발판(돌/나무) | 256×64px | 투명 PNG, 3-slice(끝단 장식) |
| 계단 / 경사면 | 256×192 / 256×128px | 계단 1단 = 32×16px, 경사 1:2 |
| 사다리 / 줄 | 64×256 / 32×256px | 세로 tileable, 투명 PNG |
| NPC 초상화 | 256×256px | React 대화창용 |

> 배경/지형의 **생성 프롬프트는 AI_IMAGE_PROMPTS.md** 참고 (스타일 프리픽스·팔레트·후처리 체크리스트 포함)

- 게임 기본 해상도: **1024×576 (16:9)**, `Scale.FIT`으로 화면 맞춤
- 픽셀 밀도/등신: 메이플스토리풍 2~3등신 카툰. 스타일 가이드는 Phase 7에서 확정

## 2. 애니메이션 키 네이밍

`{entity}_{action}_{frame}` — 예: `guanwu_attack_0`, `zombie_yellow_walk_2`

| entity | 액션 목록 (초기) | 프레임 수(초기값) |
|---|---|---|
| `guanwu` | idle(4) / walk(6) / jump(2) / dash(3) / attack(6) / skill(8) / hit(2) / dead(4) | |
| `zombie_yellow` | idle(4) / walk(6) / attack(5) / hit(2) / dead(5) / spawn(6, 땅에서 기어나옴) | |
| `fx` | slash(5, 참격) / skill_dragon(10, 청룡참) / levelup(8) / hit_spark(4) | |

## 3. manifest 규칙

- 모든 에셋 경로는 `frontend/public/assets/manifest.json`에서만 정의
- 코드에서는 텍스처 키만 참조. 파일 경로 하드코딩 금지
- 아틀라스 도입(Phase 6) 시에도 manifest만 수정

## 4. 라이선스 기록

- 에셋 추가 시 `frontend/public/assets/CREDITS.md`에 출처/라이선스/URL 기록 (누락 금지)
- CC0·로열티프리 우선. 메이플스토리 원본 리소스 사용 절대 금지

## 5. Placeholder 조달 (Phase 1 착수 시)

1순위: [Kenney](https://kenney.nl) CC0 팩 (Platformer 계열) — 캐릭터/타일/아이콘 임시 대체
2순위: [itch.io 무료 사이드스크롤러 팩](https://itch.io/game-assets/free/tag-side-scroller)
Phase 0~1 개발 중에는 Phaser Graphics(도형)로도 충분 — 실루엣 박스로 기능 먼저.
