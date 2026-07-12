package com.project.threekingdoms.api;

import com.project.threekingdoms.api.dto.GameStateDtos.GameStateResponse;
import com.project.threekingdoms.api.dto.GameStateDtos.SaveStateRequest;
import com.project.threekingdoms.service.GameStateService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/game")
@RequiredArgsConstructor
public class GameStateController {

	private final GameStateService gameStateService;

	/** 접속 시 캐릭터/인벤토리/아이템 정의 로드 (캐릭터 없으면 관우 자동 생성) */
	@GetMapping("/state")
	public GameStateResponse loadState() {
		return gameStateService.loadState();
	}

	/** 자동 저장 (클라이언트 10초 주기 + 주요 이벤트 시) */
	@PostMapping("/state")
	public void saveState(@Valid @RequestBody SaveStateRequest request) {
		gameStateService.saveState(request);
	}
}
