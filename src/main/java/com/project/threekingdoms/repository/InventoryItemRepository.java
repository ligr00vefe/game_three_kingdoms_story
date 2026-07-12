package com.project.threekingdoms.repository;

import java.util.List;

import com.project.threekingdoms.domain.InventoryItem;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InventoryItemRepository extends JpaRepository<InventoryItem, Long> {
	List<InventoryItem> findByCharacterId(Long characterId);
	void deleteByCharacterId(Long characterId);
}
