package com.project.threekingdoms.api;

import com.project.threekingdoms.api.dto.AiCommandDtos.InterpretCommandRequest;
import com.project.threekingdoms.api.dto.AiCommandDtos.InterpretedCommand;
import com.project.threekingdoms.api.dto.AiCommandDtos.ChatRequest;
import com.project.threekingdoms.api.dto.AiCommandDtos.ChatResponse;
import com.project.threekingdoms.service.OllamaCommandService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/game/command")
@RequiredArgsConstructor
public class AiCommandController {

	private final OllamaCommandService ollamaCommandService;

	@PostMapping("/interpret")
	public InterpretedCommand interpret(@Valid @RequestBody InterpretCommandRequest request) {
		return ollamaCommandService.interpret(request);
	}

	@PostMapping("/chat")
	public ChatResponse chat(@Valid @RequestBody ChatRequest request) {
		return ollamaCommandService.chat(request);
	}
}

