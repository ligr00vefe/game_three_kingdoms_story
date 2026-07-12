package com.project.threekingdoms.service;

import java.util.List;

import com.project.threekingdoms.api.dto.GameStateDtos.CharacterDto;
import com.project.threekingdoms.api.dto.GameStateDtos.GameStateResponse;
import com.project.threekingdoms.api.dto.GameStateDtos.InventoryItemDto;
import com.project.threekingdoms.api.dto.GameStateDtos.ItemDefinitionDto;
import com.project.threekingdoms.api.dto.GameStateDtos.SaveStateRequest;
import com.project.threekingdoms.domain.GameCharacter;
import com.project.threekingdoms.domain.InventoryItem;
import com.project.threekingdoms.repository.GameCharacterRepository;
import com.project.threekingdoms.repository.InventoryItemRepository;
import com.project.threekingdoms.repository.ItemDefinitionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 게임 상태 로드/저장.
 * 지금은 단일 캐릭터(관우) 전제 — 계정 시스템 도입 시 인증 주체 기준으로 확장한다.
 * 데미지/드랍 "판정"은 아직 클라이언트에 있고, 멀티 전환 시 이 서비스 계층으로
 * 승격한다 (DEVELOPMENT_PLAN 4.2 서버 권위 원칙).
 */
@Service
@RequiredArgsConstructor
public class GameStateService {

	public static final String DEFAULT_CHARACTER_NAME = "관우";

	private final GameCharacterRepository characterRepository;
	private final InventoryItemRepository inventoryRepository;
	private final ItemDefinitionRepository itemDefinitionRepository;

	@Transactional
	public GameStateResponse loadState() {
		GameCharacter character = characterRepository.findByName(DEFAULT_CHARACTER_NAME)
			.orElseGet(() -> characterRepository.save(new GameCharacter(DEFAULT_CHARACTER_NAME)));

		List<InventoryItemDto> inventory = inventoryRepository.findByCharacterId(character.getId()).stream()
			.map(i -> new InventoryItemDto(i.getItemCode(), i.getQuantity(), i.getSlotIndex(), i.isEquipped()))
			.toList();

		List<ItemDefinitionDto> defs = itemDefinitionRepository.findAll().stream()
			.map(d -> new ItemDefinitionDto(
				d.getCode(), d.getName(), d.getItemType(), d.getIconKey(), d.getEffectJson(), d.getDescription()))
			.toList();

		return new GameStateResponse(toDto(character), inventory, defs);
	}

	/**
	 * 스냅샷 저장: 캐릭터 스탯 갱신 + 인벤토리 전체 교체.
	 * 단일 플레이어 초기 단계의 단순한 방식 — Phase 5에서 증분 저장으로 개선 검토.
	 */
	@Transactional
	public void saveState(SaveStateRequest request) {
		GameCharacter character = characterRepository.findByName(DEFAULT_CHARACTER_NAME)
			.orElseGet(() -> characterRepository.save(new GameCharacter(DEFAULT_CHARACTER_NAME)));

		character.setLevel(request.level());
		character.setExp(request.exp());
		character.setMaxHp(request.maxHp());
		character.setHp(Math.min(request.hp(), request.maxHp()));
		character.setMaxMp(request.maxMp());
		character.setMp(Math.min(request.mp(), request.maxMp()));
		character.setAttackPower(request.attackPower());
		character.setGold(request.gold());

		inventoryRepository.deleteByCharacterId(character.getId());
		List<InventoryItem> items = request.inventory().stream()
			.map(i -> new InventoryItem(character, i.itemCode(), i.quantity(), i.slotIndex(), i.equipped()))
			.toList();
		inventoryRepository.saveAll(items);
	}

	private CharacterDto toDto(GameCharacter c) {
		return new CharacterDto(
			c.getName(), c.getLevel(), c.getExp(),
			c.getMaxHp(), c.getHp(), c.getMaxMp(), c.getMp(),
			c.getAttackPower(), c.getGold(), c.getStageCode());
	}
}
