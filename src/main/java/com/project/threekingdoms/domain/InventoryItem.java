package com.project.threekingdoms.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "inventory_item")
@Getter
@Setter
@NoArgsConstructor
public class InventoryItem {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "character_id")
	private GameCharacter character;

	@Column(name = "item_code", nullable = false, length = 40)
	private String itemCode;

	@Column(nullable = false)
	private int quantity = 1;

	/** 인벤토리 격자 위치 0~23 (GAME_DESIGN 8.2) */
	@Column(name = "slot_index", nullable = false)
	private int slotIndex;

	@Column(nullable = false)
	private boolean equipped = false;

	public InventoryItem(GameCharacter character, String itemCode, int quantity, int slotIndex, boolean equipped) {
		this.character = character;
		this.itemCode = itemCode;
		this.quantity = quantity;
		this.slotIndex = slotIndex;
		this.equipped = equipped;
	}
}
