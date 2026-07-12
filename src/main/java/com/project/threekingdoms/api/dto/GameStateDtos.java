package com.project.threekingdoms.api.dto;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/** /api/game/state 요청·응답 DTO 모음 */
public class GameStateDtos {

	public record CharacterDto(
		String name, int level, long exp,
		int maxHp, int hp, int maxMp, int mp,
		int attackPower, long gold, String stageCode
	) {}

	public record InventoryItemDto(
		@NotBlank String itemCode,
		@Min(1) int quantity,
		@Min(0) @Max(23) int slotIndex,
		boolean equipped
	) {}

	public record ItemDefinitionDto(
		String code, String name, String itemType,
		String iconKey, String effectJson, String description
	) {}

	public record GameStateResponse(
		CharacterDto character,
		List<InventoryItemDto> inventory,
		List<ItemDefinitionDto> itemDefinitions
	) {}

	public record SaveStateRequest(
		@Min(1) int level,
		@Min(0) long exp,
		@Min(1) int maxHp, @Min(0) int hp,
		@Min(1) int maxMp, @Min(0) int mp,
		@Min(1) int attackPower,
		@Min(0) long gold,
		@NotNull @Valid List<InventoryItemDto> inventory
	) {}
}
