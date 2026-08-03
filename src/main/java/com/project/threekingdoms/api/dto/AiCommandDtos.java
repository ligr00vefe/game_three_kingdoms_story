package com.project.threekingdoms.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class AiCommandDtos {

	private AiCommandDtos() {}

	public record InterpretCommandRequest(
		@NotBlank @Size(max = 120) String text,
		@Valid GameContext context
	) {}

	public record GameContext(
		String mapKey,
		String mode,
		String characterState,
		Integer hp,
		Integer maxHp
	) {}

	public record InterpretedCommand(
		String action,
		String targetId,
		String priority,
		String reply,
		String reason
	) {}
}

