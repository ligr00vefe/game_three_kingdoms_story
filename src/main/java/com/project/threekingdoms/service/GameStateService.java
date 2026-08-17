package com.project.threekingdoms.service;

import java.time.LocalDateTime;
import java.util.List;

import com.project.threekingdoms.api.dto.GameStateDtos.CharacterDto;
import com.project.threekingdoms.api.dto.GameStateDtos.GameStateResponse;
import com.project.threekingdoms.api.dto.GameStateDtos.InventoryItemDto;
import com.project.threekingdoms.api.dto.GameStateDtos.ItemDefinitionDto;
import com.project.threekingdoms.api.dto.GameStateDtos.SaveStateRequest;
import com.project.threekingdoms.domain.GameCharacter;
import com.project.threekingdoms.domain.InventoryItem;
import com.project.threekingdoms.domain.CharacterQuickslot;
import com.project.threekingdoms.repository.CharacterQuickslotRepository;
import com.project.threekingdoms.api.dto.GameStateDtos.QuickslotDto;
import com.project.threekingdoms.repository.GameCharacterRepository;
import com.project.threekingdoms.repository.InventoryItemRepository;
import com.project.threekingdoms.repository.ItemDefinitionRepository;
import com.project.threekingdoms.repository.PlayerAccountRepository;
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
	private final CharacterQuickslotRepository quickslotRepository;
	private final PlayerAccountRepository accountRepository;

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

		return new GameStateResponse(toDto(character), inventory, defs, loadQuickslots(character.getId()));
	}

	@Transactional
	public GameStateResponse loadState(Long accountId, String characterCode) {
		return loadState(accountId, characterCode, true);
	}

	@Transactional
	public GameStateResponse loadState(Long accountId, String characterCode, boolean markAsRecentCharacter) {
		var account = accountRepository.findById(accountId).orElseThrow();
		if (markAsRecentCharacter) {
			account.setLastCharacterCode(characterCode);
			accountRepository.save(account);
		}
		GameCharacter character = characterRepository.findByAccountIdAndCharacterCode(accountId, characterCode)
			.orElseGet(() -> characterRepository.save(createCharacter(accountId, characterCode)));
		List<InventoryItemDto> inventory = inventoryRepository.findByCharacterId(character.getId()).stream()
			.map(i -> new InventoryItemDto(i.getItemCode(), i.getQuantity(), i.getSlotIndex(), i.isEquipped())).toList();
		List<ItemDefinitionDto> defs = itemDefinitionRepository.findAll().stream()
			.map(d -> new ItemDefinitionDto(d.getCode(), d.getName(), d.getItemType(), d.getIconKey(), d.getEffectJson(), d.getDescription())).toList();
		return new GameStateResponse(toDto(character, account.getDefenseStage(), account.getGold()), inventory, defs, loadQuickslots(character.getId()));
	}

	/**
	 * 스냅샷 저장: 캐릭터 스탯 갱신 + 인벤토리 전체 교체.
	 * 단일 플레이어 초기 단계의 단순한 방식 — Phase 5에서 증분 저장으로 개선 검토.
	 */
	@Transactional
	public void saveState(SaveStateRequest request) {
		GameCharacter character = characterRepository.findByName(DEFAULT_CHARACTER_NAME)
			.orElseGet(() -> characterRepository.save(new GameCharacter(DEFAULT_CHARACTER_NAME)));

		applyState(character, request);

		inventoryRepository.deleteByCharacterId(character.getId());
		List<InventoryItem> items = request.inventory().stream()
			.map(i -> new InventoryItem(character, i.itemCode(), i.quantity(), i.slotIndex(), i.equipped()))
			.toList();
		inventoryRepository.saveAll(items);
		saveQuickslots(character, request.quickslots());
	}

	@Transactional
	public void saveState(Long accountId, String characterCode, SaveStateRequest request) {
		var account = accountRepository.findById(accountId).orElseThrow();
		GameCharacter character = characterRepository.findByAccountIdAndCharacterCode(accountId, characterCode)
			.orElseGet(() -> characterRepository.save(createCharacter(accountId, characterCode)));
		account.setLastCharacterCode(characterCode);
		account.setGold(Math.max(0, request.gold()));
		if (request.defenseStage() > account.getDefenseStage()) {
			account.setDefenseStage(request.defenseStage());
			account.setDefenseStageReachedAt(LocalDateTime.now());
		}
		accountRepository.save(account);
		applyState(character, request, account.getDefenseStage(), account.getGold());
		inventoryRepository.deleteByCharacterId(character.getId());
		List<InventoryItem> items = request.inventory().stream()
			.map(i -> new InventoryItem(character, i.itemCode(), i.quantity(), i.slotIndex(), i.equipped())).toList();
		inventoryRepository.saveAll(items);
		saveQuickslots(character, request.quickslots());
	}

	private List<QuickslotDto> loadQuickslots(Long characterId) {
		return quickslotRepository.findByCharacterIdOrderBySlotIndex(characterId).stream()
			.map(q -> new QuickslotDto(q.getSlotIndex(), q.getEntryKind(), q.getEntryCode())).toList();
	}

	private void saveQuickslots(GameCharacter character, List<QuickslotDto> slots) {
		quickslotRepository.deleteByCharacterId(character.getId());
		// Hibernate may execute inserts before queued deletes. Flush first so the
		// unique (character_id, slot_index) key cannot reject a slot replacement.
		quickslotRepository.flush();
		var valid = slots.stream()
			.filter(q -> "item".equals(q.kind()) || "skill".equals(q.kind()))
			.map(q -> new CharacterQuickslot(character, q.slotIndex(), q.kind(), q.code())).toList();
		quickslotRepository.saveAll(valid);
	}

	private void applyState(GameCharacter character, SaveStateRequest request) {
		applyState(character, request, request.defenseStage(), request.gold());
	}

	private void applyState(GameCharacter character, SaveStateRequest request, int defenseStage, long gold) {
		character.setLevel(request.level());
		character.setExp(request.exp());
		character.setMaxHp(request.maxHp());
		character.setHp(Math.min(request.hp(), request.maxHp()));
		character.setMaxMp(request.maxMp());
		character.setMp(Math.min(request.mp(), request.maxMp()));
		character.setAttackPower(request.attackPower());
		character.setGold(gold);
		if (request.stageCode() != null && !request.stageCode().isBlank()) character.setStageCode(request.stageCode());
		character.setDefenseStage(defenseStage);
		character.setPositionX(request.positionX());
		character.setPositionY(request.positionY());
	}

	private CharacterDto toDto(GameCharacter c) {
		return toDto(c, c.getDefenseStage(), c.getGold());
	}

	private CharacterDto toDto(GameCharacter c, int defenseStage, long gold) {
		return new CharacterDto(
			c.getName(), c.getCharacterCode(), c.getLevel(), c.getExp(),
			c.getMaxHp(), c.getHp(), c.getMaxMp(), c.getMp(),
			c.getAttackPower(), gold, c.getStageCode(), defenseStage,
			c.getPositionX(), c.getPositionY());
	}

	private String characterNameFor(String characterCode) {
		return switch (characterCode) {
			case "zhaoyun" -> "조운";
			case "lubu" -> "여포";
			default -> "관우";
		};
	}

	/** 신규 세이브 슬롯의 기본 능력치는 프런트 캐릭터 정의와 같은 값으로 시작한다. */
	private GameCharacter createCharacter(Long accountId, String characterCode) {
		GameCharacter character = new GameCharacter(characterNameFor(characterCode));
		character.setAccountId(accountId);
		character.setCharacterCode(characterCode);
		switch (characterCode) {
			case "zhaoyun" -> {
				character.setMaxHp(200); character.setHp(200);
				character.setMaxMp(150); character.setMp(150);
				character.setAttackPower(90);
			}
			case "lubu" -> {
				character.setMaxHp(250); character.setHp(250);
				character.setMaxMp(100); character.setMp(100);
				character.setAttackPower(100);
			}
			default -> {
				character.setMaxHp(220); character.setHp(220);
				character.setMaxMp(120); character.setMp(120);
				character.setAttackPower(95);
			}
		}
		return character;
	}
}
