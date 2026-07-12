package com.project.threekingdoms.api;

import java.time.Instant;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Phase 0 프론트-백 왕복 확인용. 이후 실제 게임 API가 추가되면 유지한 채 확장.
 */
@RestController
@RequestMapping("/api")
public class HealthController {

	@GetMapping("/health")
	public Map<String, Object> health() {
		return Map.of(
			"status", "ok",
			"game", "three-kingdoms",
			"serverTime", Instant.now().toString()
		);
	}
}
