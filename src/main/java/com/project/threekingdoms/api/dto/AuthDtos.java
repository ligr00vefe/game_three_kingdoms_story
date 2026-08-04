package com.project.threekingdoms.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class AuthDtos {
	private AuthDtos() {}

	public record Credentials(
		@NotBlank @Pattern(regexp = "[\\p{L}0-9_]{2,30}") String loginId,
		@NotBlank @Size(min = 4, max = 72) String password
	) {}

	public record RegisterRequest(
		@NotBlank @Pattern(regexp = "[\\p{L}0-9_]{2,30}") String loginId,
		@NotBlank @Size(min = 1, max = 30) String displayName,
		@NotBlank @Size(min = 4, max = 72) String password
	) {}

	public record AuthResponse(Long accountId, String loginId, String displayName) {}
}
