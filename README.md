# game_three_kingdoms

삼국지 × 좀비 컨셉의 브라우저 횡스크롤 게임 (메이플스토리 벤치마크).

| 문서 | 내용 |
|---|---|
| `DEVELOPMENT_PLAN.md` | 기술 스택, 아키텍처, 리스크, 작업 순서 |
| `GAME_DESIGN.md` | 게임 기능 명세 (동작 정의의 기준 문서) |
| `ASSET_SPEC.md` | 에셋 해상도/네이밍/라이선스 규격 |

구조: 루트 = Spring Boot 4.1.0 백엔드 (Gradle Wrapper 포함, Java 17) · `frontend/` Vite 8 + React 19 + TS + Phaser 3.90
백엔드 패키지: `com.project.threekingdoms`

---

## 최초 1회 준비

### 1. 로컬 MySQL 준비 (필수)

MySQL 8.x가 로컬에 설치되어 있어야 한다. 데이터베이스 생성:

```sql
CREATE DATABASE game_three_kingdoms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

- 접속 정보 기본값: `127.0.0.1:3306` / 계정 `threeKingdoms` / 비밀번호 `1234`
- 계정이 없다면 MySQL에서 생성 후 권한 부여:

  ```sql
  CREATE USER 'threeKingdoms'@'localhost' IDENTIFIED BY '1234';
  GRANT ALL PRIVILEGES ON game_three_kingdoms.* TO 'threeKingdoms'@'localhost';
  FLUSH PRIVILEGES;
  ```

- 다른 계정/비밀번호를 쓰면 환경변수 `GAME_DB_USER`, `GAME_DB_PASSWORD`로 덮어쓸 수 있다 (src/main/resources/application.yml 참고)
- 테이블은 백엔드 첫 실행 시 Flyway가 자동 생성한다 (V1__init.sql)

### 2. 프론트엔드 의존성 설치 (필수, 1회)

```bash
cd frontend
npm install
```

---

## 실행 (개발)

터미널 2개:

```bash
# 1) 백엔드 (MySQL 기동 상태에서, 프로젝트 루트)
gradlew.bat bootRun      # IntelliJ면 ThreeKingdomsApplication 실행

# 2) 프론트엔드
cd frontend
npm run dev
```

브라우저에서 http://localhost:5173 접속.

**Phase 0 정상 확인 기준**:
1. 게임 화면에 "Phase 0 OK" 표시 (Phaser 렌더링 정상)
2. 좌하단 HP/MP/경험치 HUD 표시 (React 오버레이 정상)
3. 화면 아래 "server: 연결됨" 표시 (Vite 프록시 → Spring → 응답 왕복 정상)
4. MySQL `game_three_kingdoms`에 `game_character`, `item_definition`, `inventory_item`, `flyway_schema_history` 테이블 생성 확인

API 문서: http://localhost:8080/swagger-ui.html

## 테스트

```bash
gradlew.bat test               # 단위 테스트 (Docker 불필요)
gradlew.bat integrationTest    # 영속화 통합 테스트 (로컬 Docker 필요 — MySQL Testcontainers)
```

## 성능 확인

- 게임 화면에서 **F3**: FPS 오버레이 토글 (이펙트 다발 상황에서 60 유지 확인)
- 초기 로드: Phaser 게임 청크는 지연 로드됨 — 첫 페인트는 UI만, 게임은 "게임 불러오는 중…" 후 표시

---

## 아키텍처 핵심 규칙 (요약)

- 매 프레임 갱신 = Phaser / 이벤트성 UI = React. 통신은 `EventBus` + zustand만
- 반복 생성 오브젝트는 오브젝트 풀링 필수, 이동은 델타타임 기반
- 에셋은 텍스처 키로만 참조 (`public/assets/manifest.json`), 규격은 `ASSET_SPEC.md`
- 스키마 변경은 Flyway 마이그레이션 파일 추가로만 (`ddl-auto=validate`)

상세 규칙: `.claude/agents/sidescroller-game-dev.md` (서브 에이전트)
