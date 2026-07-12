# 횡스크롤 게임 개발 계획서 (game_three_kingdoms)

작성일: 2026-07-10 | 스택: Spring Boot + React + Vite + TypeScript + Phaser 3

---

## 1. 목표와 제약

- **목표**: 메이플스토리류 브라우저 횡스크롤 게임. 초기엔 싱글플레이 기본 기능, 추후 멀티플레이·음향 확장.
- **게임 컨셉**: 삼국지 × 좀비. 주인공 관우(시작 무기: 청룡언월도), 첫 몬스터 황건당 좀비, 스테이지 1은 초원 사냥터. 스타일 벤치마크는 메이플스토리(참고만, 원본 에셋 사용 금지). **상세 기능 명세는 `GAME_DESIGN.md`**, 구현 규칙은 서브 에이전트 `sidescroller-game-dev` 참고.
- **제약**:
  - 게임 끊김/렉 금지 → 60fps 유지가 최우선 설계 기준
  - 로딩 문제 금지 → 에셋 파이프라인과 프리로딩 전략 필수
  - Phaser 렌더링 영역과 React 렌더링 영역의 명확한 분리
  - 확장성: 멀티(WebSocket)·음향은 지금 구현하지 않지만 구조상 자리를 비워둠

## 2. 기술 스택 및 버전 (2026-07-10 기준 최신 확인)

| 구분 | 선택 | 버전 | 비고 |
|---|---|---|---|
| Backend | Spring Boot | **4.0.x (권장, 현재 4.0.7)** | 4.1.0(2026-06-10)도 가능하나 4.0이 안정 패치 라인. 3.5.x는 2026-06 지원 종료 수순이라 신규 프로젝트에 비권장 |
| 빌드/JDK | Gradle + Java 17 | Gradle 8.x | Spring Boot 4.x 최소 요구 Java 17 충족 |
| Frontend 빌드 | Vite | 8.x (Rolldown 번들러) | 빌드 속도 대폭 향상 |
| UI | React + TypeScript | React 19 / TS 5.x | |
| 게임 엔진 | Phaser | **3.90.0 "Tsugumi"** | 3.x 최신 안정판 |
| DB | **MySQL 8.x (로컬, 처음부터)** | | H2 배제 확정 |

> **H2 없이도 Flyway는 유지한다.** Flyway의 본래 역할은 DB 전환이 아니라 **스키마 변경 이력의 버전 관리**다. 개발 중 테이블은 수십 번 바뀌는데(인벤토리 슬롯 추가, 스탯 컬럼 변경 등), `ddl-auto=update`에 맡기면 컬럼 삭제/이름 변경이 반영되지 않고 로컬 DB가 코드와 어긋나는 순간 원인 추적이 어렵다. Flyway는 변경을 `V1__init.sql, V2__add_artifact.sql...` 형태로 남겨 언제든 DB를 재현할 수 있고, 추후 배포 서버 DB 구축도 마이그레이션 실행 한 번으로 끝난다. 운영은 `ddl-auto=validate` + Flyway 조합이 표준.

## 3. Spring Initializr 의존성 선정

### 3.1 필수 (Initializr에서 바로 선택)

| 의존성 | 용도 |
|---|---|
| **Spring Web** | REST API (캐릭터/인벤토리/몬스터/NPC 데이터) |
| **Spring Data JPA** | 엔티티 영속화 |
| **MySQL Driver** | 로컬 MySQL 8.x (처음부터 사용, H2 배제) |
| **Validation** | 요청 DTO 검증 |
| **Lombok** | 보일러플레이트 제거 |
| **Spring Boot DevTools** | 백엔드 핫리로드 |
| **Flyway Migration** | 스키마 변경 이력 관리 (2장 인용문 참고 — H2 배제와 무관하게 유지) |
| **Spring Boot Actuator** | 헬스체크/메트릭 (성능 모니터링 기반) |

### 3.2 미리 포함 (지금은 미사용, 확장 대비)

| 의존성 | 대비하는 문제 |
|---|---|
| **WebSocket** (spring-boot-starter-websocket) | 멀티플레이/실시간 몬스터 리젠 브로드캐스트. STOMP 포함 |
| **Spring Security** | 계정/캐릭터 인증. 초기엔 permitAll로 열어두고 구조만 확보 |
| **Spring Cache** (+ 추후 Redis) | 몬스터 스폰 테이블·아이템 정의 등 정적 데이터 캐싱 |

### 3.3 Initializr 밖에서 수동 추가 (build.gradle)

| 라이브러리 | 대비하는 문제 |
|---|---|
| **springdoc-openapi** | API 문서 자동화 → 프론트 TS 타입 자동 생성의 원천 |
| **QueryDSL 또는 Spring Data JPA Specification** | 인벤토리/아이템 검색 조건이 복잡해질 때 |
| MapStruct | Entity↔DTO 매핑 (선택) |

### 3.4 프론트엔드 패키지

| 패키지 | 용도 / 대비하는 문제 |
|---|---|
| `phaser@3.90` | 게임 렌더링 전체 |
| `zustand` | Phaser↔React 상태 공유. **transient update 지원으로 리렌더 없이 값 구독 가능 → HP바 갱신이 React 리렌더 폭탄이 되는 문제 방지** |
| `axios` | REST 통신 |
| `openapi-typescript` (또는 orval) | 백엔드 DTO→TS 타입 자동 생성 → 타입 불일치 버그 사전 차단 |
| `@stomp/stompjs` + `sockjs-client` | (추후) 멀티플레이 WebSocket |
| `free-tex-packer-cli` (개발도구) | 스프라이트 아틀라스 생성 → HTTP 요청 수/드로우콜 감소 |
| Tailwind CSS (선택) | 인벤토리/대화창 등 React UI 빠른 제작 |

## 4. 아키텍처: Phaser / React 렌더링 분리 (핵심 설계)

### 4.1 분리 원칙

> **매 프레임(60fps) 갱신되는 것은 전부 Phaser Canvas, 이벤트성 UI는 전부 React DOM.**
> React 컴포넌트가 게임 루프에 묶여 리렌더되는 순간 렉이 시작된다.

| Phaser (Canvas/WebGL) | React (DOM 오버레이) |
|---|---|
| 캐릭터 이동/점프/대쉬/타격 모션 | 인벤토리 창 |
| 몬스터, 리젠, AI | NPC 대화창 (선택지 포함) |
| 타격 이펙트, 데미지 숫자(플로팅 텍스트) | 공지사항 배너 |
| 배경 패럴랙스, 맵, 장애물, 줄/사다리 | HP/MP 상태바, 경험치바 |
| 말풍선(캐릭터 머리 위, 월드좌표 부착) | 레벨업 결과 팝업, 설정/로그인 화면 |
| 아이템 드랍/줍기 연출 | |

- 말풍선처럼 **월드 좌표에 붙어 카메라와 함께 움직이는 것**은 Phaser. 화면에 고정된 것은 React.
- HP/MP바는 React지만 값 갱신은 zustand transient 구독 + 스로틀(예: 100ms)로 처리해 리렌더 최소화.

### 4.2 통신 구조

```
[Phaser Scene] ──게임 이벤트(피격, 레벨업, 아이템획득)──▶ [EventBus + zustand store] ──▶ [React UI]
[React UI] ──커맨드(아이템 사용, 대화 선택)──▶ [EventBus] ──▶ [Phaser Scene]
[양쪽] ──REST(axios)──▶ [Spring API] ──JPA──▶ [H2/MySQL]
```

- Phaser 인스턴스는 React 밖(모듈 싱글턴)에서 생성, React는 마운트 div만 제공. **React 리렌더가 게임 인스턴스를 절대 재생성하지 않도록** useRef + StrictMode 이중 마운트 가드 필수.
- 서버 권위 원칙: 데미지/경험치/드랍 **판정 로직을 서비스 계층에 분리**해 두고, 초기엔 클라 계산+서버 저장, 멀티 도입 시 서버 판정으로 승격.

### 4.3 프로젝트 구조 (모노레포)

```
game_three_kingdoms/          # 루트 = Spring Boot 4.1.0 백엔드 (Initializr 생성, Wrapper 포함)
├─ src/main/java/com/project/threekingdoms/   (api / config / 이후 domain / service)
├─ src/main/resources/        (application.yml, db/migration = Flyway)
├─ frontend/                  # Vite + React + TS
│  └─ src/
│     ├─ game/                # Phaser 전용 (scenes, entities, systems, EventBus)
│     ├─ ui/                  # React 전용 (inventory, dialog, hud, banner)
│     ├─ stores/              # zustand
│     └─ api/                 # 생성된 TS 타입 + axios 클라이언트
└─ README.md / DEVELOPMENT_PLAN.md / GAME_DESIGN.md / ASSET_SPEC.md
```

## 5. 예상 문제와 사전 대비책

| # | 예상 문제 | 대비책 |
|---|---|---|
| 1 | **GC로 인한 프레임 드랍** — 데미지 텍스트/이펙트/투사체를 매번 생성·파괴 | Phaser Group 오브젝트 풀링을 1일차부터 규칙화. `setActive(false)+setVisible(false)` 재사용 |
| 2 | **로딩 지연/이미지 깜빡임** — 개별 PNG 수십 장 요청 | 텍스처 아틀라스(free-tex-packer) + 전용 PreloadScene(진행바) + Spring 정적 리소스 Cache-Control 설정. WebP 우선 |
| 3 | **React 리렌더로 게임 렉** — HP 변화마다 상위 컴포넌트 리렌더 | zustand selector 구독 + transient update, HUD 컴포넌트 분리, React.memo |
| 4 | **초기 번들 비대** — Phaser(~1MB+)가 첫 화면 로드 지연 | React.lazy로 게임 청크 분리. 로그인/로비는 즉시, 게임은 지연 로드 |
| 5 | **스키마 변경 누적으로 로컬 DB와 코드 불일치** | Flyway 마이그레이션으로 처음부터 SQL 버전 관리, `ddl-auto=validate` |
| 6 | **물리 판정 이슈** — 줄/사다리, 아래로 통과되는 발판 | Arcade Physics(경량) 채택. 사다리는 overlap 영역+중력 토글, 원웨이 플랫폼은 `checkCollision.down=false` 패턴. Matter.js는 과잉이므로 배제 |
| 7 | **키 입력 씹힘/동시 입력** | Phaser Keyboard 플러그인으로 씬 단위 입력 상태 머신(idle/walk/jump/attack/dash) 구성 |
| 8 | **API 타입 불일치** | springdoc-openapi → openapi-typescript 자동 생성 파이프라인 |
| 9 | **멀티 도입 시 대규모 리팩터링** | 판정 로직 서비스 분리(4.2), WebSocket 스타터 선탑재, 엔티티에 서버 타임스탬프 필드 확보 |
| 10 | **탭 비활성 시 게임 상태 붕괴** | Phaser `game.events`의 blur/focus 처리, 델타타임 기반 이동(프레임 의존 금지) |

## 6. 디자인 에셋 조달 전략

### 6.1 기본 방침: Placeholder-First

> **구동이 우선, 아트는 후순위.** Phase 0~4는 무료 placeholder 팩으로 개발하고, 게임이 완전히 돌아간 뒤 아트 교체 단계(Phase 7)에서 일괄 교체한다.

이게 가능하려면 **코드가 이미지 파일을 직접 알면 안 된다**:
- 코드는 텍스처 키(`player_idle`, `hit_effect_01`)만 참조, 키→파일 매핑은 manifest(JSON) 한 곳에서 관리
- 해상도 규격을 처음부터 고정 (예: 캐릭터 프레임 64×64, 타일 32×32, 아이콘 32×32) → placeholder와 최종 아트가 같은 규격이면 **코드 수정 없이 파일만 교체**
- 애니메이션 프레임 수/이름 규칙(`walk_0~3`, `attack_0~5`)도 규격에 포함

### 6.2 에셋 유형별 조달 방법 구분

AI 적합성 기준: **정지 이미지 + 낱장 독립성이 높을수록 AI에 적합**, 프레임 간 일관성이 필요한 애니메이션일수록 AI에 취약.

| 에셋 유형 | 1순위 조달 | AI 적합성 | 비고 |
|---|---|---|---|
| **배경 이미지(원경, 패럴랙스 레이어)** | **AI 생성** | ★★★ 최적 | 정지 낱장이라 일관성 부담 없음. 스타일 프롬프트 고정 후 대량 생산 |
| **무기/장비/아이템/아티팩트 아이콘** | **AI 생성** | ★★★ 최적 | 단일 정지 이미지 대량 수요 = AI 최적 영역. 생성 후 선별 |
| **NPC 초상화(대화창용)** | **AI 생성** | ★★★ 최적 | 캐릭터당 1~2장 |
| **공지 배너/UI 장식 이미지** | AI 생성 + 무료 GUI팩 | ★★☆ | CraftPix GUI 무료팩과 혼용 |
| **맵 타일셋/장애물/플랫폼** | 무료→유료팩 | ★★☆ | 타일 간 이음새 정합성 필요. PixelLab 등 타일셋 특화 AI로 보조 가능 |
| **몬스터(모션 포함)** | **유료팩** | ★☆☆ | 여러 종 세트 유료팩이 가성비 최고 ($10~30/팩) |
| **캐릭터 베이스+모션(걷기/점프/공격/대쉬)** | **유료팩 → 필요시 외주** | ★☆☆ 취약 | 프레임 간 일관성이 게임 인상을 좌우. AI 스프라이트 도구는 초안용 |
| **타격/스킬 이펙트** | 무료/유료 이펙트 시트 | ★☆☆ | 프레임 애니메이션이라 AI 취약. 전용 팩이 풍부해 구매가 빠름 |

### 6.3 조달처 정리

**무료 (placeholder 및 실사용 겸용)**
- [Kenney](https://kenney.itch.io/) — 6만 개+ CC0(저작권 표기 불필요, 상업 사용 자유). placeholder 표준
- [itch.io 무료 사이드스크롤러 에셋](https://itch.io/game-assets/free/tag-side-scroller) — 무료 픽셀아트 팩 다수
- [CraftPix Freebies](https://craftpix.net/freebies/) — 배경/캐릭터/GUI 무료 60여 종
- OpenGameArt — 라이선스 개별 확인 필요(CC-BY는 크레딧 표기)

**유료 (최종 퀄리티용, 통상 $5~30/팩)**
- itch.io 유료 팩 — 같은 작가 시리즈로 맞추면 스타일 통일 용이
- CraftPix — 횡스크롤 특화 팩 다수, 로열티프리
- Unity Asset Store 2D — 라이선스가 Unity 외 엔진 사용 허용인지 개별 확인 필수

**AI 도구 (2026-07 기준)**
- [PixelLab](https://www.pixellab.ai/) — 픽셀아트 특화, 스프라이트 애니메이션/타일셋 생성, Aseprite 플러그인
- [Ludo.ai](https://ludo.ai/features/sprite-generator) — 스프라이트 시트+아틀라스 데이터 내보내기
- Midjourney / Stable Diffusion — 배경·초상화·아이콘 등 낱장 이미지 (스타일 LoRA/프롬프트 고정으로 통일감 유지)
- 배경 제거·업스케일 후처리: rembg, Real-ESRGAN (무료)

### 6.4 주의사항 (에셋 리스크)

| 리스크 | 대비 |
|---|---|
| 라이선스 위반 (상업 사용 불가 에셋 혼입) | 에셋마다 출처/라이선스를 `assets/CREDITS.md`에 기록하는 규칙. CC0·로열티프리 우선 |
| 스타일 불일치 (팩 혼용 시 톤 붕괴) | Phase 7 시작 시 스타일 가이드 1장 확정(픽셀 밀도, 팔레트, 외곽선 유무) 후 그 기준으로만 구매/생성. 방향: 메이플스토리풍 2~3등신 카툰 스프라이트 |
| 벤치마크 게임(메이플스토리) 저작권 | 스타일·조작감만 참고. 원본 스프라이트/BGM/UI 리소스 추출 사용 절대 금지 |
| AI 생성물 저작권 불확실성 | 핵심 식별 요소(주인공 등)는 유료팩/외주 우선, AI는 배경·아이콘 등 대체 가능 요소에 사용 |
| 규격 불일치로 재작업 | 6.1의 해상도/프레임 규격을 Phase 0에서 문서로 고정 |

## 7. 작업 순서 및 범위

### Phase 0 — 환경 세팅 (0.5~1일)
- Spring Initializr 생성(3.1 의존성), Vite 프로젝트 생성, 모노레포 구성
- 로컬 MySQL 8.x 설치/기동 + Flyway V1 스키마
- Vite dev 프록시(`/api` → :8080), CORS 설정
- **에셋 규격 문서 고정**(6.1: 해상도/프레임 규칙) + placeholder 팩 1종 선정(Kenney 또는 itch.io 무료팩)
- **목적**: 프론트-백 왕복이 되는 "Hello World" 확보. **리스크**: 프록시/CORS 설정 누락, 에셋 규격 미확정 시 추후 전면 재작업 → 초반에 확정

### Phase 1 — 게임 코어: 이동 (2~4일)
- PreloadScene(로딩바) / GameScene 구조, EventBus, 초원 배경 패럴랙스, 타일맵/장애물
- 관우 이동·점프·대쉬·점프대쉬, 카메라 팔로우, 줄/사다리 오르기, 점프 이동(발판 간) — 동작 명세는 GAME_DESIGN.md 3장
- **목적**: 조작감 확정. 여기서 60fps 안 나오면 이후 전부 무의미 → 풀링/델타타임 규칙 수립. **리스크**: 사다리 판정(문제 6)

### Phase 2 — 전투 (3~5일)
- 청룡언월도 휘두르기 모션 + 참격 이펙트(풀링), 스킬 1종(청룡참) + 이펙트, 히트박스 판정, 데미지 숫자(풀링)
- 데미지 계산식(서비스 분리), 황건당 좀비 AI(배회/추적/공격)·스폰/리젠, 피격/사망, HP/MP 소모·회복, 레벨업 연출
- **목적**: GAME_DESIGN.md 부록의 "스테이지 1 최소 구현 체크리스트" 완성 = 첫 마일스톤. **리스크**: 이펙트 남발로 GC 스파이크(문제 1)

### Phase 3 — 성장·아이템 (3~4일)
- 경험치/레벨업(연출은 Phaser, 결과 팝업은 React), 아이템 드랍·줍기, 인벤토리(React 창 + 서버 영속화), 아티팩트(장착 효과 스탯 반영)
- **목적**: 첫 Phaser↔React↔서버 3자 연동 검증. **리스크**: 인벤토리 열 때 프레임 드랍(문제 3)

### Phase 4 — 상호작용·연출 (2~3일)
- NPC 배치, 대화창(React)·말풍선(Phaser), 공지사항 배너(React), 잡다 연출 정리
- **목적**: 4.1 분리 원칙이 실제로 지켜지는지 검증하는 단계

### Phase 5 — 서버 영속화 완성 (1~2일)
- 캐릭터 상태 저장/로드 API 정리, Flyway 마이그레이션 정합성 점검(`validate` 모드)
- **리스크**: 스키마-엔티티 불일치(문제 5)

### Phase 6 — 최적화·검증 (2일)
- 텍스처 아틀라스 일괄 적용, 번들 분석(코드 스플리팅), Chrome 프로파일링으로 GC/드로우콜 점검, 로딩 시간 측정
- **목적**: "끊김·로딩 문제 없음" 제약의 최종 검증. **아트 교체 전에 성능 기준선을 확정**해 두는 단계

### Phase 7 — 아트 교체 (구동 완성 후, 기간은 조달 방식에 따라 가변)
1. 스타일 가이드 확정 (픽셀 밀도/팔레트/외곽선 — 6.4)
2. **AI 대량 생산**: 배경 레이어, 아이템/장비/아티팩트 아이콘, NPC 초상화, 배너 (★★★ 영역)
3. **유료팩 구매**: 캐릭터+모션, 몬스터 세트, 이펙트 시트, 타일셋 (★☆☆ 영역)
4. manifest 파일 매핑 교체 → 아틀라스 재생성 → 코드 수정 없이 반영 확인
- **목적**: 퀄리티 확보. **리스크**: 규격 불일치(6.4) — Phase 0 규격을 지킨 에셋만 구매/생성. 교체 후 Phase 6 성능 기준선과 비교해 프레임 저하 여부 검증

### 이후 (착수 안 함, 자리만 확보)
- **멀티플레이**: WebSocket/STOMP, 서버 권위 판정 승격, (규모 커지면) Redis
- **음향**: Phaser 내장 Sound(Web Audio) — 별도 라이브러리 불필요, 에셋 로딩 파이프라인에 오디오 추가만 하면 됨

## 8. 참고 소스 (버전 확인, 2026-07-10)

- Spring Boot 릴리스: https://github.com/spring-projects/spring-boot/releases (4.1.0 — 2026-06-10, 4.0.7 안정 패치)
- Spring Boot EOL: https://endoflife.date/spring-boot
- Phaser 3.90.0 "Tsugumi": https://phaser.io/download/stable
- Vite 8 발표(2026-03-12): https://vite.dev/blog/announcing-vite8
