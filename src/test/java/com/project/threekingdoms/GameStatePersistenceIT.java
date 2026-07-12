package com.project.threekingdoms;

import java.util.List;

import com.project.threekingdoms.api.dto.GameStateDtos.GameStateResponse;
import com.project.threekingdoms.api.dto.GameStateDtos.InventoryItemDto;
import com.project.threekingdoms.api.dto.GameStateDtos.SaveStateRequest;
import com.project.threekingdoms.service.GameStateService;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 영속화 통합 테스트 (Phase 5) — 실제 MySQL 컨테이너에서 Flyway V1~V2 적용 후
 * 캐릭터 자동 생성/저장/재로드 왕복을 검증한다.
 *
 * 실행: 로컬 Docker 기동 후 ./gradlew integrationTest
 * (기본 ./gradlew test 에서는 제외 — build.gradle 참고)
 * 참고: Boot 4에서 ConnectionDetailsFactory 오류 시 @ServiceConnection(name = "mysql") 지정.
 */
@Tag("integration")
@Testcontainers
@SpringBootTest
class GameStatePersistenceIT {

	@Container
	@ServiceConnection
	static MySQLContainer<?> mysql = new MySQLContainer<>("mysql:8.4");

	@Autowired
	GameStateService gameStateService;

	@Test
	void loadState_createsDefaultCharacterAndSeedItems() {
		GameStateResponse state = gameStateService.loadState();

		assertEquals("관우", state.character().name());
		assertEquals(1, state.character().level());
		assertTrue(state.inventory().isEmpty());
		// V1 시드 아이템 4종 (청룡언월도/물약/두건 조각/적토의 편자)
		assertEquals(4, state.itemDefinitions().size());
	}

	@Test
	void saveState_thenReload_roundTripsStatsAndInventory() {
		gameStateService.loadState(); // 캐릭터 생성 보장

		SaveStateRequest save = new SaveStateRequest(
			3, 40L, 120, 77, 60, 31, 14, 250L,
			List.of(
				new InventoryItemDto("consume_hp_potion_s", 5, 0, false),
				new InventoryItemDto("artifact_red_hare_shoe", 1, 1, true)
			));
		gameStateService.saveState(save);

		GameStateResponse reloaded = gameStateService.loadState();
		assertEquals(3, reloaded.character().level());
		assertEquals(250L, reloaded.character().gold());
		assertEquals(77, reloaded.character().hp());
		assertEquals(2, reloaded.inventory().size());
		InventoryItemDto artifact = reloaded.inventory().stream()
			.filter(i -> i.itemCode().equals("artifact_red_hare_shoe")).findFirst().orElseThrow();
		assertTrue(artifact.equipped());
		assertFalse(reloaded.inventory().get(0).itemCode().isBlank());
	}
}
